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
        memberColors: { Sam: "warm-ochre", Alex: "periwinkle", Jo: "coral-pink", Max: "spring-green" },
        weatherLocation: { lat: 51.5, lon: -0.1, name: "London" }
      },
      events: [
        { id: "e1", title: "Swimming", date: keyOf(today), time: "16:30", duration: "1 hour", repeat: "none", member: "Jo", icon: "🏊" },
        { id: "e2", title: "Dentist", date: keyOf(tomorrow), time: "09:00", duration: "30 mins", repeat: "none", member: "Max", icon: "🦷" },
        { id: "e3", title: "Football", day: "Saturday", time: "10:00", duration: "1 hour", repeat: "weekly", member: "Max", icon: "⚽" }
      ],
      meals: { [keyOf(today)]: { dinner: { title: "Spaghetti bolognese", emoji: "🍝", cook: "Alex" } } },
      familyLists: [
        { id: "groceries", title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [{ id: "g1", text: "Milk", checked: false }, { id: "g2", text: "Bread", checked: false }, { id: "g3", text: "Apples", checked: true }] },
        { id: "packing", title: "Holiday packing", emoji: "🧳", color: "mint", items: [{ id: "p1", text: "Suncream", checked: false }] }
      ]
    },
    [`${b}/devices/smoke-test-device`]: { code: "SMOKE-TEST", label: "Smoke test" },
    [`${b}/tasks/t1`]: t("t1", "Make your bed", "Jo", { kind: "routine", routineSlot: "morning", icon: "🛏️" }),
    [`${b}/tasks/t2`]: t("t2", "Brush teeth", "Max", { kind: "routine", routineSlot: "evening", icon: "🪥" }),
    [`${b}/tasks/t3`]: t("t3", "Empty the dishwasher", "Anyone", { icon: "🍽️", value: 3 }),
    [`${b}/tasks/t4`]: t("t4", "Hoover the lounge", "Sam", { taskType: "Weekly Chore", day: "Saturday", repeat: "weekly", icon: "🧹", value: 5 }),
    // Quick grabs (daily, nobody's) and a bigger daily job that stays in Grab it
    [`${b}/tasks/t5`]: t("t5", "Litter trays", null, { icon: "🐱", value: 1 }),
    [`${b}/tasks/t6`]: t("t6", "Fill the dishwasher", "Up for grabs", { icon: "🧽", value: 1 }),
    [`${b}/tasks/t7`]: t("t7", "Feed the cats", "Anyone", { icon: "🐾", value: 1 }),
    [`${b}/tasks/t8`]: t("t8", "Water the plants", null, { icon: "🪴", value: 1 }),
    [`${b}/tasks/t9`]: t("t9", "Clear the garden", null, { icon: "🌳", value: 5, grabSize: "big" }),
    [`${b}/tasks/t14`]: t("t14", "Change the bedsheets", null, { taskType: "Standard", day: "Anyday", repeat: "weekly", anyDay: true, icon: "🛏️", value: 3 }),
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
  ["calendar", goTo("calendar")],
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
    if (!(await card.count())) throw new Error(`${title} didn't land in ${who}'s column`);
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
    await p.keyboard.press("Escape");
  }],
  ["today", async (p) => p.evaluate(() => window.showTodayScreen({ from: "preview" }))],
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
