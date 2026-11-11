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
        actions = `<button type="button" class="gcal-row-btn" data-gcal-connect="${esc(name)}" aria-label="Link ${esc(name)}'s calendar">Link</button>`;
      } else if (!p.ok) {
        status = `<span class="gcal-status is-problem">Needs a look</span>`;
        actions = `<button type="button" class="gcal-row-btn is-attention" data-gcal-connect="${esc(name)}" aria-label="Fix ${esc(name)}'s calendar link">Fix</button><button type="button" class="gcal-row-btn is-quiet" data-gcal-remove="${esc(name)}" aria-label="Unlink ${esc(name)}'s calendar">Unlink</button>`;
      } else {
        status = `<span class="gcal-status is-ok">Linked · ${p.count} event${p.count === 1 ? "" : "s"}</span>`;
        actions = `<button type="button" class="gcal-row-btn is-quiet" data-gcal-remove="${esc(name)}" aria-label="Unlink ${esc(name)}'s calendar">Unlink</button>`;
      }
      return `<div class="gcal-row ${p ? (p.ok ? "is-linked" : "is-problem") : ""}"${p && !p.ok && p.problem ? ` title="${esc(p.problem)}"` : ""}>
        <span class="gcal-face" style="background:${pal.primary}" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}${p && p.ok ? `<span class="gcal-face-g">G</span>` : ""}</span>
        <span class="gcal-words"><strong>${esc(name)}</strong>${status}</span>
        <span class="gcal-actions">${actions}</span>
      </div>`;
    }).join("") + `<p class="gcal-foot">🔒 Private and read-only. harmonee can see linked calendars, never change them.</p>`;
  }
  document.addEventListener("click", async (e) => {
    const c = e.target.closest && e.target.closest("[data-gcal-connect]");
    if (c) { openGuide(c.getAttribute("data-gcal-connect")); return; }
    const r = e.target.closest && e.target.closest("[data-gcal-remove]");
    if (r) {
      const name = r.getAttribute("data-gcal-remove");
      if (r.getAttribute("data-armed") !== "true") {
        r.setAttribute("data-armed", "true");
        r.textContent = "Sure?";
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
    empty: "Tap Paste, or paste the address in the box.",
    "not-a-link": "That's not the address. Go back to step 4 and tap the copy button.",
    public: "That's the <strong>Public</strong> address. Copy the <strong>Secret</strong> one, just below it.",
    "google-page": "That's a page link. Copy the <strong>Secret address in iCal format</strong> instead (step 4).",
    "not-calendar": "That's not a calendar address. Copy the <strong>Secret address in iCal format</strong> (step 4)."
  };

  // ---- The guide ---------------------------------------------------------------------------------------------
  // Written for someone who'd rather not be doing this: one short instruction
  // per step, a tick on each one, and everything we can do for them done for
  // them (which device they're on, step 1 ticks when they open Google, the
  // address is checked and linked the moment it's pasted).
  let guideFor = null;
  let device = "phone";
  let doneSteps = new Set();
  let linking = false;
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
    dlg.addEventListener("input", (e) => { if (e.target.matches("[data-gcal-paste-box]")) onPasted(); });
    dlg.addEventListener("paste", (e) => { if (e.target.matches && e.target.matches("[data-gcal-paste-box]")) setTimeout(onPasted, 0); });
    return dlg;
  }
  // Back from Google (step 1 done): bring "Paste it here" into view
  window.addEventListener("focus", () => {
    const dlg = document.getElementById("gcal-guide");
    if (!dlg || !dlg.open || linking || !doneSteps.has(0)) return;
    const paste = dlg.querySelector('[data-gcal-step="4"]');
    if (paste) paste.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  // A phone or tablet (iPads say they're Macs, but have touch screens)
  function isTouchDevice() {
    if (window.__SMOKE_DEVICE) return window.__SMOKE_DEVICE === "touch";
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const iPad = /Macintosh/.test(navigator.userAgent || "") && (navigator.maxTouchPoints || 0) > 1;
    return coarse || iPad || isPhone();
  }
  function openGuide(name) {
    guideFor = name;
    device = isTouchDevice() ? "phone" : "computer";
    doneSteps = new Set();
    linking = false;
    const dlg = guideDialog();
    dlg.querySelector("#gcal-guide-title").textContent = `Link ${name}'s calendar`;
    paintGuide();
    if (!dlg.open) dlg.showModal();
  }
  // The steps, as short as they can be
  function steps() {
    return [
      { title: "Open Google Calendar", body: `<a class="gcal-btn is-main gcal-open" data-gcal-open href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Open Google Calendar ↗</a>
          <p class="gcal-small">Sign in as ${esc(guideFor)} if asked.</p>` },
      { title: `Click ${esc(guideFor)}'s name`, body: `<p>It's on the left, under <strong>Settings for my calendars</strong>.</p>` },
      { title: "Scroll down to Integrate calendar", body: "" },
      { title: "Copy the secret address", body: `<div class="gcal-mock" aria-hidden="true"><span>Secret address in iCal format</span><span class="gcal-mock-copy">⧉</span></div>
          <p>Click the copy button next to <strong>Secret address in iCal format</strong>.</p>
          <div class="gcal-reassure"><span aria-hidden="true">🔒</span><p><strong>Google will say not to share it.</strong> That's to stop it reaching other people. harmonee keeps it locked away and only uses it to show ${esc(guideFor)}'s plans here, so it's fine to paste below.</p></div>` },
      { title: "Paste it here", body: `<button type="button" class="gcal-btn is-main is-big" data-gcal-paste>📋 Paste</button>
          <textarea class="gcal-paste-box" data-gcal-paste-box rows="2" placeholder="Or click here and press Ctrl+V (⌘V on a Mac)" aria-label="${esc(guideFor)}'s secret address" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
          <p class="gcal-check" data-gcal-check role="status"></p>` }
    ];
  }
  // A link that opens this guide for this person on a computer (#link-calendar/Sam)
  function computerLink() {
    const u = new URL(window.location.href);
    u.hash = `link-calendar/${encodeURIComponent(guideFor)}`;
    return u.href;
  }
  // Phones and tablets: Google keeps opening its app there, so this part is
  // done on a computer. Send the link over, or carry on anyway.
  function needsComputerHtml() {
    const link = computerLink();
    const subject = `Link ${guideFor}'s calendar to harmonee`;
    const body = `On a laptop or computer, open this link and follow the 5 short steps (about two minutes):\n\n${link}\n\nIf it asks for the family code, it's in harmonee: Settings → Access.`;
    return `
      <div class="gcal-computer">
        <span class="gcal-computer-icon" aria-hidden="true">💻</span>
        <h3>This part needs a computer</h3>
        <p>On a phone or tablet, Google keeps opening its own app instead of the page we need. On a laptop or computer it takes two minutes.</p>
        <a class="gcal-btn is-main is-big" data-gcal-email href="mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">✉️ Email me the link</a>
        <button type="button" class="gcal-btn is-big" data-gcal-copy-link>🔗 Copy the link</button>
        <p class="gcal-small" data-gcal-copied role="status">Open it on your computer and we'll take you straight to the steps.</p>
        <button type="button" class="gcal-switch" data-gcal-anyway>I'm on a computer, show me the steps</button>
      </div>`;
  }
  function paintGuide(state) {
    const body = document.querySelector("#gcal-guide [data-gcal-body]");
    if (!body) return;
    if (state && state.done) {
      body.innerHTML = `<div class="gcal-done">
        <span class="gcal-done-tick" aria-hidden="true">✓</span>
        <h3>All set!</h3>
        <p>${state.count ? `We found <strong>${state.count} event${state.count === 1 ? "" : "s"}</strong> on ${esc(guideFor)}'s calendar.` : `${esc(guideFor)}'s calendar is linked.`} They're on the family calendar now, with a small <span class="ev-g">G</span>.</p>
        <p class="gcal-small">New plans in Google show up here by themselves.</p>
        <button type="button" class="gcal-btn is-main is-big" data-gcal-finish>Done</button>
      </div>`;
      return;
    }
    if (state && state.working) {
      body.innerHTML = `<div class="gcal-done"><span class="gcal-spinner" aria-hidden="true"></span><h3>Linking ${esc(guideFor)}'s calendar…</h3><p class="gcal-small">Just a few seconds.</p></div>`;
      return;
    }
    if (device === "phone") { body.innerHTML = needsComputerHtml(); return; }
    const list = steps();
    const next = list.findIndex((_, i) => !doneSteps.has(i));
    body.innerHTML = `
      <p class="gcal-intro">See all of ${esc(guideFor)}'s plans on the family calendar.</p>
      <div class="gcal-safe" role="note">
        <span class="gcal-safe-lock" aria-hidden="true">🔒</span>
        <div><strong>Safe and private</strong>
          <span>harmonee can only <em>see</em> ${esc(guideFor)}'s calendar. It can never change anything, and the link is locked away on our secure server.</span></div>
      </div>
      <ol class="gcal-steps">
        ${list.map((st, i) => `
          <li class="gcal-step ${doneSteps.has(i) ? "is-done" : ""} ${i === next ? "is-next" : ""}" data-gcal-step="${i}">
            <button type="button" class="gcal-tick" data-gcal-tick="${i}" aria-pressed="${doneSteps.has(i)}" aria-label="Step ${i + 1}${doneSteps.has(i) ? ", done" : ", mark as done"}">${doneSteps.has(i) ? "✓" : i + 1}</button>
            <div class="gcal-step-words">
              <strong>${st.title}</strong>
              ${st.body}
            </div>
          </li>`).join("")}
      </ol>
      ${state && state.error ? `<p class="gcal-check is-bad">${state.error}</p>` : ""}
`;
  }
  function tick(i, on = true) {
    if (on) doneSteps.add(i); else doneSteps.delete(i);
    const typed = (document.querySelector("#gcal-guide [data-gcal-paste-box]") || {}).value || "";
    paintGuide();
    const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
    if (box && typed) box.value = typed;
  }
  function showCheck(r) {
    const out = document.querySelector("#gcal-guide [data-gcal-check]");
    if (!out) return;
    out.className = `gcal-check ${r.ok ? "is-good" : "is-bad"}`;
    out.innerHTML = r.ok ? "✓ That's the one. Linking…" : PROBLEMS[r.problem];
  }
  // Pasted (or typed): check it, and if it's right, link straight away
  function onPasted() {
    const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
    if (!box) return;
    const v = box.value.trim();
    const out = document.querySelector("#gcal-guide [data-gcal-check]");
    if (!v) { if (out) { out.innerHTML = ""; out.className = "gcal-check"; } return; }
    const r = checkLink(v);
    // The wrong address: open step 4 again so its instructions are right there
    if (!r.ok && r.problem !== "empty" && doneSteps.has(3)) {
      doneSteps.delete(3);
      paintGuide();
      const again = document.querySelector("#gcal-guide [data-gcal-paste-box]");
      if (again) again.value = box.value;
      showCheck(r);
      const msg = document.querySelector("#gcal-guide [data-gcal-check]");
      if (msg) msg.scrollIntoView({ block: "center" });
      return;
    }
    showCheck(r);
    if (r.ok) link(r.url);
  }
  async function link(url) {
    if (linking) return;
    linking = true;
    const name = guideFor;
    [0, 1, 2, 3, 4].forEach(i => doneSteps.add(i));
    paintGuide({ working: true });
    try {
      await saveLink(name, url);
      const out = await refresh("added");
      const mine = out && Array.isArray(out.results) ? out.results.find(x => x.member === name) : null;
      if (mine && !mine.ok) {
        doneSteps.delete(3); doneSteps.delete(4);
        paintGuide({ error: "Google didn't accept that address. Copy the <strong>Secret</strong> address again (step 4) and paste it." });
        return;
      }
      paintGuide({ done: true, count: mine ? mine.count : 0 });
    } catch (err) {
      doneSteps.delete(4);
      paintGuide({ error: "That didn't save. Check the Wi-Fi, then paste again." });
    } finally {
      linking = false;
    }
  }
  async function onGuideClick(e) {
    if (e.target.closest("[data-gcal-anyway]")) { device = "computer"; paintGuide(); return; }
    if (e.target.closest("[data-gcal-copy-link]")) {
      const note = document.querySelector("#gcal-guide [data-gcal-copied]");
      try { await navigator.clipboard.writeText(computerLink()); if (note) note.textContent = "✓ Copied. Paste it into an email or message to yourself, then open it on your computer."; }
      catch (err) { if (note) note.textContent = computerLink(); }
      return;
    }
    const t = e.target.closest("[data-gcal-tick]");
    if (t) { const i = +t.getAttribute("data-gcal-tick"); tick(i, !doneSteps.has(i)); return; }
    // Opening Google ticks step 1 (the link still opens in a new tab)
    if (e.target.closest("[data-gcal-open]")) { setTimeout(() => tick(0), 300); return; }
    if (e.target.closest("[data-gcal-paste]")) {
      const box = document.querySelector("#gcal-guide [data-gcal-paste-box]");
      try {
        const text = await navigator.clipboard.readText();
        if (box) { box.value = text; onPasted(); }
      } catch (err) {
        // The browser wouldn't let us read the clipboard: paste by hand
        const out = document.querySelector("#gcal-guide [data-gcal-check]");
        if (out) { out.className = "gcal-check"; out.innerHTML = "Press and hold in the box, then tap <strong>Paste</strong>."; }
        if (box) box.focus();
      }
      return;
    }
    if (e.target.closest("[data-gcal-finish]")) document.getElementById("gcal-guide").close();
  }

  // #link-calendar/Sam (from "Email me the link"): open Settings and the guide
  function fromAddress() {
    const m = String(location.hash || "").match(/^#link-calendar(?:\/(.+))?$/);
    if (!m) return;
    const name = m[1] ? decodeURIComponent(m[1]) : null;
    try { history.replaceState(history.state, "", location.pathname + location.search + "#calendar"); } catch (e) {}
    const go = () => {
      if (!(window.familyMembers || []).length) { setTimeout(go, 500); return; }
      if (typeof window.openSettingsModal === "function") window.openSettingsModal("calendars");
      const who = (window.familyMembers || []).find(n => n.toLowerCase() === String(name || "").toLowerCase());
      if (who) setTimeout(() => openGuide(who), 700);
    };
    setTimeout(go, 1200);
  }
  if (document.readyState === "complete") fromAddress(); else window.addEventListener("load", fromAddress);

  window.GoogleCalendar = { fromAddress, start, refresh, saveLink, removeLink, checkLink, openGuide, renderSettings, paintRefresh, connected, lastChecked, people: () => people, keyOf };
})();
