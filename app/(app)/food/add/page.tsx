import type { Metadata } from "next";
import Link from "next/link";
import { FoodPicker } from "@/components/food/food-picker";
import { Section } from "@/components/ui/section";
import { requireViewer } from "@/lib/auth/session";
import { listSavedMeals } from "@/lib/data/food-logs";
import { listCustomFoods, quickFoods } from "@/lib/data/foods";
import { fmtDate } from "@/lib/format";
import { todayIn } from "@/lib/time";
import { dateSchema, mealSchema } from "@/lib/validation/food";

export const metadata: Metadata = { title: "Add food" };

export default async function AddFoodPage({ searchParams }: PageProps<"/food/add">) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const today = todayIn(viewer.profile.timezone);
  const requested = dateSchema.safeParse(params.date);
  const date = requested.success && requested.data <= today ? requested.data : today;
  const meal = mealSchema.safeParse(params.meal);

  const [recent, frequent, custom, savedMeals] = await Promise.all([
    quickFoods(viewer.userId, "recent"),
    quickFoods(viewer.userId, "frequent"),
    listCustomFoods(viewer.userId),
    listSavedMeals(viewer.userId),
  ]);

  return (
    <Section
      as="h1"
      kicker={date === today ? "Today" : fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}
      title="Add food"
      aside={
        <Link href={`/food?date=${date}`} className="label min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-ink">
          Back
        </Link>
      }
    >
      <FoodPicker
        date={date}
        initialMeal={meal.success ? meal.data : null}
        recent={recent}
        frequent={frequent}
        custom={custom}
        savedMeals={savedMeals}
      />
    </Section>
  );
}
