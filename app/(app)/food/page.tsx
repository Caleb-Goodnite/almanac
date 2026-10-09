import type { Metadata } from "next";
import Link from "next/link";
import { DateNav } from "@/components/food/date-nav";
import { DaySummary } from "@/components/food/day-summary";
import { MealList } from "@/components/food/meal-list";
import { Water } from "@/components/food/water";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getFoodLogs, getMicroTotals, getWaterMl, mealCounts, MEALS, sumTotals } from "@/lib/data/food-logs";
import { addDays } from "@/lib/science/trend";
import { MICRO_LABELS } from "@/lib/food/types";
import { getTargets } from "@/lib/data/profile";
import { fmt, fmtDate } from "@/lib/format";
import { todayIn } from "@/lib/time";
import { dateSchema } from "@/lib/validation/food";

export const metadata: Metadata = { title: "Food" };

const MEAL_TITLES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" } as const;

export default async function FoodPage({ searchParams }: PageProps<"/food">) {
  const viewer = await requireViewer();
  const today = todayIn(viewer.profile.timezone);
  const requested = dateSchema.safeParse((await searchParams).date);
  // Never show a future day; fall back to today on anything unexpected.
  const date = requested.success && requested.data <= today ? requested.data : today;

  const [logs, waterMl, targets, micros] = await Promise.all([
    getFoodLogs(viewer.userId, date),
    getWaterMl(viewer.userId, date),
    getTargets(viewer.userId, date),
    getMicroTotals(viewer.userId, date),
  ]);
  const dayBefore = addDays(date, -1);
  const before = await mealCounts(viewer.userId, dayBefore);
  const microRows = Object.entries(MICRO_LABELS)
    .map(([key, meta]) => ({ ...meta, value: micros.totals[key] }))
    .filter((m): m is typeof m & { value: number } => m.value !== undefined && m.value > 0);
  const totals = sumTotals(logs);

  return (
    <Section
      as="h1"
      kicker={fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}
      title={date === today ? "Food today" : "Food"}
      aside={<DateNav date={date} today={today} basePath="/food" />}
    >
      {targets ? (
        <DaySummary totals={totals} targets={targets} neutral={viewer.isTeen || viewer.profile.supportMode} />
      ) : null}

      {microRows.length > 0 ? (
        <details className="mt-5 border-t border-rule pt-2">
          <summary className="label min-h-11 cursor-pointer content-center">More nutrients</summary>
          <dl className="nums grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {microRows.map((m) => (
              <div key={m.label} className="flex items-baseline justify-between gap-2 border-b border-rule py-2">
                <dt className="text-sm text-ink-soft">{m.label}</dt>
                <dd>
                  {fmt(m.value, m.value < 10 ? 1 : 0)} <span className="label">{m.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            From {micros.entriesWithData} of this day&rsquo;s {micros.entries} {micros.entries === 1 ? "entry" : "entries"}. Only
            some foods in the database list these, so treat the totals as a lower bound, not a full count.
          </p>
        </details>
      ) : null}

      {logs.length === 0 && date === today ? (
        <p className="mt-6 border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
          Start with whatever you ate most recently. After a few days, the foods you eat often
          appear first and take one tap to log again.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-5">
        {MEALS.map((meal) => (
          <MealList
            key={meal}
            meal={meal}
            title={MEAL_TITLES[meal]}
            date={date}
            copyFrom={before[meal] > 0 ? dayBefore : null}
            entries={logs
              .filter((l) => l.meal === meal)
              .map((l) => ({ id: l.id, name: l.name, brand: l.brand, quantityG: l.quantityG, kcal: l.kcal, proteinG: l.proteinG }))}
          />
        ))}
        {targets ? <Water date={date} ml={waterMl} targetMl={targets.waterMl} units={viewer.profile.unitSystem} /> : null}
      </div>

      <p className="mt-8 border-t border-rule pt-4">
        <Link href="/food/week" className="font-medium underline underline-offset-4">
          This week and trends
        </Link>
      </p>
    </Section>
  );
}
