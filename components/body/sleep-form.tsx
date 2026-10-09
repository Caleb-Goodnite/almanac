"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logSleepAction } from "@/app/(app)/body/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Scale } from "@/components/ui/scale";

type Props = { date: string; label?: string; initial: { durationMin: number; quality: number | null } | null };

export function SleepForm({ date, initial, label = "Last night" }: Props) {
  const router = useRouter();
  const [hours, setHours] = useState(initial ? String(Math.floor(initial.durationMin / 60)) : "");
  const [minutes, setMinutes] = useState(initial ? String(initial.durationMin % 60) : "");
  const [quality, setQuality] = useState<number | null>(initial?.quality ?? null);
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const total = Number(hours || 0) * 60 + Number(minutes || 0);
        if (!Number.isFinite(total) || total < 30) return setState({ error: "Enter how long you slept." });
        startTransition(async () => {
          const res = await logSleepAction({ date, durationMin: total, quality: quality ?? "", bedtime: "", wakeTime: "" });
          setState(res.ok ? { saved: true } : { error: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label={label} unit="h" inputMode="numeric" value={hours} onChange={(e) => { setHours(e.target.value); setState({}); }} error={state.error} />
        <Field label="and" unit="min" inputMode="numeric" value={minutes} onChange={(e) => { setMinutes(e.target.value); setState({}); }} />
      </div>
      <Scale legend="How well did you sleep? (optional)" name="sleep-quality" value={quality} onChange={setQuality} low="Badly" high="Very well" />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant={state.saved ? "outline" : "primary"}>
          {pending ? "Saving…" : state.saved ? "Saved" : initial ? "Update sleep" : "Log sleep"}
        </Button>
        <span role="status" className="sr-only">
          {state.saved ? "Sleep saved." : ""}
        </span>
      </div>
    </form>
  );
}
