import type { Metadata } from "next";
import { SupportCard } from "@/components/safety/support-card";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const viewer = await requireViewer();
  return (
    <Section as="h1" kicker="You are not alone" title="Support">
      <SupportCard isTeen={viewer.isTeen} />
    </Section>
  );
}
