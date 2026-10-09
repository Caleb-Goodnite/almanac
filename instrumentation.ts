export async function register() {
  // Validate the environment once, when the server boots, so a bad or missing
  // variable fails loudly at startup instead of on someone's first request.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
