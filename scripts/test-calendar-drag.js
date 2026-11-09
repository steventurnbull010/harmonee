#!/usr/bin/env node
// Moving calendar events by dragging (js/calendar-drag.js): what gets saved.
// One-off events move; a repeating event moved "just this one" skips that date
// (isEventOnDate stops showing it) and gets a one-off copy on the new day;
// "every one" moves the series. Runs the real file with small stand-ins.
// Run: node scripts/test-calendar-drag.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function extract(file, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const start = src.indexOf(`function ${name}(`);
  let i = src.indexOf("{", src.indexOf(")", start)), depth = 0;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
}

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

function world(events, answer) {
  const win = {
    familyEvents: JSON.parse(JSON.stringify(events)),
    saved: null, toast: null,
    Sheet: { choose: async () => answer },
    document: { readyState: "complete", getElementById: () => null, addEventListener() {} },
    console
  };
  win.window = win;
  win.saveFamilyEvents = (list) => { win.saved = JSON.parse(JSON.stringify(list)); };
  win.renderWeekCalendar = () => {};
  win.showTaskMoveToast = (text, undo) => { win.toast = text; win.undo = undo; };
  vm.createContext(win);
  vm.runInContext(extract("js/utils.js", "getLocalDateKey"), win);
  vm.runInContext(extract("js/utils.js", "isEventOnDate"), win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "calendar-drag.js"), "utf8"), win);
  return win;
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const on = (win, evt, key) => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d); return win.isEventOnDate(evt, key, DAYS[dt.getDay()], dt); };

(async () => {
  // A one-off: Tuesday 10 Nov to Thursday 12 Nov, keeps its time
  let w = world([{ id: "a", title: "Dentist", date: "2026-11-10", day: "Tuesday", time: "09:00", repeat: "none" }], null);
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-12", null);
  check("one-off: new day", [w.saved[0].date, w.saved[0].day, w.saved[0].time], ["2026-11-12", "Thursday", "09:00"]);
  check("one-off: message", w.toast, `"Dentist" moved to Thu 12 Nov`);

  // A one-off on a timeline: new day and new time (16:30 = 990 minutes)
  w = world([{ id: "a", title: "Dentist", date: "2026-11-10", day: "Tuesday", time: "09:00", repeat: "none" }], null);
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-11", 990);
  check("one-off: new day and time", [w.saved[0].date, w.saved[0].time], ["2026-11-11", "16:30"]);

  // Undo puts it back
  w.undo();
  check("undo: back where it was", [w.saved[0].date, w.saved[0].time], ["2026-11-10", "09:00"]);

  // Weekly tutor, just this week: Tuesday 10 Nov skipped, a one-off on Thursday 12 Nov
  const tutor = { id: "t", title: "Ava's tutor", day: "Tuesday", time: "15:30", repeat: "weekly", member: "Ava" };
  w = world([tutor], "one");
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-12", null);
  const series = w.saved.find(e => e.id === "t"), copy = w.saved.find(e => e.id !== "t");
  check("just this one: series skips that Tuesday", series.skipDates, ["2026-11-10"]);
  check("just this one: one-off on Thursday", [copy.date, copy.day, copy.time, copy.repeat, copy.movedFrom], ["2026-11-12", "Thursday", "15:30", "none", "t"]);
  check("just this one: not on Tue 10th any more", on(w, series, "2026-11-10"), false);
  check("just this one: still on Tue 17th", on(w, series, "2026-11-17"), true);
  check("just this one: copy on Thu 12th only", [on(w, copy, "2026-11-12"), on(w, copy, "2026-11-19")], [true, false]);

  // Weekly tutor, every week: moves to Thursdays
  w = world([tutor], "all");
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-12", null);
  check("every one: Thursdays now", [w.saved.length, w.saved[0].day, w.saved[0].time], [1, "Thursday", "15:30"]);
  check("every one: message", w.toast, `Every "Ava's tutor" moved`);

  // Weekly with a start date: the start date shifts by the same two days
  w = world([{ ...tutor, date: "2026-11-03" }], "all");
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-12", 1020);
  check("every one with a start date: shifted", [w.saved[0].date, w.saved[0].day, w.saved[0].time], ["2026-11-05", "Thursday", "17:00"]);

  // Cancelled: nothing saved
  w = world([tutor], null);
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-12", null);
  check("cancelled: nothing saved", w.saved, null);

  // Dropped where it already was: nothing saved, nothing asked
  w = world([tutor], "all");
  await w.moveCalendarEvent(w.familyEvents[0], "2026-11-10", "2026-11-10", 930);
  check("same day and time: nothing saved", w.saved, null);

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
