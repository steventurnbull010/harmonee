#!/usr/bin/env node
// Checks several dishes in one meal (js/meal-dishes.js): an old one-dish meal
// reads exactly as before, dishes are added once each with puddings last,
// and taking a dish off (even the main one) leaves the rest planned.
// Run: node scripts/test-meal-dishes.js
const fs = require("fs");
const path = require("path");

global.window = global;
eval(fs.readFileSync(path.join(__dirname, "..", "js/meal-dishes.js"), "utf8"));
const { dishesOf, withDish, withoutDish, summary, isPudding } = global.MealDishes;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

// A dinner saved by an older build: one recipe, no extras
const old = { title: "Sausages with onion gravy", recipeId: "r1", emoji: "🌭", cook: "Grandad", notes: "Slow cooked", tags: "", category: "dinner", hasRecipe: true, ingredients: ["8 sausages", "2 onions"], instructions: ["Brown", "Simmer"] };
const sausages = { id: "r1", title: "Sausages with onion gravy", mealType: "dinner", emoji: "🌭", ingredients: ["8 sausages", "2 onions"], instructions: ["Brown", "Simmer"] };
const colcannon = { id: "r2", title: "Colcannon", mealType: "dinner", ingredients: ["1kg potatoes", "Half a cabbage"], instructions: ["Boil", "Mash"] };
const crumble = { id: "r3", title: "Apple crumble", mealType: "snack", ingredients: ["6 apples"], instructions: ["Bake"] };

check("old meal is one dish", dishesOf(old).map(d => d.title), ["Sausages with onion gravy"]);
check("old meal summary unchanged", summary(old), "Sausages with onion gravy");
check("no meal, no dishes", dishesOf(null), []);

let m = withDish(old, crumble);
check("pudding added after", dishesOf(m).map(d => [d.title, d.course]), [["Sausages with onion gravy", "main"], ["Apple crumble", "pudding"]]);
check("main stays where old code reads it", [m.title, m.recipeId, m.cook, m.notes], ["Sausages with onion gravy", "r1", "Grandad", "Slow cooked"]);
m = withDish(m, colcannon);
check("second recipe goes before the pudding", dishesOf(m).map(d => d.title), ["Sausages with onion gravy", "Colcannon", "Apple crumble"]);
check("summary counts the others", summary(m), "Sausages with onion gravy + 2 more");
check("the same recipe isn't added twice", dishesOf(withDish(m, colcannon)).length, 3);
check("extras keep their ingredients", m.extras[0].ingredients, ["1kg potatoes", "Half a cabbage"]);

const noMain = withoutDish(m, 0);
check("taking off the main makes the next one main", [noMain.title, noMain.recipeId, noMain.cook, noMain.notes], ["Colcannon", "r2", "Grandad", ""]);
check("…and keeps the pudding", dishesOf(noMain).map(d => d.title), ["Colcannon", "Apple crumble"]);
const noPud = withoutDish(m, 2);
check("taking off the pudding", dishesOf(noPud).map(d => d.title), ["Sausages with onion gravy", "Colcannon"]);
check("last dish off: nothing planned", withoutDish(withoutDish(noPud, 1), 0), null);
check("one dish left: no extras field", "extras" in withoutDish(noPud, 1), false);

// A pudding planned first, then a main: the main becomes the main dish
const pudFirst = withDish({ title: "Apple crumble", recipeId: "r3", course: "pudding", ingredients: ["6 apples"] }, sausages);
check("a main goes before a pudding planned first", [pudFirst.title, dishesOf(pudFirst).map(d => d.title)], ["Sausages with onion gravy", ["Sausages with onion gravy", "Apple crumble"]]);

check("snack recipes are puddings", isPudding(crumble), true);
check("dessert tag", isPudding({ mealType: "dinner", tags: ["Dessert"] }), true);
check("a dinner isn't", isPudding(colcannon), false);
check("a planned dinner isn't", isPudding(old), false);

console.log(`${fail ? "❌" : "✅"} meal dishes: ${pass} passed${fail ? `, ${fail} failed` : ""}`);
process.exit(fail ? 1 : 0);
