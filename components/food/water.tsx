"use client";

import { Drop } from "@phosphor-icons/react";
import { useOptimistic, useTransition } from "react";
import { addWaterAction, undoWaterAction } from "@/app/(app)/food/actions";
import { fmtWater, type UnitSystem } from "@/lib/format";

type Props = { date: string; ml: number; targetMl: number; units: UnitSystem };

/** One-tap water logging. Amounts are a glass and a bottle in the user's units. */
export function Water({ date, ml, targetMl, units }: Props) {
  const [optimistic, add] = useOptimistic(ml, (state, delta: number) => Math.max(0, state + delta));
  const [, startTransition] = useTransition();
  const sizes = units === "imperial" ? [{ ml: 237, label: "8 oz" }, { ml: 473, label: "16 oz" }] : [{ ml: 250, label: "250 ml" }, { ml: 500, label: "500 ml" }];
  const ratio = Math.min(optimistic / targetMl, 1);

  return (
    <section aria-labelledby="water-heading" className="border-t border-rule pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="water-heading" className="flex items-center gap-2 font-display text-2xl">
          <Drop aria-hidden size={22} weight="light" />
          Water
        </h2>
        <p className="nums text-sm" aria-live="polite">
          {fmtWater(optimistic, units)}
          <span className="text-ink-soft"> / {fmtWater(targetMl, units)}</span>
        </p>
      </div>
      <div
        className="mt-2 h-2.5 bg-paper-sunk"
        role="meter"
        aria-label="Water"
        aria-valuemin={0}
        aria-valuemax={targetMl}
        aria-valuenow={Math.min(optimistic, targetMl)}
        aria-valuetext={`${fmtWater(optimistic, units)} of ${fmtWater(targetMl, units)}`}
      >
        <div className="h-full origin-left bg-ink transition-transform duration-500 ease-out" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {sizes.map((s) => (
          <button
            key={s.ml}
            type="button"
            onClick={() =>
              startTransition(async () => {
                add(s.ml);
                await addWaterAction({ date, ml: s.ml });
              })
            }
            className="min-h-11 rounded-[3px] border border-rule-strong px-4 font-medium hover:border-ink hover:bg-paper-raised active:translate-y-px"
          >
            + {s.label}
          </button>
        ))}
        {optimistic > 0 ? (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                add(-sizes[0]!.ml);
                await undoWaterAction(date);
              })
            }
            className="label min-h-11 px-2 underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            Undo last
          </button>
        ) : null}
      </div>
    </section>
  );
}
