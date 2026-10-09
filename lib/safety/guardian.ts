/**
 * Guardian approval for an under-18's fat-loss goal.
 *
 * The teen names a parent or guardian's email address. That address gets a
 * one-time link, and the approval is given from the link in several
 * deliberate steps. This is friction and informed consent, not identity
 * verification: the app cannot prove who opened the email. COMPLIANCE.md says
 * so, and the limits in policy.ts apply whether or not approval is given.
 */

/** What the guardian must type, compared without regard to case or a final full stop. */
export const CONSENT_PHRASE = "I understand the risks";
/** How long the confirm button must be held. */
export const HOLD_MS = 5000;
/** The approval is refused if it arrives sooner than this after the page was opened. */
export const MIN_READ_SECONDS = 15;
/** A started approval page must be finished within this long. */
export const MAX_SESSION_SECONDS = 60 * 60;
export const REQUEST_TTL_DAYS = 7;
export const REQUESTS_PER_DAY = 3;

export const RELATIONSHIPS = ["parent", "guardian"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export function phraseMatches(input: string): boolean {
  const clean = (s: string) => s.trim().replace(/[.!]+$/, "").replace(/\s+/g, " ").toLowerCase();
  return clean(input) === clean(CONSENT_PHRASE);
}

/** Reduces an address to the mailbox it delivers to, so "a+b@x.com" cannot stand in for "a@x.com". */
export function mailbox(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0] ?? "";
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

export function sameMailbox(a: string, b: string): boolean {
  return mailbox(a) === mailbox(b);
}

/** "pat.lee@example.com" becomes "p•••@example.com", for showing a teen where the request went. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}
