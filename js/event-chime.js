// ============================================================================
// EVENT CHIME (js/event-chime.js)
// A soft chime and a banner a little before each of today's timed events:
// "🏊 Swimming in 15 minutes · 4:30pm · Jo". For the kitchen tablet, which is
// on all day, so it needs no server and no phone notifications.
//
// Set per device (Settings > Display > Chime before events): 5, 10, 15 or 30
// minutes, or none. Until it's set, tablet-sized touch screens chime 15
// minutes before and phones and computers don't (they're not in the kitchen,
// and would all chime at once).
//
// Each event chimes once per day, even if the page reloads. Not while the
// night clock is up, or the screen is off (the browser pauses the page).
// ============================================================================
(function () {
  const KEY = "harmonee_event_chime_minutes";
  const DONE_KEY = "harmonee_event_chime_done";
  const SHOW_MS = 2 * 60 * 1000;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  let hideTimer = null;

  // Minutes before an event to chime (0 = off)
  function lead() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved !== null && saved !== "") return Math.max(0, parseInt(saved, 10) || 0);
    const tablet = typeof window.matchMedia === "function" && window.matchMedia("(min-width: 900px) and (pointer: coarse)").matches;
    return tablet ? 15 : 0;
  }

  // Events already chimed today, so a reload doesn't chime them again
  function doneToday(todayKey) {
    try {
      const d = JSON.parse(localStorage.getItem(DONE_KEY) || "{}");
      return d && d.day === todayKey && Array.isArray(d.ids) ? d.ids : [];
    } catch (e) { return []; }
  }
  function markDone(todayKey, id) {
    const ids = doneToday(todayKey);
    if (!ids.includes(id)) ids.push(id);
    try { localStorage.setItem(DONE_KEY, JSON.stringify({ day: todayKey, ids })); } catch (e) {}
  }

  const shown = (id) => { const x = document.getElementById(id); return !!(x && !x.hidden && x.offsetParent !== null && getComputedStyle(x).display !== "none"); };
  const clock = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };

  // Today's timed events starting within the next `minutes`, not yet chimed
  function due(now, minutes) {
    if (!minutes || typeof window.isEventOnDate !== "function" || typeof window.getEventMinutes !== "function") return [];
    const todayKey = typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(now) : "";
    const dayName = DAYS[now.getDay()];
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const done = doneToday(todayKey);
    return (window.shownEvents ? window.shownEvents() : (window.familyEvents || [])).filter(e => {
      if (!e || !e.id || done.includes(e.id)) return false;
      const t = String(e.time || "").trim().toLowerCase();
      if (!t || t === "all day" || /all\s*day/i.test(String(e.duration || ""))) return false;
      if (!window.isEventOnDate(e, todayKey, dayName, now)) return false;
      const until = window.getEventMinutes(e) - nowMins;
      return until > 0 && until <= minutes;
    }).map(e => ({ evt: e, until: window.getEventMinutes(e) - nowMins, todayKey }));
  }

  function banner({ evt, until }) {
    let el = document.getElementById("event-chime-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "event-chime-banner";
      el.className = "event-chime-banner";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.addEventListener("click", () => hide());
      document.body.appendChild(el);
    }
    const who = String(evt.member || "").trim();
    const start = window.getEventMinutes(evt);
    el.innerHTML = `
      <span class="event-chime-icon" aria-hidden="true">${esc(evt.icon || "📅")}</span>
      <span class="event-chime-text">
        <strong>${esc(evt.title || "Event")} in ${until} minute${until === 1 ? "" : "s"}</strong>
        <small>${esc(clock(start))}${who && who !== "Family" ? ` · ${esc(who)}` : ""}${evt.location ? ` · ${esc(evt.location)}` : ""}</small>
      </span>
      <button type="button" class="event-chime-close" aria-label="Close">✕</button>`;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-in"));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, SHOW_MS);
  }
  function hide() {
    const el = document.getElementById("event-chime-banner");
    if (!el) return;
    el.classList.remove("is-in");
    setTimeout(() => { el.hidden = true; }, 250);
  }

  function check(now = new Date()) {
    const minutes = lead();
    if (!minutes || document.hidden) return [];
    if (shown("ambient-sleep-overlay") || shown("board-join-screen")) return [];
    const list = due(now, minutes).sort((a, b) => a.until - b.until);
    if (!list.length) return [];
    list.forEach(x => markDone(x.todayKey, x.evt.id));
    banner(list[0]); // the soonest; the others are marked so they don't pile up
    if (window.sfx && window.sfx.playReminderChime) window.sfx.playReminderChime();
    return list;
  }

  setInterval(() => check(), 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });

  // Settings > Display: this device's choice
  function renderSettings() {
    const sel = document.getElementById("settings-event-chime");
    if (sel) sel.value = String(lead());
  }
  document.addEventListener("change", (e) => {
    if (!e.target || e.target.id !== "settings-event-chime") return;
    try { localStorage.setItem(KEY, String(parseInt(e.target.value, 10) || 0)); } catch (err) {}
    // Let the family hear what it sounds like
    if (parseInt(e.target.value, 10) && window.sfx && window.sfx.playReminderChime) window.sfx.playReminderChime();
  });

  window.EventChime = { check, due, lead, renderSettings, hide };
})();
