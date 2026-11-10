#!/usr/bin/env node
// Which time of day a job is grouped under when it has no routineSlot: only
// whole words that really mean a time count, never parts of words ("bed" in
// "bedsheets"). A set routineSlot always wins. Loads js/utils.js.
// Run: node scripts/test-routine-slots.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, window: {}, document: { addEventListener() {}, getElementById: () => null, querySelector: () => null } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "utils.js"), "utf8"), ctx);
const label = (title, extra = {}) => ctx.getTaskRoutineInfo({ title, ...extra }).label;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (got === want) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const MORNING = "☀️ Morning", AFTERNOON = "⛅ Afternoon", EVENING = "🌙 Evening";

check("Change the bedsheets is not Evening", label("Change the bedsheets"), "");
check("Ava Bedroom Full Renovation is not Evening", label("Ava Bedroom Full Renovation"), "");
check("Make the bed is not Evening", label("Make the bed"), "");
check("Dinner money is not Evening", label("Dinner money"), "");
check("Bedtime story is Evening", label("Bedtime story"), EVENING);
check("Read before bed is Evening", label("Read before bed"), EVENING);
check("Night-time tablets is Evening", label("Night-time tablets"), EVENING);
check("Feed the cats (evening) is Evening", label("Feed the cats (evening)"), EVENING);
check("Brush teeth (PM) is Evening", label("Brush teeth (PM)"), EVENING);
check("Empty the dishwasher after dinner stays Evening", label("Empty the dishwasher after dinner"), EVENING);
check("Morning teeth is Morning", label("Morning teeth"), MORNING);
check("Brush teeth (AM) is Morning", label("Brush teeth (AM)"), MORNING);
check("Homework after school is Afternoon", label("Homework after school"), AFTERNOON);
check("a category that means a time counts", label("Tidy up", { category: "Evening routine" }), EVENING);
check("an explicit routineSlot wins over the title", label("Bedtime story", { routineSlot: "morning" }), MORNING);
check("an explicit anytime slot wins too", label("Feed the cats (evening)", { routineSlot: "anytime" }), "🕑 Anytime");
check("no task at all is safe", ctx.getTaskRoutineInfo(null).label, "");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
