"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

/** Permanent account deletion. Every row the user owns is removed by cascade. */
export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form
      className="flex max-w-md flex-col gap-4 border-l-2 border-accent pl-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await authClient.deleteUser(password ? { password } : {});
        if (res.error) {
          setPending(false);
          setError(
            res.error.code === "SESSION_EXPIRED" || res.error.status === 400
              ? password
                ? "That password is not right."
                : "For safety, sign out and back in, then delete your account within a day. If you signed up with a password, enter it above."
              : (res.error.message ?? "Could not delete your account. Try again."),
          );
          return;
        }
        router.push("/");
        router.refresh();
      }}
    >
      <p className="leading-relaxed">
        This permanently deletes your account and everything in it: food, workouts, weight,
        sleep and coach conversations. It cannot be undone. Download your data first if you
        want a copy.
      </p>
      <Field label="Password (if you signed up with one)" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Field label="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      {error ? (
        <p role="alert" className="text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" disabled={pending || confirm.trim().toUpperCase() !== "DELETE"}>
          {pending ? "Deleting…" : "Delete everything"}
        </Button>
      </div>
    </form>
  );
}
