#!/usr/bin/env node
// What's in the fridge (17 Nov): which recipe ingredients count as "got",
// and how recipes are ranked. Uses the real js/grocery.js and js/fridge.js.
// Run: node scripts/test-fridge.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const window = { familyMembers: [] };
const ctx = vm.createContext({ window, document: { addEventListener() {} }, console });
for (const f of ["js/grocery.js", "js/fridge.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
const F = window.Fridge;
const key = (t) => window.Grocery.parseLine(t).key;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

const have = ["Cheddar cheese", "Chicken breasts", "Milk", "Red peppers", "Eggs", "Frozen peas", "Tinned chopped tomatoes"].map(key);
const same = (recipeLine) => have.some(h => F._same(key(recipeLine), h));
check("grated cheddar is cheddar cheese", same("100g grated cheddar"), true);
check("cheese is cheddar cheese", same("50g cheese"), true);
check("chicken thighs count as chicken", same("4 chicken thighs"), true);
check("milk is milk", same("300ml milk"), true);
check("coconut milk isn't milk", same("400ml coconut milk"), false);
check("a pepper is a red pepper", same("1 green pepper, sliced"), true);
check("peas are frozen peas", same("200g peas"), true);
check("chopped tomatoes", same("400g can chopped tomatoes"), true);
check("eggs", same("2 large eggs, beaten"), true);
check("beef isn't chicken", same("500g beef mince"), false);
check("onion isn't anything here", same("1 onion"), false);

const omelette = { id: "o", title: "Cheese omelette", mealType: "breakfast", ingredients: ["3 eggs", "50g grated cheddar", "Salt and pepper", "1 tbsp olive oil", "1 tsp dried oregano", "Splash of milk"] };
const m = F.match(omelette, have);
check("salt, pepper, oil and dried herbs don't count", [m.have.length, m.need.length, m.total], [3, 0, 3]);

check("any oil is a cupboard basic", F.match({ ingredients: ["2 tbsp frying vegetable oil", "1 egg"] }, have).total, 1);
const fajitas = { id: "f", title: "Chicken fajitas", mealType: "dinner", ingredients: ["2 chicken breasts", "2 red peppers", "1 onion", "8 tortilla wraps", "1 tsp ground cumin", "Soured cream"] };
const mf = F.match(fajitas, have);
check("fajitas: have chicken and peppers", mf.have.length, 2);
check("fajitas: need onion, wraps, soured cream", mf.need.length, 3);

const curry = { id: "c", title: "Thai curry", mealType: "dinner", ingredients: ["400ml coconut milk", "500g beef", "1 onion", "Rice"] };
const pudding = { id: "p", title: "Rice pudding", mealType: "pudding", ingredients: ["Milk", "Eggs", "Rice"] };
const ranked = F._rank([curry, fajitas, omelette, pudding], have, "dinner").map(x => x.r.id);
check("dinner: fajitas in, curry (nothing got) out, breakfast and pudding out", ranked, ["f"]);
check("breakfast: the omelette", F._rank([curry, fajitas, omelette], have, "breakfast").map(x => x.r.id), ["o"]);

console.log(`${fail ? "❌" : "✅"} what's in the fridge: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
