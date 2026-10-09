import { Capacitor } from "@capacitor/core";

/** True inside the iOS or Android app, where native plugins exist. Always false in a browser. */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function nativePlatform(): "ios" | "android" | null {
  if (!isNativeApp()) return null;
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

/** A short tap of feedback when something is logged. Does nothing in a browser. */
export async function tapFeedback(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Feedback is a nicety; never let it break logging.
  }
}
