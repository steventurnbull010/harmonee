#!/usr/bin/env node
// ============================================================================
// SMOKE TEST (scripts/smoke-test.mjs)
// Opens every page of harmonee in Chrome at phone, tablet and laptop size and
// fails on any console error, crash, or field/button a screen reader can't
// name. Saves a screenshot of each to smoke-shots/ (not committed) to compare
// before and after a change.
//
// Nothing real is touched: Firebase is swapped for an in-memory fake
// (scripts/smoke/fake-firebase.js) holding a made-up family, and every other
// outside request (fonts, weather, libraries) gets a canned answer, so it
// runs the same offline. Uses the Chrome on this Mac through Playwright from
// npx: nothing is installed in the project.
//
// Run: node scripts/smoke-test.mjs            (all sizes)
//      node scripts/smoke-test.mjs tablet     (one size)
// ============================================================================
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYWRIGHT = "playwright-core@1.48.2";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "smoke-shots");
const BOARD = "sidepanel-test-x7q2"; // the test board's name; its data here is all fake
const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { viewport: { width: 1280, height: 800 }, hasTouch: true },
  // The kitchen tablet in Chrome: its address bar and tabs leave about 690px
  kitchen: { viewport: { width: 1280, height: 690 }, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 } }
};
const only = process.argv[2];

// ---- Playwright, from the npx cache -------------------------------------------
function loadPlaywright() {
  const bin = execFileSync("npx", ["--yes", "-p", PLAYWRIGHT, "-c", "command -v playwright-core"], { encoding: "utf8" }).trim();
  const pkg = path.dirname(fs.realpathSync(bin)); // node_modules/playwright-core/cli.js
  return createRequire(import.meta.url)(pkg);
}

// ---- A made-up family on the fake board ---------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Eight jobs each, so the columns are longer than the screen (as on a real board)
function busyJobs(t, b) {
  const out = {};
  const jobs = [["Brush teeth", "🪥", "evening"], ["Pack your bag", "🎒", "evening"], ["Reading time", "📖", "evening"], ["Tidy your room", "🧸", "anytime"],
    ["Practise piano", "🎹", "afternoon"], ["Homework", "📚", "afternoon"], ["Lay the table", "🍴", "evening"], ["Bath or shower", "🛁", "evening"]];
  ["Sam", "Alex", "Jo", "Max"].forEach((who, w) => jobs.forEach(([title, icon, slot], i) => {
    const id = `busy-${w}-${i}`;
    out[`${b}/tasks/${id}`] = t(id, title, who, { kind: "routine", routineSlot: slot, icon });
  }));
  return out;
}
function sampleStore() {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const b = `boards/${BOARD}`;
  const t = (id, title, who, extra = {}) => ({ id, title, assignedTo: who, taskType: "Daily Task", day: "Daily", repeat: "daily", value: 2, done: false, completedBy: null, completedAt: null, ...extra });
  return {
    ...busyJobs(t, b),
    [b]: {
      boardId: BOARD,
      members: ["Sam", "Alex", "Jo", "Max"],
      settings: {
        familyName: "Sample Family", gameMode: "points", currency: "£",
        sleepScheduleEnabled: false, // so the night clock doesn't cover the board when the test runs late
        memberColors: { Sam: "warm-ochre", Alex: "periwinkle", Jo: "coral-pink", Max: "spring-green" },
        weatherLocation: { lat: 51.5, lon: -0.1, name: "London" }
      },
      events: [
        { id: "e1", title: "Swimming", date: keyOf(today), time: "16:30", duration: "1 hour", repeat: "none", member: "Jo", icon: "🏊" },
        { id: "e2", title: "Dentist", date: keyOf(tomorrow), time: "09:00", duration: "30 mins", repeat: "none", member: "Max", icon: "🦷" },
        { id: "e3", title: "Football", day: "Saturday", time: "10:00", duration: "1 hour", repeat: "weekly", member: "Max", icon: "⚽" },
        { id: "e4", title: "School trip to the zoo", date: keyOf(new Date(today.getTime() + 3 * 86400000)), time: "09:00", duration: "1 day", repeat: "none", member: "Jo", icon: "🦁", countdown: true }
      ],
      // Rewards: two goals, last week banked, and a family goal
      rewardGoals: [
        { id: "goal-jo-1", member: "Jo", title: "Cinema trip", emoji: "🎬", cost: 30 },
        { id: "goal-jo-2", member: "Jo", title: "New Lego set", emoji: "🧸", cost: 120 },
        { id: "goal-sam-1", member: "Sam", title: "Takeaway pizza", emoji: "🍕", cost: 10 }
      ],
      rewardWeeks: { "2000-W01": { Jo: 12, Sam: 14, Max: 3 } },
      familyGoal: { title: "Pizza and film night", target: 40 },
      meals: { [keyOf(today)]: { dinner: { title: "Spaghetti bolognese", emoji: "🍝", cook: "Alex" } } },
      familyLists: [
        { id: "groceries", title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [{ id: "g1", text: "Milk", checked: false }, { id: "g2", text: "Bread", checked: false }, { id: "g3", text: "Apples", checked: true },
          // For yesterday's dinner (clears itself) and tomorrow's breakfast (a teaspoon: just "Cinnamon")
          { id: "g4", text: "500g Beef mince", checked: false, source: "Lasagne", grocery: { key: "beef mince", name: "Beef mince", label: "Beef mince", amounts: { mass: 500 }, sources: ["Lasagne"], sourceKeys: [`Lasagne|${keyOf(new Date(today.getTime() - 86400000))}|dinner`] } },
          { id: "g5", text: "1 tsp Cinnamon", checked: false, source: "Muffins", grocery: { key: "cinnamon", name: "Cinnamon", label: "Cinnamon", amounts: { spoon: 1 }, sources: ["Muffins"], sourceKeys: [`Muffins|${keyOf(tomorrow)}|breakfast`] } }] },
        { id: "packing", title: "Holiday packing", emoji: "🧳", color: "mint", items: [{ id: "p1", text: "Suncream", checked: false }] },
        { id: "list-jo-xmas", title: "Jo Christmas List", emoji: "🎄", color: "rose", items: [{ id: "w1", text: "Lego castle £45 https://www.example.com/lego-castle", checked: false }, { id: "w2", text: "Art set", checked: false }] },
        { id: "list-jobs", title: "Weekend jobs", emoji: "📋", color: "amber", items: [{ id: "j1", text: "Fix the gate", checked: false }] }
      ]
    },
    [`${b}/devices/smoke-test-device`]: { code: "SMOKE-TEST", label: "Smoke test" },
    [`${b}/tasks/t1`]: t("t1", "Make your bed", "Jo", { kind: "routine", routineSlot: "morning", icon: "🛏️" }),
    [`${b}/tasks/t2`]: t("t2", "Brush teeth", "Max", { kind: "routine", routineSlot: "evening", icon: "🪥" }),
    [`${b}/tasks/t3`]: t("t3", "Empty the dishwasher", "Anyone", { icon: "🍽️", value: 3 }),
    [`${b}/tasks/t4`]: t("t4", "Hoover the lounge", "Sam", { taskType: "Weekly Chore", day: "Saturday", repeat: "weekly", icon: "🧹", value: 5 }),
    // Quick grabs (daily, nobody's) and a bigger daily job that stays in Big jobs
    [`${b}/tasks/t5`]: t("t5", "Litter trays", null, { icon: "🐱", value: 1 }),
    [`${b}/tasks/t6`]: t("t6", "Fill the dishwasher", "Up for grabs", { icon: "🧽", value: 1 }),
    [`${b}/tasks/t7`]: t("t7", "Feed the cats", "Anyone", { icon: "🐾", value: 1 }),
    [`${b}/tasks/t8`]: t("t8", "Water the plants", null, { icon: "🪴", value: 1 }),
    [`${b}/tasks/t9`]: t("t9", "Clear the garden", null, { icon: "🌳", value: 5, grabSize: "big" }),
    [`${b}/tasks/t14`]: t("t14", "Change the bedsheets", null, { taskType: "Standard", day: "Anyday", repeat: "weekly", anyDay: true, icon: "🛏️", value: 3, routineSlot: "anytime" }),
    // Big jobs nobody's doing: one from an earlier day (no "Overdue" in the panel)
    [`${b}/tasks/t15`]: t("t15", "Fix the shed door", "Up for grabs", { taskType: "Standard", day: "Saturday", repeat: "none", date: keyOf(new Date(today.getTime() - 2 * 86400000)), icon: "🔨", value: 10 }),
    [`${b}/tasks/t16`]: t("t16", "Clean the car inside", "Up for grabs", { taskType: "Standard", day: "Friday", repeat: "none", date: keyOf(today), icon: "🚗", value: 5 }),
    [`${b}/tasks/t17`]: t("t17", "Sort the loft boxes", "Up for grabs", { taskType: "Standard", day: "Sunday", repeat: "none", date: keyOf(today), icon: "📦", value: 8, isPriority: true }),
    [`${b}/tasks/t11`]: t("t11", "Take the bins out", null, { icon: "🗑️", value: 2 }),
    [`${b}/tasks/t12`]: t("t12", "Wipe the kitchen sides", null, { icon: "🧼", value: 1 }),
    [`${b}/tasks/t13`]: t("t13", "Sort the recycling", null, { icon: "♻️", value: 1 }),
    [`${b}/tasks/t10`]: t("t10", "Wash the car", "Up for grabs", { taskType: "Standard", day: "Saturday", repeat: "weekly", icon: "🚗", value: 5 })
  };
}

// A week of mild weather, in Open-Meteo's shape
function sampleForecast() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const hours = Array.from({ length: 7 * 24 }, (_, i) => new Date(start.getTime() + i * 3600000));
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const iso = (d) => `${keyOf(d)}T${pad(d.getHours())}:00`;
  return {
    latitude: 51.5, longitude: -0.1, timezone: "Europe/London",
    current_weather: { temperature: 11, windspeed: 8, weathercode: 1, is_day: 1, time: iso(new Date()) },
    hourly: { time: hours.map(iso), temperature_2m: hours.map(h => 8 + (h.getHours() > 9 && h.getHours() < 17 ? 4 : 0)), precipitation_probability: hours.map(() => 10), weathercode: hours.map(() => 1), is_day: hours.map(h => (h.getHours() > 7 && h.getHours() < 17 ? 1 : 0)), wind_speed_10m: hours.map(() => 8) },
    daily: { time: days.map(keyOf), weathercode: days.map(() => 2), temperature_2m_max: days.map(() => 12), temperature_2m_min: days.map(() => 5), precipitation_probability_max: days.map(() => 20), uv_index_max: days.map(() => 1) }
  };
}

