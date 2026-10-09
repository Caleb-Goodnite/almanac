"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="masthead-rule" role="alert">
      <p className="label">Something went wrong</p>
      <h1 className="display mt-2 text-4xl">That page did not load.</h1>
      <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
        Nothing you have logged is lost. This is a problem on our side, and trying again
        usually fixes it.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/today" variant="outline">
          Go to Today
        </ButtonLink>
      </div>
      {error.digest ? <p className="label mt-6">Reference {error.digest}</p> : null}
    </div>
  );
}
