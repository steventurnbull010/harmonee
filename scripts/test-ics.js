#!/usr/bin/env node
// Reading calendar feeds (functions/ics.js): a Google-style feed with the
// things family calendars have. Run: node scripts/test-ics.js
const ics = require("../functions/ics.js");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

const FEED = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "X-WR-TIMEZONE:Europe/London",
  "BEGIN:VTIMEZONE", "TZID:Europe/London", "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0000", "END:DAYLIGHT", "END:VTIMEZONE",
  // A one-off timed event in UTC (Google often writes Z times)
  "BEGIN:VEVENT", "DTSTART:20261111T163000Z", "DTEND:20261111T173000Z", "UID:swim@google.com", "SUMMARY:Swimming", "LOCATION:Leisure centre\\, Main St", "END:VEVENT",
  // A weekly class across the clock change (25 Oct 2026): stays at 9am
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261017T090000", "DTEND;TZID=Europe/London:20261017T100000", "RRULE:FREQ=WEEKLY;BYDAY=SA", "UID:football@google.com", "SUMMARY:Football", "END:VEVENT",
  // An all-day event over three days
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261123", "UID:trip@google.com", "SUMMARY:Lake District trip", "END:VEVENT",
  // Every weekday at 8:15, one skipped, one moved, one cancelled, ends 27 Nov
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261109T081500", "DTEND;TZID=Europe/London:20261109T084500",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261127T235959Z", "EXDATE;TZID=Europe/London:20261113T081500", "UID:school@google.com", "SUMMARY:School run", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261118T091500", "DTEND;TZID=Europe/London:20261118T094500", "RECURRENCE-ID;TZID=Europe/London:20261118T081500", "UID:school@google.com", "SUMMARY:School run (late start)", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261119T081500", "RECURRENCE-ID;TZID=Europe/London:20261119T081500", "UID:school@google.com", "STATUS:CANCELLED", "SUMMARY:School run", "END:VEVENT",
  // Second Tuesday of the month, 6 times
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261013T193000", "DURATION:PT1H30M", "RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=6", "UID:pta@google.com", "SUMMARY:PTA meeting", "END:VEVENT",
  // Last Friday of the month
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20261030T180000", "DTEND;TZID=Europe/London:20261030T200000", "RRULE:FREQ=MONTHLY;BYDAY=-1FR", "UID:quiz@google.com", "SUMMARY:Pub quiz", "END:VEVENT",
  // A birthday every year (all-day), started long ago
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:19801203", "DTEND;VALUE=DATE:19801204", "RRULE:FREQ=YEARLY", "UID:bday@google.com", "SUMMARY:Mum's birthday", "END:VEVENT",
  // Daily since 2015 (must still reach the window)
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20150101T070000", "DTEND;TZID=Europe/London:20150101T071500", "RRULE:FREQ=DAILY", "UID:meds@google.com", "SUMMARY:Feed the cats", "END:VEVENT",
  // A cancelled one-off: not shown
  "BEGIN:VEVENT", "DTSTART:20261112T100000Z", "UID:dentist@google.com", "STATUS:CANCELLED", "SUMMARY:Dentist", "END:VEVENT",
  // A folded long line and an event in New York time
  "BEGIN:VEVENT", "DTSTART;TZID=America/New_York:20261116T090000", "DTEND;TZID=America/New_York:20261116T100000", "UID:call@google.com",
  "SUMMARY:Call with the New York team about the very long project name that g", " oes on", "BEGIN:VALARM", "TRIGGER:-PT10M", "SUMMARY:Alarm", "END:VALARM", "END:VEVENT",
  "END:VCALENDAR"
].join("\r\n");

const { events } = ics.toHarmoneeEvents(FEED, { member: "Sam", tz: "Europe/London", fromKey: "2026-11-01", toKey: "2026-12-31" });
const on = (date, title) => events.filter(e => e.date === date && e.title.startsWith(title));
const one = (date, title) => { const l = on(date, title); return l.length === 1 ? { time: l[0].time, duration: l[0].duration } : l.length; };

