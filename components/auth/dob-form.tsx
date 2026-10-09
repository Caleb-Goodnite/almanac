"use client";

import { useActionState, useRef, useState } from "react";
import { verifyAge, type AgeFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputClass =
  "nums min-h-11 w-full border-b border-rule-strong bg-transparent text-lg outline-none focus:border-ink";

/**
 * The date is read back and confirmed before it is sent, for every date alike,
 * because a wrong answer cannot simply be corrected afterwards: an under-13
 * date closes sign-up in this browser for a day (see lib/auth/age-gate.ts).
 */
export function DobForm() {
  const [date, setDate] = useState({ month: "", day: "", year: "" });
  const [confirming, setConfirming] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const [state, action, pending] = useActionState<AgeFormState, FormData>(async (previous, formData) => {
    const result = await verifyAge(previous, formData);
    setConfirming(false);
    return result;
  }, {});

  const error = incomplete ? "Enter the month, day and four-digit year you were born." : state.error;
  const readBack = `${MONTHS[Number(date.month) - 1] ?? ""} ${Number(date.day)}, ${date.year}`;

  function review() {
    const complete = date.month !== "" && /^\d{1,2}$/.test(date.day) && /^\d{4}$/.test(date.year);
    setIncomplete(!complete);
    if (!complete) return;
    setConfirming(true);
    requestAnimationFrame(() => confirmRef.current?.focus());
  }

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        // Enter in a field asks for confirmation first, the same as the button.
        if (!confirming) {
          e.preventDefault();
          review();
        }
      }}
    >
      <h1 className="display text-3xl">When were you born?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Almanac is for people aged 13 and over, and some guidance differs for under-18s. We
        keep the month and year only.
      </p>

      <fieldset className="mt-6" hidden={confirming} aria-describedby={error ? "dob-error" : undefined}>
        <legend className="sr-only">Date of birth</legend>
        <div className="grid grid-cols-[1.6fr_0.8fr_1fr] gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Month</span>
            <select
              name="month"
              required
              autoComplete="bday-month"
              value={date.month}
              onChange={(e) => setDate({ ...date, month: e.target.value })}
              className={inputClass}
            >
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
            <input
              name="day"
              required
              inputMode="numeric"
              autoComplete="bday-day"
              maxLength={2}
              placeholder="DD"
              value={date.day}
              onChange={(e) => setDate({ ...date, day: e.target.value.trim() })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Year</span>
            <input
              name="year"
              required
              inputMode="numeric"
              autoComplete="bday-year"
              maxLength={4}
              placeholder="YYYY"
              value={date.year}
              onChange={(e) => setDate({ ...date, year: e.target.value.trim() })}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      {error && !confirming ? (
        <p id="dob-error" role="alert" className="mt-3 text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-6 border-l-2 border-accent py-1 pl-3">
          <p ref={confirmRef} tabIndex={-1} className="leading-relaxed outline-none">
            You entered <strong className="nums font-semibold">{readBack}</strong>. Is that right?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">Check it carefully. It cannot be changed straight after.</p>
        </div>
      ) : null}

      {confirming ? (
        <div className="mt-8 flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Checking…" : "Yes, that is right"}
          </Button>
          <Button variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => setConfirming(false)}>
            Change it
          </Button>
        </div>
      ) : (
        <Button type="submit" size="lg" className="mt-8 w-full">
          Continue
        </Button>
      )}
    </form>
  );
}
