import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { line } from "@visx/shape";
import { fmt, fmtDate } from "@/lib/format";
import { dayNumber, type Point } from "@/lib/science/trend";

type Props = {
  /** Raw readings, drawn as faint dots. */
  points: readonly Point[];
  /** Smoothed series, drawn as the inked line. */
  trend?: readonly Point[];
  /** A horizontal reference line, e.g. the calorie target. */
  reference?: { value: number; label: string };
  /** A shaded band, e.g. a sleep target range. */
  band?: { min: number; max: number; label: string };
  unit: string;
  decimals?: number;
  /** Sentence describing the chart for people who cannot see it. */
  summary: string;
  /** Column header for the value in the data table alternative. */
  valueLabel: string;
  from: string;
  to: string;
  height?: number;
};

const W = 600;

/**
 * A line chart drawn on the server as plain SVG: no client JavaScript.
 * The plot stretches to its container while labels stay as real HTML text, so
 * nothing is distorted or shrunk on a phone. The line draws in with a CSS
 * animation. A visually hidden table carries the same data for screen readers.
 */
export function LineChart({
  points,
  trend,
  reference,
  band,
  unit,
  decimals = 0,
  summary,
  valueLabel,
  from,
  to,
  height = 200,
}: Props) {
  const all = [...points, ...(trend ?? [])];
  const values = all.map((p) => p.value);
  if (reference) values.push(reference.value);
  if (band) values.push(band.min, band.max);

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.12;
  lo -= pad;
  hi += pad;

  const x = scaleLinear({ domain: [dayNumber(from), dayNumber(to)], range: [4, W - 4] });
  const y = scaleLinear({ domain: [lo, hi], range: [height - 4, 4] });
  const path = line<Point>({ x: (p) => x(dayNumber(p.date)), y: (p) => y(p.value), curve: curveMonotoneX });
  const d = trend && trend.length > 1 ? path([...trend]) : null;
  const last = trend?.[trend.length - 1] ?? points[points.length - 1];

  return (
    <figure>
      <div className="flex gap-2">
        <div className="nums flex flex-col justify-between py-0.5 text-right text-xs text-ink-soft" aria-hidden>
          <span>{fmt(hi - pad, decimals)}</span>
          <span>{fmt(lo + pad, decimals)}</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className="block w-full border-y border-rule"
            style={{ height }}
            role="img"
            aria-label={summary}
          >
            {band ? (
              <rect x={0} width={W} y={y(band.max)} height={Math.max(0, y(band.min) - y(band.max))} fill="var(--paper-sunk)" />
            ) : null}
            {reference ? (
              <line
                x1={0}
                x2={W}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke="var(--rule-strong)"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {points.map((p) => (
              <circle key={p.date} cx={x(dayNumber(p.date))} cy={y(p.value)} r={2.5} fill="var(--ink-faint)" opacity={trend ? 0.55 : 1} />
            ))}
            {d ? (
              <path
                d={d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className="chart-draw"
              />
            ) : null}
          </svg>
          {reference ? (
            <span
              className="label pointer-events-none absolute right-1 -translate-y-full bg-paper px-1"
              style={{ top: `${(y(reference.value) / height) * 100}%` }}
              aria-hidden
            >
              {reference.label}
            </span>
          ) : null}
        </div>
      </div>
      <figcaption className="nums mt-1.5 flex justify-between pl-10 text-xs text-ink-soft">
        <span>{fmtDate(from, { month: "short", day: "numeric" })}</span>
        {last ? (
          <span className="text-ink">
            Latest {trend ? "trend " : ""}
            {fmt(last.value, decimals)} {unit}
          </span>
        ) : null}
        <span>{fmtDate(to, { month: "short", day: "numeric" })}</span>
      </figcaption>

      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.slice(-31).map((p) => (
            <tr key={p.date}>
              <th scope="row">{fmtDate(p.date, { month: "long", day: "numeric" })}</th>
              <td>
                {fmt(p.value, decimals)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
