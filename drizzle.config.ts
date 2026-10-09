import { defineConfig } from "drizzle-kit";

// Generating migrations only diffs the schema files; it needs no database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
});
