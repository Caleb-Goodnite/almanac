import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** True when the database answers a trivial query within two seconds. */
export async function databaseHealthy(): Promise<boolean> {
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return true;
  } catch {
    return false;
  }
}
