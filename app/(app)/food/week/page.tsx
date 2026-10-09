import type { Metadata } from "next";
import Link from "next/link";
import { DayBars } from "@/components/charts/day-bars";
import { LineChart } from "@/components/charts/line-chart";
import { Section } from "@/components/ui/section";
import { Why } from "@/components/ui/why";
import { requireViewer } from "@/lib/auth/session";
import { getDailyTotals } from "@/lib/data/food-logs";
import { getTargets } from "@/lib/data/profile";
import { fmt } from "@/lib/format";
import { nutritionInsights } from "@/lib/insights/nutrition";
import { addDays, mean, movingAverage } from "@/lib/science/trend";
import { todayIn } from "@/lib/time";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Food trends" };

const RANGES = [30, 90] as const;

export default async function FoodWeekPage({ searchParams }: PageProps<"/food/week">) {
  const viewer = await requireViewer();
  const today = todayIn(viewer.profile.timezone);
  const rangeParam = Number((await searchParams).range);
  const range = RANGES.find((r) => r === rangeParam) ?? 30;

  const weekStart = addDays(today, -6);
  const rangeStart = addDays(today, -(range - 1));
  const [days, targets] = await Promise.all([
    getDailyTotals(viewer.userId, rangeStart, today),
    getTargets(viewer.userId, today),
  ]);
  if (!targets) return null;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDays = days.filter((d) => d.date >= weekStart);
  const neutral = viewer.isTeen || viewer.profile.supportMode;
  const insights = nutritionInsights(weekDays, targets, 7, { neutral });

  const avg = (pick: (d: (typeof days)[number]) => number) => mean(weekDays.map(pick));
  const rows = [
    { label: "Calories", value: avg((d) => d.kcal), target: targets.calories, unit: "kcal" },
    { label: "Protein", value: avg((d) => d.proteinG), target: targets.proteinG, unit: "g" },
    { label: "Carbohydrate", value: avg((d) => d.carbsG), target: targets.carbsG, unit: "g" },
    { label: "Fat", value: avg((d) => d.fatG), target: targets.fatG, unit: "g" },
    { label: "Fiber", value: avg((d) => d.fiberG), target: targets.fiberG, unit: "g" },
  ];

  const kcalPoints = days.map((d) => ({ date: d.date, value: d.kcal }));
  const smoothed = movingAverage(kcalPoints, 7);

  return (
    <Section
      as="h1"
      kicker="Food"
      title="This week"
      aside={
        <Link href="/food" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      <ul className="flex flex-col gap-3">
        {insights.map((i) => (
          <li
            key={i.text}
            className={cn("border-l-2 py-0.5 pl-3 leading-relaxed", i.tone === "note" ? "border-accent" : i.tone === "good" ? "border-good" : "border-rule-strong")}
          >
            <span className="sr-only">{i.tone === "note" ? "Worth a look: " : i.tone === "good" ? "Going well: " : ""}</span>
            {i.text}
          </li>
        ))}
      </ul>

      <h2 className="label mt-10 mb-3">Calories, last 7 days</h2>
      <DayBars
        days={week.map((date) => ({ date, value: byDate.get(date)?.kcal ?? null }))}
        target={targets.calories}
        unit="kcal"
        today={today}
        summary={`Calories for each of the last 7 days against a target of ${fmt(targets.calories)}. ${weekDays.length} of 7 days have food logged.`}
      />

      <h2 className="label mt-10 mb-1">Daily averages, {weekDays.length} logged {weekDays.length === 1 ? "day" : "days"}</h2>
      <table className="nums w-full text-left">
        <thead className="sr-only">
          <tr>
            <th scope="col">Nutrient</th>
            <th scope="col">Average</th>
            <th scope="col">Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-rule">
              <th scope="row" className="py-2.5 font-medium">
                {r.label}
              </th>
              <td className="py-2.5 text-right font-display text-xl">{r.value == null ? "–" : fmt(r.value)}</td>
              <td className="w-32 py-2.5 text-right text-sm text-ink-soft">
                of {fmt(r.target)} {r.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1">
        <Why label="Why averages, not single days?" source="adherence">
          One day tells you very little: intake and weight both swing from day to day. The weekly
          average is what your body responds to.
        </Why>
      </div>

      <div className="mt-10 flex items-end justify-between gap-3">
        <h2 className="label">Calorie trend, {range} days</h2>
        <nav aria-label="Trend range" className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/food/week?range=${r}`}
              aria-current={r === range ? "true" : undefined}
              className={cn("nums min-h-9 content-center rounded-[3px] border px-3 text-sm", r === range ? "border-ink bg-ink font-semibold text-paper" : "border-rule-strong")}
            >
              {r} days
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-3">
        {kcalPoints.length < 2 ? (
          <p className="border-y border-rule py-8 text-center text-sm text-ink-soft">
            The trend line appears once you have logged food on two or more days.
          </p>
        ) : (
          <LineChart
            points={kcalPoints}
            trend={smoothed}
            reference={{ value: targets.calories, label: "Target" }}
            unit="kcal"
            valueLabel="Calories"
            from={rangeStart}
            to={today}
            summary={`Daily calories over the last ${range} days with a 7-day moving average. ${kcalPoints.length} days are logged.`}
          />
        )}
        <p className="mt-2 text-sm text-ink-soft">Dots are single days. The line is the 7-day average, which smooths out day-to-day noise.</p>
      </div>
    </Section>
  );
}
