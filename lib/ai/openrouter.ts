import "server-only";
import { env } from "@/lib/env";

/**
 * A small OpenRouter client. It is `server-only`: the API key is read here and
 * nowhere else, so it cannot end up in a client bundle.
 * API reference: https://openrouter.ai/docs/api/reference
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Usage = { promptTokens: number; completionTokens: number; costUsd: number };

export type CoachErrorKind =
  | "not_configured"
  | "auth"
  | "credits"
  | "rate_limited"
  | "moderation"
  | "unavailable"
  | "timeout"
  | "empty"
  | "bad_response";

export class CoachError extends Error {
  constructor(
    public kind: CoachErrorKind,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "CoachError";
  }
}

const CONNECT_TIMEOUT_MS = 20_000;
const IDLE_TIMEOUT_MS = 30_000;

// Used only if a response carries no cost figure. Deliberately higher than the
// default model's real price so the daily cap trips early rather than late.
const FALLBACK_USD_PER_MTOK = { prompt: 1, completion: 5 };

function headers(): HeadersInit {
  if (!env.OPENROUTER_API_KEY) {
    throw new CoachError("not_configured", "The coach is not set up on this server.", false);
  }
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": env.BETTER_AUTH_URL,
    "X-Title": "Almanac",
  };
}

function errorFor(status: number, message: string): CoachError {
  switch (status) {
    case 401:
      return new CoachError("auth", "The coach's API key was rejected.", false);
    case 402:
      return new CoachError("credits", "The coach's account is out of credit.", false);
    case 403:
      return new CoachError("moderation", "That message could not be processed.", false);
    case 408:
      return new CoachError("timeout", "The coach took too long to answer.", true);
    case 429:
      return new CoachError("rate_limited", "The coach is busy right now.", true);
    case 502:
    case 503:
      return new CoachError("unavailable", "The coach's model is not available right now.", true);
    default:
      return new CoachError("bad_response", message || `Unexpected response (${status}).`, status >= 500);
  }
}

function usageFrom(raw: unknown): Usage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const promptTokens = Number(u.prompt_tokens ?? 0);
  const completionTokens = Number(u.completion_tokens ?? 0);
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  const reported = Number(u.cost);
  const costUsd =
    Number.isFinite(reported) && reported >= 0
      ? reported
      : (promptTokens * FALLBACK_USD_PER_MTOK.prompt + completionTokens * FALLBACK_USD_PER_MTOK.completion) / 1_000_000;
  return { promptTokens, completionTokens, costUsd };
}

type RequestOptions = {
  messages: ChatMessage[];
  maxTokens: number;
  /** Try this model only. Without it, the default model with the fallback behind it. */
  model?: string;
  signal?: AbortSignal;
};

// No sampling parameters (temperature, top_p) are sent. Current models do not
// all accept them, and with `require_parameters` a single unsupported one
// makes OpenRouter report that no provider can serve the request.
function body(options: RequestOptions, extra: Record<string, unknown>) {
  return JSON.stringify({
    ...(options.model ? { model: options.model } : { models: [env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODEL] }),
    messages: options.messages,
    max_tokens: options.maxTokens,
    usage: { include: true },
    // Hidden "thinking" tokens count against max_tokens. With them on, live
    // tests saw replies cut off after a sentence, or empty, because the budget
    // was spent before any visible text. The coach's job is to summarise
    // numbers it is handed, so reasoning is turned off: replies start sooner,
    // cost less, and always fit.
    reasoning: { enabled: false },
    ...extra,
  });
}

async function post(options: RequestOptions, extra: Record<string, unknown>): Promise<Response> {
  const connect = AbortSignal.timeout(CONNECT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, connect]) : connect;
  let res: Response;
  try {
    res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: body(options, extra),
      signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof CoachError) throw err;
    if (options.signal?.aborted) throw err;
    throw new CoachError("timeout", "The coach could not be reached.", true);
  }
  if (!res.ok) {
    let message = "";
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      message = data.error?.message ?? "";
    } catch {
      // Not JSON; the status code is enough.
    }
    throw errorFor(res.status, message);
  }
  return res;
}

export type StreamEvent = { type: "delta"; text: string } | { type: "done"; usage: Usage | null; model: string | null };

/**
 * Streams a chat completion as text deltas. Throws CoachError for anything
 * that goes wrong, including an error sent mid-stream, a stalled stream and a
 * stream that finishes having produced no text.
 */
export async function* streamChat(options: RequestOptions): AsyncGenerator<StreamEvent> {
  const res = await post(options, { stream: true });
  if (!res.body) throw new CoachError("bad_response", "The coach sent an empty response.", true);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let produced = false;
  let usage: Usage | null = null;
  let model: string | null = null;
  let finishReason: string | null = null;

  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CoachError("timeout", "The coach stopped responding.", true)), IDLE_TIMEOUT_MS);
      });
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), stalled]);
      } finally {
        clearTimeout(timer);
      }
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        // Blank lines separate events; lines starting with ":" are keep-alive comments.
        if (!line || line.startsWith(":") || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;

        let parsed: {
          model?: string;
          error?: { code?: number; message?: string };
          usage?: unknown;
          choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
        };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error) {
          throw errorFor(Number(parsed.error.code) || 502, parsed.error.message ?? "");
        }
        if (parsed.model) model = parsed.model;
        if (parsed.usage) usage = usageFrom(parsed.usage);
        const finish = parsed.choices?.[0]?.finish_reason;
        if (finish) finishReason = finish;
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          produced = true;
          yield { type: "delta", text };
        }
      }
    }
  } finally {
    // Stops generation (and billing, where the provider supports it) if we bail out early.
    reader.cancel().catch(() => undefined);
  }

  if (!produced) {
    // Diagnostics only: model, finish reason and token counts. Never message content.
    console.warn("coach: empty reply", { model, finishReason, usage });
    throw new CoachError("empty", "The coach did not produce an answer.", true);
  }
  yield { type: "done", usage, model };
}

/**
 * A non-streaming completion constrained to a JSON Schema. The caller must
 * still validate the result: "strict" is a request to the provider, not a
 * guarantee.
 */
export async function completeJson(
  options: RequestOptions & { schemaName: string; schema: Record<string, unknown> },
): Promise<{ data: unknown; usage: Usage | null; model: string | null }> {
  const { schemaName, schema, ...rest } = options;
  const res = await post(rest, {
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
    // Only route to providers that actually honour response_format.
    provider: { require_parameters: true },
  });

  let payload: {
    model?: string;
    error?: { code?: number; message?: string };
    usage?: unknown;
    choices?: { message?: { content?: string | null } }[];
  };
  try {
    payload = await res.json();
  } catch {
    throw new CoachError("bad_response", "The coach sent a response that could not be read.", true);
  }
  // A 200 can still carry only an error object.
  if (payload.error) throw errorFor(Number(payload.error.code) || 502, payload.error.message ?? "");

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new CoachError("empty", "The coach did not produce an answer.", true);

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new CoachError("bad_response", "The coach's answer was not valid JSON.", true);
  }
  return { data, usage: usageFrom(payload.usage), model: payload.model ?? null };
}

/**
 * Runs an attempt and, if it fails in a way worth retrying, tries once more on
 * the fallback model alone. Used only before any text has reached the user.
 */
export async function withFallback<T>(attempt: (model: string | undefined) => Promise<T>): Promise<T> {
  try {
    return await attempt(undefined);
  } catch (err) {
    if (err instanceof CoachError && err.retryable) {
      await new Promise((r) => setTimeout(r, 600));
      return attempt(env.OPENROUTER_FALLBACK_MODEL);
    }
    throw err;
  }
}
