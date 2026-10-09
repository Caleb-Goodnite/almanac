"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logWeightAction } from "@/app/(app)/body/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { UnitSystem } from "@/lib/format";
import { kgToLb, lbToKg } from "@/lib/science/units";

export function WeightForm({ date, units, todayKg, label = "Today’s weight" }: { date: string; units: UnitSystem; todayKg: number | null; label?: string }) {
  const router = useRouter();
  const show = (kg: number) => String(Math.round((units === "imperial" ? kgToLb(kg) : kg) * 10) / 10);
  const [value, setValue] = useState(todayKg != null ? show(todayKg) : "");
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return setState({ error: "Enter your weight." });
        startTransition(async () => {
          const res = await logWeightAction({ date, kg: units === "imperial" ? lbToKg(n) : n, bodyFatPct: "" });
          setState(res.ok ? { saved: true } : { error: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <Field
        className="flex-1"
        label={todayKg != null ? `${label} (logged)` : label}
        unit={units === "imperial" ? "lb" : "kg"}
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState({});
        }}
        error={state.error}
      />
      <Button type="submit" disabled={pending} variant={state.saved ? "outline" : "primary"}>
        {pending ? "Saving…" : state.saved ? "Saved" : todayKg != null ? "Update" : "Log"}
      </Button>
      <span role="status" className="sr-only">
        {state.saved ? "Weight saved." : ""}
      </span>
    </form>
  );
}
