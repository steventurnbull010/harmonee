// ============================================================================
// GOOGLE CALENDAR INTO HARMONEE (js/google-calendar.js) · read-only, 11 Nov
//
// Each person can link their Google Calendar (or Outlook / iCloud) in
// Settings → Calendars, with a step-by-step guide written for people who
// don't live on computers. The server (functions/index.js) reads the linked
// calendars and saves each person's events in boards/{b}/externalEvents.
//
// Here:
//   - those events are kept in window.googleEvents, apart from the family's
//     own events, so they can never be saved into the board by mistake;
//     window.shownEvents() is both, for everything that shows events
//   - the calendar's ↻ button and "Google · 3 min ago"
//   - checking again when the calendar is on screen and the last check is
//     over 10 minutes old (nobody looking = no checking)
//   - Settings → Calendars, and the guide to finding the secret address
// ============================================================================
(function () {
  const REGION = "europe-west2";
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
  const AUTO_AFTER_MS = 10 * 60 * 1000; // check again when the calendar's on screen and it's been 10 minutes
  const TAP_GAP_MS = 60 * 1000;         // the server allows one check a minute per board
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(s) : String(s == null ? "" : s));
  const keyOf = (name) => String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "person";
  const boardId = () => (typeof window.getSaveBoardId === "function" ? window.getSaveBoardId() : null);
  const cacheKey = () => (typeof window.boardCacheKey === "function" ? window.boardCacheKey("harmonee_google_events") : "harmonee_google_events");
  const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;

  // ---- What we know -------------------------------------------------------------------------
  let people = {}; // key -> { member, ok, problem, count, checkedAt (ms), kind }
  window.googleEvents = [];
  (function fromCache() {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey()) || "null");
      if (c && Array.isArray(c.events)) { window.googleEvents = c.events; people = c.people || {}; }
    } catch (e) {}
  })();
  // Everything the calendar, Today and the chime show: the family's own
  // events and everyone's linked calendars
  window.shownEvents = () => [...(window.familyEvents || []), ...(window.googleEvents || [])];

  const connected = () => Object.keys(people).length > 0;
  const lastChecked = () => Object.values(people).reduce((m, p) => Math.max(m, p.checkedAt || 0), 0);
  function agoWords(ms) {
    if (!ms) return "";
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60);
    return h < 24 ? `${h} hour${h === 1 ? "" : "s"} ago` : "over a day ago";
  }

  // ---- Live from the board ----------------------------------------------------------------------
  let started = false;
  function start() {
    if (started || !window.db || !boardId() || typeof window.onSnapshot !== "function") return;
    started = true;
    try {
      window.onSnapshot(window.collection(window.db, "boards", boardId(), "externalEvents"), (snap) => {
        const next = {};
        const all = [];
        snap.forEach(d => {
          const v = d.data() || {};
          const at = v.checkedAt && typeof v.checkedAt.toMillis === "function" ? v.checkedAt.toMillis()
            : typeof v.checkedAt === "number" ? v.checkedAt
            : typeof v.checkedAt === "string" ? (Date.parse(v.checkedAt) || null) : null;
          next[d.id] = { member: v.member, ok: v.ok !== false, problem: v.problem || null, count: v.count || (v.events || []).length, checkedAt: at, kind: v.kind || "google" };
          (v.events || []).forEach(e => all.push({ ...e, member: v.member || e.member, source: "google", readOnly: true }));
        });
        people = next;
        window.googleEvents = all;
        try { localStorage.setItem(cacheKey(), JSON.stringify({ events: all, people })); } catch (e) {}
        redraw();
      }, (err) => console.warn("Couldn't read linked calendars:", err));
    } catch (e) { console.warn("Linked calendars unavailable:", e); }
    setInterval(maybeAutoRefresh, 60 * 1000);
    document.addEventListener("visibilitychange", maybeAutoRefresh);
    setTimeout(maybeAutoRefresh, 3000);
  }
  function redraw() {
    if (window.currentActiveView === "calendar" && typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
    paintRefresh();
    renderSettings();
  }

  // ---- Asking the server to check again -------------------------------------------------------------
  let refreshing = false;
  let lastAsked = 0;
  let retryTimer = null;
  async function callServer(why) {
    // Tests stand in for the server
    if (typeof window.__SMOKE_CAL_REFRESH === "function") return window.__SMOKE_CAL_REFRESH(boardId(), why);
    const app = window.firebaseApp;
    if (!app) throw new Error("offline");
    const f = await import(`${SDK}/firebase-functions.js`);
    const call = f.httpsCallable(f.getFunctions(app, REGION), "refreshCalendars", { timeout: 70000 });
    const res = await call({ boardId: boardId(), why });
    return res.data;
  }
  async function refresh(why = "tap") {
    if (refreshing) return null;
    const wait = TAP_GAP_MS - (Date.now() - lastAsked);
    if (wait > 0 && why !== "added" && why !== "removed") {
      paintRefresh("Checked a moment ago");
      return null;
    }
    refreshing = true;
    lastAsked = Date.now();
    paintRefresh();
    try {
      const out = await callServer(why);
      // Asked too soon after another device: try once more in a minute
      if (out && out.tooSoon) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => refresh("retry"), TAP_GAP_MS + 2000);
      }
      return out;
    } catch (e) {
      console.warn("Calendar check failed:", e);
      paintRefresh("Couldn't check just now");
      return { ok: false, error: e.message };
    } finally {
      refreshing = false;
      setTimeout(paintRefresh, 50);
    }
  }
  function calendarOnScreen() {
    const v = document.getElementById("view-calendar");
    return document.visibilityState !== "hidden" && !!(v && v.offsetParent !== null && window.currentActiveView === "calendar");
  }
  function maybeAutoRefresh() {
    if (!connected() || refreshing || !calendarOnScreen()) return;
    if (Date.now() - lastChecked() < AUTO_AFTER_MS || Date.now() - lastAsked < AUTO_AFTER_MS) return;
    refresh("auto");
  }

  // ---- The calendar bar's ↻ ---------------------------------------------------------------------------
  let note = "";
  let noteTimer = null;
  function paintRefresh(flash) {
    const btn = document.getElementById("cal-refresh");
    if (!btn) return;
    btn.hidden = !connected();
    if (flash) { note = flash; clearTimeout(noteTimer); noteTimer = setTimeout(() => { note = ""; paintRefresh(); }, 4000); }
    const when = document.getElementById("cal-refresh-when");
    const problems = Object.values(people).filter(p => !p.ok).length;
    btn.classList.toggle("is-busy", refreshing);
    btn.classList.toggle("has-problem", problems > 0);
    if (when) when.textContent = refreshing ? "Checking…" : (note || (problems ? "Needs a look" : `Google · ${agoWords(lastChecked()) || "not yet"}`));
    btn.setAttribute("aria-label", refreshing ? "Checking the linked calendars" : `Check the linked calendars now. Last checked ${agoWords(lastChecked()) || "not yet"}`);
  }
  setInterval(() => paintRefresh(), 30 * 1000);
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("#cal-refresh");
    if (!btn) return;
    if (Object.values(people).some(p => !p.ok) && !refreshing && Date.now() - lastAsked < TAP_GAP_MS) { openSettingsAtCalendars(); return; }
    refresh("tap");
  });
  function openSettingsAtCalendars() {
    if (typeof window.openSettingsModal === "function") window.openSettingsModal("calendars");
  }

  // ---- Settings → Calendars ------------------------------------------------------------------------------
  function renderSettings() {
    const box = document.getElementById("gcal-settings");
    if (!box) return;
    const members = window.familyMembers || [];
    box.innerHTML = members.map(name => {
      const p = people[keyOf(name)];
      const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#0284c7" };
      let status, actions;
      if (!p) {
        status = `<span class="gcal-status">Not linked</span>`;
        actions = `<button type="button" class="gcal-btn is-main" data-gcal-connect="${esc(name)}">Link ${esc(name)}'s calendar</button>`;
      } else if (!p.ok) {
        status = `<span class="gcal-status is-problem">⚠️ ${esc(p.problem || "Something went wrong")}</span>`;
        actions = `<button type="button" class="gcal-btn is-main" data-gcal-connect="${esc(name)}">Fix it</button><button type="button" class="gcal-btn" data-gcal-remove="${esc(name)}">Unlink</button>`;
      } else {
        status = `<span class="gcal-status is-ok">✓ Linked · ${p.count} event${p.count === 1 ? "" : "s"} · checked ${esc(agoWords(p.checkedAt) || "just now")}</span>`;
        actions = `<button type="button" class="gcal-btn" data-gcal-remove="${esc(name)}">Unlink</button>`;
      }
      return `<div class="gcal-row">
        <span class="gcal-face" style="background:${pal.primary}" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span>
        <span class="gcal-words"><strong>${esc(name)}</strong>${status}</span>
        <span class="gcal-actions">${actions}</span>
      </div>`;
    }).join("") + `<p class="gcal-foot">Their events show in their colour with a small <span class="ev-g">G</span>. They're read-only here: to change one, change it in Google. Changes usually show within a few minutes; tap ↻ on the calendar to check now.</p>`;
  }
  document.addEventListener("click", async (e) => {
    const c = e.target.closest && e.target.closest("[data-gcal-connect]");
    if (c) { openGuide(c.getAttribute("data-gcal-connect")); return; }
    const r = e.target.closest && e.target.closest("[data-gcal-remove]");
    if (r) {
      const name = r.getAttribute("data-gcal-remove");
      if (r.getAttribute("data-armed") !== "true") {
        r.setAttribute("data-armed", "true");
        r.textContent = "Tap again to unlink";
        setTimeout(() => { r.removeAttribute("data-armed"); r.textContent = "Unlink"; }, 4000);
        return;
      }
      await removeLink(name);
    }
  });
  // Draw it whenever Settings opens
  const settingsWatch = new MutationObserver(() => { const s = document.getElementById("settings-modal"); if (s && s.open) renderSettings(); });
  const watchSettings = () => { const s = document.getElementById("settings-modal"); if (s) settingsWatch.observe(s, { attributes: true, attributeFilter: ["open"] }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchSettings); else watchSettings();

  // ---- Saving and removing a link ------------------------------------------------------------------------
  function linksRef() { return window.doc(window.db, "boards", boardId(), "private", "calendarLinks"); }
  async function saveLink(name, url) {
    if (window.__SMOKE_CAL_SAVE) return window.__SMOKE_CAL_SAVE(name, url);
    if (!window.db || !boardId()) throw new Error("offline");
    await window.setDoc(linksRef(), { links: { [keyOf(name)]: { member: name, url, addedAt: new Date().toISOString() } }, updatedAt: window.serverTimestamp() }, { merge: true });
  }
  async function removeLink(name) {
    try {
      if (window.__SMOKE_CAL_SAVE) await window.__SMOKE_CAL_SAVE(name, null);
      else await window.setDoc(linksRef(), { links: { [keyOf(name)]: window.deleteField() }, updatedAt: window.serverTimestamp() }, { merge: true });
      // Gone from this screen straight away; the server tidies up its copy
      delete people[keyOf(name)];
      window.googleEvents = (window.googleEvents || []).filter(ev => ev.member !== name);
      redraw();
      refresh("removed");
    } catch (e) {
      if (typeof window.showCalendarToast === "function") window.showCalendarToast("Couldn't unlink that calendar. Check the connection and try again.");
    }
  }

  // ---- Checking what was pasted (same rules as the server, functions/ics.js) -----------------------------
  function checkLink(input) {
    let v = String(input || "").trim();
    if (!v) return { ok: false, problem: "empty" };
    // Pasted with words around it: find the link
    const found = v.match(/(https?|webcals?):\/\/\S+/i);
    if (found) v = found[0];
    v = v.replace(/^webcals?:\/\//i, "https://");
    let u;
    try { u = new URL(v); } catch (e) { return { ok: false, problem: "not-a-link" }; }
    if (u.protocol !== "https:") return { ok: false, problem: "not-a-link" };
    const host = u.hostname.toLowerCase();
    if (host === "calendar.google.com") {
      if (/\/calendar\/ical\/[^/]+\/public\//.test(u.pathname)) return { ok: false, problem: "public" };
      if (!/\/calendar\/ical\/[^/]+\/private-[^/]+\/basic\.ics$/.test(u.pathname)) return { ok: false, problem: "google-page" };
      return { ok: true, url: u.href, kind: "Google" };
    }
    if ((host === "outlook.live.com" || host === "outlook.office365.com") && /\.ics$/i.test(u.pathname)) return { ok: true, url: u.href, kind: "Outlook" };
    if (/^p\d+-caldav\.icloud\.com$/.test(host) || host === "caldav.icloud.com") return { ok: true, url: u.href, kind: "iCloud" };
    return { ok: false, problem: "not-calendar" };
  }
  const PROBLEMS = {
    empty: "Paste the link in the box first.",
    "not-a-link": "That isn't a link. Go back to step 4 and use the copy button next to <strong>Secret address in iCal format</strong>.",
    public: "That's the <strong>Public</strong> address, which won't work. Scroll a little further down to <strong>Secret address in iCal format</strong> and copy that one instead.",
    "google-page": "That's a link to a Google Calendar page, not the address. Go back to step 4 and copy the <strong>Secret address in iCal format</strong>.",
    "not-calendar": "That doesn't look like a calendar address. It should start with <strong>https://calendar.google.com/calendar/ical/</strong> and end with <strong>basic.ics</strong>."
  };

  // ---- The guide ---------------------------------------------------------------------------------------------
  let guideFor = null;
  function guideDialog() {
    let dlg = document.getElementById("gcal-guide");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "gcal-guide";
    dlg.className = "roster-dialog gcal-guide-dialog";
    dlg.setAttribute("aria-labelledby", "gcal-guide-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-gcal-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="gcal-guide-title" class="modal-title">Link a calendar</h2></div>
        <div class="gcal-guide" data-gcal-body></div>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.querySelector("[data-gcal-close]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", onGuideClick);
    dlg.addEventListener("input", (e) => { if (e.target.matches("[data-gcal-paste-box]")) liveCheck(); });
    return dlg;
  }
  let device = "phone";
  function openGuide(name) {
    guideFor = name;
    device = isPhone() ? "phone" : "computer";
    const dlg = guideDialog();
    dlg.querySelector("#gcal-guide-title").textContent = `Link ${name}'s calendar`;
    paintGuide();
    if (!dlg.open) dlg.showModal();
  }
  function stepsHtml() {
    const tap = device === "phone" ? "Tap" : "Click";
    const phoneFirst = device === "phone" ? `
      <li class="gcal-step"><span class="gcal-num">1</span><div>
        <strong>Open Google Calendar in the web browser</strong>
        <p>The Google Calendar app doesn't show what we need, so we'll use the website for a minute.</p>
        <a class="gcal-btn is-main gcal-open" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Open Google Calendar ↗</a>
        <p class="gcal-small">Sign in as ${esc(guideFor)} if it asks. If you see the phone version, switch to the full website: in Safari tap <strong>aA</strong> (or the page icon) in the address bar, then <strong>Request Desktop Website</strong>. In Chrome tap <strong>⋮</strong>, then <strong>Desktop site</strong>. You can pinch to zoom in.</p>
      </div></li>` : `
      <li class="gcal-step"><span class="gcal-num">1</span><div>
        <strong>Open Google Calendar's settings</strong>
        <a class="gcal-btn is-main gcal-open" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Open Google Calendar ↗</a>
        <p class="gcal-small">It opens in a new tab. Sign in as ${esc(guideFor)} if it asks.</p>
      </div></li>`;
    return `<ol class="gcal-steps">
      ${phoneFirst}
      <li class="gcal-step"><span class="gcal-num">2</span><div>
        <strong>${tap} ${esc(guideFor)}'s calendar on the left</strong>
        <p>Under <strong>Settings for my calendars</strong>, ${tap.toLowerCase()} the calendar with ${esc(guideFor)}'s name (it might be their email address).</p>
      </div></li>
      <li class="gcal-step"><span class="gcal-num">3</span><div>
        <strong>Scroll down to Integrate calendar</strong>
        <p>It's near the bottom of that page.</p>
      </div></li>
      <li class="gcal-step"><span class="gcal-num">4</span><div>
        <strong>Copy the Secret address in iCal format</strong>
        <p>${tap} the copy button (two little squares) next to <strong>Secret address in iCal format</strong>. If Google shows a warning, that's fine: ${tap.toLowerCase()} OK.</p>
        <p class="gcal-warn">Not the <em>Public address</em> one just above it. That won't work.</p>
      </div></li>
      <li class="gcal-step"><span class="gcal-num">5</span><div>
        <strong>Come back here and paste it</strong>
        <div class="gcal-paste">
          <textarea class="gcal-paste-box" data-gcal-paste-box rows="3" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="${esc(guideFor)}'s secret address" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
          <button type="button" class="gcal-btn" data-gcal-paste>📋 Paste</button>
        </div>
        <p class="gcal-check" data-gcal-check role="status"></p>
        <button type="button" class="gcal-btn is-main is-big" data-gcal-link>Link ${esc(guideFor)}'s calendar</button>
      </div></li>
    </ol>`;
  }
  function paintGuide(state) {
    const body = document.querySelector("#gcal-guide [data-gcal-body]");
    if (!body) return;
    if (state && state.done) {
      body.innerHTML = `<div class="gcal-done">
        <span class="gcal-done-tick" aria-hidden="true">✓</span>
        <h3>${esc(guideFor)}'s calendar is linked</h3>
        <p>${state.count ? `We found <strong>${state.count} event${state.count === 1 ? "" : "s"}</strong>.` : "It's linked. If there's nothing on it yet, that's fine."} They'll show on the calendar in ${esc(guideFor)}'s colour with a small <span class="ev-g">G</span>.</p>
        <p class="gcal-small">Changes in Google usually show here within a few minutes. To check straight away, tap ↻ on the calendar.</p>
        <button type="button" class="gcal-btn is-main is-big" data-gcal-finish>Done</button>
      </div>`;
      return;
    }
    if (state && state.working) {
      body.innerHTML = `<div class="gcal-done"><span class="gcal-spinner" aria-hidden="true"></span><h3>Checking ${esc(guideFor)}'s calendar…</h3><p>This takes a few seconds.</p></div>`;
      return;
    }
    body.innerHTML = `
      <p class="gcal-intro">This brings ${esc(guideFor)}'s Google Calendar into harmonee, so everything ${esc(guideFor)} has on shows here too. It takes about two minutes, and you only do it once.</p>
      <div class="drawer-segmented-pills gcal-device" role="radiogroup" aria-label="What are you using?">
        <button type="button" class="drawer-pill-segment ${device === "phone" ? "active" : ""}" data-gcal-device="phone" role="radio" aria-checked="${device === "phone"}">📱 A phone</button>
        <button type="button" class="drawer-pill-segment ${device === "computer" ? "active" : ""}" data-gcal-device="computer" role="radio" aria-checked="${device === "computer"}">💻 A computer or iPad</button>
      </div>
      ${stepsHtml()}
      ${state && state.error ? `<p class="gcal-check is-bad">${state.error}</p>` : ""}
      <details class="gcal-private">
        <summary>🔒 Is this private?</summary>
        <p>The secret address lets harmonee <strong>see</strong> ${esc(guideFor)}'s calendar, never change it. It's kept privately on harmonee's server and never shown again, even here. To stop it any time, tap <strong>Unlink</strong> in Settings, or <strong>Reset</strong> next to the secret address in Google.</p>
        <p>Using Outlook or an iPhone's calendar instead? Paste its calendar address (it ends in <strong>.ics</strong>) in step 5 the same way.</p>
      </details>`;
  }
  function liveCheck() {
    const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
    const out = document.querySelector("#gcal-guide [data-gcal-check]");
    if (!box || !out) return null;
    const v = box.value.trim();
    if (!v) { out.innerHTML = ""; out.className = "gcal-check"; return null; }
    const r = checkLink(v);
    out.className = `gcal-check ${r.ok ? "is-good" : "is-bad"}`;
    out.innerHTML = r.ok ? `✓ That's the right kind of address (${r.kind}).` : PROBLEMS[r.problem];
    return r;
  }
  async function onGuideClick(e) {
    const dev = e.target.closest("[data-gcal-device]");
    if (dev) {
      const typed = (document.querySelector("#gcal-guide [data-gcal-paste-box]") || {}).value || "";
      device = dev.getAttribute("data-gcal-device");
      paintGuide();
      const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
      if (box && typed) { box.value = typed; liveCheck(); }
      return;
    }
    if (e.target.closest("[data-gcal-paste]")) {
      const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
      try {
        const text = await navigator.clipboard.readText();
        if (box) { box.value = text; liveCheck(); }
      } catch (err) {
        // The browser said no: show how to paste by hand
        const out = document.querySelector("#gcal-guide [data-gcal-check]");
        if (out) { out.className = "gcal-check"; out.innerHTML = "Press and hold in the box above, then tap <strong>Paste</strong>."; }
        if (box) box.focus();
      }
      return;
    }
    if (e.target.closest("[data-gcal-link]")) {
      const r = liveCheck() || checkLink("");
      if (!r.ok) {
        const out = document.querySelector("#gcal-guide [data-gcal-check]");
        if (out && !out.innerHTML) { out.className = "gcal-check is-bad"; out.innerHTML = PROBLEMS[r.problem]; }
        return;
      }
      const name = guideFor;
      paintGuide({ working: true });
      try {
        await saveLink(name, r.url);
        const out = await refresh("added");
        const mine = out && Array.isArray(out.results) ? out.results.find(x => x.member === name) : null;
        if (mine && !mine.ok) {
          paintGuide({ error: "Google wouldn't let us read that address. Check it's the <strong>Secret</strong> address and copy it again (step 4). If it still doesn't work, tap Reset next to it in Google, then copy the new one." });
          return;
        }
        paintGuide({ done: true, count: mine ? mine.count : 0 });
      } catch (err) {
        paintGuide({ error: "We couldn't save that just now. Check the Wi-Fi and try again." });
      }
      return;
    }
    if (e.target.closest("[data-gcal-finish]")) document.getElementById("gcal-guide").close();
  }

  window.GoogleCalendar = { start, refresh, saveLink, removeLink, checkLink, openGuide, renderSettings, paintRefresh, connected, lastChecked, people: () => people, keyOf };
})();
