"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/section";
import { authenticate, canLock, lockEnabled, setLockEnabled } from "@/lib/native/lock";
import { isNativeApp } from "@/lib/native/platform";
import { DEFAULT_REMINDERS, applyReminders, loadReminders, type ReminderKind, type ReminderSettings } from "@/lib/native/reminders";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 border-b border-rule py-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-accent-strong)]" />
      <span>
        <span className="block font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * Settings that belong to this phone rather than the account: the app lock
 * and daily reminders. Shown only inside the iOS or Android app.
 * `weighInReminder` is false for under-18s and in support mode, where the app
 * does not nudge anyone toward the scale.
 */
export function PhoneSettings({ weighInReminder }: { weighInReminder: boolean }) {
  const [ready, setReady] = useState(false);
  const [lockable, setLockable] = useState(false);
  const [lock, setLock] = useState(false);
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    void canLock().then((can) => {
      if (cancelled) return;
      setLockable(can);
      setLock(lockEnabled());
      setReminders(loadReminders());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  async function changeLock(on: boolean) {
    // Turning it on or off both need the owner, so someone holding the phone cannot switch it off.
    if (!(await authenticate(on ? "Turn on the Almanac lock" : "Turn off the Almanac lock"))) {
      setStatus("That did not work, so nothing changed.");
      return;
    }
    setLockEnabled(on);
    setLock(on);
    setStatus(on ? "Almanac will ask to unlock when it is opened." : "The lock is off.");
  }

  async function changeReminder(kind: ReminderKind, patch: Partial<ReminderSettings[ReminderKind]>) {
    const next = { ...reminders, [kind]: { ...reminders[kind], ...patch } };
    try {
      if (await applyReminders(next)) {
        setReminders(next);
        setStatus(next[kind].on ? `Reminder set for ${next[kind].time}.` : "Reminder off.");
      } else {
        setStatus("Notifications are switched off for Almanac. You can allow them in your phone's settings.");
      }
    } catch {
      setStatus("The reminder could not be saved.");
    }
  }

  const kinds: { kind: ReminderKind; label: string }[] = [
    { kind: "meals", label: "Remind me to log meals" },
    ...(weighInReminder ? [{ kind: "weigh" as const, label: "Remind me to weigh in" }] : []),
  ];

  return (
    <Section title="This phone">
      <div className="border-t border-rule">
        {lockable ? (
          <Toggle
            label="Lock Almanac"
            hint="Ask for Face ID, a fingerprint or your passcode when the app is opened."
            checked={lock}
            onChange={(on) => void changeLock(on)}
          />
        ) : null}
        {kinds.map(({ kind, label }) => (
          <div key={kind}>
            <Toggle label={label} checked={reminders[kind].on} onChange={(on) => void changeReminder(kind, { on })} />
            {reminders[kind].on ? (
              <label className="flex items-center justify-between gap-4 border-b border-rule py-2 pl-8">
                <span className="text-sm text-ink-soft">Time</span>
                <input
                  type="time"
                  value={reminders[kind].time}
                  onChange={(e) => e.target.value && void changeReminder(kind, { time: e.target.value })}
                  className="nums min-h-11 bg-transparent text-lg outline-none"
                />
              </label>
            ) : null}
          </div>
        ))}
      </div>
      <p role="status" className="mt-3 text-sm leading-relaxed text-ink-soft">
        {status}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">These apply to this phone only. Reminders are set on the phone itself and are not sent from a server.</p>
    </Section>
  );
}
