"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useOffline } from "next/offline";
import { useEffect, useState } from "react";

/**
 * Tells people they are offline and that nothing is lost: with
 * `experimental.useOffline`, anything they log now is held and sent when the
 * connection comes back.
 *
 * Two details matter. It is fixed to the top of the screen, so appearing and
 * disappearing never moves the page under someone's finger. And it waits a
 * moment before showing, because a single failed request (for example one
 * cancelled by the next tap) briefly looks like being offline.
 */
export function OfflineBanner() {
  const offline = useOffline();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(offline), offline ? 1200 : 0);
    return () => clearTimeout(timer);
  }, [offline]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50">
      {visible ? (
        <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-paper">
          <WifiSlash aria-hidden size={16} />
          You are offline. Keep logging; it will be saved when you reconnect.
        </p>
      ) : null}
    </div>
  );
}
