/**
 * Age arithmetic. Dates are plain calendar values (no time zones): the caller
 * passes "today" in the user's zone.
 */

export type CalendarDate = { year: number; month: number; day: number };

export function parseDate(iso: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 2011-02-30, which Date silently rolls over.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Exact age in whole years from a full date of birth. Used once, at the age gate. */
export function ageFromBirthDate(birth: CalendarDate, today: CalendarDate): number {
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/**
 * Age from the stored month and year of birth only.
 * We do not keep the day, so the birthday is assumed to be the last day of the
 * month: a person is counted as a year older only once their birth month has
 * fully passed. Any error therefore makes someone look younger, which keeps a
 * 17-year-old in the teen experience up to a month longer and never shorter.
 */
export function ageFromBirthMonth(birthYear: number, birthMonth: number, today: CalendarDate): number {
  let age = today.year - birthYear;
  if (today.month <= birthMonth) age -= 1;
  return age;
}

/** Age in months, same conservative rule; used for growth-chart lookups. */
export function ageMonthsFromBirthMonth(birthYear: number, birthMonth: number, today: CalendarDate): number {
  return (today.year - birthYear) * 12 + (today.month - birthMonth) - 1;
}

export type AgeBand = "under13" | "teen" | "adult";

export function ageBand(age: number): AgeBand {
  if (age < 13) return "under13";
  if (age < 18) return "teen";
  return "adult";
}
