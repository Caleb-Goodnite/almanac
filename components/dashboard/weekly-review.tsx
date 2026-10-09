import type { Review } from "@/lib/insights/review";

/**
 * The weekly review card: what went well, what slipped, one thing to change.
 * Set like a short column, with a byline saying who wrote it.
 */
export function WeeklyReview({ review, byline }: { review: Review; byline: string }) {
  return (
    <article aria-labelledby="review-heading">
      <h3 id="review-heading" className="font-display text-2xl leading-snug">
        {review.headline}
      </h3>
      <p className="label mt-1">{byline}</p>

      {review.wins.length > 0 || review.slips.length > 0 ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {review.wins.length > 0 ? (
            <div>
              <h4 className="label">Went well</h4>
              <ul className="mt-1.5 flex flex-col gap-2">
                {review.wins.map((w) => (
                  <li key={w} className="border-l-2 border-good pl-3 leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.slips.length > 0 ? (
            <div>
              <h4 className="label">Slipped</h4>
              <ul className="mt-1.5 flex flex-col gap-2">
                {review.slips.map((s) => (
                  <li key={s} className="border-l-2 border-rule-strong pl-3 leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {review.focus ? (
        <div className="mt-6 bg-paper-raised p-4">
          <h4 className="label">One thing to change</h4>
          <p className="mt-1.5 font-display text-xl leading-snug">{review.focus.action}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{review.focus.why}</p>
        </div>
      ) : null}

      {review.dataNote ? <p className="mt-3 text-sm text-ink-soft">{review.dataNote}</p> : null}
    </article>
  );
}
