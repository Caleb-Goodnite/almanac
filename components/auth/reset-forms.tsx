"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return setError("Enter your email address.");
    setPending(true);
    setError(null);
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (res.error?.status === 429) return setError("Too many requests. Wait a few minutes and try again.");
    // The same message whether or not the address has an account.
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status">
        <h1 className="display text-3xl">Check your email</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          If that address has an Almanac account, a link to choose a new password is on its way.
          It works for one hour. If nothing arrives, check your spam folder.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/sign-in" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-3xl">Reset your password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Enter the email you signed up with and we will send you a link. If you signed up with
        Google, sign in with Google instead; there is no password to reset.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required error={error ?? undefined} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 10) return setError("Use a password of at least 10 characters.");
    if (password !== String(form.get("confirm") ?? "")) return setError("Those two passwords do not match.");
    setPending(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    if (res.error) {
      setPending(false);
      return setError(
        res.error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "That link has expired or was already used. Request a new one.",
      );
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <div>
      <h1 className="display text-3xl">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." />
        <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" required error={error ?? undefined} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
