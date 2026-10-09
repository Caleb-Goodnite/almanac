import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { firstWeightDate, listSleep, listWeights } from "@/lib/data/body";
import { getDailyTotals } from "@/lib/data/food-logs";
import { getTargets } from "@/lib/data/profile";
import { listWorkouts } from "@/lib/data/training";
import { fmt, fmtDuration, weightUnit, weightValue } from "@/lib/format";
import { addDays, dayNumber, mean, movingAverage } from "@/lib/science/trend";
import { todayIn } from "@/lib/time";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Trends" };

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-rule py-8 text-center text-sm text-ink-soft">{children}</p>;
}

export default async function TrendsPage({ searchParams }: PageProps<"/trends">) {
  const viewer = await requireViewer();
  const { userId } = viewer;
  const units = viewer.profile.unitSystem;
  const today = todayIn(viewer.profile.timezone);
  const requested = (await searchParams).range;
  const range = RANGES.find((r) => r.key === requested) ?? RANGES[1];

  let from = range.days ? addDays(today, -(range.days - 1)) : today;
  if (!range.days) {
    // "All time" starts at the first weigh-in, which is recorded at onboarding.
    from = (await firstWeightDate(userId)) ?? addDays(today, -29);
    if (dayNumber(today) - dayNumber(from) < 6) from = addDays(today, -6);
  }
  const days = dayNumber(today) - dayNumber(from) + 1;
  const window = days <= 10 ? 3 : 7;

  const [weights, food, sleep, workouts, targets] = await Promise.all([
    listWeights(userId, from, today),
    getDailyTotals(userId, from, today),
    listSleep(userId, from, today),
    listWorkouts(userId, from, today),
    getTargets(userId, today),
  ]);

  const quiet = viewer.isTeen || viewer.profile.supportMode;
  const w = weights.map((r) => ({ date: r.date, value: weightValue(r.kg, units) }));
  const wTrend = movingAverage(w, 7);
  const first = wTrend[0]?.value;
  const last = wTrend[wTrend.length - 1]?.value;
  const change = first != null && last != null ? last - first : null;
  const u = weightUnit(units);

  const kcal = food.map((d) => ({ date: d.date, value: d.kcal }));
  const protein = food.map((d) => ({ date: d.date, value: d.proteinG }));
  const sleepPts = sleep.map((s) => ({ date: s.date, value: s.durationMin / 60 }));
  const kcalAvg = mean(kcal.map((p) => p.value));
  const proteinAvg = mean(protein.map((p) => p.value));
  const sleepAvg = mean(sleep.map((s) => s.durationMin));
  const sessions = workouts.filter((x) => x.endedAt).length;
  const perWeek = sessions / (days / 7);

  return (
    <Section
      as="h1"
      kicker="Trends"
      title={range.label}
      aside={
        <Link href="/today" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      <nav aria-label="Time range" className="mb-10 flex gap-1.5 overflow-x-auto">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/trends?range=${r.key}`}
            aria-current={r.key === range.key ? "true" : undefined}
            className={cn("nums min-h-11 shrink-0 content-center rounded-[3px] border px-4 text-sm", r.key === range.key ? "border-ink bg-ink font-semibold text-paper" : "border-rule-strong")}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-12">
        <section aria-labelledby="t-weight">
          <h2 id="t-weight" className="font-display text-2xl">
            Weight
          </h2>
          <p className="nums mt-1 max-w-prose leading-relaxed text-ink-soft">
            {w.length < 2
              ? "Not enough weigh-ins in this period to show a trend."
              : quiet || change == null
                ? `${w.length} weigh-ins in this period.`
                : Math.abs(change) < 0.2
                  ? `Your trend weight held steady at about ${fmt(last ?? 0, 1)} ${u}.`
                  : `Your trend weight went ${change < 0 ? "down" : "up"} ${fmt(Math.abs(change), 1)} ${u}, from ${fmt(first ?? 0, 1)} to ${fmt(last ?? 0, 1)}.`}
          </p>
          <div className="mt-3">
            {w.length < 2 ? (
              <Empty>Weigh in a few times and the trend line will appear here.</Empty>
            ) : (
              <LineChart points={w} trend={wTrend} unit={u} decimals={1} valueLabel="Weight" from={from} to={today} summary={`Weight over ${range.label.toLowerCase()}, with a 7-day average line.`} />
            )}
          </div>
        </section>

        <section aria-labelledby="t-kcal">
          <h2 id="t-kcal" className="font-display text-2xl">
            Calories
          </h2>
          <p className="nums mt-1 max-w-prose leading-relaxed text-ink-soft">
            {kcalAvg == null
              ? "No food logged in this period."
              : `You averaged ${fmt(kcalAvg)} kcal across ${food.length} logged ${food.length === 1 ? "day" : "days"}${targets ? `, against a target of ${fmt(targets.calories)}` : ""}.`}
          </p>
          <div className="mt-3">
            {kcal.length < 2 ? (
              <Empty>Log food on two or more days to see the trend.</Empty>
            ) : (
              <LineChart
                points={kcal}
                trend={movingAverage(kcal, window)}
                reference={targets ? { value: targets.calories, label: "Target" } : undefined}
                unit="kcal"
                valueLabel="Calories"
                from={from}
                to={today}
                summary={`Daily calories over ${range.label.toLowerCase()} with a ${window}-day average line.`}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="t-protein">
          <h2 id="t-protein" className="font-display text-2xl">
            Protein
          </h2>
          <p className="nums mt-1 max-w-prose leading-relaxed text-ink-soft">
            {proteinAvg == null
              ? "No food logged in this period."
              : `You averaged ${fmt(proteinAvg)} g a day${targets ? `, against a target of ${fmt(targets.proteinG)} g` : ""}.`}
          </p>
          <div className="mt-3">
            {protein.length < 2 ? (
              <Empty>Log food on two or more days to see the trend.</Empty>
            ) : (
              <LineChart
                points={protein}
                trend={movingAverage(protein, window)}
                reference={targets ? { value: targets.proteinG, label: "Target" } : undefined}
                unit="g"
                valueLabel="Protein"
                from={from}
                to={today}
                height={160}
                summary={`Daily protein over ${range.label.toLowerCase()} with a ${window}-day average line.`}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="t-sleep">
          <h2 id="t-sleep" className="font-display text-2xl">
            Sleep
          </h2>
          <p className="nums mt-1 max-w-prose leading-relaxed text-ink-soft">
            {sleepAvg == null
              ? "No sleep logged in this period."
              : `You averaged ${fmtDuration(sleepAvg)} a night over ${sleep.length} ${sleep.length === 1 ? "night" : "nights"}${
                  targets ? (sleepAvg >= targets.sleepMinMinutes ? ", inside the range for your age." : `, under the ${targets.sleepMinMinutes / 60} hour minimum for your age.`) : "."
                }`}
          </p>
          <div className="mt-3">
            {sleepPts.length < 2 ? (
              <Empty>Log two or more nights to see the trend.</Empty>
            ) : (
              <LineChart
                points={sleepPts}
                trend={movingAverage(sleepPts, window)}
                band={targets ? { min: targets.sleepMinMinutes / 60, max: targets.sleepMaxMinutes / 60, label: "Target range" } : undefined}
                unit="h"
                decimals={1}
                valueLabel="Hours slept"
                from={from}
                to={today}
                height={160}
                summary={`Hours slept per night over ${range.label.toLowerCase()} with a ${window}-night average line.`}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="t-train">
          <h2 id="t-train" className="font-display text-2xl">
            Training
          </h2>
          <p className="nums mt-1 max-w-prose leading-relaxed text-ink-soft">
            {sessions === 0
              ? "No strength sessions logged in this period."
              : `${sessions} strength ${sessions === 1 ? "session" : "sessions"}, about ${fmt(perWeek, 1)} a week.`}{" "}
            <Link href="/train" className="text-ink underline underline-offset-4">
              See sets by muscle
            </Link>
          </p>
        </section>
      </div>
    </Section>
  );
}
