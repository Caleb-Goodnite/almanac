"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-up" | "sign-in";

function messageFor(code: string | undefined, fallback: string | undefined, mode: Mode): string {
  switch (code) {
    case "REGION_UNAVAILABLE":
      return "Almanac is not available in your country yet.";
    case "AGE_REQUIRED":
      return "Please confirm your date of birth first.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with that email already exists. Try signing in.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password do not match.";
    case "PASSWORD_TOO_SHORT":
      return "Use a password of at least 10 characters.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    default:
      return fallback ?? (mode === "sign-up" ? "We could not create your account. Try again." : "We could not sign you in. Try again.");
  }
}

export function AccountForm({ mode, google, passwordReset = false }: { mode: Mode; google: boolean; passwordReset?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (mode === "sign-up" && password.length < 10) {
      setError("Use a password of at least 10 characters.");
      return;
    }

    setPending(true);
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setPending(false);
      if (result.error.status === 429) {
        setError("Too many attempts. Wait a minute and try again.");
      } else {
        setError(messageFor(result.error.code, result.error.message, mode));
      }
      return;
    }
    router.push(mode === "sign-up" ? "/welcome" : "/today");
    router.refresh();
  }

  async function withGoogle() {
    setPending(true);
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: mode === "sign-up" ? "/welcome" : "/today",
      errorCallbackURL: "/sign-up",
    });
  }

  return (
    <div>
      <h1 className="display text-3xl">{mode === "sign-up" ? "Create your account" : "Welcome back"}</h1>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        {mode === "sign-up" ? (
          <Field label="First name" name="name" autoComplete="given-name" required maxLength={60} />
        ) : null}
        <Field label="Email" name="email" type="email" autoComplete="email" required inputMode="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={mode === "sign-up" ? 10 : undefined}
          hint={mode === "sign-up" ? "At least 10 characters." : undefined}
        />

        {mode === "sign-in" && passwordReset ? (
          <p className="-mt-2 text-sm">
            <Link href="/forgot-password" className="text-ink-soft underline underline-offset-4 hover:text-ink">
              Forgot your password?
            </Link>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-accent-strong">
            <span aria-hidden>! </span>
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "One moment…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>

      {google ? (
        <Button variant="outline" size="lg" className="mt-3 w-full" onClick={withGoogle} disabled={pending}>
          Continue with Google
        </Button>
      ) : null}

      {mode === "sign-up" ? (
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>{" "}
          pages. Almanac is currently available in the United States only.
        </p>
      ) : null}

      <p className="mt-6 text-sm text-ink-soft">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="text-ink underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
