import { MAX_DEFICIT_FRACTION, RATE_LIMITS } from "@/lib/safety/policy";
import { REQUEST_TTL_DAYS } from "@/lib/safety/guardian";

type Message = { subject: string; text: string };

/** Sent to the address an under-18 named as their parent or guardian. */
export function guardianRequestEmail(firstName: string, link: string): Message {
  return {
    subject: `${firstName} needs your approval in Almanac`,
    text: [
      `${firstName} uses Almanac, a food and fitness tracker, and gave this address as their parent or guardian.`,
      "",
      `${firstName} is under 18 and has asked to set a fat-loss goal. Almanac does not allow that unless a parent or guardian reads about the risks and approves it.`,
      "",
      `Read what it involves and decide here (the link works for ${REQUEST_TTL_DAYS} days):`,
      link,
      "",
      "Nothing changes unless you approve. If you do nothing, the goal stays locked.",
      "",
      `If you are not ${firstName}'s parent or guardian, or do not know who this is, ignore this email.`,
    ].join("\n"),
  };
}

/** Sent to the guardian after they approve, with the link to withdraw it. */
export function guardianApprovedEmail(firstName: string, revokeLink: string): Message {
  return {
    subject: `You approved a fat-loss goal for ${firstName}`,
    text: [
      `You approved a fat-loss goal for ${firstName} in Almanac.`,
      "",
      "What Almanac will do:",
      `- Plan loss no faster than ${RATE_LIMITS.teen.maxLossPct}% of bodyweight a week.`,
      `- Never set calories more than ${MAX_DEFICIT_FRACTION.teen * 100}% below what ${firstName} burns, or below resting needs.`,
      "- Plan no loss at all if their weight is low for their age and height.",
      "- Switch to support resources instead of targets if a message suggests distress about food or body image.",
      "",
      "Almanac is not medical advice and cannot tell whether losing weight is right for a particular teenager. Please talk with their doctor, and keep an eye out for skipped meals, secrecy about food, rapid weight loss or exercise that looks compulsive.",
      "",
      "You can withdraw your approval at any time. Keep this email; this link is the only way to do it:",
      revokeLink,
    ].join("\n"),
  };
}
