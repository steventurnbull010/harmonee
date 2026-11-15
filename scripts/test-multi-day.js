#!/usr/bin/env node
// Multi-day events (15 Nov): an all-day event that doesn't repeat, with an
// endDate, shows on every day from its date to its endDate; bars for them
// get lanes so they never overlap. Uses the real helpers from js/utils.js.
// Run: node scripts/test-multi-day.js
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

const names = ["getLocalDateKey", "dayNumOfKey", "keyOfDayNum", "eventSpan", "eventSpanDay", "spanLanes", "isEventOnDate"];
const H = new Function(`const MAX_SPAN_DAYS = 366;\n${names.map(n => extract("js/utils.js", n)).join("\n")}\nreturn { ${names.join(", ")} };`)();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const on = (e, key) => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d); return H.isEventOnDate(e, key, DAYS[dt.getDay()], dt); };
const daysShown = (e, from, to) => {
  const out = [];
  for (let n = H.dayNumOfKey(from); n <= H.dayNumOfKey(to); n++) { const k = H.keyOfDayNum(n); if (on(e, k)) out.push(k); }
  return out;
};

const trip = { id: "t", title: "Cornwall", date: "2026-11-20", endDate: "2026-11-23", time: "All Day", duration: "All Day", repeat: "none" };
check("a 4-day trip shows Fri to Mon", daysShown(trip, "2026-11-18", "2026-11-25"), ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
check("its span", H.eventSpan(trip), { start: "2026-11-20", end: "2026-11-23", days: 4 });
check("day 2 of 4", H.eventSpanDay(trip, "2026-11-21"), { day: 2, days: 4, first: false, last: false, start: "2026-11-20", end: "2026-11-23" });
check("not a day of it", H.eventSpanDay(trip, "2026-11-24"), null);

const overMonth = { ...trip, date: "2026-12-30", endDate: "2027-01-02" };
check("over New Year", daysShown(overMonth, "2026-12-28", "2027-01-04"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
const overClocks = { ...trip, date: "2027-03-27", endDate: "2027-03-29" };
check("over the clocks going forward", H.eventSpan(overClocks).days, 3);

// Ignored (shows on its first day only): end before start, timed, repeating, bad date
check("end before start", daysShown({ ...trip, endDate: "2026-11-19" }, "2026-11-18", "2026-11-25"), ["2026-11-20"]);
check("same-day end", H.eventSpan({ ...trip, endDate: "2026-11-20" }), null);
check("timed event", H.eventSpan({ ...trip, time: "09:00", duration: "1 hour" }), null);
check("weekly event", H.eventSpan({ ...trip, repeat: "weekly", day: "Friday" }), null);
check("nonsense end", daysShown({ ...trip, endDate: "soon" }, "2026-11-18", "2026-11-25"), ["2026-11-20"]);
check("all day with no time set", H.eventSpan({ ...trip, time: "" }).days, 4);
check("a year at most", H.eventSpan({ ...trip, endDate: "2029-01-01" }).days, 366);
check("legacy one-day event unchanged", daysShown({ date: "2026-11-20", time: "10:00", repeat: "none" }, "2026-11-18", "2026-11-25"), ["2026-11-20"]);

// Lanes across a week, Mon 16 to Sun 22 Nov
const week = Array.from({ length: 7 }, (_, i) => H.keyOfDayNum(H.dayNumOfKey("2026-11-16") + i));
const ev = (id, date, endDate) => ({ id, title: id, date, endDate, time: "All Day", duration: "All Day", repeat: "none" });
const lay = H.spanLanes(week, [ev("A", "2026-11-16", "2026-11-17"), ev("B", "2026-11-17", "2026-11-19"), ev("C", "2026-11-18", "2026-11-20"), ev("D", "2026-11-21", "2026-11-28"), ev("Old", "2026-11-01", "2026-11-03")]);
check("lanes: A and C share, B below, D back on top", lay.bars.map(b => `${b.evt.id}@${b.lane}:${b.from}+${b.len}`), ["A@0:0+2", "B@1:1+3", "C@0:2+3", "D@0:5+2"]);
check("two lanes", lay.lanes, 2);
check("D carries on past Sunday", lay.bars.find(b => b.evt.id === "D").endsAfter, true);
const before = H.spanLanes(week, [ev("E", "2026-11-10", "2026-11-17")]).bars[0];
check("E started the week before", [before.from, before.len, before.startsBefore, before.endsAfter], [0, 2, true, false]);
check("no spans, no lanes", H.spanLanes(week, [{ id: "x", date: "2026-11-18", time: "10:00" }]), { bars: [], lanes: 0 });

console.log(`${fail ? "❌" : "✅"} multi-day events: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
