import { z } from "zod";

/**
 * The weekly review shown on the dashboard. The deterministic reviewer
 * (weekly.ts) and the AI insights endpoint both produce exactly this shape,
 * and the AI's output is validated against this schema before it is shown.
 */
export const reviewSchema = z.object({
  headline: z.string().min(1).max(140),
  wins: z.array(z.string().min(1).max(220)).max(3),
  slips: z.array(z.string().min(1).max(220)).max(3),
  focus: z
    .object({
      action: z.string().min(1).max(200),
      why: z.string().min(1).max(260),
    })
    .nullable(),
  dataNote: z.string().max(220).nullable(),
});

export type Review = z.infer<typeof reviewSchema>;
