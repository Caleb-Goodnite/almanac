"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { deleteConversation } from "@/lib/data/coach";

export async function deleteConversationAction(conversationId: unknown): Promise<void> {
  const userId = await requireUserId();
  const parsed = z.uuid().safeParse(conversationId);
  if (parsed.success) await deleteConversation(userId, parsed.data);
  revalidatePath("/coach");
  redirect("/coach");
}
