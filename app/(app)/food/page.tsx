import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Food" };

export default async function Page() {
  await requireViewer();
  return (
    <Section as="h1" title="Food">
      <p className="text-ink-soft">Meal logging arrives in the next build phase.</p>
    </Section>
  );
}
