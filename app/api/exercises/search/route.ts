import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { searchExercises } from "@/lib/data/training";
import { exerciseSearchSchema } from "@/lib/validation/training";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to search." }, { status: 401 });

  const parsed = exerciseSearchSchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    group: request.nextUrl.searchParams.get("group") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ results: [] });

  const results = await searchExercises(session.user.id, { query: parsed.data.q || undefined, group: parsed.data.group, limit: 40 });
  return NextResponse.json({ results });
}
