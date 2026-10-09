import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkoutLogger, type Block } from "@/components/train/workout-logger";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getWorkoutDetail } from "@/lib/data/training";
import { fmt, fmtDate, weightUnit, weightValue } from "@/lib/format";
import { estimateOneRepMax } from "@/lib/science/strength";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: PageProps<"/train/workout/[id]">) {
  const viewer = await requireViewer();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  // Scoped to the viewer: someone else's workout id is simply "not found".
  const detail = await getWorkoutDetail(viewer.userId, id.data);
  if (!detail) notFound();

  const { workout, blocks } = detail;
  const units = viewer.profile.unitSystem;
  const back = (
    <Link href="/train" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
      Back
    </Link>
  );

  if (!workout.endedAt) {
    const initial: Block[] = blocks.map((b) => ({
      exercise: b.exercise,
      sets: b.sets.map((s) => ({ id: s.id, setNumber: s.setNumber, reps: s.reps, weightKg: s.weightKg, rpe: s.rpe, isWarmup: s.isWarmup, records: [] })),
      previous: b.previous,
      target: b.target,
    }));
    return (
      <Section as="h1" kicker={`In progress · ${fmtDate(workout.date, { weekday: "long", month: "long", day: "numeric" })}`} title={workout.name} aside={back}>
        <WorkoutLogger workoutId={workout.id} initialBlocks={initial} units={units} />
      </Section>
    );
  }

  const u = weightUnit(units);
  const show = (kg: number) => fmt(weightValue(kg, units), 1).replace(/\.0$/, "");

  return (
    <Section as="h1" kicker={fmtDate(workout.date, { weekday: "long", month: "long", day: "numeric" })} title={workout.name} aside={back}>
      {workout.kcalEstimate ? (
        <p className="nums mb-6 text-sm text-ink-soft">About {fmt(workout.kcalEstimate)} kcal, a rough estimate from session length.</p>
      ) : null}
      <div className="flex flex-col gap-6">
        {blocks.map((b) => {
          const best = Math.max(0, ...b.sets.filter((s) => !s.isWarmup).map((s) => estimateOneRepMax(s.weightKg, s.reps) ?? 0));
          return (
            <section key={b.exercise.id} className="border-t border-rule pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl">{b.exercise.name}</h2>
                {best > 0 ? (
                  <p className="nums shrink-0 text-sm text-ink-soft">
                    Est. max {show(best)} {u}
                  </p>
                ) : null}
              </div>
              <ol className="nums mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {b.sets.map((s) => (
                  <li key={s.id} className={s.isWarmup ? "text-ink-soft" : undefined}>
                    {show(s.weightKg)} {u} × {s.reps}
                    {s.rpe != null ? <span className="text-sm text-ink-soft"> @ {s.rpe}</span> : null}
                    {s.isWarmup ? <span className="text-sm"> (warm-up)</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </Section>
  );
}
