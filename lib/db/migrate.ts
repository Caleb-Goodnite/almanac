import { closeDatabase, migrateDatabase, usingLocalDatabase } from "./client";

async function main() {
  console.log(`Migrating ${usingLocalDatabase ? "local PGlite database (.data/pglite)" : "DATABASE_URL"}...`);
  await migrateDatabase();
  console.log("Migrations applied.");
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
