import { fmt } from "@/lib/format";
import { MUSCLE_LABELS, WEEKLY_SET_TARGET, type MuscleVolume } from "@/lib/science/volume";

const AXIS_MAX = 26;
const STATUS_TEXT = { none: "none yet", below: "below range", within: "in range", above: "above range" } as const;

/**
 * Weekly hard sets per muscle group against the 10-20 set target band.
 * Every row states its status in words; the band and bar are reinforcement.
 */
export function VolumeChart({ volume }: { volume: readonly MuscleVolume[] }) {
  const pct = (n: number) => `${(Math.min(n, AXIS_MAX) / AXIS_MAX) * 100}%`;
  return (
    <div>
      <div className="grid grid-cols-[6.5rem_1fr] gap-x-3" aria-hidden>
        <span />
        <div className="relative h-4">
          <span className="label absolute -translate-x-1/2" style={{ left: pct(WEEKLY_SET_TARGET.min) }}>
            {WEEKLY_SET_TARGET.min}
          </span>
          <span className="label absolute -translate-x-1/2" style={{ left: pct(WEEKLY_SET_TARGET.max) }}>
            {WEEKLY_SET_TARGET.max}
          </span>
        </div>
      </div>
      <ul>
        {volume.map((m, i) => (
          <li key={m.group} className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 border-t border-rule py-2">
            <div>
              <p className="text-sm font-medium">{MUSCLE_LABELS[m.group]}</p>
              <p className="nums text-xs text-ink-soft">
                {fmt(m.sets, m.sets % 1 ? 1 : 0)} {m.sets === 1 ? "set" : "sets"}, {STATUS_TEXT[m.status]}
              </p>
            </div>
            <div className="relative h-3.5" aria-hidden>
              <div className="absolute inset-y-0 bg-paper-sunk" style={{ left: pct(WEEKLY_SET_TARGET.min), right: `calc(100% - ${pct(WEEKLY_SET_TARGET.max)})` }} />
              <div className="absolute inset-y-0 left-0 w-px bg-rule-strong" />
              <div
                className="bar-grow-x absolute inset-y-[3px] left-0 bg-ink"
                style={{ width: pct(m.sets), animationDelay: `${i * 30}ms`, background: m.status === "within" ? "var(--accent)" : undefined }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
