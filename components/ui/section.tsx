import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SectionProps = {
  /** Mono kicker above the title, e.g. "No. 02" or "This week". */
  kicker?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
};

/** A page section headed like a magazine department: double rule, kicker, serif title. */
export function Section({ kicker, title, aside, children, className, id, as: Heading = "h2" }: SectionProps) {
  return (
    <section id={id} className={cn("masthead-rule", className)}>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          {kicker ? <p className="label mb-1">{kicker}</p> : null}
          <Heading className="display text-3xl sm:text-4xl">{title}</Heading>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}
