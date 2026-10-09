import { describe, expect, it } from "vitest";
import { suggestNext } from "./progression";

describe("progressive overload suggestion", () => {
  it("adds load once every set reaches the top of the range", () => {
    const s = suggestNext([{ weightKg: 60, reps: 12 }, { weightKg: 60, reps: 12 }, { weightKg: 60, reps: 12 }])!;
    expect(s.kind).toBe("add_load");
    expect(s.weightKg).toBe(62.5);
    expect(s.reps).toBe(8);
    // Inside the 2-10% window from the ACSM position stand.
    expect((s.weightKg - 60) / 60).toBeGreaterThanOrEqual(0.02);
    expect((s.weightKg - 60) / 60).toBeLessThanOrEqual(0.1);
  });

  it("keeps the load and adds a rep until then", () => {
    const s = suggestNext([{ weightKg: 60, reps: 12 }, { weightKg: 60, reps: 10 }, { weightKg: 60, reps: 9 }])!;
    expect(s).toMatchObject({ kind: "add_reps", weightKg: 60, reps: 10 });
  });

  it("holds the weight when below the range", () => {
    expect(suggestNext([{ weightKg: 100, reps: 5 }, { weightKg: 100, reps: 4 }])).toMatchObject({ kind: "repeat", weightKg: 100, reps: 8 });
  });

  it("respects a routine's own rep range", () => {
    const s = suggestNext([{ weightKg: 100, reps: 6 }, { weightKg: 100, reps: 6 }], { min: 4, max: 6 })!;
    expect(s).toMatchObject({ kind: "add_load", weightKg: 105, reps: 4 });
  });

  it("never jumps more than 10%: light loads add reps or a small plate", () => {
    const light = suggestNext([{ weightKg: 10, reps: 12 }, { weightKg: 10, reps: 12 }])!;
    expect(light.kind).toBe("add_reps");
    const medium = suggestNext([{ weightKg: 20, reps: 12 }, { weightKg: 20, reps: 12 }])!;
    expect(medium).toMatchObject({ kind: "add_load", weightKg: 21.25 });
  });

  it("progresses bodyweight movements by reps", () => {
    expect(suggestNext([{ weightKg: 0, reps: 8 }, { weightKg: 0, reps: 6 }])).toMatchObject({ kind: "add_reps", weightKg: 0, reps: 7 });
  });

  it("ignores warm-ups and judges the heaviest working weight", () => {
    const s = suggestNext([{ weightKg: 40, reps: 10, isWarmup: true }, { weightKg: 80, reps: 9 }, { weightKg: 70, reps: 12 }])!;
    expect(s).toMatchObject({ weightKg: 80, reps: 10 });
  });

  it("says nothing with no history", () => {
    expect(suggestNext([])).toBeNull();
    expect(suggestNext([{ weightKg: 40, reps: 10, isWarmup: true }])).toBeNull();
  });
});
