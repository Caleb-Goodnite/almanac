import type { Metadata } from "next";
import Link from "next/link";
import { leaveSupportModeAction } from "./actions";
import { ChangePassword } from "@/components/settings/change-password";
import { DangerZone } from "@/components/settings/danger-zone";
import { GuardianLock } from "@/components/settings/guardian-lock";
import { ProfileForm } from "@/components/settings/profile-form";
import { SignOutButton } from "@/components/shell/sign-out";
import { Button, buttonClass } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireViewer } from "@/lib/auth/session";
import { getGuardianStatus } from "@/lib/data/guardian";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const p = viewer.profile;
  const guardian = viewer.isTeen ? await getGuardianStatus(viewer.userId) : null;

  return (
    <div className="flex flex-col gap-12">
      <Section as="h1" kicker="Settings" title="Your plan">
        {p.supportMode ? (
          <div className="mb-8 border-l-2 border-accent py-1 pl-3">
            <p className="leading-relaxed">
              Your targets are set to maintain your weight for now, and weight tracking is
              turned down. <Link href="/support" className="underline underline-offset-4">Support resources</Link>
            </p>
            {viewer.isTeen ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                This stays on for now. A parent, guardian or your doctor is the right person to
                talk to about changing it, and everything else in Almanac keeps working.
              </p>
            ) : (
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
            )}
          </div>
        ) : null}
        <ProfileForm
          isTeen={viewer.isTeen}
          canLoseFat={!viewer.isTeen || guardian?.state === "approved"}
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

      {guardian ? (
        <Section id="guardian" title="Fat-loss goal">
          <GuardianLock
            available={features.guardianApproval}
            status={
              guardian.state === "pending"
                ? { state: "pending", sentTo: guardian.sentTo, expires: guardian.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric" }) }
                : guardian.state === "approved"
                  ? { state: "approved", by: guardian.by, on: guardian.at.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) }
                  : { state: guardian.state }
            }
          />
        </Section>
      ) : null}

      <Section title="Appearance">
        <ThemeToggle />
      </Section>

      <Section title="Account">
        <ChangePassword />
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
