"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useOffline } from "next/offline";

/**
 * Tells people they are offline and that nothing is lost: with
 * `experimental.useOffline`, anything they log now is held and sent when the
 * connection comes back.
 */
export function OfflineBanner() {
  const offline = useOffline();
  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-paper">
          <WifiSlash aria-hidden size={16} />
          You are offline. Keep logging; it will be saved when you reconnect.
        </p>
      ) : null}
    </div>
  );
}
