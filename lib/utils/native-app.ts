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

export type GoogleSignIn =
  | { mode: "off" }
  | { mode: "web" }
  | { mode: "native"; webClientId: string; iosClientId: string | null };

/**
 * How Google sign-in is offered for this request. Browsers get the usual
 * redirect. Google refuses that inside an app's web view, so the phone apps
 * use the native account sheet instead, which on iPhone needs its own client id.
 */
export async function googleSignIn(config: { webClientId?: string; iosClientId?: string; enabled: boolean }): Promise<GoogleSignIn> {
  if (!config.enabled || !config.webClientId) return { mode: "off" };
  const agent = (await headers()).get("user-agent") ?? "";
  if (!agent.includes("AlmanacApp")) return { mode: "web" };
  const isAndroid = /Android/i.test(agent);
  if (!isAndroid && !config.iosClientId) return { mode: "off" };
  return { mode: "native", webClientId: config.webClientId, iosClientId: config.iosClientId ?? null };
}
