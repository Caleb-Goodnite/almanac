"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

export type MeterPattern = "solid" | "hatch" | "dots";

type MeterProps = {
  label: string;
  value: number;
  target: number;
  unit: string;
  pattern?: MeterPattern;
};

/**
 * A horizontal bar for one macro. The three macros share one ink colour and are
 * told apart by fill pattern and by label, so nothing depends on hue.
 */
export function Meter({ label, value, target, unit, pattern = "solid" }: MeterProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  const fill = pattern === "solid" ? "var(--ink)" : `url(#${id})`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        <span className="nums text-sm text-ink">
          {Math.round(value)}
          <span className="text-ink-soft"> / {Math.round(target)} {unit}</span>
        </span>
      </div>
      <svg
        className="mt-1.5 block h-2.5 w-full"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)} of ${Math.round(target)} ${unit}`}
        preserveAspectRatio="none"
      >
        <defs>
          {pattern === "hatch" ? (
            <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.5" height="5" fill="var(--ink)" />
            </pattern>
          ) : null}
          {pattern === "dots" ? (
            <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1.5" fill="var(--ink)" />
            </pattern>
          ) : null}
        </defs>
        <rect width="100%" height="100%" fill="var(--paper-sunk)" />
        <motion.rect
          height="100%"
          fill={fill}
          initial={{ width: "0%" }}
          animate={{ width: `${ratio * 100}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
        />
      </svg>
    </div>
  );
}
