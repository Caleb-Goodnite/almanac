"use client";

import { useEffect, useState, useTransition } from "react";
import { importHealthAction } from "@/app/(app)/body/actions";
import { Button } from "@/components/ui/button";
import { healthAvailable, readHealth } from "@/lib/native/health";
import { nativePlatform, tapFeedback } from "@/lib/native/platform";

const DAYS = 30;

/**
 * Pulls weight, sleep, resting heart rate and cardio from Apple Health or
 * Health Connect. Shown only inside the phone app on a device that has one of
 * them; in a browser it renders nothing.
 */
export function HealthImport() {
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void healthAvailable().then((available) => {
      if (available && !cancelled) setSource(nativePlatform() === "ios" ? "Apple Health" : "Health Connect");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!source) return null;

  function run() {
    setMessage(null);
    startTransition(async () => {
      const read = await readHealth(DAYS);
      if (!read.ok) {
        setMessage({
          ok: false,
          text:
            read.reason === "denied"
              ? `Almanac does not have permission to read ${source}. You can allow it in your phone's settings.`
              : `Could not read ${source}. Try again in a moment.`,
        });
        return;
      }
      const res = await importHealthAction(read.data);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      const { weights, sleep, restingHr, workouts } = res.counts;
      const parts = [
        weights ? `${weights} weigh-in${weights === 1 ? "" : "s"}` : null,
        sleep ? `${sleep} night${sleep === 1 ? "" : "s"} of sleep` : null,
        restingHr ? `${restingHr} resting heart rate${restingHr === 1 ? "" : "s"}` : null,
        workouts ? `${workouts} cardio session${workouts === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      void tapFeedback();
      setMessage({ ok: true, text: parts.length ? `Added ${parts.join(", ")}.` : "Nothing new to add. Everything is up to date." });
    });
  }

  return (
    <div className="border-l-2 border-rule-strong py-1 pl-3">
      <p className="text-sm leading-relaxed text-ink-soft">
        Bring in the last {DAYS} days of weight, sleep, resting heart rate and cardio from {source}. Days you have
        already filled in are left alone, and nothing is written back.
      </p>
      <Button variant="outline" className="mt-3" onClick={run} disabled={pending}>
        {pending ? "Importing…" : `Import from ${source}`}
      </Button>
      <p role="status" className={`mt-2 text-sm leading-relaxed ${message && !message.ok ? "font-medium text-accent-strong" : "text-ink-soft"}`}>
        {message ? (message.ok ? message.text : `! ${message.text}`) : ""}
      </p>
    </div>
  );
}
