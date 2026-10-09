import { NextResponse } from "next/server";
import { coachContextFor } from "@/lib/ai/coach";
import { completeJson, withFallback } from "@/lib/ai/openrouter";
import { insightsPrompt } from "@/lib/ai/prompts";
import { getViewer } from "@/lib/auth/session";
import { checkBudget, getCachedReview, recordUsage, saveReview } from "@/lib/data/coach";
import { rateLimit } from "@/lib/data/rate-limit";
import { buildSnapshot } from "@/lib/data/snapshot";
import { features } from "@/lib/env";
import { reviewSchema, type Review } from "@/lib/insights/review";
import { weeklyReview } from "@/lib/insights/weekly";
import { violatesFloor } from "@/lib/safety/screen";
import { addDays } from "@/lib/science/trend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The JSON Schema sent to the model. Kept free of length limits, which some
// providers reject in strict mode; lengths are enforced by reviewSchema instead.
const REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "wins", "slips", "focus", "dataNote"],
  properties: {
    headline: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    slips: { type: "array", items: { type: "string" } },
    focus: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["action", "why"],
          properties: { action: { type: "string" }, why: { type: "string" } },
        },
        { type: "null" },
      ],
    },
    dataNote: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} as const;

type Payload = { review: Review; source: "coach" | "rules"; reason?: string };

function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to see your review." }, { status: 401 });
  const { userId } = viewer;

  const snapshot = await buildSnapshot(viewer);
  const rules = weeklyReview(snapshot);
  const fallback = (reason: string) => NextResponse.json({ review: rules, source: "rules", reason } satisfies Payload);

  // The written rules handle these cases better than a model would.
  if (!features.coach) return fallback("not_configured");
  if (snapshot.logging.daysLogged7 < 3 || !snapshot.targets) return fallback("sparse_data");
  if (snapshot.supportMode || snapshot.weight.tooFast) return fallback("safety");

  const weekStart = mondayOf(snapshot.asOf);
  const cached = await getCachedReview(userId, weekStart);
  if (cached && cached.createdAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) {
    const ok = reviewSchema.safeParse(cached.payload);
    if (ok.success) return NextResponse.json({ review: ok.data, source: "coach" } satisfies Payload);
  }

  const limit = await rateLimit(`insights:${userId}`, 6, 60 * 60);
  if (!limit.allowed) return fallback("rate_limited");
  if (!(await checkBudget(userId)).allowed) return fallback("budget");

  try {
    const { context, floorKcal } = await coachContextFor(viewer, snapshot);
    const result = await withFallback((model) =>
      completeJson({
        model,
        maxTokens: 600,
        schemaName: "weekly_review",
        schema: REVIEW_JSON_SCHEMA,
        messages: [
          { role: "system", content: insightsPrompt(snapshot, context) },
          { role: "user", content: "Write my weekly review." },
        ],
      }),
    );
    await recordUsage(userId, result.usage);

    // Never trust the shape or the content: validate, then run the same floor check as chat.
    const parsed = reviewSchema.safeParse(result.data);
    if (!parsed.success) return fallback("invalid_output");
    const text = [parsed.data.headline, ...parsed.data.wins, ...parsed.data.slips, parsed.data.focus?.action ?? "", parsed.data.focus?.why ?? ""].join(" ");
    if (violatesFloor(text, floorKcal)) return fallback("unsafe_output");

    await saveReview(userId, weekStart, parsed.data, result.model);
    return NextResponse.json({ review: parsed.data, source: "coach" } satisfies Payload);
  } catch (err) {
    console.error("insights failed", err instanceof Error ? err.message : err);
    return fallback("coach_error");
  }
}
