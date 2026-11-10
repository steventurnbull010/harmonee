#!/usr/bin/env node
// Kinds of list (js/list-types.js): worked out from the name, whose wish
// list, packing suggestions, and links and prices in wish list items.
// Run: node scripts/test-list-types.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console, familyMembers: ["Steven", "Sorcha", "Ava", "Dara"], document: { baseURI: "https://harmonee-app.web.app/" } };
ctx.window = ctx;
ctx.URL = URL;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/list-types.js"), "utf8"), ctx, { filename: "js/list-types.js" });
const T = ctx.ListTypes;
let pass = 0, fail = 0;
const check = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); } };

// The Turnbull board's lists, by name
check("Family Groceries", T.typeOf({ id: "groceries", title: "Family Groceries", emoji: "🛒" }), "shopping");
check("Holiday & Travel Packing", T.typeOf({ id: "packing", title: "Holiday & Travel Packing", emoji: "🧳" }), "packing");
check("Ava Christmas List", T.typeOf({ title: "Ava Christmas List", emoji: "🎄" }), "wish");
check("Steve Xmas 🎁 (📋 icon)", T.typeOf({ title: "Steve Xmas 🎁", emoji: "📋" }), "wish");
check("Weekend jobs", T.typeOf({ title: "Weekend jobs", emoji: "📋" }), "todo");
check("a kind that's been set wins", T.typeOf({ title: "Christmas shopping", type: "todo" }), "todo");
check("Pack lunches isn't packing", T.typeOf({ title: "Packed lunch ideas" }), "todo");
// Whose
check("Ava's", T.ownerOf({ title: "Ava Christmas List" }), "Ava");
check("Steve is Steven", T.ownerOf({ title: "Steve Xmas 🎁" }), "Steven");
check("Sorcha's", T.ownerOf({ title: "Sorcha Xmas list" }), "Sorcha");
check("set owner wins", T.ownerOf({ title: "Ava Christmas List", owner: "Dara" }), "Dara");
check("nobody named", T.ownerOf({ title: "Christmas ideas" }), "");
// Packing suggestions: the Family bit and a bit each
const st = T.packingStarter();
check("Passports for the family", st.some(s => s.text === "Passports" && s.who === "Family"), true);
check("a toothbrush each", st.filter(s => s.text === "Toothbrush").map(s => s.who), ["Steven", "Sorcha", "Ava", "Dara"]);
// Wish list items
check("price and link", T.wishParts("Burgundy Vans £60 https://www.vans.co.uk/shoes?id=1"), { name: "Burgundy Vans", price: "£60", link: "https://www.vans.co.uk/shoes?id=1", site: "vans.co.uk" });
check("just a name", T.wishParts("Art set"), { name: "Art set", price: "", link: "", site: "" });
check("pence", T.wishParts("Book £7.99").price, "£7.99");
check("not a javascript: link", T.wishParts("javascript:alert(1) Lego").link, "");
check("cover is a full address", T.coverUrl({ title: "Ava Christmas List" }), "https://harmonee-app.web.app/images/lists/wish.jpg");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
