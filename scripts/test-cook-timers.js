#!/usr/bin/env node
// Checks the cooking timers find the times in a method step ("10 mins",
// "1½ hours", "20-25 minutes") and name the timer from the step
// (js/cook-timers.js). Run: node scripts/test-cook-timers.js
const fs = require("fs");
const path = require("path");

global.window = global;
eval(fs.readFileSync(path.join(__dirname, "..", "js/cook-timers.js"), "utf8"));
const { findTimes, labelFor, stepHtml } = global.CookTimers;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const times = (s) => findTimes(s).map(t => [t.minutes, t.extra]);
const names = (s) => findTimes(s).map(t => labelFor(s, t.start));

check("10 mins", times("Boil the spuds for 10 mins."), [[10, 0]]);
check("minutes", times("Simmer for 20 minutes"), [[20, 0]]);
check("1 minute", times("Stir for 1 minute"), [[1, 0]]);
check("a range", times("Bake for 20-25 minutes until golden"), [[20, 5]]);
check("an en dash range", times("Bake for 20–25 mins"), [[20, 5]]);
check("20 to 25", times("Cook 20 to 25 minutes"), [[20, 5]]);
check("an hour", times("Leave to rest for an hour"), [[60, 0]]);
check("1½ hours", times("Roast for 1½ hours"), [[90, 0]]);
check("1 1/2 hours", times("Roast for 1 1/2 hours"), [[90, 0]]);
check("1.5 hrs", times("Slow cook for 1.5 hrs"), [[90, 0]]);
check("2-3 hours", times("Slow cook for 2-3 hours"), [[120, 60]]);
check("1 hour 20 minutes", times("Bake for 1 hour 20 minutes"), [[80, 0]]);
check("1 hr and 10 mins", times("Bake for 1 hr and 10 mins"), [[70, 0]]);
check("half an hour", times("Chill for half an hour"), [[30, 0]]);
check("words", times("Fry for five minutes, then ten minutes more"), [[5, 0], [10, 0]]);
check("two times in one step", times("Brown for 5 mins, then simmer for 2 hours."), [[5, 0], [120, 0]]);
check("not temperatures or weights", times("Heat the oven to 180C. Add 500g mince and 2 tbsp oil."), []);
check("not 'a minute or two'", times("Stir for a minute or two"), []);
check("not 'mins' in another word", times("Add the minced garlic"), []);
check("not too long", times("Marinate for 48 hours"), []);
check("30 seconds skipped", times("Whisk for 30 seconds"), []);

check("name: what you're doing", names("Boil the spuds for 10 mins."), ["Boil the spuds"]);
check("name: after 'then'", names("Brown the sausages, then simmer for 20 minutes."), ["Simmer"]);
check("name: its own sentence", names("Preheat the oven. Bake the crumble for 40 mins."), ["Bake the crumble"]);
check("name: 'Meanwhile' dropped", names("Meanwhile, cook the rice for 12 minutes"), ["Cook the rice"]);
check("name: long ones cut", names("Add the onions, carrots and celery and cook gently for 10 minutes"), ["Add the onions, carrots…"]);
check("name: step number dropped", names("2. Roast for 1 hour"), ["Roast"]);
check("name: nothing before the time", names("10 minutes before serving, warm the plates"), [""]);

const html = stepHtml("Boil the <b>spuds</b> for 10 mins.", { dish: "Pie", step: 2 });
check("button after the time, text escaped", html.replace(/<button[^>]*>.*?<\/button>/, "[START]"), "Boil the &lt;b&gt;spuds&lt;/b&gt; for 10 mins[START].");
check("button says what it starts", /aria-label="Start a timer for 10 minutes: Boil the &lt;b&gt;spuds&lt;\/b&gt;"/.test(html), true);
check("no time, no button", stepHtml("Serve hot."), "Serve hot.");
check("no name: the step number", /data-ct-label="Step 3"/.test(stepHtml("10 minutes before serving, warm the plates", { step: 3 })), true);

console.log(`${fail ? "❌" : "✅"} cook timers: ${pass} passed${fail ? `, ${fail} failed` : ""}`);
process.exit(fail ? 1 : 0);
