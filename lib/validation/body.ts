import { z } from "zod";
import { dateSchema } from "./food";
import { blankable } from "./util";

const optional = blankable;

const scale = z.coerce.number().int().min(1).max(5);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export const weightSchema = z.object({
  date: dateSchema,
  kg: z.coerce.number().min(25, "Enter a weight of at least 25 kg").max(350, "Enter a weight under 350 kg"),
  bodyFatPct: optional(z.coerce.number().min(3).max(60)),
});

export const sleepSchema = z.object({
  date: dateSchema,
  durationMin: z.coerce.number().int().min(30, "Enter how long you slept").max(1080, "That is more than 18 hours"),
  quality: optional(scale),
  bedtime: optional(time),
  wakeTime: optional(time),
});

export const checkinSchema = z.object({
  date: dateSchema,
  mood: optional(scale),
  energy: optional(scale),
  soreness: optional(scale),
  restingHr: optional(z.coerce.number().int().min(25).max(220)),
  note: blankable(z.string().trim().max(500)),
});

export const measurementSchema = z.object({
  date: dateSchema,
  site: z.enum(["waist", "hips", "chest", "arm", "thigh", "calf", "neck"]),
  cm: z.coerce.number().min(10).max(300),
});
