import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-forms";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  if (!token || params.error) {
    return (
      <div>
        <h1 className="display text-3xl">That link no longer works</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Reset links work once and expire after an hour. Request a new one and use it straight away.
        </p>
        <p className="mt-6">
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            Send a new link
          </Link>
        </p>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
