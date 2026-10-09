export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Validate the environment once, when the server boots, so a bad or missing
  // variable fails loudly at startup instead of on someone's first request.
  await import("@/lib/env");

  // The local database (development with no DATABASE_URL, and end-to-end
  // tests) migrates and seeds itself. A real Postgres is migrated deliberately
  // with `pnpm db:migrate` and seeded with `pnpm db:seed`.
  const local = !process.env.DATABASE_URL?.trim();
  if (local && (process.env.NODE_ENV === "development" || process.env.ALMANAC_E2E === "1")) {
    const { db, migrateDatabase } = await import("@/lib/db/client");
    await migrateDatabase();
    const { exercises } = await import("@/lib/db/schema");
    const [existing] = await db.select({ id: exercises.id }).from(exercises).limit(1);
    if (!existing) {
      const { seedExercises } = await import("@/lib/db/seed-exercises");
      await seedExercises(db);
    }
  }
}
