import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getTargets } from "@/lib/data/profile";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const viewer = await requireViewer();
  const today = todayIn(viewer.profile.timezone);
  const targets = await getTargets(viewer.userId, today);

  return (
    <Section as="h1" kicker={new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })} title="Today">
      {targets ? (
        <p className="text-ink-soft">
          Target: <span className="nums text-ink">{targets.calories.toLocaleString("en-US")}</span> kcal,{" "}
          <span className="nums text-ink">{targets.proteinG}</span> g protein.
        </p>
      ) : null}
    </Section>
  );
}
