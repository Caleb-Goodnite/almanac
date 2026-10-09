import { EXTREME_INTAKE_KCAL } from "./policy";

/**
 * Screens a message the user typed to the coach for signs that they may be
 * struggling with eating, exercise or thoughts of self-harm.
 *
 * This runs in code, before any model is called, so the response to the most
 * serious cases never depends on a language model behaving well.
 *
 * It is deliberately a small, readable list of patterns. It will miss things
 * and it will sometimes fire on innocent phrasing; the responses are written
 * to be kind either way. It is a backstop, not a screening tool, and the list
 * needs review by an eating-disorder clinician (see COMPLIANCE.md).
 */

export type ScreenLevel = "none" | "soft" | "strong" | "crisis";

export type ScreenResult = {
  level: ScreenLevel;
  /** Short machine labels of what matched, stored with the message for review. */
  signals: string[];
};

type Rule = { signal: string; level: Exclude<ScreenLevel, "none">; pattern: RegExp };

const RULES: readonly Rule[] = [
  // Thoughts of self-harm or suicide: always handled with crisis resources.
  { signal: "self_harm", level: "crisis", pattern: /\b(kill(ing)? myself|suicid(e|al)|end (it all|my life)|want(ed)? to die|don'?t want to (live|be alive|be here anymore)|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself)\b/i },

  // Purging and compensatory behaviour.
  { signal: "purging", level: "strong", pattern: /\b(purg(e|es|ed|ing)|make myself (throw up|sick|vomit)|made myself (throw up|sick|vomit)|throw(ing)? up (after|my|what)|vomit(ing)? after|self[- ]?induced vomit)/i },
  { signal: "laxatives", level: "strong", pattern: /\b(laxatives?|diuretics?|water pills?|diet pills?|ipecac)\b/i },
  { signal: "starving", level: "strong", pattern: /\b(starv(e|ing) myself|stop(ped)? eating|not eat(ing)? (at all|anything)|eat(ing)? nothing|go(ing)? without (food|eating)|refus(e|ing) to eat|haven'?t eaten (in|for) (\d+|two|three|four|several|a few) days)\b/i },
  { signal: "pro_ana", level: "strong", pattern: /\b(pro[- ]?ana|pro[- ]?mia|thinspo|bonespo|meanspo|thigh gap|anorexi[ac]|bulimi[ac])\b/i },
  { signal: "punish_exercise", level: "strong", pattern: /\b(burn off (everything|every calorie|what i (ate|eat))|exercise (until|till) i (pass out|collapse|faint)|punish myself|have to (work|burn) (it|that) off|can'?t stop exercising)\b/i },
  { signal: "long_fast", level: "strong", pattern: /\b(water fast|dry fast|(\d{2,3})[- ]?hour fast|fast(ing)? for (\d+|two|three|four|five|six|seven|several) days)\b/i },

  // Distress around food and body that deserves a careful, non-optimising reply.
  { signal: "food_guilt", level: "soft", pattern: /\b(guilty|ashamed|disgust(ed|ing)|hate myself|worthless|out of control|lost control|can'?t stop) .{0,40}\b(eat|eating|ate|food|binge|binged|meal)\b|\b(binge|binged|bingeing|binging)\b/i },
  { signal: "body_distress", level: "soft", pattern: /\b(hate (my body|how i look|the way i look)|i'?m (so )?(fat|disgusting|gross|huge)|feel (so )?(fat|disgusting|gross)|afraid of (gaining|getting fat)|terrified of (gaining|food|eating))\b/i },
  { signal: "crash_diet", level: "soft", pattern: /\b(crash diet|as fast as possible|lose weight (fast|quick|quickly)|quickest way to lose|drop \d+ ?(kg|kgs|kilos|lb|lbs|pounds) in (a|one|two|\d) (day|days|week)|skip(ping)? meals|zero[- ]?calorie day)\b/i },
];

/** Daily calorie figures the user is asking about, e.g. "500 calories a day". */
function mentionedIntakes(text: string): number[] {
  const out: number[] = [];
  const re = /\b(\d{2,4})\s*(k?cal(ories)?|calories)\b(?!\s*(deficit|burn|burned|less|fewer|under|below|more|surplus|over))/gi;
  for (const m of text.matchAll(re)) out.push(Number(m[1]));
  return out;
}

export function screenMessage(text: string): ScreenResult {
  const signals = new Set<string>();
  let level: ScreenLevel = "none";
  const rank = { none: 0, soft: 1, strong: 2, crisis: 3 } as const;
  const raise = (to: Exclude<ScreenLevel, "none">, signal: string) => {
    signals.add(signal);
    if (rank[to] > rank[level]) level = to;
  };

  for (const rule of RULES) {
    if (rule.pattern.test(text)) raise(rule.level, rule.signal);
  }

  // Asking to eat a clearly unsafe amount in a day, as a plan rather than a food's label.
  const asksToEat = /\b(eat|eating|ate|intake|diet|a day|per day|daily|only|just|limit|stick to|survive on)\b/i.test(text);
  for (const kcal of mentionedIntakes(text)) {
    if (asksToEat && kcal > 0 && kcal < 800) raise("strong", "extreme_intake");
    else if (asksToEat && kcal < EXTREME_INTAKE_KCAL) raise("soft", "very_low_intake");
  }

  return { level, signals: [...signals] };
}

/**
 * Checks text the model produced before it is saved. If the model has
 * recommended eating below the hard floor, the reply gets a correction added.
 */
export function violatesFloor(reply: string, floorKcal: number): boolean {
  // "1,000" and "1000" should read the same.
  const text = reply.replace(/(\d),(\d{3})\b/g, "$1$2");
  const re =
    /\b(?:eat|eating|aim for|target of?|intake of|stick to|consume|drop to|cut to|go down to|limit (?:yourself )?to)\b[^.\n]{0,40}?\b(?<kcal>\d{3,4})\s*(?:k?cal|calories)\b/gi;
  for (const m of text.matchAll(re)) {
    const kcal = Number(m.groups?.kcal);
    if (kcal >= 300 && kcal < floorKcal) return true;
  }
  return false;
}
