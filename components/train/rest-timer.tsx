"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Epoch ms at which the rest ends, or null when no timer is running. */
  endsAt: number | null;
  totalSeconds: number;
  onAdjust: (deltaSeconds: number) => void;
  onDismiss: () => void;
};

/**
 * A rest countdown that sits above the tab bar. It keeps time from a
 * timestamp, not by counting ticks, so it stays right if the phone sleeps.
 * It buzzes once at zero and announces the end to screen readers.
 */
export function RestTimer({ endsAt, totalSeconds, onAdjust, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = endsAt !== null && remaining === 0;

  useEffect(() => {
    if (done) navigator.vibrate?.([120, 60, 120]);
  }, [done]);

  if (endsAt === null) return null;

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const ratio = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-ink bg-paper md:bottom-0 md:left-44">
      <div aria-hidden className="h-0.5 origin-left bg-accent transition-transform duration-300 ease-linear" style={{ transform: `scaleX(${ratio})` }} />
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-2 sm:px-8">
        <p className="label shrink-0">{done ? "Rest over" : "Rest"}</p>
        <p className="nums font-display text-3xl" role="timer" aria-live="off">
          {mm}:{ss}
        </p>
        <p className="sr-only" role="status">
          {done ? "Rest is over. Start your next set." : ""}
        </p>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => onAdjust(-15)} className="nums min-h-11 rounded-[3px] border border-rule-strong px-3 text-sm hover:border-ink" aria-label="Shorten rest by 15 seconds">
            −15
          </button>
          <button type="button" onClick={() => onAdjust(30)} className="nums min-h-11 rounded-[3px] border border-rule-strong px-3 text-sm hover:border-ink" aria-label="Extend rest by 30 seconds">
            +30
          </button>
          <button type="button" onClick={onDismiss} className="min-h-11 rounded-[3px] bg-ink px-4 text-sm font-medium text-paper">
            {done ? "Done" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
