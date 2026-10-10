import { Capacitor } from "@capacitor/core";
import { isNativeApp, nativePlatform } from "./platform";

export type NativeGoogleResult = { ok: true; idToken: string } | { ok: false; reason: "cancelled" | "unavailable" | "failed" };

/**
 * Shows Google's native account sheet (Credential Manager on Android, Google
 * Sign-In on iPhone) and returns the ID token it issues. The token is sent to
 * the server, which verifies it with Google before any session exists.
 */
export async function nativeGoogleIdToken(config: { webClientId: string; iosClientId: string | null }): Promise<NativeGoogleResult> {
  if (!isNativeApp()) return { ok: false, reason: "unavailable" };
  if (nativePlatform() === "ios" && !config.iosClientId) return { ok: false, reason: "unavailable" };
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      google: { webClientId: config.webClientId, iOSClientId: config.iosClientId ?? undefined, mode: "online" },
    });
    const { result } = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
    if (result.responseType !== "online" || !result.idToken) return { ok: false, reason: "failed" };
    return { ok: true, idToken: result.idToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: /cancel/i.test(message) ? "cancelled" : "failed" };
  }
}

/** False in a browser and in an older build of the app that was made before native sign-in existed. */
export function nativeGoogleAvailable(): boolean {
  return isNativeApp() && Capacitor.isPluginAvailable("SocialLogin");
}
