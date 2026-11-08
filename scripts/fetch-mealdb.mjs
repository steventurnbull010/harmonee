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
const FAMILY = process.argv.includes("--family"); // family-friendly picks (2026-11-08 second batch)

// What to look for, in order, and how many of each (to fill the gaps)
const FAMILY_PLAN = [
  ["Breakfast", 5], ["Chicken", 20], ["Beef", 15], ["Pork", 10], ["Seafood", 12], ["Vegetarian", 15],
  ["Pasta", 6], ["Lamb", 5], ["Starter", 4], ["Side", 6], ["Miscellaneous", 4], ["Vegan", 2]
];
// Family favourites score higher; things kids (and many grown-ups) won't eat are left out
const FAVOURITE = /\b(pasta|pizza|burger|chicken|meatballs?|lasagne|lasagna|pie|fajitas?|tacos?|burritos?|quesadillas?|curry|korma|tikka|stew|roast|shepherd|cottage|fish|nuggets?|sausages?|mac|macaroni|rice|noodles?|stir[- ]?fry|soup|wraps?|pancakes?|omelette|quiche|risotto|bolognese|spaghetti|penne|bake|casserole|kebabs?|goujons|fingers|jacket|potato|chilli|enchiladas?|teriyaki|sweet and sour|fried rice|frittata|toad|hotpot|pasties?)\b/i;
const TOO_HOT = /\b(spicy|chillies|chilies|szechuan|sichuan|ma ?po|kung pao|hot and sour|drunken|jerk|peri[- ]?peri|piri[- ]?piri|firecracker|fiery)\b/i;
const NOT_FAMILY = /\b(kidney|kidneys|liver|tripe|heart|tongue|offal|snails?|escargot|goat|brains?|sweetbreads|blood|octopus|eel|frogs?|rabbit|pigeon|quail|venison|scotch bonnet|habanero|vindaloo|phaal|ghost pepper|squid|calamari|clams?|octopus|mussels?|anchov(y|ies)|whelks?|cockles?)\b/i;
const EXTRA_TITLES = ["Pancakes", "Banana Pancakes"]; // classics asked for by name

const PLAN = [
  ["Breakfast", 8], ["Starter", 8], ["Vegetarian", 9], ["Vegan", 4],
  ["Seafood", 6], ["Chicken", 6], ["Pasta", 4], ["Beef", 4], ["Lamb", 3], ["Pork", 3], ["Side", 3], ["Miscellaneous", 4]
];
const EMOJI = { Breakfast: "🍳", Chicken: "🍗", Seafood: "🐟", Vegetarian: "🥗", Vegan: "🥗", Pork: "🥓", Beef: "🥩", Lamb: "🍖", Pasta: "🍝" };
const MEAT = ["Beef", "Lamb", "Pork", "Goat"];

// Polite: a short pause between requests, and wait and retry if told to slow down (429)
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const get = async (path) => {
  for (let tries = 0; tries < 6; tries++) {
    await pause(250);
    const res = await fetch(`${API}/${path}`);
    if (res.status === 429) { await pause(3000 * (tries + 1)); continue; }
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }
  throw new Error(`${path}: still rate-limited`);
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
// (TheMealDB's names: "United States", "France", "India")
const FAMILIAR = ["British", "Irish", "Italian", "India", "Chinese", "Thai", "Mexican", "France", "Greek", "Spanish", "United States", "Japanese", "Vietnamese", "Moroccan", "Canadian", "Australian", "Portuguese", "Turkish"];
const areaOf = new Map();
for (const a of FAMILIAR) {
  for (const m of ((await get(`filter.php?a=${encodeURIComponent(a)}`)).meals || [])) areaOf.set(m.idMeal, a);
}
// Not a meal on its own, or a near-duplicate of one we have
const SWEET = /\b(cake|cakes|cookies?|brownies?|cheesecake|donuts?|doughnuts?|fudge|tart|tarts|crumble|mousse|trifle|biscuits?|scones?|ice cream|sorbet|pudding|pavlova|meringue|macarons?)\b/i;
const NOT_A_MEAL = /\b(ezme|pickle|sauerkraut|dip|jam|chutney|sauce|dressing|stock|gravy|relish|salsa|marinade|seasoning|syrup)\b/i;
// "Fettucine alfredo" = "Fettuccine Alfredo"; "Air fryer patatas bravas" = "Patatas bravas"
const norm = (t) => t.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
const sameAs = (title) => { const n = norm(title); return [...haveTitles].some(t => { const m = norm(t); return m.includes(n) || n.includes(m); }); };

const added = [];
// Named extras first (looked up by title)
if (FAMILY) {
  for (const t of EXTRA_TITLES) {
    const m = ((await get(`search.php?s=${encodeURIComponent(t)}`)).meals || []).find(x => x.strMeal.toLowerCase() === t.toLowerCase());
    if (!m || have.has(`mealdb-${m.idMeal}`) || sameAs(m.strMeal)) continue;
    const r = toRecipe(m);
    r.mealType = r.category = "breakfast";
    r.tags = [...r.tags.filter(x => !["lunch", "dinner"].includes(x)), "breakfast"].filter((x, i, a) => a.indexOf(x) === i);
    r.subtitle = [m.strArea && m.strArea !== "Unknown" ? m.strArea : "", "Breakfast"].filter(Boolean).join(" · ");
    r.emoji = "🥞";
    added.push(r); have.add(r.id); haveTitles.add(r.title.toLowerCase());
    console.log(`+ breakfast ${r.title} (named extra)`);
  }
}
for (const [cat, n] of (FAMILY ? FAMILY_PLAN : PLAN)) {
  if (added.length >= WANT) break;
  const raw = (await get(`filter.php?c=${encodeURIComponent(cat)}`)).meals || [];
  const rankOf = (m) => (areaOf.has(m.idMeal) ? 2 : 0) + (FAMILY && FAVOURITE.test(m.strMeal) ? 3 : 0);
  const list = [...raw].sort((x, y) => rankOf(y) - rankOf(x));
  let took = 0;
  for (const item of list) {
    if (NOT_A_MEAL.test(item.strMeal) || sameAs(item.strMeal)) continue;
    if (FAMILY && (NOT_FAMILY.test(item.strMeal) || TOO_HOT.test(item.strMeal))) continue;
    if (cat !== "Breakfast" && SWEET.test(item.strMeal)) continue; // desserts filed under other categories
    if (FAMILY && cat === "Breakfast" && !areaOf.has(item.idMeal) && !FAVOURITE.test(item.strMeal)) continue;
    if (cat !== "Breakfast" && !areaOf.has(item.idMeal) && !(FAMILY && FAVOURITE.test(item.strMeal))) continue; // breakfasts are few: take any
    if (took >= n || added.length >= WANT) break;
    if (have.has(`mealdb-${item.idMeal}`) || haveTitles.has(item.strMeal.toLowerCase())) continue;
    const full = ((await get(`lookup.php?i=${item.idMeal}`)).meals || [])[0];
    if (!full || full.strCategory === "Dessert") continue;
    const r = toRecipe(full);
    if (FAMILY && NOT_FAMILY.test([r.title, ...r.ingredients].join(" "))) continue;
    if (FAMILY) r.tags.push("family");
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
