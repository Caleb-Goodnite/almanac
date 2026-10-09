"use client";

import { useActionState } from "react";
import { verifyAge, type AgeFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputClass =
  "nums min-h-11 w-full border-b border-rule-strong bg-transparent text-lg outline-none focus:border-ink";

export function DobForm() {
  const [state, action, pending] = useActionState<AgeFormState, FormData>(verifyAge, {});

  return (
    <form action={action} noValidate>
      <h1 className="display text-3xl">When were you born?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Almanac is for people aged 13 and over, and some guidance differs for under-18s. We
        keep the month and year only.
      </p>

      <fieldset className="mt-6" aria-describedby={state.error ? "dob-error" : undefined}>
        <legend className="sr-only">Date of birth</legend>
        <div className="grid grid-cols-[1.6fr_0.8fr_1fr] gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Month</span>
            <select name="month" required autoComplete="bday-month" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Month
              </option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Day</span>
            <input name="day" required inputMode="numeric" autoComplete="bday-day" maxLength={2} placeholder="DD" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Year</span>
            <input name="year" required inputMode="numeric" autoComplete="bday-year" maxLength={4} placeholder="YYYY" className={inputClass} />
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p id="dob-error" role="alert" className="mt-3 text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-8 w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
