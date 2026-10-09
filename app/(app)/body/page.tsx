import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Body" };

export default async function Page() {
  await requireViewer();
  return (
    <Section as="h1" title="Body">
      <p className="text-ink-soft">Weight, sleep and check-ins arrive in a later build phase.</p>
    </Section>
  );
}
