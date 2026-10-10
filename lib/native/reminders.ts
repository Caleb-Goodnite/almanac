import { isNativeApp } from "./platform";

/**
 * Daily reminders are local notifications scheduled on the phone itself: no
 * push service, no server, nothing leaves the device. The choice is kept in
 * the phone's storage and re-applied whenever it changes.
 */
export type ReminderKind = "meals" | "weigh";
export type ReminderSettings = Record<ReminderKind, { on: boolean; time: string }>;

const KEY = "almanac.reminders";
const IDS: Record<ReminderKind, number> = { meals: 4101, weigh: 4102 };
// Plain prompts with no streaks, guilt or numbers.
const TEXT: Record<ReminderKind, { title: string; body: string }> = {
  meals: { title: "Almanac", body: "A moment to note what you ate today, if you'd like." },
  weigh: { title: "Almanac", body: "Weigh-in time, if you're tracking it." },
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  meals: { on: false, time: "19:30" },
  weigh: { on: false, time: "07:30" },
};

export function loadReminders(): ReminderSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<ReminderSettings> | null;
    return { meals: { ...DEFAULT_REMINDERS.meals, ...stored?.meals }, weigh: { ...DEFAULT_REMINDERS.weigh, ...stored?.weigh } };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

/** Saves the settings and makes the phone's schedule match them. Returns false if notifications are not allowed. */
export async function applyReminders(settings: ReminderSettings): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const wanted = (Object.keys(IDS) as ReminderKind[]).filter((kind) => settings[kind].on);

  if (wanted.length > 0) {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return false;
  }
  await LocalNotifications.cancel({ notifications: Object.values(IDS).map((id) => ({ id })) });
  if (wanted.length > 0) {
    await LocalNotifications.schedule({
      notifications: wanted.map((kind) => {
        const [hour = 0, minute = 0] = settings[kind].time.split(":").map(Number);
        return { id: IDS[kind], ...TEXT[kind], schedule: { on: { hour, minute }, allowWhileIdle: true } };
      }),
    });
  }
  localStorage.setItem(KEY, JSON.stringify(settings));
  return true;
}
