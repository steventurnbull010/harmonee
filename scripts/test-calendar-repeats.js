#!/usr/bin/env node
// Checks repeating events land on the right days: monthly on the 29th–31st
// falls on the last day of shorter months, and 29 February shows on the 28th
// in years without one. Uses the real isEventOnDate from js/utils.js and app.js.
// Run: node scripts/test-calendar-repeats.js
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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

for (const file of ["js/utils.js"]) { // app.js uses this one (its copy was removed 11 Nov)
  const isEventOnDate = new Function(extract("js/utils.js", "getLocalDateKey") + "\n" + extract(file, "isEventOnDate") + "\nreturn isEventOnDate;")();
  // Every day in a year that the event shows on, as "M-D"
  const daysShown = (e, year) => {
    const out = [];
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (isEventOnDate(e, key, DAYS[d.getDay()], new Date(d))) out.push(`${d.getMonth() + 1}-${d.getDate()}`);
    }
    return out;
  };
  const monthly31 = { repeat: "monthly", date: "2026-01-31" };
  check(`${file}: monthly on the 31st, every month of 2027`, daysShown(monthly31, 2027),
    ["1-31", "2-28", "3-31", "4-30", "5-31", "6-30", "7-31", "8-31", "9-30", "10-31", "11-30", "12-31"]);
  check(`${file}: monthly on the 15th stays on the 15th`, daysShown({ repeat: "monthly", date: "2026-01-15" }, 2027).length, 12);
  const leapDay = { repeat: "annually", date: "2024-02-29" };
  check(`${file}: 29 Feb birthday in 2027 (no leap day)`, daysShown(leapDay, 2027), ["2-28"]);
  check(`${file}: 29 Feb birthday in 2028 (leap year)`, daysShown(leapDay, 2028), ["2-29"]);
  check(`${file}: nothing before the first date`, daysShown(monthly31, 2025), []);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
