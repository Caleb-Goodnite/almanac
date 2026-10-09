import type { Metadata } from "next";
import Link from "next/link";
import { leaveSupportModeAction } from "./actions";
import { DangerZone } from "@/components/settings/danger-zone";
import { ProfileForm } from "@/components/settings/profile-form";
import { SignOutButton } from "@/components/shell/sign-out";
import { Button, buttonClass } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const p = viewer.profile;

  return (
    <div className="flex flex-col gap-12">
      <Section as="h1" kicker="Settings" title="Your plan">
        {p.supportMode ? (
          <div className="mb-8 border-l-2 border-accent py-1 pl-3">
            <p className="leading-relaxed">
              Your targets are set to maintain your weight for now, and weight tracking is
              turned down. <Link href="/support" className="underline underline-offset-4">Support resources</Link>
            </p>
            <form
              action={async () => {
                "use server";
                await leaveSupportModeAction();
              }}
              className="mt-2"
            >
              <Button type="submit" variant="quiet">
                Go back to my usual targets
              </Button>
            </form>
          </div>
        ) : null}
        <ProfileForm
          isTeen={viewer.isTeen}
          initial={{
            sex: p.sex,
            heightCm: p.heightCm,
            unitSystem: p.unitSystem,
            goal: p.goal,
            activityLevel: p.activityLevel,
            resistanceTraining: p.resistanceTraining,
            weeklyRatePct: p.weeklyRatePct,
          }}
        />
      </Section>

      <Section title="Appearance">
        <ThemeToggle />
      </Section>

      <Section title="Your data">
        <p className="max-w-prose leading-relaxed text-ink-soft">
          Everything you have logged belongs to you. Download a complete copy at any time, or
          delete your account and all of it for good.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/account/export" download className={buttonClass("outline")}>
            Download my data (JSON)
          </a>
          <SignOutButton />
        </div>
        <div className="mt-8">
          <DangerZone />
        </div>
      </Section>

      <Section title="Help">
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/support" className="underline underline-offset-4">
              Support with food, exercise or body image
            </Link>
          </li>
          <li>
            <Link href="/research" className="underline underline-offset-4">
              The research behind the numbers
            </Link>
          </li>
        </ul>
      </Section>
    </div>
  );
}
