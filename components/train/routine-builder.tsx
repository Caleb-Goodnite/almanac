"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRoutineAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ExerciseSummary } from "@/lib/data/training";
import { ExerciseSearch } from "./exercise-search";

type Item = { exercise: ExerciseSummary; sets: string; repsMin: string; repsMax: string; rest: string };

export function RoutineBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (id: string, change: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.exercise.id === id ? { ...it, ...change } : it)));
  const small = "nums h-11 w-full border-b border-rule-strong bg-transparent text-center outline-none focus:border-ink";

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await createRoutineAction({
            name,
            items: items.map((it) => ({
              exerciseId: it.exercise.id,
              targetSets: it.sets,
              targetRepsMin: it.repsMin,
              targetRepsMax: it.repsMax,
              restSeconds: it.rest,
            })),
          });
          if (res.ok) {
            router.push("/train");
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <Field label="Routine name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Upper body A" maxLength={60} required />

      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink-soft">
          A routine is a list of exercises you repeat. Start one and the exercises are ready,
          with last time’s numbers beside each.
        </p>
      ) : (
        <ol className="border-t border-rule">
          {items.map((it, i) => (
            <li key={it.exercise.id} className="border-b border-rule py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  <span className="nums mr-2 text-ink-soft">{i + 1}</span>
                  {it.exercise.name}
                </p>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.exercise.id !== it.exercise.id))}
                  aria-label={`Remove ${it.exercise.name}`}
                  className="grid size-11 place-items-center text-ink-soft hover:text-accent-strong"
                >
                  <Trash aria-hidden size={18} weight="light" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <label>
                  <span className="label">Sets</span>
                  <input inputMode="numeric" value={it.sets} onChange={(e) => patch(it.exercise.id, { sets: e.target.value })} className={small} />
                </label>
                <label>
                  <span className="label">Reps from</span>
                  <input inputMode="numeric" value={it.repsMin} onChange={(e) => patch(it.exercise.id, { repsMin: e.target.value })} className={small} />
                </label>
                <label>
                  <span className="label">Reps to</span>
                  <input inputMode="numeric" value={it.repsMax} onChange={(e) => patch(it.exercise.id, { repsMax: e.target.value })} className={small} />
                </label>
                <label>
                  <span className="label">Rest (s)</span>
                  <input inputMode="numeric" value={it.rest} onChange={(e) => patch(it.exercise.id, { rest: e.target.value })} className={small} />
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button type="button" variant="outline" onClick={() => setSearching(true)}>
        <Plus aria-hidden size={18} weight="bold" />
        Add exercise
      </Button>

      {error ? (
        <p role="alert" className="text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending || items.length === 0 || !name.trim()}>
        {pending ? "Saving…" : "Save routine"}
      </Button>

      {searching ? (
        <ExerciseSearch
          onClose={() => setSearching(false)}
          onPick={(exercise) => {
            setSearching(false);
            setItems((prev) =>
              prev.some((x) => x.exercise.id === exercise.id)
                ? prev
                : [...prev, { exercise, sets: "3", repsMin: "8", repsMax: "12", rest: "120" }],
            );
          }}
        />
      ) : null}
    </form>
  );
}
