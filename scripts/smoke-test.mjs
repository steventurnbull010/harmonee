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
function sampleStore() {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const b = `boards/${BOARD}`;
  const t = (id, title, who, extra = {}) => ({ id, title, assignedTo: who, taskType: "Daily Task", day: "Daily", repeat: "daily", value: 2, done: false, completedBy: null, completedAt: null, ...extra });
  return {
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
    [`${b}/tasks/t4`]: t("t4", "Hoover the lounge", "Sam", { taskType: "Weekly Chore", day: "Saturday", repeat: "weekly", icon: "🧹", value: 5 })
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
