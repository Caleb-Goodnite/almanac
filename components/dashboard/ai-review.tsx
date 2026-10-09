"use client";

import { useQuery } from "@tanstack/react-query";
import type { Review } from "@/lib/insights/review";
import { WeeklyReview } from "./weekly-review";

type Payload = { review: Review; source: "coach" | "rules" };

/**
 * Shows the rule-based review at once (it is rendered on the server), then
 * swaps in the coach's version if one is available. If the coach is off, over
 * budget or fails, nothing changes and nothing breaks.
 */
export function AiReview({ initial, weekKey }: { initial: Review; weekKey: string }) {
  const { data } = useQuery({
    queryKey: ["weekly-review", weekKey],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/coach/insights", { signal });
      if (!res.ok) throw new Error("unavailable");
      return (await res.json()) as Payload;
    },
    staleTime: 60 * 60_000,
    retry: false,
  });

  const fromCoach = data?.source === "coach";
  return (
    <div key={fromCoach ? "coach" : "rules"} className={fromCoach ? "step-in" : undefined}>
      <WeeklyReview review={fromCoach ? data.review : initial} byline={fromCoach ? "By your coach, from your numbers" : "From your numbers"} />
    </div>
  );
}
