import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as schema from "./schema";

/* Connection factories. No side effects: importing this opens nothing. */

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction on one. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const MIGRATIONS = path.join(process.cwd(), "lib/db/migrations");

export type Handle = { db: Database; migrate: () => Promise<void>; close: () => Promise<void> };

export function connectPostgres(url: string): Handle {
  // `prepare: false` is required by Supabase's transaction-mode pooler.
  const sql = postgres(url, { prepare: false, max: 10, idle_timeout: 20 });
  const db = drizzlePostgres(sql, { schema });
  return {
    db,
    migrate: () => migratePostgres(db, { migrationsFolder: MIGRATIONS }),
    close: () => sql.end(),
  };
}

/**
 * PGlite is Postgres compiled to WebAssembly, running inside this process.
 * It backs local development when DATABASE_URL is unset, and every test.
 * Pass no directory for a throwaway in-memory database.
 */
export function connectPglite(dataDir?: string): Handle {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  return {
    // Both drivers expose the same query builder; only the session differs.
    db: db as unknown as Database,
    migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS }),
    close: () => client.close(),
  };
}

/**
 * Raw `db.execute()` returns an array on postgres.js and `{ rows }` on PGlite.
 * Always read raw results through this.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result as { rows: T[] }).rows;
}
