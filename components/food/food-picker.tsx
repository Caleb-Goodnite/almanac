"use client";

import { Barcode, Check, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import {
  createCustomFoodAction,
  deleteSavedMealAction,
  logFoodAction,
  logSavedMealAction,
  quickAddAction,
} from "@/app/(app)/food/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { SavedMeal } from "@/lib/data/food-logs";
import type { FoodSummary, QuickFood } from "@/lib/data/foods";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { typicalServing } from "@/lib/food/units";
import { tapFeedback } from "@/lib/native/platform";
import { QuantityDialog } from "./quantity-dialog";

const Scanner = dynamic(() => import("./scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-ink-soft">Opening the camera…</p>,
});

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type Tab = "recent" | "frequent" | "search" | "scan" | "mine";

type Props = {
  date: string;
  initialMeal: Meal | null;
  recent: QuickFood[];
  frequent: QuickFood[];
  custom: FoodSummary[];
  savedMeals: SavedMeal[];
};

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function mealForNow(): Meal {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  if (h < 21.5) return "dinner";
  return "snack";
}

const subscribeNever = () => () => {};

function kcalFor(food: Pick<FoodSummary, "kcal">, grams: number) {
  return (food.kcal * grams) / 100;
}

/** "105 kcal per medium" when a typical serving is known, otherwise per 100 g. */
function rowDetail(food: FoodSummary): string {
  const serving = typicalServing(food);
  if (!serving) return `${fmt(food.kcal)} kcal per 100 g`;
  const label = serving.label.replace(/\s*\(.*\)$/, "");
  return `${fmt(kcalFor(food, serving.grams))} kcal per ${label} (${fmt(serving.grams)} g)`;
}

export function FoodPicker({ date, initialMeal, recent, frequent, custom, savedMeals }: Props) {
  const router = useRouter();
  // The server cannot know the visitor's clock, so with no meal in the URL the
  // default is chosen from the local time once the page is live.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [chosenMeal, setMeal] = useState<Meal | null>(initialMeal);
  const meal: Meal = chosenMeal ?? (hydrated ? mealForNow() : "snack");
  const hasHistory = recent.length > 0;
  const [tab, setTab] = useState<Tab>(hasHistory ? "recent" : "search");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<{ food: FoodSummary; lastGrams: number | null } | null>(null);
  const [logged, setLogged] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery({
    queryKey: ["food-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(debounced)}`, { signal });
      if (res.status === 429) throw new Error("You are searching very quickly. Wait a moment and try again.");
      if (!res.ok) throw new Error("Search is not available right now.");
      return (await res.json()) as { results: FoodSummary[]; degraded?: boolean };
    },
  });

  /** Logs immediately with a known quantity: the one-tap path for repeat foods. */
  function logNow(food: FoodSummary, grams: number) {
    setLogged((prev) => ({ ...prev, [food.id]: (prev[food.id] ?? 0) + 1 }));
    setStatus(`Logged ${food.name}, ${fmt(grams)} grams, to ${MEAL_LABEL[meal].toLowerCase()}.`);
    startTransition(async () => {
      void tapFeedback();
      const res = await logFoodAction({ clientId: crypto.randomUUID(), date, meal, foodId: food.id, quantityG: grams });
      if (!res.ok) {
        setLogged((prev) => ({ ...prev, [food.id]: Math.max(0, (prev[food.id] ?? 1) - 1) }));
        setStatus(res.error);
      }
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "frequent", label: "Frequent" },
    { key: "search", label: "Search" },
    { key: "scan", label: "Scan" },
    { key: "mine", label: "Mine" },
  ];

  const anyLogged = Object.values(logged).some((n) => n > 0);

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Meal</legend>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
            <label
              key={m}
              className={cn(
                "min-h-10 shrink-0 cursor-pointer content-center rounded-[3px] border px-3 text-sm",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                meal === m ? "border-ink bg-ink font-semibold text-paper" : "border-rule-strong font-medium",
              )}
            >
              <input type="radio" name="meal" value={m} checked={meal === m} onChange={() => setMeal(m)} className="sr-only" />
              {MEAL_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div role="tablist" aria-label="Ways to add food" className="mt-4 flex border-b border-rule">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px min-h-11 flex-1 border-b-2 text-sm",
              tab === t.key ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-3">
        {tab === "recent" || tab === "frequent" ? (
          <QuickList
            foods={tab === "recent" ? recent : frequent}
            logged={logged}
            onLog={(f) => logNow(f, f.lastQuantityG)}
            onOpen={(f) => setSelected({ food: f, lastGrams: f.lastQuantityG })}
            empty={
              tab === "recent"
                ? "Foods you log will show up here, newest first, ready to log again in one tap."
                : "Once you have logged for a few days, the foods you eat most will be listed here."
            }
            onSearch={() => setTab("search")}
          />
        ) : null}

        {tab === "search" ? (
          <div>
            <label className="flex items-center gap-2 border-b border-rule-strong focus-within:border-ink">
              <MagnifyingGlass aria-hidden size={20} weight="light" />
              <span className="sr-only">Search foods</span>
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foods, e.g. oats"
                autoComplete="off"
                enterKeyHint="search"
                className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-ink-faint"
              />
            </label>

            <div aria-live="polite" aria-busy={search.isFetching}>
              {debounced.length < 2 ? (
                <CommonFoods logged={logged} onOpen={(f) => setSelected({ food: f, lastGrams: null })} />
              ) : search.isPending ? (
                <ul aria-label="Loading results" className="mt-1">
                  {Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="flex items-center gap-3 border-b border-rule py-3">
                      <div className="flex-1">
                        <div className="h-4 w-2/3 animate-pulse bg-paper-sunk" />
                        <div className="mt-2 h-3 w-1/3 animate-pulse bg-paper-sunk" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : search.isError ? (
                <div className="py-6">
                  <p role="alert" className="text-sm font-medium text-accent-strong">
                    <span aria-hidden>! </span>
                    {search.error.message}
                  </p>
                  <Button variant="outline" className="mt-3" onClick={() => search.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : search.data.results.length === 0 ? (
                <div className="py-6">
                  <p className="text-sm text-ink-soft">
                    Nothing found for “{debounced}”. Try a simpler word, or add it yourself.
                  </p>
                  <Button variant="outline" className="mt-3" onClick={() => setTab("mine")}>
                    Create a food
                  </Button>
                </div>
              ) : (
                <>
                  {search.data.degraded ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      The food database is not responding, so these are only foods already saved here.
                    </p>
                  ) : null}
                  <ul className="mt-1">
                    {search.data.results.map((f) => (
                      <FoodRow
                        key={f.id}
                        food={f}
                        detail={rowDetail(f)}
                        count={logged[f.id] ?? 0}
                        onOpen={() => setSelected({ food: f, lastGrams: null })}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : null}

        {tab === "scan" ? (
          <ScanPanel onFound={(food) => setSelected({ food, lastGrams: null })} />
        ) : null}

        {tab === "mine" ? (
          <MinePanel
            date={date}
            meal={meal}
            custom={custom}
            savedMeals={savedMeals}
            onPick={(food) => setSelected({ food, lastGrams: null })}
            onStatus={setStatus}
          />
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {anyLogged ? (
        <div className="sticky bottom-20 z-30 mt-6 md:bottom-4">
          <Button size="lg" className="w-full shadow-[0_0_0_4px_var(--paper)]" onClick={() => { router.push(`/food?date=${date}`); router.refresh(); }}>
            Done
          </Button>
        </div>
      ) : null}

      {selected ? (
        <QuantityDialog
          food={selected.food}
          lastGrams={selected.lastGrams}
          mealLabel={MEAL_LABEL[meal]}
          onClose={() => setSelected(null)}
          onConfirm={(grams) => {
            logNow(selected.food, grams);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function FoodRow({
  food,
  detail,
  count,
  onOpen,
  onQuick,
}: {
  food: FoodSummary;
  detail: string;
  count: number;
  onOpen: () => void;
  onQuick?: () => void;
}) {
  return (
    <li className="flex items-center gap-1 border-b border-rule">
      <button type="button" onClick={onOpen} className="min-h-14 min-w-0 flex-1 py-2 text-left hover:bg-paper-raised">
        <span className="block truncate font-medium">{food.name}</span>
        <span className="nums block truncate text-sm text-ink-soft">
          {food.brand ? `${food.brand} · ` : ""}
          {detail}
          {food.source === "off" ? " · Open Food Facts" : ""}
        </span>
      </button>
      {count > 0 ? (
        <span className="stamp label flex items-center gap-1 text-good" aria-hidden>
          <Check size={14} weight="bold" />
          {count > 1 ? `×${count}` : "Logged"}
        </span>
      ) : null}
      {onQuick ? (
        <button
          type="button"
          onClick={onQuick}
          aria-label={`Log ${food.name} again, ${detail}`}
          className="grid size-12 shrink-0 place-items-center rounded-[3px] bg-accent-strong text-on-accent hover:brightness-110 active:scale-95"
        >
          <Plus aria-hidden size={22} weight="bold" />
        </button>
      ) : null}
    </li>
  );
}

function QuickList({
  foods,
  logged,
  onLog,
  onOpen,
  empty,
  onSearch,
}: {
  foods: QuickFood[];
  logged: Record<string, number>;
  onLog: (f: QuickFood) => void;
  onOpen: (f: QuickFood) => void;
  empty: string;
  onSearch: () => void;
}) {
  if (foods.length === 0) {
    return (
      <div className="py-6">
        <p className="text-sm leading-relaxed text-ink-soft">{empty}</p>
        <Button variant="outline" className="mt-3" onClick={onSearch}>
          Search for a food
        </Button>
      </div>
    );
  }
  return (
    <ul>
      {foods.map((f) => (
        <FoodRow
          key={f.id}
          food={f}
          detail={`${fmt(f.lastQuantityG)} g · ${fmt(kcalFor(f, f.lastQuantityG))} kcal`}
          count={logged[f.id] ?? 0}
          onOpen={() => onOpen(f)}
          onQuick={() => onLog(f)}
        />
      ))}
    </ul>
  );
}

const CATEGORY_ORDER = ["Fruit", "Vegetables", "Grains", "Protein", "Dairy", "Beans and nuts", "Oils and condiments", "Snacks and sweets", "Meals", "Drinks"];

/**
 * The built-in list of everyday foods, shown before anything is typed so a
 * banana or a slice of bread is two taps away.
 */
function CommonFoods({ logged, onOpen }: { logged: Record<string, number>; onOpen: (food: FoodSummary) => void }) {
  const [category, setCategory] = useState<string | null>(null);
  const common = useQuery({
    queryKey: ["common-foods"],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch("/api/foods/common");
      if (!res.ok) throw new Error("Could not load the food list.");
      return ((await res.json()) as { foods: FoodSummary[] }).foods;
    },
  });

  if (common.isPending) return <p className="py-6 text-sm text-ink-soft">Loading everyday foods…</p>;
  if (common.isError || common.data.length === 0) {
    return (
      <p className="py-6 text-sm leading-relaxed text-ink-soft">
        Type at least two letters. Results come from the USDA food database and your own foods.
      </p>
    );
  }

  const present = new Set(common.data.map((f) => f.category ?? "Other"));
  const categories = [...CATEGORY_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CATEGORY_ORDER.includes(c))];
  const active = category ?? categories[0]!;
  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-ink-soft">Everyday foods with typical servings. Type above to search the full USDA database.</p>
      <div role="group" aria-label="Food category" className="mt-3 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === active}
            onClick={() => setCategory(c)}
            className={cn(
              "min-h-11 rounded-[3px] border px-3 text-sm",
              c === active ? "border-ink bg-paper-raised font-semibold" : "border-rule-strong",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="mt-2">
        {common.data
          .filter((f) => (f.category ?? "Other") === active)
          .map((f) => (
            <FoodRow key={f.id} food={f} detail={rowDetail(f)} count={logged[f.id] ?? 0} onOpen={() => onOpen(f)} />
          ))}
      </ul>
    </div>
  );
}

function ScanPanel({ onFound }: { onFound: (food: FoodSummary) => void }) {
  const [code, setCode] = useState("");
  const [manual, setManual] = useState("");
  const lookup = useQuery({
    queryKey: ["barcode", code],
    enabled: /^\d{8,14}$/.test(code),
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/foods/barcode/${code}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Could not look that barcode up. Try again.");
      return ((await res.json()) as { food: FoodSummary | null }).food;
    },
  });

  const found = lookup.data;
  useEffect(() => {
    if (found) onFound(found);
    // Only react to a new result, not to a new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  return (
    <div>
      {code ? null : <Scanner onDetected={setCode} />}

      <div aria-live="polite" className="mt-3">
        {code && lookup.isPending ? <p className="text-sm text-ink-soft">Looking up {code}…</p> : null}
        {code && lookup.isError ? (
          <p role="alert" className="text-sm font-medium text-accent-strong">
            <span aria-hidden>! </span>
            {lookup.error.message}
          </p>
        ) : null}
        {code && lookup.isSuccess && lookup.data === null ? (
          <p className="text-sm text-ink-soft">
            We do not have a product for barcode {code}. You can add it yourself under Mine.
          </p>
        ) : null}
        {code ? (
          <Button variant="outline" className="mt-3" onClick={() => setCode("")}>
            <Barcode aria-hidden size={18} />
            Scan another
          </Button>
        ) : null}
      </div>

      <form
        className="mt-6 flex items-end gap-3 border-t border-rule pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setCode(manual.replace(/\D/g, ""));
        }}
      >
        <Field
          className="flex-1"
          label="Or type the barcode number"
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="e.g. 3017620422003"
        />
        <Button type="submit" variant="outline">
          Look up
        </Button>
      </form>
    </div>
  );
}

function MinePanel({
  date,
  meal,
  custom,
  savedMeals,
  onPick,
  onStatus,
}: {
  date: string;
  meal: Meal;
  custom: FoodSummary[];
  savedMeals: SavedMeal[];
  onPick: (food: FoodSummary) => void;
  onStatus: (s: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "create" | "quick">("list");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mealsLogged, setMealsLogged] = useState<Record<string, boolean>>({});

  if (mode === "create") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          startTransition(async () => {
            const res = await createCustomFoodAction(data);
            if (!res.ok) return setError(res.error);
            setError(null);
            setMode("list");
            router.refresh();
            onPick(res.data);
          });
        }}
      >
        <h2 className="font-display text-2xl">Create a food</h2>
        <p className="text-sm text-ink-soft">Copy the “per 100 g” column from the label.</p>
        <Field label="Name" name="name" required maxLength={120} />
        <Field label="Brand (optional)" name="brand" maxLength={80} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Calories per 100 g" name="kcal" unit="kcal" inputMode="decimal" required />
          <Field label="Protein" name="proteinG" unit="g" inputMode="decimal" required />
          <Field label="Carbohydrate" name="carbsG" unit="g" inputMode="decimal" required />
          <Field label="Fat" name="fatG" unit="g" inputMode="decimal" required />
          <Field label="Fiber (optional)" name="fiberG" unit="g" inputMode="decimal" />
          <Field label="Sugar (optional)" name="sugarG" unit="g" inputMode="decimal" />
          <Field label="Sodium (optional)" name="sodiumMg" unit="mg" inputMode="decimal" />
          <Field label="Serving size (optional)" name="servingG" unit="g" inputMode="decimal" />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-accent-strong">
            <span aria-hidden>! </span>
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setMode("list")}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            Save food
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "quick") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          startTransition(async () => {
            const res = await quickAddAction({ ...data, clientId: crypto.randomUUID(), date, meal });
            if (!res.ok) return setError(res.error);
            router.push(`/food?date=${date}`);
            router.refresh();
          });
        }}
      >
        <h2 className="font-display text-2xl">Quick add</h2>
        <p className="text-sm text-ink-soft">For when you only know the numbers, like a restaurant meal.</p>
        <Field label="What was it?" name="name" required maxLength={80} defaultValue="Quick add" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Calories" name="kcal" unit="kcal" inputMode="decimal" required />
          <Field label="Protein (optional)" name="proteinG" unit="g" inputMode="decimal" defaultValue="0" />
          <Field label="Carbohydrate (optional)" name="carbsG" unit="g" inputMode="decimal" defaultValue="0" />
          <Field label="Fat (optional)" name="fatG" unit="g" inputMode="decimal" defaultValue="0" />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-accent-strong">
            <span aria-hidden>! </span>
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setMode("list")}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            Log it
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setMode("create")}>
          Create a food
        </Button>
        <Button variant="outline" onClick={() => setMode("quick")}>
          Quick add calories
        </Button>
      </div>

      <section aria-labelledby="saved-meals">
        <h2 id="saved-meals" className="label">
          Saved meals
        </h2>
        {savedMeals.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Eat the same breakfast most days? Log it once, then choose “Save as meal” on the
            Food page to log the whole thing in one tap.
          </p>
        ) : (
          <ul className="mt-1">
            {savedMeals.map((m) => (
              <li key={m.id} className="flex items-center gap-2 border-b border-rule py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="nums text-sm text-ink-soft">
                    {m.items} {m.items === 1 ? "item" : "items"} · {fmt(m.kcal)} kcal
                  </p>
                </div>
                <button
                  type="button"
                  className="label min-h-11 px-2 underline decoration-dotted underline-offset-4 hover:text-ink"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteSavedMealAction(m.id);
                      router.refresh();
                    })
                  }
                  aria-label={`Delete saved meal ${m.name}`}
                >
                  Delete
                </button>
                <Button
                  variant={mealsLogged[m.id] ? "outline" : "accent"}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await logSavedMealAction({ savedMealId: m.id, date, meal, clientId: crypto.randomUUID() });
                      if (res.ok) {
                        setMealsLogged((p) => ({ ...p, [m.id]: true }));
                        onStatus(`Logged ${m.name}.`);
                        router.refresh();
                      }
                    })
                  }
                >
                  {mealsLogged[m.id] ? "Logged" : "Log"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-foods">
        <h2 id="my-foods" className="label">
          My foods
        </h2>
        {custom.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Foods you create appear here.</p>
        ) : (
          <ul className="mt-1">
            {custom.map((f) => (
              <FoodRow key={f.id} food={f} detail={`${fmt(f.kcal)} kcal per 100 g`} count={0} onOpen={() => onPick(f)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
