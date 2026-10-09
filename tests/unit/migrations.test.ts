import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectPglite, rowsOf } from "@/lib/db/connect";

const handle = connectPglite();

beforeAll(async () => {
  await handle.migrate();
});

afterAll(async () => {
  await handle.close();
});

describe("database migrations", () => {
  it("apply cleanly to an empty Postgres", async () => {
    const result = await handle.db.execute(
      sql`select count(*)::int as count from information_schema.tables where table_schema = 'public'`,
    );
    expect(rowsOf<{ count: number }>(result)[0]?.count).toBe(29);
  });

  it("enable row level security on every table", async () => {
    const result = await handle.db.execute(
      sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rowsOf<{ relname: string }>(result).map((r) => r.relname)).toEqual([]);
  });

  it("give every user-owned table a user_id or owner_id column", async () => {
    const shared = ["user", "verification", "rate_limit", "app_rate_limits"];
    const result = await handle.db.execute(
      sql`select t.table_name from information_schema.tables t
          where t.table_schema = 'public'
            and not exists (
              select 1 from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = t.table_name
                and c.column_name in ('user_id', 'owner_id')
            )`,
    );
    expect(rowsOf<{ table_name: string }>(result).map((r) => r.table_name).sort()).toEqual(shared.sort());
  });
});
