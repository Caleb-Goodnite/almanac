"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FoodSummary } from "@/lib/data/foods";
import { startingAmount, tidy, unitsFor, type Portion, type Unit } from "@/lib/food/units";
import { fmt } from "@/lib/format";

const GROUP_LABEL: Record<Unit["group"], string> = { measure: "Typical measures", weight: "By weight", volume: "By volume" };

/** How much one press of the minus or plus button changes the amount. */
function stepFor(unit: Unit): number {
  if (unit.id === "g" || unit.id === "v:ml") return 10;
  if (unit.id === "oz" || unit.id === "v:fl oz" || unit.id === "v:tbsp" || unit.id === "v:tsp") return 1;
  if (unit.id === "lb" || unit.id === "v:cup") return 0.25;
  // Things counted whole (fries, crackers) step by one; servings and cups by a half.
  return unit.typical >= 5 ? 1 : 0.5;
}

type Props = {
  food: FoodSummary;
  /** Grams logged last time, when this is a repeat; null for a first log. */
  lastGrams: number | null;
  mealLabel: string;
  onClose: () => void;
  onConfirm: (grams: number) => void;
};

/**
 * Asks how much was eaten. The amount can be given in the food's own
 * household measures (a medium banana, a slice, a cup), by weight in grams,
 * ounces or pounds, or by kitchen volume where the source gives the food's
 * weight per cup or spoon. Whatever is chosen is stored as grams.
 */
export function QuantityDialog({ food, lastGrams, mealLabel, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const unitId = useId();

  // USDA search results arrive without household measures; they are fetched the first time a food is opened.
  const lookup = useQuery({
    queryKey: ["food-portions", food.id],
    enabled: food.source === "usda" && food.portions === null,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`/api/foods/${food.id}/portions`);
      return res.ok ? ((await res.json()) as { portions: Portion[] }).portions : [];
    },
  });
  const portions = food.portions ?? lookup.data ?? null;
  const units = useMemo(
    () => unitsFor({ servingG: food.servingG, servingLabel: food.servingLabel, portions }),
    [food.servingG, food.servingLabel, portions],
  );

  // null until the person changes something; until then the suggestion follows the units as they load.
  const [choice, setChoice] = useState<{ unitId: string; amount: string } | null>(null);
  const suggested = useMemo(() => startingAmount(units, lastGrams), [units, lastGrams]);
  const unit = units.find((u) => u.id === (choice?.unitId ?? suggested.unitId)) ?? units[0]!;
  const amount = choice?.amount ?? String(suggested.amount);

  // Opened once on mount. There is no close() in a cleanup: closing fires the
  // dialog's close event, which would dismiss it during React's development
  // double-run of effects. Unmounting removes it from the top layer anyway.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const n = Number(amount);
  const grams = n * unit.grams;
  const valid = amount.trim() !== "" && Number.isFinite(grams) && grams > 0 && grams <= 5000;
  const k = valid ? grams / 100 : 0;
  const step = stepFor(unit);

  function nudge(direction: 1 | -1) {
    const current = Number.isFinite(n) ? n : 0;
    const next = Math.max(step, Math.round((current + direction * step) / step) * step);
    setChoice({ unitId: unit.id, amount: String(tidy(next)) });
  }

  const groups = (["measure", "weight", "volume"] as const)
    .map((group) => ({ group, units: units.filter((u) => u.group === group) }))
    .filter((g) => g.units.length > 0);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none border-t border-ink bg-paper p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:border"
    >
      <form
        className="safe-b p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onConfirm(Math.round(grams * 10) / 10);
        }}
      >
        <p className="label">Add to {mealLabel.toLowerCase()}</p>
        <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
          {food.name}
        </h2>
        {food.brand ? <p className="text-sm text-ink-soft">{food.brand}</p> : null}

        <div className="mt-5 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="label">Amount</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setChoice({ unitId: unit.id, amount: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="nums mt-1 block min-h-12 w-full border-b border-rule-strong bg-transparent font-display text-4xl outline-none focus:border-ink"
            />
          </label>
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label={`Less: take away ${step} ${unit.label}`}
            className="grid size-11 shrink-0 place-items-center rounded-[3px] border border-rule-strong hover:border-ink"
          >
            <Minus aria-hidden size={18} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label={`More: add ${step} ${unit.label}`}
            className="grid size-11 shrink-0 place-items-center rounded-[3px] border border-rule-strong hover:border-ink"
          >
            <Plus aria-hidden size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor={unitId} className="label">
            Measured in
          </label>
          <select
            id={unitId}
            value={unit.id}
            onChange={(e) => {
              const next = units.find((u) => u.id === e.target.value) ?? unit;
              // Keep the same quantity of food when only the unit changes.
              const same = valid ? grams / next.grams : next.typical;
              const rounded = next.id === "g" || next.id === "v:ml" ? Math.round(same) : tidy(same);
              setChoice({ unitId: next.id, amount: String(rounded || next.typical) });
            }}
            className="mt-1 block min-h-12 w-full border-b border-rule-strong bg-transparent text-lg outline-none focus:border-ink"
          >
            {groups.map(({ group, units: list }) => (
              <optgroup key={group} label={GROUP_LABEL[group]}>
                {list.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                    {u.group === "measure" ? ` (${fmt(u.grams, u.grams < 10 ? 1 : 0)} g each)` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <p className="nums mt-2 text-sm text-ink-soft" aria-live="polite">
          {valid ? `That is ${fmt(grams, grams < 10 ? 1 : 0)} g.` : "Enter an amount above zero."}
          {unit.group === "volume" ? " Volume is converted using this food's own weight per cup or spoon, so it is approximate." : ""}
          {lookup.isFetching ? " Looking up more measures…" : ""}
        </p>

        <dl className="nums mt-4 grid grid-cols-4 gap-2 border-y border-rule py-3 text-center" aria-live="polite">
          {[
            ["kcal", food.kcal * k, 0],
            ["protein", food.proteinG * k, 1],
            ["carbs", food.carbsG * k, 1],
            ["fat", food.fatG * k, 1],
          ].map(([label, value, d]) => (
            <div key={label as string}>
              <dd className="font-display text-2xl">{fmt(value as number, d as number)}</dd>
              <dt className="label">{label as string}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex gap-3">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" size="lg" className="flex-1" disabled={!valid}>
            Log it
          </Button>
        </div>
      </form>
    </dialog>
  );
}
