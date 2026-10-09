"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logMeasurementAction } from "@/app/(app)/body/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { UnitSystem } from "@/lib/format";
import { inToCm } from "@/lib/science/units";

const SITES = [
  ["waist", "Waist"],
  ["hips", "Hips"],
  ["chest", "Chest"],
  ["arm", "Upper arm"],
  ["thigh", "Thigh"],
  ["calf", "Calf"],
  ["neck", "Neck"],
] as const;

export function MeasurementForm({ date, units }: { date: string; units: UnitSystem }) {
  const router = useRouter();
  const [site, setSite] = useState<(typeof SITES)[number][0]>("waist");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return setError("Enter a measurement.");
        startTransition(async () => {
          const res = await logMeasurementAction({ date, site, cm: units === "imperial" ? inToCm(n) : n });
          if (res.ok) {
            setValue("");
            setError(undefined);
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="label">Where</span>
        <select value={site} onChange={(e) => setSite(e.target.value as typeof site)} className="min-h-12 border-b border-rule-strong bg-transparent outline-none focus:border-ink">
          {SITES.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Field className="flex-1" label="Measurement" unit={units === "imperial" ? "in" : "cm"} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} error={error} />
      <Button type="submit" variant="outline" disabled={pending}>
        Add
      </Button>
    </form>
  );
}

export const SITE_LABELS: Record<string, string> = Object.fromEntries(SITES);
