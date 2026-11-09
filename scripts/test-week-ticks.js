#!/usr/bin/env node
// Checks that the weekly reset keeps this week's ticks (including ticks saved
// by older builds without a week stamp) and drops last week's, and that the
// podium scores old unstamped ticks in the week they were made.
// Pulls the real functions out of app.js and js/rewards.js by name.
// Run: node scripts/test-week-ticks.js
const fs = require("fs");
const path = require("path");

function extract(file, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in ${file}`);
  let i = src.indexOf("{", src.indexOf(")", start)), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

global.window = global;
eval(extract("app.js", "getIsoWeekKey") + "\nglobal.getIsoWeekKey = getIsoWeekKey;");
eval(extract("app.js", "keepThisWeeksDays") + "\nglobal.keepThisWeeksDays = keepThisWeeksDays;");
global.normalizeFamilyMemberName = (n) => n;
eval(extract("js/rewards.js", "computeMemberScores") + "\nglobal.computeMemberScores = computeMemberScores;");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

// Monday 9 Nov 2026 is in 2026-W46; Sunday 8 Nov is in 2026-W45
check("week of Mon 9 Nov", getIsoWeekKey(new Date(2026, 10, 9, 8)), "2026-W46");
check("week of Sun 8 Nov", getIsoWeekKey(new Date(2026, 10, 8, 20)), "2026-W45");

const days = {
  Sunday: { completedBy: "Ava", completedAt: new Date(2026, 10, 8, 19).toISOString(), completedWeek: "2026-W45" },
  Saturday: { completedBy: "Dara", completedAt: new Date(2026, 10, 7, 9).toISOString() },              // old build, last week
  Monday: { completedBy: ["Ava", "Dara"], completedAt: new Date(2026, 10, 9, 8, 2).toISOString() },   // old build, this week
  Tuesday: { completedBy: "Steven", completedAt: new Date(2026, 10, 10, 7).toISOString(), completedWeek: "2026-W46" },
  Friday: "Sorcha"                                                                                     // very old string tick
};
check("reset keeps this week's ticks, stamped or not", Object.keys(keepThisWeeksDays(days, "2026-W46")).sort(), ["Monday", "Tuesday"]);
check("reset with nothing ticked", keepThisWeeksDays(undefined, "2026-W46"), {});

window.familyMembers = ["Steven", "Sorcha", "Ava", "Dara"];
window.boardSettings = {};
window.currentTasks = [{ title: "Make Your Bed", day: "Daily", taskType: "Daily Task", completedDays: days }];
const score = (wk) => Object.fromEntries(Object.entries(computeMemberScores(wk)).map(([m, d]) => [m, d.score]));
check("last week's points include the unstamped Saturday tick", score("2026-W45"), { Steven: 0, Sorcha: 1, Ava: 1, Dara: 1 });
check("this week's points include the unstamped Monday tick", score("2026-W46"), { Steven: 1, Sorcha: 1, Ava: 1, Dara: 1 });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
