/**
 * Support resources shown when someone may be struggling with food, exercise
 * or body image. US services only for now (see COMPLIANCE.md).
 *
 * The two eating-disorder helpline numbers were confirmed by web search in
 * October 2026 (the organisations' sites and the US Office on Women's Health
 * 2026 resource list). 988 and Crisis Text Line are long-established national
 * services and were not re-verified in that pass. All four need a scheduled
 * re-check: helplines do close (NEDA's did in 2023).
 */
export type Resource = { name: string; contact: string; detail: string; href: string };

export const EATING_SUPPORT: readonly Resource[] = [
  {
    name: "ANAD Helpline",
    contact: "1-888-375-7767",
    detail: "Free, confidential support for eating concerns. Weekdays.",
    href: "https://anad.org/",
  },
  {
    name: "National Alliance for Eating Disorders",
    contact: "1-866-662-1235",
    detail: "Helpline staffed by licensed therapists. Weekdays.",
    href: "https://www.allianceforeatingdisorders.com/",
  },
];

export const CRISIS_SUPPORT: readonly Resource[] = [
  {
    name: "988 Suicide and Crisis Lifeline",
    contact: "Call or text 988",
    detail: "Any time, for any kind of emotional distress.",
    href: "https://988lifeline.org/",
  },
  {
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    detail: "Any time, by text.",
    href: "https://www.crisistextline.org/",
  },
];

export const SUPPORT_MESSAGE = {
  heading: "You deserve support with this.",
  body: "Some of what you have shared sounds like food, exercise or your body might be weighing on you. That is more common than people think, and it is not something you have to manage alone or fix with stricter numbers.",
  teenExtra: "Talking to a parent, a school counselor or your doctor is a good first step.",
  adultExtra: "A doctor or a registered dietitian can help, and so can the people below.",
} as const;
