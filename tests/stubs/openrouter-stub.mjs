// A stand-in for OpenRouter used by end-to-end tests and local development
// without an API key. Point the app at it with:
//   OPENROUTER_BASE_URL=http://127.0.0.1:4010/api/v1 OPENROUTER_API_KEY=stub-key
//
// It mimics the parts of the API the app uses: SSE streaming with keep-alive
// comments and a final usage chunk, JSON-schema responses, and a few failure
// modes triggered by words in the user's message so tests can reach them.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 4010);
const calls = [];

function reviewJson() {
  return JSON.stringify({
    headline: "A solid week, with protein the one thing to fix.",
    wins: ["You trained 2 times and logged on 7 of 7 days."],
    slips: ["Protein averaged 95 g against a 160 g target."],
    focus: { action: "Add a serving of Greek yogurt at breakfast.", why: "It closes about a third of your protein gap with one small change." },
    dataNote: null,
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/__calls") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(calls));
  }
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.writeHead(404);
    return res.end();
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const last = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  calls.push({ at: Date.now(), model: body.model ?? body.models, stream: Boolean(body.stream), system, last, auth: req.headers.authorization });

  if (/__fail_503__/.test(last) && !body.model) {
    // Fails on the default model list, succeeds when retried on the fallback alone.
    res.writeHead(503, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: 503, message: "No available provider" } }));
  }
  if (/__fail_402__/.test(last)) {
    res.writeHead(402, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: 402, message: "Insufficient credits" } }));
  }

  if (!body.stream) {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        model: "stub/model",
        choices: [{ message: { role: "assistant", content: body.response_format ? reviewJson() : "Stub reply." } }],
        usage: { prompt_tokens: 900, completion_tokens: 120, cost: 0.00015 },
      }),
    );
  }

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  res.write(": OPENROUTER PROCESSING\n\n");
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  if (/__empty__/.test(last)) {
    send({ model: "stub/model", choices: [{ delta: { content: "" }, finish_reason: "stop" }] });
    res.write("data: [DONE]\n\n");
    return res.end();
  }
  if (/__midstream_error__/.test(last)) {
    send({ model: "stub/model", choices: [{ delta: { content: "Your protein " } }] });
    send({ error: { code: 502, message: "Provider disconnected" }, choices: [{ delta: {}, finish_reason: "error" }] });
    return res.end();
  }

  const reply = /__below_floor__/.test(last)
    ? "You could aim for 900 calories a day to speed things up."
    : "Your protein averaged **95 g** against a 160 g target this week. Closing half that gap is the change most likely to help:\n\n- Add a serving of Greek yogurt at breakfast.\n- Keep your two strength sessions.";
  for (const word of reply.split(/(?<= )/)) {
    send({ model: "stub/model", choices: [{ delta: { content: word } }] });
    await new Promise((r) => setTimeout(r, 8));
  }
  send({ model: "stub/model", choices: [{ delta: { content: "" }, finish_reason: "stop" }], usage: { prompt_tokens: 1200, completion_tokens: 60, cost: 0.00015 } });
  res.write("data: [DONE]\n\n");
  res.end();
});

server.listen(PORT, "127.0.0.1", () => console.log(`OpenRouter stub listening on http://127.0.0.1:${PORT}`));
