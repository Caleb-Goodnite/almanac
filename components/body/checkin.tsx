"use client";

import { Check } from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";
import { saveCheckinAction } from "@/app/(app)/body/actions";
import { Scale } from "@/components/ui/scale";

type Values = { mood: number | null; energy: number | null; soreness: number | null; restingHr: string };

/**
 * The ten-second check-in: three taps, saved as you go. There is no submit
 * button to find and nothing is required.
 */
export function CheckIn({ date, initial }: { date: string; initial: { mood: number | null; energy: number | null; soreness: number | null; restingHr: number | null } | null }) {
  const [values, setValues] = useState<Values>({
    mood: initial?.mood ?? null,
    energy: initial?.energy ?? null,
    soreness: initial?.soreness ?? null,
    restingHr: initial?.restingHr != null ? String(initial.restingHr) : "",
  });
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const latest = useRef(values);

  function save(next: Values) {
    latest.current = next;
    setValues(next);
    startTransition(async () => {
      const res = await saveCheckinAction({
        date,
        mood: next.mood ?? "",
        energy: next.energy ?? "",
        soreness: next.soreness ?? "",
        restingHr: next.restingHr,
        note: "",
      });
      // Ignore the result of a save that a newer tap has already replaced.
      if (latest.current === next) setStatus(res.ok ? "saved" : "error");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Scale legend="Mood" name="mood" value={values.mood} onChange={(mood) => save({ ...values, mood })} low="Low" high="Great" />
      <Scale legend="Energy" name="energy" value={values.energy} onChange={(energy) => save({ ...values, energy })} low="Drained" high="Full of energy" />
      <Scale legend="Muscle soreness" name="soreness" value={values.soreness} onChange={(soreness) => save({ ...values, soreness })} low="None" high="Very sore" />
      <label className="flex flex-col gap-1.5">
        <span className="label">Resting heart rate (optional)</span>
        <span className="flex items-baseline gap-2 border-b border-rule-strong focus-within:border-ink">
          <input
            inputMode="numeric"
            value={values.restingHr}
            onChange={(e) => setValues({ ...values, restingHr: e.target.value })}
            onBlur={() => {
              if (values.restingHr !== (initial?.restingHr != null ? String(initial.restingHr) : "")) save(values);
            }}
            className="nums min-h-11 w-full bg-transparent text-lg outline-none"
          />
          <span aria-hidden className="label">
            bpm
          </span>
        </span>
      </label>
      <p role="status" className="label flex min-h-5 items-center gap-1.5">
        {status === "saved" ? (
          <>
            <Check aria-hidden size={14} weight="bold" className="stamp text-good" />
            Saved
          </>
        ) : status === "error" ? (
          <span className="text-accent-strong">! Could not save. Tap again.</span>
        ) : null}
      </p>
    </div>
  );
}
