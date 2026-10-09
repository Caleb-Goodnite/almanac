import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiUsage, conversations, foodLogs, insights, messages } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { Usage } from "@/lib/ai/openrouter";
import type { DateString } from "@/lib/science/types";

export type Conversation = { id: string; title: string; updatedAt: Date };
export type Message = { id: string; role: "user" | "assistant"; content: string; safety: string | null; createdAt: Date };

export async function listConversations(userId: string, limit = 30): Promise<Conversation[]> {
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversation(userId: string, conversationId: string): Promise<Conversation | null> {
  const [row] = await db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createConversation(userId: string, firstMessage: string): Promise<string> {
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 60) || "New conversation";
  const [row] = await db.insert(conversations).values({ userId, title }).returning({ id: conversations.id });
  if (!row) throw new Error("Could not start a conversation");
  return row.id;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  await db.delete(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function listMessages(userId: string, conversationId: string, limit = 200): Promise<Message[]> {
  return db
    .select({ id: messages.id, role: messages.role, content: messages.content, safety: messages.safety, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId)))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function addMessage(
  userId: string,
  conversationId: string,
  message: { role: "user" | "assistant"; content: string; model?: string | null; safety?: string | null },
): Promise<string> {
  const [row] = await db
    .insert(messages)
    .values({ userId, conversationId, role: message.role, content: message.content, model: message.model ?? null, safety: message.safety ?? null })
    .returning({ id: messages.id });
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  if (!row) throw new Error("Could not save message");
  return row.id;
}

/* Budget */

export type Budget = { allowed: boolean; spentUsd: number; capUsd: number };

/** Whether this user still has coach budget today (a UTC day). */
export async function checkBudget(userId: string): Promise<Budget> {
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ costUsd: aiUsage.costUsd })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
    .limit(1);
  const spentUsd = row?.costUsd ?? 0;
  return { allowed: spentUsd < env.COACH_DAILY_USD_CAP, spentUsd, capUsd: env.COACH_DAILY_USD_CAP };
}

export async function recordUsage(userId: string, usage: Usage | null): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage ?? { promptTokens: 0, completionTokens: 0, costUsd: 0 };
  await db
    .insert(aiUsage)
    .values({ userId, day, requests: 1, promptTokens: u.promptTokens, completionTokens: u.completionTokens, costUsd: u.costUsd })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        requests: sql`${aiUsage.requests} + 1`,
        promptTokens: sql`${aiUsage.promptTokens} + ${u.promptTokens}`,
        completionTokens: sql`${aiUsage.completionTokens} + ${u.completionTokens}`,
        costUsd: sql`${aiUsage.costUsd} + ${u.costUsd}`,
      },
    });
}

/* Weekly review cache */

export async function getCachedReview(userId: string, weekStart: DateString) {
  const [row] = await db
    .select({ payload: insights.payload, createdAt: insights.createdAt })
    .from(insights)
    .where(and(eq(insights.userId, userId), eq(insights.weekStart, weekStart)))
    .limit(1);
  return row ?? null;
}

export async function saveReview(userId: string, weekStart: DateString, payload: Record<string, unknown>, model: string | null): Promise<void> {
  await db
    .insert(insights)
    .values({ userId, weekStart, payload, model })
    .onConflictDoUpdate({ target: [insights.userId, insights.weekStart], set: { payload, model, createdAt: new Date() } });
}

/** Names of the foods this user logs most, for meal suggestions. Scrubbed again before use. */
export async function frequentFoodNames(userId: string, limit = 12): Promise<string[]> {
  const rows = await db
    .select({ name: foodLogs.name, n: sql<number>`count(*)::int` })
    .from(foodLogs)
    .where(eq(foodLogs.userId, userId))
    .groupBy(foodLogs.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => r.name);
}
