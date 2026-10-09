"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createExerciseAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import type { ExerciseSummary } from "@/lib/data/training";
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/lib/science/volume";
import { cn } from "@/lib/utils/cn";

type Props = { onPick: (exercise: ExerciseSummary) => void; onClose: () => void };

/** A modal exercise finder: search by name, filter by muscle, or create your own. */
export function ExerciseSearch({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal() focuses the first control (Close); the search box is what people want.
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery({
    queryKey: ["exercise-search", debounced, group],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced });
      if (group) params.set("group", group);
      const res = await fetch(`/api/exercises/search?${params}`, { signal });
      if (!res.ok) throw new Error("Exercise search is not available right now.");
      return ((await res.json()) as { results: ExerciseSummary[] }).results;
    },
  });

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto flex h-[85dvh] w-full max-w-none flex-col border-t border-ink bg-paper p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:h-[36rem] sm:max-w-lg sm:border [&:not([open])]:hidden"
    >
      <div className="border-b border-rule p-5 pb-3">
        <div className="flex items-baseline justify-between">
          <h2 id={titleId} className="font-display text-2xl">
            Add an exercise
          </h2>
          <button type="button" onClick={onClose} className="label min-h-11 px-2 underline decoration-dotted underline-offset-4">
            Close
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 border-b border-rule-strong focus-within:border-ink">
          <MagnifyingGlass aria-hidden size={20} weight="light" />
          <span className="sr-only">Search exercises</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. squat"
            autoComplete="off"
            className="min-h-11 w-full bg-transparent text-lg outline-none placeholder:text-ink-faint"
          />
        </label>
        <fieldset className="mt-3">
          <legend className="sr-only">Filter by muscle group</legend>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={group === g}
                onClick={() => setGroup(group === g ? null : g)}
                className={cn(
                  "min-h-9 shrink-0 rounded-[3px] border px-3 text-sm",
                  group === g ? "border-ink bg-ink font-semibold text-paper" : "border-rule-strong",
                )}
              >
                {MUSCLE_LABELS[g]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5" aria-live="polite" aria-busy={results.isFetching}>
        {results.isPending ? (
          <ul aria-label="Loading exercises">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="border-b border-rule py-3">
                <div className="h-4 w-1/2 animate-pulse bg-paper-sunk" />
                <div className="mt-2 h-3 w-1/4 animate-pulse bg-paper-sunk" />
              </li>
            ))}
          </ul>
        ) : results.isError ? (
          <div className="py-6">
            <p role="alert" className="text-sm font-medium text-accent-strong">
              <span aria-hidden>! </span>
              {results.error.message}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => results.refetch()}>
              Try again
            </Button>
          </div>
        ) : results.data.length === 0 ? (
          <p className="py-6 text-sm text-ink-soft">No exercise matches that. You can add your own below.</p>
        ) : (
          <ul>
            {results.data.map((e) => (
              <li key={e.id} className="border-b border-rule">
                <button type="button" onClick={() => onPick(e)} className="min-h-14 w-full py-2 text-left hover:bg-paper-raised">
                  <span className="block font-medium">{e.name}</span>
                  <span className="block text-sm text-ink-soft">
                    {[e.primaryGroups.map((g) => MUSCLE_LABELS[g as MuscleGroup] ?? g).join(", "), e.equipment].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {debounced.length >= 2 ? (
        <div className="safe-b border-t border-rule p-4">
          {error ? (
            <p role="alert" className="mb-2 text-sm font-medium text-accent-strong">
              <span aria-hidden>! </span>
              {error}
            </p>
          ) : null}
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await createExerciseAction({ name: debounced, primaryGroups: group ? [group] : [] });
                if (res.ok) onPick(res.data);
                else setError(res.error);
              })
            }
          >
            Create “{debounced}”{group ? ` (${MUSCLE_LABELS[group]})` : ""}
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}
