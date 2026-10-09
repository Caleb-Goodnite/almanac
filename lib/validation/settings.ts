import { z } from "zod";

export const profileUpdateSchema = z.object({
  sex: z.enum(["male", "female", "unspecified"]),
  heightCm: z.coerce.number().min(100, "Enter a height of at least 100 cm").max(250, "Enter a height under 250 cm"),
  unitSystem: z.enum(["metric", "imperial"]),
  goal: z.enum(["lose_fat", "build_muscle", "maintain", "improve_fitness"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"]),
  resistanceTraining: z.boolean(),
  pace: z.enum(["gentle", "standard", "faster"]),
});

export const guardianRequestSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
});
