#!/usr/bin/env node
// Reward photos (js/reward-photos.js): a goal's photo from its name and icon.
// Run: node scripts/test-reward-photos.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console, escapeHtml: (s) => String(s) };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/reward-photos.js"), "utf8"), ctx, { filename: "js/reward-photos.js" });
const P = ctx.RewardPhotos;
let pass = 0, fail = 0;
const check = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); } };
check("Cinema trip: film", P.guess("Cinema trip"), "film");
check("Pizza and film night: film (film comes first)", P.guess("Pizza and film night"), "film");
check("Takeaway pizza: pizza", P.guess("Takeaway pizza"), "pizza");
check("Trip to Legoland: day out, not toys", P.guess("Trip to Legoland"), "dayout");
check("New Lego set: toys", P.guess("New Lego set"), "toys");
check("Games night: board game, not console", P.guess("Family games night"), "boardgame");
check("Extra screen time: video games", P.guess("Extra screen time"), "games");
check("£10 to spend: money", P.guess("£10 to spend"), "money");
check("Sleepover: nothing fits", P.guess("Sleepover"), null);
check("nothing in the name, 🍦 icon: ice cream", P.guess("Something nice", "🍦"), "icecream");
check("'Matchbox cars' isn't football", P.guess("Matchbox cars"), null);
check("chosen photo wins over the name", P.keyFor({ title: "Cinema trip", photo: "swim" }), "swim");
check("no photo chosen: none", P.keyFor({ title: "Cinema trip", photo: "none" }), null);
check("an old goal with no photo field: from its name", P.photoFor({ title: "Swimming", emoji: "🏊" }), "images/rewards/swim.jpg");
check("every photo has a file", P.PHOTOS.every(p => fs.existsSync(path.join(__dirname, "..", "images/rewards", `${p.key}.jpg`))), true);
console.log(`${fail ? "❌" : "✅"} reward photos: ${pass} passed${fail ? `, ${fail} failed` : ""}`);
process.exit(fail ? 1 : 0);
