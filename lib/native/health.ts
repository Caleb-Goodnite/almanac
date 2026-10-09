import type { HealthDataType } from "@capgo/capacitor-health";
import type { RawHealth } from "@/lib/health-import/normalize";
import { isNativeApp } from "./platform";

const TYPES: HealthDataType[] = ["weight", "sleep", "restingHeartRate", "workouts"];
const ASLEEP = new Set(["asleep", "rem", "deep", "light"]);

export type HealthRead = { ok: true; data: RawHealth } | { ok: false; reason: "unavailable" | "denied" | "failed" };

/** Whether this device has Apple Health or Health Connect to read from. */
export async function healthAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { Health } = await import("@capgo/capacitor-health");
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

/**
 * Asks for read-only access and reads the last `days` days. Nothing is ever
 * written to the phone's health store. The samples are sent to the server
 * as they are; lib/health-import turns them into daily rows.
 */
export async function readHealth(days: number): Promise<HealthRead> {
  if (!isNativeApp()) return { ok: false, reason: "unavailable" };
  try {
    const { Health } = await import("@capgo/capacitor-health");
    if (!(await Health.isAvailable()).available) return { ok: false, reason: "unavailable" };
    const status = await Health.requestAuthorization({ read: TYPES });
    // iOS never says whether reading was allowed, so only a platform that
    // reports every type as denied is treated as a refusal.
    if (status.readAuthorized.length === 0 && status.readDenied.length === TYPES.length) return { ok: false, reason: "denied" };

    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const range = { startDate, endDate, limit: 2000, ascending: true };
    const [weight, sleep, resting, workouts] = await Promise.all([
      Health.readSamples({ dataType: "weight", ...range }).catch(() => ({ samples: [] })),
      Health.readSamples({ dataType: "sleep", ...range }).catch(() => ({ samples: [] })),
      Health.readSamples({ dataType: "restingHeartRate", ...range }).catch(() => ({ samples: [] })),
      Health.queryWorkouts({ ...range, limit: 400 }).catch(() => ({ workouts: [] })),
    ]);

    const sleepSegments: RawHealth["sleep"] = [];
    for (const s of sleep.samples) {
      if (s.stages?.length) {
        for (const stage of s.stages) if (ASLEEP.has(stage.stage)) sleepSegments.push({ start: stage.startDate, end: stage.endDate });
      } else if (!s.sleepState || ASLEEP.has(s.sleepState)) {
        sleepSegments.push({ start: s.startDate, end: s.endDate });
      }
    }

    return {
      ok: true,
      data: {
        weights: weight.samples.slice(-400).map((s) => ({ at: s.startDate, kg: s.value })),
        sleep: sleepSegments.slice(-3000),
        restingHr: resting.samples.slice(-400).map((s) => ({ at: s.startDate, bpm: s.value })),
        workouts: workouts.workouts
          .filter((w) => /^[0-9a-f-]{36}$/i.test(w.platformId ?? ""))
          .map((w) => ({
            id: w.platformId as string,
            type: w.workoutType,
            start: w.startDate,
            durationSec: w.duration,
            distanceM: w.totalDistance ?? null,
          })),
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
