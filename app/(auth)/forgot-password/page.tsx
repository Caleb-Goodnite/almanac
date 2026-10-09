import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/reset-forms";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  if (!features.passwordReset) {
    return (
      <div>
        <h1 className="display text-3xl">Password reset is not set up yet</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          This site cannot send email at the moment, so it cannot send a reset link.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/sign-in" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }
  return <ForgotPasswordForm />;
}
