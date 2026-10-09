import type { Metadata } from "next";
import Link from "next/link";
import { StartWorkout } from "@/components/train/start-workout";
import { VolumeChart } from "@/components/train/volume-chart";
import { buttonClass } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Why } from "@/components/ui/why";
import { requireViewer } from "@/lib/auth/session";
import { getActiveWorkout, getVolume, listCardio, listRecentRecords, listRoutines, listWorkouts } from "@/lib/data/training";
import { fmt, fmtDate, fmtDuration, weightUnit, weightValue } from "@/lib/format";
import { activityTargetMinutesPerWeek } from "@/lib/science/guidelines";
import { addDays } from "@/lib/science/trend";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Train" };

const PR_TEXT = { e1rm: "estimated max", weight: "heaviest weight", reps: "most reps", volume: "biggest set" } as const;

export default async function TrainPage() {
  const viewer = await requireViewer();
  const { userId } = viewer;
  const units = viewer.profile.unitSystem;
  const today = todayIn(viewer.profile.timezone);
  const weekStart = addDays(today, -6);
  const monthStart = addDays(today, -29);

  const [active, routines, volume, sessions, cardio, records] = await Promise.all([
    getActiveWorkout(userId),
    listRoutines(userId),
    getVolume(userId, weekStart, today),
    listWorkouts(userId, monthStart, today),
    listCardio(userId, monthStart, today),
    listRecentRecords(userId, monthStart),
  ]);

  // One set can break several records at once; show it as a single line.
  const grouped = new Map<string, { key: string; exerciseName: string; weightKg: number | null; reps: number | null; achievedOn: string; kinds: string[] }>();
  for (const r of records) {
    const key = `${r.exerciseName}|${r.achievedOn}|${r.weightKg}|${r.reps}`;
    const entry = grouped.get(key) ?? { key, exerciseName: r.exerciseName, weightKg: r.weightKg, reps: r.reps, achievedOn: r.achievedOn, kinds: [] };
    entry.kinds.push(PR_TEXT[r.kind]);
    grouped.set(key, entry);
  }
  const groupedRecords = [...grouped.values()].slice(0, 8);

  const finished = sessions.filter((s) => s.endedAt);
  const cardioWeekMin = cardio.filter((c) => c.date >= weekStart).reduce((n, c) => n + c.durationSec / 60, 0);
  const activityTarget = activityTargetMinutesPerWeek(viewer.isTeen);
  const anyVolume = volume.some((v) => v.sets > 0);

  return (
    <div className="flex flex-col gap-12">
      <Section as="h1" kicker="Training" title="Train">
        {active ? (
          <div className="mb-5 flex items-center justify-between gap-3 border-l-2 border-accent py-1 pl-3">
            <p>
              <span className="font-medium">{active.name}</span> is in progress.
            </p>
            <Link href={`/train/workout/${active.id}`} className={buttonClass("accent")}>
              Resume
            </Link>
          </div>
        ) : (
          <StartWorkout routines={routines} />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/train/routines/new" className={buttonClass("outline")}>
            New routine
          </Link>
          <Link href="/train/cardio" className={buttonClass("outline")}>
            Log cardio or sport
          </Link>
        </div>
      </Section>

      <Section kicker="Last 7 days" title="Hard sets by muscle">
        {anyVolume ? (
          <VolumeChart volume={volume} />
        ) : (
          <p className="leading-relaxed text-ink-soft">
            Once you log a strength session, this shows how many hard sets each muscle group got
            this week against the range where most people grow best.
          </p>
        )}
        <div className="mt-2">
          <Why label="Why 10 to 20 sets?" source="volume" cite="ACSM 2026; Schoenfeld et al. 2017">
            Muscle growth rises with weekly sets and is clearly better at 10 or more per muscle.
            Past about 20 the extra sets add little for most people. Sets count when they are
            within about 4 reps of failure, and a set counts half for muscles it works
            indirectly.{viewer.isTeen ? " If you are new to lifting, learning good technique matters more than hitting a number." : ""}
          </Why>
        </div>
      </Section>

      <Section kicker="Last 7 days" title="Activity">
        <p className="nums">
          <span className="font-display text-4xl">{fmt(cardioWeekMin)}</span>
          <span className="label ml-2">
            min of cardio and sport, of {viewer.isTeen ? "about 420 (60 a day)" : `at least ${activityTarget}`}
          </span>
        </p>
        <div className="mt-1">
          <Why label="Why this much?" source="activity" cite="WHO 2020">
            {viewer.isTeen
              ? "For ages 5 to 17 the WHO recommends an average of 60 minutes a day of moderate-to-vigorous activity, with muscle- and bone-strengthening activity on at least 3 days a week."
              : "For adults the WHO recommends 150 to 300 minutes of moderate activity a week, or 75 to 150 of vigorous, plus muscle strengthening on 2 or more days."}
          </Why>
        </div>
      </Section>

      {records.length > 0 ? (
        <Section kicker="Last 30 days" title="Records">
          <ul>
            {groupedRecords.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                <p className="min-w-0">
                  <span className="font-medium">{r.exerciseName}</span>
                  <span className="block text-sm text-ink-soft first-letter:uppercase">{r.kinds.join(", ")}</span>
                </p>
                <p className="nums shrink-0 text-right text-sm">
                  {r.weightKg != null ? `${fmt(weightValue(r.weightKg, units), 1).replace(/\.0$/, "")} ${weightUnit(units)} × ${r.reps}` : ""}
                  <span className="block text-ink-soft">{fmtDate(r.achievedOn, { month: "short", day: "numeric" })}</span>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section kicker="Last 30 days" title="Sessions">
        {finished.length === 0 && cardio.length === 0 ? (
          <p className="text-ink-soft">Nothing logged yet. Your sessions will be listed here.</p>
        ) : (
          <ul>
            {finished.map((s) => (
              <li key={s.id} className="border-b border-rule">
                <Link href={`/train/workout/${s.id}`} className="flex min-h-14 items-center justify-between gap-3 py-2 hover:bg-paper-raised">
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="nums block text-sm text-ink-soft">
                      {fmtDate(s.date, { weekday: "short", month: "short", day: "numeric" })} · {s.exercises} {s.exercises === 1 ? "exercise" : "exercises"} · {s.sets} sets
                    </span>
                  </span>
                  <span className="nums shrink-0 text-right text-sm text-ink-soft">
                    {s.endedAt ? fmtDuration((s.endedAt.getTime() - s.startedAt.getTime()) / 60000) : ""}
                    {s.kcalEstimate ? <span className="block">~{fmt(s.kcalEstimate)} kcal est.</span> : null}
                  </span>
                </Link>
              </li>
            ))}
            {cardio.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-rule py-2">
                <span>
                  <span className="block font-medium">{c.label}</span>
                  <span className="nums block text-sm text-ink-soft">
                    {fmtDate(c.date, { weekday: "short", month: "short", day: "numeric" })} · {fmtDuration(c.durationSec / 60)}
                    {c.distanceM ? ` · ${fmt(units === "imperial" ? c.distanceM / 1609.344 : c.distanceM / 1000, 1)} ${units === "imperial" ? "mi" : "km"}` : ""}
                    {c.avgHr ? ` · ${c.avgHr} bpm` : ""}
                  </span>
                </span>
                {c.kcalEstimate ? <span className="nums shrink-0 text-sm text-ink-soft">~{fmt(c.kcalEstimate)} kcal est.</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
