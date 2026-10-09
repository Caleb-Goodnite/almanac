import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

const SIZES = new Set([180, 192, 512]);

/** The app icon, drawn rather than stored: an ink "A" on paper with the vermilion full stop. */
export async function GET(request: NextRequest, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  // Maskable icons need the mark inside the central safe zone.
  const maskable = request.nextUrl.searchParams.has("maskable");
  const scale = maskable ? 0.62 : 0.8;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f0e8" }}>
        <div style={{ display: "flex", alignItems: "baseline", color: "#1a1814", fontSize: size * scale, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
          A
          <div style={{ width: size * scale * 0.16, height: size * scale * 0.16, borderRadius: "50%", background: "#d9481c", marginLeft: size * 0.01 }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
