import { Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export type Step = { done: boolean; label: string; why: string; href: string };

/**
 * A first-week checklist for new accounts. It teaches what the app is for by
 * doing, shows each step's payoff, and disappears once everything is ticked.
 * Nothing here nags: there are no reminders and no penalty for skipping.
 */
export function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section aria-labelledby="getting-started" className="masthead-rule">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="label mb-1">
            {done} of {steps.length} done
          </p>
          <h2 id="getting-started" className="display text-3xl sm:text-4xl">
            Getting started
          </h2>
        </div>
      </header>
      <ol>
        {steps.map((s) => (
          <li key={s.label} className="border-b border-rule">
            {s.done ? (
              <div className="flex min-h-14 items-center gap-3 py-2 text-ink-soft">
                <span className="grid size-6 shrink-0 place-items-center border border-good text-good">
                  <Check aria-hidden size={14} weight="bold" />
                </span>
                <span>
                  <span className="sr-only">Done: </span>
                  <span className="line-through decoration-rule-strong">{s.label}</span>
                </span>
              </div>
            ) : (
              <Link href={s.href} className="flex min-h-14 items-center gap-3 py-2 hover:bg-paper-raised">
                <span aria-hidden className="size-6 shrink-0 border border-rule-strong" />
                <span>
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-sm leading-snug text-ink-soft">{s.why}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
