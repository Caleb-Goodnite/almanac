"use client";

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import type { ActivityLevel, Goal, Sex } from "@/lib/science/types";
import { cmToFeetInches, feetInchesToCm } from "@/lib/science/units";

type Props = {
  isTeen: boolean;
  /** False for an under-18 with no guardian approval: the fat-loss goal is not offered. */
  canLoseFat: boolean;
  initial: {
    sex: Sex;
    heightCm: number | null;
    unitSystem: "metric" | "imperial";
    goal: Goal;
    activityLevel: ActivityLevel;
    resistanceTraining: boolean;
    weeklyRatePct: number;
  };
};

function paceFrom(rate: number): "gentle" | "standard" | "faster" {
  const a = Math.abs(rate);
  if (a >= 0.75) return "faster";
  if (a > 0 && a <= 0.3) return "gentle";
  return "standard";
}

export function ProfileForm({ isTeen, canLoseFat, initial }: Props) {
  const fi = initial.heightCm ? cmToFeetInches(initial.heightCm) : { feet: 0, inches: 0 };
  const [units, setUnits] = useState(initial.unitSystem);
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [cm, setCm] = useState(initial.heightCm ? String(Math.round(initial.heightCm)) : "");
  const [ft, setFt] = useState(initial.heightCm ? String(fi.feet) : "");
  const [inch, setInch] = useState(initial.heightCm ? String(fi.inches) : "");
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [pace, setPace] = useState(paceFrom(initial.weeklyRatePct));
  const [activity, setActivity] = useState<ActivityLevel>(initial.activityLevel);
  const [lifting, setLifting] = useState<"yes" | "no">(initial.resistanceTraining ? "yes" : "no");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const paces =
    goal === "lose_fat"
      ? [
          { value: "gentle" as const, title: "Gentle", description: "About 0.25% of bodyweight a week." },
          { value: "standard" as const, title: "Steady", description: "About 0.5% a week." },
          ...(isTeen ? [] : [{ value: "faster" as const, title: "Faster", description: "About 1% a week, the most we plan." }]),
        ]
      : [
          { value: "standard" as const, title: "Lean", description: "About 0.25% of bodyweight a week." },
          { value: "faster" as const, title: "Faster", description: "About 0.5% a week." },
        ];

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        const heightCm = units === "metric" ? Number(cm) : feetInchesToCm(Number(ft || 0), Number(inch || 0));
        startTransition(async () => {
          const res = await updateProfileAction({
            sex,
            heightCm,
            unitSystem: units,
            goal,
            activityLevel: activity,
            resistanceTraining: lifting === "yes",
            pace: paces.some((p) => p.value === pace) ? pace : "standard",
          });
          setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
        });
      }}
    >
      <ChoiceGroup legend="Units" name="units" inline value={units} onChange={setUnits} options={[{ value: "metric", title: "kg, cm" }, { value: "imperial", title: "lb, ft" }]} />
      <ChoiceGroup
        legend="Sex, for the energy formula"
        name="sex"
        inline
        value={sex}
        onChange={setSex}
        options={[{ value: "female", title: "Female" }, { value: "male", title: "Male" }, { value: "unspecified", title: "Prefer not to say" }]}
      />
      {units === "metric" ? (
        <Field label="Height" unit="cm" inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Height" unit="ft" inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} />
          <Field label="and" unit="in" inputMode="numeric" value={inch} onChange={(e) => setInch(e.target.value)} />
        </div>
      )}
      <ChoiceGroup
        legend="Goal"
        name="goal"
        value={goal}
        onChange={(g) => {
          setGoal(g);
          setPace("standard");
        }}
        options={[
          { value: "improve_fitness", title: "Get fitter" },
          { value: "build_muscle", title: "Build muscle" },
          ...(canLoseFat ? [{ value: "lose_fat" as const, title: "Lose fat" }] : []),
          { value: "maintain", title: "Stay where I am" },
        ]}
      />
      {!canLoseFat ? (
        <p className="-mt-4 text-sm leading-relaxed text-ink-soft">
          A fat-loss goal needs a parent or guardian&apos;s approval.{" "}
          <a href="#guardian" className="underline underline-offset-4">
            Ask them below
          </a>
          .
        </p>
      ) : null}
      {goal === "lose_fat" || goal === "build_muscle" ? (
        <ChoiceGroup legend="Pace" name="pace" value={pace} onChange={setPace} options={paces} />
      ) : null}
      <ChoiceGroup
        legend="Activity level"
        name="activity"
        value={activity}
        onChange={setActivity}
        options={[
          { value: "sedentary", title: "Mostly sitting" },
          { value: "light", title: "Lightly active" },
          { value: "moderate", title: "Active" },
          { value: "very", title: "Very active" },
          { value: "extra", title: "Extremely active" },
        ]}
      />
      <ChoiceGroup legend="Strength training" name="lifting" inline value={lifting} onChange={setLifting} options={[{ value: "yes", title: "Yes" }, { value: "no", title: "No" }]} />

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save and update targets"}
        </Button>
        <p role="status" className={`mt-3 text-sm leading-relaxed ${result && !result.ok ? "font-medium text-accent-strong" : "text-ink-soft"}`}>
          {result ? (result.ok ? result.text : `! ${result.text}`) : ""}
        </p>
      </div>
    </form>
  );
}
