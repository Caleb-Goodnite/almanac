import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { addDays } from "@/lib/science/trend";

/** Previous / next day links. Future days are not offered. */
export function DateNav({ date, today, basePath }: { date: string; today: string; basePath: string }) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today;
  return (
    <nav aria-label="Day" className="flex items-center gap-1">
      <Link
        href={`${basePath}?date=${prev}`}
        aria-label={`Previous day, ${fmtDate(prev, { weekday: "long", month: "long", day: "numeric" })}`}
        className="grid size-11 place-items-center border border-rule-strong hover:border-ink"
      >
        <CaretLeft aria-hidden size={18} />
      </Link>
      {isToday ? (
        <span aria-disabled className="grid size-11 place-items-center border border-rule text-ink-faint opacity-50">
          <CaretRight aria-hidden size={18} />
        </span>
      ) : (
        <Link
          href={next === today ? basePath : `${basePath}?date=${next}`}
          aria-label={`Next day, ${fmtDate(next, { weekday: "long", month: "long", day: "numeric" })}`}
          className="grid size-11 place-items-center border border-rule-strong hover:border-ink"
        >
          <CaretRight aria-hidden size={18} />
        </Link>
      )}
      {!isToday ? (
        <Link href={basePath} className="label ml-2 min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Today
        </Link>
      ) : null}
    </nav>
  );
}
