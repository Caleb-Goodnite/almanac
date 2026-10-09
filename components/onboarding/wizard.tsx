"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { finishOnboarding } from "@/app/welcome/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { CountUp } from "@/components/ui/count-up";
import { DISCLAIMER } from "@/components/ui/disclaimer";
import { Field } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { Why } from "@/components/ui/why";
import type { Targets } from "@/lib/science/targets";
import type { ActivityLevel, Goal, Sex } from "@/lib/science/types";
import { feetInchesToCm, lbToKg } from "@/lib/science/units";

type Units = "metric" | "imperial";

type Draft = {
  units: Units;
  sex: Sex | null;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  bodyFat: string;
  goal: Goal | null;
  pace: "gentle" | "standard" | "faster";
  activity: ActivityLevel | null;
  lifting: "yes" | "no" | null;
  days: string;
  accepted: boolean;
};

const initial: Draft = {
  units: "metric",
  sex: null,
  heightCm: "",
  heightFt: "",
  heightIn: "",
  weight: "",
  bodyFat: "",
  goal: null,
  pace: "standard",
  activity: null,
  lifting: null,
  days: "3",
  accepted: false,
};

const STEPS = ["You", "Goal", "Activity", "Confirm"] as const;

function ratePct(goal: Goal | null, pace: Draft["pace"], isTeen: boolean): number | null {
  if (goal === "lose_fat") {
    if (isTeen) return pace === "gentle" ? -0.25 : -0.5;
    return pace === "gentle" ? -0.25 : pace === "faster" ? -1 : -0.5;
  }
  if (goal === "build_muscle") return pace === "faster" ? 0.5 : 0.25;
  return null;
}

