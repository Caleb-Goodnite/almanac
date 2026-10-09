import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ChoiceOption<T extends string> = { value: T; title: string; description?: ReactNode };

type ChoiceGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Lay options out side by side when they are short. */
  inline?: boolean;
  hideLegend?: boolean;
};

/**
 * A radio group set as ruled rows. Native radio inputs do the work, so arrow
 * keys, focus and screen-reader semantics come for free; the selected row is
 * marked with a filled square and heavier text as well as colour.
 */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  inline,
  hideLegend,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset>
      <legend className={cn("label mb-2", hideLegend && "sr-only")}>{legend}</legend>
      <div className={cn(inline ? "flex flex-wrap gap-2" : "border-t border-rule")}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3 py-3 transition-colors",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                inline
                  ? cn("rounded-[3px] border px-4", checked ? "border-ink bg-paper-raised" : "border-rule-strong")
                  : "border-b border-rule pr-2 hover:bg-paper-raised",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-1 grid size-4 shrink-0 place-items-center border",
                  checked ? "border-ink" : "border-rule-strong",
                )}
              >
                {checked ? <span className="size-2 bg-accent-strong" /> : null}
              </span>
              <span>
                <span className={cn("block", checked ? "font-semibold" : "font-medium")}>{o.title}</span>
                {o.description ? (
                  <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{o.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
