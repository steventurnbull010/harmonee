#!/usr/bin/env node
// Streaks (js/streaks.js): counted from the days a daily job was done.
// Run: node scripts/test-streaks.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console, Date };
ctx.window = ctx;
// The app's ISO week key (Monday-to-Sunday weeks), as utils.js has it
ctx.getIsoWeekKey = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 86400000 + 1) / 7)).padStart(2, "0")}`; };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/streaks.js"), "utf8"), ctx, { filename: "js/streaks.js" });
const S = ctx.Streaks;
let pass = 0, fail = 0;
const check = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); } };
const tue = new Date(2026, 10, 10, 18, 0); // Tue 10 Nov 2026
const daily = (extra) => ({ title: "Brush teeth", repeat: "daily", ...extra });
check("this week's Monday and Tuesday ticks: 2 days", S.streakOf(daily({ completedDays: { Monday: { completedWeek: "2026-W46" }, Tuesday: { completedWeek: "2026-W46" } } }), tue), 2);
check("last week's ticks carried in tickDates: 6 days", S.streakOf(daily({ tickDates: ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"], completedDays: { Monday: { completedWeek: "2026-W46" }, Tuesday: { completedWeek: "2026-W46" } } }), tue), 6);
check("not done yet today: counts up to yesterday", S.streakOf(daily({ tickDates: ["2026-11-08", "2026-11-09"] }), tue), 2);
check("a gap breaks it", S.streakOf(daily({ tickDates: ["2026-11-06", "2026-11-07", "2026-11-09", "2026-11-10"] }), tue), 2);
check("nothing since Saturday: 0", S.streakOf(daily({ tickDates: ["2026-11-06", "2026-11-07"] }), tue), 0);
check("last week's tick still in completedDays doesn't count as this week", S.streakOf(daily({ completedDays: { Wednesday: { completedWeek: "2026-W45" } } }), tue), 0);
check("a future day this week doesn't count", S.streakOf(daily({ completedDays: { Thursday: { completedWeek: "2026-W46" }, Tuesday: { completedWeek: "2026-W46" } } }), tue), 1);
check("weekly jobs don't have streaks", S.streakOf({ repeat: "weekly", tickDates: ["2026-11-10"] }, tue), 0);
check("Tuesday's date in this week", S.dateOfWeekday("Tuesday", tue), "2026-11-10");
check("Sunday's date in this week", S.dateOfWeekday("Sunday", tue), "2026-11-15");
const t = daily({ tickDates: ["2026-11-09"] });
S.recordTick(t, "2026-11-10");
check("a tick adds the date", t.tickDates, ["2026-11-09", "2026-11-10"]);
S.recordUntick(t, "2026-11-10");
check("taking it back removes it", t.tickDates, ["2026-11-09"]);
const long = daily({ tickDates: Array.from({ length: 70 }, (_, i) => { const d = new Date(2026, 8, 1 + i); return S.keyOf(d); }) });
const saved = S.recordTick(long, "2026-11-10");
check("a long list is trimmed to two months", long.tickDates.length, 60);
check("…and saved whole when trimmed", Array.isArray(saved.tickDates), true);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
