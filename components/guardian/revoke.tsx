"use client";

import { useState, useTransition } from "react";
import { revokeAction } from "@/app/guardian/actions";
import { Button } from "@/components/ui/button";

/** Withdrawing is one tap: taking permission away should be easier than giving it. */
export function Revoke({ token, firstName }: { token: string; firstName: string }) {
  const [state, setState] = useState<{ done: boolean; error: string | null }>({ done: false, error: null });
  const [pending, startTransition] = useTransition();

  if (state.done) {
    return (
      <>
        <h1 className="display text-4xl">Approval withdrawn</h1>
        <p role="status" className="mt-4 max-w-prose leading-relaxed text-ink-soft">
          {firstName}&apos;s fat-loss goal is switched off and their targets are back to maintaining their weight. They
          would need a new approval to set it again.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="display text-4xl">Withdraw your approval?</h1>
      <p className="mt-4 max-w-prose leading-relaxed">
        This switches off {firstName}&apos;s fat-loss goal in Almanac straight away. Their targets go back to maintaining
        their weight, and everything else keeps working.
      </p>
      <div className="mt-6">
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await revokeAction(token);
              setState(res.ok ? { done: true, error: null } : { done: false, error: res.error });
            })
          }
        >
          {pending ? "Withdrawing…" : "Withdraw approval"}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {state.error}
        </p>
      ) : null}
    </>
  );
}
