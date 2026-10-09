import type { Metadata } from "next";
import Link from "next/link";
import { CheckIn } from "@/components/body/checkin";
import { HealthImport } from "@/components/body/health-import";
import { WeightHistory } from "@/components/body/weight-history";
import { DateNav } from "@/components/food/date-nav";
import { MeasurementForm, SITE_LABELS } from "@/components/body/measurement-form";
import { SleepForm } from "@/components/body/sleep-form";
import { WeightForm } from "@/components/body/weight-form";
import { LineChart } from "@/components/charts/line-chart";
import { Section } from "@/components/ui/section";
import { Why } from "@/components/ui/why";
import { requireViewer } from "@/lib/auth/session";
import { latestMeasurements, listCheckins, listSleep, listWeights } from "@/lib/data/body";
import { getTargets } from "@/lib/data/profile";
import { fmt, fmtDate, fmtDuration, fmtWeight, weightUnit, weightValue } from "@/lib/format";
import { rateOfChangeWarning } from "@/lib/science/targets";
import { addDays, linearRegression, mean, movingAverage } from "@/lib/science/trend";
import { cmToIn } from "@/lib/science/units";
import { todayIn } from "@/lib/time";
import { dateSchema } from "@/lib/validation/food";

export const metadata: Metadata = { title: "Body" };

