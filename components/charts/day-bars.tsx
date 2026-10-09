import { fmt, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

export type DayBar = { date: string; value: number | null };

type Props = {
  days: readonly DayBar[];
  target?: number;
  unit: string;
  /** Sentence describing the chart for people who cannot see it. */
  summary: string;
  today?: string;
  decimals?: number;
};

/**
 * One bar per day for a week, drawn with HTML so each bar is a real, labelled
 * element. Days with nothing logged show a hollow marker, never a zero bar:
 * "no data" and "ate nothing" are different things.
 */
export function DayBars({ days, target, unit, summary, today, decimals = 0 }: Props) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.value ?? 0)) * 1.1 || 1;

  return (
    <figure>
      <figcaption className="sr-only">{summary}</figcaption>
      <ol className="relative flex h-44 items-end gap-2 border-b border-ink">
        {target ? (
          <li aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-rule-strong" style={{ bottom: `${(target / max) * 100}%` }}>
            <span className="label absolute right-0 -translate-y-full bg-paper pl-1">
              Target {fmt(target, decimals)}
            </span>
          </li>
        ) : null}
        {days.map((d, i) => (
          <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="sr-only">
              {fmtDate(d.date, { weekday: "long" })}: {d.value == null ? "nothing logged" : `${fmt(d.value, decimals)} ${unit}`}
            </span>
            {d.value == null ? (
              <span aria-hidden className="mb-1 size-2 rounded-full border border-rule-strong" />
            ) : (
              <>
                <span aria-hidden className="nums mb-1 text-[0.6875rem] text-ink-soft">
                  {fmt(d.value, decimals)}
                </span>
                <span
                  aria-hidden
                  className={cn("bar-grow w-full max-w-10", d.date === today ? "bg-accent" : "bg-ink")}
                  style={{ height: `${(d.value / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                />
              </>
            )}
          </li>
        ))}
      </ol>
      <ol aria-hidden className="mt-1.5 flex gap-2">
        {days.map((d) => (
          <li key={d.date} className={cn("label flex-1 text-center", d.date === today && "text-ink")}>
            {fmtDate(d.date, { weekday: "narrow" })}
          </li>
        ))}
      </ol>
    </figure>
  );
}
