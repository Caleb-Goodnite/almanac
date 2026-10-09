import { cn } from "@/lib/utils/cn";

type Props = {
  legend: string;
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Words for 1 and 5, shown under the ends and read out with each option. */
  low: string;
  high: string;
};

/** A 1-to-5 rating as five large radio buttons with word anchors at each end. */
export function Scale({ legend, name, value, onChange, low, high }: Props) {
  return (
    <fieldset>
      <legend className="label mb-1.5">{legend}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={cn(
              "nums grid min-h-12 cursor-pointer place-items-center rounded-[3px] border font-display text-xl transition-colors",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              value === n ? "border-ink bg-ink text-paper" : "border-rule-strong hover:border-ink",
            )}
          >
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <span aria-hidden>{n}</span>
            <span className="sr-only">
              {n}
              {n === 1 ? `, ${low}` : n === 5 ? `, ${high}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-soft" aria-hidden>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
