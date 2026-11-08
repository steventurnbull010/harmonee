// ============================================================================
// FETCH MORE RECIPES FROM THEMEALDB (scripts/fetch-mealdb.mjs)
// Adds recipes to recipes-themealdb.js from TheMealDB's free API, whose terms
// allow copying and modifying what it returns. Same shape as the existing
// ones (id mealdb-<id>, title, subtitle "Area · Category", emoji, image,
// category/mealType, tags, source, ingredients, instructions). Skips any
// already there and desserts. Not deployed (scripts/** is ignored).
//   node scripts/fetch-mealdb.mjs [howManyToAdd=40]
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../recipes-themealdb.js", import.meta.url);
const API = "https://www.themealdb.com/api/json/v1/1";
const WANT = parseInt(process.argv[2] || "40", 10);

// What to look for, in order, and how many of each (to fill the gaps)
const PLAN = [
  ["Breakfast", 8], ["Starter", 8], ["Vegetarian", 9], ["Vegan", 4],
  ["Seafood", 6], ["Chicken", 6], ["Pasta", 4], ["Beef", 4], ["Lamb", 3], ["Pork", 3], ["Side", 3], ["Miscellaneous", 4]
];
const EMOJI = { Breakfast: "🍳", Chicken: "🍗", Seafood: "🐟", Vegetarian: "🥗", Vegan: "🥗", Pork: "🥓", Beef: "🥩", Lamb: "🍖", Pasta: "🍝" };
const MEAT = ["Beef", "Lamb", "Pork", "Goat"];

const get = async (path) => {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

function toRecipe(m) {
  const cat = m.strCategory || "";
  const area = m.strArea && m.strArea !== "Unknown" ? m.strArea : "";
  const lunchy = /\b(soup|salad|sandwich|wrap|toastie|bruschetta|frittata|quiche)\b/i.test(m.strMeal);
  const mealType = cat === "Breakfast" ? "breakfast" : (cat === "Starter" || cat === "Side" || lunchy) ? "lunch" : "dinner";
  const showCat = ["Starter", "Side", "Miscellaneous"].includes(cat) ? "" : cat;
  const subtitle = [area, showCat].filter(Boolean).join(" · ");
  const emoji = /\bsoup\b/i.test(m.strMeal) ? "🥣" : (EMOJI[cat] || "🍽️");
  const tags = [];
  if (cat === "Vegetarian" || cat === "Vegan") tags.push("veggie");
  if (MEAT.includes(cat)) tags.push("meat");
  if (cat === "Pasta") tags.push("pasta");
  tags.push(mealType);
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = (m[`strIngredient${i}`] || "").trim();
    const qty = (m[`strMeasure${i}`] || "").trim();
    if (ing) ingredients.push(qty ? `${qty} ${ing}` : ing);
  }
  const instructions = String(m.strInstructions || "")
    .split(/\r?\n+/)
    .map(s => s.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, "").trim())
    .filter(s => s && !/^step\s*\d+$/i.test(s) && s.length > 2);
  let sourceUrl = (m.strSource || "").trim();
  let sourceName = "TheMealDB";
  try { if (sourceUrl) sourceName = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch (e) { sourceUrl = ""; }
  return {
    id: `mealdb-${m.idMeal}`,
    title: m.strMeal.trim(),
    subtitle,
    emoji,
    image: m.strMealThumb,
    category: mealType,
    mealType,
    tags,
    source: "TheMealDB",
    sourceUrl: sourceUrl || `https://www.themealdb.com/meal/${m.idMeal}`,
    sourceName,
    mealdbUrl: `https://www.themealdb.com/meal/${m.idMeal}`,
    ingredients,
    instructions
  };
}

const text = readFileSync(FILE, "utf8");
const start = text.indexOf("export const MEALDB_RECIPES = ");
const header = text.slice(0, start);
const existing = JSON.parse(text.slice(start + "export const MEALDB_RECIPES = ".length).trim().replace(/;\s*$/, ""));
const have = new Set(existing.map(r => r.id));
const haveTitles = new Set(existing.map(r => r.title.toLowerCase()));

// Familiar cuisines first (a family planner, mostly UK families), then the rest
const FAMILIAR = ["British", "Irish", "Italian", "Indian", "Chinese", "Thai", "Mexican", "French", "Greek", "Spanish", "American", "Japanese", "Vietnamese", "Moroccan"];
const areaOf = new Map();
for (const a of FAMILIAR) {
  for (const m of ((await get(`filter.php?a=${encodeURIComponent(a)}`)).meals || [])) areaOf.set(m.idMeal, a);
}
// Not a meal on its own, or a near-duplicate of one we have
const NOT_A_MEAL = /\b(pickle|sauerkraut|dip|jam|chutney|sauce|dressing|stock|gravy|relish|salsa|marinade|seasoning|syrup)\b/i;
// "Fettucine alfredo" = "Fettuccine Alfredo"; "Air fryer patatas bravas" = "Patatas bravas"
const norm = (t) => t.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
const sameAs = (title) => { const n = norm(title); return [...haveTitles].some(t => { const m = norm(t); return m.includes(n) || n.includes(m); }); };

const added = [];
for (const [cat, n] of PLAN) {
  if (added.length >= WANT) break;
  const raw = (await get(`filter.php?c=${encodeURIComponent(cat)}`)).meals || [];
  const list = [...raw].sort((x, y) => (areaOf.has(y.idMeal) ? 1 : 0) - (areaOf.has(x.idMeal) ? 1 : 0));
  let took = 0;
  for (const item of list) {
    if (NOT_A_MEAL.test(item.strMeal) || sameAs(item.strMeal)) continue;
    if (cat !== "Breakfast" && !areaOf.has(item.idMeal)) continue; // breakfasts are few: take any
    if (took >= n || added.length >= WANT) break;
    if (have.has(`mealdb-${item.idMeal}`) || haveTitles.has(item.strMeal.toLowerCase())) continue;
    const full = ((await get(`lookup.php?i=${item.idMeal}`)).meals || [])[0];
    if (!full || full.strCategory === "Dessert") continue;
    const r = toRecipe(full);
    if (r.ingredients.length < 3 || !r.instructions.length) continue;
    added.push(r);
    have.add(r.id);
    haveTitles.add(r.title.toLowerCase());
    took++;
    console.log(`+ ${r.mealType.padEnd(9)} ${r.title} (${r.subtitle})`);
  }
}

const all = [...existing, ...added];
const newHeader = header.replace(/Fetched 2026-11-07\./, "Fetched 2026-11-07; more added 2026-11-08 (scripts/fetch-mealdb.mjs).");
writeFileSync(FILE, `${newHeader}export const MEALDB_RECIPES = ${JSON.stringify(all, null, 2)};\n`);
console.log(`\nAdded ${added.length}; ${all.length} built-in recipes now.`);
