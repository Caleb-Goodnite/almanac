import type { Metadata } from "next";
import Link from "next/link";
import { RoutineBuilder } from "@/components/train/routine-builder";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New routine" };

export default async function NewRoutinePage() {
  await requireViewer();
  return (
    <Section
      as="h1"
      kicker="Training"
      title="New routine"
      aside={
        <Link href="/train" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      <RoutineBuilder />
    </Section>
  );
}
