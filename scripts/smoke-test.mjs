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
      meals: { [keyOf(today)]: { dinner: { title: "Spaghetti bolognese", emoji: "🍝", cook: "Alex" } } },
      familyLists: [
        { id: "groceries", title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [{ id: "g1", text: "Milk", checked: false }, { id: "g2", text: "Bread", checked: false }, { id: "g3", text: "Apples", checked: true },
          // For yesterday's dinner (clears itself) and tomorrow's breakfast (a teaspoon: just "Cinnamon")
          { id: "g4", text: "500g Beef mince", checked: false, source: "Lasagne", grocery: { key: "beef mince", name: "Beef mince", label: "Beef mince", amounts: { mass: 500 }, sources: ["Lasagne"], sourceKeys: [`Lasagne|${keyOf(new Date(today.getTime() - 86400000))}|dinner`] } },
          { id: "g5", text: "1 tsp Cinnamon", checked: false, source: "Muffins", grocery: { key: "cinnamon", name: "Cinnamon", label: "Cinnamon", amounts: { spoon: 1 }, sources: ["Muffins"], sourceKeys: [`Muffins|${keyOf(tomorrow)}|breakfast`] } }] },
        { id: "packing", title: "Holiday packing", emoji: "🧳", color: "mint", items: [{ id: "p1", text: "Suncream", checked: false }] }
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
    [`${b}/tasks/t14`]: t("t14", "Change the bedsheets", null, { taskType: "Standard", day: "Anyday", repeat: "weekly", anyDay: true, icon: "🛏️", value: 3 }),
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
    // Switched off (as it ships): no button
    const offHidden = await p.evaluate(async () => { delete window.__SMOKE_AI; window.openEventModal(); await new Promise(r => setTimeout(r, 100)); return document.getElementById("btn-event-from-photo").hidden; });
    if (!offHidden) throw new Error("the 📷 button shows while Magic Import is switched off");
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
    await p.locator("[data-add-family-recipe]").click();
    await p.waitForTimeout(400);
    if (!(await p.locator("#family-recipe-modal [data-fr-photo]").isVisible())) throw new Error("no 📷 Fill in from a photo button in the recipe form");
    // Typed in
    await p.fill('#family-recipe-modal [data-fr="title"]', "Nana's flapjacks");
    await p.click('#family-recipe-modal [data-fr-meal="snack"]');
    await p.fill('#family-recipe-modal [data-fr="servings"]', "12");
    await p.fill('#family-recipe-modal [data-fr="ingredients"]', "250g oats\n125g butter\n4 tbsp golden syrup");
    await p.fill('#family-recipe-modal [data-fr="method"]', "1. Melt the butter and syrup.\n2. Stir in the oats and bake for 20 minutes.");
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
      note: !document.querySelector("#family-recipe-modal [data-fr-note]").hidden
    }));
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
    await p.evaluate(() => document.querySelector("[data-add-family-recipe]").scrollIntoView({ block: "center" }));
    await shot("3-add-button");
    await p.locator("[data-add-family-recipe]").click();
    await shot("4-empty-form");
    await p.evaluate(() => { window.__SMOKE_AI = async (photo, kind) => { await new Promise(r => setTimeout(r, 2500)); return kind === "recipe" ? { isRecipe: true, title: "Grandad's beef stew", servings: 4, prepMinutes: 20, cookMinutes: 120, mealType: "dinner", ingredients: ["500g stewing beef, cubed", "2 tbsp plain flour", "1 onion, chopped", "2 carrots, sliced", "500ml beef stock", "1 tbsp tomato purée", "Salt and pepper"], method: ["Toss the beef in the flour.", "Brown the beef in batches in a hot pan with a little oil.", "Add the onion and carrots and cook for 5 minutes.", "Pour in the stock and tomato purée, cover and simmer for 2 hours until tender.", "Season to taste and serve with mash."], emoji: "🍲" } : { events: [] }; }; });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#family-recipe-modal [data-fr-photo]")]);
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
      const list = () => document.getElementById("drawer-recipes-list").textContent;
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