check("UTC one-off shows at UK time", one("2026-11-11", "Swimming"), { time: "16:30", duration: "1 hour" });
check("location unescaped", on("2026-11-11", "Swimming")[0].location, "Leisure centre, Main St");
check("weekly class after the clock change stays at 9am", one("2026-11-14", "Football"), { time: "09:00", duration: "1 hour" });
check("weekly class every Saturday in the window (8 Saturdays, 1 Nov–31 Dec)", events.filter(e => e.title === "Football").length, 8);
check("three-day trip: one per day", events.filter(e => e.title.startsWith("Lake District")).map(e => e.date + " " + e.title), ["2026-11-20 Lake District trip (day 1 of 3)", "2026-11-21 Lake District trip (day 2 of 3)", "2026-11-22 Lake District trip (day 3 of 3)"]);
check("all-day has no time", on("2026-11-20", "Lake District")[0].duration, "All day");
check("weekday school run on Monday", one("2026-11-16", "School run"), { time: "08:15", duration: "30 mins" });
check("skipped date (EXDATE) not shown", on("2026-11-13", "School run").length, 0);
check("moved repeat shows its new time and title", one("2026-11-18", "School run"), { time: "09:15", duration: "30 mins" });
check("moved repeat title", on("2026-11-18", "School run")[0].title, "School run (late start)");
check("cancelled repeat not shown", on("2026-11-19", "School run").length, 0);
check("no school run at weekends", on("2026-11-14", "School run").length, 0);
check("ends with UNTIL", on("2026-11-30", "School run").length, 0);
check("school runs: 15 weekdays 9–27 Nov, less one skipped and one cancelled", events.filter(e => e.title.startsWith("School run")).length, 13);
check("2nd Tuesday", events.filter(e => e.title === "PTA meeting").map(e => e.date), ["2026-11-10", "2026-12-08"]);
check("2nd Tuesday length from DURATION", on("2026-11-10", "PTA")[0].duration, "1.5 hours");
check("last Friday", events.filter(e => e.title === "Pub quiz").map(e => e.date), ["2026-11-27", "2026-12-25"]);
check("yearly birthday from 1980", events.filter(e => e.title === "Mum's birthday").map(e => e.date), ["2026-12-03"]);
check("daily since 2015 reaches the window", events.filter(e => e.title === "Feed the cats").length, 61);
check("cancelled one-off not shown", on("2026-11-12", "Dentist").length, 0);
check("folded line joined", on("2026-11-16", "Call with")[0].title.endsWith("goes on"), true);
check("New York 9am is 2pm in the UK", one("2026-11-16", "Call with"), { time: "14:00", duration: "1 hour" });
check("alarm text not taken as the title", events.some(e => e.title === "Alarm"), false);
check("everyone's Sam's, read-only, from Google", events.every(e => e.member === "Sam" && e.readOnly && e.source === "google"), true);
check("ids are stable", ics.toHarmoneeEvents(FEED, { member: "Sam", fromKey: "2026-11-01", toKey: "2026-12-31" }).events.map(e => e.id).join(), events.map(e => e.id).join());
check("ids unique", new Set(events.map(e => e.id)).size, events.length);
check("in date order", events.map(e => e.date + e.time).join() === [...events].map(e => e.date + e.time).sort().join(), true);

