import { kgToLb, mlToFlOz } from "@/lib/science/units";
import type { DateString } from "@/lib/science/types";

/** Locale-aware number formatting. All numbers shown in the app go through these. */

export function fmt(value: number, decimals = 0, locale = "en-US"): string {
  return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export type UnitSystem = "metric" | "imperial";

export function weightValue(kg: number, units: UnitSystem): number {
  return units === "imperial" ? kgToLb(kg) : kg;
}

export function weightUnit(units: UnitSystem): "kg" | "lb" {
  return units === "imperial" ? "lb" : "kg";
}

export function fmtWeight(kg: number, units: UnitSystem, decimals = 1): string {
  return `${fmt(weightValue(kg, units), decimals)} ${weightUnit(units)}`;
}

export function fmtWater(ml: number, units: UnitSystem): string {
  return units === "imperial" ? `${fmt(mlToFlOz(ml))} fl oz` : `${fmt(ml / 1000, 1)} L`;
}

export function fmtDate(date: DateString, options: Intl.DateTimeFormatOptions, locale = "en-US"): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", ...options });
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
