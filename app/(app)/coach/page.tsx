import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { deleteConversationAction } from "./actions";
import { Chat } from "@/components/coach/chat";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { getConversation, listConversations, listMessages, messageAllowance } from "@/lib/data/coach";
import { features } from "@/lib/env";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Coach" };

export default async function CoachPage({ searchParams }: PageProps<"/coach">) {
  const viewer = await requireViewer();
  const requested = z.uuid().safeParse((await searchParams).c);
  // Ownership is checked in the data layer: another user's id resolves to nothing.
  const conversation = requested.success ? await getConversation(viewer.userId, requested.data) : null;
  const [history, conversations, allowance] = await Promise.all([
    conversation ? listMessages(viewer.userId, conversation.id) : Promise.resolve([]),
    listConversations(viewer.userId),
    messageAllowance(viewer.userId),
  ]);

  const prompts = viewer.profile.supportMode
    ? ["How can I build a steadier routine with meals?", "Help me sleep better", "What kind of movement might I enjoy?"]
    : viewer.isTeen
      ? ["Review my week", "Am I eating enough for my training?", "Plan tomorrow's meals", "Is my training volume right?"]
      : ["Review my week", "Why has my weight stalled?", "Plan tomorrow's meals", "Is my training volume right?"];

  const others = conversations.filter((c) => c.id !== conversation?.id);

  return (
    <Section
      as="h1"
      kicker={conversation ? "Conversation" : "Ask anything about your data"}
      title="Coach"
      aside={
        conversation ? (
          <Link href="/coach" className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
            New conversation
          </Link>
        ) : null
      }
    >
      <Chat
        // A different conversation is a different chat: reset its state.
        key={conversation?.id ?? "new"}
        conversationId={conversation?.id ?? null}
        initialMessages={history.map((m) => ({ id: m.id, role: m.role, content: m.content, safety: m.safety }))}
        prompts={prompts}
        configured={features.coach}
        allowance={{ remaining: allowance.remaining, limit: allowance.limit }}
      />

      {others.length > 0 || conversation ? (
        <details className="mt-10 border-t border-rule pt-3">
          <summary className="label min-h-11 cursor-pointer content-center">
            Earlier conversations ({others.length})
          </summary>
          <ul className="mt-1">
            {others.map((c) => (
              <li key={c.id} className="border-b border-rule">
                <Link href={`/coach?c=${c.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:bg-paper-raised">
                  <span className="truncate">{c.title}</span>
                  <span className="nums shrink-0 text-sm text-ink-soft">
                    {fmtDate(c.updatedAt.toISOString().slice(0, 10), { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {conversation ? (
            <form action={deleteConversationAction.bind(null, conversation.id)} className="mt-3">
              <button type="submit" className="label min-h-11 underline decoration-dotted underline-offset-4 hover:text-accent-strong">
                Delete this conversation
              </button>
            </form>
          ) : null}
        </details>
      ) : null}
    </Section>
  );
}
