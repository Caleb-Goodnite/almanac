// Builds lib/db/seed-data/common-foods.json: a curated list of everyday foods
// with nutrients and household measures from USDA FoodData Central (SR Legacy,
// public domain). Each entry names the exact USDA description to match, so a
// wrong match is reported instead of silently used. Usage:
//   node --env-file=.env.local scripts/build-common-foods.mjs
import { writeFileSync } from "node:fs";

const KEY = process.env.USDA_API_KEY ?? "DEMO_KEY";
const BASE = "https://api.nal.usda.gov/fdc/v1";

// [name shown in the app, USDA SR Legacy description, portion to offer first (regex), category, extra portions]
// Extra portions are plain unit arithmetic (a 1.5 oz box is 42.5 g), added where USDA lists no everyday measure.
const FOODS = [
  // Fruit
  ["Banana", "Bananas, raw", /medium/, "Fruit"],
  ["Apple", "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", /medium/, "Fruit"],
  ["Orange", "Oranges, raw, all commercial varieties", /fruit/, "Fruit"],
  ["Strawberries", "Strawberries, raw", /cup, halves|cup/, "Fruit"],
  ["Blueberries", "Blueberries, raw", /cup/, "Fruit"],
  ["Raspberries", "Raspberries, raw", /cup/, "Fruit"],
  ["Grapes", "Grapes, red or green (European type, such as Thompson seedless), raw", /cup/, "Fruit"],
  ["Watermelon", "Watermelon, raw", /cup, diced|cup/, "Fruit"],
  ["Pineapple", "Pineapple, raw, all varieties", /cup, chunks|cup/, "Fruit"],
  ["Mango", "Mangos, raw", /cup/, "Fruit"],
  ["Peach", "Peaches, yellow, raw", /medium/, "Fruit"],
  ["Pear", "Pears, raw", /medium/, "Fruit"],
  ["Avocado", "Avocados, raw, all commercial varieties", /avocado/, "Fruit"],
  ["Lemon", "Lemons, raw, without peel", /fruit|medium/, "Fruit"],
  ["Cherries", "Cherries, sweet, raw", /cup, with pits|cup/, "Fruit"],
  ["Kiwi", "Kiwifruit, green, raw", /fruit|medium/, "Fruit"],
  ["Cantaloupe", "Melons, cantaloupe, raw", /cup, cubes|cup/, "Fruit"],
  ["Grapefruit", "Grapefruit, raw, pink and red, all areas", /half|fruit/, "Fruit"],
  ["Raisins", "Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)", /small box/, "Fruit", [{ label: "1 small box (1.5 oz)", grams: 42.5 }]],
  ["Dates", "Dates, medjool", /date/, "Fruit"],
  ["Applesauce, unsweetened", "Applesauce, canned, unsweetened, without added ascorbic acid (Includes foods for USDA's Food Distribution Program)", /cup/, "Fruit"],

  // Vegetables
  ["Broccoli", "Broccoli, raw", /cup chopped|cup/, "Vegetables"],
  ["Broccoli, cooked", "Broccoli, cooked, boiled, drained, without salt", /cup/, "Vegetables"],
  ["Carrot", "Carrots, raw", /medium/, "Vegetables"],
  ["Baby carrots", "Carrots, baby, raw", /medium|large/, "Vegetables"],
  ["Spinach", "Spinach, raw", /cup/, "Vegetables"],
  ["Lettuce, romaine", "Lettuce, cos or romaine, raw", /cup shredded|cup/, "Vegetables"],
  ["Lettuce, iceberg", "Lettuce, iceberg (includes crisphead types), raw", /cup shredded|cup/, "Vegetables"],
  ["Kale", "Kale, raw", /cup/, "Vegetables"],
  ["Tomato", "Tomatoes, red, ripe, raw, year round average", /medium/, "Vegetables"],
  ["Cherry tomatoes", "Tomatoes, red, ripe, raw, year round average", /cherry/, "Vegetables"],
  ["Cucumber", "Cucumber, with peel, raw", /cup slices|cup/, "Vegetables"],
  ["Bell pepper, red", "Peppers, sweet, red, raw", /medium/, "Vegetables"],
  ["Bell pepper, green", "Peppers, sweet, green, raw", /medium/, "Vegetables"],
  ["Onion", "Onions, raw", /medium/, "Vegetables"],
  ["Garlic", "Garlic, raw", /clove/, "Vegetables"],
  ["Mushrooms", "Mushrooms, white, raw", /cup, pieces|cup/, "Vegetables"],
  ["Zucchini", "Squash, summer, zucchini, includes skin, raw", /medium|cup/, "Vegetables"],
  ["Cauliflower", "Cauliflower, raw", /cup chopped|cup/, "Vegetables"],
  ["Green beans, cooked", "Beans, snap, green, cooked, boiled, drained, without salt", /cup/, "Vegetables"],
  ["Peas, cooked", "Peas, green, frozen, cooked, boiled, drained, without salt", /cup/, "Vegetables"],
  ["Corn, cooked", "Corn, sweet, yellow, cooked, boiled, drained, without salt", /ear, medium|cup/, "Vegetables"],
  ["Celery", "Celery, raw", /stalk, medium|stalk/, "Vegetables"],
  ["Asparagus, cooked", "Asparagus, cooked, boiled, drained", /spear|cup/, "Vegetables"],
  ["Cabbage", "Cabbage, raw", /cup, shredded|cup/, "Vegetables"],
  ["Brussels sprouts, cooked", "Brussels sprouts, cooked, boiled, drained, without salt", /cup|sprout/, "Vegetables"],
  ["Potato, baked", "Potatoes, baked, flesh and skin, without salt", /medium/, "Vegetables"],
  ["Potatoes, mashed", "Potatoes, mashed, home-prepared, whole milk and margarine added", /cup/, "Vegetables"],
  ["Sweet potato, baked", "Sweet potato, cooked, baked in skin, flesh, without salt", /medium/, "Vegetables"],
  ["French fries", "Potatoes, french fried, all types, salt added in processing, frozen, home-prepared, oven heated", /fries/, "Vegetables"],

  // Grains, bread, cereal
  ["White rice, cooked", "Rice, white, long-grain, regular, enriched, cooked", /cup/, "Grains"],
  ["Brown rice, cooked", "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", /cup/, "Grains"],
  ["Pasta, cooked", "Pasta, cooked, enriched, without added salt", /cup spaghetti|cup/, "Grains"],
  ["Whole wheat pasta, cooked", "Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program)", /cup spaghetti|cup/, "Grains"],
  ["Oatmeal, cooked", "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt", /cup/, "Grains"],
  ["Oats, dry", "Cereals, oats, regular and quick, not fortified, dry", /cup/, "Grains"],
  ["Quinoa, cooked", "Quinoa, cooked", /cup/, "Grains"],
  ["Bread, white", "Bread, white, commercially prepared (includes soft bread crumbs)", /slice/, "Grains"],
  ["Bread, whole wheat", "Bread, whole-wheat, commercially prepared", /slice/, "Grains"],
  ["Bagel", "Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)", /medium|bagel/, "Grains"],
  ["English muffin", "Muffins, English, plain, enriched, with ca prop (includes sourdough)", /muffin/, "Grains"],
  ["Tortilla, flour", "Tortillas, ready-to-bake or -fry, flour, shelf stable", /tortilla/, "Grains"],
  ["Tortilla, corn", "Tortillas, ready-to-bake or -fry, corn", /tortilla/, "Grains"],
  ["Hamburger bun", "Rolls, hamburger or hotdog, plain", /roll/, "Grains"],
  ["Pancake", "Pancakes, plain, prepared from recipe", /pancake \(4|pancake/, "Grains"],
  ["Waffle, frozen", "Waffles, plain, frozen, ready-to-heat, toasted", /waffle/, "Grains"],
  ["Granola", "Cereals ready-to-eat, granola, homemade", /cup/, "Grains"],
  ["Crackers, saltine", "Crackers, saltines (includes oyster, soda, soup)", /cracker|oz/, "Grains"],
  ["Popcorn, air-popped", "Snacks, popcorn, air-popped", /cup/, "Grains"],
  ["Couscous, cooked", "Couscous, cooked", /cup/, "Grains"],

  // Protein: meat, poultry, fish, eggs
  ["Chicken breast, cooked", "Chicken, broilers or fryers, breast, meat only, cooked, roasted", /breast|oz|cup/, "Protein"],
  ["Chicken thigh, cooked", "Chicken, broilers or fryers, thigh, meat only, cooked, roasted", /thigh|oz/, "Protein"],
  ["Chicken wing, cooked", "Chicken, broilers or fryers, wing, meat and skin, cooked, roasted", /piece/, "Protein"],
  ["Ground beef, 85% lean, cooked", "Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled", /patty|oz/, "Protein"],
  ["Ground beef, 93% lean, cooked", "Beef, ground, 93% lean meat / 7% fat, patty, cooked, broiled", /patty|oz/, "Protein"],
  ["Steak, sirloin, cooked", "Beef, top sirloin, steak, separable lean and fat, trimmed to 1/8\" fat, all grades, cooked, broiled", /oz|steak/, "Protein"],
  ["Ground turkey, cooked", "Turkey, ground, cooked", /patty|oz/, "Protein"],
  ["Turkey breast, deli", "Turkey breast, sliced, prepackaged", /slice|serving/, "Protein"],
  ["Ham, sliced", "Ham, sliced, regular (approximately 11% fat)", /slice/, "Protein"],
  ["Pork chop, cooked", "Pork, fresh, loin, center loin (chops), bone-in, separable lean and fat, cooked, broiled", /chop|oz/, "Protein"],
  ["Bacon, cooked", "Pork, cured, bacon, pre-sliced, cooked, pan-fried", /slice/, "Protein"],
  ["Sausage, pork, cooked", "Pork sausage, link/patty, cooked, pan-fried", /link|patty/, "Protein"],
  ["Hot dog", "Frankfurter, beef, unheated", /hot dog/, "Protein"],
  ["Salmon, cooked", "Fish, salmon, Atlantic, farmed, cooked, dry heat", /oz|fillet/, "Protein"],
  ["Tuna, canned in water", "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)", /can|oz/, "Protein"],
  ["Cod, cooked", "Fish, cod, Atlantic, cooked, dry heat", /oz|fillet/, "Protein"],
  ["Tilapia, cooked", "Fish, tilapia, cooked, dry heat", /fillet|oz/, "Protein"],
  ["Shrimp, cooked", "Crustaceans, shrimp, cooked", /oz|large/, "Protein"],
  ["Egg", "Egg, whole, raw, fresh", /large/, "Protein"],
  ["Egg, hard-boiled", "Egg, whole, cooked, hard-boiled", /large/, "Protein"],
  ["Egg, scrambled", "Egg, whole, cooked, scrambled", /large|cup/, "Protein"],
  ["Egg white", "Egg, white, raw, fresh", /large/, "Protein"],
  ["Tofu, firm", "Tofu, raw, firm, prepared with calcium sulfate", /cup|block/, "Protein"],

  // Beans, nuts, seeds
  ["Black beans, cooked", "Beans, black, mature seeds, cooked, boiled, without salt", /cup/, "Beans and nuts"],
  ["Kidney beans, cooked", "Beans, kidney, red, mature seeds, cooked, boiled, without salt", /cup/, "Beans and nuts"],
  ["Pinto beans, cooked", "Beans, pinto, mature seeds, cooked, boiled, without salt", /cup/, "Beans and nuts"],
  ["Chickpeas, cooked", "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt", /cup/, "Beans and nuts"],
  ["Lentils, cooked", "Lentils, mature seeds, cooked, boiled, without salt", /cup/, "Beans and nuts"],
  ["Refried beans", "Refried beans, canned, traditional style", /cup/, "Beans and nuts"],
  ["Hummus", "Hummus, commercial", /tbsp|tablespoon/, "Beans and nuts"],
  ["Peanut butter", "Peanut butter, smooth style, with salt (Includes foods for USDA's Food Distribution Program)", /tbsp/, "Beans and nuts"],
  ["Almond butter", "Nuts, almond butter, plain, without salt added", /tbsp/, "Beans and nuts"],
  ["Almonds", "Nuts, almonds", /oz|cup/, "Beans and nuts"],
  ["Peanuts", "Peanuts, all types, dry-roasted, with salt", /oz/, "Beans and nuts"],
  ["Walnuts", "Nuts, walnuts, english", /oz/, "Beans and nuts"],
  ["Cashews", "Nuts, cashew nuts, dry roasted, with salt added", /oz/, "Beans and nuts"],
  ["Pecans", "Nuts, pecans", /oz/, "Beans and nuts"],
  ["Pistachios", "Nuts, pistachio nuts, dry roasted, with salt added", /oz/, "Beans and nuts"],
  ["Sunflower seeds", "Seeds, sunflower seed kernels, dry roasted, with salt added", /oz/, "Beans and nuts"],
  ["Chia seeds", "Seeds, chia seeds, dried", /oz|tbsp/, "Beans and nuts"],

  // Dairy
  ["Milk, whole", "Milk, whole, 3.25% milkfat, with added vitamin D", /cup/, "Dairy"],
  ["Milk, 2%", "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", /cup/, "Dairy"],
  ["Milk, skim", "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)", /cup/, "Dairy"],
  ["Greek yogurt, plain, nonfat", "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)", /container/, "Dairy", [{ label: "1 container (5.3 oz)", grams: 150 }, { label: "1 container (6 oz)", grams: 170 }]],
  ["Yogurt, plain, whole milk", "Yogurt, plain, whole milk", /cup|container/, "Dairy"],
  ["Cheddar cheese", "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)", /slice|oz/, "Dairy"],
  ["Mozzarella cheese", "Cheese, mozzarella, low moisture, part-skim", /oz/, "Dairy"],
  ["American cheese", "Cheese, pasteurized process, American, fortified with vitamin D", /slice/, "Dairy"],
  ["Swiss cheese", "Cheese, swiss", /slice/, "Dairy"],
  ["Parmesan cheese, grated", "Cheese, parmesan, grated", /tbsp/, "Dairy"],
  ["Feta cheese", "Cheese, feta", /oz|cup/, "Dairy"],
  ["String cheese", "Cheese, mozzarella, low moisture, part-skim", /stick/, "Dairy", [{ label: "1 stick (1 oz)", grams: 28 }]],
  ["Cottage cheese, 2%", "Cheese, cottage, lowfat, 2% milkfat", /cup/, "Dairy"],
  ["Cream cheese", "Cheese, cream", /tbsp/, "Dairy"],
  ["Butter", "Butter, salted", /tbsp|pat/, "Dairy"],
  ["Sour cream", "Cream, sour, cultured", /tbsp/, "Dairy"],
  ["Heavy cream", "Cream, fluid, heavy whipping", /tbsp/, "Dairy"],
  ["Half and half", "Cream, fluid, half and half", /tbsp/, "Dairy"],
  ["Ice cream, vanilla", "Ice creams, vanilla", /cup|serving/, "Dairy"],
  ["Almond milk, unsweetened", "Beverages, almond milk, unsweetened, shelf stable", /cup/, "Dairy"],
  ["Soy milk", "Soymilk, original and vanilla, unfortified", /cup/, "Dairy"],

  // Fats, oils, condiments, sweeteners
  ["Olive oil", "Oil, olive, salad or cooking", /tbsp|tablespoon/, "Oils and condiments"],
  ["Vegetable oil", "Oil, canola", /tbsp|tablespoon/, "Oils and condiments"],
  ["Coconut oil", "Oil, coconut", /tbsp|tablespoon/, "Oils and condiments"],
  ["Mayonnaise", "Salad dressing, mayonnaise, regular", /tbsp|tablespoon/, "Oils and condiments"],
  ["Ranch dressing", "Salad dressing, ranch dressing, regular", /tbsp|tablespoon/, "Oils and condiments"],
  ["Italian dressing", "Salad dressing, italian dressing, commercial, regular", /tbsp|tablespoon/, "Oils and condiments"],
  ["Ketchup", "Catsup", /tbsp|tablespoon/, "Oils and condiments"],
  ["Mustard", "Mustard, prepared, yellow", /tsp|teaspoon/, "Oils and condiments"],
  ["Barbecue sauce", "Sauce, barbecue", /tbsp|tablespoon/, "Oils and condiments"],
  ["Soy sauce", "Soy sauce made from soy and wheat (shoyu)", /tbsp|tablespoon/, "Oils and condiments"],
  ["Salsa", "Sauce, salsa, ready-to-serve", /tbsp|tablespoon|cup/, "Oils and condiments"],
  ["Tomato sauce, marinara", "Sauce, pasta, spaghetti/marinara, ready-to-serve", /cup/, "Oils and condiments"],
  ["Guacamole", "Avocados, raw, all commercial varieties", /2 tbsp/, "Oils and condiments", [{ label: "2 tbsp", grams: 28.8 }]],
  ["Honey", "Honey", /tbsp|tablespoon/, "Oils and condiments"],
  ["Sugar", "Sugars, granulated", /tsp|teaspoon/, "Oils and condiments"],
  ["Maple syrup", "Syrups, maple", /tbsp|tablespoon/, "Oils and condiments"],
  ["Jam", "Jams and preserves", /tbsp|tablespoon/, "Oils and condiments"],

  // Snacks and sweets
  ["Potato chips", "Snacks, potato chips, plain, salted", /oz/, "Snacks and sweets"],
  ["Tortilla chips", "Snacks, tortilla chips, plain, white corn, salted", /oz/, "Snacks and sweets"],
  ["Pretzels", "Snacks, pretzels, hard, plain, salted", /oz/, "Snacks and sweets"],
  ["Dark chocolate", "Chocolate, dark, 70-85% cacao solids", /oz|bar/, "Snacks and sweets"],
  ["Milk chocolate", "Candies, milk chocolate", /1\.55|bar/, "Snacks and sweets"],
  ["Chocolate chip cookie", "Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched", /cookie/, "Snacks and sweets"],
  ["Brownie", "Cookies, brownies, commercially prepared", /brownie|square/, "Snacks and sweets"],
  ["Doughnut, glazed", "Doughnuts, yeast-leavened, glazed, enriched (includes honey buns)", /doughnut medium|medium/, "Snacks and sweets"],
  ["Muffin, blueberry", "Muffins, blueberry, commercially prepared (Includes mini-muffins)", /muffin|medium/, "Snacks and sweets"],
  ["Granola bar", "Snacks, granola bars, hard, plain", /bar/, "Snacks and sweets"],
  ["Trail mix", "Snacks, trail mix, regular", /oz|cup/, "Snacks and sweets"],

  // Prepared and fast food
  ["Pizza, cheese", "Fast Food, Pizza Chain, 14\" pizza, cheese topping, regular crust", /slice/, "Meals"],
  ["Pizza, pepperoni", "Fast Food, Pizza Chain, 14\" pizza, pepperoni topping, regular crust", /slice/, "Meals"],
  ["Hamburger", "Fast foods, hamburger; single, regular patty; plain", /sandwich|item/, "Meals"],
  ["Cheeseburger", "Fast foods, cheeseburger; single, regular patty; plain", /sandwich|item/, "Meals"],
  ["Chicken nuggets", "Fast foods, chicken tenders", /piece|strip|oz/, "Meals"],
  ["Burrito, bean and cheese", "Fast foods, burrito, with beans and cheese", /burrito|item|piece/, "Meals"],
  ["Taco, beef", "Fast foods, taco with beef, cheese and lettuce, hard shell", /taco|item|each/, "Meals"],
  ["Macaroni and cheese", "Macaroni and cheese, canned, microwavable", /cup|serving/, "Meals"],
  ["Chicken noodle soup", "Soup, chicken noodle, canned, condensed", /cup/, "Meals"],
  ["Tomato soup", "Soup, tomato, canned, prepared with equal volume water, commercial", /cup/, "Meals"],

  // Drinks
  ["Orange juice", "Orange juice, raw (Includes foods for USDA's Food Distribution Program)", /cup/, "Drinks"],
  ["Apple juice", "Apple juice, canned or bottled, unsweetened, without added ascorbic acid", /cup/, "Drinks"],
  ["Coffee, black", "Beverages, coffee, brewed, prepared with tap water", /cup|fl oz/, "Drinks"],
  ["Tea, unsweetened", "Beverages, tea, black, brewed, prepared with tap water", /cup|fl oz/, "Drinks"],
  ["Cola", "Beverages, carbonated, cola, regular", /can|fl oz/, "Drinks"],
  ["Sports drink", "Beverages, PEPSICO QUAKER, Gatorade, G performance O 2, ready-to-drink.", /8 fl oz|bottle/, "Drinks"],
  ["Beer", "Alcoholic beverage, beer, regular, all", /can|bottle|fl oz/, "Drinks"],
  ["Wine, red", "Alcoholic beverage, wine, table, red", /serving|fl oz/, "Drinks"],
  ["Protein powder, whey", "Beverages, Protein powder whey based", /cup/, "Drinks"],
];

const NUTRIENT = { kcal: [1008, 2047, 2048], protein: [1003], fat: [1004], carbs: [1005], fiber: [1079, 2033], sugar: [2000, 1063], sodium: [1093] };
const MICRO = { 1258: "saturatedFatG", 1253: "cholesterolMg", 1087: "calciumMg", 1089: "ironMg", 1092: "potassiumMg", 1090: "magnesiumMg", 1095: "zincMg", 1162: "vitaminCMg", 1114: "vitaminDUg", 1106: "vitaminAUg", 1178: "vitaminB12Ug" };

async function get(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", KEY);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) throw new Error("USDA rate limit reached; wait an hour or use a real key");
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`USDA request failed: ${path}`);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

async function findId(description) {
  // The search endpoint rejects some punctuation, so the query is plain words; the match is still checked against the full description.
  const query = description.replace(/\([^)]*\)/g, " ").replace(/[^A-Za-z0-9%]+/g, " ").trim();
  let data;
  try {
    data = await get("/foods/search", { query, dataType: "SR Legacy", pageSize: "25", requireAllWords: "true" });
    if (!data.foods?.length) data = await get("/foods/search", { query, dataType: "SR Legacy", pageSize: "25" });
  } catch {
    return null;
  }
  const exact = data.foods.find((f) => norm(f.description) === norm(description));
  return exact ? { fdcId: exact.fdcId, description: exact.description, exact: true } : data.foods[0] ? { fdcId: data.foods[0].fdcId, description: data.foods[0].description, exact: false } : null;
}

