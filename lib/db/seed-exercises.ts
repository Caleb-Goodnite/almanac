import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "./connect";
import { exercises } from "./schema";

type SeedExercise = Omit<typeof exercises.$inferInsert, "id" | "ownerId" | "source">;

/**
 * Loads the shared exercise library (876 exercises from yuhonas/free-exercise-db,
 * public domain). Safe to run repeatedly: rows are matched on slug and updated.
 */
export async function seedExercises(database: Database): Promise<number> {
  const file = path.join(process.cwd(), "lib/db/seed-data/exercises.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as SeedExercise[];

  for (let i = 0; i < rows.length; i += 200) {
    await database
      .insert(exercises)
      .values(rows.slice(i, i + 200).map((r) => ({ ...r, ownerId: null, source: "free-exercise-db" })))
      .onConflictDoUpdate({
        target: [exercises.slug, exercises.ownerId],
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          equipment: sql`excluded.equipment`,
          level: sql`excluded.level`,
          mechanic: sql`excluded.mechanic`,
          force: sql`excluded.force`,
          movementPattern: sql`excluded.movement_pattern`,
          primaryGroups: sql`excluded.primary_groups`,
          secondaryGroups: sql`excluded.secondary_groups`,
          instructions: sql`excluded.instructions`,
        },
      });
  }
  return rows.length;
}
