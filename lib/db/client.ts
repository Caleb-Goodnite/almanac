import path from "node:path";
import { connectPglite, connectPostgres, type Handle } from "./connect";

/*
 * The app's single database connection.
 *
 * Do not import this file from pages, components or route handlers.
 * User data is read and written only through lib/data, which takes the
 * signed-in user's id as its first argument. ESLint enforces the boundary.
 */

export type { Database, Executor } from "./connect";

function connect(): Handle {
  const url = process.env.DATABASE_URL?.trim();
  const e2e = process.env.ALMANAC_E2E === "1";
  if (url && e2e) throw new Error("ALMANAC_E2E cannot be combined with DATABASE_URL");
  if (url) return connectPostgres(url);
  // `next build` imports this module from several worker processes at once.
  // A file-backed PGlite must only ever be opened by one process, so the build
  // gets a throwaway in-memory database instead.
  if (process.env.NEXT_PHASE === "phase-production-build") return connectPglite();
  if (e2e) return connectPglite(path.join(process.cwd(), ".data/e2e"));
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return connectPglite(path.join(process.cwd(), ".data/pglite"));
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __almanacDb?: Handle };
const handle = (globalForDb.__almanacDb ??= connect());

export const db = handle.db;
export const migrateDatabase = handle.migrate;
export const closeDatabase = handle.close;
export const usingLocalDatabase = !process.env.DATABASE_URL?.trim();
