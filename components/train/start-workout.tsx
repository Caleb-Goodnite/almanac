"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRoutineAction, startWorkoutAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import type { Routine } from "@/lib/data/training";

export function StartWorkout({ routines }: { routines: Routine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start(name: string, routineId: string | null) {
    startTransition(async () => {
      const res = await startWorkoutAction({ clientId: crypto.randomUUID(), name, routineId });
      if (res.ok) router.push(`/train/workout/${res.data}`);
      else setError(res.error);
    });
  }

  return (
    <div>
      {routines.length > 0 ? (
        <ul className="mb-3 border-t border-rule">
          {routines.map((r) => (
            <li key={r.id} className="flex items-center gap-2 border-b border-rule py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="truncate text-sm text-ink-soft">{r.items.map((i) => i.name).join(", ") || "No exercises"}</p>
              </div>
              <button
                type="button"
                className="label min-h-11 px-2 underline decoration-dotted underline-offset-4 hover:text-ink"
                aria-label={`Delete routine ${r.name}`}
                onClick={() => {
                  if (!window.confirm(`Delete the routine "${r.name}"? Past workouts are kept.`)) return;
                  startTransition(async () => {
                    await deleteRoutineAction(r.id);
                    router.refresh();
                  });
                }}
              >
                Delete
              </button>
              <Button variant="accent" disabled={pending} onClick={() => start(r.name, r.id)}>
                Start
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant={routines.length > 0 ? "outline" : "primary"} size="lg" disabled={pending} onClick={() => start("Workout", null)}>
        {routines.length > 0 ? "Start an empty workout" : "Start a workout"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
