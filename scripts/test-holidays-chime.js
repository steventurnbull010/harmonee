#!/usr/bin/env node
// Bank holidays (js/bank-holidays.js with js/bank-holidays-data.js) and the
// event chime's "what's due" check (js/event-chime.js).
// Run: node scripts/test-holidays-chime.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = new Map();
const ctx = {
  console,
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
  document: { addEventListener() {}, getElementById: () => null, hidden: false },
  matchMedia: () => ({ matches: false }),
  setInterval: () => 0, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
  getComputedStyle: () => ({ display: "none" })
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["js/bank-holidays-data.js", "js/bank-holidays.js", "js/event-chime.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

// ---- Bank holidays ----------------------------------------------------------------
const BH = ctx.BankHolidays;
ctx.boardSettings = {};
check("England & Wales by default", BH.region(), "england-and-wales");
check("Christmas Day", BH.on("2026-12-25"), "Christmas Day");
check("Boxing Day 2026 is a Saturday: Monday 28th is the day off, and says so", BH.on("2026-12-28"), "Day off for Boxing Day");
check("Christmas Day 2026 (a Friday) is just Christmas Day", BH.on("2026-12-25"), "Christmas Day");
check("Saturday 26th is still Boxing Day (not a bank holiday)", [BH.on("2026-12-26"), BH.dayOf("2026-12-26")], [null, { name: "Boxing Day", dayOff: "2026-12-28" }]);
check("its chip says Boxing Day, and where the day off is", [/Boxing Day/.test(BH.chipHtml("2026-12-26")), /the bank holiday is Monday 28 December/.test(BH.chipHtml("2026-12-26"))], [true, true]);
check("the banner calls it a holiday, not a bank holiday", /bank-holiday-label">Holiday</.test(BH.chipHtml("2026-12-26", "banner")), true);
check("Christmas 2027 (a Saturday) shows on the 25th, day off the 27th", [BH.dayOf("2027-12-25").name, BH.on("2027-12-27")], ["Christmas Day", "Day off for Christmas Day"]);
check("a Thursday is no holiday at all", BH.dayOf("2026-12-24"), null);
const xmas = BH.eventFor("2026-12-25");
check("Christmas Day as an event to open", [xmas.id, xmas.title, xmas.source, xmas.duration, xmas.icon, xmas.countdown], ["bh-2026-12-25", "Christmas Day", "holiday", "All day", "🎉", false]);
check("the chip opens it", /data-holiday-date="2026-12-25"/.test(BH.chipHtml("2026-12-25")), true);
ctx.boardSettings = { eventExtras: { "bh-2026-12-25": { countdown: true, icon: "🎄" } } };
ctx.getLocalDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
check("with a countdown and its own icon", [BH.eventFor("2026-12-25").countdown, BH.eventFor("2026-12-25").icon, /🎄/.test(BH.chipHtml("2026-12-25"))], [true, "🎄", true]);
check("counted down to", BH.countdownEvents().map(e => e.id), new Date() <= new Date(2026, 11, 25) ? ["bh-2026-12-25"] : []);
ctx.boardSettings = {};
check("an ordinary day", BH.on("2026-11-09"), null);
check("the data runs to the end of 2028", ctx.BANK_HOLIDAYS_DATA.until >= "2028-12-01", true);
ctx.boardSettings = { bankHolidays: "scotland" };
check("Scotland: 2 January", BH.on("2026-01-02"), "2nd January");
check("Scotland: 2 January 2027 is a Saturday, so Monday 4th is the day off", BH.on("2027-01-04"), "Day off for 2nd January");
ctx.boardSettings = { bankHolidays: "northern-ireland" };
check("Northern Ireland: St Patrick's Day", BH.on("2027-03-17"), "St Patrick’s Day");
ctx.boardSettings = { bankHolidays: "off" };
check("switched off", BH.on("2026-12-25"), null);
check("no chip when off", BH.chipHtml("2026-12-25"), "");
ctx.boardSettings = { bankHolidays: "nonsense" };
check("an unknown setting falls back to England & Wales", BH.region(), "england-and-wales");
ctx.boardSettings = {};
check("chip text", /Christmas Day/.test(BH.chipHtml("2026-12-25", "month")), true);

// ---- Event chime: what's due --------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
ctx.getLocalDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
ctx.getEventMinutes = (e) => { const [h, m] = String(e.time).split(":").map(Number); return h * 60 + m; };
ctx.isEventOnDate = (e, key) => e.date === key || e.repeat === "daily";
const now = new Date(2026, 10, 9, 16, 20); // 4:20pm
const today = "2026-11-09";
ctx.familyEvents = [
  { id: "swim", title: "Swimming", date: today, time: "16:30", duration: "1 hour", member: "Jo" },
  { id: "later", title: "Dinner out", date: today, time: "19:00", duration: "2 hours" },
  { id: "past", title: "School run", date: today, time: "15:00", duration: "30 mins" },
  { id: "allday", title: "Bin day", date: today, time: "All day", duration: "All Day" },
  { id: "tomorrow", title: "Dentist", date: "2026-11-10", time: "16:30" }
];
const due = (mins) => ctx.EventChime.due(now, mins).map(x => `${x.evt.id}:${x.until}`);
check("15 minutes before: swimming (in 10)", due(15), ["swim:10"]);
check("5 minutes before: nothing yet", due(5), []);
check("off: nothing", due(0), []);
store.set("harmonee_event_chime_done", JSON.stringify({ day: today, ids: ["swim"] }));
check("already chimed today: not again", due(15), []);
store.set("harmonee_event_chime_done", JSON.stringify({ day: "2026-11-08", ids: ["swim"] }));
check("chimed yesterday doesn't count today", due(15), ["swim:10"]);
store.delete("harmonee_event_chime_done");
check("phones and computers: off until set", ctx.EventChime.lead(), 0);
store.set("harmonee_event_chime_minutes", "30");
check("set to 30 on this device", ctx.EventChime.lead(), 30);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
