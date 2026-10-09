import type { Metadata } from "next";
import Link from "next/link";
import { CardioForm } from "@/components/train/cardio-form";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { listCheckins } from "@/lib/data/body";
import { getLatestWeight } from "@/lib/data/profile";
import { addDays, mean } from "@/lib/science/trend";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Log activity" };

export default async function CardioPage() {
  const viewer = await requireViewer();
  const today = todayIn(viewer.profile.timezone);
  const [weight, checkins] = await Promise.all([
    getLatestWeight(viewer.userId),
    listCheckins(viewer.userId, addDays(today, -13), today),
  ]);
  const resting = mean(checkins.map((c) => c.restingHr).filter((v): v is number => v != null));
  return (
    <Section
      as="h1"
      kicker="Today"
      title="Log cardio or sport"
      aside={
        <Link href="/train" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      <CardioForm
        date={today}
        weightKg={weight?.kg ?? null}
        units={viewer.profile.unitSystem}
        ageYears={viewer.ageYears}
        restingHr={resting == null ? null : Math.round(resting)}
      />
    </Section>
  );
}
