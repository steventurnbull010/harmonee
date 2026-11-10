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
    await p.locator("#plan-meal-drawer [data-add-family-recipe]").click();
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
  // Meals > Recipes tab: photos, your own recipes, collections, search, Snap
  ["recipes-tab", async (p) => {
    await p.evaluate(() => { window.closePlanMealDrawer && window.closePlanMealDrawer(); const c = document.getElementById("cooking-recipe-modal"); if (c && c.open) c.close(); });
    await p.evaluate(() => window.FamilyRecipes.save({ id: "family-smoke-flapjacks", title: "Nana's flapjacks", emoji: "🍪", mealType: "snack", category: "snack", source: "family", subtitle: "Family recipe", ingredients: ["250g oats"], instructions: ["Bake."] }));
    await goTo("meals")(p);
    const fits = await p.evaluate(() => [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > button, #view-meals .meals-tab")].filter(b => b.offsetParent).every(b => b.scrollWidth <= b.clientWidth + 1));
    if (!fits) throw new Error("a Meals header button's words don't fit");
    // This week's header: just Grocery List and Plan Meal (Ideas and Snap moved)
    const headerBtns = await p.evaluate(() => [...document.querySelectorAll("#view-meals .skylight-meals-nav-controls > button")].filter(b => b.offsetParent).map(b => b.id || b.className));
    if (headerBtns.length !== 2) throw new Error(`the This week header has ${headerBtns.length} buttons: ${headerBtns.join(", ")}`);
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
