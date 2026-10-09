"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  durationMs: number;
  done: boolean;
  /** Called once, with how long the button was held, when the hold completes. */
  onHeld: (ms: number) => void;
};

/**
 * A button that only counts when held down for the full duration. Letting go
 * early starts it over. Works with a pointer, touch, or a held space bar or
 * Enter key; progress is shown as a filling bar and announced as text.
 */
export function HoldButton({ durationMs, done, onHeld }: Props) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const frame = useRef(0);

  function stop() {
    cancelAnimationFrame(frame.current);
    startedAt.current = null;
    if (!done) setProgress(0);
  }

  function start() {
    if (done || startedAt.current !== null) return;
    startedAt.current = performance.now();
    const tick = () => {
      if (startedAt.current === null) return;
      const elapsed = performance.now() - startedAt.current;
      if (elapsed >= durationMs) {
        startedAt.current = null;
        setProgress(1);
        onHeld(Math.round(elapsed));
        return;
      }
      setProgress(elapsed / durationMs);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const secondsLeft = Math.ceil(((1 - progress) * durationMs) / 1000);
  const holding = progress > 0 && !done;

  return (
    <div>
      <button
        type="button"
        aria-disabled={done}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) start();
          if (e.key === " ") e.preventDefault();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        onBlur={stop}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative min-h-16 w-full touch-none select-none overflow-hidden rounded-[3px] border text-base font-medium",
          done ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-accent-strong/25"
          style={{ width: done ? "0%" : `${progress * 100}%` }}
        />
        <span className="relative">{done ? "Held. Thank you." : holding ? "Keep holding…" : "Press and hold"}</span>
      </button>
      <p role="status" className="nums mt-2 text-sm text-ink-soft">
        {done ? "Done." : holding ? `${secondsLeft} s to go` : "Letting go early starts it over."}
      </p>
    </div>
  );
}
