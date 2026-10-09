"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

type WhyProps = {
  /** Plain-language reason, one or two sentences. */
  children: ReactNode;
  /** Anchor in /research, e.g. "protein". */
  source?: string;
  /** Short citation shown next to the link, e.g. "Morton et al. 2018". */
  cite?: string;
};

/**
 * "Why this?" set as a footnote: a small marker that unfolds the reasoning
 * and a link to the evidence, in place rather than in a floating tooltip, so it
 * works the same with touch, keyboard and screen readers.
 */
export function Why({ children, source, cite }: WhyProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduce = useReducedMotion();

  return (
    <span className="block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="label -mx-2 inline-flex min-h-11 items-center gap-1.5 px-2 underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        <span aria-hidden className="font-display text-sm normal-case not-italic">
          †
        </span>
        Why this?
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.span
            id={id}
            className="block overflow-hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
          >
            <span className="block border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
              {children}
              {source ? (
                <>
                  {" "}
                  <Link
                    href={`/research#${source}`}
                    className="whitespace-nowrap text-ink underline underline-offset-4"
                  >
                    {cite ?? "See the evidence"}
                  </Link>
                </>
              ) : null}
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
