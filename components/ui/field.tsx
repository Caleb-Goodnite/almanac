import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Unit shown after the value, e.g. "kg". Read out as part of the label. */
  unit?: string;
};

/**
 * A text input drawn as a ruled line, the way a form is set in print.
 * Label, hint and error are wired with aria-describedby; the error is also
 * marked with text, never colour alone.
 */
export function Field({ label, hint, error, unit, className, ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="label">
        {label}
        {unit ? <span className="sr-only"> in {unit}</span> : null}
      </label>
      <div
        className={cn(
          "flex items-baseline gap-2 border-b pb-1 transition-colors",
          "focus-within:border-ink",
          error ? "border-accent-strong" : "border-rule-strong",
        )}
      >
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="nums min-h-11 w-full min-w-0 bg-transparent text-lg text-ink outline-none placeholder:text-ink-faint"
          {...props}
        />
        {unit ? (
          <span aria-hidden className="label shrink-0">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-accent-strong">
          <span aria-hidden>! </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
