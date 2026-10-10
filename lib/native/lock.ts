import { isNativeApp } from "./platform";

/**
 * The app lock is a per-phone preference kept in a cookie, so the server can
 * draw the locked screen in the first paint instead of flashing the page
 * underneath. It is a privacy screen for a phone left unlocked or handed to
 * someone; it is not encryption and does not replace signing out.
 */
export const LOCK_COOKIE = "almanac_lock";
/** How long the app may sit in the background before it asks again. */
export const RELOCK_AFTER_MS = 60_000;

export function lockEnabled(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").includes(`${LOCK_COOKIE}=1`);
}

export function setLockEnabled(on: boolean): void {
  document.cookie = on ? `${LOCK_COOKIE}=1; path=/; max-age=31536000; samesite=lax` : `${LOCK_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Whether the phone has Face ID, Touch ID, a fingerprint or at least a passcode to check against. */
export async function canLock(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable || info.deviceIsSecure;
  } catch {
    return false;
  }
}

/** Shows the system prompt (biometrics, falling back to the phone's passcode). Resolves true only on success. */
export async function authenticate(reason: string): Promise<boolean> {
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({ reason, allowDeviceCredential: true, androidTitle: "Unlock Almanac", cancelTitle: "Cancel" });
    return true;
  } catch {
    return false;
  }
}
