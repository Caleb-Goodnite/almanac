import { NextResponse, type NextRequest } from "next/server";
import { coachContextFor } from "@/lib/ai/coach";
import { CoachError, streamChat, type ChatMessage, type Usage } from "@/lib/ai/openrouter";
import { systemPrompt } from "@/lib/ai/prompts";
import { crisisReply, floorCorrection, supportReply } from "@/lib/ai/safety-replies";
import { getViewer } from "@/lib/auth/session";
import { addMessage, checkBudget, createConversation, getConversation, listMessages, recordUsage } from "@/lib/data/coach";
import { recomputeTargets, setSupportMode } from "@/lib/data/profile";
import { rateLimit } from "@/lib/data/rate-limit";
import { buildSnapshot } from "@/lib/data/snapshot";
import { env, features } from "@/lib/env";
import { screenMessage, violatesFloor } from "@/lib/safety/screen";
import { chatRequestSchema } from "@/lib/validation/coach";

// Streaming needs the Node.js runtime and must never be cached.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 6000;
const MAX_REPLY_TOKENS = 700;

export type CoachEvent =
  | { type: "meta"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "safety"; kind: "crisis" | "support" }
  | { type: "error"; kind: string; message: string; retryable: boolean }
  | { type: "done" };

function refuse(status: number, kind: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { kind, message, ...extra } }, { status });
}

/** Rough cost for when the provider reports none (for example a cancelled stream). */
function estimateUsage(promptChars: number, completionChars: number): Usage {
  const promptTokens = Math.ceil(promptChars / 4);
  const completionTokens = Math.ceil(completionChars / 4);
  return { promptTokens, completionTokens, costUsd: (promptTokens * 1 + completionTokens * 5) / 1_000_000 };
}

export async function POST(request: NextRequest) {
  // Same-origin only: a cross-site page must not be able to spend a user's coach budget.
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([request.nextUrl.host, new URL(env.BETTER_AUTH_URL).host]);
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      // An opaque origin ("null") is never ours.
    }
    if (!allowed.has(host)) return refuse(403, "forbidden", "This request came from another site.");
  }

  const viewer = await getViewer();
  if (!viewer) return refuse(401, "unauthenticated", "Sign in to talk to the coach.");
  const { userId } = viewer;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "invalid", "That request could not be read.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return refuse(400, "invalid", parsed.error.issues[0]?.message ?? "Check your message.");
  const { message } = parsed.data;

  const limit = await rateLimit(`coach:${userId}`, env.COACH_MESSAGES_PER_MINUTE, 60);
  if (!limit.allowed) {
    return refuse(429, "rate_limited", `You are sending messages quickly. Try again in ${limit.retryAfterSeconds} seconds.`, {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  let conversationId = parsed.data.conversationId;
  if (conversationId && !(await getConversation(userId, conversationId))) {
    return refuse(404, "not_found", "That conversation could not be found.");
  }

  // Safety screening happens first and does not depend on the model, the
  // budget, or the coach even being configured.
  const screen = screenMessage(message);
  conversationId ??= await createConversation(userId, message);
  const convId = conversationId;
  await addMessage(userId, convId, { role: "user", content: message, safety: screen.signals.join(",") || null });

  const encoder = new TextEncoder();
  const sse = (event: CoachEvent) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  const responseHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };

  if (screen.level === "crisis" || screen.level === "strong") {
    const kind = screen.level === "crisis" ? "crisis" : "support";
    const reply = kind === "crisis" ? crisisReply(viewer.isTeen) : supportReply(viewer.isTeen);
    if (kind === "support" && !viewer.profile.supportMode) {
      await setSupportMode(userId, true);
      await recomputeTargets(userId);
    }
    await addMessage(userId, convId, { role: "assistant", content: reply, safety: kind });
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(sse({ type: "meta", conversationId: convId }));
          controller.enqueue(sse({ type: "safety", kind }));
          controller.enqueue(sse({ type: "delta", text: reply }));
          controller.enqueue(sse({ type: "done" }));
          controller.close();
        },
      }),
      { headers: responseHeaders },
    );
  }

  if (!features.coach) {
    return refuse(503, "not_configured", "The coach is not set up on this server yet.", { conversationId: convId });
  }
  const budget = await checkBudget(userId);
  if (!budget.allowed) {
    return refuse(429, "budget", "You have reached today's limit for coach messages. It resets at midnight UTC.", { conversationId: convId });
  }

  const snapshot = await buildSnapshot(viewer);
  const { context, floorKcal } = await coachContextFor(viewer, snapshot);

  // Recent turns only, newest last, within a character budget.
  const history = await listMessages(userId, convId);
  const turns: ChatMessage[] = [];
  let chars = 0;
  for (const m of history.slice(-HISTORY_MESSAGES).reverse()) {
    chars += m.content.length;
    if (chars > HISTORY_CHARS && turns.length > 0) break;
    turns.unshift({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) });
  }
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(snapshot, context, screen) }, ...turns];
  const promptChars = messages.reduce((n, m) => n + m.content.length, 0);

  const upstream = new AbortController();
  request.signal.addEventListener("abort", () => upstream.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      let usage: Usage | null = null;
      let model: string | null = null;
      let closed = false;
      const send = (event: CoachEvent) => {
        if (closed) return;
        try {
          controller.enqueue(sse(event));
        } catch {
          closed = true;
        }
      };

      send({ type: "meta", conversationId: convId });

      const attempt = async (onlyModel?: string) => {
        for await (const event of streamChat({ messages, maxTokens: MAX_REPLY_TOKENS, model: onlyModel, signal: upstream.signal })) {
          if (event.type === "delta") {
            reply += event.text;
            send({ type: "delta", text: event.text });
          } else {
            usage = event.usage;
            model = event.model;
          }
        }
      };

      try {
        try {
          await attempt();
        } catch (err) {
          // One retry on the fallback model, only if nothing has been shown yet.
          if (err instanceof CoachError && err.retryable && reply === "" && !upstream.signal.aborted) {
            await new Promise((r) => setTimeout(r, 500));
            await attempt(env.OPENROUTER_FALLBACK_MODEL);
          } else {
            throw err;
          }
        }

        let safety: string | null = screen.level === "soft" ? "soft" : null;
        if (violatesFloor(reply, floorKcal)) {
          const correction = floorCorrection(floorKcal);
          reply += correction;
          send({ type: "delta", text: correction });
          safety = "floor_correction";
        }
        await addMessage(userId, convId, { role: "assistant", content: reply, model, safety });
        send({ type: "done" });
      } catch (err) {
        if (upstream.signal.aborted) {
          // The person pressed stop or left. Keep what was written.
          if (reply) await addMessage(userId, convId, { role: "assistant", content: reply, model, safety: "stopped" });
        } else if (err instanceof CoachError) {
          if (reply) await addMessage(userId, convId, { role: "assistant", content: reply, model, safety: "interrupted" });
          send({ type: "error", kind: err.kind, message: err.message, retryable: err.retryable });
        } else {
          console.error("coach chat failed", err);
          send({ type: "error", kind: "unknown", message: "Something went wrong on our side.", retryable: true });
        }
      } finally {
        await recordUsage(userId, usage ?? estimateUsage(promptChars, reply.length)).catch(() => undefined);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      }
    },
    cancel() {
      upstream.abort();
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