export function Wizard({ firstName, isTeen }: { firstName: string; isTeen: boolean }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Targets | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land at the top of what changed.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, result]);

  const heightCm =
    d.units === "metric"
      ? Number(d.heightCm)
      : feetInchesToCm(Number(d.heightFt || 0), Number(d.heightIn || 0));
  const weightKg = d.units === "metric" ? Number(d.weight) : lbToKg(Number(d.weight));

  function validate(current: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (current === 0) {
      if (!d.sex) e.sex = "Choose one. It only affects the energy formula.";
      if (!(heightCm >= 100 && heightCm <= 250)) e.height = "Enter your height.";
      if (!(weightKg >= 25 && weightKg <= 350)) e.weight = "Enter your weight.";
      if (d.bodyFat && !(Number(d.bodyFat) >= 3 && Number(d.bodyFat) <= 60)) e.bodyFat = "Enter a value between 3 and 60, or leave it blank.";
    }
    if (current === 1 && !d.goal) e.goal = "Choose a goal. You can change it later.";
    if (current === 2) {
      if (!d.activity) e.activity = "Choose the closest match.";
      if (!d.lifting) e.lifting = "Choose yes or no.";
    }
    if (current === 3 && !d.accepted) e.acceptedDisclaimer = "Please confirm you have read this.";
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      const res = await finishOnboarding({
        sex: d.sex,
        heightCm,
        weightKg,
        bodyFatPct: d.bodyFat === "" ? "" : Number(d.bodyFat),
        unitSystem: d.units,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goal: d.goal,
        activityLevel: d.activity,
        resistanceTraining: d.lifting === "yes",
        trainingDaysPerWeek: Number(d.days),
        weeklyRatePct: ratePct(d.goal, d.pace, isTeen),
        acceptedDisclaimer: d.accepted,
      });
      if (res.ok) setResult(res.targets);
      else setErrors({ form: "Some answers need another look.", ...res.errors });
    });
  }

  if (result) return <Summary targets={result} headingRef={headingRef} isTeen={isTeen} />;

  const paceOptions =
    d.goal === "lose_fat"
      ? isTeen
        ? ([
            { value: "gentle", title: "Gentle", description: "About 0.25% of bodyweight a week." },
            { value: "standard", title: "Steady", description: "Up to 0.5% a week. The most we plan for under-18s." },
          ] as const)
        : ([
            { value: "gentle", title: "Gentle", description: "About 0.25% of bodyweight a week. Easiest to keep up." },
            { value: "standard", title: "Steady", description: "About 0.5% a week. A good default." },
            { value: "faster", title: "Faster", description: "About 1% a week. The most we plan; harder on training and mood." },
          ] as const)
      : ([
          { value: "standard", title: "Lean", description: "About 0.25% of bodyweight a week." },
          { value: "faster", title: "Faster", description: "About 0.5% a week. More of it will be fat." },
        ] as const);

  return (
    <div>
      <p className="label" aria-live="polite">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-0.5 flex-1 ${i <= step ? "bg-ink" : "bg-rule"}`} />
        ))}
      </div>

      {/* A CSS animation, not a JS one: the step is in the DOM and usable at
          once, and the fade can never leave it invisible if scripts stall. */}
      <div key={step} className="step-in mt-8">
          {step === 0 ? (
            <div className="flex flex-col gap-7">
              <h1 ref={headingRef} tabIndex={-1} className="display text-4xl outline-none">
                {firstName ? `Hello, ${firstName}.` : "Hello."} A few basics first.
              </h1>
              <ChoiceGroup
                legend="Units"
                name="units"
                inline
                value={d.units}
                onChange={(v) => set("units", v)}
                options={[
                  { value: "metric", title: "kg, cm" },
                  { value: "imperial", title: "lb, ft" },
                ]}
              />
              <div>
                <ChoiceGroup
                  legend="Sex, for the energy formula"
                  name="sex"
                  inline
                  value={d.sex}
                  onChange={(v) => set("sex", v)}
                  options={[
                    { value: "female", title: "Female" },
                    { value: "male", title: "Male" },
                    { value: "unspecified", title: "Prefer not to say" },
                  ]}
                />
                {errors.sex ? <ErrorText>{errors.sex}</ErrorText> : null}
              </div>
              {d.units === "metric" ? (
                <Field label="Height" unit="cm" inputMode="decimal" value={d.heightCm} onChange={(e) => set("heightCm", e.target.value)} error={errors.height} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Height" unit="ft" inputMode="numeric" value={d.heightFt} onChange={(e) => set("heightFt", e.target.value)} error={errors.height} />
                  <Field label="and" unit="in" inputMode="numeric" value={d.heightIn} onChange={(e) => set("heightIn", e.target.value)} />
                </div>
              )}
              <Field
                label="Weight"
                unit={d.units === "metric" ? "kg" : "lb"}
                inputMode="decimal"
                value={d.weight}
                onChange={(e) => set("weight", e.target.value)}
                error={errors.weight}
              />
              {!isTeen ? (
                <Field
                  label="Body fat (optional)"
                  unit="%"
                  inputMode="decimal"
                  value={d.bodyFat}
                  onChange={(e) => set("bodyFat", e.target.value)}
                  error={errors.bodyFat}
                  hint="Skip this unless you have a measured figure."
                />
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-7">
              <h1 ref={headingRef} tabIndex={-1} className="display text-4xl outline-none">
                What are you working toward?
              </h1>
              <div>
                <ChoiceGroup
                  legend="Goal"
                  hideLegend
                  name="goal"
                  value={d.goal}
                  onChange={(v) => {
                    set("goal", v);
                    set("pace", "standard");
                  }}
                  options={[
                    { value: "improve_fitness", title: "Get fitter", description: "More energy, better endurance. No change to how much you eat." },
                    { value: "build_muscle", title: "Build muscle", description: "A small calorie surplus and enough protein." },
                    { value: "lose_fat", title: "Lose fat", description: isTeen ? "Gently, while eating enough to grow and train." : "A moderate deficit that protects muscle." },
                    { value: "maintain", title: "Stay where I am", description: "Keep weight steady and build good habits." },
                  ]}
                />
                {errors.goal ? <ErrorText>{errors.goal}</ErrorText> : null}
              </div>
              {d.goal === "lose_fat" || d.goal === "build_muscle" ? (
                <div>
                  <ChoiceGroup legend="Pace" name="pace" value={d.pace} onChange={(v) => set("pace", v)} options={paceOptions} />
                  <div className="mt-2">
                    <Why label="Why these paces?" source="rate" cite="Helms et al. 2014">
                      Losing more than about 1% of bodyweight a week costs more muscle and is harder
                      to sustain, so that is the fastest pace on offer.
                    </Why>
                  </div>
                </div>
              ) : null}
              {isTeen && d.goal === "lose_fat" ? (
                <p className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
                  Your body is still growing, so we keep this slow and never set calories below
                  what you need. It is a good idea to tell a parent or your doctor what you are
                  aiming for.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-7">
              <h1 ref={headingRef} tabIndex={-1} className="display text-4xl outline-none">
                How active is a normal week?
              </h1>
              <div>
                <ChoiceGroup
                  legend="Activity level"
                  hideLegend
                  name="activity"
                  value={d.activity}
                  onChange={(v) => set("activity", v)}
                  options={[
                    { value: "sedentary", title: "Mostly sitting", description: "Desk or school all day, little exercise." },
                    { value: "light", title: "Lightly active", description: "Some walking, exercise 1 to 3 days a week." },
                    { value: "moderate", title: "Active", description: "Exercise 3 to 5 days a week." },
                    { value: "very", title: "Very active", description: "Hard exercise 6 or 7 days a week." },
                    { value: "extra", title: "Extremely active", description: "A physical job plus training, or twice-a-day sessions." },
                  ]}
                />
                {errors.activity ? <ErrorText>{errors.activity}</ErrorText> : null}
                <div className="mt-2">
                  <p className="text-sm text-ink-soft">Between two? Pick the lower one. Most people overestimate how active they are.</p>
                  <Why label="How is this used?" source="energy">
                    This is only a starting estimate. After two weeks of logging, Almanac works
                    out what you actually burn from your own food and weight data.
                  </Why>
                </div>
              </div>
              <div>
                <ChoiceGroup
                  legend="Do you lift weights or do other strength training?"
                  name="lifting"
                  inline
                  value={d.lifting}
                  onChange={(v) => set("lifting", v)}
                  options={[
                    { value: "yes", title: "Yes, or I plan to" },
                    { value: "no", title: "No" },
                  ]}
                />
                {errors.lifting ? <ErrorText>{errors.lifting}</ErrorText> : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6">
              <h1 ref={headingRef} tabIndex={-1} className="display text-4xl outline-none">
                One thing before your plan.
              </h1>
              <p className="leading-relaxed text-ink-soft">{DISCLAIMER}</p>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 border-y border-rule py-4">
                <input
                  type="checkbox"
                  checked={d.accepted}
                  onChange={(e) => set("accepted", e.target.checked)}
                  className="mt-1 size-5 accent-[var(--accent-strong)]"
                  aria-describedby={errors.acceptedDisclaimer ? "disclaimer-error" : undefined}
                />
                <span className="font-medium">I understand that Almanac is not medical advice.</span>
              </label>
              {errors.acceptedDisclaimer ? <ErrorText id="disclaimer-error">{errors.acceptedDisclaimer}</ErrorText> : null}
              {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
            </div>
          ) : null}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="quiet" onClick={() => { setErrors({}); setStep(step - 1); }} disabled={pending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button size="lg" onClick={next} disabled={pending}>
          {pending ? "Working it out…" : step === 3 ? "Show my plan" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function ErrorText({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-accent-strong">
      <span aria-hidden>! </span>
      {children}
    </p>
  );
}

function Summary({
  targets,
  headingRef,
  isTeen,
}: {
  targets: Targets;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  isTeen: boolean;
}) {
  const hours = (m: number) => m / 60;
  return (
    <div>
      <p className="label">Your starting plan</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 outline-none">
        <span className="figure block">
          <CountUp value={targets.calories} />
        </span>
        <span className="label mt-2 block">kilocalories a day</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        This is a starting estimate from a formula, and formulas can be off by a few hundred
        calories for any one person. After two weeks of logging food and weight, Almanac
        replaces it with a figure worked out from your own data.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        <Meter label="Protein" value={targets.proteinG} target={targets.proteinG} unit="g" pattern="solid" />
        <Meter label="Carbohydrate" value={targets.carbsG} target={targets.carbsG} unit="g" pattern="hatch" />
        <Meter label="Fat" value={targets.fatG} target={targets.fatG} unit="g" pattern="dots" />
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-rule py-5">
        <div>
          <dt className="label">Sleep</dt>
          <dd className="nums mt-1 font-display text-2xl">
            {hours(targets.sleepMinMinutes)}-{hours(targets.sleepMaxMinutes)} h
          </dd>
        </div>
        <div>
          <dt className="label">Activity</dt>
          <dd className="nums mt-1 font-display text-2xl">
            {isTeen ? "60 min/day" : `${targets.activityMinutesPerWeek} min/wk`}
          </dd>
        </div>
        <div>
          <dt className="label">Water</dt>
          <dd className="nums mt-1 font-display text-2xl">{(targets.waterMl / 1000).toFixed(1)} L</dd>
        </div>
      </dl>

      {targets.guardrails.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {targets.guardrails.map((g) => (
            <li key={g.code} className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed">
              {g.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-col">
        <Why label="Why this many calories?" source="energy" cite={targets.bmrEquation === "schofield" ? "Schofield 1985" : "Mifflin et al. 1990"}>
          We estimate that you burn about {targets.tdeeKcal.toLocaleString("en-US")} kcal a day:{" "}
          {targets.bmrKcal.toLocaleString("en-US")} at rest, scaled for your activity. This is a
          starting point that improves once you have logged for two weeks.
        </Why>
        <Why label="Why this much protein?" source="protein" cite={isTeen ? "ISSN 2017" : "Morton et al. 2018"}>
          {targets.proteinG} g of protein is {targets.proteinGPerKg} g per kg of bodyweight.{" "}
          {isTeen
            ? "That is plenty for a growing, active body without crowding out other foods."
            : "For people who lift, muscle gain stops improving above about 1.6 g per kg; in a deficit a little more helps hold on to muscle."}
        </Why>
        <Why label="Why this much sleep?" source="sleep" cite={isTeen ? "AASM 2016" : "AASM 2015"}>
          {isTeen
            ? "Teenagers need 8 to 10 hours of sleep a night for health, mood and learning."
            : "Adults need at least 7 hours a night; regularly sleeping less is linked with poorer health and recovery."}
        </Why>
      </div>

      <ButtonLink href="/today" size="lg" className="mt-8 w-full">
        Start logging
      </ButtonLink>
    </div>
  );
}
