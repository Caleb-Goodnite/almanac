import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cacheFoods, findCachedByBarcode } from "@/lib/data/foods";
import { rateLimit } from "@/lib/data/rate-limit";
import { findOffByBarcode } from "@/lib/food/off";
import { findUsdaByBarcode } from "@/lib/food/usda";
import { barcodeSchema } from "@/lib/validation/food";

export async function GET(_request: Request, ctx: RouteContext<"/api/foods/barcode/[code]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to scan." }, { status: 401 });

  const parsed = barcodeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return NextResponse.json({ error: "That is not a product barcode." }, { status: 400 });
  const barcode = parsed.data;

  const limit = await rateLimit(`food-barcode:${session.user.id}`, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many scans. Try again in a moment." }, { status: 429 });
  }

  const cached = await findCachedByBarcode(barcode);
  if (cached) return NextResponse.json({ food: cached });

  // Open Food Facts first (best barcode coverage), then USDA branded foods.
  for (const lookup of [findOffByBarcode, findUsdaByBarcode]) {
    try {
      const found = await lookup(barcode);
      if (found) {
        const [food] = await cacheFoods([{ ...found, barcode }]);
        if (food) return NextResponse.json({ food });
      }
    } catch {
      // Try the next source.
    }
  }
  return NextResponse.json({ food: null }, { status: 404 });
}
