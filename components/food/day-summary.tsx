import { CountUp } from "@/components/ui/count-up";
import { Meter } from "@/components/ui/meter";
import { Ring } from "@/components/ui/ring";
import type { Totals } from "@/lib/data/food-logs";
import { fmt } from "@/lib/format";

type Props = {
  totals: Totals;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  /** Teens and anyone in support mode see intake against needs, not a budget to stay under. */
  neutral: boolean;
  size?: number;
};

/** The calorie ring and three macro bars shared by Today and Food. */
export function DaySummary({ totals, targets, neutral, size = 190 }: Props) {
  const remaining = targets.calories - totals.kcal;
  const over = remaining < 0;
  const headline = neutral ? totals.kcal : Math.abs(remaining);
  const caption = neutral ? `of about ${fmt(targets.calories)} kcal` : over ? "kcal over" : "kcal left";

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
      <div className="justify-self-center">
        <Ring
          progress={targets.calories > 0 ? totals.kcal / targets.calories : 0}
          size={size}
          label={`${fmt(totals.kcal)} of ${fmt(targets.calories)} kilocalories eaten`}
        >
          <div>
            <p className="figure text-[3.25rem]!">
              <CountUp value={Math.round(headline)} />
            </p>
            <p className="label mt-1">{caption}</p>
          </div>
        </Ring>
      </div>
      <div className="flex flex-col gap-4">
        <Meter label="Protein" value={totals.proteinG} target={targets.proteinG} unit="g" pattern="solid" />
        <Meter label="Carbohydrate" value={totals.carbsG} target={targets.carbsG} unit="g" pattern="hatch" />
        <Meter label="Fat" value={totals.fatG} target={targets.fatG} unit="g" pattern="dots" />
        <dl className="nums flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          <div className="flex gap-1.5">
            <dt>Fiber</dt>
            <dd className="text-ink">
              {fmt(totals.fiberG)} / {fmt(targets.fiberG)} g
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Sugar</dt>
            <dd className="text-ink">{fmt(totals.sugarG)} g</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Sodium</dt>
            <dd className="text-ink">{fmt(totals.sodiumMg)} mg</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
