import type { DateString } from "./types";

export type Point = { date: DateString; value: number };

const DAY_MS = 86_400_000;

export function dayNumber(date: DateString): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function addDays(date: DateString, days: number): DateString {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Trailing moving average by calendar day. Each point becomes the mean of all
 * readings in the `window` days ending on that date, so missed days neither
 * break the line nor count as zero.
 */
export function movingAverage(points: readonly Point[], window = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p, i) => {
    const end = dayNumber(p.date);
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const q = sorted[j]!;
      if (end - dayNumber(q.date) >= window) break;
      sum += q.value;
      n += 1;
    }
    return { date: p.date, value: sum / n };
  });
}

/**
 * Exponentially weighted trend, the "trend weight" used by weight-smoothing
 * trackers. `alpha` is per day; gaps decay by the number of days skipped.
 */
export function exponentialTrend(points: readonly Point[], alpha = 0.1): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: Point[] = [];
  let trend: number | null = null;
  let last = 0;
  for (const p of sorted) {
    const day = dayNumber(p.date);
    if (trend === null) {
      trend = p.value;
    } else {
      const gap = Math.max(1, day - last);
      const a = 1 - (1 - alpha) ** gap;
      trend = trend + a * (p.value - trend);
    }
    last = day;
    out.push({ date: p.date, value: trend });
  }
  return out;
}

export type Regression = { slopePerDay: number; intercept: number; r2: number; n: number };

/** Ordinary least squares of value against day. Returns null with fewer than 2 distinct days. */
export function linearRegression(points: readonly Point[]): Regression | null {
  const n = points.length;
  if (n < 2) return null;
  const x0 = Math.min(...points.map((p) => dayNumber(p.date)));
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    const x = dayNumber(p.date) - x0;
    sx += x;
    sy += p.value;
    sxx += x * x;
    sxy += x * p.value;
    syy += p.value * p.value;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = syy - intercept * sy - slope * sxy;
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slopePerDay: slope, intercept, r2, n };
}

/** Weekly rate of change of a series, from a regression over the last `days`. */
export function weeklySlope(points: readonly Point[], endDate: DateString, days: number): number | null {
  const start = dayNumber(endDate) - days + 1;
  const end = dayNumber(endDate);
  const windowed = points.filter((p) => {
    const d = dayNumber(p.date);
    return d >= start && d <= end;
  });
  const fit = linearRegression(windowed);
  return fit ? fit.slopePerDay * 7 : null;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
