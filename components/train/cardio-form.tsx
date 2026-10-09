"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logCardioAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Why } from "@/components/ui/why";
import { fmt, type UnitSystem } from "@/lib/format";
import { estimatedMaxHr, zoneForHr, zonesFromMaxHr, zonesFromReserve } from "@/lib/science/heart";
import { ACTIVITIES, intensityFromMet, kcalFromMet } from "@/lib/science/met";
import { milesToKm } from "@/lib/science/units";

const GROUPS = [...new Set(ACTIVITIES.map((a) => a.group))];

type Props = {
  date: string;
  weightKg: number | null;
  units: UnitSystem;
  ageYears: number;
  /** Recent average resting heart rate from check-ins, if any. */
  restingHr: number | null;
};

export function CardioForm({ date, weightKg, units, ageYears, restingHr }: Props) {
  const router = useRouter();
  const [activity, setActivity] = useState("walk_brisk");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = ACTIVITIES.find((a) => a.key === activity);
  const mins = Number(minutes);
  const dist = Number(distance);
  const distanceKm = distance && dist > 0 ? (units === "imperial" ? milesToKm(dist) : dist) : null;
  const estimate = chosen && weightKg && mins > 0 ? kcalFromMet(chosen.met, weightKg, mins) : null;
  const distUnit = units === "imperial" ? "mi" : "km";
  const maxHr = estimatedMaxHr(ageYears);
  const hr = Number(avgHr);
  // With a resting heart rate on file, zones use heart-rate reserve, which
  // accounts for the person's own baseline; otherwise percent of maximum.
  const usesReserve = restingHr != null && restingHr < maxHr - 20;
  const zones = usesReserve ? zonesFromReserve(maxHr, restingHr) : zonesFromMaxHr(maxHr);
  const zone = avgHr && hr >= 30 ? zoneForHr(zones, hr) : null;
  const ZONE_TEXT = { below: "very light", light: "light", moderate: "moderate", vigorous: "vigorous", near_max: "near maximal" } as const;
  // Pace as minutes per distance unit, shown in the user's units.
  const pace = dist > 0 && mins > 0 ? mins / dist : null;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await logCardioAction({
            clientId: crypto.randomUUID(),
            date,
            activity,
            durationMin: minutes,
            distanceKm: distanceKm ?? "",
            avgHr,
            notes: "",
          });
          if (res.ok) {
            router.push("/train");
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="label">Activity</span>
        <select value={activity} onChange={(e) => setActivity(e.target.value)} className="min-h-12 border-b border-rule-strong bg-transparent text-lg outline-none focus:border-ink">
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {ACTIVITIES.filter((a) => a.group === g).map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Duration" unit="min" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        <Field label="Distance (optional)" unit={distUnit} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
        <Field
          className="col-span-2"
          label="Average heart rate (optional)"
          unit="bpm"
          inputMode="numeric"
          value={avgHr}
          onChange={(e) => setAvgHr(e.target.value)}
          hint="From your watch, fitness band or chest strap: look for the session&rsquo;s average."
        />
      </div>

      <dl className="nums grid grid-cols-3 gap-3 border-y border-rule py-4" aria-live="polite">
        <div>
          <dt className="label">Estimated energy</dt>
          <dd className="mt-1 font-display text-2xl">{estimate == null ? "–" : `~${fmt(estimate)}`}<span className="label ml-1">kcal</span></dd>
        </div>
        <div>
          <dt className="label">Intensity</dt>
          <dd className="mt-1 font-display text-2xl capitalize">{chosen ? intensityFromMet(chosen.met) : "–"}</dd>
        </div>
        <div>
          <dt className="label">Pace</dt>
          <dd className="mt-1 font-display text-2xl">
            {pace == null ? "–" : `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")}`}
            <span className="label ml-1">/{distUnit}</span>
          </dd>
        </div>
      </dl>
      {zone ? (
        <div>
          <p className="nums text-sm leading-relaxed">
            An average of {hr} bpm is <span className="font-medium">{ZONE_TEXT[zone]}</span> effort for you
            {usesReserve
              ? `, about ${Math.max(0, Math.round(((hr - restingHr) / (maxHr - restingHr)) * 100))}% of the way from your resting ${restingHr} bpm to an estimated maximum of ${maxHr}.`
              : `, about ${Math.round((hr / maxHr) * 100)}% of an estimated maximum of ${maxHr} bpm. Log a resting heart rate in your check-in for a more personal reading.`}
          </p>
          <Why label="How is the heart-rate zone worked out?" source="heart-rate" cite="Tanaka et al. 2001; ACSM 2011">
            Maximum heart rate is estimated as 208 minus 0.7 times your age. Effort bands are
            ACSM&rsquo;s: a share of the gap between your resting and maximum rate when a resting
            rate is on file, otherwise a share of the maximum. The estimated maximum can be off by
            10 beats or more for any one person.
          </Why>
        </div>
      ) : null}
      <Why label="How is energy estimated?" source="activity" cite="2024 Compendium of Physical Activities">
        This is an estimate: the activity’s average intensity ({chosen?.met} MET) times your
        weight and the time. It includes what you would have burned at rest and can be well off
        for any one person, so it is not added to your calorie target.
      </Why>

      {error ? (
        <p role="alert" className="text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Log activity"}
      </Button>
    </form>
  );
}
