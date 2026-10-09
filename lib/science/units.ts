/** Unit conversion. Everything is stored in metric; these are for display and input. */

export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;
export const ML_PER_FL_OZ = 29.5735295625;
export const KM_PER_MILE = 1.609344;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;
export const kmToMiles = (km: number) => km / KM_PER_MILE;
export const milesToKm = (miles: number) => miles * KM_PER_MILE;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cmToIn(cm));
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inToCm(feet * 12 + inches);
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
