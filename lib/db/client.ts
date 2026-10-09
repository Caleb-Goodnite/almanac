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
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);
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
export const usingLocalDatabase = !process.env.DATABASE_URL;
