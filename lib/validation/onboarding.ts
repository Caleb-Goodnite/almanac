import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";

export const onboardingSchema = z.object({
  sex: z.enum(["male", "female", "unspecified"]),
  heightCm: z.coerce.number().min(100, "Enter a height of at least 100 cm").max(250, "Enter a height under 250 cm"),
  weightKg: z.coerce.number().min(25, "Enter a weight of at least 25 kg").max(350, "Enter a weight under 350 kg"),
  bodyFatPct: z
    .union([z.literal(""), z.coerce.number().min(3).max(60)])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  unitSystem: z.enum(["metric", "imperial"]),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone").default("UTC"),
  goal: z.enum(["lose_fat", "build_muscle", "maintain", "improve_fitness"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"]),
  resistanceTraining: z.boolean(),
  trainingDaysPerWeek: z.coerce.number().int().min(0).max(7),
  weeklyRatePct: z.coerce.number().min(-2).max(1).nullable().default(null),
  acceptedDisclaimer: z.literal(true, { error: "Please confirm you have read this" }),
});

export type OnboardingForm = z.input<typeof onboardingSchema>;

export const dobSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
});
