import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LineChart } from "@/components/charts/line-chart";
import { Section } from "@/components/ui/section";
import { Why } from "@/components/ui/why";
import { requireViewer } from "@/lib/auth/session";
import { getExercise, getExerciseHistory } from "@/lib/data/training";
import { fmt, fmtDate, weightUnit, weightValue } from "@/lib/format";
import { estimateOneRepMax } from "@/lib/science/strength";
import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/science/volume";

export const metadata: Metadata = { title: "Exercise" };

export default async function ExercisePage({ params }: PageProps<"/train/exercises/[id]">) {
  const viewer = await requireViewer();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [exercise, history] = await Promise.all([getExercise(viewer.userId, id.data), getExerciseHistory(viewer.userId, id.data)]);
  if (!exercise) notFound();

  const units = viewer.profile.unitSystem;
  const u = weightUnit(units);
  const show = (kg: number) => fmt(weightValue(kg, units), 1).replace(/\.0$/, "");
  const label = (groups: string[]) => groups.map((g) => MUSCLE_LABELS[g as MuscleGroup] ?? g).join(", ");

  // Best estimated max per session, oldest first, for the chart.
  const points = history
    .map((s) => ({
      date: s.date,
      value: Math.max(0, ...s.sets.filter((x) => !x.isWarmup).map((x) => estimateOneRepMax(x.weightKg, x.reps) ?? 0)),
    }))
    .filter((p) => p.value > 0)
    .reverse();
  // One point per day: keep the best if two sessions share a date.
  const byDate = new Map<string, number>();
  for (const p of points) byDate.set(p.date, Math.max(byDate.get(p.date) ?? 0, weightValue(p.value, units)));
  const chart = [...byDate.entries()].map(([date, value]) => ({ date, value }));
  const best = points.length ? Math.max(...points.map((p) => p.value)) : null;

  return (
    <div className="flex flex-col gap-12">
      <Section
        as="h1"
        kicker={[exercise.category, exercise.level].filter(Boolean).join(" · ")}
        title={exercise.name}
        aside={
          <Link href="/train/exercises" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
            All exercises
          </Link>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {[
            ["Works", label(exercise.primaryGroups) || "Not specified"],
            ["Also works", label(exercise.secondaryGroups) || "None listed"],
            ["Equipment", exercise.equipment ?? "None"],
            ["Movement", exercise.movementPattern ?? "Not specified"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd className="mt-1 capitalize">{v}</dd>
            </div>
          ))}
        </dl>

        {exercise.instructions.length > 0 ? (
          <>
            <h2 className="label mt-8">How to do it</h2>
            <ol className="mt-2 flex max-w-prose flex-col gap-3">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 leading-relaxed">
                  <span className="nums font-display text-xl text-accent-strong">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft">
              Written instructions only go so far. If an exercise is new to you, ask a coach or an experienced
              lifter to watch your first few sessions, and stop if anything hurts.
            </p>
          </>
        ) : (
          <p className="mt-6 text-ink-soft">This is one of your own exercises, so there are no instructions for it.</p>
        )}
      </Section>

      <Section kicker="Your history" title="Progress">
        {history.length === 0 ? (
          <p className="text-ink-soft">
            You have not logged this yet. Once you do, your best estimated max for each session is charted here.
          </p>
        ) : (
          <>
            {best ? (
              <p className="nums">
                <span className="font-display text-4xl">{show(best)}</span>
                <span className="label ml-2">{u}, best estimated one-rep max</span>
              </p>
            ) : null}
            {chart.length >= 2 ? (
              <div className="mt-4">
                <LineChart
                  points={chart}
                  trend={chart}
                  unit={u}
                  decimals={1}
                  valueLabel="Estimated one-rep max"
                  from={chart[0]!.date}
                  to={chart[chart.length - 1]!.date}
                  height={170}
                  summary={`Best estimated one-rep max for ${exercise.name} in each of ${chart.length} sessions.`}
                />
              </div>
            ) : null}
            <Why label="How is the max estimated?" source="volume" cite="Reynolds et al. 2006">
              From your heaviest sets of 10 reps or fewer, using the average of two standard formulas (Epley and
              Brzycki). Estimates from 5 reps or fewer are the most accurate; it is a guide to progress, not a
              number to test.
            </Why>

            <h2 className="label mt-6">Sessions</h2>
            <ul className="nums mt-1">
              {history.slice(0, 12).map((s) => (
                <li key={s.workoutId} className="border-b border-rule py-2">
                  <Link href={`/train/workout/${s.workoutId}`} className="font-medium underline underline-offset-4">
                    {fmtDate(s.date, { weekday: "short", month: "short", day: "numeric" })}
                  </Link>
                  <span className="ml-3 text-ink-soft">
                    {s.sets.filter((x) => !x.isWarmup).map((x) => `${show(x.weightKg)} × ${x.reps}`).join(", ") || "warm-ups only"} {u}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </div>
  );
}