// "1 cup, sliced" style labels from USDA's amount + modifier fields, tidied so every one starts with a count.
function portionLabel(p) {
  let text = String(p.modifier ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  text = text.replace(/^each /i, "").replace(/, NS as to .*$/i, "").replace(/NLEA serving/i, "standard serving").replace(/^(\w+) 1 serving$/i, "$1").replace(/\btablespoons?\b/gi, "tbsp").replace(/\bteaspoons?\b/gi, "tsp");
  const amount = p.amount && p.amount !== 1 ? p.amount : 1;
  return (/^\d/.test(text) ? text : `${amount} ${text}`).slice(0, 60);
}

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const out = [];
const problems = [];
const matches = [];
for (const [name, description] of FOODS) {
  const found = await findId(description);
  if (!found) problems.push(`NOT FOUND: ${name} <- ${description}`);
  else if (!found.exact) problems.push(`INEXACT: ${name}: wanted "${description}", got "${found.description}"`);
  matches.push(found);
}

const ids = [...new Set(matches.filter(Boolean).map((m) => m.fdcId))];
const details = new Map();
for (let i = 0; i < ids.length; i += 20) {
  const batch = await get("/foods", { fdcIds: ids.slice(i, i + 20).join(","), format: "full" });
  for (const food of batch) details.set(food.fdcId, food);
}

FOODS.forEach(([name, , prefer, category, extra = []], index) => {
  const match = matches[index];
  const food = match && details.get(match.fdcId);
  if (!food) return;
  const byId = new Map((food.foodNutrients ?? []).map((n) => [n.nutrient?.id, n.amount]));
  const pick = (list) => list.map((id) => byId.get(id)).find((v) => typeof v === "number");
  const protein = pick(NUTRIENT.protein) ?? 0;
  const fat = pick(NUTRIENT.fat) ?? 0;
  const carbs = pick(NUTRIENT.carbs) ?? 0;
  const kcal = pick(NUTRIENT.kcal) ?? protein * 4 + carbs * 4 + fat * 9;
  const micros = {};
  for (const [id, key] of Object.entries(MICRO)) {
    const v = byId.get(Number(id));
    if (typeof v === "number" && v > 0) micros[key] = round(v, 2);
  }
  const seen = new Set();
  const portions = [...extra.map((p) => ({ ...p, modifier: null })), ...(food.foodPortions ?? [])]
    .map((p) => ({ label: p.label ?? portionLabel(p), grams: round(p.grams ?? p.gramWeight, 1), order: p.label ? -1 : (p.sequenceNumber ?? 99) }))
    .filter((p) => p.label && p.grams > 0 && p.grams <= 2000 && !seen.has(p.label) && seen.add(p.label))
    .sort((a, b) => a.order - b.order)
    .map(({ label, grams }) => ({ label, grams }));
  // Alternatives in the pattern are tried in order, so the first one listed wins when it exists.
  let first = -1;
  for (const option of prefer.source.split("|")) {
    first = portions.findIndex((p) => new RegExp(option, "i").test(p.label));
    if (first !== -1) break;
  }
  if (first > 0) portions.unshift(...portions.splice(first, 1));
  portions.length = Math.min(portions.length, 10);
  if (first === -1 && portions.length) problems.push(`NO PREFERRED PORTION: ${name} (${prefer}) in [${portions.map((p) => p.label).join(" | ")}]`);
  if (!portions.length) problems.push(`NO PORTIONS: ${name}`);
  out.push({
    // Stable id for the app's catalogue; two entries may share one USDA food (tomato and cherry tomatoes).
    id: `${match.fdcId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    category,
    fdcId: match.fdcId,
    usdaDescription: food.description,
    kcal: round(kcal, 0),
    proteinG: round(protein),
    carbsG: round(carbs),
    fatG: round(fat),
    fiberG: pick(NUTRIENT.fiber) ?? null,
    sugarG: pick(NUTRIENT.sugar) ?? null,
    sodiumMg: pick(NUTRIENT.sodium) ?? null,
    micros,
    portions,
  });
});

writeFileSync("lib/db/seed-data/common-foods.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`Wrote ${out.length} foods.`);
if (problems.length) console.log(`\n${problems.length} to review:\n${problems.join("\n")}`);
