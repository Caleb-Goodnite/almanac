"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type CountUpProps = {
  value: number;
  /** Decimal places to show. */
  decimals?: number;
  className?: string;
  locale?: string;
};

function format(value: number, decimals: number, locale?: string) {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Animates a number from its previous value to the new one.
 * The server renders the final value, so it is correct without JavaScript and
 * for assistive technology; the tween only rewrites the visible text node.
 */
export function CountUp({ value, decimals = 0, className, locale = "en-US" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = previous.current;
    previous.current = value;
    if (reduce || from === value) {
      node.textContent = format(value, decimals, locale);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.25, 1, 0.5, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest, decimals, locale);
      },
    });
    return () => controls.stop();
  }, [value, decimals, locale, reduce]);

  return (
    <span className={className}>
      <span className="sr-only">{format(value, decimals, locale)}</span>
      <span ref={ref} aria-hidden className="nums">
        {format(value, decimals, locale)}
      </span>
    </span>
  );
}
