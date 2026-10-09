import { closeDatabase, db, usingLocalDatabase } from "./client";
import { seedExercises } from "./seed-exercises";

async function main() {
  console.log(`Seeding ${usingLocalDatabase ? "local PGlite database" : "DATABASE_URL"}...`);
  const n = await seedExercises(db);
  console.log(`Seeded ${n} exercises.`);
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
