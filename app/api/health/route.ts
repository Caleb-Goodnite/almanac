import { NextResponse } from "next/server";
import { databaseHealthy } from "@/lib/data/health";

export const dynamic = "force-dynamic";

/** For uptime monitors and load balancers. Says only whether the app can reach its database. */
export async function GET() {
  const ok = await databaseHealthy();
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
