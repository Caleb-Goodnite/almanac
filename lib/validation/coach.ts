import { z } from "zod";

export const chatRequestSchema = z.object({
  conversationId: z.uuid().nullable().default(null),
  message: z.string().trim().min(1, "Type a message first.").max(2000, "That message is too long. Keep it under 2,000 characters."),
});
