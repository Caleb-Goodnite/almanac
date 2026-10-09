import type { Metadata } from "next";
import Link from "next/link";
import { CardioForm } from "@/components/train/cardio-form";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getLatestWeight } from "@/lib/data/profile";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Log activity" };

export default async function CardioPage() {
  const viewer = await requireViewer();
  const weight = await getLatestWeight(viewer.userId);
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
      <CardioForm date={todayIn(viewer.profile.timezone)} weightKg={weight?.kg ?? null} units={viewer.profile.unitSystem} />
    </Section>
  );
}
