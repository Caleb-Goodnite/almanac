import { closeDatabase, db, usingLocalDatabase } from "./client";
import { seedExercises } from "./seed-exercises";
import { seedCommonFoods } from "./seed-foods";

async function main() {
  console.log(`Seeding ${usingLocalDatabase ? "local PGlite database" : "DATABASE_URL"}...`);
  const n = await seedExercises(db);
  console.log(`Seeded ${n} exercises.`);
  console.log(`Seeded ${await seedCommonFoods(db)} common foods.`);
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
