import { CRISIS_SUPPORT, EATING_SUPPORT } from "@/lib/safety/resources";

/**
 * Fixed replies for the most serious situations. These are written by people
 * and sent as-is: no model is involved, so they cannot be talked out of.
 * Wording needs clinical review (see COMPLIANCE.md).
 */

const list = (items: typeof CRISIS_SUPPORT) => items.map((r) => `- **${r.name}:** ${r.contact}. ${r.detail}`).join("\n");

export function crisisReply(isTeen: boolean): string {
  return [
    "I'm really glad you told me. What you're feeling matters, and you deserve support from a person right now, not from an app.",
    "If you might act on these thoughts or you're in danger, please call your local emergency number now.",
    "You can reach someone at any hour here (United States):",
    list(CRISIS_SUPPORT),
    isTeen
      ? "If you can, tell a parent, a school counselor or another adult you trust today. You don't have to explain everything; \"I'm not okay and I need help\" is enough."
      : "If you can, tell someone you trust today, or contact your doctor. You don't have to explain everything; \"I'm not okay and I need help\" is enough.",
    "I'm still here if you want to keep talking.",
  ].join("\n\n");
}

export function supportReply(isTeen: boolean): string {
  return [
    "Thank you for telling me that. I'm not going to help with eating less or burning more here, because what you've described sounds hard, and stricter numbers tend to make it harder, not easier.",
    "What you're going through is more common than most people realise, and it's something people get real help with.",
    isTeen
      ? "The best next step is to talk to a parent, a school counselor or your doctor. These helplines are free and confidential too (United States):"
      : "A doctor or a registered dietitian is a good next step. These helplines are free and confidential too (United States):",
    list(EATING_SUPPORT),
    "I've set your targets to maintain for now and turned down the weight tracking, so the app isn't pushing you. You can change that back in Settings whenever you want, and the Support page has these numbers saved.",
    "If you'd like, we can talk about something gentler: regular meals, sleep, or movement you actually enjoy.",
  ].join("\n\n");
}

export function floorCorrection(floorKcal: number): string {
  return `\n\n*A correction from Almanac: an earlier part of this reply mentioned eating less than ${floorKcal.toLocaleString("en-US")} kcal a day. That is below the minimum this app will ever suggest, and it is not a recommendation. Please ignore it.*`;
}