// ---- A small static server for the project --------------------------------------
// It sends the headers firebase.json gives every file (security headers and
// the report-only content policy), so anything the policy would block shows up
// here as a console error before it goes live
const HOSTING_HEADERS = Object.fromEntries(
  (JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8")).hosting.headers || [])
    .filter(h => h.source === "**").flatMap(h => h.headers).map(h => [h.key, h.value])
);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (url.pathname === "/" || fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { ...HOSTING_HEADERS, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

// ---- Canned answers for everything outside the project --------------------------
const FAKE_FIREBASE = fs.readFileSync(path.join(ROOT, "scripts/smoke/fake-firebase.js"), "utf8");
async function routeOutside(context, origin) {
  const forecast = JSON.stringify(sampleForecast());
  await context.route(url => !url.href.startsWith(origin), (route) => {
    const u = route.request().url();
    const reply = (body, contentType = "text/plain") => route.fulfill({ status: 200, contentType, body, headers: { "Access-Control-Allow-Origin": "*" } });
    if (/gstatic\.com\/firebasejs\//.test(u)) return reply(FAKE_FIREBASE, "text/javascript");
    if (/canvas-confetti/.test(u)) return reply("window.confetti = function () { return Promise.resolve(); };", "text/javascript");
    if (/qrcode/.test(u)) return reply("window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 21; }, isDark() { return false; }, createSvgTag() { return '<svg></svg>'; }, createImgTag() { return ''; } }; };", "text/javascript");
    if (/fonts\.googleapis\.com/.test(u)) return reply("", "text/css");
    if (/api\.open-meteo\.com/.test(u)) return reply(forecast, "application/json");
    if (/geocoding-api\.open-meteo\.com/.test(u)) return reply('{"results":[]}', "application/json");
    if (/\.(woff2?|ttf)(\?|$)/.test(u)) return route.fulfill({ status: 200, contentType: "font/woff2", body: Buffer.alloc(0) });
    // Recipe photos (and their /small, /medium copies): real ones with REAL_PHOTOS=1
    if (/themealdb\.com\/images\//.test(u)) return process.env.REAL_PHOTOS ? route.continue() : route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#d6b88a"/></svg>' });
    if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(u)) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
    return reply("{}", "application/json");
  });
}

// ---- Fields and buttons a screen reader can't name ------------------------------
function unnamedControls() {
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
  const labelled = (el) => (el.getAttribute("aria-label") || "").trim() || el.getAttribute("aria-labelledby") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label") || (el.getAttribute("title") || "").trim();
  const out = [];
  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach(el => {
    if (visible(el) && !labelled(el)) out.push(`field ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : "." + [...el.classList].join(".")}`);
  });
  document.querySelectorAll("button, [role=button]").forEach(b => {
    if (!visible(b) || labelled(b)) return;
    const text = (b.innerText || b.textContent || "").replace(/[\s​]/g, "");
    if (!/[\p{L}\p{N}]/u.test(text)) out.push(`button ${b.id ? "#" + b.id : "." + [...b.classList].join(".")} "${text.slice(0, 8)}"`);
  });
  return out;
}

// ---- The run --------------------------------------------------------------------
// Today at a glance opens by itself at times (on phones, first thing): close it first
const goTo = (view) => async (p) => p.evaluate((v) => {
  if (window.closeTodayScreen) window.closeTodayScreen({ quiet: true });
  window.switchSkylightView(v);
}, view);
const PAGES = [
  // The "3 sleeps" countdown is at the top of the Calendar, and only there
  ["calendar", async (p) => {
    // harmonee opens on the board, not Today at a glance (unless a family asks)
    const todayOpen = await p.evaluate(() => { const t = document.getElementById("today-screen"); return !!(t && !t.hidden && t.offsetParent !== null); });
    if (todayOpen) throw new Error("Today at a glance opened by itself");
    await goTo("calendar")(p);
    await p.evaluate(() => window.refreshCountdowns && window.refreshCountdowns());
    await p.waitForTimeout(200);
    const where = await p.evaluate(() => [...document.querySelectorAll(".header-countdown-chip")].map(c => c.closest(".skylight-page-view")?.id));
    if (!where.includes("view-calendar")) throw new Error("no countdown at the top of the Calendar");
    const elsewhere = where.filter(v => v !== "view-calendar");
    if (elsewhere.length) throw new Error(`the countdown is also on ${elsewhere.join(", ")}`);
  }],
  // Bank holidays: Christmas Day shows in every calendar view
  ["bank-holidays", async (p) => {
    await goTo("calendar")(p);
    for (const view of ["schedule", "week", "day", "month"]) {
      const found = await p.evaluate(async (v) => {
        window.setCalendarView(v, new Date(2026, 11, 25));
        if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
        await new Promise(r => setTimeout(r, 300));
        return [...document.querySelectorAll("#view-calendar .bank-holiday-chip")].filter(c => c.offsetParent !== null).map(c => c.textContent.trim());
      }, view);
      if (!found.some(t => /Christmas Day/.test(t))) throw new Error(`no "Christmas Day" chip in the ${view} view`);
      if (view === "schedule") await p.screenshot({ path: path.join(SHOTS, `${p.__size}-bank-holiday-chip.png`) });
    }
    await p.evaluate(() => { window.setCalendarView("schedule"); window.renderWeekCalendar && window.renderWeekCalendar(); });
  }],
  // Event chime: an event 10 minutes away gets one banner (and a chime)
  ["event-chime", async (p) => {
    const r = await p.evaluate(async () => {
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() > 23 * 60 + 40) return { skipped: true }; // too near midnight to test
      const at = new Date(now.getTime() + 10 * 60000);
      const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
      localStorage.setItem("harmonee_event_chime_minutes", "15");
      localStorage.removeItem("harmonee_event_chime_done");
      window.familyEvents.push({ id: "smoke-chime", title: "Piano lesson", date: window.getLocalDateKey(now), time: hhmm, duration: "30 mins", repeat: "none", member: "Max", icon: "🎹" });
      const first = window.EventChime.check(now).map(x => x.evt.id);
      await new Promise(res => setTimeout(res, 400));
      const banner = document.getElementById("event-chime-banner");
      const text = banner && !banner.hidden ? banner.textContent.replace(/\s+/g, " ") : "";
      const second = window.EventChime.check(now).length;
      return { first, text, second };
    });
    if (r.skipped) return;
    if (!r.first.includes("smoke-chime")) throw new Error("the chime didn't pick up an event 10 minutes away");
    if (!/Piano lesson in (9|10) minutes/.test(r.text) || !/Max/.test(r.text)) throw new Error(`the banner says "${r.text}"`);
    if (r.second) throw new Error("it chimed the same event twice");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-event-chime-banner.png`) });
    await p.evaluate(() => { window.EventChime.hide(); window.familyEvents = window.familyEvents.filter(e => e.id !== "smoke-chime"); });
  }],
  ["tasks", goTo("chores")],
  ["meals", goTo("meals")],
  ["lists", goTo("lists")],
  ["rewards", goTo("rewards")],
  // The jobs are the main thing: how far down the first one starts, and (after
  // scrolling) that the names stay pinned at the top of each column
  ["layout", async (p) => {
    await goTo("chores")(p);
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const card = document.querySelector("#tasks-columns-grid .skylight-tasks-col .skylight-task-card");
      const r = card.getBoundingClientRect();
      return { firstJob: Math.round(r.top), screen: window.innerHeight, share: Math.round((r.top / window.innerHeight) * 100), wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    console.log(`   ${p.__size}: first job starts ${m.firstJob}px down a ${m.screen}px screen (${m.share}%)`);
    if (m.wide) throw new Error("the page is wider than the screen (something runs off the edge)");
    const phone = await p.evaluate(() => window.matchMedia("(max-width: 600px)").matches);
    if (m.share > (phone ? 45 : 40)) throw new Error(`the first job starts ${m.share}% of the way down the screen`);
    // Nothing in the top bar or toolbar runs off the right-hand edge
    const offEdge = await p.evaluate(() => [...document.querySelectorAll("#view-chores .skylight-tasks-header *, #tasks-toolbar .tasks-slot-pill, #tasks-person-tabs *")]
      .filter(el => el.offsetParent && el.getBoundingClientRect().right > window.innerWidth + 1).map(el => el.className || el.tagName).slice(0, 3));
    if (offEdge.length) throw new Error(`these run off the right-hand edge: ${offEdge.join(", ")}`);
    // Scroll down: the page moves, and each name stays pinned at the top
    const pinned = await p.evaluate(async (ph) => {
      const page = document.querySelector("#view-chores .skylight-tasks-page-container");
      const el = ph ? document.getElementById("tasks-person-tabs") : document.querySelector("#tasks-columns-grid .tasks-col-header");
      const natural = el.getBoundingClientRect().top - page.getBoundingClientRect().top;
      const room = page.scrollHeight - page.clientHeight;
      page.scrollTop = room;
      await new Promise(r => setTimeout(r, 150));
      return { room, natural: Math.round(natural), scrolled: page.scrollTop, offset: Math.round(el.getBoundingClientRect().top - page.getBoundingClientRect().top) };
    }, phone);
    // Only when there's enough to scroll past the names (a tall laptop may fit it all)
    if (pinned.room > pinned.natural + 40) {
      if (Math.abs(pinned.offset) > 2) throw new Error(`the ${phone ? "name tabs" : "names"} didn't stay at the top when scrolling (${pinned.offset}px)`);
    }
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-tasks-scrolled.png`) });
    await p.evaluate(() => { document.querySelector("#view-chores .skylight-tasks-page-container").scrollTop = 0; });
  }],
  // Quick grabs: take one (drag it to Alex; on a phone, tap it and pick Jo),
  // check it's in their column marked Grabbed and gone from the tray, then give it back
  ["quick-grab", async (p) => {
    await goTo("chores")(p);
    await p.waitForTimeout(300);
    const phone = await p.evaluate(() => window.matchMedia("(max-width: 600px)").matches);
    if (phone) await p.click("[data-quick-grabs-more]");
    // One row that scrolls sideways; a mouse gets an arrow that scrolls it
    const tops = await p.$$eval(".quick-grab-pill", els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))]);
    if (tops.length > 1) throw new Error(`the quick grabs wrap onto ${tops.length} rows`);
    // Tablet and laptop: the "8 quick grabs" label sits on the same line as the pills,
    // with room between the tray and the Morning / Evening buttons above it
    const layout = await p.evaluate(() => {
      const t = document.querySelector(".quick-grabs-title"), pill = document.querySelector(".quick-grab-pill");
      const tray = document.getElementById("tasks-quick-grabs"), bar = document.getElementById("tasks-slot-filters");
      const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      return { sameLine: !t || Math.abs(mid(t) - mid(pill)) < 8, gap: tray.getBoundingClientRect().top - bar.getBoundingClientRect().bottom };
    });
    if (!phone && !layout.sameLine) throw new Error("the quick grabs label isn't on the same line as the pills");
    const overflow = await p.$eval(".quick-grabs-pills", el => el.scrollWidth > el.clientWidth + 2);
    const mouse = await p.evaluate(() => !window.matchMedia("(hover: none)").matches);
    if (!phone && overflow && mouse) {
      const next = p.locator(".quick-grabs-arrow.is-next");
      if (!(await next.isVisible())) throw new Error("no arrow to see more quick grabs");
      await next.click();
      await p.waitForTimeout(500);
      if ((await p.$eval(".quick-grabs-pills", el => el.scrollLeft)) < 20) throw new Error("the arrow didn't scroll the quick grabs");
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-quick-grabs-scrolled.png`) });
      await p.$eval(".quick-grabs-pills", el => { el.scrollLeft = 0; });
      await p.waitForTimeout(300);
    }
    const pill = p.locator(".quick-grab-pill").first();
    const title = (await pill.locator(".quick-grab-title").textContent()).trim();
    const before = await p.locator(".quick-grab-pill").count();
    const who = phone ? "Jo" : "Alex";
    if (phone) {
      await pill.click();
      await p.click(`[data-quick-pick="${who}"]`);
    } else {
      const from = await pill.boundingBox();
      const to = await p.locator(`.skylight-tasks-col[data-col-member="${who}"]`).boundingBox();
      await p.mouse.move(from.x + 20, from.y + from.height / 2);
      await p.mouse.down();
      await p.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
      // A tall column runs past the screen: drop on the part that's showing
      const dropY = Math.min(to.y + to.height / 2, to.y + 120);
      await p.mouse.move(to.x + to.width / 2, dropY, { steps: 12 });
      await p.mouse.up();
    }
    await p.waitForTimeout(400);
    const col = p.locator(`.skylight-tasks-col[data-col-member="${who}"]`);
    if (phone && !(await p.evaluate((w) => { const g = document.getElementById("tasks-columns-grid"); const c = g.querySelector(`[data-col-member="${w}"]`); const r = c.getBoundingClientRect(), gr = g.getBoundingClientRect(); return Math.abs(r.left - gr.left) < 30; }, who))) throw new Error(`the phone didn't switch to ${who}'s column`);
    const card = col.locator(".skylight-task-card", { hasText: title });
    if (!(await card.count())) {
      const dbg = await p.evaluate((t) => { const task = window.currentTasks.find(x => x.title === t); const sl = document.getElementById("ambient-sleep-overlay"); const pl = document.querySelector(".quick-grab-pill"); const pr = pl && pl.getBoundingClientRect(); const at = (x, y) => { const u = document.elementFromPoint(x, y); return u ? (u.id || u.className || u.tagName) : null; }; const col = document.querySelector('.skylight-tasks-col[data-col-member="Alex"]').getBoundingClientRect(); return JSON.stringify({ pillAt: pr && at(pr.left + 20, pr.top + pr.height / 2), dropAt: at(col.left + col.width / 2, Math.min(col.top + col.height / 2, col.top + 120)), sleep: !!(sl && sl.offsetParent !== null && getComputedStyle(sl).display !== "none"), sleepSetting: (window.boardSettings || {}).sleepScheduleEnabled, ov: task && task.assignedOverrides, slots: [...document.querySelectorAll("#tasks-slot-filters .is-on")].map(b => b.textContent.trim()), alex: [...document.querySelectorAll('.skylight-tasks-col[data-col-member="Alex"] .skylight-task-card-title')].map(e => e.textContent) }); }, title);
      throw new Error(`${title} didn't land in ${who}'s column ${dbg}`);
    }
    if (!(await card.locator(".skylight-task-grabbed").count())) throw new Error(`${title} isn't marked Grabbed`);
    const after = await p.locator(".quick-grab-pill").count();
    if (!phone && after !== before - 1) throw new Error(`the tray still has ${after} pills (had ${before})`);
    const savedTo = await p.evaluate((t) => { const task = window.currentTasks.find(x => x.title === t); return JSON.stringify(task.assignedOverrides || {}); }, title);
    if (!savedTo.includes(who)) throw new Error(`the grab wasn't saved for today only (${savedTo})`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-quick-grab-taken.png`) });
    // Give it back from its pop-up
    await card.click();
    await p.click("[data-quick-give-back]");
    await p.waitForTimeout(400);
    if (await col.locator(".skylight-task-card", { hasText: title }).count()) throw new Error(`${title} is still in ${who}'s column after giving it back`);
  }],
  // Every week, any day: in the tray, a grab lasts the week, and once ticked
  // it's gone for the rest of the week
  ["weekly-any-day", async (p) => {
    await goTo("chores")(p);
    await p.evaluate(() => { document.querySelectorAll("[data-quick-grabs-more][aria-expanded=false]").forEach(b => b.click()); });
    await p.waitForTimeout(300);
    const pill = p.locator(".quick-grab-pill", { hasText: "Change the bedsheets" });
    if (!(await pill.count())) throw new Error("Change the bedsheets isn't in Quick grabs");
    await pill.evaluate(el => el.click());
    await p.click('[data-quick-pick="Sam"]');
    await p.waitForTimeout(400);
    const saved = await p.evaluate(() => JSON.stringify(window.currentTasks.find(t => t.id === "t14").assignedOverrides || {}));
    if (!/\|any":"Sam"/.test(saved)) throw new Error(`the grab wasn't saved for the week (${saved})`);
    const later = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return window.getTasksForColumn("Sam", d).some(t => t.id === "t14"); });
    if (!later && new Date().getDay() !== 0) throw new Error("grabbed for the week, but not on Sam's list tomorrow");
    const card = p.locator('.skylight-tasks-col[data-col-member="Sam"] .skylight-task-card', { hasText: "Change the bedsheets" });
    if (!(await card.count())) throw new Error("Change the bedsheets isn't in Sam's column");
    if (!(await card.textContent()).includes("This week")) throw new Error("the card doesn't say This week");
    await card.locator(".skylight-task-check-circle").evaluate(el => el.click());
    await p.waitForTimeout(800);
    await p.evaluate(() => window.TickCheer && window.TickCheer.close(true));
    const after = await p.evaluate(() => {
      const t = window.currentTasks.find(x => x.id === "t14");
      const d = new Date(); d.setDate(d.getDate() + 1);
      return { done: window.isTaskDoneOnDate(t, new Date()), tomorrow: window.getTasksForColumn("Sam", d).some(x => x.id === "t14") || window.getTasksForColumn("Up for grabs", d).some(x => x.id === "t14") };
    });
    if (!after.done) throw new Error("ticking it didn't mark it done");
    if (after.tomorrow) throw new Error("done this week, but still showing tomorrow");
  }],
  // Big jobs: slim rows, no "Overdue", 👤 folds down the names, give one away
  ["big-jobs", async (p) => {
    await goTo("chores")(p);
    const label = await p.$eval(".tasks-grab-btn-label", el => el.textContent.trim());
    if (label !== "Big jobs") throw new Error(`the button says "${label}"`);
    await p.click("[data-open-grabs]");
    await p.waitForTimeout(400);
    const rows = await p.$$eval("#grabs-list .grabs-job", els => els.map(e => Math.round(e.getBoundingClientRect().height)));
    if (rows.length < 3) throw new Error(`only ${rows.length} big jobs listed`);
    if (Math.max(...rows) > 80) throw new Error(`big job rows are up to ${Math.max(...rows)}px tall`);
    const text = await p.$eval("#grabs-list", el => el.textContent);
    if (/Overdue|Was for/.test(text)) throw new Error("the panel still says Overdue / Was for");
    if (await p.locator("#grabs-list .grabs-people").count()) throw new Error("names showing before 👤 is tapped");
    await p.click('[data-grabs-who="t15"]');
    await p.waitForTimeout(700); // the panel slides in
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-big-jobs-panel.png`) });
    await p.click('#grabs-list [data-give="t15"][data-person="Max"]');
    await p.waitForTimeout(300);
    const toast = await p.$eval("#task-move-toast", el => el.textContent);
    if (!/Max grabbed Fix the shed door/.test(toast)) throw new Error(`no grabbed message (${toast})`);
    await p.evaluate(() => document.getElementById("grabs-modal").close());
  }],
  // Magic Import, with a pretend AI (window.__SMOKE_AI): one event fills in Add
  // Event; several give a tick list; none says so; odd answers are cleaned up
  ["magic-import", async (p) => {
    await goTo("calendar")(p);
    const ahead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const read = async (answer) => p.evaluate(async (a) => {
      window.__SMOKE_AI = async () => a;
      const c = document.createElement("canvas"); c.width = 40; c.height = 30;
      c.getContext("2d").fillRect(0, 0, 40, 30);
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      await window.MagicImport.readPhoto(new File([blob], "flyer.png", { type: "image/png" }));
      await new Promise(r => setTimeout(r, 300));
    }, answer);
    // Switched on (10 Nov): the button shows in Add Event, as "📷 From a photo"
    const onShown = await p.evaluate(async () => { delete window.__SMOKE_AI; window.openEventModal(); await new Promise(r => setTimeout(r, 100)); const b = document.getElementById("btn-event-from-photo"); return !b.hidden && /From a photo/.test(b.textContent); });
    if (!onShown) throw new Error("no 📷 From a photo button in Add Event");
    await p.evaluate(() => document.getElementById("btn-close-event-modal").click());
    // 📷 Snap a flyer in the Calendar's ＋ menu: straight to the photo picker
    await p.evaluate(() => window.switchSkylightView("calendar"));
    await p.waitForTimeout(300);
    await p.click("#btn-floating-add-calendar");
    await p.waitForTimeout(300);
    if (!(await p.locator("#fab-action-snap-flyer").isVisible())) throw new Error("no Snap a flyer in the ＋ menu");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-magic-snap-menu.png`) });
    await p.evaluate(() => { window.__SMOKE_AI = async () => ({ events: [{ title: "Book fair", date: (() => { const d = new Date(); d.setDate(d.getDate() + 9); return window.getLocalDateKey(d); })(), startTime: "15:30", allDay: false, people: [] }] }); });
    const pngFlyer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const [flyerChooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#fab-action-snap-flyer")]);
    await flyerChooser.setFiles({ name: "flyer.png", mimeType: "image/png", buffer: pngFlyer });
    await p.waitForTimeout(800);
    const snapped = await p.evaluate(() => ({ open: document.getElementById("event-modal").open, title: document.getElementById("event-title-input").value, note: document.getElementById("event-magic-note").textContent }));
    if (!snapped.open || snapped.title !== "Book fair" || !/Filled in\. Check it, then tap Add\./.test(snapped.note)) throw new Error(`Snap a flyer didn't fill in Add Event: ${JSON.stringify(snapped)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-magic-snapped.png`) });
    await p.evaluate(() => document.getElementById("btn-close-event-modal").click());
    await p.waitForTimeout(300);
    await p.evaluate(() => { window.__SMOKE_AI = async () => ({ events: [] }); window.openEventModal(); });
    await p.waitForTimeout(400);
    if (!(await p.locator("#btn-event-from-photo").isVisible())) throw new Error("no 📷 Fill in from a photo button in Add Event");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-magic-button.png`) });

    // One event (with a name not on the board and HTML in the title)
    await read({ events: [{ title: "Jo's swimming gala <img src=x onerror=alert(1)>", date: ahead(12), startTime: "14:00", endTime: "16:30", allDay: false,
      location: "Leisure centre", notes: "Bring a towel", people: ["Jo", "Bob"], emoji: "🏊" }] });
    const one = await p.evaluate(() => ({
      open: document.getElementById("event-modal").open,
      title: document.getElementById("event-title-input").value,
      place: document.getElementById("event-location-input").value,
      notes: document.getElementById("event-description-input").value,
      who: document.getElementById("event-member-input").value,
      note: !document.getElementById("event-magic-note").hidden,
      img: !!document.querySelector("#event-modal img[src='x']")
    }));
    if (!one.open || !one.note) throw new Error("one event didn't fill in Add Event");
    if (one.title.includes("<") || one.img) throw new Error(`the title wasn't cleaned: ${one.title}`);
    if (one.place !== "Leisure centre" || one.notes !== "Bring a towel") throw new Error(`place/notes not filled: ${JSON.stringify(one)}`);
    if (one.who !== "Jo") throw new Error(`who should be just Jo (not Bob): ${one.who}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-magic-one.png`) });

    // Several (one with an impossible date, which is dropped): untick one, add the rest
    await read({ events: [
      { title: "Christmas fair", date: ahead(20), allDay: true, location: "School hall", people: [] },
      { title: "Nativity play", date: ahead(25), startTime: "18:00", allDay: false, people: ["Max"] },
      { title: "Sports day", date: ahead(30), startTime: "09:30", allDay: false },
      { title: "Bad date", date: "2026-13-45", allDay: true }
    ] });
    const rows = await p.locator("#magic-import [data-mi-pick]").count();
    if (rows !== 3) throw new Error(`expected 3 events in the tick list, got ${rows}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-magic-many.png`) });
    await p.locator("#magic-import [data-mi-pick]").nth(2).uncheck();
    const label = await p.$eval("#magic-import [data-mi-add]", b => b.textContent);
    if (!/Add 2/.test(label)) throw new Error(`button says "${label}"`);
    await p.click("#magic-import [data-mi-add]");
    await p.waitForTimeout(400);
    const saved = await p.evaluate(() => (window.familyEvents || []).filter(e => ["Christmas fair", "Nativity play", "Sports day"].includes(e.title)).map(e => ({ t: e.title, d: e.duration, m: e.member, time: e.time })));
    if (saved.length !== 2 || saved.some(e => e.t === "Sports day")) throw new Error(`wrong events saved: ${JSON.stringify(saved)}`);
    if (!saved.find(e => e.t === "Christmas fair" && e.d === "All Day")) throw new Error("the all-day event wasn't all day");
    if (!saved.find(e => e.t === "Nativity play" && e.m === "Max" && e.time === "18:00")) throw new Error("the nativity play lost its time or person");
    // "Added 2 events" with Show me, which takes the calendar to the first one
    const toast = await p.evaluate(() => { const t = document.getElementById("hm-action-toast"); return t && t.classList.contains("is-visible") ? t.textContent.replace(/\s+/g, " ").trim() : ""; });
    if (!/Added 2 events/.test(toast) || !/Show me/.test(toast)) throw new Error(`no "Added 2 events" with Show me: "${toast}"`);
    await p.click("#hm-action-toast .hm-action-toast-btn");
    await p.waitForTimeout(400);
    const shown = await p.evaluate((d) => ({ view: window.currentActiveView, anchor: window.getLocalDateKey(window.calendarAnchorDate || new Date()) }), ahead(20));
    if (shown.view !== "calendar") throw new Error(`Show me didn't open the calendar: ${JSON.stringify(shown)}`);

    // Nothing found
    await read({ events: [] });
    const none = await p.$eval("#magic-import", d => d.open && /No dates found/.test(d.textContent));
    if (!none) throw new Error("no 'No dates found' message");
    await p.evaluate(() => document.getElementById("magic-import").close());
  }],
  // Shopping list: yesterday's meal's mince has gone by itself, and a
  // teaspoon of cinnamon reads just "Cinnamon"
  ["shopping-list", async (p) => {
    await goTo("lists")(p);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const groc = (window.loadFamilyLists() || []).find(l => l.id === "groceries");
      const items = (groc && groc.items) || [];
      return { mince: items.some(i => i.id === "g4"), cinnamon: (items.find(i => i.id === "g5") || {}), shown: window.Grocery.displayText(items.find(i => i.id === "g5") || {}) };
    });
    if (r.mince) throw new Error("yesterday's meal's mince is still on the shopping list");
    // Saving the list must leave the rest of the board alone (it once replaced it all in the fake)
    const events = await p.evaluate(() => ((window.__SMOKE_STORE["boards/sidepanel-test-x7q2"] || {}).events || []).length);
    if (events < 4) throw new Error(`saving the shopping list lost the board's events (${events} left)`);
    if (r.shown !== "Cinnamon") throw new Error(`a teaspoon of cinnamon shows as "${r.shown}"`);
  }],
  // The family's own recipe (house recipe): photo, times, 12 servings, credit
  ["house-recipe", async (p) => {
    await goTo("meals")(p);
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const m = await import("./recipes-data.js");
      const recipe = m.getAllFamilyRecipes().find(x => x.id === "house-banana-protein-muffins");
      if (!recipe) return { missing: true };
      window.openCookingRecipeModal(recipe);
      await new Promise(res => setTimeout(res, 600));
      const modal = document.getElementById("cooking-recipe-modal");
      // The photo is the hero's background: check it's ours and really loads
      const hero = [...modal.querySelectorAll("*")].find(el => /banana-protein-muffins/.test(el.style.backgroundImage || ""));
      const url = hero ? hero.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, "") : "";
      const loaded = url ? await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = url; }) : false;
      return {
        open: !!(modal && (modal.open || getComputedStyle(modal).display !== "none")),
        text: modal.textContent.replace(/\s+/g, " "),
        imgOk: loaded,
        credit: (document.getElementById("cooking-credit") || {}).textContent || ""
      };
    });
    if (r.missing) throw new Error("the muffin recipe isn't in the recipe list");
    if (!r.open) throw new Error("the recipe card didn't open");
    if (!r.imgOk) throw new Error("the muffin photo didn't load");
    for (const want of ["Greek yogurt", "12 Servings", "Family favourite", "Preheat your oven"]) if (!r.text.includes(want)) throw new Error(`the card doesn't show "${want}"`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-house-recipe-card.png`) });
    await p.keyboard.press("Escape");
  }],
  // Family recipes: type one in and save it (it reaches the board and the
  // list, with Edit on its card); then fill one from a photo (pretend AI)
  ["family-recipe", async (p) => {
    await goTo("meals")(p);
    await p.evaluate(() => { window.__SMOKE_AI = async (photo, kind) => kind === "recipe"
      ? { isRecipe: true, title: "Grandad's beef stew <b>", servings: 4, prepMinutes: 20, cookMinutes: 120, mealType: "dinner",
          ingredients: ["500g stewing beef", "2 carrots", "1 onion", "a pinch of salt"], method: ["Brown the beef.", "Add everything else and simmer for 2 hours."], emoji: "🍲" }
      : { events: [] }; });
    await p.evaluate(() => window.openPlanMealDrawer(window.getLocalDateKey(new Date()), "dinner"));
    await p.waitForTimeout(500);
    await p.locator("#plan-meal-drawer [data-add-family-recipe]").click();
    await p.waitForTimeout(400);
    if (!(await p.locator("#family-recipe-modal [data-fr-photo]").isVisible())) throw new Error("no 📷 Fill in from a photo button in the recipe form");
    // Typed in
    await p.fill('#family-recipe-modal [data-fr="title"]', "Nana's flapjacks");
    await p.click('#family-recipe-modal [data-fr-meal="snack"]');
    await p.fill('#family-recipe-modal [data-fr="servings"]', "12");
    // Ingredients and method are lists now: type, Enter for the next one
    await p.click('#family-recipe-modal [data-fr-line="ingredients"]');
    await p.keyboard.type("250g oats"); await p.keyboard.press("Enter");
    await p.keyboard.type("125g butter"); await p.keyboard.press("Enter");
    await p.keyboard.type("4 tbsp golden syrup");
    await p.click('#family-recipe-modal [data-fr-line="method"]');
    await p.keyboard.type("1. Melt the butter and syrup."); await p.keyboard.press("Enter");
    await p.keyboard.type("2. Stir in the oats and bake for 20 minutes.");
    const rows = await p.evaluate(() => ({
      ing: document.querySelectorAll('#family-recipe-modal [data-fr-line="ingredients"]').length,
      steps: document.querySelectorAll('#family-recipe-modal [data-fr-line="method"]').length,
      hidden: document.querySelector('#family-recipe-modal [data-fr="ingredients"]').value,
      scrolling: [...document.querySelectorAll("#family-recipe-modal .fr-line-text")].filter(t => t.scrollHeight > t.clientHeight + 2).length
    }));
    if (rows.ing !== 3 || rows.steps !== 2 || rows.hidden !== "250g oats\n125g butter\n4 tbsp golden syrup") throw new Error(`typing ingredients and steps as rows went wrong: ${JSON.stringify(rows)}`);
    if (rows.scrolling) throw new Error(`${rows.scrolling} recipe rows scroll inside themselves`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-family-recipe-form.png`) });
    await p.click('#family-recipe-modal button[type="submit"]');
    await p.waitForTimeout(800);
    const saved = await p.evaluate(() => {
      const r = window.FamilyRecipes.list().find(x => x.title === "Nana's flapjacks");
      const board = (window.__SMOKE_STORE["boards/sidepanel-test-x7q2"] || {}).customRecipes || [];
      return { r, onBoard: board.some(x => x.title === "Nana's flapjacks"), events: ((window.__SMOKE_STORE["boards/sidepanel-test-x7q2"] || {}).events || []).length };
    });
    if (!saved.r) throw new Error("the typed recipe wasn't saved");
    if (saved.r.mealType !== "snack" || saved.r.servings !== 12 || saved.r.instructions[0] !== "Melt the butter and syrup.") throw new Error(`saved wrongly: ${JSON.stringify(saved.r)}`);
    if (!saved.onBoard) throw new Error("the recipe didn't reach the board");
    if (saved.events < 4) throw new Error("saving a recipe lost the board's events");
    // Its card says Family recipe, with Edit
    const card = await p.evaluate(async () => {
      const m = await import("./recipes-data.js");
      const r = m.getAllFamilyRecipes().find(x => x.title === "Nana's flapjacks");
      if (!r) return "not in the recipe list";
      window.openCookingRecipeModal(r);
      await new Promise(res => setTimeout(res, 500));
      return (document.getElementById("cooking-credit") || {}).textContent || "";
    });
    if (!/Family recipe/.test(card) || !/Edit/.test(card)) throw new Error(`the card's credit says "${card}"`);
    await p.click("[data-edit-family-recipe]");
    await p.waitForTimeout(400);
    const editing = await p.$eval('#family-recipe-modal [data-fr="title"]', el => el.value);
    if (editing !== "Nana's flapjacks") throw new Error("Edit didn't open the recipe");
    await p.evaluate(() => document.getElementById("family-recipe-modal").close());
    await p.waitForTimeout(700); // let it slide out before opening it again
    // From a photo: the real file picker, a pretend AI answer
    await p.evaluate(() => window.FamilyRecipes.openEditor());
    await p.waitForTimeout(500);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#family-recipe-modal [data-fr-photo]")]);
    await chooser.setFiles({ name: "recipe-page.png", mimeType: "image/png", buffer: png });
    await p.waitForTimeout(1200);
    const fromPhoto = await p.evaluate(() => ({
      title: document.querySelector('#family-recipe-modal [data-fr="title"]').value,
      ingredients: document.querySelector('#family-recipe-modal [data-fr="ingredients"]').value,
      cook: document.querySelector('#family-recipe-modal [data-fr="cook"]').value,
      note: !document.querySelector("#family-recipe-modal [data-fr-note]").hidden,
      fromPhotoGone: document.querySelector("#family-recipe-modal [data-fr-photo]").hidden
    }));
    if (!fromPhoto.fromPhotoGone) throw new Error("\"From a photo\" still shows after a photo has filled the recipe in");
    if (!fromPhoto.note) throw new Error("the form doesn't say it was filled from the photo");
    if (fromPhoto.title !== "Grandad's beef stew") throw new Error(`the title wasn't cleaned: ${fromPhoto.title}`);
    if (!/stewing beef/.test(fromPhoto.ingredients) || fromPhoto.cook !== "120") throw new Error(`photo didn't fill the form: ${JSON.stringify(fromPhoto)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-family-recipe-photo.png`) });
    await p.evaluate(() => document.getElementById("family-recipe-modal").close());
    // Tidy up: delete the typed one
    await p.evaluate(() => { const r = window.FamilyRecipes.list().find(x => x.title === "Nana's flapjacks"); if (r) window.FamilyRecipes.remove(r.id); });
    await p.waitForTimeout(500);
    const left = await p.evaluate(() => ((window.__SMOKE_STORE["boards/sidepanel-test-x7q2"] || {}).customRecipes || []).filter(x => x.title === "Nana's flapjacks").length);
    if (left) throw new Error("deleting the recipe didn't reach the board");
    await p.evaluate(() => { const d = document.getElementById("plan-meal-drawer") || document.querySelector("dialog[open]"); if (d && d.open) d.close(); });
  }],
  // A long recipe from a photo (like a harira: 13 ingredients, long steps):
  // the form shows every row in full, and on the card nothing is squeezed and
  // "Add to meal plan" can be reached by scrolling, at every size
  ["long-recipe", async (p) => {
    await goTo("meals")(p);
    const recipe = {
      id: "family-smoke-harira", title: "Chunky Moroccan Harira Soup", emoji: "🍲", mealType: "dinner", category: "dinner", source: "family", servings: 7, cookTime: "45",
      ingredients: ["2 tablespoons olive oil", "1 large onion, finely chopped", "2 sticks of celery, chopped", "2 carrots, chopped into small cubes", "3 garlic cloves, crushed", "400g tin chopped tomatoes", "200g Puy lentils, or other green or brown lentils", "100g long-grain rice", "1/2 teaspoon ground turmeric", "1/4 teaspoon chilli powder", "1 tablespoon ground cumin", "2 teaspoons ground coriander", "a good bunch of fresh curly or flat-leaf parsley"],
      instructions: ["Heat the oil in a large pan and fry the onion, celery and carrot gently for 10 minutes until soft but not coloured.", "Add the garlic and cook for a minute more, then tip in the tomatoes, lentils and rice.", "Stir in all the spices, including the black pepper. Pour in the stock, turn the heat to high, bring to the boil, stirring a few times, then reduce the heat to a simmer for 25–30 minutes.", "Taste to make sure the lentils and rice are properly cooked. If they are not, let the soup simmer for a bit longer, until they are done.", "Stir through the chopped parsley and serve with crusty bread."]
    };
    // The form, as it looks after a photo has filled it
    await p.evaluate((r) => { window.FamilyRecipes.openEditor(); window.FamilyRecipes._fill(r, true); }, recipe);
    await p.waitForTimeout(700);
    const form = await p.evaluate(() => ({
      ing: document.querySelectorAll('#family-recipe-modal [data-fr-line="ingredients"]').length,
      steps: document.querySelectorAll('#family-recipe-modal [data-fr-line="method"]').length,
      scrolling: [...document.querySelectorAll("#family-recipe-modal .fr-line-text")].filter(t => t.scrollHeight > t.clientHeight + 2).map(t => t.value.slice(0, 30))
    }));
    await p.evaluate(() => { const m = document.querySelector("#family-recipe-modal [data-fr-lines='method']"); if (m) m.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-long-recipe-form.png`) });
    await p.evaluate(() => document.getElementById("family-recipe-modal").close());
    await p.waitForTimeout(500);
    if (form.ing !== 13 || form.steps !== 5) throw new Error(`the form didn't make a row for each ingredient and step: ${JSON.stringify(form)}`);
    if (form.scrolling.length) throw new Error(`rows still scroll inside themselves: ${form.scrolling.join(" | ")}`);
    // The card
    const card = await p.evaluate(async (r) => {
      window.openCookingRecipeModal({ ...r, subtitle: "Family recipe" });
      await new Promise(res => setTimeout(res, 600));
      const content = document.querySelector("#cooking-recipe-modal .cooking-modal-content");
      const list = document.getElementById("cooking-checklist");
      const items = list ? list.children.length : 0;
      const listBox = list ? list.getBoundingClientRect().height : 0;
      const body = document.querySelector("#cooking-recipe-modal .cooking-modal-body");
      const bodyScrolls = body ? body.scrollHeight > body.clientHeight + 2 && getComputedStyle(body).overflowY !== "visible" : false;
      // Scroll the card to the end: can "Add to meal plan" be seen?
      content.scrollTop = content.scrollHeight;
      await new Promise(res => setTimeout(res, 200));
      const btn = document.getElementById("btn-cooking-add-to-plan");
      const b = btn.getBoundingClientRect();
      const c = content.getBoundingClientRect();
      return { items, listBox: Math.round(listBox), bodyScrolls, addVisible: b.height > 0 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1 && b.bottom <= window.innerHeight + 1 };
    }, recipe);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-long-recipe-card-end.png`) });
    await p.evaluate(() => { const c = document.querySelector("#cooking-recipe-modal .cooking-modal-content"); if (c) c.scrollTop = 0; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-long-recipe-card.png`) });
    await p.evaluate(() => { const d = document.getElementById("cooking-recipe-modal"); if (d && d.open) d.close(); });
    if (card.items !== 13) throw new Error(`the card lists ${card.items} ingredients, not 13`);
    if (p.__size === "phone" && (card.listBox < 13 * 24 || card.bodyScrolls)) throw new Error(`the ingredients are squeezed into a small scrolling box on the phone: ${JSON.stringify(card)}`);
    if (!card.addVisible) throw new Error(`"Add to meal plan" can't be reached by scrolling: ${JSON.stringify(card)}`);
  }],
  // REVIEW=1: screenshots of the phone flow for adding a recipe from a photo
  ["recipe-review", async (p) => {
    if (!process.env.REVIEW || p.__size !== "phone") return;
    const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(SHOTS, `review-${n}.png`) }); };
    await p.evaluate(() => window.closePlanMealDrawer && window.closePlanMealDrawer());
    await goTo("meals")(p);
    await shot("1-meals-page");
    // The way in: tap an empty dinner slot (as a person would)
    await p.evaluate(() => window.openPlanMealDrawer(window.getLocalDateKey(new Date()), "dinner"));
    await shot("2-plan-drawer");
    await p.evaluate(() => { window.__SMOKE_AI = async (photo, kind) => { await new Promise(r => setTimeout(r, 2500)); return kind === "recipe" ? { isRecipe: true, title: "Grandad's beef stew", servings: 4, prepMinutes: 20, cookMinutes: 120, mealType: "dinner", ingredients: ["500g stewing beef, cubed", "2 tbsp plain flour", "1 onion, chopped", "2 carrots, sliced", "500ml beef stock", "1 tbsp tomato purée", "Salt and pepper"], method: ["Toss the beef in the flour.", "Brown the beef in batches in a hot pan with a little oil.", "Add the onion and carrots and cook for 5 minutes.", "Pour in the stock and tomato purée, cover and simmer for 2 hours until tender.", "Season to taste and serve with mash."], emoji: "🍲" } : { events: [] }; }; });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    // 📷 Snap a recipe, at the top of Plan Meal: straight to the photo
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#pane-from-recipes [data-snap-recipe]")]);
    await chooser.setFiles({ name: "page.png", mimeType: "image/png", buffer: png });
    await shot("5-reading");
    await p.waitForTimeout(2600);
    await shot("6-filled-top");
    await p.evaluate(() => document.querySelector("#family-recipe-modal .family-recipe-actions").scrollIntoView({ block: "end" }));
    await shot("7-filled-bottom");
    await p.click('#family-recipe-modal button[type="submit"]');
    await shot("8-after-save");
    if (await p.evaluate(() => document.getElementById("plan-meal-drawer").style.display === "none")) throw new Error("adding a recipe from a photo closed the Plan Meal panel");
    // Saved: a message that names it, and a button into the recipe
    const saved = await p.evaluate(() => { const t = document.getElementById("hm-action-toast"); return t && t.classList.contains("is-visible") ? t.textContent.replace(/\s+/g, " ").trim() : ""; });
    if (!/Grandad's beef stew/.test(saved) || !/View recipe/.test(saved)) throw new Error(`no "saved" message with View recipe: "${saved}"`);
    await p.click("#hm-action-toast .hm-action-toast-btn");
    await shot("9-view-recipe");
    if (!(await p.evaluate(() => document.getElementById("cooking-recipe-modal").open))) throw new Error("View recipe didn't open the recipe");
    await p.evaluate(() => document.getElementById("cooking-recipe-modal").close());
    // Planning breakfast (Plan Meal after midnight): the dinner recipe is still
    // under Your recipes, and searching "beef" finds it
    const found = await p.evaluate(async () => {
      window.openPlanMealDrawer(window.getLocalDateKey(new Date()), "breakfast");
      await new Promise(r => setTimeout(r, 200));
      const list = () => document.getElementById("pane-from-recipes").textContent;
      const browsing = list().includes("Grandad's beef stew");
      const i = document.getElementById("recipe-search-input"); i.value = "beef"; i.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      return { browsing, search: list().includes("Grandad's beef stew") };
    });
    if (!found.browsing) throw new Error("a dinner recipe of your own is missing from Your recipes when planning breakfast");
    if (!found.search) throw new Error(`searching "beef" while planning breakfast doesn't find Grandad's beef stew`);
    await shot("10-search-beef-at-breakfast");
    await p.evaluate(() => { const i = document.getElementById("recipe-search-input"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.evaluate(async () => { const m = await import("./recipes-data.js"); window.openCookingRecipeModal(m.getAllFamilyRecipes().find(x => x.title === "Grandad's beef stew")); });
    await p.evaluate(() => document.getElementById("cooking-credit").scrollIntoView({ block: "center" }));
    await shot("11-card-credit");
  }],
  // This week: "A few ideas" with photos; drag one onto a free dinner, and the
  // week shows it with its photo
  ["meal-ideas", async (p) => {
    if (p.__size === "phone") return; // phones plan with a tap instead (phone-week)
    await p.evaluate(() => { window.closePlanMealDrawer && window.closePlanMealDrawer(); document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.RecipeBrowse && window.RecipeBrowse.setTab("week"); });
    await goTo("meals")(p);
    await p.waitForTimeout(400);
    const ideas = await p.locator("#meal-ideas .meal-idea").count();
    if (ideas < 3) throw new Error(`only ${ideas} ideas above an empty week`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-meal-ideas.png`) });
    const bar = await p.evaluate(() => { const r = document.querySelector("#meal-ideas .meal-ideas-row"); return r.offsetHeight - r.clientHeight; });
    if (bar > 0) throw new Error(`the ideas row shows a ${bar}px scrollbar`);
    const plan = await p.evaluate(() => {
      const idea = document.querySelector("#meal-ideas .meal-idea");
      const t = window.getLocalDateKey(new Date());
      const zone = [...document.querySelectorAll('#skylight-meals-matrix .matrix-meal-cell[data-slot="dinner"], #meals-mobile-cards-feed .mobile-slot-empty-btn[data-slot="dinner"]')]
        .filter(z => z.offsetParent && (z.matches(".mobile-slot-empty-btn") || z.querySelector(".meal-empty-slot")) && z.getAttribute("data-date") >= t)[0];
      if (!zone) return null;
      zone.scrollIntoView({ block: "center" });
      idea.scrollIntoView({ block: "nearest", inline: "nearest" });
      const a = idea.getBoundingClientRect(), b = zone.getBoundingClientRect();
      return { id: idea.getAttribute("data-idea-id"), date: zone.getAttribute("data-date"), from: [a.x + a.width / 2, a.y + a.height / 2], to: [b.x + b.width / 2, b.y + b.height / 2] };
    });
    if (!plan) throw new Error("no free dinner on screen to drop an idea on");
    await p.mouse.move(plan.from[0], plan.from[1]);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(plan.from[0] + (plan.to[0] - plan.from[0]) * i / 12, plan.from[1] + (plan.to[1] - plan.from[1]) * i / 12);
    await p.waitForTimeout(150);
    await p.mouse.up();
    await p.waitForTimeout(600);
    const after = await p.evaluate(({ date }) => { const m = window.getMealForDate(date, "dinner"); return { recipeId: m && m.recipeId, photo: !!document.querySelector(`#skylight-meals-matrix .matrix-meal-cell[data-date="${date}"][data-slot="dinner"] .has-photo, #meals-mobile-cards-feed .mobile-meal-photo`) }; }, plan);
    if (String(after.recipeId) !== String(plan.id)) throw new Error(`dropping the idea didn't plan it: ${JSON.stringify({ plan, after })}`);
    if (!after.photo) throw new Error("the planned recipe doesn't show its photo on the week");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-meal-ideas-planned.png`) });
    if (p.__size !== "phone") {
      // Drag the planned meal from Dinner to Lunch (same day), then off the plan
      const drag = async (fromSel, toFn) => {
        const a = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, fromSel);
        await p.mouse.move(a[0], a[1]); await p.mouse.down();
        await p.mouse.move(a[0] + 10, a[1] + 10); await p.waitForTimeout(100);
        // The meal being dragged keeps its photo
        const ghostPhoto = await p.evaluate(() => { const g = document.querySelector(".item-drag-ghost"); return g ? getComputedStyle(g).backgroundImage : "no ghost"; });
        if (!/url\(/.test(ghostPhoto)) throw new Error(`the meal lost its photo while being dragged: ${ghostPhoto.slice(0, 80)}`);
        const b = await p.evaluate(toFn);
        for (let i = 1; i <= 10; i++) await p.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10);
        await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(500);
      };
      await drag(`#skylight-meals-matrix .matrix-meal-cell[data-date="${plan.date}"][data-slot="dinner"] .meal-card-v2`,
        new Function(`const r = document.querySelector('#skylight-meals-matrix .matrix-meal-cell[data-date="${plan.date}"][data-slot="lunch"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];`));
      const moved = await p.evaluate(({ date }) => ({ lunch: (window.getMealForDate(date, "lunch") || {}).recipeId, dinner: (window.getMealForDate(date, "dinner") || {}).title || null }), plan);
      if (String(moved.lunch) !== String(plan.id) || moved.dinner) throw new Error(`dragging Dinner to Lunch didn't move it: ${JSON.stringify(moved)}`);
      await drag(`#skylight-meals-matrix .matrix-meal-cell[data-date="${plan.date}"][data-slot="lunch"] .meal-card-v2`,
        () => { const z = document.querySelector(".meal-off-plan-zone"); if (!z) return [0, 0]; const r = z.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const off = await p.evaluate(({ date }) => ({ lunch: (window.getMealForDate(date, "lunch") || {}).title || null, zoneLeft: !!document.querySelector(".meal-off-plan-zone"), recipe: !!window.RecipeRows.find(window.MealIdeas.picks()[0]) }), plan);
      if (off.lunch) throw new Error("dropping on Take off the plan didn't take it off");
      if (off.zoneLeft) throw new Error("the Take off the plan bar stayed after the drag");
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-meal-taken-off.png`) });
      // A short tablet screen (browser bars showing): Dinner still fits
      const size = p.viewportSize();
      await p.setViewportSize({ width: 1280, height: 600 });
      await p.waitForTimeout(400);
      const fit = await p.evaluate(() => { const c = [...document.querySelectorAll('#skylight-meals-matrix .matrix-meal-cell[data-slot="dinner"]')][0].getBoundingClientRect(); return { bottom: Math.round(c.bottom), h: window.innerHeight }; });
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-short-screen.png`) });
      await p.setViewportSize(size);
      if (fit.bottom > fit.h) throw new Error(`Dinner runs off a 600px-tall screen: ${JSON.stringify(fit)}`);
    }
    await p.evaluate(({ date }) => { ["breakfast", "lunch", "dinner"].forEach(s => { if ((window.getMealForDate(date, s) || {}).recipeId) window.setMealForDate(date, null, s); }); window.renderMealsView(); document.querySelectorAll("dialog[open]").forEach(d => d.close()); }, plan);
    // "More" opens the Recipes tab
    await p.click("#meal-ideas [data-meal-ideas-more]");
    await p.waitForTimeout(300);
    if (!(await p.evaluate(() => window.RecipeBrowse.tab() === "recipes" && !document.getElementById("meals-recipes-view").hidden))) throw new Error("More didn't open the Recipes tab");
    await p.evaluate(() => window.RecipeBrowse.setTab("week"));
  }],
  // A photo of the dish on your own recipe: picked in the form, saved to its
  // own document, shown on the Recipes tab, fetched by another device, removed
  ["dish-photo", async (p) => {
    const id = "family-smoke-dish";
    const photoPath = "boards/sidepanel-test-x7q2/recipePhotos/" + id;
    await p.evaluate((rid) => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.FamilyRecipes.save({ id: rid, title: "Mum's lasagne", emoji: "🍝", mealType: "dinner", category: "dinner", source: "family", subtitle: "Family recipe", ingredients: ["500g mince"], instructions: ["Layer it up.", "Bake."] }); window.FamilyRecipes.openEditor(rid); }, id);
    await p.waitForTimeout(500);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#family-recipe-modal [data-fr-dish-pick]")]);
    await chooser.setFiles({ name: "dish.png", mimeType: "image/png", buffer: png });
    await p.waitForTimeout(500);
    const preview = await p.evaluate(() => document.querySelector("#family-recipe-modal [data-fr-dish-preview]").style.backgroundImage);
    if (!/data:image\/jpeg/.test(preview)) throw new Error("the picked dish photo doesn't show in the form");
    await p.evaluate(() => document.querySelector("#family-recipe-modal [data-fr-dish-pick]").scrollIntoView({ block: "center" }));
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-dish-photo-form.png`) });
    await p.click('#family-recipe-modal button[type="submit"]');
    await p.waitForTimeout(600);
    const saved = await p.evaluate(({ rid, pp }) => {
      const r = window.FamilyRecipes.list().find(x => x.id === rid);
      const doc = (window.__SMOKE_STORE || {})[pp];
      const shown = window.RecipeRows.all().find(x => x.id === rid);
      return { rev: r && r.photo && r.photo.rev, stored: !!(doc && /^data:image\/jpeg;base64,/.test(doc.data)), shown: !!(shown && /^data:image\/jpeg/.test(shown.image)), boardHasNoPhoto: !JSON.stringify((window.__SMOKE_STORE["boards/sidepanel-test-x7q2"] || {}).customRecipes || []).includes("base64") };
    }, { rid: id, pp: photoPath });
    if (!saved.rev || !saved.stored || !saved.shown) throw new Error(`the dish photo wasn't saved and shown: ${JSON.stringify(saved)}`);
    if (!saved.boardHasNoPhoto) throw new Error("the photo itself went into the board document");
    // Another device: nothing cached, so it fetches the photo, then shows it
    const fetched = await p.evaluate(async (rid) => {
      Object.keys(localStorage).filter(k => k.startsWith("harmonee_recipe_photo_")).forEach(k => localStorage.removeItem(k));
      const r = window.FamilyRecipes.list().find(x => x.id === rid);
      const other = { ...r, photo: { rev: r.photo.rev + 1 } }; // a rev this device hasn't seen
      const first = window.RecipePhotos.url(other);
      await new Promise(res => setTimeout(res, 300));
      return { first, later: /^data:image\/jpeg/.test(window.RecipePhotos.url(other)) };
    }, id);
    if (fetched.first !== "" || !fetched.later) throw new Error(`another device didn't fetch the photo: ${JSON.stringify(fetched)}`);
    await goTo("meals")(p);
    await p.evaluate(() => window.RecipeBrowse.setTab("recipes"));
    await p.waitForTimeout(500);
    const tile = await p.evaluate(() => { const t = [...document.querySelectorAll("#meals-recipes-view .rb-tile")].find(x => x.textContent.includes("Mum's lasagne")); const img = t && t.querySelector(".rb-photo img"); return img ? img.getAttribute("src").slice(0, 23) : "none"; });
    if (tile !== "data:image/jpeg;base64,") throw new Error(`the Recipes tab shows ${tile} for the lasagne, not its photo`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-dish-photo-tile.png`) });
    // Remove it
    await p.evaluate((rid) => window.FamilyRecipes.openEditor(rid), id);
    await p.waitForTimeout(500);
    await p.click("#family-recipe-modal [data-fr-dish-remove]");
    await p.click('#family-recipe-modal button[type="submit"]');
    await p.waitForTimeout(600);
    const gone = await p.evaluate(({ rid, pp }) => ({ photo: (window.FamilyRecipes.list().find(x => x.id === rid) || {}).photo || null, doc: !!window.__SMOKE_STORE[pp] }), { rid: id, pp: photoPath });
    if (gone.photo || gone.doc) throw new Error(`removing the dish photo didn't: ${JSON.stringify(gone)}`);
    await p.evaluate((rid) => { window.FamilyRecipes.remove(rid); window.RecipeBrowse.setTab("week"); }, id);
  }],
  // The week starts today, shows the month, and moves a day at a time when
  // dragged sideways (tablets and computers); the recipe card has room at the
  // top and closes when you tap outside it
  ["week-from-today", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.closePlanMealDrawer && window.closePlanMealDrawer(); window.RecipeBrowse && window.RecipeBrowse.setTab("week"); document.getElementById("btn-meals-today") && document.getElementById("btn-meals-today").click(); });
    await goTo("meals")(p);
    await p.waitForTimeout(300);
    // The header fits at tablet widths: the tabs never run under the buttons
    if (p.__size !== "phone") {
      const size = p.viewportSize();
      for (const w of [1440, 1280, 1180, 1100, 1024, 900]) {
        await p.setViewportSize({ width: w, height: size.height });
        await p.waitForTimeout(250);
        const m = await p.evaluate(() => {
          const tabs = document.querySelector("#view-meals .meals-tabs").getBoundingClientRect();
          const btns = [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > *")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect());
          const clash = btns.some(b => b.left < tabs.right - 1 && b.right > tabs.left + 1 && b.top < tabs.bottom - 1 && b.bottom > tabs.top + 1);
          const words = [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > button, #view-meals .meals-tab")].filter(b => b.offsetParent).every(b => b.scrollWidth <= b.clientWidth + 1);
          return { clash, words };
        });
        if (w === 1100 || w === 1024) await p.screenshot({ path: path.join(SHOTS, `${p.__size}-header-${w}.png`), clip: { x: 0, y: 0, width: w, height: 140 } });
        if (m.clash || !m.words) { await p.screenshot({ path: path.join(SHOTS, `${p.__size}-header-${w}.png`) }); await p.setViewportSize(size); throw new Error(`the Meals header doesn't fit at ${w}px wide: ${JSON.stringify(m)}`); }
      }
      await p.setViewportSize(size);
      await p.waitForTimeout(250);
    }
    const first = await p.evaluate(() => window.getLocalDateKey(window.getMealsWeekDates(window.mealsWeekOffset || 0)[0]) === window.getLocalDateKey(new Date()));
    if (!first) throw new Error("the week doesn't start today");
    if (p.__size !== "phone") {
      const head = await p.evaluate(() => { const h = document.querySelector("#skylight-meals-matrix .matrix-day-header-cell"); return h ? h.textContent.replace(/\s+/g, " ").trim() : ""; });
      if (!/[A-Z][a-z]{2}$/.test(head)) throw new Error(`no month by the first day: "${head}"`);
      // Drag the grid two columns to the left: the week moves on two days
      const box = await p.evaluate(() => { const r = document.querySelector('#skylight-meals-matrix .matrix-meal-cell[data-slot="lunch"]').getBoundingClientRect(); const c = document.querySelector("#skylight-meals-matrix .matrix-day-header-cell").getBoundingClientRect(); return { x: r.x + r.width / 2 + c.width * 2, y: r.y + r.height / 2, w: c.width }; });
      await p.mouse.move(box.x, box.y);
      await p.mouse.down();
      for (let i = 1; i <= 10; i++) await p.mouse.move(box.x - (box.w * 2) * i / 10, box.y);
      await p.mouse.up();
      await p.waitForTimeout(400);
      const moved = await p.evaluate(() => { const d = window.getMealsWeekDates(window.mealsWeekOffset || 0)[0]; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); });
      if (moved !== 2) throw new Error(`dragging the week two days moved it ${moved}`);
      if (await p.evaluate(() => document.getElementById("plan-meal-drawer").style.display !== "none")) throw new Error("the drag opened Plan Meal");
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-week-dragged.png`) });
      await p.click("#btn-meals-today");
    }
    // Recipe card: badge inside the photo strip; tapping outside closes it
    await p.evaluate(() => window.RecipeRows.open(window.RecipeRows.all().find(r => r.id.startsWith("mealdb-"))));
    await p.waitForTimeout(500);
    const fits = await p.evaluate(() => { const h = document.getElementById("cooking-modal-hero").getBoundingClientRect(); const b = document.getElementById("cooking-badge").getBoundingClientRect(); return b.top >= h.top + 8; });
    if (!fits) throw new Error("the recipe badge is cut off at the top of the card");
    const scrolled = await p.evaluate(() => [...document.querySelectorAll("#cooking-recipe-modal, #cooking-recipe-modal *")].filter(e => e.scrollTop > 0).map(e => e.className));
    if (scrolled.length) throw new Error(`the recipe card opened scrolled down: ${scrolled.join(", ")}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-card-top.png`) });
    await p.mouse.click(4, 4);
    await p.waitForTimeout(300);
    if (await p.evaluate(() => document.getElementById("cooking-recipe-modal").open)) throw new Error("tapping outside the recipe card didn't close it");
  }],
  // Kinds of list: worked out from their names, each with its own tools;
  // New list starts by picking one
  // Lists: type an item and tap ＋ and it's on the list (it used to open the
  // Add panel on a phone); ＋ with nothing typed opens the panel, whose list
  // chips show whole names
  ["list-plus", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.switchSkylightView("lists"); });
    await p.waitForTimeout(300);
    // Open Groceries (a tile on phones, the rail elsewhere)
    await p.evaluate(() => { const b = document.querySelector('#lists-board [data-open-list="groceries"]'); if (b) b.click(); });
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const wait = (ms) => new Promise(res => setTimeout(res, ms));
      const col = document.querySelector('#lists-board [data-list-id="groceries"]');
      const input = col && col.querySelector(".list-column-add input");
      const plus = col && col.querySelector("[data-open-add-panel]");
      if (!input || !plus) return { found: false };
      input.value = "Dishwasher tablets";
      plus.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      plus.click();
      await wait(300);
      const g = (window.familyLists || []).find(l => l.id === "groceries") || {};
      const added = (g.items || []).some(i => /dishwasher tablets/i.test(i.text || ""));
      const panelAfterTyped = !!(document.getElementById("list-item-modal") || {}).open;
      const inputAfter = document.querySelector('#lists-board [data-list-id="groceries"] .list-column-add input');
      const cleared = !!inputAfter && inputAfter.value === "";
      // Nothing typed: the panel for several at once
      document.querySelector('#lists-board [data-list-id="groceries"] [data-open-add-panel]').click();
      await wait(400);
      const panel = !!(document.getElementById("list-item-modal") || {}).open;
      const chips = [...document.querySelectorAll("#list-item-list-picker .list-pick-chip")];
      const clipped = chips.filter(c => { const n = c.querySelector(".list-pick-chip-name"); return n && n.scrollWidth > n.clientWidth + 1; }).map(c => c.textContent.trim());
      const onChip = (document.querySelector("#list-item-list-picker .list-pick-chip.is-on") || {}).textContent || "";
      return { found: true, added, panelAfterTyped, cleared, panel, chips: chips.length, clipped, onChip: onChip.trim() };
    });
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-list-add-panel.png`) });
    await p.evaluate(async () => {
      const d = document.getElementById("list-item-modal"); if (d && d.open) d.close();
      await new Promise(res => setTimeout(res, 350));
      const back = document.querySelector("#lists-board [data-lists-back]"); if (back && back.offsetParent) back.click(); // back to My lists on a phone
    });
    await p.waitForTimeout(300);
    if (!r.found) throw new Error("couldn't find Groceries' add box");
    if (!r.added || r.panelAfterTyped || !r.cleared) throw new Error(`typing an item and tapping ＋ didn't just add it: ${JSON.stringify(r)}`);
    if (!r.panel) throw new Error("＋ with nothing typed didn't open the Add panel");
    if (r.chips < 4 || r.clipped.length) throw new Error(`the Add panel's list chips are cut short: ${JSON.stringify(r)}`);
    if (!/Groceries/.test(r.onChip)) throw new Error(`the Add panel didn't have Groceries picked: ${r.onChip}`);
  }],
  ["list-kinds", async (p) => {
    await p.evaluate(() => document.querySelectorAll("dialog[open]").forEach(d => d.close()));
    await goTo("lists")(p);
    await p.waitForTimeout(300);
    const kinds = await p.evaluate(() => (window.loadFamilyLists() || []).map(l => `${l.id}:${window.ListTypes.typeOf(l)}:${window.ListTypes.ownerOf(l)}`));
    for (const want of ["groceries:shopping:", "packing:packing:", "list-jo-xmas:wish:Jo", "list-jobs:todo:"]) {
      if (!kinds.includes(want)) throw new Error(`list kinds wrong: ${kinds.join(", ")}`);
    }
    const phone = p.__size === "phone";
    if (phone) await p.screenshot({ path: path.join(SHOTS, `${p.__size}-lists-home.png`) });
    const open = async (id) => { await p.click(`[data-open-list="${id}"]`); await p.waitForTimeout(300); };
    // Groceries: Shop is its main button
    await open("groceries");
    if (!(await p.locator('.list-detail [data-shop-list]').count())) throw new Error("no Shop on the shopping list");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-list-shopping.png`) });
    if (phone) await p.click("[data-lists-back]");
    // Packing: no Shop; add for Jo; tick, then Start again
    await open("packing");
    if (await p.locator('.list-detail [data-shop-list]').count()) throw new Error("Shop shows on a packing list");
    await p.click('.list-detail [data-pack-who="Jo"]');
    await p.fill(".list-detail .list-column-add input", "Teddy");
    await p.press(".list-detail .list-column-add input", "Enter");
    await p.waitForTimeout(300);
    const teddy = await p.evaluate(() => (window.loadFamilyLists().find(l => l.id === "packing").items || []).find(i => i.text === "Teddy"));
    if (!teddy || teddy.who !== "Jo") throw new Error(`Teddy wasn't added for Jo: ${JSON.stringify(teddy)}`);
    if (!(await p.locator('.list-detail [data-section="who:Jo"]').count())) throw new Error("no section for Jo on the packing list");
    await p.locator('.list-detail [data-section="who:Jo"] [data-toggle-item]').first().click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-list-packing.png`) });
    await p.click(".list-detail [data-start-again]");
    await p.waitForTimeout(300);
    if (await p.evaluate(() => window.loadFamilyLists().find(l => l.id === "packing").items.some(i => i.checked))) throw new Error("Start again didn't untick everything");
    if (phone) await p.click("[data-lists-back]");
    // Wish list: Jo's, no ticks, a price and a link
    await open("list-jo-xmas");
    const wish = await p.evaluate(() => ({ kind: document.querySelector(".list-detail .list-hero-kind").textContent, ticks: document.querySelectorAll(".list-detail [data-toggle-item]").length, price: (document.querySelector(".list-detail .list-row-price") || {}).textContent, link: (document.querySelector(".list-detail .list-row-link") || {}).href || "", shop: document.querySelectorAll(".list-detail [data-shop-list]").length }));
    // (its name already says it's Jo's, so the label just says Wish list)
    if (!/^Wish list$/i.test(wish.kind) || wish.ticks || wish.price !== "£45" || !/example\.com/.test(wish.link) || wish.shop) throw new Error(`the wish list looks wrong: ${JSON.stringify(wish)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-list-wish.png`) });
    if (phone) await p.click("[data-lists-back]");
    // New list: pick Packing, keep the suggestions
    await p.evaluate(() => window.openCreateListModal());
    await p.waitForTimeout(500);
    if ((await p.locator("#new-list-kind-picker [data-kind]").count()) !== 4) throw new Error("New list doesn't offer the four kinds");
    await p.click('#new-list-kind-picker [data-kind="packing"]');
    await p.fill("#new-list-title-input", "Summer holiday");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-list-new.png`) });
    await p.click("#btn-save-new-list");
    await p.waitForTimeout(500);
    const made = await p.evaluate(() => { const l = window.loadFamilyLists().find(x => x.title === "Summer holiday"); return l ? { id: l.id, type: l.type, n: l.items.length, jo: l.items.filter(i => i.who === "Jo").length, fam: l.items.filter(i => (i.who || "Family") === "Family").length } : null; });
    if (!made || made.type !== "packing" || made.jo < 3 || made.fam < 3) throw new Error(`the new packing list didn't start with suggestions: ${JSON.stringify(made)}`);
    // New wish list: whose, and the name follows
    await p.evaluate(() => window.openCreateListModal());
    await p.waitForTimeout(500);
    await p.click('#new-list-kind-picker [data-kind="wish"]');
    await p.click('#new-list-owner-picker [data-owner="Max"]');
    const name = await p.inputValue("#new-list-title-input");
    if (name !== "Max's wish list") throw new Error(`a new wish list for Max is called "${name}"`);
    await p.click("#btn-save-new-list");
    await p.waitForTimeout(400);
    const maxList = await p.evaluate(() => { const l = window.loadFamilyLists().find(x => x.title === "Max's wish list"); return l ? { id: l.id, type: l.type, owner: l.owner } : null; });
    if (!maxList || maxList.type !== "wish" || maxList.owner !== "Max") throw new Error(`Max's wish list saved wrongly: ${JSON.stringify(maxList)}`);
    if (phone) { await p.click("[data-lists-back]"); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, `${p.__size}-lists-home-after.png`) }); }
    else await p.screenshot({ path: path.join(SHOTS, `${p.__size}-lists-rail.png`) });
    await p.evaluate((ids) => ids.forEach(id => window.handleDeleteList(id)), [made.id, maxList.id]);
    await p.evaluate(() => { const l = window.loadFamilyLists().find(x => x.id === "packing"); const t = l.items.find(i => i.text === "Teddy"); if (t) window.handleDeleteListItem("packing", t.id); });
  }],
  // Phones: This week is one scrolling list, dinner first; "Plan dinner"
  // opens photo ideas, one tap plans it; a planned meal can be moved
  ["phone-week", async (p) => {
    if (p.__size !== "phone") return;
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.RecipeBrowse && window.RecipeBrowse.setTab("week"); window.setMealsWeek(0); });
    await goTo("meals")(p);
    await p.waitForTimeout(300);
    const look = await p.evaluate(() => {
      const box = document.getElementById("meals-phone-week");
      const vis = (sel) => { const el = document.querySelector(sel); return !!(el && el.offsetParent); };
      const tabs = document.querySelector("#view-meals .meals-tabs").getBoundingClientRect(), cart = document.getElementById("meals-grocery-mini").getBoundingClientRect();
      return { shown: !!(box && box.offsetParent), days: box ? box.querySelectorAll(".mp-day").length : 0, first: box ? box.querySelector(".mp-day-head").textContent : "", oldFeed: vis("#meals-mobile-cards-feed"), ideas: vis("#meal-ideas"), planBtn: vis("#btn-meals-plan-dinner"), cartBesideTabs: Math.abs((cart.top + cart.bottom) / 2 - (tabs.top + tabs.bottom) / 2) < 12 };
    });
    if (!look.shown || look.days !== 7 || !/^Today/.test(look.first)) throw new Error(`the phone week looks wrong: ${JSON.stringify(look)}`);
    if (look.oldFeed || look.ideas || look.planBtn) throw new Error(`old phone pieces still show: ${JSON.stringify(look)}`);
    if (!look.cartBesideTabs) throw new Error("the 🛒 isn't beside the tabs");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-week-list.png`) });
    // Plan a free dinner with one tap on a photo
    const date = await p.evaluate(() => document.querySelector('#meals-phone-week [data-mp-plan][data-slot="dinner"]').getAttribute("data-date"));
    await p.click(`#meals-phone-week [data-mp-plan][data-slot="dinner"][data-date="${date}"]`);
    await p.waitForTimeout(400);
    const ideas = await p.locator("#meal-quick-plan .mp-idea").count();
    if (ideas < 3) throw new Error(`the plan sheet shows ${ideas} ideas`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-plan-sheet.png`) });
    // The title stays on one line, even the longest at a narrow 360px phone
    for (const w of [390, 360]) {
      await p.setViewportSize({ width: w, height: 844 });
      await p.waitForTimeout(200);
      const fit = await p.evaluate(() => {
        const t = document.getElementById("mqp-title"), s = document.querySelector("#meal-quick-plan .mqp-sub");
        const was = t.textContent;
        t.textContent = "Plan breakfast · Thu 1 Jan";
        const one = (el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height < parseFloat(getComputedStyle(el).fontSize) * 2;
        const r = { title: one(t), sub: one(s) };
        t.textContent = was;
        return r;
      });
      if (!fit.title || !fit.sub) throw new Error(`the plan sheet title doesn't fit on one line at ${w}px: ${JSON.stringify(fit)}`);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    const before = await p.evaluate(() => [...document.querySelectorAll("#meal-quick-plan [data-mp-pick]")].map(b => b.getAttribute("data-mp-pick")).join());
    await p.click("#meal-quick-plan [data-mqp-others]");
    const after = await p.evaluate(() => [...document.querySelectorAll("#meal-quick-plan [data-mp-pick]")].map(b => b.getAttribute("data-mp-pick")).join());
    if (before === after) throw new Error("Show me others showed the same ideas");
    const pickId = await p.evaluate(() => document.querySelector("#meal-quick-plan [data-mp-pick]").getAttribute("data-mp-pick"));
    await p.click("#meal-quick-plan [data-mp-pick]");
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelectorAll("dialog[open]").forEach(d => d.close()));
    const planned = await p.evaluate((d) => ({ id: (window.getMealForDate(d, "dinner") || {}).recipeId, sheet: document.getElementById("meal-quick-plan").open, photo: !!document.querySelector(`#meals-phone-week .mp-dinner.has-photo[data-date="${d}"]`) }), date);
    if (String(planned.id) !== String(pickId) || planned.sheet || !planned.photo) throw new Error(`tapping an idea didn't plan it: ${JSON.stringify({ pickId, planned })}`);
    await p.evaluate((d) => document.querySelector(`#meals-phone-week .mp-dinner[data-date="${d}"]`).scrollIntoView({ block: "center" }), date);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-week-planned.png`) });
    // Move it: tap it, Move, pick a day
    await p.click(`#meals-phone-week .mp-dinner[data-date="${date}"]`);
    await p.waitForTimeout(400);
    await p.click("#btn-popover-move-meal");
    await p.waitForTimeout(400);
    const target = await p.evaluate((d) => { const opts = [...document.querySelectorAll("#hm-confirm [data-sheet-pick]")].map(b => b.getAttribute("data-sheet-pick")); return opts.find(k => k > d && !(window.getMealForDate(k, "dinner") || {}).title) || null; }, date);
    if (!target) throw new Error("Move doesn't offer a free day");
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-move-sheet.png`) });
    await p.click(`#hm-confirm [data-sheet-pick="${target}"]`);
    await p.waitForTimeout(600);
    const moved = await p.evaluate(({ d, t }) => ({ from: (window.getMealForDate(d, "dinner") || {}).title || null, to: (window.getMealForDate(t, "dinner") || {}).recipeId }), { d: date, t: target });
    if (moved.from || String(moved.to) !== String(pickId)) throw new Error(`Move didn't move it: ${JSON.stringify(moved)}`);
    await p.evaluate((t) => { window.setMealForDate(t, null, "dinner"); window.renderMealsView(); document.querySelectorAll("dialog[open]").forEach(d => d.close()); }, target);
    // "Not sure yet" as the cook: just "Dinner", never "Not sure yet cooking"; Family reads "Everyone"
    if (p.__size === "phone") {
      const words = await p.evaluate(async () => {
        const key = window.getLocalDateKey(new Date());
        const read = async (cook) => {
          window.weeklyMeals = window.weeklyMeals || {};
          const m = (window.getMealForDate && window.getMealForDate(new Date(), "dinner")) || null;
          if (m) m.cook = cook;
          if (typeof window.renderMealsView === "function") window.renderMealsView();
          await new Promise(res => setTimeout(res, 200));
          const el = [...document.querySelectorAll("#view-meals .mp-dinner-words small")][0];
          return el ? el.textContent : "";
        };
        void key;
        return { unsure: await read("Not sure yet"), family: await read("Family"), alex: await read("Alex") };
      });
      if (/Not sure/.test(words.unsure) || !/^Dinner$/.test(words.unsure.trim())) throw new Error(`"Not sure yet" shows as a cook: "${words.unsure}"`);
      if (!/Everyone cooking/.test(words.family)) throw new Error(`Family shows as "${words.family}"`);
      if (!/Alex cooking/.test(words.alex)) throw new Error(`a named cook shows as "${words.alex}"`);
    }
  }],
  // Back and Forward: each page has its own address; Back closes what's open
  // first (a recipe card, a list on a phone), then goes to the page before;
  // a refresh stays on the page
  ["back-button", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.closePlanMealDrawer && window.closePlanMealDrawer(); window.RecipeBrowse && window.RecipeBrowse.setTab("week"); });
    await p.waitForTimeout(300);
    const nav = async (view) => { await p.click(`.skylight-nav-item[data-view="${view}"]`); await p.waitForTimeout(250); };
    const where = () => p.evaluate(() => ({ view: window.currentActiveView, hash: location.hash }));
    const back = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(400); };
    await nav("calendar"); await nav("meals"); await nav("lists");
    let w = await where();
    if (w.view !== "lists" || w.hash !== "#lists") throw new Error(`Lists has no address: ${JSON.stringify(w)}`);
    await back();
    w = await where();
    if (w.view !== "meals" || w.hash !== "#meals") throw new Error(`Back from Lists didn't go to Meals: ${JSON.stringify(w)}`);
    // The Recipes tab is a step too
    await p.click('[data-meals-tab="recipes"]');
    await p.waitForTimeout(300);
    if ((await where()).hash !== "#meals/recipes") throw new Error("the Recipes tab has no address");
    // Back closes an open recipe card first, and stays on Recipes
    await p.locator("#meals-recipes-view [data-rb-recipe]").first().click();
    await p.waitForTimeout(500);
    if (!(await p.evaluate(() => document.getElementById("cooking-recipe-modal").open))) throw new Error("the recipe card didn't open");
    await back();
    const afterCard = await p.evaluate(() => ({ card: document.getElementById("cooking-recipe-modal").open, view: window.currentActiveView, tab: window.RecipeBrowse.tab() }));
    if (afterCard.card || afterCard.view !== "meals" || afterCard.tab !== "recipes") throw new Error(`Back didn't just close the recipe card: ${JSON.stringify(afterCard)}`);
    // Closing it with its own ✕ doesn't leave a step behind
    await p.locator("#meals-recipes-view [data-rb-recipe]").first().click();
    await p.waitForTimeout(500);
    await p.click("#btn-close-cooking-modal");
    await p.waitForTimeout(500);
    await back();
    const tab = await p.evaluate(() => window.RecipeBrowse.tab());
    if (tab !== "week") throw new Error(`after closing a card with ✕, Back didn't go to This week (${tab})`);
    // Forward comes back to Recipes
    await p.evaluate(() => history.forward()); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.RecipeBrowse.tab())) !== "recipes") throw new Error("Forward didn't return to Recipes");
    await p.evaluate(() => window.RecipeBrowse.setTab("week"));
    // Phones: Back from an open list goes to My lists
    if (p.__size === "phone") {
      await nav("lists");
      await p.click('[data-open-list="groceries"]');
      await p.waitForTimeout(400);
      await back();
      const lists = await p.evaluate(() => ({ view: window.currentActiveView, open: document.getElementById("lists-board").classList.contains("is-phone-detail") }));
      if (lists.view !== "lists" || lists.open) throw new Error(`Back from a list didn't go to My lists: ${JSON.stringify(lists)}`);
    }
    // A refresh stays on the page
    await nav("rewards");
    await p.reload();
    await p.waitForTimeout(1500);
    const after = await where();
    if (after.view !== "rewards") throw new Error(`a refresh on Rewards opened ${after.view}`);
    await nav("calendar");
  }],
  // Today at a glance never opens by itself: after the night clock wakes the
  // board, and after it's been left alone, it stays on the page it was on
  ["stays-put", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.closeTodayScreen && window.closeTodayScreen({ quiet: true }); });
    await p.click('.skylight-nav-item[data-view="chores"]');
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      window.activateAmbientSleepScreen(false);
      window.deactivateAmbientSleepScreen();
      // the morning wake-up path
      Object.assign(window.boardSettings, { sleepScheduleEnabled: true, sleepStartTime: "00:00", sleepEndTime: "00:01" });
      window.activateAmbientSleepScreen(false);
      window.checkScheduledSleepWindow();
      await new Promise(res => setTimeout(res, 300));
      const t = document.getElementById("today-screen");
      return { today: !!(t && !t.hidden && t.offsetParent), view: window.currentActiveView, idleSetting: !!document.getElementById("settings-today-idle"), morningSetting: !!document.getElementById("settings-today-enabled") };
    });
    if (r.today || r.view !== "chores") throw new Error(`waking up didn't stay on Tasks: ${JSON.stringify(r)}`);
    if (r.idleSetting || r.morningSetting) throw new Error("the Today at a glance settings are still there");
    await p.evaluate(() => { window.boardSettings.sleepScheduleEnabled = false; window.deactivateAmbientSleepScreen(); });
  }],
  // Streaks: a tick on the Tasks page counts (it never used to), and taking
  // it back takes the day off again
  ["streak-ticks", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.switchSkylightView("chores"); });
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const today = window.getLocalDateKey(new Date());
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      const task = (window.currentTasks || []).find(t => window.Streaks.isDailyTask(t) && !(t.completedDays || {})[dayName] && !String(t.assignedTo || "").includes(","));
      if (!task) return { none: true };
      window.handleCompleteTaskWithCelebration(task.id, dayName, null, today);
      await new Promise(res => setTimeout(res, 400));
      const stored = (window.__SMOKE_STORE[`boards/sidepanel-test-x7q2/tasks/${task.id}`] || {});
      const after = { local: window.Streaks.streakOf(task), stored: (stored.tickDates || []).includes(today) };
      if (window.TickCheer) window.TickCheer.close(true);
      await window.handleUndoTask(task.id, dayName, today);
      await new Promise(res => setTimeout(res, 400));
      const stored2 = (window.__SMOKE_STORE[`boards/sidepanel-test-x7q2/tasks/${task.id}`] || {});
      return { id: task.id, after, undone: !(stored2.tickDates || []).includes(today) };
    });
    if (r.none) throw new Error("no daily job to tick in the sample family");
    if (r.after.local < 1 || !r.after.stored) throw new Error(`a tick on the Tasks page didn't count towards its streak: ${JSON.stringify(r)}`);
    if (!r.undone) throw new Error(`taking the tick back left the day on its streak: ${JSON.stringify(r)}`);
  }],
  // Rewards (10 Nov): this week's stars with a crown, the family goal, a card
  // for each person (photo goals, "Set a goal for"), stickers kept on the
  // board, the person panel and the family goal panel
  // Each person's buddy as their avatar wherever their name is shown (Steven, 11 Nov):
  // Alex the robot, Jo the dragon, Sam the kitten; Max has none and keeps his initial
  ["buddy-faces", async (p) => {
    const shot = async (name) => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(SHOTS, `${p.__size}-buddy-${name}.png`) }); };
    const close = () => p.evaluate(() => document.querySelectorAll("dialog[open]").forEach(d => d.close()));
    await p.evaluate(() => {
      document.querySelectorAll("dialog[open]").forEach(d => d.close());
      window.boardSettings.memberBuddies = { alex: "robot", jo: "dragon", sam: "kitten" };
      window.switchSkylightView("tasks");
    });
    await p.waitForTimeout(400);
    const where = {};
    const count = (sel) => p.evaluate((sel) => document.querySelectorAll(sel).length, sel);
    where.taskColumns = await count(".skylight-tasks-col .tasks-col-avatar.has-buddy svg");
    where.maxInitial = await p.evaluate(() => { const a = document.querySelector('.skylight-tasks-col[data-col-member="Max"] .tasks-col-avatar'); return a ? a.textContent.trim() : "(no Max column)"; });
    await shot("tasks");
    await p.evaluate(() => window.openSkylightTaskDrawer());
    await p.waitForTimeout(300);
    where.jobPanel = await count("#skylight-task-drawer .drawer-profile-avatar.is-buddy svg");
    await shot("job-panel");
    await p.evaluate(() => { const o = document.getElementById("skylight-task-drawer-overlay"); if (typeof window.closeSkylightTaskDrawer === "function") window.closeSkylightTaskDrawer(); else if (o) o.style.display = "none"; });
    await close();
    await p.evaluate(() => window.openGrabsPanel());
    await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.querySelector("#grabs-list [data-grabs-who]"); if (b) b.click(); });
    await p.waitForTimeout(200);
    where.bigJobs = await count("#grabs-list .drawer-profile-avatar.is-buddy svg");
    await shot("big-jobs");
    await close();
    await p.evaluate(() => { window.switchSkylightView("meals"); window.openPlanMealDrawer(window.getLocalDateKey(new Date()), "dinner"); });
    await p.waitForTimeout(400);
    where.cookPicker = await count(".chef-select-chip .drawer-profile-avatar.is-buddy svg");
    await shot("meal-cook");
    await close();
    await p.evaluate(() => window.MealGenie.openTastes());
    await p.waitForTimeout(400);
    where.mealtime = await count(".genie-face.has-buddy svg");
    where.mealtimeMax = await p.evaluate(() => [...document.querySelectorAll(".genie-face")].map(f => f.textContent.trim()).filter(Boolean).join(","));
    await shot("magic-mealtime");
    await close();
    await p.evaluate(() => window.openSettingsModal());
    await p.waitForTimeout(400);
    where.settings = await count(".roster-color-trigger-btn.has-buddy svg");
    await p.evaluate(() => { const r = document.querySelector(".roster-member-row"); if (r) r.scrollIntoView({ block: "center" }); });
    await shot("settings");
    await close();
    await p.evaluate(() => window.openProfilePanel("Alex"));
    await p.waitForTimeout(300);
    where.profile = await count(".profile-hero-avatar.has-buddy svg");
    await close();
    await p.evaluate(() => window.switchSkylightView("calendar"));
    await p.waitForTimeout(200);
    where.dupIds = await p.evaluate(() => { const ids = [...document.querySelectorAll(".buddy-svg [id]")].map(e => e.id); return ids.length - new Set(ids).size; });
    if (where.dupIds) throw new Error(`buddy drawings share gradient names (${where.dupIds}), so copies draw pale`);
    const want = { taskColumns: 3, jobPanel: 3, bigJobs: 1, cookPicker: 3, mealtime: 3, settings: 3, profile: 1 };
    const short = Object.entries(want).filter(([k, n]) => !(where[k] >= n)).map(([k]) => k);
    if (short.length) throw new Error(`buddies missing in: ${short.join(", ")} ${JSON.stringify(where)}`);
    if (where.maxInitial !== "M") throw new Error(`Max (no buddy) should keep his initial: ${where.maxInitial}`);
    if (where.mealtimeMax !== "M") throw new Error(`Magic Mealtime faces: ${where.mealtimeMax}`);
    await p.evaluate(() => { window.boardSettings.memberBuddies = {}; });
  }],
  ["rewards-page", async (p) => {
    await p.evaluate(() => {
      document.querySelectorAll("dialog[open]").forEach(d => d.close());
      window.boardSettings.memberBuddies = { jo: "dragon" };
      window.switchSkylightView("rewards");
    });
    await p.waitForTimeout(400);
    const B = "boards/sidepanel-test-x7q2";
    const r = await p.evaluate(async (B) => {
      const q = (s) => document.querySelector(s);
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      const today = window.getLocalDateKey(new Date());
      const out = {};
      out.rows = document.querySelectorAll("#rewards-leaderboard .rw-lb-row").length;
      out.cards = document.querySelectorAll("#rewards-people-grid .rw-person").length;
      out.family = !!q("#rewards-family .rw-fam") && /Pizza and film night/.test(q("#rewards-family").textContent);
      out.setGoalAlex = /What's Alex saving for\?/.test(q('[data-person="Alex"]').textContent);
      out.joPhoto = (q('[data-person="Jo"] .rw-card-banner') || {}).getAttribute?.("style") || "";
      out.joBuddy = !!q('[data-person="Jo"] .rw-face.is-buddy svg');
      out.lastWords = /last/i.test(q("#rewards-leaderboard").textContent);
      // Jo does a job: Jo leads, with the crown
      const t1 = window.currentTasks.find(t => t.id === "t1");
      const was = !!(t1.completedDays || {})[dayName];
      const joBefore = (window.computeMemberScores()["Jo"] || {}).score || 0;
      if (!was) window.handleCompleteTaskWithCelebration("t1", dayName, null, today);
      await new Promise(res => setTimeout(res, 500));
      if (window.TickCheer) window.TickCheer.close(true);
      if (window.Buddies) window.Buddies.close();
      window.renderPodiumRewards();
      const scores = window.computeMemberScores();
      const top = Math.max(...window.familyMembers.map(m => (scores[m] || {}).score || 0));
      out.top = window.familyMembers.filter(m => ((scores[m] || {}).score || 0) === top);
      out.joUp = ((scores["Jo"] || {}).score || 0) > joBefore || was;
      const first = q("#rewards-leaderboard .rw-lb-row");
      out.leader = first ? first.querySelector(".rw-lb-name").textContent : "";
      out.crown = !!(first && first.querySelector(".rw-lb-crown"));
      out.crowns = document.querySelectorAll("#rewards-leaderboard .rw-lb-crown").length;
      out.ring = (q('[data-person="Jo"] .rw-ring') || {}).getAttribute?.("aria-label") || "";
      const doc = window.__SMOKE_STORE[B] || {};
      out.stickers = doc.rewardStickers || null;
      out.wasTicked = was;
      return out;
    }, B);
    if (r.rows !== 4 || r.cards !== 4) throw new Error(`expected 4 stars rows and 4 person cards: ${JSON.stringify(r)}`);
    if (!r.family) throw new Error("the family goal bar isn't under the stars");
    if (!r.setGoalAlex) throw new Error("Alex has no goal but there's no \"What's Alex saving for?\"");
    if (!/images\/rewards\/film\.jpg/.test(r.joPhoto)) throw new Error(`Jo's Cinema trip has no film photo: ${r.joPhoto}`);
    if (!r.joBuddy) throw new Error("Jo's buddy isn't on Jo's card");
    if (r.lastWords) throw new Error("the stars say \"last\"");
    if (!r.joUp) throw new Error(`Jo's job didn't add to Jo's stars: ${JSON.stringify(r)}`);
    if (!r.top.includes(r.leader) || !r.crown || r.crowns !== r.top.length) throw new Error(`whoever has the most stars should be first, with a crown each for the top: ${JSON.stringify(r)}`);
    if (!/of \d+ today/.test(r.ring)) throw new Error(`Jo's ring doesn't show today's jobs: ${r.ring}`);
    if (!r.stickers || !r.stickers.jo || !r.stickers.jo.first || !r.stickers.sam || !r.stickers.sam.first) throw new Error(`first-job stickers weren't saved to the board: ${JSON.stringify(r.stickers)}`);
    if (r.stickers.alex) throw new Error("Alex got a sticker for nothing");
    // No Celebrate button; opening Rewards sets off confetti when anyone has points (not when all are zero)
    const cheer = await p.evaluate(async () => {
      const opened = async () => {
        window.switchSkylightView("calendar");
        await new Promise(res => setTimeout(res, 100));
        const before = window.__rewardsCelebrated || 0;
        window.switchSkylightView("rewards");
        await new Promise(res => setTimeout(res, 150));
        return (window.__rewardsCelebrated || 0) - before;
      };
      const anyone = Object.values(window.computeMemberScores()).some(m => m.score > 0);
      const withPoints = await opened();
      // Everyone on zero: borrow an empty week for a moment
      const real = window.computeMemberScores;
      window.computeMemberScores = () => Object.fromEntries((window.familyMembers || []).map(m => [m, { score: 0, tasks: [] }]));
      let atZero;
      try { atZero = await opened(); } finally { window.computeMemberScores = real; }
      window.renderPodiumRewards();
      return { button: !!document.getElementById("btn-podium-confetti"), anyone, withPoints, atZero };
    });
    if (cheer.button) throw new Error("the Celebrate button is still on Rewards");
    if (cheer.anyone && cheer.withPoints !== 1) throw new Error(`opening Rewards with points didn't set off the confetti: ${JSON.stringify(cheer)}`);
    if (cheer.atZero !== 0) throw new Error(`opening Rewards with everyone on zero set off confetti: ${JSON.stringify(cheer)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards.png`) });
    await p.evaluate(() => document.getElementById("rewards-people-grid").scrollIntoView({ block: "end" }));
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-cards.png`) });
    // Dark mode (the night-time look)
    await p.evaluate(() => document.body.classList.add("theme-dark"));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-dark.png`) });
    await p.evaluate(() => { document.body.classList.remove("theme-dark"); document.querySelector("#view-rewards .rewards-view-container").scrollIntoView({ block: "start" }); });
    // On the kitchen tablet the person cards start on the first screen
    const cardsTop = await p.evaluate(() => document.getElementById("rewards-people-grid").getBoundingClientRect().top);
    if (p.__size !== "phone" && cardsTop > p.viewportSize().height - 120) throw new Error(`the person cards start ${Math.round(cardsTop)}px down, too low to see on a ${p.viewportSize().height}px screen`);

    // Jo's panel: goals, six stickers (one earned), the week
    const panel = await p.evaluate(async () => {
      window.RewardsPage.openPerson("Jo");
      await new Promise(res => setTimeout(res, 450));
      const body = document.getElementById("reward-person-body");
      return {
        open: document.getElementById("reward-person-modal").open,
        goals: body.querySelectorAll(".rp-goal").length,
        stickers: body.querySelectorAll(".rp-sticker").length,
        earned: body.querySelectorAll(".rp-sticker.is-on").length,
        done: /Make your bed/.test(body.textContent)
      };
    });
    if (!panel.open || panel.goals !== 2 || panel.stickers !== 6 || panel.earned < 1 || !panel.done) throw new Error(`Jo's panel isn't right: ${JSON.stringify(panel)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-person.png`) });

    // The family goal panel: picked-for-you photo, change it, slider; saved
    const fam = await p.evaluate(async (B) => {
      document.getElementById("reward-person-modal").close();
      await new Promise(res => setTimeout(res, 350));
      window.RewardsPage.openFamilyGoal();
      await new Promise(res => setTimeout(res, 350));
      const name = document.getElementById("family-goal-name");
      name.value = "Trip to the zoo";
      name.dispatchEvent(new Event("input"));
      const preview = (document.querySelector("#family-goal-photo .rw-pc-preview") || {}).getAttribute?.("style") || "";
      const tag = (document.querySelector("#family-goal-photo .rw-pc-tag") || {}).textContent || "";
      document.querySelector("#family-goal-photo [data-pc-toggle]").click();
      await new Promise(res => setTimeout(res, 100));
      const tiles = document.querySelectorAll("#family-goal-photo [data-pc-pick]").length;
      // Slider to 60
      const slider = document.querySelector("#family-goal-points [data-pts-slider]");
      slider.value = "60"; slider.dispatchEvent(new Event("input", { bubbles: true })); slider.dispatchEvent(new Event("change", { bubbles: true }));
      const shownValue = document.querySelector("#family-goal-points [data-pts-value]").textContent;
      document.getElementById("btn-save-family-goal").click();
      await new Promise(res => setTimeout(res, 450));
      const doc = window.__SMOKE_STORE[B] || {};
      const card = document.querySelector("#rewards-family .rw-fam");
      return { preview, tag, tiles, shownValue, saved: doc.familyGoal || null, shown: document.getElementById("rewards-family").textContent, segs: card ? card.querySelectorAll(".rw-fam-seg").length : -1, hero: card ? (card.querySelector(".rw-fam-hero").getAttribute("style") || "") : "" };
    }, B);
    if (!/dayout\.jpg/.test(fam.preview) || !/Picked for/.test(fam.tag)) throw new Error(`"Trip to the zoo" didn't pick the day out photo: ${JSON.stringify(fam)}`);
    if (fam.tiles < 20) throw new Error(`the photo choices should include your own photo, no photo and the stock photos: ${fam.tiles}`);
    if (fam.shownValue !== "60 pts") throw new Error(`the slider didn't show 60 pts: ${fam.shownValue}`);
    if (!fam.saved || fam.saved.title !== "Trip to the zoo" || fam.saved.target !== 60) throw new Error(`the family goal wasn't saved: ${JSON.stringify(fam.saved)}`);
    if (!/Trip to the zoo/.test(fam.shown) || !/dayout\.jpg/.test(fam.hero)) throw new Error(`the family goal card doesn't show the new goal with its photo: ${JSON.stringify(fam)}`);
    if (fam.segs < 1) throw new Error("the family goal bar has no one's colour in it");
    await p.evaluate(() => document.getElementById("rewards-family").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-family.png`) });

    // A person's goal panel: Night out, then no photo, then their own photo; the slider; saved
    await p.evaluate(async () => { window.openRewardGoalPanel(null, "Alex"); await new Promise(res => setTimeout(res, 400)); });
    // Ideas: Pocket money first, four then More ideas; buddies in the picker; a slim Add a photo row
    const ideas = await p.evaluate(async () => {
      const list = () => [...document.querySelectorAll("#reward-goal-ideas [data-idea]")].map(b => b.getAttribute("data-idea"));
      const first = list();
      const addRow = !!document.querySelector("#reward-goal-photo .rw-pc-add") && !document.querySelector("#reward-goal-photo .rw-pc-preview");
      const addHeight = Math.round((document.querySelector("#reward-goal-photo .rw-pc-add") || { getBoundingClientRect: () => ({ height: 999 }) }).getBoundingClientRect().height);
      const joBuddy = !!document.querySelector('#reward-goal-members [data-member="Jo"] .drawer-profile-avatar.is-buddy svg');
      const alexInitial = (document.querySelector('#reward-goal-members [data-member="Alex"] .drawer-profile-avatar') || {}).textContent?.trim();
      document.querySelector("#reward-goal-ideas [data-ideas-more]").click();
      const more = list().length;
      document.querySelector('#reward-goal-ideas [data-idea="New toy"]').click();
      await new Promise(res => setTimeout(res, 100));
      // Closed again, with New toy still showing
      const afterPick = list().length;
      const toyShown = list().includes("New toy");
      document.querySelector("#reward-goal-ideas [data-ideas-more]").click();
      const toyOnce = document.querySelector('#reward-goal-repeat [data-repeat="once"]').classList.contains("active");
      document.querySelector('#reward-goal-ideas [data-idea="Pocket money"]').click();
      await new Promise(res => setTimeout(res, 100));
      return {
        first, more, addRow, addHeight, joBuddy, alexInitial, toyOnce, afterPick, toyShown,
        name: document.getElementById("reward-goal-name").value,
        moneyAgain: document.querySelector('#reward-goal-repeat [data-repeat="again"]').classList.contains("active"),
        photo: (document.querySelector("#reward-goal-photo .rw-pc-preview") || {}).getAttribute?.("style") || "",
        pencil: !!document.querySelector("#reward-goal-photo .rw-pc-preview .rw-pc-edit"),
        on: [...document.querySelectorAll("#reward-goal-ideas .is-on")].map(b => b.getAttribute("data-idea"))
      };
    });
    const wantFirst = p.__size === "phone" ? "Pocket money,Cinema trip" : "Pocket money,Cinema trip,Screen time,Pizza night";
    if (ideas.first.join() !== wantFirst) throw new Error(`the first ideas aren't ${wantFirst}: ${ideas.first}`);
    if (ideas.afterPick !== ideas.first.length) throw new Error(`the ideas didn't close again after one was picked: ${ideas.afterPick}`);
    if (!ideas.toyShown) throw new Error("the idea picked isn't shown once the list closes");
    if (ideas.more < 12) throw new Error(`More ideas didn't show more: ${ideas.more}`);
    if (!ideas.addRow || ideas.addHeight > 80) throw new Error(`with no photo the panel doesn't show a slim Add a photo row (${ideas.addHeight}px)`);
    if (!ideas.joBuddy || ideas.alexInitial !== "A") throw new Error(`the picker doesn't show Jo's buddy (and Alex's initial): ${JSON.stringify(ideas)}`);
    if (!ideas.toyOnce || !ideas.moneyAgain) throw new Error(`ideas don't set After it's redeemed (New toy: Remove it; Pocket money: Start again): ${JSON.stringify(ideas)}`);
    if (ideas.name !== "Pocket money" || !/money\.jpg/.test(ideas.photo) || !ideas.pencil || ideas.on.join() !== "Pocket money") throw new Error(`Pocket money didn't fill in the name, its photo and pencil: ${JSON.stringify(ideas)}`);
    await p.evaluate(() => document.getElementById("reward-goal-title").scrollIntoView({ block: "start" }));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-goal-ideas.png`) });
    const gp = await p.evaluate(async () => {
      const name = document.getElementById("reward-goal-name");
      name.value = "Night out with friends";
      name.dispatchEvent(new Event("input"));
      const picked = (document.querySelector("#reward-goal-photo .rw-pc-preview") || {}).getAttribute?.("style") || "";
      const iconRow = !!document.getElementById("reward-goal-emojis");
      document.querySelector("#reward-goal-photo [data-pc-toggle]").click();
      await new Promise(res => setTimeout(res, 100));
      document.querySelector('#reward-goal-photo [data-pc-pick="none"]').click();
      await new Promise(res => setTimeout(res, 100));
      const none = !!document.querySelector("#reward-goal-photo .rw-pc-add") && /No photo/.test(document.querySelector("#reward-goal-photo .rw-pc-add").textContent);
      document.querySelector('#reward-goal-points [data-pts-preset="100"]').click();
      const value = document.querySelector("#reward-goal-points [data-pts-value]").textContent;
      // New goals start again after they're redeemed, unless "Remove it" is chosen
      const againFirst = document.querySelector('#reward-goal-repeat [data-repeat="again"]').classList.contains("active");
      document.querySelector('#reward-goal-repeat [data-repeat="once"]').click();
      const onceOn = document.querySelector('#reward-goal-repeat [data-repeat="once"]').classList.contains("active") && /one-off/.test(document.getElementById("reward-goal-repeat-hint").textContent);
      return { picked, iconRow, none, value, againFirst, onceOn };
    });
    if (!/nightout\.jpg/.test(gp.picked)) throw new Error(`"Night out" didn't pick the night out photo: ${gp.picked}`);
    if (gp.iconRow) throw new Error("the goal panel still has the Icon row");
    if (!gp.none) throw new Error("No photo doesn't show the slim No photo row");
    if (gp.value !== "100 pts") throw new Error(`the 100 shortcut didn't set the points: ${gp.value}`);
    await p.evaluate(() => document.getElementById("reward-goal-repeat").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-goal-repeat.png`) });
    if (!gp.againFirst || !gp.onceOn) throw new Error(`"After it's redeemed" didn't start on Start again or didn't switch to Remove it: ${JSON.stringify(gp)}`);
    await p.evaluate(() => document.querySelector("#reward-goal-photo").scrollIntoView({ block: "start" }));
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-goal-panel.png`) });
    // Your own photo, chosen like a real file
    await p.evaluate(() => { document.querySelector("#reward-goal-photo [data-pc-toggle]").click(); });
    await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector("#reward-goal-photo .rw-pc-row").scrollIntoView({ block: "center" }));
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-photo-choices.png`) });
    const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
    const pngOwn = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    void jpeg;
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click('#reward-goal-photo [data-pc-pick="own"]')]);
    await chooser.setFiles({ name: "night-out.png", mimeType: "image/png", buffer: pngOwn });
    await p.waitForTimeout(700);
    const own = await p.evaluate(() => (document.querySelector("#reward-goal-photo .rw-pc-preview") || {}).getAttribute?.("style") || "");
    if (!/data:image\/jpeg/.test(own)) throw new Error(`your own photo didn't show in the preview: ${own.slice(0, 80)}`);
    await p.evaluate(async () => { document.getElementById("btn-save-reward-goal").click(); await new Promise(res => setTimeout(res, 600)); });
    const savedGoal = await p.evaluate((B) => {
      const g = (window.rewardGoals || []).find(x => x.member === "Alex" && /Night out/.test(x.title));
      const photoDoc = g ? window.__SMOKE_STORE[`${B}/recipePhotos/goal-${g.id}`] : null;
      const banner = document.querySelector('[data-person="Alex"] .rw-card-banner');
      return { g, photoSaved: !!(photoDoc && /^data:image\/jpeg/.test(photoDoc.data || "")), banner: banner ? (banner.getAttribute("style") || "") : "", bannerText: banner ? banner.textContent : "" };
    }, B);
    if (!savedGoal.g || savedGoal.g.once !== true) throw new Error(`Alex's goal wasn't saved as a one-off: ${JSON.stringify(savedGoal.g)}`);
    if (!savedGoal.g || savedGoal.g.cost !== 100 || savedGoal.g.photo !== "own" || !savedGoal.g.photoRev) throw new Error(`Alex's goal wasn't saved with their own photo: ${JSON.stringify(savedGoal.g)}`);
    if (!savedGoal.photoSaved) throw new Error("the goal's own photo wasn't saved on the board");
    if (!/data:image\/jpeg/.test(savedGoal.banner) || !/Night out/.test(savedGoal.bannerText)) throw new Error(`Alex's card doesn't lead with the goal's photo: ${savedGoal.bannerText}`);
    await p.evaluate(() => document.querySelector('[data-person="Alex"]').scrollIntoView({ block: "center" }));
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-cards-new.png`) });
    // Tidy up
    await p.evaluate(() => { window.rewardGoals = (window.rewardGoals || []).filter(x => !(x.member === "Alex" && /Night out/.test(x.title))); window.renderRewardGoals(); });

    // Redeeming (as Skylight): a one-off leaves the card, one that starts again stays
    // with "last redeemed today", and both spend the points. Screenshots of each step.
    await p.evaluate(async () => {
      window.__rdKeep = { goals: window.rewardGoals, red: window.rewardRedemptions, weeks: window.rewardWeeks };
      // Saved to the (fake) board, so the board's copy doesn't put the old ones back
      window.rewardWeeks = { ...(window.rewardWeeks || {}), "2020-W01": { Alex: 120 } };
      window.rewardGoals = [...(window.rewardGoals || []).filter(g => g.member !== "Alex"),
        { id: "t-again", member: "Alex", title: "£5 pocket money", cost: 50, photo: "none" },
        { id: "t-once", member: "Alex", title: "New Lego set", cost: 60, once: true }];
      window.saveRewardDataToBoard({ rewardGoals: window.rewardGoals, rewardWeeks: { "2020-W01": { Alex: 120 } } });
      window.renderRewardGoals();
      await new Promise(res => setTimeout(res, 300));
      document.querySelector('[data-person="Alex"]').scrollIntoView({ block: "center" });
    });
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-flow-1-ready.png`) });
    await p.evaluate(async () => { window.RewardsPage.openPerson("Alex"); await new Promise(res => setTimeout(res, 400)); });
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-flow-2-panel.png`) });
    await p.evaluate(async () => { window.redeemRewardGoal("t-once"); window.redeemRewardGoal("t-again"); await new Promise(res => setTimeout(res, 400)); });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-flow-3-after.png`) });
    const rd = await p.evaluate(async () => {
      const ids = window.rewardGoals.filter(g => g.member === "Alex").map(g => g.id);
      const spent = (window.rewardRedemptions || []).filter(r => /^t-/.test(r.goalId)).reduce((n, r) => n + r.cost, 0);
      const panel = (document.getElementById("reward-person-body") || {}).textContent || "";
      const dlg = document.getElementById("reward-person-modal"); if (dlg && dlg.open) dlg.close();
      window.renderRewardGoals();
      await new Promise(res => setTimeout(res, 300));
      document.querySelector('[data-person="Alex"]').scrollIntoView({ block: "center" });
      return { ids, spent, panel: /pocket money[\s\S]*last redeemed today/.test(panel) };
    });
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-flow-4-card.png`) });
    await p.evaluate(() => { const k = window.__rdKeep; window.rewardGoals = k.goals; window.rewardRedemptions = k.red; window.rewardWeeks = { ...k.weeks, "2020-W01": {} };
      window.saveRewardDataToBoard({ rewardGoals: k.goals, rewardRedemptions: k.red, rewardWeeks: { "2020-W01": {} } }); window.renderRewardGoals(); });
    if (rd.ids.includes("t-once") || !rd.ids.includes("t-again")) throw new Error(`redeeming didn't remove the one-off and keep the other: ${rd.ids}`);
    if (rd.spent !== 110) throw new Error(`redeeming didn't spend the points: ${rd.spent}`);
    if (!rd.panel) throw new Error("Alex's panel doesn't say when the pocket money was last redeemed");

    // The Rewards intro shows the new page (stars and a family goal, not a podium)
    const intro = await p.evaluate(async () => {
      window.showPageIntro("rewards");
      await new Promise(res => setTimeout(res, 300));
      return { stars: document.querySelectorAll(".intro-star-row").length, podium: !!document.querySelector(".intro-podium"), family: !!document.querySelector(".intro-family") };
    });
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-rewards-intro.png`) });
    await p.evaluate(() => { const b = document.querySelector("[data-intro-skip]"); if (b) b.click(); });
    if (!intro.stars || intro.podium || !intro.family) throw new Error(`the Rewards intro still shows the old page: ${JSON.stringify(intro)}`);

    // Put things back for the other steps
    await p.evaluate(async (was) => {
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      if (!was) await window.handleUndoTask("t1", dayName, window.getLocalDateKey(new Date()));
      window.boardSettings.memberBuddies = {};
    }, r.wasTicked);
  }],
  // Calendar: Today comes back to today, and Filter turns a person off (both
  // used to change private copies in app.js the calendar never read)
  ["calendar-today-filter", async (p) => {
    await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.switchSkylightView("calendar"); window.setCalendarView("week", new Date()); });
    await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const wait = (ms) => new Promise(res => setTimeout(res, ms));
      const anchorKey = () => window.getLocalDateKey(window.calendarAnchorDate);
      const today = window.getLocalDateKey(new Date());
      document.getElementById("btn-calendar-next-week").click(); await wait(150);
      document.getElementById("btn-calendar-next-week").click(); await wait(150);
      const moved = anchorKey();
      document.getElementById("btn-calendar-today").click(); await wait(250);
      const back = anchorKey();
      // Jo's face off: Jo's Swimming (today) leaves the calendar, then back on
      const grid = () => document.getElementById("calendar-week-grid").textContent;
      const hadSwim = /Swimming/.test(grid());
      const face = document.querySelector('#cal-people [data-cal-face="Jo"]');
      if (face) face.click();
      await wait(250);
      const faceAfter = document.querySelector('#cal-people [data-cal-face="Jo"]');
      const off = faceAfter && !faceAfter.classList.contains("is-on");
      const swimGone = !/Swimming/.test(grid());
      if (faceAfter) faceAfter.click();
      await wait(250);
      const backOn = !!document.querySelector('#cal-people [data-cal-face="Jo"].is-on') && /Swimming/.test(grid());
      return { today, moved, back, face: !!face, off, hadSwim, swimGone, backOn };
    });
    if (r.moved === r.today) throw new Error("the calendar's next button didn't move on");
    if (r.back !== r.today) throw new Error(`Today didn't come back to today: ${JSON.stringify(r)}`);
    if (!r.face || !r.off || !r.hadSwim || !r.swimGone || !r.backOn) throw new Error(`Jo's face didn't hide and show Jo's events: ${JSON.stringify(r)}`);
  }],
  // A busy day: three people with things at the same time, overlaps,
  // back-to-back events, two all-day events and a shared event. Every view
  // must show all of it, and timeline cards must not sit on top of each other.
  ["calendar-busy", async (p) => {
    const added = await p.evaluate(() => {
      const t = window.getLocalDateKey(new Date());
      const tm = new Date(); tm.setDate(tm.getDate() + 1);
      const tomorrow = window.getLocalDateKey(tm);
      const extra = [
        { id: "bz1", title: "Football training", date: t, time: "16:30", duration: "1 hour", repeat: "none", member: "Max", icon: "⚽" },
        { id: "bz2", title: "Orthodontist", date: t, time: "16:30", duration: "30 mins", repeat: "none", member: "Sam", icon: "🦷" },
        { id: "bz3", title: "Work call", date: t, time: "16:00", duration: "1 hour", repeat: "none", member: "Alex", icon: "💻" },
        { id: "bz4", title: "Pick up from swimming", date: t, time: "17:30", duration: "15 mins", repeat: "none", member: "Sam, Alex", icon: "🚗" },
        { id: "bz5", title: "Bin day", date: t, time: "", duration: "All day", repeat: "none", member: "Family", icon: "🗑️" },
        { id: "bz6", title: "Jo's school play", date: t, time: "", duration: "All day", repeat: "none", member: "Jo", icon: "🎭" },
        { id: "bz7", title: "Breakfast club", date: t, time: "07:45", duration: "45 mins", repeat: "none", member: "Jo", icon: "🥣" },
        { id: "bz8", title: "Gym", date: t, time: "07:30", duration: "1 hour", repeat: "none", member: "Alex", icon: "🏋️" },
        { id: "bz9", title: "Parents' WhatsApp call", date: t, time: "20:00", duration: "30 mins", repeat: "none", member: "Sam", icon: "📞" },
        { id: "bz10", title: "Brownies", date: tomorrow, time: "18:00", duration: "1 hour", repeat: "none", member: "Jo", icon: "🎒" },
        { id: "bz11", title: "Cubs", date: tomorrow, time: "18:00", duration: "1 hour", repeat: "none", member: "Max", icon: "🏕️" },
        { id: "bz12", title: "Book club", date: tomorrow, time: "18:00", duration: "2 hours", repeat: "none", member: "Alex", icon: "📚" }
      ];
      (window.familyEvents || []).push(...extra);
      return extra.map(e => e.id);
    });
    const problems = [];
    for (const view of ["day", "schedule", "week", "month"]) {
      await p.evaluate((v) => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.switchSkylightView("calendar"); window.setCalendarView(v, new Date()); }, view);
      await p.waitForTimeout(400);
      // Scroll the timeline to the busy afternoon for the screenshot
      await p.evaluate(() => { const b = document.getElementById("skylight-trad-body-scroll"); if (b) { const d = JSON.parse(document.getElementById("calendar-week-grid").dataset.timeline || "{}"); if (d.hourHeight) b.scrollTop = (15.5 - d.startHour) * d.hourHeight; } });
      await p.waitForTimeout(150);
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-busy-${view}.png`) });
      const r = await p.evaluate(() => {
        const g = document.getElementById("calendar-week-grid");
        const t = window.getLocalDateKey(new Date());
        const text = g.textContent;
        const want = ["Football training", "Orthodontist", "Work call", "Swimming", "Pick up from swimming", "Bin day", "school play", "Breakfast club", "Gym"];
        const missing = want.filter(w => !text.includes(w));
        // Timeline cards on the same day: do any two overlap on screen?
        const overlaps = [];
        document.querySelectorAll(".skylight-time-col").forEach(col => {
          const blocks = [...col.querySelectorAll(".skylight-timed-event-block")].map(b => ({ name: (b.textContent || "").trim().slice(0, 24), r: b.getBoundingClientRect() })).filter(b => b.r.width > 0);
          for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
            const a = blocks[i].r, b = blocks[j].r;
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (x > 2 && y > 2) overlaps.push(`${blocks[i].name} / ${blocks[j].name}`);
          }
        });
        // Narrowest timeline card (too thin to read?)
        const widths = [...document.querySelectorAll(".skylight-timed-event-block")].map(b => b.getBoundingClientRect().width).filter(w => w > 0);
        const monthCell = document.querySelector(`.calendar-month-cell[data-date-str="${t}"]`);
        return { missing, overlaps, narrowest: widths.length ? Math.round(Math.min(...widths)) : null, timeline: !!document.querySelector(".skylight-time-col"), more: monthCell ? (monthCell.classList.contains("is-dots") ? (monthCell.querySelector(".month-more-badge") || {}).textContent : ((monthCell.querySelector(".month-more-badge:not([hidden])") || {}).textContent || "").replace(/\D/g, "") || "0") : null };
      });
      // Month cells can't list everything: they say "+N more" instead
      if (view !== "month" && r.missing.length) problems.push(`${view}: missing ${r.missing.join(", ")}`);
      if (view === "month" && r.more !== null && Number(r.more) < 1) problems.push(`month: today's cell hides events without "+N more"`);
      if (r.overlaps.length) problems.push(`${view}: cards on top of each other: ${r.overlaps.slice(0, 4).join("; ")}`);
      console.log(`      [${p.__size} busy ${view}] narrowest timeline card ${r.narrowest ?? "-"}px${r.missing.length ? `, not shown: ${r.missing.length}` : ""}${r.more !== null ? `, month "+${r.more} more"` : ""}`);
    }
    await p.evaluate((ids) => {
      const list = window.familyEvents || [];
      for (let i = list.length - 1; i >= 0; i--) if (ids.includes(list[i].id)) list.splice(i, 1);
      window.setCalendarView("schedule", new Date());
    }, added);
    if (problems.length) throw new Error(problems.join("; "));
  }],
  // Google Calendar, read-only (11 Nov): Settings → Calendars, the guide
  // (wrong address explained, right one accepted), events shown with a G and
  // read-only, ↻ in the bar, never saved into the board's own events, unlink.
  // The server is stood in for: it "reads" the calendar and saves two events.
  ["google-calendar", async (p) => {
    const B = "boards/sidepanel-test-x7q2";
    await p.evaluate(() => {
      document.querySelectorAll("dialog[open]").forEach(d => d.close());
      window.switchSkylightView("calendar");
      window.setCalendarView("week", new Date());
      window.__SMOKE_CAL_REFRESH = async (board, why) => {
        const linksSnap = window.__SMOKE_STORE[`boards/${board}/private/calendarLinks`] || {};
        const links = linksSnap.links || {};
        const results = [];
        const today = window.getLocalDateKey(new Date());
        const t = new Date(); t.setDate(t.getDate() + 1);
        const tomorrow = window.getLocalDateKey(t);
        // A slow first read (a big calendar): the server answers before the events are in
        if (why === "added" && window.__SMOKE_CAL_SLOW) {
          window.__SMOKE_CAL_SLOW = false;
          setTimeout(() => window.__SMOKE_CAL_REFRESH(board, "slow-finish"), 1500);
          window.__SMOKE_CAL_CALLS = (window.__SMOKE_CAL_CALLS || []).concat(why);
          return { ok: true, tooSoon: true };
        }
        for (const [key, link] of Object.entries(links)) {
          const events = [
            { id: `g-${key}-1`, title: "Optician", date: today, time: "15:00", duration: "30 mins", member: link.member, icon: "📅", repeat: "none", source: "google", readOnly: true },
            { id: `g-${key}-2`, title: "Work away day", date: tomorrow, time: "", duration: "All day", member: link.member, icon: "📅", repeat: "none", source: "google", readOnly: true }
          ];
          await window.setDoc(window.doc(window.db, "boards", board, "externalEvents", key), { member: link.member, ok: true, problem: null, events, count: events.length, kind: "google", checkedAt: new Date().toISOString() });
          results.push({ member: link.member, ok: true, count: events.length });
        }
        // Unlinked people's events go
        Object.keys(window.__SMOKE_STORE).filter(k => k.startsWith(`boards/${board}/externalEvents/`)).forEach(k => {
          const key = k.split("/").pop();
          if (!links[key]) { delete window.__SMOKE_STORE[k]; }
        });
        window.__SMOKE_CAL_CALLS = (window.__SMOKE_CAL_CALLS || []).concat(why);
        return { ok: true, results };
      };
      if (window.GoogleCalendar) window.GoogleCalendar.start();
    });
    await p.waitForTimeout(400);
    const before = await p.evaluate((B) => ({ barRefresh: !!document.getElementById("cal-refresh"), boardEvents: ((window.__SMOKE_STORE[B] || {}).events || []).length }), B);
    if (before.barRefresh) throw new Error("the calendar bar still has a ↻ button (it moved to Settings → Calendars)");

    // Settings → Calendars
    await p.evaluate(() => window.openSettingsModal("calendars"));
    await p.waitForTimeout(800);
    const row = await p.evaluate(() => {
      const b = document.querySelector('#gcal-settings [data-gcal-connect="Sam"]');
      const r = b && b.closest(".gcal-row");
      return { label: b ? b.getAttribute("aria-label") : "", height: r ? Math.round(r.getBoundingClientRect().height) : 0 };
    });
    if (row.label !== "Link Sam's calendar") throw new Error(`Settings → Calendars has no "Link Sam's calendar": ${JSON.stringify(row)}`);
    if (row.height > 72) throw new Error(`each person's row is too tall (${row.height}px) for what it says`);
    await p.evaluate(() => document.getElementById("settings-sec-calendars").scrollIntoView());
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-settings.png`) });

    // The guide, walked through as someone would on this device
    const touch = p.__size !== "laptop";
    await p.evaluate((t) => { window.__SMOKE_DEVICE = t ? "touch" : "mouse"; }, touch);
    await p.click('#gcal-settings [data-gcal-connect="Sam"]');
    await p.waitForTimeout(600);
    // Phones and tablets: Google keeps opening its app, so this is done on a computer
    if (touch) {
      const comp = await p.evaluate(() => {
        const b = document.querySelector("#gcal-guide [data-gcal-body]");
        const mail = (b.querySelector("[data-gcal-email]") || {}).getAttribute?.("href") || "";
        return { heading: (b.querySelector("h3") || {}).textContent || "", mail: decodeURIComponent(mail), steps: b.querySelectorAll(".gcal-step").length };
      });
      if (!/needs a computer/.test(comp.heading) || comp.steps) throw new Error(`a phone or tablet didn't get the "needs a computer" screen: ${JSON.stringify(comp)}`);
      if (!/^mailto:/.test(comp.mail) || !/#link-calendar\/Sam/.test(comp.mail)) throw new Error(`"Email me the link" doesn't carry the link to Sam's guide: ${comp.mail.slice(0, 160)}`);
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-needs-computer.png`) });
      await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
      await p.click("#gcal-guide [data-gcal-copy-link]");
      await p.waitForTimeout(200);
      const copied = await p.evaluate(async () => ({ note: document.querySelector("#gcal-guide [data-gcal-copied]").textContent, clip: await navigator.clipboard.readText().catch(() => "") }));
      if (!/Copied/.test(copied.note) && !/#link-calendar/.test(copied.note)) throw new Error(`"Copy the link" didn't copy or show the link: ${copied.note}`);
      await p.click("#gcal-guide [data-gcal-anyway]");
      await p.waitForTimeout(300);
    }
    // Nothing spills sideways, buttons are big enough to tap, nothing cut off
    const layout = async () => p.evaluate(() => {
      const dlg = document.getElementById("gcal-guide");
      const panel = dlg.querySelector(".modal-content");
      const wide = panel.scrollWidth > panel.clientWidth + 1;
      const small = [...dlg.querySelectorAll("button, a.gcal-btn")].filter(b => b.offsetParent && !b.classList.contains("side-panel-hidden-close") && b.getBoundingClientRect().height < 36).map(b => b.textContent.trim().slice(0, 20));
      const clipped = [...dlg.querySelectorAll(".gcal-step-words > strong, .gcal-step-words p, .gcal-safe span, .gcal-intro")].filter(el => el.offsetParent && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim().slice(0, 30));
      return { wide, small, clipped };
    });
    const l1 = await layout();
    if (l1.wide || l1.small.length || l1.clipped.length) throw new Error(`the guide doesn't fit this screen: ${JSON.stringify(l1)}`);
    const first = await p.evaluate(() => ({
      steps: document.querySelectorAll("#gcal-guide .gcal-step").length,
      next: (document.querySelector("#gcal-guide .gcal-step.is-next") || {}).getAttribute?.("data-gcal-step"),
      safe: /Safe and private/.test(document.querySelector("#gcal-guide .gcal-safe").textContent),
      words: document.querySelector("#gcal-guide [data-gcal-body]").innerText.split(/\s+/).length
    }));
    if (first.steps !== 5 || first.next !== "0" || !first.safe) throw new Error(`the guide didn't open on step 1 with the safety note: ${JSON.stringify(first)}`);
    if (first.words > 190) throw new Error(`the guide is too wordy: ${first.words} words`);
    const reassure = await p.evaluate(() => (document.querySelector('#gcal-guide [data-gcal-step="3"] .gcal-reassure') || {}).textContent || "");
    if (!/not to share/.test(reassure) || !/locked away/.test(reassure)) throw new Error(`step 4 doesn't explain Google's warning: ${reassure}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-guide.png`) });
    // Step 1: "Open Google Calendar" opens a new tab and ticks itself
    const [popup] = await Promise.all([
      p.context().waitForEvent("page", { timeout: 5000 }).catch(() => null),
      p.click("#gcal-guide [data-gcal-open]")
    ]);
    if (popup) await popup.close().catch(() => {});
    await p.waitForTimeout(500);
    const afterOpen = await p.evaluate(() => ({ done0: document.querySelector('#gcal-guide [data-gcal-step="0"]').classList.contains("is-done"), next: (document.querySelector("#gcal-guide .gcal-step.is-next") || {}).getAttribute?.("data-gcal-step") }));
    if (!afterOpen.done0 || afterOpen.next !== "1") throw new Error(`opening Google didn't tick step 1: ${JSON.stringify(afterOpen)}`);
    // Ticking steps 2–4 by hand
    for (const i of [1, 2, 3]) { await p.click(`#gcal-guide [data-gcal-tick="${i}"]`); await p.waitForTimeout(120); }
    const ticks = await p.evaluate(() => [...document.querySelectorAll("#gcal-guide .gcal-step")].map(s => s.classList.contains("is-done")));
    if (JSON.stringify(ticks) !== JSON.stringify([true, true, true, true, false])) throw new Error(`ticking steps went wrong: ${JSON.stringify(ticks)}`);
    await p.evaluate(() => document.querySelector('#gcal-guide [data-gcal-step="4"]').scrollIntoView({ block: "center" }));
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-guide-paste.png`) });
    // The wrong address, pasted by hand: explained, nothing saved
    const wrong = await p.evaluate(() => {
      const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
      box.value = "https://calendar.google.com/calendar/ical/sam%40gmail.com/public/basic.ics";
      box.dispatchEvent(new Event("input", { bubbles: true }));
      return document.querySelector("#gcal-guide [data-gcal-check]").textContent;
    });
    if (!/Public/.test(wrong) || !/Secret/.test(wrong)) throw new Error(`pasting the public address didn't explain it: ${wrong}`);
    const reopened = await p.evaluate(() => ({ step4: document.querySelector('#gcal-guide [data-gcal-step="3"]').classList.contains("is-next"), kept: document.querySelector("#gcal-guide [data-gcal-paste-box]").value }));
    if (!reopened.step4 || !/public/.test(reopened.kept)) throw new Error(`the wrong address didn't take them back to step 4: ${JSON.stringify(reopened)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-guide-wrong.png`) });
    // A slow first read on some sizes: the guide must say it's bringing them in
    const slow = p.__size === "phone" || p.__size === "laptop";
    await p.evaluate((sl) => { window.__SMOKE_CAL_SLOW = sl; }, slow);
    // The right one, with 📋 Paste: it links by itself
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await p.evaluate(() => navigator.clipboard.writeText("https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics").catch(() => {}));
    await p.click("#gcal-guide [data-gcal-paste]");
    await p.waitForTimeout(300);
    // If this browser won't hand over the clipboard, paste by hand as the guide says
    const viaButton = await p.evaluate(() => !!document.querySelector("#gcal-guide .gcal-done, #gcal-guide .gcal-spinner"));
    console.log(`      [${p.__size} google guide] pasted with ${viaButton ? "the 📋 Paste button" : "press-and-hold (the browser kept the clipboard)"}`);
    if (!viaButton) {
      await p.evaluate(() => {
        const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
        box.value = "Here it is: https://calendar.google.com/calendar/ical/sam%40gmail.com/private-0123456789abcdef/basic.ics";
        box.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    if (slow) {
      await p.waitForTimeout(500);
      const waiting = await p.evaluate(() => ({
        guide: (document.querySelector("#gcal-guide [data-gcal-body]") || {}).textContent || "",
        bar: (document.querySelector("#gcal-check-line [data-gcal-when]") || {}).textContent || ""
      }));
      if (!/Bringing in Sam's events/.test(waiting.guide) || !/minute or two/.test(waiting.guide)) throw new Error(`a slow first read didn't say it's bringing the events in: ${waiting.guide.slice(0, 160)}`);
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-guide-waiting.png`) });
      await p.waitForTimeout(1800); // the events arrive
    }
    await p.waitForTimeout(900);
    const done = await p.evaluate((B) => ({
      text: (document.querySelector("#gcal-guide [data-gcal-body]") || {}).textContent || "",
      saved: ((window.__SMOKE_STORE[`${B}/private/calendarLinks`] || {}).links || {}).sam || null
    }), B);
    if (!/All set/.test(done.text) || !/2 events/.test(done.text)) throw new Error(`pasting the right address didn't link it: ${done.text.slice(0, 160)}`);
    if (!done.saved || !/private-0123456789abcdef/.test(done.saved.url) || /Here it is/.test(done.saved.url)) throw new Error(`the link wasn't saved cleanly: ${JSON.stringify(done.saved)}`);
    const l2 = await layout();
    if (l2.wide || l2.small.length) throw new Error(`the finished screen doesn't fit: ${JSON.stringify(l2)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-guide-done.png`) });
    await p.evaluate(() => { document.querySelector("#gcal-guide [data-gcal-finish]").click(); });
    await p.waitForTimeout(400);
    const status = await p.evaluate(() => (document.getElementById("gcal-settings") || {}).textContent || "");
    if (!/Linked · 2 events/.test(status)) throw new Error(`Settings doesn't show Sam as linked: ${status.slice(0, 160)}`);
    const check = await p.evaluate(async () => {
      const line = document.getElementById("gcal-check-line");
      const words = line.querySelector("[data-gcal-when]").textContent;
      window.__SMOKE_CAL_CALLS = [];
      // Check now (a minute's wait between checks is skipped here for the test)
      line.querySelector("[data-gcal-check-now]").click();
      await new Promise(res => setTimeout(res, 300));
      return { shown: !line.hidden, words, calls: window.__SMOKE_CAL_CALLS.length };
    });
    if (!check.shown || !/Checked/.test(check.words)) throw new Error(`Settings doesn't say when Google was last checked: ${JSON.stringify(check)}`);
    await p.evaluate(() => document.getElementById("settings-sec-calendars").scrollIntoView());
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-settings-linked.png`) });
    await p.evaluate(() => document.getElementById("settings-modal").close());
    await p.waitForTimeout(500);
    // The link from "Email me the link", opened on a computer: Settings and Alex's guide
    if (p.__size === "laptop") {
      const opened = await p.evaluate(async () => {
        window.__SMOKE_DEVICE = "mouse";
        history.replaceState(null, "", location.pathname + location.search + "#link-calendar/Alex");
        window.GoogleCalendar.fromAddress();
        await new Promise(res => setTimeout(res, 2400));
        const g = document.getElementById("gcal-guide");
        const r = { settings: document.getElementById("settings-modal").open, guide: !!(g && g.open), title: g ? g.querySelector("#gcal-guide-title").textContent : "", steps: g ? g.querySelectorAll(".gcal-step").length : 0, hash: location.hash };
        if (g && g.open) g.close();
        await new Promise(res => setTimeout(res, 400));
        document.getElementById("settings-modal").close();
        return r;
      });
      if (!opened.settings || !opened.guide || opened.title !== "Link Alex's calendar" || opened.steps !== 5) throw new Error(`the emailed link didn't open Alex's guide: ${JSON.stringify(opened)}`);
      if (/link-calendar/.test(opened.hash)) throw new Error("the link stayed in the address bar");
      await p.waitForTimeout(400);
    }

    // On the calendar: with a G, ↻ showing, read-only, not saved into the board
    await p.evaluate(() => { window.switchSkylightView("calendar"); window.setCalendarView("week", new Date()); });
    await p.waitForTimeout(400);
    const cal = await p.evaluate((B) => {
      const g = document.getElementById("calendar-week-grid");
      const card = [...g.querySelectorAll("[data-event-id]")].find(c => /Optician/.test(c.textContent));
      return {
        shown: !!card, hasG: !!(card && card.querySelector(".ev-g")),
        familyHasGoogle: (window.familyEvents || []).some(e => e.source === "google"),
        boardEvents: ((window.__SMOKE_STORE[B] || {}).events || []).length
      };
    }, B);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-calendar.png`) });
    if (!cal.shown || !cal.hasG) throw new Error(`Sam's Google event isn't on the calendar with a G: ${JSON.stringify(cal)}`);
    if (cal.familyHasGoogle || cal.boardEvents !== before.boardEvents) throw new Error(`Google events got into the board's own events: ${JSON.stringify(cal)}`);
    const pop = await p.evaluate(async () => {
      const card = [...document.querySelectorAll("#calendar-week-grid [data-event-id]")].find(c => /Optician/.test(c.textContent));
      card.click();
      await new Promise(res => setTimeout(res, 300));
      const r = { edit: getComputedStyle(document.getElementById("btn-event-pop-edit")).display, del: getComputedStyle(document.getElementById("btn-event-pop-delete")).display, note: document.getElementById("event-pop-notes").textContent };
      document.getElementById("btn-event-pop-close").click();
      return r;
    });
    if (pop.edit !== "none" || pop.del !== "none" || !/Google Calendar/.test(pop.note)) throw new Error(`a Google event can be edited or deleted here: ${JSON.stringify(pop)}`);
    // ↻ asks the server
    const calls = await p.evaluate(async () => { window.__SMOKE_CAL_CALLS = []; await new Promise(res => setTimeout(res, 50)); return window.__SMOKE_CAL_CALLS.length; });
    // Unlink
    await p.evaluate(() => window.openSettingsModal("calendars"));
    await p.waitForTimeout(700);
    const ask = await p.evaluate(async () => {
      document.querySelector('#gcal-settings [data-gcal-remove="Sam"]').click();
      await new Promise(res => setTimeout(res, 300));
      const m = document.getElementById("delete-modal");
      return { open: !!(m && (m.open || m.style.display === "flex")), title: document.getElementById("delete-modal-title").textContent, warning: document.getElementById("delete-modal-warning").textContent, button: document.getElementById("btn-confirm-delete").textContent };
    });
    if (!ask.open || !/Unlink Sam's calendar/.test(ask.title) || !/disappear from harmonee/.test(ask.warning) || !/Nothing changes in Google/.test(ask.warning)) throw new Error(`Unlink didn't ask properly: ${JSON.stringify(ask)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-gcal-unlink-ask.png`) });
    await p.evaluate(async () => {
      document.getElementById("btn-confirm-delete").click();
      await new Promise(res => setTimeout(res, 500));
      document.getElementById("settings-modal").close();
    });
    await p.waitForTimeout(500);
    const after = await p.evaluate(() => ({
      events: (window.googleEvents || []).length,
      checkLine: !document.getElementById("gcal-check-line").hidden,
      link: ((window.__SMOKE_STORE["boards/sidepanel-test-x7q2/private/calendarLinks"] || {}).links || {}).sam || null
    }));
    if (after.events || after.checkLine || after.link) throw new Error(`unlinking left things behind: ${JSON.stringify(after)}`);
    await p.evaluate(() => { delete window.__SMOKE_CAL_REFRESH; window.setCalendarView("schedule", new Date()); });
    void calls;
  }],
  // Every Calendar view at this size, for design review (screenshots only)
  ["calendar-views", async (p) => {
    // A realistic day for the review: a few more events, taken out again after
    const added = await p.evaluate(() => {
      const k = (d) => window.getLocalDateKey(d);
      const t = new Date(); const plus = (n) => { const d = new Date(t); d.setDate(t.getDate() + n); return k(d); };
      const extra = [
        { id: "rv1", title: "School run", date: plus(0), time: "08:15", duration: "30 mins", repeat: "none", member: "Sam", icon: "🚗" },
        { id: "rv2", title: "Team meeting", date: plus(0), time: "10:00", duration: "1 hour", repeat: "none", member: "Alex", icon: "💼" },
        { id: "rv3", title: "Piano lesson", date: plus(1), time: "17:00", duration: "45 mins", repeat: "none", member: "Jo", icon: "🎹" },
        { id: "rv4", title: "Parents' evening", date: plus(2), time: "18:30", duration: "1 hour", repeat: "none", member: "Sam, Alex", icon: "🏫" },
        { id: "rv5", title: "Gran visiting", date: plus(5), time: "", duration: "All day", repeat: "none", member: "Family", icon: "👵" },
        { id: "rv6", title: "Birthday party", date: plus(9), time: "14:00", duration: "2 hours", repeat: "none", member: "Max", icon: "🎈" }
      ];
      (window.familyEvents || []).push(...extra);
      return extra.map(e => e.id);
    });
    const problems = [];
    for (const view of ["day", "schedule", "week", "month"]) {
      await p.evaluate((v) => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); window.switchSkylightView("calendar"); window.setCalendarView(v, new Date()); }, view);
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(SHOTS, `${p.__size}-calview-${view}.png`) });
      if (view === "week" || (view === "day" && p.__size === "phone")) {
        await p.evaluate(() => document.body.classList.add("theme-dark"));
        await p.waitForTimeout(150);
        await p.screenshot({ path: path.join(SHOTS, `${p.__size}-calview-${view}-dark.png`) });
        await p.evaluate(() => document.body.classList.remove("theme-dark"));
      }
      // The redesign (11 Nov): what each view must have at this size
      const r = await p.evaluate((v) => {
        const g = document.getElementById("calendar-week-grid");
        const order = (sel) => [...g.querySelectorAll(sel)].map(el => el.textContent).join(" | ");
        const inOrder = (text) => { const a = text.indexOf("School run"), b = text.indexOf("Team meeting"), c = text.indexOf("Swimming"); return a > -1 && b > a && c > b; };
        return {
          phone: window.matchMedia("(max-width: 600px)").matches,
          strip: g.querySelectorAll(".cv-strip .cv-strip-day").length,
          miniMonth: g.querySelectorAll(".mini-calendar-cell").length,
          cols: g.querySelectorAll(".cv-col").length,
          switchOn: (document.querySelector("#cal-view-switch .is-on") || {}).getAttribute?.("data-cal-view"),
          faces: document.querySelectorAll("#cal-people .cal-face").length,
          todayOrder: inOrder(order(`[data-date="${window.getLocalDateKey(new Date())}"] .skylight-card, [data-date="${window.getLocalDateKey(new Date())}"] .cv-card`)),
          monthOrder: inOrder(order(`.calendar-month-cell[data-date-str="${window.getLocalDateKey(new Date())}"] .month-mini-event`) || ""),
          title: (document.getElementById("cal-toolbar-title") || {}).textContent || ""
        };
      }, view);
      const tag = `${view}:`;
      if (r.faces !== 4) problems.push(`${tag} ${r.faces} faces in the bar`);
      if (!r.title) problems.push(`${tag} no month in the bar`);
      if (r.phone) {
        if (r.miniMonth) problems.push(`${tag} a month calendar on the phone`);
        if (view !== "month" && r.strip !== 7) problems.push(`${tag} no week strip`);
        if (view !== "month" && !r.todayOrder) problems.push(`${tag} today's events not in time order`);
      } else {
        if (view === "week" && r.cols !== 7) problems.push(`${tag} ${r.cols} week columns, not 7`);
        if (view === "week" && !r.todayOrder) problems.push(`${tag} today's column not in time order`);
        if (view === "day" && r.strip !== 7) problems.push(`${tag} no week strip above the day`);
        if (view === "month" && r.switchOn !== "month") problems.push(`${tag} Month not marked in the bar`);
      }
    }
    await p.evaluate((ids) => {
      const list = window.familyEvents || [];
      for (let i = list.length - 1; i >= 0; i--) if (ids.includes(list[i].id)) list.splice(i, 1);
      window.setCalendarView("schedule", new Date());
    }, added);
    if (problems.length) throw new Error(problems.join("; "));
  }],
  // Meals > Recipes tab: photos, your own recipes, collections, search, Snap
  ["recipes-tab", async (p) => {
    await p.evaluate(() => { window.closePlanMealDrawer && window.closePlanMealDrawer(); const c = document.getElementById("cooking-recipe-modal"); if (c && c.open) c.close(); });
    await p.evaluate(() => window.FamilyRecipes.save({ id: "family-smoke-flapjacks", title: "Nana's flapjacks", emoji: "🍪", mealType: "snack", category: "snack", source: "family", subtitle: "Family recipe", ingredients: ["250g oats"], instructions: ["Bake."] }));
    await goTo("meals")(p);
    const fits = await p.evaluate(() => [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > button, #view-meals .meals-tab")].filter(b => b.offsetParent).every(b => b.scrollWidth <= b.clientWidth + 1));
    if (!fits) throw new Error("a Meals header button's words don't fit");
    // This week's header: just Grocery List and Plan Meal (Ideas and Snap moved)
    const headerBtns = await p.evaluate(() => [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > button")].filter(b => b.offsetParent).map(b => b.id || b.className));
    if (p.__size !== "phone" && headerBtns.length !== 2) throw new Error(`the This week header has ${headerBtns.length} buttons: ${headerBtns.join(", ")}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-meals-header-tabs.png`) });
    await p.click('[data-meals-tab="recipes"]');
    await p.waitForTimeout(800);
    const home = await p.evaluate(() => {
      const v = document.getElementById("meals-recipes-view");
      const weekShown = [...document.querySelectorAll(".skylight-meals-matrix-wrapper, .skylight-meals-mobile-wrapper")].some(w => w.offsetParent);
      return { shown: !v.hidden && !!v.offsetParent, weekShown, own: v.textContent.includes("Nana's flapjacks"), collections: v.querySelectorAll("[data-rb-collection]").length, photos: v.querySelectorAll(".rb-photo img").length };
    });
    if (!home.shown || home.weekShown) throw new Error(`the Recipes tab didn't replace the week: ${JSON.stringify(home)}`);
    if (!home.own) throw new Error("your own recipe isn't under Your family's recipes");
    // No photo of its own: a stand-in photo (flapjacks: baking), not an emoji tile
    const standIn = await p.evaluate(() => { const t = [...document.querySelectorAll("#meals-recipes-view .rb-tile")].find(x => x.textContent.includes("Nana's flapjacks")); const img = t && t.querySelector(".rb-photo img"); return img ? img.getAttribute("src") : "none"; });
    if (standIn !== "images/recipes/stock/baking.jpg") throw new Error(`Nana's flapjacks shows ${standIn}, not the baking stand-in`);
    if (home.collections < 6) throw new Error(`only ${home.collections} collections`);
    if (!(await p.locator("#meals-recipes-view [data-snap-recipe]").isVisible())) throw new Error("no Snap a recipe on the Recipes tab");
    if (!(await p.locator("#meals-recipes-view [data-open-genie]").isVisible())) throw new Error("no Magic Mealtime ideas on the Recipes tab");
    // The very bottom can be scrolled to, with room under it
    const bottom = await p.evaluate(async () => {
      const v = document.getElementById("meals-recipes-view");
      v.scrollTop = v.scrollHeight; window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 300));
      const last = v.querySelector(".rb-count").getBoundingClientRect();
      const nav = document.querySelector(".mobile-bottom-nav, .skylight-bottom-nav, nav[class*='bottom']");
      const floor = nav && nav.offsetParent ? nav.getBoundingClientRect().top : window.innerHeight;
      return { lastBottom: Math.round(last.bottom), floor: Math.round(floor) };
    });
    if (bottom.lastBottom > bottom.floor) throw new Error(`can't scroll to the bottom of Recipes: ${JSON.stringify(bottom)}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-recipes-bottom.png`) });
    await p.evaluate(() => { document.getElementById("meals-recipes-view").scrollTop = 0; window.scrollTo(0, 0); });
    // Liking a recipe: the heart fills and stays the same size
    const heartSize = () => p.evaluate(() => { const s = document.querySelector("#meals-recipes-view .rb-fav .heart-icon"); const r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), filled: s.querySelector("path").getAttribute("fill") !== "none" }; });
    const before = await heartSize();
    await p.click("#meals-recipes-view .rb-fav");
    await p.waitForTimeout(500);
    const after = await heartSize();
    if (!after.filled || after.w !== before.w || after.h !== before.h) throw new Error(`liking a recipe changed the heart: ${JSON.stringify({ before, after })}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-recipes-home.png`) });
    await p.click("#meals-recipes-view .rb-fav");
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector("#meals-recipes-view .rb-collections").scrollIntoView({ block: "start" }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-recipes-collections.png`) });
    await p.click('[data-rb-collection="chicken"]');
    await p.waitForTimeout(800);
    const chicken = await p.locator("#meals-recipes-view .rb-tile").count();
    if (chicken < 10) throw new Error(`the Chicken collection shows ${chicken} recipes`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-recipes-chicken.png`) });
    await p.click("[data-rb-home]");
    await p.fill("#meals-recipes-view [data-rb-search]", "beef");
    await p.waitForTimeout(300);
    if ((await p.locator("#meals-recipes-view .rb-tile").count()) < 5) throw new Error("searching beef found too little");
    await p.fill("#meals-recipes-view [data-rb-search]", "flapjack");
    await p.waitForTimeout(300);
    await p.locator("#meals-recipes-view [data-rb-recipe]").first().click();
    await p.waitForTimeout(500);
    if (!(await p.evaluate(() => document.getElementById("cooking-recipe-modal").open))) throw new Error("tapping a recipe didn't open it");
    const hero = await p.evaluate(() => document.getElementById("cooking-modal-hero").style.backgroundImage);
    if (!/stock\/baking\.jpg/.test(hero)) throw new Error(`the recipe's card has no stand-in photo: ${hero}`);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-recipes-family-card.png`) });
    await p.evaluate(() => document.getElementById("cooking-recipe-modal").close());
    await p.fill("#meals-recipes-view [data-rb-search]", "");
    // Back to the week, and it's all there again
    await p.click('[data-meals-tab="week"]');
    await p.waitForTimeout(300);
    const back = await p.evaluate(() => [...document.querySelectorAll(".skylight-meals-matrix-wrapper, .skylight-meals-mobile-wrapper")].some(w => w.offsetParent) && document.getElementById("meals-recipes-view").hidden);
    if (!back) throw new Error("This week didn't come back");
    await p.evaluate(() => window.FamilyRecipes.remove("family-smoke-flapjacks"));
  }],
  // Night clock: not while someone's using the screen (it came down mid-recipe at 12:30am)
  ["night-clock", async (p) => {
    const shown = await p.evaluate(() => {
      const before = { ...window.boardSettings };
      Object.assign(window.boardSettings, { sleepScheduleEnabled: true, sleepStartTime: "00:00", sleepEndTime: "23:59" });
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      window.checkScheduledSleepWindow();
      const o = document.getElementById("ambient-sleep-overlay");
      const on = !!o && o.style.display === "flex";
      window.boardSettings = before; window.deactivateAmbientSleepScreen();
      return on;
    });
    if (shown) throw new Error("the night clock came on while the screen was being used");
  }],
  // Add Event: the Starts / Ends times fit the panel, and no stray date box
  ["event-editor", async (p) => {
    await goTo("calendar")(p);
    await p.evaluate(() => { delete window.__SMOKE_AI; window.openEventModal(); });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const panel = document.querySelector("#event-modal .modal-content") || document.getElementById("event-modal");
      const edge = Math.min(window.innerWidth, panel.getBoundingClientRect().right);
      const ends = document.getElementById("event-end-time").getBoundingClientRect();
      const stray = [...document.querySelectorAll("#event-modal .date-field-button")].filter(b => b.offsetParent !== null).length;
      document.getElementById("event-end-time").scrollIntoView({ block: "center" });
      return { overflow: Math.round(ends.right - edge), stray };
    });
    if (r.overflow > 0) throw new Error(`the Ends time runs ${r.overflow}px past the panel's edge`);
    if (r.stray) throw new Error("a stray date box shows in Add Event");
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-event-times.png`) });
    await p.evaluate(() => document.getElementById("btn-close-event-modal").click());
  }],
  // The job editor: "Bigger job" shows for a daily household job, not for a routine
  ["job-editor", async (p) => {
    await goTo("chores")(p);
    const shown = async (id) => p.evaluate((tid) => { window.openSkylightTaskDrawer(tid); const r = document.getElementById("drawer-big-job-row"); return !!r && !r.hidden && r.offsetParent !== null; }, id);
    if (!(await shown("t5"))) throw new Error("Bigger job switch missing for a daily household job");
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-job-editor-quick.png`) });
    const hint = await p.$eval("#drawer-who-summary", el => el.textContent);
    if (!/quick grab/i.test(hint)) throw new Error(`the editor doesn't say it's a quick grab (${hint})`);
    // Every week + Any day: the switch shows and the hint says every day this week
    const weekly = await p.evaluate(() => { window.openSkylightTaskDrawer("t14"); const any = document.querySelector("[data-weekday-any]"); return { on: any.classList.contains("active"), row: !document.getElementById("drawer-big-job-row").hidden, hint: document.getElementById("drawer-who-summary").textContent }; });
    if (!weekly.on || !weekly.row || !/this week/.test(weekly.hint)) throw new Error(`weekly any-day editor looks wrong: ${JSON.stringify(weekly)}`);
    await p.evaluate(() => document.querySelector("[data-weekday-any]").scrollIntoView({ block: "center" }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, `${p.__size}-job-editor-weekly.png`) });
    if (await shown("t1")) throw new Error("Bigger job switch showing for a personal routine");
    // Steven's ironing: new job, Routine, then Anyone, Every week, Any day this week
    const iron = await p.evaluate(async () => {
      window.openSkylightTaskDrawer();
      await new Promise(r => setTimeout(r, 300));
      const click = (sel) => { const b = document.querySelector(sel); if (b) b.click(); return !!b; };
      click("#btn-drawer-type-routine");
      click('.drawer-profile-pill[data-profile="Up for grabs"]');
      click('#drawer-schedule-pills [data-schedule="weekly"]');
      click("[data-weekday-any]");
      await new Promise(r => setTimeout(r, 100));
      const afterAnyone = { chore: document.getElementById("btn-drawer-type-chore").classList.contains("active"), hint: document.getElementById("drawer-who-summary").textContent };
      click("#btn-drawer-type-routine"); // and if they pick Routine again
      await new Promise(r => setTimeout(r, 100));
      return { afterAnyone, routineHint: document.getElementById("drawer-who-summary").textContent };
    });
    if (!iron.afterAnyone.chore) throw new Error("picking Anyone didn't switch a routine to a chore");
    if (!/quick grab/i.test(iron.afterAnyone.hint)) throw new Error(`Anyone + Every week + Any day doesn't say quick grab: ${iron.afterAnyone.hint}`);
    if (!/nobody can grab/i.test(iron.routineHint)) throw new Error(`Routine + Anyone doesn't explain itself: ${iron.routineHint}`);
    await p.keyboard.press("Escape");
    // A job worth no points (Make your bed): the stepper goes down to "No points",
    // it saves as 0, and its card shows no points
    const bed = await p.evaluate(async () => {
      window.openSkylightTaskDrawer();
      await new Promise(r => setTimeout(r, 300));
      document.getElementById("drawer-task-title").value = "Brush your teeth";
      const pill = document.querySelector('.drawer-profile-pill[data-profile="Alex"]'); if (pill) pill.click();
      const minus = document.getElementById("btn-drawer-reward-minus");
      for (let i = 0; i < 12; i++) minus.click();
      const shown = document.getElementById("drawer-reward-display").textContent;
      const off = minus.disabled;
      document.getElementById("skylight-task-drawer-form").requestSubmit();
      await new Promise(r => setTimeout(r, 800));
      const t = (window.currentTasks || []).find(x => x.title === "Brush your teeth");
      if (typeof window.renderApp === "function") window.renderApp();
      await new Promise(r => setTimeout(r, 400));
      const card = [...document.querySelectorAll(".skylight-task-card")].find(c => t && c.getAttribute("data-task-id") === t.id);
      return { shown, off, value: t ? t.value : "missing", points: t ? window.taskPoints(t) : null, card: card ? card.textContent.replace(/\s+/g, " ").trim() : null };
    });
    if (bed.shown !== "No points" || !bed.off) throw new Error(`the points stepper doesn't go down to No points: ${JSON.stringify(bed)}`);
    if (bed.value !== 0 || bed.points !== 0) throw new Error(`Brush your teeth wasn't saved with no points: ${JSON.stringify(bed)}`);
    if (!bed.card) throw new Error("Brush your teeth's card isn't on the board");
    if (/\bpts?\b|\bpoints?\b/.test(bed.card)) throw new Error(`Brush your teeth's card still shows points: ${bed.card}`);
    await p.keyboard.press("Escape");
  }],
  ["today", async (p) => {
    await p.evaluate(() => window.showTodayScreen({ from: "preview" }));
    await p.waitForTimeout(300);
    if (!(await p.locator("#today-screen .today-countdown").count())) {
      const dbg = await p.evaluate(() => ({ ev: (window.familyEvents || []).map(e => e.title + ":" + !!e.countdown), cd: (window.getUpcomingCountdowns ? window.getUpcomingCountdowns() : []).length, cards: [...document.querySelectorAll("#today-screen .today-card")].map(c => c.className) }));
      throw new Error("no countdown card on Today at a glance " + JSON.stringify(dbg));
    }
  }],
  ["settings", async (p) => { await goTo("calendar")(p); await p.evaluate(() => window.openSettingsModal()); }]
];

