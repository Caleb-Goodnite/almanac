import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Train" };

export default async function Page() {
  await requireViewer();
  return (
    <Section as="h1" title="Train">
      <p className="text-ink-soft">Workout logging arrives in the next build phase.</p>
    </Section>
  );
}
