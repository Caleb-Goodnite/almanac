import { describe, expect, it } from "vitest";
import { activityByKey } from "@/lib/science/met";
import { activityFor, normalizeHealth, type RawHealth } from "./normalize";

const TZ = "America/Chicago";
const empty: RawHealth = { weights: [], sleep: [], restingHr: [], workouts: [] };

describe("health import", () => {
  it("keeps the latest weight of each day, in the user's time zone, and drops implausible ones", () => {
    const out = normalizeHealth(
      {
        ...empty,
        weights: [
          { at: "2026-10-05T12:00:00Z", kg: 80.4 },
          { at: "2026-10-05T23:00:00Z", kg: 80.123 }, // 6 pm in Chicago, same day
          { at: "2026-10-06T03:00:00Z", kg: 79.9 }, // 10 pm on the 5th in Chicago: the latest that day
          { at: "2026-10-07T12:00:00Z", kg: 900 },
          { at: "not a date", kg: 80 },
        ],
      },
      TZ,
      "2026-10-09",
    );
    expect(out.weights).toEqual([{ date: "2026-10-05", kg: 79.9 }]);
  });

  it("adds up a night's sleep stages and files it under the day it ended", () => {
    const out = normalizeHealth(
      {
        ...empty,
        sleep: [
          { start: "2026-10-06T04:00:00Z", end: "2026-10-06T07:00:00Z" }, // 11 pm to 2 am
          { start: "2026-10-06T07:30:00Z", end: "2026-10-06T12:00:00Z" }, // 2:30 am to 7 am
        ],
      },
      TZ,
      "2026-10-09",
    );
    expect(out.sleep).toEqual([{ date: "2026-10-06", durationMin: 450, bedtime: "23:00", wakeTime: "07:00" }]);
  });

  it("counts sleep that ends before midnight toward the next morning, and ignores naps and fragments", () => {
    const out = normalizeHealth(
      {
        ...empty,
        sleep: [
          { start: "2026-10-06T03:00:00Z", end: "2026-10-06T04:30:00Z" }, // 10 pm to 11:30 pm on the 5th
          { start: "2026-10-06T19:00:00Z", end: "2026-10-06T20:00:00Z" }, // a 2 pm nap
          { start: "2026-10-08T08:00:00Z", end: "2026-10-08T08:20:00Z" }, // 20 minutes: not a night
          { start: "2026-10-09T08:00:00Z", end: "2026-10-09T07:00:00Z" }, // ends before it starts
        ],
      },
      TZ,
      "2026-10-09",
    );
    expect(out.sleep).toEqual([{ date: "2026-10-06", durationMin: 90, bedtime: "22:00", wakeTime: "23:30" }]);
  });

  it("keeps resting heart rate within a plausible range", () => {
    const out = normalizeHealth(
      { ...empty, restingHr: [{ at: "2026-10-05T12:00:00Z", bpm: 57.6 }, { at: "2026-10-06T12:00:00Z", bpm: 400 }] },
      TZ,
      "2026-10-09",
    );
    expect(out.restingHr).toEqual([{ date: "2026-10-05", bpm: 58 }]);
  });

  it("maps workouts to Compendium activities by speed, and leaves out strength and unknown types", () => {
    expect(activityFor("running", 1800, 5000)).toBe("run_6mph"); // 5 km in 30 min is 6.2 mph
    expect(activityFor("running", 1800, null)).toBe("jog");
    expect(activityFor("walking", 3600, 5000)).toBe("walk_moderate");
    expect(activityFor("cycling", 3600, 25000)).toBe("cycle_vigorous");
    expect(activityFor("traditionalStrengthTraining", 3600, null)).toBeNull();
    expect(activityFor("fishing", 3600, null)).toBeNull();

    const out = normalizeHealth(
      {
        ...empty,
        workouts: [
          { id: "0F9E0C6E-1B5A-4C0E-9F65-0E1D2C3B4A59", type: "running", start: "2026-10-05T12:00:00Z", durationSec: 1800.4, distanceM: 5000.2 },
          { id: "1F9E0C6E-1B5A-4C0E-9F65-0E1D2C3B4A59", type: "running", start: "2026-10-05T12:00:00Z", durationSec: 20, distanceM: null },
          { id: "2F9E0C6E-1B5A-4C0E-9F65-0E1D2C3B4A59", type: "running", start: "2027-01-01T12:00:00Z", durationSec: 1800, distanceM: null },
        ],
      },
      TZ,
      "2026-10-09",
    );
    expect(out.workouts).toHaveLength(1);
    expect(out.workouts[0]).toMatchObject({ clientId: "0f9e0c6e-1b5a-4c0e-9f65-0e1d2c3b4a59", date: "2026-10-05", activity: "run_6mph", durationSec: 1800, distanceM: 5000 });
  });

  it("only ever names activities that exist in the Compendium table", () => {
    const types = ["walking", "hiking", "running", "cycling", "swimming", "waterFitness", "paddling", "elliptical", "rowing", "stairs", "highIntensityIntervalTraining", "jumpRope", "yoga", "pilates", "stretching", "coreTraining"];
    for (const type of types) {
      for (const distance of [null, 1000, 8000, 30000]) {
        const key = activityFor(type, 3600, distance);
        expect(key && activityByKey(key), `${type} ${distance}`).toBeTruthy();
      }
    }
  });
});
