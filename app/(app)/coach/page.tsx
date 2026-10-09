import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Coach" };

export default async function Page() {
  await requireViewer();
  return (
    <Section as="h1" title="Coach">
      <p className="text-ink-soft">The coach arrives in a later build phase.</p>
    </Section>
  );
}
