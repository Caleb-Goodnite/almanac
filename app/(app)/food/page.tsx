import type { Metadata } from "next";
import Link from "next/link";
import { DateNav } from "@/components/food/date-nav";
import { DaySummary } from "@/components/food/day-summary";
import { MealList } from "@/components/food/meal-list";
import { Water } from "@/components/food/water";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getFoodLogs, getWaterMl, MEALS, sumTotals } from "@/lib/data/food-logs";
import { getTargets } from "@/lib/data/profile";
import { fmtDate } from "@/lib/format";
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

  const [logs, waterMl, targets] = await Promise.all([
    getFoodLogs(viewer.userId, date),
    getWaterMl(viewer.userId, date),
    getTargets(viewer.userId, date),
  ]);
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
