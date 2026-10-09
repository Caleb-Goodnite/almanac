/**
 * Energy cost of activity from MET values.
 * MET values and codes are from the 2024 Adult Compendium of Physical
 * Activities (Herrmann et al. 2024; pacompendium.com).
 *
 *   kcal = MET x body weight (kg) x hours
 *
 * This is gross energy: it includes what the person would have burned at rest
 * in that time. It is a population average for adults and can be off by a
 * wide margin for an individual, and adult METs fit teenagers less well (the
 * Youth Compendium uses different values). The UI always labels the result as
 * an estimate and never adds it back to the calorie budget.
 */

export type Activity = { key: string; label: string; code: string; met: number; group: string };

export const ACTIVITIES: readonly Activity[] = [
  { key: "walk_slow", label: "Walking, slow (2.0-2.4 mph)", code: "17152", met: 2.8, group: "Walking" },
  { key: "walk_moderate", label: "Walking, moderate (2.8-3.4 mph)", code: "17190", met: 3.8, group: "Walking" },
  { key: "walk_brisk", label: "Walking, brisk (3.5-3.9 mph)", code: "17200", met: 4.8, group: "Walking" },
  { key: "walk_very_brisk", label: "Walking, very brisk (4.0-4.4 mph)", code: "17220", met: 5.5, group: "Walking" },
  { key: "hike", label: "Hiking, cross country", code: "17080", met: 6.0, group: "Walking" },

  { key: "jog", label: "Jogging, easy pace", code: "12020", met: 7.5, group: "Running" },
  { key: "run_5mph", label: "Running, 5 mph (12 min/mile)", code: "12030", met: 8.5, group: "Running" },
  { key: "run_6mph", label: "Running, 6 mph (10 min/mile)", code: "12050", met: 9.3, group: "Running" },
  { key: "run_7mph", label: "Running, 7 mph (8.5 min/mile)", code: "12070", met: 11.0, group: "Running" },
  { key: "run_8mph", label: "Running, 8 mph (7.5 min/mile)", code: "12090", met: 12.0, group: "Running" },
  { key: "run_10mph", label: "Running, 10 mph (6 min/mile)", code: "12120", met: 14.8, group: "Running" },

  { key: "cycle_leisure", label: "Cycling, leisure (under 10 mph)", code: "01010", met: 4.0, group: "Cycling" },
  { key: "cycle_light", label: "Cycling, light (10-11.9 mph)", code: "01020", met: 6.8, group: "Cycling" },
  { key: "cycle_moderate", label: "Cycling, moderate (12-13.9 mph)", code: "01030", met: 8.0, group: "Cycling" },
  { key: "cycle_vigorous", label: "Cycling, fast (14-15.9 mph)", code: "01040", met: 10.0, group: "Cycling" },
  { key: "cycle_racing", label: "Cycling, racing (16-19 mph)", code: "01050", met: 12.0, group: "Cycling" },
  { key: "cycle_mountain", label: "Mountain biking", code: "01009", met: 8.5, group: "Cycling" },

  { key: "swim_easy", label: "Swimming laps, easy", code: "18240", met: 5.8, group: "Water" },
  { key: "swim_hard", label: "Swimming laps, hard", code: "18230", met: 9.8, group: "Water" },
  { key: "swim_leisure", label: "Swimming, leisurely", code: "18310", met: 6.0, group: "Water" },
  { key: "water_aerobics", label: "Water aerobics", code: "18355", met: 5.5, group: "Water" },
  { key: "kayak", label: "Kayaking, moderate", code: "18100", met: 5.0, group: "Water" },

  { key: "weights", label: "Weight training, general", code: "02054", met: 3.5, group: "Gym" },
  { key: "weights_heavy", label: "Weight training, squats and deadlifts", code: "02052", met: 5.0, group: "Gym" },
  { key: "circuit_moderate", label: "Circuit training, moderate", code: "02035", met: 5.0, group: "Gym" },
  { key: "circuit_vigorous", label: "Circuit training, vigorous", code: "02040", met: 7.5, group: "Gym" },
  { key: "calisthenics_moderate", label: "Bodyweight exercise, moderate", code: "02022", met: 3.8, group: "Gym" },
  { key: "calisthenics_vigorous", label: "Bodyweight exercise, vigorous", code: "02020", met: 7.5, group: "Gym" },
  { key: "elliptical", label: "Elliptical, moderate", code: "02048", met: 5.0, group: "Gym" },
  { key: "row_moderate", label: "Rowing machine, moderate", code: "02071", met: 5.0, group: "Gym" },
  { key: "row_vigorous", label: "Rowing machine, vigorous", code: "02070", met: 7.3, group: "Gym" },
  { key: "stairs", label: "Stair machine", code: "02065", met: 9.3, group: "Gym" },
  { key: "hiit_moderate", label: "Interval training, moderate", code: "02210", met: 7.0, group: "Gym" },
  { key: "hiit_vigorous", label: "Interval training, vigorous", code: "02214", met: 11.0, group: "Gym" },
  { key: "jump_rope", label: "Jump rope", code: "02068", met: 11.0, group: "Gym" },
  { key: "yoga", label: "Yoga, hatha", code: "02150", met: 2.3, group: "Gym" },
  { key: "pilates", label: "Pilates", code: "02105", met: 2.8, group: "Gym" },
  { key: "stretch", label: "Stretching, mild", code: "02101", met: 2.3, group: "Gym" },

  { key: "basketball", label: "Basketball", code: "15055", met: 7.5, group: "Sport" },
  { key: "soccer", label: "Soccer, casual", code: "15610", met: 7.0, group: "Sport" },
  { key: "soccer_match", label: "Soccer, competitive", code: "15605", met: 9.5, group: "Sport" },
  { key: "tennis", label: "Tennis, general", code: "15675", met: 6.8, group: "Sport" },
  { key: "tennis_doubles", label: "Tennis, doubles", code: "15685", met: 4.5, group: "Sport" },
  { key: "volleyball", label: "Volleyball", code: "15710", met: 4.0, group: "Sport" },
  { key: "badminton", label: "Badminton, social", code: "15030", met: 5.5, group: "Sport" },
  { key: "table_tennis", label: "Table tennis", code: "15660", met: 4.0, group: "Sport" },
  { key: "golf", label: "Golf, walking with clubs", code: "15265", met: 4.3, group: "Sport" },
  { key: "martial_arts", label: "Martial arts, moderate", code: "15430", met: 10.3, group: "Sport" },
  { key: "boxing", label: "Boxing, sparring", code: "15120", met: 7.8, group: "Sport" },
  { key: "climbing", label: "Rock climbing", code: "15533", met: 8.0, group: "Sport" },
  { key: "skateboard", label: "Skateboarding", code: "15580", met: 5.0, group: "Sport" },
  { key: "flag_football", label: "Football, touch or flag", code: "15230", met: 8.0, group: "Sport" },
  { key: "hockey", label: "Ice hockey", code: "15360", met: 8.0, group: "Sport" },
];

const BY_KEY = new Map(ACTIVITIES.map((a) => [a.key, a]));

export function activityByKey(key: string): Activity | undefined {
  return BY_KEY.get(key);
}

/** Gross energy cost in kcal. */
export function kcalFromMet(met: number, weightKg: number, minutes: number): number {
  return met * weightKg * (minutes / 60);
}

/** WHO/ACSM intensity bands by MET: light under 3, moderate 3 to under 6, vigorous 6 and above. */
export function intensityFromMet(met: number): "light" | "moderate" | "vigorous" {
  if (met < 3) return "light";
  if (met < 6) return "moderate";
  return "vigorous";
}
