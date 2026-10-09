import type { Sex } from "./types";

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** WHO adult cut-off for underweight. */
export const ADULT_UNDERWEIGHT_BMI = 18.5;

/**
 * CDC 2000 BMI-for-age LMS parameters at six-month steps from 12.5 to 19.5
 * years (source: CDC growth charts data file bmiagerev.csv). Values between
 * steps are linearly interpolated, which is accurate to well under one
 * percentile point over this range.
 * Row: [age in months, L, M, S].
 */
type Lms = readonly [number, number, number, number];

const BOYS: readonly Lms[] = [
  [150.5, -2.385858029, 18.1387275, 0.132990575],
  [156.5, -2.3294571, 18.47179706, 0.13414147],
  [162.5, -2.277017201, 18.81201584, 0.134879611],
  [168.5, -2.227362173, 19.15758672, 0.135251083],
  [174.5, -2.179425674, 19.50672885, 0.135308594],
  [180.5, -2.132344989, 19.85766121, 0.135110159],
  [186.5, -2.085574403, 20.20858236, 0.134718085],
  [192.5, -2.039015385, 20.5576474, 0.134198323],
  [198.5, -1.993150137, 20.90294449, 0.1336202],
  [204.5, -1.949134561, 21.24247982, 0.13305669],
  [210.5, -1.908831065, 21.57417053, 0.132584784],
  [216.5, -1.874670324, 21.8958685, 0.132286382],
  [222.5, -1.849323204, 22.20541249, 0.132248993],
  [228.5, -1.835138046, 22.50071778, 0.132566359],
  [234.5, -1.833400825, 22.7798953, 0.133338999],
];

const GIRLS: readonly Lms[] = [
  [150.5, -1.959520079, 18.42002284, 0.149783482],
  [156.5, -1.954977947, 18.73643338, 0.150705138],
  [162.5, -1.9610997, 19.04811118, 0.151176355],
  [168.5, -1.977073595, 19.35257209, 0.151255713],
  [174.5, -2.002014224, 19.64746266, 0.151009595],
  [180.5, -2.034893091, 19.9305662, 0.150511645],
  [186.5, -2.074459502, 20.19980767, 0.14984254],
  [192.5, -2.119156972, 20.45325617, 0.14909006],
  [198.5, -2.167044578, 20.6891237, 0.148349348],
  [204.5, -2.215737645, 20.90575839, 0.147723315],
  [210.5, -2.26238209, 21.10163241, 0.147323144],
  [216.5, -2.303687802, 21.27532239, 0.14726877],
  [222.5, -2.336038473, 21.42548351, 0.147689289],
  [228.5, -2.355677743, 21.55082155, 0.148723546],
  [234.5, -2.358980464, 21.65006126, 0.150520734],
];

function lmsAt(table: readonly Lms[], ageMonths: number): [number, number, number] {
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (ageMonths <= first[0]) return [first[1], first[2], first[3]];
  if (ageMonths >= last[0]) return [last[1], last[2], last[3]];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1]!;
    const b = table[i]!;
    if (ageMonths <= b[0]) {
      const t = (ageMonths - a[0]) / (b[0] - a[0]);
      return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])];
    }
  }
  return [last[1], last[2], last[3]];
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26; absolute error < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * BMI-for-age percentile (0-100) from the CDC 2000 reference, for ages 12.5 to
 * 19.5. With sex "unspecified" the lower of the two percentiles is returned,
 * the cautious choice when the result gates a calorie deficit.
 */
export function bmiForAgePercentile(sex: Sex, ageMonths: number, bmiValue: number): number {
  const one = (table: readonly Lms[]) => {
    const [L, M, S] = lmsAt(table, ageMonths);
    const z = ((bmiValue / M) ** L - 1) / (L * S);
    return normalCdf(z) * 100;
  };
  if (sex === "male") return one(BOYS);
  if (sex === "female") return one(GIRLS);
  return Math.min(one(BOYS), one(GIRLS));
}
