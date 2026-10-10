import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCommonFoods } from "@/lib/data/foods";

/** The built-in list of everyday foods, shown before anything is typed in search. */
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Sign in to see foods." }, { status: 401 });
  return NextResponse.json({ foods: await listCommonFoods() }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
