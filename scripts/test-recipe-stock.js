#!/usr/bin/env node
// Stand-in photos for family recipes with no photo (js/recipe-stock.js).
// Run: node scripts/test-recipe-stock.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/recipe-stock.js"), "utf8"), ctx, { filename: "js/recipe-stock.js" });
const S = ctx.RecipeStock;
let pass = 0, fail = 0;
const check = (name, got, want) => { if (got === want) pass++; else { fail++; console.log(`✗ ${name}: wanted ${want}, got ${got}`); } };
check("Easy Apple Crumble", S.kindFor({ title: "Easy Apple Crumble", mealType: "snack" }), "pudding");
check("Chipotle Bean Chilli", S.kindFor({ title: "Chipotle Bean Chilli", mealType: "dinner", ingredients: ["1 carton Red Kidney Beans", "150g Basmati Rice"] }), "pot");
check("Grandad's beef stew", S.kindFor({ title: "Grandad's beef stew", mealType: "dinner" }), "pot");
check("Pasta bake is pasta", S.kindFor({ title: "Tuna pasta bake" }), "pasta");
check("Nana's flapjacks", S.kindFor({ title: "Nana's flapjacks", mealType: "snack" }), "baking");
check("Salmon traybake by name", S.kindFor({ title: "Honey salmon" }), "fish");
check("Sunday roast", S.kindFor({ title: "Sunday roast" }), "roast");
check("Breakfast meal", S.kindFor({ title: "Dad's special", mealType: "breakfast" }), "breakfast");
check("Name says nothing: ingredients", S.kindFor({ title: "Mum's Tuesday tea", mealType: "dinner", ingredients: ["400g spaghetti", "1 jar sauce"] }), "pasta");
check("Nothing to go on, dinner", S.kindFor({ title: "Something nice", mealType: "dinner" }), "table");
check("Nothing to go on, lunch", S.kindFor({ title: "Something nice", mealType: "lunch" }), "salad");
check("Bedsheets-style part words don't count", S.kindFor({ title: "Hamster cake" }), "baking");
check("photo path", S.photoFor({ title: "Easy Apple Crumble" }), "images/recipes/stock/pudding.jpg");
for (const k of ["baking", "pudding", "pot", "pasta", "roast", "fish", "salad", "breakfast", "table"]) {
  check(`${k}.jpg exists`, fs.existsSync(path.join(__dirname, "..", "images/recipes/stock", `${k}.jpg`)), true);
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
