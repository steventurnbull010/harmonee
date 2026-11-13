// ============================================================================
// COOKING TIMERS (js/cook-timers.js, css/cook-timers.css)
// A method step that mentions a time ("boil for 10 mins", "1½ hours",
// "20-25 minutes") gets a small ⏱️ Start button after it. Tapping it starts a
// timer named from the step ("Boil the spuds"), pinned to the bottom corner
// of every page, over pop-ups too. Several stack with the one that goes off
// next at the top. When one is done it chimes (and buzzes, where the phone
// lets a website) until someone taps Stop.
//
// Timers live on the board (board.timers.<id>), so one started on a phone
// shows and rings on the kitchen tablet too. Each keeps the time it ends, not
// a countdown, so it's right after switching apps or locking the phone; one
// that ran out meanwhile is ringing on return. The screen stays awake while
// one is running.
//
//   CookTimers.findTimes(text)   -> [{ start, end, minutes, extra }]
//   CookTimers.labelFor(text, i) -> "Boil the spuds"
//   CookTimers.stepHtml(text, { dish, step })  -> escaped text with Start buttons
//   CookTimers.start({ label, dish, minutes, extra })
//   CookTimers.fromBoard(map)    (app.js, on each board snapshot)
// ============================================================================
(function (root) {
  // ---- Finding times in a step (no DOM: tested by scripts/test-cook-timers.js) ----------
  const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, fifty: 50, sixty: 60, ninety: 90 };
  const NUM = "(?:\\d+\\s+\\d\\/\\d|\\d+\\s*½|\\d+(?:[.,]\\d+)?|½|\\d\\/\\d|forty-five|an|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety)";
  const RANGE = `(${NUM})(?:\\s*(?:-|–|—|to|or)\\s*(${NUM}))?`;
  // "half an hour", "1 hour 20 minutes", "1-2 hrs", "10 mins", "20–25 minutes"
  const RE = new RegExp(
    `\\b(?:(half an hour)|${RANGE}\\s*(?:hours?|hrs?)\\b(?:\\s*(?:and\\s*)?(\\d+)\\s*(?:minutes?|mins?)\\b)?|${RANGE}\\s*(?:minutes?|mins?)\\b)`,
    "gi");
  function num(s) {
    if (s == null) return null;
    s = String(s).trim().toLowerCase();
    if (s in WORDS) return WORDS[s];
    let m;
    if ((m = s.match(/^(\d+)\s+(\d)\/(\d)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\s*½$/))) return +m[1] + 0.5;
    if (s === "½") return 0.5;
    if ((m = s.match(/^(\d)\/(\d)$/))) return m[1] / m[2];
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? null : n;
  }
  function findTimes(text) {
    const out = [];
    const s = String(text || "");
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(s))) {
      let low, high;
      if (m[1]) { low = high = 30; }
      else if (m[2] != null) {
        // "a" or "an" only means one for hours ("an hour"), never "a 2 hour…"
        const a = num(m[2]), b = m[3] != null ? num(m[3]) : null;
        if (a == null) continue;
        low = a * 60; high = (b != null ? b : a) * 60;
        if (m[4]) { low += +m[4]; high = b != null ? high : low; }
      } else {
        if (/^(an?)$/i.test(m[5])) continue; // "a minute or two": too vague
        const a = num(m[5]), b = m[6] != null ? num(m[6]) : null;
        if (a == null) continue;
        low = a; high = b != null ? b : a;
      }
      low = Math.round(low); high = Math.round(high);
      if (high < low) [low, high] = [high, low];
      if (low < 1 || low > 720) continue;
      out.push({ start: m.index, end: m.index + m[0].length, minutes: low, extra: Math.min(high - low, 240) });
    }
    return out;
  }
  // The timer's name: the start of the sentence the time is in, up to it
  // ("Boil the spuds for 10 mins" -> "Boil the spuds")
  function labelFor(text, at) {
    const s = String(text || "");
    const before = s.slice(0, at);
    const from = Math.max(before.lastIndexOf(". "), before.lastIndexOf("; "), before.lastIndexOf("! "), before.lastIndexOf("? "));
    let t = before.slice(from + 1);
    const then = t.search(/(?:,\s*|\s+)(?:and\s+)?then\s+(?=\S)(?!.*(?:,\s*|\s+)(?:and\s+)?then\s+\S)/i);
    if (then > 0) t = t.slice(then).replace(/^(?:,\s*|\s+)(?:and\s+)?then\s+/i, "");
    t = t
      .replace(/^\s*(?:step\s*)?\d{1,2}\s*[.):-]\s*/i, "")
      .replace(/^\s*(?:meanwhile|then|now|next|finally|after that|once done|and)\s*,?\s+/i, "")
      .replace(/[\s,;:(–—-]+$/, "")
      .replace(/\s+(?:for|about|around|roughly|approx\.?|approximately|another|a further|further|over|in|of|until|or|at least|up to)$/i, "")
      .replace(/\s+(?:for|about|around|another|a further)$/i, "")
      .replace(/[\s,;:(–—-]+$/, "")
      .trim();
    if (!t) return "";
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (t.length > 28) {
      const cut = t.slice(0, 27);
      t = (cut.lastIndexOf(" ") > 12 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).replace(/[\s,;:]+$/, "") + "…";
    }
    return t;
  }
  const escText = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function minutesWords(n) {
    const h = Math.floor(n / 60), m = n % 60;
    return h ? `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}` : `${m} minute${m === 1 ? "" : "s"}`;
  }
  // The step's words with a small Start after each time in it
  function stepHtml(text, opts = {}) {
    const s = String(text || "");
    const times = findTimes(s);
    if (!times.length) return escText(s);
    let html = "", last = 0;
    times.forEach(t => {
      const label = labelFor(s, t.start) || (opts.step ? `Step ${opts.step}` : "Timer");
      html += escText(s.slice(last, t.end));
      html += `<button type="button" class="ct-start" data-ct-start data-ct-min="${t.minutes}" data-ct-extra="${t.extra}" data-ct-label="${escText(label)}" data-ct-dish="${escText(opts.dish || "")}" aria-label="Start a timer for ${minutesWords(t.minutes)}: ${escText(label)}"><span aria-hidden="true">⏱️</span> Start</button>`;
      last = t.end;
    });
    return html + escText(s.slice(last));
  }

  const api = { findTimes, labelFor, stepHtml };
  root.CookTimers = api;
  if (typeof document === "undefined") return;

  // ---- The timers ------------------------------------------------------------------------
  const RING_FOR = 2 * 60 * 1000;    // chimes for up to 2 minutes
  const RING_IF_WITHIN = 10 * 60 * 1000; // ran out while away: still rings if it was this recent
  const CLEAR_AFTER = 30 * 60 * 1000;    // done and nobody stopped it: gone after this
  let timers = {};                 // id -> { id, label, dish, total, endsAt|null, left, extra, at }
  const ringing = new Map();       // id -> when it started ringing here
  const silenced = new Set();      // done, seen here, rang (or too old to ring)
  let tickTimer = 0, wake = null, lastOrder = "";
  const esc = (s) => (typeof root.escapeHtml === "function" ? root.escapeHtml(String(s ?? "")) : escText(s));
  const cacheKey = () => (typeof root.boardCacheKey === "function" ? root.boardCacheKey("harmonee_cook_timers") : "harmonee_cook_timers");

  function load() {
    try { timers = JSON.parse(localStorage.getItem(cacheKey()) || "{}") || {}; } catch (e) { timers = {}; }
    // Ones that had already finished before this page opened don't ring again here
    Object.values(timers).forEach(t => { if (t.endsAt && Date.now() - t.endsAt > RING_IF_WITHIN) silenced.add(t.id); });
  }
  function keep() { try { localStorage.setItem(cacheKey(), JSON.stringify(timers)); } catch (e) {} }
  // One timer to the board (or off it)
  function sync(id) {
    keep();
    if (root.BoardSync && root.BoardSync.writeFields) {
      root.BoardSync.writeFields([[["timers", id], timers[id] ? timers[id] : root.BoardSync.DELETE]]);
    }
  }
  function fromBoard(map) {
    const next = map && typeof map === "object" ? map : {};
    const clean = {};
    Object.entries(next).forEach(([id, t]) => {
      if (!t || typeof t !== "object" || !t.total) return;
      clean[id] = { ...t, id };
    });
    timers = clean;
    keep();
    [...ringing.keys()].forEach(id => { if (!timers[id] || !isDone(timers[id])) stopRinging(id); });
    render();
  }

  const leftMs = (t, now = Date.now()) => (t.endsAt ? t.endsAt - now : (t.left || 0) * 1000);
  const isDone = (t, now = Date.now()) => !!t.endsAt && t.endsAt <= now;
  const clock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };
  // Done ones first, then running (soonest to go off at the top), then paused
  function ordered(now = Date.now()) {
    const rank = (t) => (isDone(t, now) ? 0 : t.endsAt ? 1 : 2);
    return Object.values(timers).sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? b.endsAt - a.endsAt : leftMs(a, now) - leftMs(b, now)) || String(a.id).localeCompare(String(b.id)));
  }

  function start({ label, dish = "", minutes, extra = 0 }) {
    const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const total = Math.round(minutes * 60);
    timers[id] = { id, label: String(label || "Timer").slice(0, 40), dish: String(dish || "").slice(0, 60), total, endsAt: Date.now() + total * 1000, left: null, extra: Math.round(extra * 60), at: Date.now() };
    sync(id);
    unlockSound();
    render();
    return id;
  }
  function change(id, fn) {
    const t = timers[id];
    if (!t) return;
    fn(t);
    sync(id);
    render();
  }
  const pause = (id) => change(id, t => { if (t.endsAt && !isDone(t)) { t.left = Math.max(1, Math.ceil(leftMs(t) / 1000)); t.endsAt = null; } });
  const resume = (id) => change(id, t => { if (!t.endsAt) { t.endsAt = Date.now() + (t.left || 0) * 1000; t.left = null; } });
  // More time: on a done timer it starts again from now
  const addTime = (id, secs) => change(id, t => {
    if (isDone(t)) { t.endsAt = Date.now() + secs * 1000; stopRinging(id); silenced.delete(id); }
    else if (t.endsAt) t.endsAt += secs * 1000;
    else t.left = (t.left || 0) + secs;
    t.total += secs;
    if (t.extra) t.extra = 0; // "+5" (the rest of a range) is used once
  });
  function remove(id) {
    stopRinging(id);
    silenced.delete(id);
    delete timers[id];
    sync(id);
    render();
  }
  function rename(id, label) { change(id, t => { t.label = String(label || "").trim().slice(0, 40) || t.label; }); }

  // ---- Sound and buzz ------------------------------------------------------------------
  function unlockSound() { try { if (typeof sfx !== "undefined" && sfx && sfx.init) { sfx.init(); if (sfx.ctx && sfx.ctx.state === "suspended") sfx.ctx.resume(); } } catch (e) {} }
  function chime() {
    try { if (typeof sfx !== "undefined" && sfx && sfx.playReminderChime) sfx.playReminderChime(); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  }
  function stopRinging(id) { ringing.delete(id); silenced.add(id); }

  // ---- Keep the screen on while a timer runs ------------------------------------------
  async function wakeLock(on) {
    try {
      if (on && !wake && navigator.wakeLock && document.visibilityState === "visible") {
        wake = await navigator.wakeLock.request("screen");
        wake.addEventListener("release", () => { wake = null; });
      } else if (!on && wake) { const w = wake; wake = null; await w.release(); }
    } catch (e) { wake = null; }
  }

  // ---- Every second: times, ringing, tidying -------------------------------------------
  function tick() {
    const now = Date.now();
    let reorder = false;
    Object.values(timers).forEach(t => {
      if (!isDone(t, now)) return;
      if (now - t.endsAt > CLEAR_AFTER) { remove(t.id); reorder = true; return; }
      if (!ringing.has(t.id) && !silenced.has(t.id)) {
        if (now - t.endsAt <= RING_IF_WITHIN) { ringing.set(t.id, now); chime(); }
        else silenced.add(t.id);
        reorder = true;
      } else if (ringing.has(t.id)) {
        const since = now - ringing.get(t.id);
        if (since > RING_FOR) { ringing.delete(t.id); silenced.add(t.id); }
        else if (Math.floor(since / 1000) % 5 === 0) chime();
      }
    });
    const order = ordered(now).map(t => `${t.id}:${isDone(t, now) ? "d" : t.endsAt ? "r" : "p"}`).join();
    if (reorder || order !== lastOrder) { render(); return; }
    // Just the numbers
    box().querySelectorAll("[data-ct-id]").forEach(el => {
      const t = timers[el.getAttribute("data-ct-id")];
      const time = el.querySelector(".ct-time");
      if (t && time && !isDone(t, now)) time.textContent = clock(leftMs(t, now));
    });
  }
  function schedule() {
    const any = Object.keys(timers).length > 0;
    if (any && !tickTimer) tickTimer = setInterval(tick, 1000);
    if (!any && tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
    wakeLock(Object.values(timers).some(t => t.endsAt && !isDone(t)));
  }

  // ---- The pinned stack -----------------------------------------------------------------
  // A popover, so it can sit over pop-ups: it moves into whichever modal
  // pop-up is open (one outside it couldn't be tapped) and back again.
  const canPop = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
  let host = null;
  function box() {
    if (host) return host;
    host = document.createElement("section");
    host.id = "cook-timers";
    host.className = "cook-timers";
    host.setAttribute("aria-label", "Cooking timers");
    if (canPop) host.setAttribute("popover", "manual");
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    host.addEventListener("focusout", onBlur);
    document.body.appendChild(host);
    return host;
  }
  const openOrder = [];
  function topModal() {
    for (let i = openOrder.length - 1; i >= 0; i--) {
      const d = openOrder[i];
      if (d.isConnected && d.open && (!d.matches || d.matches(":modal"))) return d;
    }
    return null;
  }
  function place() {
    const h = box();
    const has = Object.keys(timers).length > 0;
    const where = topModal() || document.body;
    const moving = h.parentElement !== where;
    if (moving && h.contains(document.activeElement) && h.querySelector("[data-ct-rename-input]")) return; // don't lose a name being typed
    if (moving) { if (canPop && h.matches(":popover-open")) h.hidePopover(); where.appendChild(h); }
    // Above the phone's tab bar when it's on the page itself
    const bar = where === document.body ? document.querySelector(".skylight-sidebar") : null;
    const r = bar && bar.getClientRects().length && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect() : null;
    h.style.setProperty("--ct-bottom", r && r.top > innerHeight / 2 ? `${Math.round(innerHeight - r.top + 8)}px` : "16px");
    h.hidden = !has;
    // Room under a recipe's method so its last steps can scroll clear of the timers
    document.documentElement.style.setProperty("--ct-stack-h", has ? `${Math.round(h.getBoundingClientRect().height || h.scrollHeight) + 16}px` : "0px");
    if (canPop) {
      const shown = h.matches(":popover-open");
      if (has && (!shown || moving)) { try { h.showPopover(); } catch (e) {} }
      else if (!has && shown) h.hidePopover();
    }
    if (has) document.documentElement.style.setProperty("--ct-stack-h", `${Math.round(h.getBoundingClientRect().height) + 16}px`);
  }

  function render() {
    const h = box();
    const now = Date.now();
    const list = ordered(now);
    lastOrder = list.map(t => `${t.id}:${isDone(t, now) ? "d" : t.endsAt ? "r" : "p"}`).join();
    const editing = h.querySelector("[data-ct-rename-input]");
    if (editing && h.contains(document.activeElement)) { schedule(); place(); return; } // finish the name first
    h.innerHTML = list.map(t => {
      const done = isDone(t, now), paused = !t.endsAt;
      const more = t.extra ? Math.round(t.extra / 60) : 1;
      return `<div class="ct-timer${done ? " is-done" : ""}${paused ? " is-paused" : ""}${ringing.has(t.id) ? " is-ringing" : ""}" data-ct-id="${esc(t.id)}" role="group" aria-label="${esc(t.label)} timer">
        <button type="button" class="ct-name" data-ct-rename title="Rename" aria-label="Rename ${esc(t.label)}"><strong>${esc(t.label)}</strong>${t.dish ? `<small>${esc(t.dish)}</small>` : ""}</button>
        ${done
          ? `<span class="ct-time ct-done-words" role="status">Done</span>
             <button type="button" class="ct-btn" data-ct-add="60" aria-label="One more minute">+1</button>
             <button type="button" class="ct-btn ct-stop" data-ct-remove aria-label="Stop ${esc(t.label)}">Stop</button>`
          : `<span class="ct-time" aria-label="Time left">${clock(leftMs(t, now))}</span>
             <button type="button" class="ct-btn" data-ct-toggle aria-label="${paused ? "Carry on" : "Pause"}">${paused ? "▶" : "⏸"}</button>
             <button type="button" class="ct-btn" data-ct-add="${more * 60}" aria-label="${more} more minute${more === 1 ? "" : "s"}">+${more}</button>
             <button type="button" class="ct-btn ct-x" data-ct-remove aria-label="Cancel ${esc(t.label)}">✕</button>`}
      </div>`;
    }).join("");
    schedule();
    place();
  }

  function onClick(e) {
    const row = e.target.closest("[data-ct-id]");
    if (!row) return;
    const id = row.getAttribute("data-ct-id");
    if (e.target.closest("[data-ct-remove]")) { remove(id); return; }
    if (e.target.closest("[data-ct-toggle]")) { const t = timers[id]; if (t) (t.endsAt ? pause : resume)(id); return; }
    const add = e.target.closest("[data-ct-add]");
    if (add) { addTime(id, parseInt(add.getAttribute("data-ct-add"), 10) || 60); return; }
    if (e.target.closest("[data-ct-rename]")) {
      const t = timers[id];
      const btn = e.target.closest("[data-ct-rename]");
      btn.outerHTML = `<input class="ct-rename" data-ct-rename-input value="${esc(t ? t.label : "")}" maxlength="40" aria-label="Timer name" enterkeyhint="done">`;
      const input = row.querySelector("[data-ct-rename-input]");
      input.focus();
      input.select();
    }
  }
  function onKey(e) {
    const input = e.target.closest && e.target.closest("[data-ct-rename-input]");
    if (!input) return;
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); input.value = ""; input.blur(); }
  }
  function onBlur(e) {
    const input = e.target.closest && e.target.closest("[data-ct-rename-input]");
    if (!input) return;
    const id = input.closest("[data-ct-id]").getAttribute("data-ct-id");
    const v = input.value.trim();
    input.removeAttribute("data-ct-rename-input");
    if (v) rename(id, v); else render();
  }

  // ---- Start buttons, wherever a method is shown --------------------------------------
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-ct-start]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    start({ label: b.getAttribute("data-ct-label"), dish: b.getAttribute("data-ct-dish"), minutes: parseInt(b.getAttribute("data-ct-min"), 10) || 1, extra: parseInt(b.getAttribute("data-ct-extra"), 10) || 0 });
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) { try { sfx.playClick(); } catch (err) {} }
    b.classList.add("is-started");
    b.innerHTML = `<span aria-hidden="true">✓</span> Started`;
    setTimeout(() => { if (b.isConnected) { b.classList.remove("is-started"); b.innerHTML = `<span aria-hidden="true">⏱️</span> Start`; } }, 2500);
  }, true);

  // Follow pop-ups opening and closing (and pages redrawing them)
  let placeQueued = false;
  const queuePlace = () => { if (placeQueued) return; placeQueued = true; requestAnimationFrame(() => { placeQueued = false; if (Object.keys(timers).length || (host && !host.hidden)) place(); }); };
  new MutationObserver((muts) => {
    muts.forEach(m => {
      if (m.type === "attributes" && m.target instanceof HTMLDialogElement) {
        const i = openOrder.indexOf(m.target);
        if (i !== -1) openOrder.splice(i, 1);
        if (m.target.open) openOrder.push(m.target);
      }
    });
    if (host && (!host.isConnected || muts.some(m => m.type === "attributes"))) queuePlace();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["open"], subtree: true, childList: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { tick(); wakeLock(Object.values(timers).some(t => t.endsAt && !isDone(t))); } });
  addEventListener("resize", queuePlace);

  load();
  const ready = () => render();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();

  Object.assign(api, { start, pause, resume, addTime, remove, rename, fromBoard, list: () => ordered(), _tick: tick });
})(typeof window !== "undefined" ? window : globalThis);
