"use client";

import { ArrowUp, Stop } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CoachEvent } from "@/app/api/coach/chat/route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { CoachMarkdown } from "./markdown";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; safety?: string | null };

type Problem = { kind: string; message: string; retryable: boolean; retryText?: string };

type Props = {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  prompts: string[];
  configured: boolean;
  allowance: { remaining: number; limit: number };
};

const HELP: Record<string, string> = {
  not_configured: "The coach has not been switched on for this server yet. Everything else in Almanac works without it.",
  daily_limit: "You have used all of today's coach messages. They reset at midnight UTC. Your weekly review on the Today page still works.",
  budget: "You have used today's coach allowance. It resets at midnight UTC. Your weekly review on the Today page still works.",
  credits: "The coach is out of credit on our side. This is not something you did.",
  auth: "The coach is misconfigured on our side. This is not something you did.",
  moderation: "That message could not be processed. Try saying it another way.",
};

export function Chat({ conversationId, initialMessages, prompts, configured, allowance }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [convId, setConvId] = useState(conversationId);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState("");
  const [remaining, setRemaining] = useState(allowance.remaining);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSent = useRef("");

  useEffect(() => {
    // Keep the newest text in view while it streams, unless the reader has scrolled up.
    const el = endRef.current;
    if (!el) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 240;
    if (nearBottom) el.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string, options: { resend?: boolean } = {}) {
    const message = text.trim();
    if (!message || streaming) return;
    lastSent.current = message;
    setProblem(null);
    setInput("");
    setStreaming(true);
    setStatus("The coach is writing.");

    const replyId = `a-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...(options.resend ? prev : [...prev, { id: `u-${crypto.randomUUID()}`, role: "user" as const, content: message }]),
      { id: replyId, role: "assistant", content: "" },
    ]);
    const patchReply = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === replyId ? fn(m) : m)));
    const dropEmptyReply = () => setMessages((prev) => prev.filter((m) => m.id !== replyId || m.content !== ""));

    const controller = new AbortController();
    abortRef.current = controller;
    let newConversation: string | null = null;

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: { kind?: string; message?: string; conversationId?: string; remainingToday?: number } } | null;
        if (data?.error?.remainingToday !== undefined) setRemaining(data.error.remainingToday);
        const kind = data?.error?.kind ?? "unknown";
        if (data?.error?.conversationId) newConversation = data.error.conversationId;
        dropEmptyReply();
        setProblem({
          kind,
          message: HELP[kind] ?? data?.error?.message ?? "The coach could not answer. Try again in a moment.",
          retryable: kind === "rate_limited" || kind === "unknown" || res.status >= 500,
        });
        setStatus("The coach could not answer.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const line = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 2);
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5)) as CoachEvent;
          if (event.type === "meta") {
            newConversation = event.conversationId;
            if (event.remainingToday !== undefined) setRemaining(event.remainingToday);
          }
          else if (event.type === "delta") patchReply((m) => ({ ...m, content: m.content + event.text }));
          else if (event.type === "safety") patchReply((m) => ({ ...m, safety: event.kind }));
          else if (event.type === "error") {
            failed = true;
            dropEmptyReply();
            setProblem({ kind: event.kind, message: HELP[event.kind] ?? event.message, retryable: event.retryable });
          }
        }
      }
      setStatus(failed ? "The coach could not finish answering." : "The coach has replied.");
    } catch (err) {
      if (controller.signal.aborted) {
        dropEmptyReply();
        setStatus("Stopped.");
      } else {
        console.error(err);
        dropEmptyReply();
        setProblem({ kind: "network", message: "The connection dropped. Check you are online and try again.", retryable: true });
        setStatus("The connection dropped.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (newConversation && newConversation !== convId) {
        setConvId(newConversation);
        // Put the conversation in the URL without re-rendering the page under the reader.
        // No router.refresh() here: re-rendering the page would remount this chat
        // and throw away what is on screen, including any error message.
        window.history.replaceState(null, "", `/coach?c=${newConversation}`);
      }
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-[60dvh] flex-col">
      {empty ? (
        <div className="flex-1">
          <p className="max-w-prose leading-relaxed text-ink-soft">
            Ask about your own numbers. The coach reads your last 30 days of food, training,
            sleep and weight, gives you the one or two changes that matter most, and says so
            when there is not enough data to judge.
          </p>
          {!configured ? (
            <p className="mt-4 border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed">{HELP.not_configured}</p>
          ) : null}
          <ul className="mt-6 border-t border-rule">
            {prompts.map((p) => (
              <li key={p} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => send(p)}
                  disabled={streaming}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left font-display text-xl hover:bg-paper-raised"
                >
                  {p}
                  <ArrowUp aria-hidden size={18} className="shrink-0 rotate-45 text-ink-soft" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-1 flex-col gap-6" aria-label="Conversation">
          {messages.map((m, i) => {
            const live = streaming && i === messages.length - 1 && m.role === "assistant";
            return m.role === "user" ? (
              <li key={m.id} className="ml-auto max-w-[85%] bg-paper-raised px-4 py-3">
                <p className="sr-only">You said:</p>
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </li>
            ) : (
              <li key={m.id} className={cn("max-w-prose border-l-2 pl-4", m.safety === "crisis" || m.safety === "support" ? "border-accent" : "border-ink")} aria-busy={live}>
                <p className="label mb-1.5">Coach</p>
                {m.content ? (
                  <CoachMarkdown>{m.content}</CoachMarkdown>
                ) : (
                  <p className="text-ink-soft" aria-hidden>
                    <span className="inline-block animate-pulse">Reading your numbers…</span>
                  </p>
                )}
                {m.safety === "crisis" || m.safety === "support" ? (
                  <p className="mt-3">
                    <Link href="/support" className="font-medium underline underline-offset-4">
                      Open the Support page
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {problem ? (
        <div role="alert" className="mt-6 border-l-2 border-accent py-1 pl-3">
          <p className="leading-relaxed">
            <span aria-hidden className="font-medium text-accent-strong">
              !{" "}
            </span>
            {problem.message}
          </p>
          {problem.retryable ? (
            <Button variant="outline" className="mt-2" onClick={() => send(lastSent.current, { resend: true })}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <div ref={endRef} className="h-4" />

      <form
        className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex items-end gap-2 border-t border-ink bg-paper pt-3 pb-2 md:bottom-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Message the coach</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask about your week…"
            className="field-sizing-content max-h-40 min-h-12 w-full resize-none bg-transparent py-3 text-lg outline-none placeholder:text-ink-faint"
          />
        </label>
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="grid size-12 shrink-0 place-items-center rounded-[3px] border border-ink"
            aria-label="Stop the reply"
          >
            <Stop aria-hidden size={20} weight="fill" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="grid size-12 shrink-0 place-items-center rounded-[3px] bg-ink text-paper disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp aria-hidden size={22} weight="bold" />
          </button>
        )}
      </form>
      <p className="nums text-xs leading-relaxed text-ink-soft">
        <span data-testid="coach-remaining">
          {remaining} of {allowance.limit} messages left today.
        </span>{" "}
        The coach is an AI and can be wrong. It is not a doctor and does not give medical advice.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
