import type { DateString } from "@/lib/science/types";
import { todayIn } from "@/lib/time";

/**
 * Turns raw samples read from Apple Health or Android Health Connect into the
 * rows Almanac stores: one weight, one night of sleep and one resting heart
 * rate per day, plus cardio sessions. Pure and unit tested; the phone sends
 * raw samples and this runs on the server, so a tampered app cannot write
 * anything the manual forms would not accept.
 */

export type RawHealth = {
  weights: { at: string; kg: number }[];
  /** Periods actually asleep (not "in bed", not "awake"). */
  sleep: { start: string; end: string }[];
  restingHr: { at: string; bpm: number }[];
  workouts: { id: string; type: string; start: string; durationSec: number; distanceM: number | null }[];
};

export type NormalizedHealth = {
  weights: { date: DateString; kg: number }[];
  sleep: { date: DateString; durationMin: number; bedtime: string; wakeTime: string }[];
  restingHr: { date: DateString; bpm: number }[];
  workouts: { clientId: string; date: DateString; activity: string; durationSec: number; distanceM: number | null; startedAt: Date }[];
};

const HOUR = 60 * 60 * 1000;

function clock(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

function valid(at: string): Date | null {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Keeps the latest reading of each day. */
function latestPerDay<T extends { at: string }>(samples: T[], timeZone: string, today: DateString): Map<DateString, T> {
  const byDay = new Map<DateString, { at: number; sample: T }>();
  for (const sample of samples) {
    const at = valid(sample.at);
    if (!at) continue;
    const date = todayIn(timeZone, at);
    if (date > today) continue;
    const seen = byDay.get(date);
    if (!seen || at.getTime() > seen.at) byDay.set(date, { at: at.getTime(), sample });
  }
  return new Map([...byDay].map(([date, v]) => [date, v.sample]));
}

/**
 * Speed picks the closest Compendium entry for walking, running and cycling;
 * everything else maps to a moderate entry for that kind of activity. Strength
 * sessions are left out: sets are logged in Almanac itself, and a watch's
 * "strength training" entry carries none.
 */
export function activityFor(type: string, durationSec: number, distanceM: number | null): string | null {
  const mph = distanceM && durationSec > 0 ? distanceM / 1609.344 / (durationSec / 3600) : null;
  switch (type) {
    case "walking":
      if (mph === null) return "walk_moderate";
      return mph < 2.6 ? "walk_slow" : mph < 3.5 ? "walk_moderate" : mph < 4 ? "walk_brisk" : "walk_very_brisk";
    case "hiking":
      return "hike";
    case "running":
    case "runningTreadmill":
    case "trackAndField":
      if (mph === null) return "jog";
      return mph < 4.8 ? "jog" : mph < 5.5 ? "run_5mph" : mph < 6.5 ? "run_6mph" : mph < 7.5 ? "run_7mph" : mph < 9 ? "run_8mph" : "run_10mph";
    case "cycling":
    case "bikingStationary":
    case "handCycling":
      if (mph === null) return "cycle_light";
      return mph < 10 ? "cycle_leisure" : mph < 12 ? "cycle_light" : mph < 14 ? "cycle_moderate" : mph < 16 ? "cycle_vigorous" : "cycle_racing";
    case "swimming":
    case "swimmingPool":
    case "swimmingOpenWater":
      return "swim_easy";
    case "waterFitness":
      return "water_aerobics";
    case "paddleSports":
    case "paddling":
      return "kayak";
    case "elliptical":
      return "elliptical";
    case "rowing":
    case "rowingMachine":
      return "row_moderate";
    case "stairClimbing":
    case "stairClimbingMachine":
    case "stairs":
    case "stepTraining":
      return "stairs";
    case "highIntensityIntervalTraining":
    case "crossTraining":
    case "bootCamp":
    case "mixedCardio":
      return "hiit_moderate";
    case "jumpRope":
      return "jump_rope";
    case "yoga":
      return "yoga";
    case "pilates":
    case "barre":
      return "pilates";
    case "flexibility":
    case "stretching":
    case "cooldown":
      return "stretch";
    case "calisthenics":
    case "coreTraining":
      return "calisthenics_moderate";
    default:
      return null;
  }
}

export function normalizeHealth(raw: RawHealth, timeZone: string, today: DateString): NormalizedHealth {
  const weights = [...latestPerDay(raw.weights, timeZone, today)]
    .filter(([, s]) => s.kg >= 25 && s.kg <= 350)
    .map(([date, s]) => ({ date, kg: Math.round(s.kg * 100) / 100 }));

  const restingHr = [...latestPerDay(raw.restingHr, timeZone, today)]
    .filter(([, s]) => s.bpm >= 25 && s.bpm <= 150)
    .map(([date, s]) => ({ date, bpm: Math.round(s.bpm) }));

  // A night belongs to the day it ends on: everything from noon to noon.
  // Sleep ending in the afternoon is treated as a nap and left out.
  const nights = new Map<DateString, { minutes: number; start: Date; end: Date }>();
  for (const segment of raw.sleep) {
    const start = valid(segment.start);
    const end = valid(segment.end);
    if (!start || !end || end <= start || end.getTime() - start.getTime() > 16 * HOUR) continue;
    const endHour = Number(clock(timeZone, end).slice(0, 2));
    if (endHour >= 12 && endHour < 18) continue;
    const date = todayIn(timeZone, new Date(end.getTime() + 12 * HOUR - 1));
    if (date > today) continue;
    const minutes = (end.getTime() - start.getTime()) / 60000;
    const night = nights.get(date);
    if (!night) nights.set(date, { minutes, start, end });
    else {
      night.minutes += minutes;
      if (start < night.start) night.start = start;
      if (end > night.end) night.end = end;
    }
  }
  const sleep = [...nights]
    .filter(([, n]) => n.minutes >= 60 && n.minutes <= 16 * 60)
    .map(([date, n]) => ({
      date,
      durationMin: Math.round(n.minutes),
      bedtime: clock(timeZone, n.start),
      wakeTime: clock(timeZone, n.end),
    }));

  const workouts: NormalizedHealth["workouts"] = [];
  for (const w of raw.workouts) {
    const startedAt = valid(w.start);
    if (!startedAt || w.durationSec < 60 || w.durationSec > 24 * 3600) continue;
    const date = todayIn(timeZone, startedAt);
    if (date > today) continue;
    const distanceM = w.distanceM && w.distanceM > 0 && w.distanceM < 1_000_000 ? Math.round(w.distanceM) : null;
    const activity = activityFor(w.type, w.durationSec, distanceM);
    if (!activity) continue;
    workouts.push({ clientId: w.id.toLowerCase(), date, activity, durationSec: Math.round(w.durationSec), distanceM, startedAt });
  }

  return { weights, sleep, restingHr, workouts };
}
