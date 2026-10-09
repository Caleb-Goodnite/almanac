import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export type Email = { to: string; subject: string; text: string };

/** Where unsent mail goes in development and tests. One JSON object per line. */
export const OUTBOX = path.join(process.cwd(), ".data", "outbox.jsonl");

/**
 * Sends a transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * With no RESEND_API_KEY, nothing is sent: outside production the message is
 * appended to a local outbox file so flows can be tested end to end, and in
 * production it is dropped with a warning (the UI hides flows that need email).
 * Never throws: callers must not reveal, through an error, whether an address exists.
 */
export async function sendEmail(email: Email): Promise<void> {
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) console.error("email: provider rejected the message", res.status);
      return;
    }
    if (env.NODE_ENV !== "production" || env.ALMANAC_E2E) {
      await mkdir(path.dirname(OUTBOX), { recursive: true });
      await appendFile(OUTBOX, `${JSON.stringify({ ...email, at: new Date().toISOString() })}\n`);
      return;
    }
    console.warn("email: RESEND_API_KEY is not set; message not sent");
  } catch (err) {
    console.error("email: send failed", err instanceof Error ? err.message : err);
  }
}