export default async function BodyPage({ searchParams }: PageProps<"/body">) {
  const viewer = await requireViewer();
  const { userId } = viewer;
  const units = viewer.profile.unitSystem;
  const today = todayIn(viewer.profile.timezone);
  // Any past day can be filled in or corrected; future days cannot.
  const requested = dateSchema.safeParse((await searchParams).date);
  const date = requested.success && requested.data <= today ? requested.data : today;
  const isToday = date === today;
  const from = addDays(today, -89);

  const [weights, sleep, checkins, measures, targets] = await Promise.all([
    listWeights(userId, from, today),
    listSleep(userId, addDays(today, -29), today),
    listCheckins(userId, date, date),
    latestMeasurements(userId),
    getTargets(userId, today),
  ]);

  // Weight is shown gently for under-18s and anyone in support mode: optional, no rate.
  const quiet = viewer.isTeen || viewer.profile.supportMode;

  const points = weights.map((w) => ({ date: w.date, value: weightValue(w.kg, units) }));
  const smoothed = movingAverage(points, 7);
  const kgPoints = weights.map((w) => ({ date: w.date, value: w.kg }));
  const recent = kgPoints.filter((p) => p.date >= addDays(today, -27));
  const fit = recent.length >= 4 ? linearRegression(recent) : null;
  const latest = weights[weights.length - 1];
  const todayWeight = weights.find((w) => w.date === date);
  const slope = fit ? fit.slopePerDay * 7 : null;
  const warning = slope != null && latest ? rateOfChangeWarning(slope, latest.kg, viewer.isTeen) : null;
  const avg7 = smoothed[smoothed.length - 1]?.value;

  const lastNight = sleep.find((s) => s.date === date) ?? (isToday ? undefined : (await listSleep(userId, date, date))[0]);
  const sleep7 = sleep.filter((s) => s.date >= addDays(today, -6));
  const sleepAvg = mean(sleep7.map((s) => s.durationMin));
  const sleepMin = targets?.sleepMinMinutes ?? 420;
  const sleepMax = targets?.sleepMaxMinutes ?? 540;
  const checkin = checkins[0] ?? null;

  return (
    <div className="flex flex-col gap-12">
      <HealthImport />
      <Section
        as="h1"
        kicker={isToday ? "Ten seconds" : fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}
        title={isToday ? "How are you today?" : "How were you that day?"}
        aside={<DateNav date={date} today={today} basePath="/body" />}
      >
        {!isToday ? (
          <p className="mb-5 border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
            You are filling in {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}. Everything on this
            page saves to that day.
          </p>
        ) : null}
        {/* Keyed by date so each day's form starts from that day's values. */}
        <CheckIn key={date} date={date} initial={checkin} />
      </Section>

      <Section kicker="Recovery" title="Sleep">
        <div className="grid gap-8 sm:grid-cols-2">
          <SleepForm key={date} date={date} label={isToday ? "Last night" : "That night"} initial={lastNight ? { durationMin: lastNight.durationMin, quality: lastNight.quality } : null} />
          <div>
            <p className="label">7-night average</p>
            <p className="nums mt-1 font-display text-4xl">{sleepAvg == null ? "–" : fmtDuration(sleepAvg)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {sleepAvg == null
                ? "Log a few nights to see your average."
                : sleepAvg >= sleepMin
                  ? `In the ${sleepMin / 60} to ${sleepMax / 60} hour range for your age.`
                  : `About ${fmtDuration(sleepMin - sleepAvg)} short of the ${sleepMin / 60} hour minimum for your age.`}
            </p>
            <Why label="Why this much sleep?" source="sleep" cite={viewer.isTeen ? "AASM 2016" : "AASM 2015"}>
              {viewer.isTeen
                ? "Teenagers need 8 to 10 hours a night. Regularly getting less is linked with worse mood, attention and health."
                : "Adults need at least 7 hours a night. Regularly getting less is linked with poorer health, recovery and appetite control."}
            </Why>
          </div>
        </div>
        {sleep.length >= 2 ? (
          <div className="mt-6">
            <LineChart
              points={sleep.map((s) => ({ date: s.date, value: s.durationMin / 60 }))}
              trend={movingAverage(sleep.map((s) => ({ date: s.date, value: s.durationMin / 60 })), 7)}
              band={{ min: sleepMin / 60, max: sleepMax / 60, label: "Target range" }}
              unit="h"
              decimals={1}
              valueLabel="Hours slept"
              from={addDays(today, -29)}
              to={today}
              height={150}
              summary={`Hours slept each night over the last 30 days with a 7-night average. The shaded band is the ${sleepMin / 60} to ${sleepMax / 60} hour target range.`}
            />
          </div>
        ) : null}
      </Section>

      <Section kicker={quiet ? "Optional" : "Trend, not single days"} title="Weight" className="scroll-mt-6" id="weight">
        {quiet ? (
          <p className="mb-5 max-w-prose text-sm leading-relaxed text-ink-soft">
            You do not have to weigh yourself to use Almanac. How you sleep, train and feel
            says more about how you are doing than a number on a scale.
          </p>
        ) : null}
        <WeightForm key={date} date={date} units={units} todayKg={todayWeight?.kg ?? null} label={isToday ? "Today’s weight" : "Weight that day"} />

        {points.length >= 2 ? (
          <>
            <dl className="nums mt-6 grid grid-cols-3 gap-4">
              <div>
                <dt className="label">7-day average</dt>
                <dd className="mt-1 font-display text-3xl">
                  {avg7 == null ? "–" : fmt(avg7, 1)}
                  <span className="label ml-1">{weightUnit(units)}</span>
                </dd>
              </div>
              <div>
                <dt className="label">Latest</dt>
                <dd className="mt-1 font-display text-3xl">{latest ? fmt(weightValue(latest.kg, units), 1) : "–"}</dd>
              </div>
              {!quiet ? (
                <div>
                  <dt className="label">Per week, 4-week trend</dt>
                  <dd className="mt-1 font-display text-3xl">
                    {slope == null ? "–" : `${slope > 0 ? "+" : slope < 0 ? "−" : ""}${fmt(Math.abs(weightValue(slope, units)), 2)}`}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5">
              <LineChart
                points={points}
                trend={smoothed}
                unit={weightUnit(units)}
                decimals={1}
                valueLabel="Weight"
                // Start the axis at the first weigh-in so a short history is not squeezed into a corner.
                from={points[0] && points[0].date > from ? points[0].date : from}
                to={today}
                summary={`Weight over the last 90 days. Dots are single weigh-ins; the line is the 7-day average, currently ${avg7 == null ? "unknown" : fmt(avg7, 1)} ${weightUnit(units)}.`}
              />
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Dots are single weigh-ins and bounce around with water and food. The line is the
              7-day average, which is the number to watch.
            </p>
          </>
        ) : (
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-ink-soft">
            Weight swings by a kilogram or more from day to day. After a few weigh-ins this
            shows a smoothed trend line so single readings stop mattering.
          </p>
        )}

        {weights.length > 0 ? (
          <WeightHistory
            units={units}
            entries={weights.slice(-10).reverse().map((w) => ({ date: w.date, kg: w.kg }))}
          />
        ) : null}

        {warning?.tooFast && latest ? (
          <div role="note" className="mt-5 border-l-2 border-accent py-1 pl-3">
            <p className="font-medium">Your weight is dropping faster than is safe to keep up.</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              The trend is about {fmt(Math.abs(warning.pctPerWeek), 1)}% of your bodyweight a week
              ({fmtWeight(Math.abs(slope ?? 0), units, 2)}). Eating a little more each day will
              protect your muscle, energy and sleep.{" "}
              <Link href="/research#rate" className="text-ink underline underline-offset-4">
                Why this limit?
              </Link>
            </p>
          </div>
        ) : null}
      </Section>

      <Section kicker="Optional" title="Measurements">
        <MeasurementForm date={date} units={units} />
        {measures.size > 0 ? (
          <ul className="nums mt-4">
            {[...measures.entries()].map(([site, m]) => {
              const v = (cm: number) => (units === "imperial" ? cmToIn(cm) : cm);
              const delta = m.previousCm == null ? null : v(m.cm) - v(m.previousCm);
              return (
                <li key={site} className="flex items-baseline justify-between border-b border-rule py-2">
                  <span className="font-medium">{SITE_LABELS[site]}</span>
                  <span>
                    {fmt(v(m.cm), 1)} {units === "imperial" ? "in" : "cm"}
                    {delta != null && Math.abs(delta) >= 0.05 ? (
                      <span className="ml-2 text-sm text-ink-soft">
                        {delta > 0 ? "up" : "down"} {fmt(Math.abs(delta), 1)} since last time
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
