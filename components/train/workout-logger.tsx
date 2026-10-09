"use client";

import { Plus, Trash, Trophy } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { addSetAction, deleteSetAction, finishWorkoutAction, previousSessionAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import type { ExerciseSummary } from "@/lib/data/training";
import { fmt, fmtDate, type UnitSystem } from "@/lib/format";
import type { PrKind } from "@/lib/science/strength";
import { kgToLb, lbToKg } from "@/lib/science/units";
import { ExerciseSearch } from "./exercise-search";
import { RestTimer } from "./rest-timer";

export type LoggedSet = {
  id: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
  isWarmup: boolean;
  records: PrKind[];
};

export type Block = {
  exercise: ExerciseSummary;
  sets: LoggedSet[];
  previous: { date: string; sets: { reps: number; weightKg: number; rpe: number | null; isWarmup: boolean }[] } | null;
  target: { targetSets: number; targetRepsMin: number; targetRepsMax: number; restSeconds: number } | null;
};

const PR_LABEL: Record<PrKind, string> = {
  e1rm: "Best estimated max",
  weight: "Heaviest weight",
  reps: "Most reps at this weight",
  volume: "Biggest set",
};

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const DEFAULT_REST = 120;
// Read the clock only from event handlers, never during render.
const nowMs = () => Date.now();

export function WorkoutLogger({
  workoutId,
  initialBlocks,
  units,
}: {
  workoutId: string;
  initialBlocks: Block[];
  units: UnitSystem;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [searching, setSearching] = useState(false);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [status, setStatus] = useState("");
  const [finishing, startFinish] = useTransition();

  const toDisplay = (kg: number) => (units === "imperial" ? kgToLb(kg) : kg);
  const toKg = (v: number) => (units === "imperial" ? lbToKg(v) : v);
  const unit = units === "imperial" ? "lb" : "kg";
  const round = (v: number) => Math.round(v * 10) / 10;

  function updateBlock(exerciseId: string, fn: (b: Block) => Block) {
    setBlocks((prev) => prev.map((b) => (b.exercise.id === exerciseId ? fn(b) : b)));
  }

  async function logSet(block: Block, values: { weight: number; reps: number; rpe: number | null; isWarmup: boolean }) {
    const weightKg = Math.round(toKg(values.weight) * 100) / 100;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: LoggedSet = {
      id: tempId,
      setNumber: block.sets.length + 1,
      reps: values.reps,
      weightKg,
      rpe: values.rpe,
      isWarmup: values.isWarmup,
      records: [],
    };
    // Show the set and start the rest clock at once; the save catches up.
    updateBlock(block.exercise.id, (b) => ({ ...b, sets: [...b.sets, optimistic] }));
    if (!values.isWarmup) {
      const total = block.target?.restSeconds ?? DEFAULT_REST;
      setRest({ endsAt: nowMs() + total * 1000, total });
    }

    const res = await addSetAction({
      workoutId,
      exerciseId: block.exercise.id,
      reps: values.reps,
      weightKg,
      rpe: values.rpe ?? "",
      isWarmup: values.isWarmup,
    });

    if (!res.ok) {
      updateBlock(block.exercise.id, (b) => ({ ...b, sets: b.sets.filter((s) => s.id !== tempId) }));
      setStatus(`Could not save that set. ${res.error}`);
      return;
    }
    const kinds = res.data.records.map((r) => r.kind);
    updateBlock(block.exercise.id, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === tempId ? { ...s, id: res.data.id, setNumber: res.data.setNumber, records: kinds } : s)),
    }));
    setStatus(
      kinds.length > 0
        ? `Set saved. Personal record: ${kinds.map((k) => PR_LABEL[k]).join(", ")}.`
        : `Set ${res.data.setNumber} of ${block.exercise.name} saved.`,
    );
  }

  async function removeSet(block: Block, set: LoggedSet) {
    updateBlock(block.exercise.id, (b) => ({ ...b, sets: b.sets.filter((s) => s.id !== set.id) }));
    if (!set.id.startsWith("temp-")) await deleteSetAction(set.id);
    setStatus("Set removed.");
  }

  const totalSets = blocks.reduce((n, b) => n + b.sets.filter((s) => !s.isWarmup).length, 0);

  return (
    <div className={rest ? "pb-20" : undefined}>
      {blocks.length === 0 ? (
        <p className="border-l-2 border-accent py-1 pl-3 leading-relaxed text-ink-soft">
          Add your first exercise. Each set you log shows what you did last time right beside
          it, so you always know what to beat.
        </p>
      ) : null}

      <div className="flex flex-col gap-8">
        {blocks.map((block) => (
          <section key={block.exercise.id} aria-labelledby={`ex-${block.exercise.id}`} className="border-t border-rule pt-4">
            <h2 id={`ex-${block.exercise.id}`} className="font-display text-2xl leading-tight">
              {block.exercise.name}
            </h2>
            <p className="nums mt-1 text-sm text-ink-soft">
              {block.target ? (
                <>
                  Plan: {block.target.targetSets} × {block.target.targetRepsMin}
                  {block.target.targetRepsMax > block.target.targetRepsMin ? `–${block.target.targetRepsMax}` : ""}.{" "}
                </>
              ) : null}
              {block.previous ? (
                <>
                  Last time ({fmtDate(block.previous.date, { month: "short", day: "numeric" })}):{" "}
                  {block.previous.sets
                    .filter((s) => !s.isWarmup)
                    .map((s) => `${fmt(round(toDisplay(s.weightKg)), 1).replace(/\.0$/, "")} × ${s.reps}`)
                    .join(", ") || "warm-ups only"}
                </>
              ) : (
                "First time logging this."
              )}
            </p>

            {block.sets.length > 0 ? (
              <table className="nums mt-3 w-full text-left">
                <thead>
                  <tr className="label">
                    <th scope="col" className="w-10 py-1 font-normal">Set</th>
                    <th scope="col" className="py-1 font-normal">Weight</th>
                    <th scope="col" className="py-1 font-normal">Reps</th>
                    <th scope="col" className="py-1 font-normal">Effort</th>
                    <th scope="col" className="w-11"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {block.sets.map((s, i) => (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-rule"
                      >
                        <th scope="row" className="py-2 font-normal text-ink-soft">
                          {s.isWarmup ? <abbr title="Warm-up" className="no-underline">W</abbr> : i + 1 - block.sets.slice(0, i).filter((x) => x.isWarmup).length}
                        </th>
                        <td className="py-2 font-display text-xl">
                          {fmt(round(toDisplay(s.weightKg)), 1).replace(/\.0$/, "")}
                          <span className="label ml-1">{unit}</span>
                        </td>
                        <td className="py-2 font-display text-xl">{s.reps}</td>
                        <td className="py-2 text-sm text-ink-soft">
                          {s.rpe != null ? `RPE ${s.rpe}` : "–"}
                          {s.records.length > 0 ? (
                            <span className="stamp ml-2 inline-flex items-center gap-1 align-middle font-medium text-accent-strong" title={s.records.map((k) => PR_LABEL[k]).join(", ")}>
                              <Trophy aria-hidden size={16} weight="fill" />
                              Record
                              <span className="sr-only">: {s.records.map((k) => PR_LABEL[k]).join(", ")}</span>
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeSet(block, s)}
                            aria-label={`Remove set ${i + 1} of ${block.exercise.name}`}
                            className="grid size-11 place-items-center text-ink-soft hover:text-accent-strong"
                          >
                            <Trash aria-hidden size={18} weight="light" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            ) : null}

            <SetForm
              // Re-keyed after each set so the next row is pre-filled from the right place.
              key={block.sets.length}
              block={block}
              unit={unit}
              toDisplay={(kg) => round(toDisplay(kg))}
              onLog={(values) => logSet(block, values)}
            />
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row">
        <Button variant="outline" size="lg" className="flex-1" onClick={() => setSearching(true)}>
          <Plus aria-hidden size={18} weight="bold" />
          Add exercise
        </Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={finishing}
          onClick={() => startFinish(async () => finishWorkoutAction(workoutId))}
        >
          {finishing ? "Saving…" : totalSets > 0 ? `Finish workout (${totalSets} ${totalSets === 1 ? "set" : "sets"})` : "Discard empty workout"}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {searching ? (
        <ExerciseSearch
          onClose={() => setSearching(false)}
          onPick={(exercise) => {
            setSearching(false);
            setBlocks((prev) =>
              prev.some((b) => b.exercise.id === exercise.id) ? prev : [...prev, { exercise, sets: [], previous: null, target: null }],
            );
            // Fetch "last time" for the new exercise so it shows before the first set.
            void previousSessionAction({ workoutId, exerciseId: exercise.id }).then((previous) => {
              if (previous) updateBlock(exercise.id, (b) => ({ ...b, previous }));
            });
          }}
        />
      ) : null}

      <RestTimer
        endsAt={rest?.endsAt ?? null}
        totalSeconds={rest?.total ?? DEFAULT_REST}
        onAdjust={(delta) => setRest((r) => (r ? { endsAt: Math.max(nowMs(), r.endsAt + delta * 1000), total: Math.max(15, r.total + delta) } : r))}
        onDismiss={() => setRest(null)}
      />
    </div>
  );
}

function SetForm({
  block,
  unit,
  toDisplay,
  onLog,
}: {
  block: Block;
  unit: string;
  toDisplay: (kg: number) => number;
  onLog: (values: { weight: number; reps: number; rpe: number | null; isWarmup: boolean }) => void;
}) {
  // Pre-fill from the set just logged, else the matching set from last time.
  const lastLogged = block.sets[block.sets.length - 1];
  const prevWorking = block.previous?.sets.filter((s) => !s.isWarmup) ?? [];
  const workingSoFar = block.sets.filter((s) => !s.isWarmup).length;
  const fromPrev = prevWorking[workingSoFar] ?? prevWorking[prevWorking.length - 1];
  const seed = lastLogged ?? fromPrev;

  const [weight, setWeight] = useState(seed ? String(toDisplay(seed.weightKg)) : "");
  const [reps, setReps] = useState(seed ? String(seed.reps) : "");
  const [rpe, setRpe] = useState("");
  const [warmup, setWarmup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = block.exercise.id;

  const inputClass = "nums min-h-12 w-full border-b border-rule-strong bg-transparent font-display text-2xl outline-none focus:border-ink";

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const w = Number(weight || 0);
        const r = Number(reps);
        if (!Number.isFinite(w) || w < 0) return setError("Enter a weight, or 0 for bodyweight.");
        if (!Number.isInteger(r) || r < 1) return setError("Enter the reps.");
        setError(null);
        onLog({ weight: w, reps: r, rpe: rpe === "" ? null : Number(rpe), isWarmup: warmup });
      }}
    >
      <div className="grid grid-cols-[1fr_1fr_1.1fr] items-end gap-3">
        <label>
          <span className="label">Weight ({unit})</span>
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onFocus={(e) => e.target.select()} className={inputClass} aria-describedby={error ? `err-${id}` : undefined} />
        </label>
        <label>
          <span className="label">Reps</span>
          <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} onFocus={(e) => e.target.select()} className={inputClass} />
        </label>
        <label>
          <span className="label">Effort (optional)</span>
          <select value={rpe} onChange={(e) => setRpe(e.target.value)} className="nums min-h-12 w-full border-b border-rule-strong bg-transparent outline-none focus:border-ink">
            <option value="">Not rated</option>
            {RPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                RPE {v} ({10 - v === 0 ? "none" : 10 - v} left)
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p id={`err-${id}`} role="alert" className="mt-2 text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} className="size-5 accent-[var(--accent-strong)]" />
          Warm-up set
        </label>
        <Button type="submit" variant="accent">
          Log set
        </Button>
      </div>
    </form>
  );
}
