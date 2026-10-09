import { z } from "zod";
import { MUSCLE_GROUPS } from "@/lib/science/volume";
import { dateSchema } from "./food";
import { blankable } from "./util";

const optionalInt = (min: number, max: number) => blankable(z.coerce.number().int().min(min).max(max));

export const startWorkoutSchema = z.object({
  clientId: z.uuid(),
  name: z.string().trim().min(1).max(60),
  routineId: z.uuid().nullable().default(null),
});

export const addSetSchema = z.object({
  workoutId: z.uuid(),
  exerciseId: z.uuid(),
  reps: z.coerce.number().int().min(1, "Enter the reps").max(200),
  weightKg: z.coerce.number().min(0).max(1000),
  rpe: blankable(z.coerce.number().min(1).max(10)),
  isWarmup: z.boolean().default(false),
});

export const routineSchema = z.object({
  name: z.string().trim().min(1, "Give the routine a name").max(60),
  items: z
    .array(
      z.object({
        exerciseId: z.uuid(),
        targetSets: z.coerce.number().int().min(1).max(12),
        targetRepsMin: z.coerce.number().int().min(1).max(50),
        targetRepsMax: z.coerce.number().int().min(1).max(50),
        restSeconds: z.coerce.number().int().min(15).max(600),
      }),
    )
    .min(1, "Add at least one exercise")
    .max(20),
});

export const cardioSchema = z.object({
  clientId: z.uuid(),
  date: dateSchema,
  activity: z.string().min(1).max(40),
  durationMin: z.coerce.number().min(1, "Enter how long it lasted").max(1440),
  distanceKm: blankable(z.coerce.number().min(0).max(1000)),
  avgHr: optionalInt(30, 240),
  maxHr: optionalInt(30, 240),
  notes: blankable(z.string().trim().max(500)),
});

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, "Give the exercise a name").max(80),
  primaryGroups: z.array(z.enum(MUSCLE_GROUPS)).max(4).default([]),
});

export const exerciseSearchSchema = z.object({
  q: z.string().trim().max(60).default(""),
  group: z.enum(MUSCLE_GROUPS).optional(),
});
