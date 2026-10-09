import type { Metadata } from "next";
import {
  Barbell,
  BowlFood,
  ChatText,
  Drop,
  Heartbeat,
  Moon,
  Plus,
  Sun,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Field } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { Ring } from "@/components/ui/ring";
import { Section } from "@/components/ui/section";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Why } from "@/components/ui/why";

export const metadata: Metadata = { title: "Style guide" };

const swatches = [
  { name: "Paper", token: "paper", note: "Page" },
  { name: "Raised", token: "paper-raised", note: "Panels" },
  { name: "Sunk", token: "paper-sunk", note: "Tracks" },
  { name: "Ink", token: "ink", note: "Text, 15:1" },
  { name: "Ink soft", token: "ink-soft", note: "Secondary, 6:1" },
  { name: "Rule", token: "rule-strong", note: "Borders, 3:1" },
  { name: "Vermilion", token: "accent", note: "The one accent" },
  { name: "Moss", token: "good", note: "On track" },
  { name: "Ochre", token: "warn", note: "Heads up" },
] as const;

function Palette({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} className="border border-rule bg-paper p-5 text-ink">
      <p className="label mb-4">{theme}</p>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
        {swatches.map((s) => (
          <li key={s.token}>
            <div
              className="h-14 border border-rule"
              style={{ background: `var(--${s.token})` }}
            />
            <p className="mt-2 text-sm font-medium">{s.name}</p>
            <p className="text-xs text-ink-soft">{s.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-14 flex flex-col-reverse items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div>
          <p className="label">Almanac · Style guide</p>
          <h1 className="display mt-3 text-6xl sm:text-8xl">
            An editorial instrument<span className="text-accent">.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            It should read like a well-set magazine spread and measure like a lab notebook.
            Big serif numerals carry the data, hairline rules carry the structure, and one
            colour does all the pointing.
          </p>
        </div>
        <ThemeToggle className="shrink-0" />
      </header>

      <div className="flex flex-col gap-16">
        <Section kicker="No. 01" title="Type">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="label">Display · Fraunces</p>
              <p className="display mt-2 text-7xl">Aa Gg 27</p>
              <p className="mt-3 text-sm text-ink-soft">
                A variable old-style serif with optical sizing. Used large and tight for
                titles and every headline number. Never bold.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <p className="label">Text · Instrument Sans</p>
                <p className="mt-2 text-lg leading-relaxed">
                  Your protein averaged 94 g this week against a 140 g target. Closing half
                  of that gap is the single change most likely to help.
                </p>
              </div>
              <div>
                <p className="label">Data · Geist Mono, uppercase, tracked</p>
                <p className="label mt-2 text-ink">kcal · g · kg · bpm · h min · RPE 8</p>
              </div>
              <div>
                <p className="label">Numerals are always tabular and lining</p>
                <p className="nums mt-2 font-display text-3xl">
                  1,111.1
                  <br />
                  2,480.6
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section kicker="No. 02" title="Colour">
          <div className="grid gap-5 md:grid-cols-2">
            <Palette theme="light" />
            <Palette theme="dark" />
          </div>
          <p className="mt-4 max-w-2xl text-sm text-ink-soft">
            Warm paper and warm charcoal, each tuned on its own. Every text colour clears
            4.5:1 and every graphic clears 3:1 in both themes. Meaning never rides on colour
            alone: the three macros share one ink and differ by pattern and label.
          </p>
        </Section>

        <Section kicker="No. 03" title="Figures">
          <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
            <Ring progress={0.64} size={220} label="1,420 of 2,200 kilocalories eaten">
              <div>
                <p className="figure text-6xl!">
                  <CountUp value={780} />
                </p>
                <p className="label mt-1">kcal left</p>
              </div>
            </Ring>
            <div className="flex flex-col gap-5">
              <Meter label="Protein" value={94} target={140} unit="g" pattern="solid" />
              <Meter label="Carbohydrate" value={160} target={250} unit="g" pattern="hatch" />
              <Meter label="Fat" value={52} target={70} unit="g" pattern="dots" />
              <Why source="protein" cite="Morton et al. 2018">
                For people who lift, muscle gain stops improving above roughly 1.6 g of
                protein per kg of bodyweight a day, so the target sits at or a little above
                that.
              </Why>
            </div>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-rule pt-6 sm:grid-cols-4">
            {[
              { k: "Weight, 7-day avg", v: 78.4, d: 1, u: "kg" },
              { k: "Sleep", v: 7.2, d: 1, u: "h" },
              { k: "Hard sets, chest", v: 12, d: 0, u: "sets" },
              { k: "Water", v: 1.8, d: 1, u: "L" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="label">{s.k}</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <CountUp value={s.v} decimals={s.d} className="font-display text-4xl" />
                  <span className="label">{s.u}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section kicker="No. 04" title="Controls">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Log a meal</Button>
              <Button variant="accent">
                <Plus aria-hidden size={18} weight="bold" />
                Quick add
              </Button>
              <Button variant="outline">Start workout</Button>
              <Button variant="quiet">Skip for now</Button>
            </div>
            <div className="flex flex-col gap-6">
              <Field label="Bodyweight" unit="kg" inputMode="decimal" placeholder="78.4" />
              <Field
                label="Daily calories"
                unit="kcal"
                inputMode="numeric"
                defaultValue="900"
                error="That is below the safe minimum. We will not set a target this low."
              />
            </div>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-rule pt-6">
            {[
              { I: Sun, t: "Today" },
              { I: BowlFood, t: "Food" },
              { I: Barbell, t: "Train" },
              { I: Heartbeat, t: "Body" },
              { I: Moon, t: "Sleep" },
              { I: Drop, t: "Water" },
              { I: ChatText, t: "Coach" },
            ].map(({ I, t }) => (
              <li key={t} className="flex items-center gap-2">
                <I aria-hidden size={24} weight="light" />
                <span className="label">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">
            Icons are Phosphor at light weight, always paired with a text label. No emoji, no
            sparkles; the coach is marked by a byline, like a columnist.
          </p>
        </Section>

        <Section kicker="No. 05" title="Motion">
          <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {[
              ["Numbers count, they do not pop.", "Figures tween from their last value in under a second, easing out."],
              ["Ink fills once.", "Rings and bars draw on arrival and again only when the value changes."],
              ["Things move from where they were.", "A metric grows into its detail view; a logged item slides into its place in the list."],
              ["Feedback is small and immediate.", "Logging gives a brief stamp, then gets out of the way. Input is never blocked by an animation."],
              ["Transform and opacity only.", "Nothing animates layout properties, so it holds 60 fps on a mid-range phone."],
              ["Reduced motion means none.", "With the system setting on, every transition resolves instantly and nothing is lost."],
            ].map(([head, body], i) => (
              <li key={head} className="flex gap-4">
                <span className="nums font-display text-2xl text-accent-strong">{i + 1}</span>
                <div>
                  <p className="font-medium">{head}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </main>
  );
}
