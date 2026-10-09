import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { searchExercises } from "@/lib/data/training";
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/lib/science/volume";
import { cn } from "@/lib/utils/cn";
import { exerciseSearchSchema } from "@/lib/validation/training";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage({ searchParams }: PageProps<"/train/exercises">) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const parsed = exerciseSearchSchema.safeParse({
    q: typeof params.q === "string" ? params.q : "",
    group: typeof params.group === "string" ? params.group : undefined,
  });
  const q = parsed.success ? parsed.data.q : "";
  const group = parsed.success ? parsed.data.group : undefined;
  const results = await searchExercises(viewer.userId, { query: q || undefined, group, limit: 80 });
  const href = (g?: MuscleGroup) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (g) p.set("group", g);
    const qs = p.toString();
    return qs ? `/train/exercises?${qs}` : "/train/exercises";
  };

  return (
    <Section
      as="h1"
      kicker="Training"
      title="Exercises"
      aside={
        <Link href="/train" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      {/* A plain GET form: search works without JavaScript and the result is linkable. */}
      <form action="/train/exercises" className="flex items-end gap-3">
        {group ? <input type="hidden" name="group" value={group} /> : null}
        <label className="flex-1">
          <span className="label">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="e.g. squat, row, plank"
            className="mt-1 block min-h-12 w-full border-b border-rule-strong bg-transparent text-lg outline-none placeholder:text-ink-faint focus:border-ink"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-[3px] border border-rule-strong px-4 font-medium hover:border-ink">
          Search
        </button>
      </form>

      <nav aria-label="Filter by muscle group" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {[undefined, ...MUSCLE_GROUPS].map((g) => (
          <Link
            key={g ?? "all"}
            href={href(g)}
            aria-current={g === group ? "true" : undefined}
            className={cn("min-h-9 shrink-0 content-center rounded-[3px] border px-3 text-sm", g === group ? "border-ink bg-ink font-semibold text-paper" : "border-rule-strong")}
          >
            {g ? MUSCLE_LABELS[g] : "All"}
          </Link>
        ))}
      </nav>

      <p className="label mt-5" role="status">
        {results.length === 80 ? "First 80 matches" : `${results.length} ${results.length === 1 ? "exercise" : "exercises"}`}
      </p>
      {results.length === 0 ? (
        <p className="mt-3 text-ink-soft">Nothing matches that. Try a shorter word, or create your own exercise while logging a workout.</p>
      ) : (
        <ul className="mt-1">
          {results.map((e) => (
            <li key={e.id} className="border-b border-rule">
              <Link href={`/train/exercises/${e.id}`} className="block min-h-14 py-2 hover:bg-paper-raised">
                <span className="block font-medium">{e.name}</span>
                <span className="block text-sm text-ink-soft">
                  {[e.primaryGroups.map((g) => MUSCLE_LABELS[g as MuscleGroup] ?? g).join(", "), e.equipment, e.movementPattern].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
