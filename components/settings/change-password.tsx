"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

/** Change password for accounts that have one. Other devices are signed out when it changes. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("current") ?? "");
    const newPassword = String(form.get("new") ?? "");
    if (newPassword.length < 10) return setError("Use a new password of at least 10 characters.");
    if (newPassword === currentPassword) return setError("The new password is the same as the current one.");
    setPending(true);
    setError(null);
    const res = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);
    if (res.error) {
      return setError(
        res.error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : res.error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND"
            ? "This account signs in with Google, so it has no password to change."
            : "That current password is not right.",
      );
    }
    setDone(true);
    setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => { setOpen(true); setDone(false); }}>
          Change password
        </Button>
        <p role="status" className="mt-2 text-sm text-ink-soft">
          {done ? "Password changed. Your other devices have been signed out." : ""}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Field label="New password" name="new" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." error={error ?? undefined} />
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </div>
    </form>
  );
}
