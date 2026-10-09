"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { approveAction } from "@/app/guardian/actions";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { CONSENT_PHRASE, HOLD_MS, phraseMatches, type Relationship } from "@/lib/safety/guardian";
import { HoldButton } from "./hold-button";

type Props = {
  token: string;
  /** Signed by the server when the page was rendered; proves how long it has been open. */
  stamp: string;
  firstName: string;
  limits: { maxLossPct: number; maxDeficitPct: number };
  helplines: { name: string; contact: string }[];
};

const STEPS = ["Read", "Confirm", "About you", "Type", "Slide", "Hold", "Approve"] as const;

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 border-b border-rule py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-accent-strong)]"
      />
      <span className="leading-snug">{children}</span>
    </label>
  );
}

/**
 * The guardian's approval, in seven deliberate steps. The friction is the
 * point: nobody should be able to wave this through with one tap. Every step
 * is checked again on the server (app/guardian/actions.ts).
 */
export function Approval({ token, stamp, firstName, limits, helplines }: Props) {
  const [step, setStep] = useState(0);
  const [isGuardian, setIsGuardian] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [willSupervise, setWillSupervise] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [phrase, setPhrase] = useState("");
  const [slider, setSlider] = useState(0);
  const [heldMs, setHeldMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sliderId = useId();
  const first = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (first.current) first.current = false;
    else headingRef.current?.focus();
  }, [step, done]);

  const ready = [
    true,
    isGuardian && hasRead && willSupervise,
    name.trim().length >= 2 && relationship !== null,
    phraseMatches(phrase),
    slider === 100,
    heldMs >= HOLD_MS,
    true,
  ][step];

  function submit() {
    dialogRef.current?.close();
    setError(null);
    startTransition(async () => {
      const res = await approveAction({ token, stamp, name, relationship, isGuardian, hasRead, willSupervise, phrase, slider, heldMs });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="step-in">
        <h1 ref={headingRef} tabIndex={-1} className="display text-4xl outline-none">
          Approved
        </h1>
        <p className="mt-4 max-w-prose leading-relaxed">
          {firstName} can now follow a gentle fat-loss plan in Almanac, inside the limits you read about.
        </p>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
          We have emailed you a confirmation. Keep it: it holds the link for withdrawing your approval, which you can do at any time.
        </p>
      </div>
    );
  }

  const heading = "display text-4xl outline-none";

  return (
    <div>
      <p className="label" aria-live="polite">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <div
        className="mt-2 h-1 bg-rule"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
      >
        <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div key={step} className="step-in mt-8 flex flex-col gap-6">
        {step === 0 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              {firstName} is asking for your approval
            </h1>
            <p className="max-w-prose leading-relaxed">
              {firstName} is under 18 and wants to set a fat-loss goal in Almanac, a food and fitness tracker. That goal is
              locked for under-18s unless a parent or legal guardian approves it. Please read all of this first.
            </p>

            <section className="border-l-2 border-accent py-1 pl-4">
              <h2 className="font-display text-xl">The risks</h2>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
                <li>
                  Dieting in the teenage years is a known risk factor for eating disorders. The American Academy of
                  Pediatrics advises families to focus on healthy habits rather than weight.
                </li>
                <li>Teenagers are still growing. Eating too little can affect growth, bone health, periods, mood, sleep and school.</li>
                <li>Counting calories and weighing in can become a preoccupation, even for a teen who starts out with a sensible aim.</li>
                <li>Most teenagers do not need to lose weight, and many who want to are at a healthy weight already.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl">What Almanac is not</h2>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 leading-relaxed text-ink-soft">
                <li>It is not medical advice, and it is not a doctor, dietitian or therapist.</li>
                <li>It cannot tell whether losing weight is right for {firstName}. Only someone who has examined them can.</li>
                <li>It cannot check that you are who you say you are. This approval rests on your honesty.</li>
                <li>Its limits for teenagers were set cautiously by its developers, not by a clinician.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl">What Almanac will do if you approve</h2>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 leading-relaxed text-ink-soft">
                <li>Plan loss no faster than {limits.maxLossPct}% of bodyweight a week, and usually half that.</li>
                <li>
                  Never set calories more than {limits.maxDeficitPct}% below what {firstName} burns in a day, and never below
                  what their body needs at rest.
                </li>
                <li>Plan no loss at all if their weight is low for their age and height.</li>
                <li>Keep the AI coach from giving {firstName} calorie or weight figures.</li>
                <li>Stop showing loss targets and show support resources if a message suggests distress about food or body image.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl">What to watch for</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">
                Skipped meals, secrecy or anxiety around food, cutting out whole food groups, fast weight loss, exercise
                that looks driven or compulsive, or a mood that follows the scale. If you see these, withdraw your approval
                and talk to their doctor. These US helplines are free and confidential:
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {helplines.map((h) => (
                  <li key={h.name}>
                    {h.name}: <span className="nums font-medium">{h.contact}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="leading-relaxed">
              Nothing changes unless you finish every step. To refuse, simply close this page.
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Confirm three things
            </h1>
            <div className="border-t border-rule">
              <Check checked={isGuardian} onChange={setIsGuardian}>
                I am {firstName}&apos;s parent or legal guardian, and I am 18 or older.
              </Check>
              <Check checked={hasRead} onChange={setHasRead}>
                I have read the risks on the previous step, and I understand Almanac is not medical advice.
              </Check>
              <Check checked={willSupervise} onChange={setWillSupervise}>
                I will keep an eye on how {firstName} is eating and feeling, and I know I can withdraw this approval at any time.
              </Check>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">
              We strongly suggest talking with {firstName}&apos;s doctor before approving.
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              About you
            </h1>
            <Field label="Your full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <ChoiceGroup
              legend={`Your relationship to ${firstName}`}
              name="relationship"
              inline
              value={relationship}
              onChange={setRelationship}
              options={[
                { value: "parent", title: "Parent" },
                { value: "guardian", title: "Legal guardian" },
              ]}
            />
            <p className="text-sm leading-relaxed text-ink-soft">
              Your name is kept with the approval and shown to {firstName} as the person who gave it.
            </p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Type it out
            </h1>
            <p className="leading-relaxed">
              Type this sentence exactly: <strong className="font-semibold">{CONSENT_PHRASE}</strong>
            </p>
            <Field
              label="Type the sentence"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
              hint={phrase && !phraseMatches(phrase) ? "Not matching yet." : phraseMatches(phrase) ? "That matches." : undefined}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Slide to continue
            </h1>
            <div>
              <label htmlFor={sliderId} className="label">
                Move the slider all the way to the right
              </label>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={slider}
                onChange={(e) => setSlider(Number(e.target.value))}
                aria-valuetext={slider === 100 ? "All the way" : `${slider} percent`}
                className="mt-3 h-11 w-full accent-[var(--color-accent-strong)]"
              />
              <p role="status" className="mt-1 text-sm text-ink-soft">
                {slider === 100 ? "Done." : "Not there yet."}
              </p>
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Press and hold
            </h1>
            <p className="leading-relaxed">
              Hold the button for {HOLD_MS / 1000} seconds. Use the time to be sure. With a keyboard, hold the space bar.
            </p>
            <HoldButton durationMs={HOLD_MS} done={heldMs >= HOLD_MS} onHeld={setHeldMs} />
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h1 ref={headingRef} tabIndex={-1} className={heading}>
              Give your approval
            </h1>
            <p className="leading-relaxed">
              You are <strong className="font-semibold">{name.trim()}</strong>, {firstName}&apos;s{" "}
              {relationship === "guardian" ? "legal guardian" : "parent"}, and you are allowing {firstName} to set a
              fat-loss goal in Almanac within the limits described.
            </p>
            <p className="leading-relaxed text-ink-soft">
              This takes effect immediately. You will get an email with a link to withdraw it.
            </p>
            {error ? (
              <p role="alert" className="font-medium text-accent-strong">
                <span aria-hidden>! </span>
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        {step > 0 ? (
          <Button variant="quiet" onClick={() => setStep(step - 1)} disabled={pending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button size="lg" onClick={() => setStep(step + 1)} disabled={!ready}>
            {step === 0 ? "I have read this" : "Continue"}
          </Button>
        ) : (
          <Button size="lg" variant="accent" onClick={() => dialogRef.current?.showModal()} disabled={pending}>
            {pending ? "Saving…" : "Approve"}
          </Button>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="final-confirm-title"
        className="m-auto w-[min(92vw,26rem)] border border-rule-strong bg-paper p-6 text-ink backdrop:bg-black/50"
      >
        <h2 id="final-confirm-title" className="font-display text-2xl">
          Are you sure?
        </h2>
        <p className="mt-3 leading-relaxed">
          This allows {firstName}, who is under 18, to follow a fat-loss plan. If you have any doubt, cancel and talk to
          their doctor first.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit}>
            Yes, I approve
          </Button>
        </div>
      </dialog>
    </div>
  );
}
