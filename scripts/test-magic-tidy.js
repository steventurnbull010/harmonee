#!/usr/bin/env node
// Magic Import: what Gemini sends back is checked before use (js/magic-import.js
// tidy). Includes the junk times seen live on 10 Nov ("10:00px").
// Run: node scripts/test-magic-tidy.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ctx = { console, familyMembers: ["Steven", "Sorcha", "Ava", "Dara"], document: { addEventListener() {}, getElementById: () => null }, setTimeout, Date };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/magic-import.js"), "utf8"), ctx, { filename: "js/magic-import.js" });
const tidy = ctx.MagicImport._tidy;
let pass = 0, fail = 0;
const check = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); } };
const soon = (() => { const d = new Date(); d.setDate(d.getDate() + 20); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const one = (e) => tidy({ events: [{ title: "Fair", date: soon, allDay: false, ...e }] })[0];
check("a proper time", one({ startTime: "10:00", endTime: "13:00" }).start, "10:00");
check("junk after the time (seen live)", one({ startTime: "10:00px" }).start, "10:00");
check("junk words after the time (seen live)", one({ startTime: "10:00 rescue" }).start, "10:00");
check("seconds and a Z", one({ startTime: "10:00:00.000Z" }).start, "10:00");
check("one-digit hour", one({ startTime: "9:30" }).start, "09:30");
check("not a time: all day", one({ startTime: "soon" }).allDay, true);
check("25:00 isn't a time", one({ startTime: "25:00" }).allDay, true);
check("end time kept", one({ startTime: "14:00", endTime: "16:30" }).end, "16:30");
check("only family names", one({ startTime: "14:00", people: ["Ava", "Bob"] }).people, ["Ava"]);
check("HTML stripped from the title", one({ title: "Fair <img src=x onerror=alert(1)>" }).title, "Fair");
check("a bad date is dropped", tidy({ events: [{ title: "X", date: "2026-13-45" }] }).length, 0);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
