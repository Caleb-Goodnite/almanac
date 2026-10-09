import type { CalendarDate } from "@/lib/science/age";
import type { DateString } from "@/lib/science/types";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): DateString {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function toCalendarDate(date: DateString): CalendarDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}
