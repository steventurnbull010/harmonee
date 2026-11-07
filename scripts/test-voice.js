#!/usr/bin/env node
// Checks the voice phrase rules (js/voice-intent.js) against real sentences.
// Run: node scripts/test-voice.js
const V = require("../js/voice-intent.js");

// "Now" is Wednesday 4 November 2026, 10:00
const NOW = new Date(2026, 10, 4, 10, 0);
const ctx = {
  now: NOW,
  members: ["Steven", "Sorcha", "Ava", "Dara"],
  lists: [{ id: "groceries", title: "Shopping" }, { id: "l-holiday", title: "Holiday packing" }, { id: "l-diy", title: "DIY jobs" }]
};
const day = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

// [sentence, expected fields, extra ctx]
const CASES = [
  // ---- Lists
  ["Add vinegar to my shopping list", { kind: "list", listId: "groceries", items: ["vinegar"] }],
  ["Put milk and eggs on the list", { kind: "list", listId: "groceries", items: ["milk", "eggs"] }],
  ["We need bin bags", { kind: "list", items: ["bin bags"] }],
  ["We're out of cereal", { kind: "list", items: ["cereal"] }],
  ["we are running low on washing up liquid", { kind: "list", items: ["washing up liquid"] }],
  ["add bread, butter and jam to the shopping list", { kind: "list", items: ["bread", "butter", "jam"] }],
  ["Add sun cream to the holiday list", { kind: "list", listId: "l-holiday", items: ["sun cream"] }],
  ["put passports on the holiday packing list", { kind: "list", listId: "l-holiday", items: ["passports"] }],
  ["add sandpaper to the DIY list", { kind: "list", listId: "l-diy", items: ["sandpaper"] }],
  ["can you add some bananas to the shopping list please", { kind: "list", items: ["bananas"] }],
  ["pop toilet roll on the shopping list", { kind: "list", items: ["toilet roll"] }],
  ["We need some more milk", { kind: "list", items: ["milk"] }],
  ["buy a bottle of olive oil", { kind: "list", items: ["olive oil"] }],
  ["I'm out of coffee", { kind: "list", items: ["coffee"] }],
  ["add apples and pears to the grocery list", { kind: "list", items: ["apples", "pears"] }],
  ["vinegar", { kind: "list", items: ["vinegar"] }, { want: "list" }],
  ["milk and bread", { kind: "list", items: ["milk", "bread"] }, { want: "list" }],
  ["Add strawberries", { kind: "list", items: ["strawberries"] }, { want: "list" }],

  // ---- Events: dates
  ["Dentist tomorrow at 3", { kind: "event", title: "Dentist", date: "2026-11-05", start: "15:00", end: "16:00" }],
  ["A trip to the theatre next Wednesday at 7:30", { kind: "event", title: "Trip to the theatre", date: "2026-11-11", start: "19:30" }],
  ["trip to the theater this Wednesday at 7.30pm", { kind: "event", title: "Trip to the theatre", date: "2026-11-04", start: "19:30" }],
  ["Swimming on Saturday at 10am", { kind: "event", title: "Swimming", date: "2026-11-07", start: "10:00" }],
  ["Parents evening Thursday at 6", { kind: "event", date: "2026-11-05", start: "18:00" }],
  ["Bin day on Friday", { kind: "event", title: "Bin day", date: "2026-11-06", allDay: true }],
  ["haircut wednesday week at 11", { kind: "event", title: "Haircut", date: "2026-11-18", start: "11:00" }],
  ["Party on the 14th", { kind: "event", title: "Party", date: "2026-11-14", allDay: true }],
  ["Granny's birthday on the 14th of November", { kind: "event", title: "Granny's birthday", date: "2026-11-14" }],
  ["Flights on 2nd December at 6am", { kind: "event", title: "Flights", date: "2026-12-02", start: "06:00" }],
  ["Christmas concert on December the 16th at 2", { kind: "event", title: "Christmas concert", date: "2026-12-16", start: "14:00" }],
  ["Book club in three days", { kind: "event", title: "Book club", date: "2026-11-07" }],
  ["MOT the day after tomorrow at 9", { kind: "event", title: "MOT", date: "2026-11-06", start: "09:00" }],
  ["Takeaway tonight at 7", { kind: "event", title: "Takeaway", date: "2026-11-04", start: "19:00" }],
  ["Football today at half past four", { kind: "event", title: "Football", date: "2026-11-04", start: "16:30" }],
  ["Piano lesson Monday at quarter to eight in the morning", { kind: "event", title: "Piano lesson", date: "2026-11-09", start: "07:45" }],
  ["Lunch with Gran at noon on Sunday", { kind: "event", date: "2026-11-08", start: "12:00" }],
  ["Work from 9 till 5 on Tuesday", { kind: "event", title: "Work", date: "2026-11-10", start: "09:00", end: "17:00" }],
  ["Drinks from 6 to 7 on Friday", { kind: "event", title: "Drinks", date: "2026-11-06", start: "18:00", end: "19:00" }],
  ["Meeting tomorrow at 2 for 2 hours", { kind: "event", title: "Meeting", start: "14:00", end: "16:00" }],
  ["Gym tomorrow morning at 7", { kind: "event", title: "Gym", date: "2026-11-05", start: "07:00" }],
  ["cinema friday at 8", { kind: "event", title: "Cinema", date: "2026-11-06", start: "20:00" }],
  ["Add an event for Saturday called car boot sale", { kind: "event", title: "Car boot sale", date: "2026-11-07" }],
  ["Add a doctor's appointment on Thursday at 11:15", { kind: "event", title: "Doctor's appointment", date: "2026-11-05", start: "11:15" }],
  ["put the school play in the calendar for next Friday at 1", { kind: "event", title: "School play", date: "2026-11-06", start: "13:00" }],
  ["dentist", { kind: "event", title: "Dentist", allDay: true }, { want: "event" }],

  // ---- Events: people
  ["Ava's dentist on Tuesday at 4", { kind: "event", title: "Ava's dentist", members: ["Ava"], start: "16:00" }],
  ["Swimming for Dara on Saturday at 9", { kind: "event", title: "Swimming", members: ["Dara"], start: "09:00" }],
  ["Sorsha's yoga tomorrow at 6pm", { kind: "event", members: ["Sorcha"], start: "18:00" }],
  ["Day out at the zoo for the whole family on Sunday", { kind: "event", title: "Day out at the zoo", members: ["Family"], date: "2026-11-08" }],
  ["Rugby for Ava and Dara on Saturday at 10", { kind: "event", title: "Rugby", members: ["Ava", "Dara"] }],

  ["Theatre for Mom and Kid 1 on Friday at 7", { kind: "event", title: "Theatre", members: ["Mom", "Kid 1"], start: "19:00" }, { members: ["Mom", "Dad", "Kid 1", "Kid 2"] }],
  ["Coffee with Sorcha tomorrow at 11", { kind: "event", title: "Coffee", members: ["Sorcha"], start: "11:00" }],
  ["Lunch with Gran on Sunday at 1", { kind: "event", title: "Lunch with Gran", members: [] }],

  // ---- Tasks
  ["Ava needs to tidy her room on Saturday", { kind: "task", title: "Tidy her room", people: ["Ava"], date: "2026-11-07", daily: false }],
  ["Remind Dara to feed the cat", { kind: "task", title: "Feed the cat", people: ["Dara"] }],
  ["Add a task for Steven to fix the gate", { kind: "task", title: "Fix the gate", people: ["Steven"] }],
  ["Dara needs to brush his teeth every day", { kind: "task", title: "Brush his teeth", people: ["Dara"], daily: true }],
  ["remind Ava to practise piano every evening", { kind: "task", title: "Practise piano", people: ["Ava"], daily: true, slot: "evening" }],
  ["Add a chore for Sorcha to water the plants tomorrow", { kind: "task", title: "Water the plants", people: ["Sorcha"], date: "2026-11-05" }],
  ["Create a job to clean the car", { kind: "task", title: "Clean the car", people: [] }],
  ["Steven has to mow the lawn on Sunday", { kind: "task", title: "Mow the lawn", people: ["Steven"], date: "2026-11-08" }],
  ["empty the dishwasher", { kind: "task", title: "Empty the dishwasher" }, { want: "task" }],
  ["Ava to empty the bins", { kind: "task", title: "Empty the bins", people: ["Ava"] }, { want: "task" }],

  ["Kid 2 needs to tidy her room on Saturday", { kind: "task", title: "Tidy her room", people: ["Kid 2"], date: "2026-11-07" }, { members: ["Mom", "Dad", "Kid 1", "Kid 2"] }],
  ["Add a task for Kid 1 to set the table", { kind: "task", title: "Set the table", people: ["Kid 1"] }, { members: ["Mom", "Dad", "Kid 1", "Kid 2"] }],

  // ---- Not sure
  ["hello there", { kind: "unknown" }],
  ["what's the weather like", { kind: "unknown" }],
  ["", { kind: "unknown" }],

  // ---- Spelling quirks from speech engines
  ["Add tomatoes to my shopping list.", { kind: "list", items: ["tomatoes"] }],
  ["Swimming on Saturday at 10 a.m.", { kind: "event", start: "10:00" }],
  ["Badminton Thursday at seven thirty in the evening", { kind: "event", title: "Badminton", start: "19:30" }],
  ["Badminton Thursday at seven thirty", { kind: "event", title: "Badminton", start: "07:30" }],
  ["Book a table at Nandos on Friday at 7", { kind: "event", title: "Table at Nandos", start: "19:00" }],
  ["GP appointment Monday at 9:40", { kind: "event", title: "GP appointment", start: "09:40" }]
];

let pass = 0, fail = 0;
CASES.forEach(([text, want, extra]) => {
  const got = V.parse(text, { ...ctx, ...(extra || {}) });
  const problems = [];
  Object.keys(want).forEach(k => {
    let g = got[k];
    if (g instanceof Date) g = day(g);
    const w = want[k];
    const same = Array.isArray(w) ? JSON.stringify(g) === JSON.stringify(w) : g === w;
    if (!same) problems.push(`${k}: wanted ${JSON.stringify(w)}, got ${JSON.stringify(g)}`);
  });
  if (problems.length) {
    fail++;
    console.log(`✗ "${text}"\n    ${problems.join("\n    ")}`);
  } else pass++;
});
console.log(`\n${pass} passed, ${fail} failed (${CASES.length} sentences)`);
process.exit(fail ? 1 : 0);
