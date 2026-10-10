"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RELOCK_AFTER_MS, authenticate, lockEnabled } from "@/lib/native/lock";
import { isNativeApp } from "@/lib/native/platform";

/**
 * Covers the app until the phone's owner unlocks it with Face ID, a
 * fingerprint or the passcode. `initiallyLocked` comes from the server (the
 * lock cookie on a request from the app shell) so the cover is in the first
 * paint. It locks again after a minute in the background.
 */
export function AppLock({ initiallyLocked }: { initiallyLocked: boolean }) {
  const [locked, setLocked] = useState(initiallyLocked);
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);
  const hiddenAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setFailed(false);
    const ok = await authenticate("Unlock Almanac");
    asking.current = false;
    if (ok) setLocked(false);
    else setFailed(true);
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    // The prompt is part of opening the app, so it is raised as soon as the cover has painted.
    const first = initiallyLocked ? setTimeout(() => void unlock(), 0) : undefined;

    let remove: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app").then(async ({ App }) => {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          hiddenAt.current = Date.now();
          return;
        }
        const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (lockEnabled() && away >= RELOCK_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      });
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      clearTimeout(first);
      cancelled = true;
      remove?.();
    };
  }, [initiallyLocked, unlock]);

  if (!locked) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="app-lock-title" className="fixed inset-0 z-[100] grid place-items-center bg-paper px-6">
      <div className="max-w-sm text-center">
        <p className="label">Almanac</p>
        <h2 id="app-lock-title" className="display mt-3 text-4xl">
          Locked
        </h2>
        <p role="status" className="mt-3 leading-relaxed text-ink-soft">
          {failed ? "That did not work. Try again." : "Unlock to see your record."}
        </p>
        <Button size="lg" className="mt-6" onClick={() => void unlock()}>
          Unlock
        </Button>
      </div>
    </div>
  );
}
