import type { Metadata } from "next";
import { SignOutButton } from "@/components/shell/sign-out";
import { Section } from "@/components/ui/section";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireViewer();
  return (
    <Section as="h1" title="Settings">
      <div className="flex flex-col items-start gap-4">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </Section>
  );
}
