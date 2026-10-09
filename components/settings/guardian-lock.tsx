"use client";

import { useState, useTransition } from "react";
import { cancelGuardianRequestAction, requestGuardianApprovalAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type Status =
  | { state: "none" | "expired" | "revoked" }
  | { state: "pending"; sentTo: string; expires: string }
  | { state: "approved"; by: string; on: string };

/** Where an under-18 asks a parent or guardian to unlock the fat-loss goal, and sees how that stands. */
export function GuardianLock({ status, available }: { status: Status; available: boolean }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (status.state === "approved") {
    return (
      <p className="max-w-prose leading-relaxed">
        Approved by {status.by} on {status.on}. You can choose &ldquo;Lose fat&rdquo; as your goal above. They can
        withdraw this at any time.
      </p>
    );
  }

  const send = (to: string) =>
    startTransition(async () => {
      const res = await requestGuardianApprovalAction({ email: to });
      setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) setEmail("");
    });

  return (
    <div className="flex max-w-prose flex-col gap-4">
      <p className="leading-relaxed text-ink-soft">
        Because you are under 18, a fat-loss goal is locked until a parent or guardian approves it. We email them a
        link, they read about the risks and decide. Even then it stays gentle, and you always eat enough to grow.
      </p>

      {status.state === "pending" ? (
        <div className="border-l-2 border-accent py-1 pl-3">
          <p className="leading-relaxed">
            Waiting for an answer. We emailed <span className="font-medium">{status.sentTo}</span>; the link works until{" "}
            {status.expires}.
          </p>
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await cancelGuardianRequestAction();
                setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
              });
            }}
          >
            <Button type="submit" variant="quiet" disabled={pending}>
              Cancel this request
            </Button>
          </form>
        </div>
      ) : null}
      {status.state === "expired" ? <p className="leading-relaxed">The last link expired without an answer. You can send a new one.</p> : null}
      {status.state === "revoked" ? (
        <p className="leading-relaxed">Your parent or guardian withdrew their approval. Talk to them before asking again.</p>
      ) : null}

      {!available ? (
        <p className="leading-relaxed">Asking for approval is not available yet.</p>
      ) : status.state !== "pending" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(email);
          }}
        >
          <Field
            label="Parent or guardian's email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="Their own address, not yours. They will see your first name."
          />
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Sending…" : "Ask for approval"}
            </Button>
          </div>
        </form>
      ) : null}

      <p role="status" className={`text-sm leading-relaxed ${result && !result.ok ? "font-medium text-accent-strong" : "text-ink-soft"}`}>
        {result ? (result.ok ? result.text : `! ${result.text}`) : ""}
      </p>
    </div>
  );
}
