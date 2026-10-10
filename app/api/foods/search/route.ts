import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cacheFoods, searchCachedFoods, type FoodSummary } from "@/lib/data/foods";
import { rateLimit } from "@/lib/data/rate-limit";
import { searchUsda } from "@/lib/food/usda";
import { searchQuerySchema } from "@/lib/validation/food";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to search." }, { status: 401 });
  const userId = session.user.id;

  const parsed = searchQuerySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ results: [], source: "none" });
  const query = parsed.data;

  const limit = await rateLimit(`food-search:${userId}`, 40, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // Foods already in our cache come back even if the USDA request fails, so
  // search degrades to "what we already know" instead of an error.
  const local = await searchCachedFoods(userId, query, 20);
  let remote: FoodSummary[] = [];
  let degraded = false;
  try {
    remote = await cacheFoods(await searchUsda(query));
  } catch {
    degraded = true;
  }

  // Everyday foods come first; the USDA entry each one was built from is not shown a second time.
  const common = local.filter((f) => f.source === "common");
  const builtFrom = new Set(common.map((f) => f.sourceId.split("-")[0]));
  const seen = new Set<string>();
  const results: FoodSummary[] = [];
  for (const food of [...local.filter((f) => f.source === "custom"), ...common, ...remote, ...local]) {
    if (seen.has(food.id) || (food.source === "usda" && builtFrom.has(food.sourceId))) continue;
    seen.add(food.id);
    results.push(food);
  }

  return NextResponse.json({ results: results.slice(0, 30), degraded });
}
