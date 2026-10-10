import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getFood, savePortions } from "@/lib/data/foods";
import { rateLimit } from "@/lib/data/rate-limit";
import { fetchUsdaPortions } from "@/lib/food/usda";

/**
 * Household measures for one food. For a USDA food they are looked up the
 * first time it is opened and kept from then on; if USDA cannot be reached
 * the answer is an empty list, and the food can still be logged by weight.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/foods/[id]/portions">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ portions: [] }, { status: 400 });

  const food = await getFood(session.user.id, id.data);
  if (!food) return NextResponse.json({ portions: [] }, { status: 404 });
  if (food.portions !== null || food.source !== "usda") return NextResponse.json({ portions: food.portions ?? [] });

  if (!(await rateLimit(`food-portions:${session.user.id}`, 60, 60)).allowed) return NextResponse.json({ portions: [] });
  try {
    const portions = await fetchUsdaPortions(food.sourceId);
    await savePortions(food.id, portions);
    return NextResponse.json({ portions });
  } catch {
    return NextResponse.json({ portions: [] });
  }
}
