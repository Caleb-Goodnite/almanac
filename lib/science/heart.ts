/** Heart-rate estimates. Sources: docs/RESEARCH.md#heart-rate. */

/**
 * Tanaka et al. (2001): HRmax = 208 - 0.7 x age. Derived from adults; for an
 * individual the true value commonly differs by 10 beats or more either way.
 */
export function estimatedMaxHr(ageYears: number): number {
  return Math.round(208 - 0.7 * ageYears);
}

export type Zone = { key: "light" | "moderate" | "vigorous" | "near_max"; label: string; min: number; max: number };

/**
 * Intensity zones as a percent of maximum heart rate, from the ACSM position
 * stand (Garber et al. 2011): light 57-63%, moderate 64-76%, vigorous 77-95%,
 * near-maximal 96% and above.
 */
export function zonesFromMaxHr(maxHr: number): Zone[] {
  const at = (pct: number) => Math.round((maxHr * pct) / 100);
  return [
    { key: "light", label: "Light", min: at(57), max: at(63) },
    { key: "moderate", label: "Moderate", min: at(64), max: at(76) },
    { key: "vigorous", label: "Vigorous", min: at(77), max: at(95) },
    { key: "near_max", label: "Near maximal", min: at(96), max: maxHr },
  ];
}

/**
 * Heart-rate reserve (Karvonen) method, more individual when resting heart
 * rate is known: target = rest + fraction x (max - rest). ACSM bands: light
 * 30-39%, moderate 40-59%, vigorous 60-89%, near-maximal 90% and above.
 */
export function zonesFromReserve(maxHr: number, restingHr: number): Zone[] {
  const at = (pct: number) => Math.round(restingHr + ((maxHr - restingHr) * pct) / 100);
  return [
    { key: "light", label: "Light", min: at(30), max: at(39) },
    { key: "moderate", label: "Moderate", min: at(40), max: at(59) },
    { key: "vigorous", label: "Vigorous", min: at(60), max: at(89) },
    { key: "near_max", label: "Near maximal", min: at(90), max: maxHr },
  ];
}

export function zoneForHr(zones: readonly Zone[], hr: number): Zone["key"] | "below" {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (hr >= zones[i]!.min) return zones[i]!.key;
  }
  return "below";
}
