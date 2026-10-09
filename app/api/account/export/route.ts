import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { exportUserData } from "@/lib/data/export";
import { rateLimit } from "@/lib/data/rate-limit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });

  const limit = await rateLimit(`export:${session.user.id}`, 5, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "You have exported several times this hour. Try again later." }, { status: 429 });
  }

  const data = await exportUserData(session.user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="almanac-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
