/** The medical disclaimer shown in onboarding and in every footer. */
export const DISCLAIMER =
  "Almanac gives general information for healthy people. It is not medical advice and it cannot diagnose or treat anything. Talk to a doctor before changing how you eat or train if you are pregnant, have a medical condition or an injury, take medication, or have ever had an eating disorder.";

export function Disclaimer({ className }: { className?: string }) {
  return <p className={className ?? "text-sm leading-relaxed text-ink-soft"}>{DISCLAIMER}</p>;
}
