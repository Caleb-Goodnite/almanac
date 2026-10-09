"use client";

import { Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { deleteWeightAction } from "@/app/(app)/body/actions";
import { fmt, fmtDate, weightUnit, weightValue, type UnitSystem } from "@/lib/format";

type Entry = { date: string; kg: number };

/** The most recent weigh-ins, each editable (open that day) or removable. */
export function WeightHistory({ entries, units }: { entries: Entry[]; units: UnitSystem }) {
  const router = useRouter();
  const [shown, remove] = useOptimistic(entries, (state, date: string) => state.filter((e) => e.date !== date));
  const [, startTransition] = useTransition();

  return (
    <details className="mt-5 border-t border-rule pt-2">
      <summary className="label min-h-11 cursor-pointer content-center">Recent weigh-ins ({shown.length})</summary>
      <ul className="nums">
        {shown.map((e) => (
          <li key={e.date} className="flex items-center gap-2 border-b border-rule">
            <Link href={`/body?date=${e.date}#weight`} className="flex min-h-11 flex-1 items-center justify-between gap-3 hover:bg-paper-raised">
              <span>{fmtDate(e.date, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span>
                {fmt(weightValue(e.kg, units), 1)} {weightUnit(units)}
              </span>
            </Link>
            <button
              type="button"
              aria-label={`Remove the weigh-in from ${fmtDate(e.date, { month: "long", day: "numeric" })}`}
              className="grid size-11 place-items-center text-ink-soft hover:text-accent-strong"
              onClick={() =>
                startTransition(async () => {
                  remove(e.date);
                  await deleteWeightAction(e.date);
                  router.refresh();
                })
              }
            >
              <Trash aria-hidden size={18} weight="light" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
