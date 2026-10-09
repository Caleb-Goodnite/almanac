import type { Metadata } from "next";
import { Barbell, BowlFood, Heartbeat, Scales } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { after } from "next/server";
import { AiReview } from "@/components/dashboard/ai-review";
import { DaySummary } from "@/components/food/day-summary";
import { Water } from "@/components/food/water";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { listSleep } from "@/lib/data/body";
import { getFoodLogs, getWaterMl, sumTotals } from "@/lib/data/food-logs";
import { buildSnapshot, maybeUpdateAdaptiveTargets } from "@/lib/data/snapshot";
import { getActiveWorkout, listRoutines, listWorkouts } from "@/lib/data/training";
import { fmt, fmtDate, fmtDuration } from "@/lib/format";
import { weeklyReview } from "@/lib/insights/weekly";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const viewer = await requireViewer();
  const { userId, profile } = viewer;
  const today = todayIn(profile.timezone);

  const [snapshot, logs, waterMl, active, todaysWorkouts, routines, sleep] = await Promise.all([
    buildSnapshot(viewer),
    getFoodLogs(userId, today),
    getWaterMl(userId, today),
    getActiveWorkout(userId),
    listWorkouts(userId, today, today),
    listRoutines(userId),
    listSleep(userId, today, today),
  ]);

  // Refresh the adaptive estimate after the response is sent. It runs at most weekly.
  after(() => maybeUpdateAdaptiveTargets(userId, snapshot).catch(() => undefined));

  const targets = snapshot.targets;
  const totals = sumTotals(logs);
  const neutral = viewer.isTeen || profile.supportMode;
  const done = todaysWorkouts.filter((w) => w.endedAt);
  const lastNight = sleep[0];
  const review = weeklyReview(snapshot);

  const quick = [
    { href: "/food/add", label: "Log food", Icon: BowlFood },
    { href: active ? `/train/workout/${active.id}` : "/train", label: active ? "Resume workout" : "Train", Icon: Barbell },
    { href: "/body", label: "Check in", Icon: Heartbeat },
    { href: "/body#weight", label: "Weigh in", Icon: Scales },
  ];

  return (
    <div className="flex flex-col gap-12">
      <Section as="h1" kicker={fmtDate(today, { weekday: "long", month: "long", day: "numeric" })} title={viewer.firstName ? `Today, ${viewer.firstName}` : "Today"}>
        <nav aria-label="Quick actions" className="mb-8 grid grid-cols-4 gap-2">
          {quick.map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[3px] border border-rule-strong px-1 text-center text-xs font-medium hover:border-ink hover:bg-paper-raised active:translate-y-px"
            >
              <Icon aria-hidden size={22} weight="light" />
              {label}
            </Link>
          ))}
        </nav>

        {profile.supportMode ? (
          <p className="mb-6 border-l-2 border-accent py-1 pl-3 leading-relaxed">
            Targets are set to maintain for now. If food or your body has been on your mind a
            lot,{" "}
            <Link href="/support" className="underline underline-offset-4">
              there are people who can help
            </Link>
            .
          </p>
        ) : null}

        {targets ? (
          <Link href="/food" aria-label="Open food log" className="block rounded-[3px] hover:bg-paper-raised">
            <DaySummary totals={totals} targets={targets} neutral={neutral} />
          </Link>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-rule pt-6 sm:grid-cols-3">
          <div>
            <dt className="label">Training</dt>
            <dd className="mt-1">
              {active ? (
                <Link href={`/train/workout/${active.id}`} className="font-display text-xl underline underline-offset-4">
                  {active.name}, in progress
                </Link>
              ) : done.length > 0 ? (
                <Link href={`/train/workout/${done[0]!.id}`} className="font-display text-xl underline underline-offset-4">
                  {done[0]!.name}, {done[0]!.sets} sets done
                </Link>
              ) : (
                <Link href="/train" className="font-display text-xl underline underline-offset-4">
                  {routines[0] ? `Start ${routines[0].name}` : "Nothing yet"}
                </Link>
              )}
            </dd>
          </div>
          <div>
            <dt className="label">Sleep last night</dt>
            <dd className="nums mt-1 font-display text-xl">
              {lastNight ? (
                fmtDuration(lastNight.durationMin)
              ) : (
                <Link href="/body" className="underline underline-offset-4">
                  Log it
                </Link>
              )}
            </dd>
          </div>
          <div>
            <dt className="label">Days logged</dt>
            <dd className="nums mt-1 font-display text-xl">
              {snapshot.logging.daysLogged7} of 7
              {snapshot.logging.currentRun >= 2 ? (
                <span className="ml-2 font-sans text-sm text-ink-soft">{snapshot.logging.currentRun} in a row</span>
              ) : null}
            </dd>
          </div>
        </dl>

        {targets ? (
          <div className="mt-6">
            <Water date={today} ml={waterMl} targetMl={targets.waterMl} units={profile.unitSystem} />
          </div>
        ) : null}
      </Section>

      <Section kicker="Last 7 days" title="Weekly review" aside={<Link href="/trends" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">All trends</Link>}>
        <AiReview initial={review} weekKey={today} />
        {snapshot.adaptive?.ok ? (
          <p className="nums mt-5 border-t border-rule pt-4 text-sm leading-relaxed text-ink-soft">
            From your own food and weight data, you burn about {fmt(snapshot.adaptive.observedKcal)} kcal a day
            ({snapshot.adaptive.confidence} confidence, {snapshot.adaptive.loggedDays} logged days).{" "}
            <Link href="/research#adaptive" className="text-ink underline underline-offset-4">
              How this works
            </Link>
          </p>
        ) : snapshot.adaptive ? (
          <p className="mt-5 border-t border-rule pt-4 text-sm leading-relaxed text-ink-soft">
            Your calorie target is still a formula estimate. It switches to one based on your
            own data after two weeks of logging: {snapshot.adaptive.reason.toLowerCase()}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
