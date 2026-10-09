import "server-only";
import { headers } from "next/headers";

/**
 * True when the request comes from the Android or iOS app shell, which adds
 * this marker to its user agent (capacitor.config.ts). Used only to adjust
 * what is offered, never as a security check: a user agent can be faked.
 */
export async function isNativeApp(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes("AlmanacApp");
}
