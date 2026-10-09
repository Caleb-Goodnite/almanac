"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RingProps = {
  /** 0 to 1 and beyond; values over 1 draw a second, thinner lap. */
  progress: number;
  size?: number;
  stroke?: number;
  /** Text alternative, e.g. "1,420 of 2,200 kcal eaten". */
  label: string;
  children?: ReactNode;
};

/**
 * A progress ring drawn like an instrument dial: a hairline track with tick
 * marks at the quarters and a single inked arc.
 */
export function Ring({ progress, size = 200, stroke = 10, label, children }: RingProps) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2 - 6;
  const c = size / 2;
  const first = Math.max(0, Math.min(progress, 1));
  const over = Math.max(0, Math.min(progress - 1, 1));
  const transition = reduce
    ? { duration: 0 }
    : { duration: 1.1, ease: [0.25, 1, 0.5, 1] as const };

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
      >
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--rule)" strokeWidth={1} />
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1={c + r + 3}
            y1={c}
            x2={c + r + 8}
            y2={c}
            stroke="var(--rule-strong)"
            strokeWidth={1}
            transform={`rotate(${deg} ${c} ${c})`}
          />
        ))}
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: first }}
          transition={transition}
        />
        {over > 0 ? (
          <motion.circle
            cx={c}
            cy={c}
            r={r - stroke}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeDasharray="2 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: over }}
            transition={{ ...transition, delay: reduce ? 0 : 0.6 }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
