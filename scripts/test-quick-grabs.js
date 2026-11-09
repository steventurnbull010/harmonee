#!/usr/bin/env node
// Which jobs are Quick grabs pills, which stay in the Big jobs panel, and when
// a job counts as "Grabbed" for a day. Loads js/quick-grabs.js with the few
// helpers it needs from js/tasks.js.
// Run: node scripts/test-quick-grabs.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = {
  console,
  window: {},
  isPersonalRoutine: (t) => /\bteeth\b|\bmake (your |the )?bed\b/i.test(t.title),
  isUnassignedValue: (v) => !v || (Array.isArray(v) ? !v.length : ["up for grabs", "anyone", "family"].includes(String(v).toLowerCase())),
  getIsoWeekKey: () => "2026-W46"
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "quick-grabs.js"), "utf8"), ctx);
const { isQuickGrab, isGrabbedOn } = ctx.QuickGrabs;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const daily = (title, extra = {}) => ({ title, repeat: "daily", day: "Daily", taskType: "Daily Task", ...extra });
const monday = new Date(2026, 10, 9);

check("a daily household job is a quick grab", isQuickGrab(daily("Litter trays")), true);
check("a daily job marked Bigger job isn't", isQuickGrab(daily("Clear the garden", { grabSize: "big" })), false);
check("a personal routine isn't", isQuickGrab(daily("Brush teeth")), false);
check("a weekly job isn't", isQuickGrab({ title: "Wash the car", repeat: "weekly", day: "Saturday" }), false);
check("a one-off job isn't", isQuickGrab({ title: "Take the car in", repeat: "none", date: "2026-11-09" }), false);

const grabbed = daily("Litter trays", { assignedTo: null, assignedOverrides: { "2026-W46|Monday": "Ava" } });
check("taken from the tray today counts as Grabbed", isGrabbedOn(grabbed, monday), true);
check("…but not on another day", isGrabbedOn(grabbed, new Date(2026, 10, 10)), false);
check("given back (override to nobody) isn't Grabbed", isGrabbedOn(daily("Litter trays", { assignedOverrides: { "2026-W46|Monday": null } }), monday), false);
check("someone's regular job swapped to someone else isn't Grabbed", isGrabbedOn(daily("Dishwasher", { assignedTo: "Dara", assignedOverrides: { "2026-W46|Monday": "Ava" } }), monday), false);
check("on a rota day with nobody, a grab counts", isGrabbedOn(daily("Dishwasher", { assignedTo: "Dara", assignedDays: { Monday: null }, assignedOverrides: { "2026-W46|Monday": "Ava" } }), monday), true);

// Every week, any day: a quick grab, and a grab lasts the whole week
const sheets = { title: "Change the bedsheets", repeat: "weekly", day: "Anyday", anyDay: true };
check("a weekly any-day job is a quick grab", isQuickGrab(sheets), true);
check("…unless it's a bigger job", isQuickGrab({ ...sheets, grabSize: "big" }), false);
const sheetsGrabbed = { ...sheets, assignedOverrides: { "2026-W46|any": "Dara" } };
check("grabbed for the week counts on Monday", isGrabbedOn(sheetsGrabbed, monday), true);
check("…and on Thursday", isGrabbedOn(sheetsGrabbed, new Date(2026, 10, 12)), true);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
