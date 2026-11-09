#!/usr/bin/env node
// The shopping list rules (js/grocery.js): kitchen measures show just the
// ingredient, amounts you buy stay, and items for meals that have passed
// come off (unless an upcoming meal or a person put them there too).
// Run: node scripts/test-grocery.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = new Map();
const ctx = { console, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "grocery.js"), "utf8"), ctx);
const G = ctx.Grocery;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
// What one or more recipe lines become on the list
const listOf = (lines, opts = {}) => {
  const items = [];
  G.addLinesToItems(items, lines, { title: "Test", sourceKey: "Test|2026-11-20|dinner", includeBasics: !!opts.basics });
  return items.map(i => G.displayText(i));
};

// Kitchen measures: just the name
check("a teaspoon of cinnamon", listOf(["1 tsp ground cinnamon"]), ["Cinnamon"]);
check("a pinch of salt (when salt is wanted)", listOf(["a pinch of salt"], { basics: true }), ["Salt"]);
check("tablespoons of honey", listOf(["2 tbsp honey"]), ["Honey"]);
check("cloves of garlic", listOf(["3 cloves garlic, crushed"]), ["Garlic"]);
check("sprigs of thyme", listOf(["4 sprigs thyme"]), ["Thyme"]);
check("a cup of rice", listOf(["1 cup basmati rice"]), ["Basmati rice"]);
check("a knob of butter", listOf(["knob of butter"]), ["Butter"]);

check("basil leaves", listOf(["6 leaves basil"]), ["Basil"]);
check("a sprinkling of parmesan", listOf(["sprinkling Parmigiano-Reggiano"]), ["Parmigiano-Reggiano"]);

// Amounts you buy: kept
check("grams", listOf(["300g butter"]), ["300g Butter"]);
check("millilitres", listOf(["50ml maple syrup"]), ["50ml Maple syrup"]);
check("a count", listOf(["3 large eggs"]), ["3 Eggs"]);
check("a can", listOf(["1 can chopped tomatoes"]), ["1 can Tomatoes"]);
check("an onion", listOf(["an onion, diced"]), ["1 Onion"]);
check("grams plus a spoon: the grams", listOf(["100g butter", "1 tbsp butter"]), ["100g Butter"]);

// Salt, pepper, oil and water are still left out unless asked for
check("salt left out by default", listOf(["a pinch of salt"]), []);

// ---- Meals that have passed --------------------------------------------------
const items = [];
G.addLinesToItems(items, ["500g beef mince", "1 onion"], { title: "Lasagne", sourceKey: "Lasagne|2026-11-03|dinner" });
G.addLinesToItems(items, ["2 onions", "200g pasta"], { title: "Bolognese", sourceKey: "Bolognese|2026-11-12|dinner" });
G.addLinesToItems(items, ["4 tomatoes"], { title: "Salad", sourceKey: "Salad|2026-11-05|lunch" });
items.push({ id: "hand", text: "Milk", checked: false, source: "Manual", grocery: { key: "milk", name: "Milk", amounts: { loose: true }, sources: ["Lasagne"], sourceKeys: ["Lasagne|2026-11-03|dinner"] } });
items.find(i => G.displayText(i).includes("Tomato")).checked = true; // already bought

check("nothing to clear before the meals", G.hasPastMeals(items, "2026-11-03"), false);
check("something to clear after Lasagne night", G.hasPastMeals(items, "2026-11-09"), true);
const res = G.clearPastMeals(items, "2026-11-09");
const left = items.map(i => G.displayText(i)).sort();
check("Lasagne's mince comes off", left.some(t => /mince/i.test(t)), false);
check("onions stay for the upcoming Bolognese", left.some(t => /onion/i.test(t)), true);
check("pasta stays", left.some(t => /pasta/i.test(t)), true);
check("the bought tomatoes are left alone", left.some(t => /tomato/i.test(t)), true);
check("milk typed in by hand stays", left.includes("Milk"), true);
check("onions now only say Bolognese", items.find(i => /onion/i.test(G.displayText(i))).grocery.sources, ["Bolognese"]);
check("one item removed", res.removed.length, 1);
check("the meal it was for", res.titles, ["Lasagne"]);
check("running it again changes nothing", G.clearPastMeals(items, "2026-11-09").removed.length, 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
