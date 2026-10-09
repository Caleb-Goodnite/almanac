import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wizard } from "@/components/onboarding/wizard";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const viewer = await requireViewer({ allowNotOnboarded: true });
  if (viewer.profile.onboardedAt) redirect("/today");

  return (
    <main id="main" className="mx-auto w-full max-w-xl flex-1 px-5 py-8 sm:py-14">
      <Wizard firstName={viewer.firstName} isTeen={viewer.isTeen} />
    </main>
  );
}
