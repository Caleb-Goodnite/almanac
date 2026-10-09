import { z } from "zod";

/**
 * An optional form field: a missing key, undefined, null or an empty string
 * all become null; anything else must satisfy `inner`.
 */
export function blankable<T extends z.ZodType>(inner: T) {
  return z
    .preprocess((v) => (v === "" || v === undefined ? null : v), inner.nullable())
    .optional()
    .transform((v) => v ?? null);
}