async function main() {
  const { chromium } = loadPlaywright();
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const failures = [];
  const sizes = Object.entries(SIZES).filter(([name]) => !only || name === only);
  try {
    for (const [sizeName, opts] of sizes) {
      const context = await browser.newContext({ ...opts, serviceWorkers: "block", locale: "en-GB", timezoneId: "Europe/London" });
      await routeOutside(context, origin);
      await context.addInitScript((data) => {
        if (!window.__SMOKE_STORE) window.__SMOKE_STORE = data;
        // Each page's first-visit tutorial counts as seen (they'd cover the page)
        try { ["calendar", "tasks", "meals", "lists", "rewards"].forEach(p => localStorage.setItem(`harmonee_${p}_intro_seen`, "true")); } catch (e) {}
      }, sampleStore());
      const page = await context.newPage();
      page.__size = sizeName;
      const problems = [];
      page.on("response", (r) => { if (r.status() === 404) console.log("404:", r.url()); });
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console error: ${m.text()}`);
        // Chrome reports the report-only content policy as "info", so look for it by name
        else if (/Content Security Policy/.test(m.text())) problems.push(`content policy would block: ${m.text().split(". ")[0]}`);
      });
      page.on("pageerror", (e) => problems.push(`crash: ${e.message}`));
      await page.goto(`${origin}/?board=${BOARD}`, { waitUntil: "load" });
      await page.waitForFunction(() => typeof window.switchSkylightView === "function" && (window.familyMembers || []).length > 0, null, { timeout: 15000 })
        .catch(() => problems.push("the board never finished loading"));
      await page.waitForTimeout(800);
      // The app's own error log (js/errors.js) counts too
      for (const [name, open] of PAGES) {
        // ONLY=rewards,rewards-page runs just those steps (quicker while working on a page)
        if (process.env.ONLY && !process.env.ONLY.split(",").includes(name)) continue;
        const before = problems.length;
        try { await open(page); } catch (e) { problems.push(`couldn't open ${name}: ${e.message.split("\n")[0]}`); }
        await page.waitForTimeout(700);
        (await page.evaluate(unnamedControls)).forEach(c => problems.push(`${name}: ${c} has no name a screen reader can read`));
        await page.screenshot({ path: path.join(SHOTS, `${sizeName}-${name}.png`) });
        const logged = await page.evaluate(() => (window.HarmoneeErrors ? window.HarmoneeErrors.list() : []).filter(x => x.kind !== "warning").map(x => `${x.kind}: ${x.msg}`));
        await page.evaluate(() => window.HarmoneeErrors && window.HarmoneeErrors.clear());
        logged.forEach(l => { if (!problems.some(p => p.includes(l.split(": ").slice(1).join(": ")))) problems.push(`error log: ${l}`); });
        problems.slice(before).forEach(p => failures.push(`[${sizeName} · ${name}] ${p}`));
        problems.length = before;
      }
      problems.forEach(p => failures.push(`[${sizeName}] ${p}`));
      await context.close();
      console.log(`${failures.some(f => f.startsWith(`[${sizeName}`)) ? "❌" : "✅"} ${sizeName} (${opts.viewport.width}×${opts.viewport.height}): ${PAGES.map(p => p[0]).join(", ")}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nScreenshots: ${path.relative(process.cwd(), SHOTS)}/`);
  if (failures.length) {
    console.log(`\n${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
    [...new Set(failures)].forEach(f => console.log("  ❌ " + f));
    process.exit(1);
  }
  console.log("🎉 Smoke test passed.");
}

main().catch((e) => { console.error("The smoke test itself broke:", e); process.exit(1); });
