"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { deleteFoodLogAction, saveMealAction, updateFoodLogQuantityAction } from "@/app/(app)/food/actions";
import { fmt } from "@/lib/format";

export type MealEntry = {
  id: string;
  name: string;
  brand: string | null;
  quantityG: number;
  kcal: number;
  proteinG: number;
};

type Props = {
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  title: string;
  date: string;
  entries: MealEntry[];
};

export function MealList({ meal, title, date, entries }: Props) {
  const [optimistic, remove] = useOptimistic(entries, (state, id: string) => state.filter((e) => e.id !== id));
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const kcal = optimistic.reduce((a, e) => a + e.kcal, 0);

  function onDelete(entry: MealEntry) {
    startTransition(async () => {
      remove(entry.id);
      const res = await deleteFoodLogAction(entry.id);
      setMessage(res.ok ? `Removed ${entry.name}.` : res.error);
    });
  }

  function onSaveMeal() {
    const name = window.prompt(`Name this ${title.toLowerCase()} so you can log it again in one tap:`, title);
    if (!name) return;
    startTransition(async () => {
      const res = await saveMealAction({ name, date, meal });
      setMessage(res.ok ? `Saved as "${name}". Find it under Mine when adding food.` : res.error);
    });
  }

  return (
    <section aria-labelledby={`meal-${meal}`} className="border-t border-rule pt-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id={`meal-${meal}`} className="font-display text-2xl">
          {title}
        </h2>
        <p className="nums text-sm text-ink-soft">
          {optimistic.length > 0 ? `${fmt(kcal)} kcal` : null}
        </p>
      </header>

      {optimistic.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft">Nothing logged.</p>
      ) : (
        <ul className="mt-2">
          <AnimatePresence initial={false}>
            {optimistic.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="flex items-center gap-2 border-b border-rule py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  {editing === e.id ? (
                    <QuantityEditor
                      entry={e}
                      onDone={(msg) => {
                        setEditing(null);
                        if (msg) setMessage(msg);
                      }}
                    />
                  ) : (
                    <p className="nums text-sm text-ink-soft">
                      {e.quantityG > 0 ? (
                        <button
                          type="button"
                          onClick={() => setEditing(e.id)}
                          className="underline decoration-dotted underline-offset-4 hover:text-ink"
                          aria-label={`Change amount of ${e.name}, currently ${fmt(e.quantityG)} grams`}
                        >
                          {fmt(e.quantityG)} g
                        </button>
                      ) : (
                        "Quick add"
                      )}
                      {e.brand ? ` · ${e.brand}` : ""} · {fmt(e.proteinG)} g protein
                    </p>
                  )}
                </div>
                <p className="nums shrink-0 text-right">
                  {fmt(e.kcal)}
                  <span className="label ml-1">kcal</span>
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(e)}
                  aria-label={`Remove ${e.name}`}
                  className="grid size-11 shrink-0 place-items-center text-ink-soft hover:text-accent-strong"
                >
                  <Trash aria-hidden size={20} weight="light" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="mt-1 flex items-center justify-between">
        <Link
          href={`/food/add?meal=${meal}&date=${date}`}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 font-medium text-accent-strong hover:underline"
        >
          <Plus aria-hidden size={18} weight="bold" />
          Add to {title.toLowerCase()}
        </Link>
        {optimistic.some((e) => e.quantityG > 0) ? (
          <button type="button" onClick={onSaveMeal} className="label min-h-11 px-2 underline decoration-dotted underline-offset-4 hover:text-ink">
            Save as meal
          </button>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {message}
      </p>
    </section>
  );
}

function QuantityEditor({ entry, onDone }: { entry: MealEntry; onDone: (message?: string) => void }) {
  const [value, setValue] = useState(String(Math.round(entry.quantityG)));
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-1 flex items-center gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        startTransition(async () => {
          const res = await updateFoodLogQuantityAction({ logId: entry.id, quantityG: value });
          onDone(res.ok ? `Updated ${entry.name}.` : res.error);
        });
      }}
    >
      <label className="sr-only" htmlFor={`qty-${entry.id}`}>
        Amount of {entry.name} in grams
      </label>
      <input
        id={`qty-${entry.id}`}
        autoFocus
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="nums h-9 w-20 border-b border-ink bg-transparent outline-none"
      />
      <span className="label">g</span>
      <button type="submit" disabled={pending} className="min-h-9 px-2 text-sm font-medium underline underline-offset-4">
        Save
      </button>
      <button type="button" onClick={() => onDone()} className="min-h-9 px-2 text-sm text-ink-soft underline underline-offset-4">
        Cancel
      </button>
    </form>
  );
}
