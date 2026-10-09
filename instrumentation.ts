export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Validate the environment once, when the server boots, so a bad or missing
  // variable fails loudly at startup instead of on someone's first request.
  await import("@/lib/env");

  // The local development database migrates itself. A real Postgres is
  // migrated deliberately with `pnpm db:migrate`.
  if (process.env.NODE_ENV === "development" && !process.env.DATABASE_URL) {
    const { migrateDatabase } = await import("@/lib/db/client");
    await migrateDatabase();
  }
}