// Spring clock change: 9am stays 9am
const spring = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART;TZID=Europe/London:20270320T090000", "DTEND;TZID=Europe/London:20270320T100000", "RRULE:FREQ=WEEKLY;COUNT=3", "UID:s@x", "SUMMARY:Gym", "END:VEVENT", "END:VCALENDAR"].join("\n");
check("weekly across the spring clock change", ics.toHarmoneeEvents(spring, { fromKey: "2027-03-01", toKey: "2027-04-30" }).events.map(e => `${e.date} ${e.time}`), ["2027-03-20 09:00", "2027-03-27 09:00", "2027-04-03 09:00"]);
// The 31st of each month skips short months
const monthly31 = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20270131", "RRULE:FREQ=MONTHLY;COUNT=4", "UID:m@x", "SUMMARY:Pay day", "END:VEVENT", "END:VCALENDAR"].join("\n");
check("monthly on the 31st skips short months", ics.toHarmoneeEvents(monthly31, { fromKey: "2027-01-01", toKey: "2027-12-31" }).events.map(e => e.date), ["2027-01-31", "2027-03-31", "2027-05-31", "2027-07-31"]);
// Every other week
const fortnightly = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20261102T180000Z", "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "UID:f@x", "SUMMARY:Bins", "END:VEVENT", "END:VCALENDAR"].join("\n");
check("every other Monday", ics.toHarmoneeEvents(fortnightly, { fromKey: "2026-11-01", toKey: "2026-12-01" }).events.map(e => e.date), ["2026-11-02", "2026-11-16", "2026-11-30"]);
// Repeats say how they repeat (Google's copies used to say "Does not repeat")
const W = (rule, start) => ics.repeatWords(ics.parseRule(rule), start);
const tue = { y: 2026, m: 11, d: 17 };
check("weekly, from the start day", W("FREQ=WEEKLY", tue), "Every week on Tuesday");
check("weekly on two days", W("FREQ=WEEKLY;BYDAY=MO,WE", tue), "Every week on Monday and Wednesday");
check("every weekday", W("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", tue), "Every weekday");
check("every other week", W("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", tue), "Every 2 weeks on Monday");
check("daily", W("FREQ=DAILY", tue), "Every day");
check("monthly on the date", W("FREQ=MONTHLY", tue), "Every month on the 17th");
check("monthly on the 2nd Tuesday", W("FREQ=MONTHLY;BYDAY=2TU", tue), "Every month on the 2nd Tuesday");
check("monthly on the last Friday", W("FREQ=MONTHLY;BYDAY=-1FR", tue), "Every month on the last Friday");
check("yearly", W("FREQ=YEARLY", tue), "Every year on 17 November");
check("each copy carries the words", [...new Set(ics.toHarmoneeEvents(fortnightly, { fromKey: "2026-11-01", toKey: "2026-12-01" }).events.map(e => e.repeatText))], ["Every 2 weeks on Monday"]);
check("a one-off has none", ics.toHarmoneeEvents(spring.replace("RRULE:FREQ=WEEKLY;COUNT=3\n", ""), { fromKey: "2027-03-01", toKey: "2027-04-30" }).events.map(e => e.repeatText || ""), [""]);
// Limit
check("a huge feed is capped", ics.toHarmoneeEvents(FEED, { fromKey: "2026-11-01", toKey: "2026-12-31", max: 5 }).events.length, 5);

// Links: only real calendar feeds, with a reason when not
const L = (u) => { const r = ics.checkLink(u); return r.ok ? r.kind : r.problem; };
check("Google secret address", L("https://calendar.google.com/calendar/ical/sam%40gmail.com/private-abc123def/basic.ics"), "google");
check("Google public address", L("https://calendar.google.com/calendar/ical/sam%40gmail.com/public/basic.ics"), "public");
check("a Google Calendar page, not the address", L("https://calendar.google.com/calendar/u/0/r/settings/calendar/abc"), "google-page");
check("Outlook", L("https://outlook.live.com/owa/calendar/00000000-0000/abc/calendar.ics"), "outlook");
check("iCloud webcal", L("webcal://p52-caldav.icloud.com/published/2/MTIz"), "icloud");
check("somewhere else", L("https://example.com/calendar.ics"), "not-calendar");
check("not a link", L("my calendar"), "not-a-link");
check("empty", L("  "), "empty");
check("http (not https) refused", L("http://calendar.google.com/calendar/ical/a/private-b/basic.ics"), "not-a-link");

console.log(`${fail ? "❌" : "✅"} calendar feeds: ${pass} passed${fail ? `, ${fail} failed` : ""}`);
process.exit(fail ? 1 : 0);
