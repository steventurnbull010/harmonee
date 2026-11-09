#!/usr/bin/env node
// "Leave this board" (app.js) clears that board's copy from the device and
// nothing else: another board's saved data and this device's own preferences
// (theme, calendar view) stay. Pulls thisBoardsSavedKeys out of app.js.
// Run: node scripts/test-leave-board.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = src.indexOf("function thisBoardsSavedKeys(");
let i = src.indexOf("{", src.indexOf(")", start)), depth = 0;
for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
const thisBoardsSavedKeys = new Function(`${src.slice(start, i + 1)}; return thisBoardsSavedKeys;`)();

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

// A device with the Smith board and the Jones board on it
const device = [
  "harmonee_tasks_smith", "harmonee_settings_smith", "turnbull_meals_v4__smith", "turnbull_family_lists__smith", "harmonee_board_ops__smith", "last_active_week_smith",
  "harmonee_tasks_jones", "turnbull_meals_v4__jones", "last_active_week_jones",
  "harmonee_theme", "chore_calendar_view", "harmonee_today_idle_minutes"
];
const gone = new Set(thisBoardsSavedKeys("smith", false));
check("leaving Smith clears Smith's copy", device.filter(k => gone.has(k)), ["harmonee_tasks_smith", "harmonee_settings_smith", "turnbull_meals_v4__smith", "turnbull_family_lists__smith", "harmonee_board_ops__smith", "last_active_week_smith"]);
check("…and keeps Jones's copy and the device's own settings", device.filter(k => !gone.has(k)), ["harmonee_tasks_jones", "turnbull_meals_v4__jones", "last_active_week_jones", "harmonee_theme", "chore_calendar_view", "harmonee_today_idle_minutes"]);

// Turnbull uses the original names
const tb = new Set(thisBoardsSavedKeys("turnbull", true));
check("leaving Turnbull clears its original-name keys", ["harmonee_tasks", "turnbull_meals_v4", "turnbull_family_events_v3", "harmonee_reward_goals", "last_active_week_turnbull"].every(k => tb.has(k)), true);
check("…but not another board's", ["harmonee_tasks_smith", "turnbull_meals_v4__smith", "harmonee_theme"].some(k => tb.has(k)), false);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
