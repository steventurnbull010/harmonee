// ============================================================================
// TODAY AT A GLANCE (js/today-screen.js)
// A calm summary of the day: the date and weather, what's on the calendar,
// tonight's dinner, how many jobs each person has left, and the next
// countdown. It follows the time of day:
//   morning    "Good morning", warm colours, "Start the day"
//   afternoon  "Good afternoon": finished events fade, the next is marked
//   evening    "Good evening", dusk colours, plus a Tomorrow card
// It opens by itself when the night clock wakes up, and any time from the
// "h" logo or the family name at the top of a page. It keeps itself up to
// date every minute while open, and closes by itself after an hour.
//
//   showTodayScreen({ from: "wake" | "logo" | "preview" })
// ============================================================================
(function () {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const AUTO_CLOSE_MS = 60 * 60 * 1000;
  let autoCloseTimer = null;
  let refreshTimer = null;
  let openedFrom = "wake";

  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const palette = (name) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#64748b" });
  const avatar = (name) => `<span class="today-avatar" style="background:${palette(name).primary}" aria-hidden="true">${esc(String(name).charAt(0).toUpperCase())}</span>`;
  const startMins = (evt) => (typeof window.getEventMinutes === "function" ? window.getEventMinutes(evt) : 0);

  function partOfDay(now) {
    const h = now.getHours();
    if (h < 12) return { key: "morning", text: "Good morning", icon: "☀️" };
    if (h < 18) return { key: "afternoon", text: "Good afternoon", icon: "🌤️" };
    return { key: "evening", text: "Good evening", icon: "🌙" };
  }

  // "9am", "12:30pm"
  function clockText(evt) {
    const mins = startMins(evt);
    const h = Math.floor(mins / 60) % 24, m = mins % 60;
    return `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
  }

  // An event's length in minutes ("1.5 hours", "45 mins"); 60 if unknown
  function lengthMins(evt) {
    const m = String(evt.duration || "1 hour").match(/(\d+(?:\.\d+)?)\s*(h|hour|hr|min|m)/i);
    if (!m) return 60;
    return /^m/i.test(m[2]) ? Math.round(parseFloat(m[1])) : Math.round(parseFloat(m[1]) * 60);
  }

  function eventsOn(day) {
    const key = window.getLocalDateKey(day);
    const dayName = DAY_NAMES[day.getDay()];
    return (window.familyEvents || [])
      .filter(e => e && typeof e === "object" && typeof window.isEventOnDate === "function" && window.isEventOnDate(e, key, dayName, day))
      .map(e => (typeof window.eventForDay === "function" ? window.eventForDay(e, day) : e))
      .map(e => ({ evt: e, allDay: !e.time || /all\s*day/i.test(e.time) }))
      .sort((a, b) => (a.allDay === b.allDay ? startMins(a.evt) - startMins(b.evt) : (a.allDay ? -1 : 1)));
  }

  function peopleIn(evt) {
    return String(evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(n => n && !/^(family|whole family|everyone)$/i.test(n));
  }

  function jobsOn(day) {
    if (typeof window.getTasksForColumn !== "function") return [];
    const cols = [...(window.familyMembers || []), "Up for grabs"];
    return cols.map(name => {
      const tasks = window.getTasksForColumn(name, day);
      const lower = name.toLowerCase();
      const left = tasks.filter(t => !(typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(t, day, lower))).length;
      return { name, total: tasks.length, left };
    }).filter(r => r.total > 0);
  }

  function dinnerOn(day) {
    const meal = typeof window.getMealForDate === "function" ? window.getMealForDate(day, "dinner") : null;
    const cooks = meal && meal.cook ? String(meal.cook).split(/,|&/).map(s => s.trim()).filter(n => n && (window.familyMembers || []).includes(n)) : [];
    return meal && meal.title ? { meal, cooks } : null;
  }

  // Today's events. When "isToday", finished ones fade and the next (or the
  // one happening now) is marked.
  function eventsListHtml(events, nowMins, isToday) {
    if (!events.length) return `<p class="today-empty">${isToday ? "Nothing on the calendar today." : "Nothing on the calendar."}</p>`;
    let markedNext = false;
    return `<ul class="today-list">${events.map(({ evt, allDay }) => {
      let state = "";
      let badge = "";
      if (isToday && !allDay) {
        const start = startMins(evt);
        const end = start + lengthMins(evt);
        if (end <= nowMins) state = " is-past";
        else if (!markedNext) {
          markedNext = true;
          badge = `<span class="today-badge${start <= nowMins ? " is-now" : ""}">${start <= nowMins ? "Now" : "Next"}</span>`;
        }
      }
      return `<li class="today-row${state}">
        <span class="today-time">${allDay ? "All day" : esc(clockText(evt))}</span>
        <span class="today-row-title">${esc(evt.icon || "📅")} ${esc(evt.title || "Event")}${badge}</span>
        <span class="today-avatars">${peopleIn(evt).map(avatar).join("")}</span>
      </li>`;
    }).join("")}</ul>`;
  }

  function dinnerHtml(d) {
    if (!d) return `<p class="today-empty">Not planned yet.</p>`;
    return `<p class="today-dinner">${esc(d.meal.emoji || "🍽️")} ${esc(d.meal.title)}</p>${d.cooks.length ? `<p class="today-sub">${d.cooks.map(avatar).join("")} ${esc(d.cooks.join(" & "))} cooking</p>` : ""}`;
  }

  function render() {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const part = partOfDay(now);
    const weather = (document.getElementById("calendar-weather-badge") || {}).textContent || "";

    // Jobs
    const jobs = jobsOn(today);
    const jobsHtml = jobs.length
      ? `<ul class="today-list">${jobs.map(j => {
          const isGrab = j.name === "Up for grabs";
          const label = j.left === 0 ? "All done ✓" : `${j.left} ${j.left === 1 ? "job" : "jobs"} left`;
          return `<li class="today-row">
            ${isGrab ? `<span class="today-avatar is-grab" aria-hidden="true">+</span>` : avatar(j.name)}
            <span class="today-row-title">${isGrab ? "Grab it" : esc(j.name)}</span>
            <span class="today-count${j.left === 0 ? " is-done" : ""}">${label}</span>
          </li>`;
        }).join("")}</ul>`
      : `<p class="today-empty">No jobs today.</p>`;

    // Next countdown
    const next = typeof window.getUpcomingCountdowns === "function" ? window.getUpcomingCountdowns()[0] : null;
    const countdownHtml = next
      ? `<div class="today-card today-countdown"><span class="today-countdown-num">${next.days === 0 ? "🎉" : next.days}</span><span><strong>${esc(next.evt.icon || "⏳")} ${esc(next.evt.title || "")}</strong><br><span class="today-sub">${next.days === 0 ? "Today!" : next.days === 1 ? "1 sleep to go" : `${next.days} sleeps to go`}</span></span></div>`
      : "";

    // Evening: a look at tomorrow
    let tomorrowHtml = "";
    if (part.key === "evening") {
      const tEvents = eventsOn(tomorrow);
      const tDinner = dinnerOn(tomorrow);
      tomorrowHtml = `<section class="today-card today-card-tomorrow">
        <h3 class="today-card-title">🌅 Tomorrow · ${DAY_NAMES[tomorrow.getDay()]}</h3>
        ${eventsListHtml(tEvents, 0, false)}
        <p class="today-sub today-tomorrow-dinner">🍽️ ${tDinner ? `${esc(tDinner.meal.title)}${tDinner.cooks.length ? ` · ${esc(tDinner.cooks.join(" & "))} cooking` : ""}` : "Dinner not planned yet"}</p>
      </section>`;
    }

    const buttonText = openedFrom === "wake" ? "Start the day" : openedFrom === "preview" ? "Close preview" : "Back to the board";

    return `
      <div class="today-inner">
        <header class="today-head">
          <h2 class="today-greeting" id="today-screen-title">${part.text} ${part.icon}</h2>
          <p class="today-date">${DAY_NAMES[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}${weather.trim() ? ` · ${esc(weather.trim())}` : ""}</p>
          ${openedFrom === "preview" ? `<p class="today-preview-note">Preview: this opens each morning when the night clock switches off, and any time you tap the "h"</p>` : ""}
        </header>
        <div class="today-grid">
          <div class="today-col">
            <section class="today-card today-card-events"><h3 class="today-card-title">📅 Today</h3>${eventsListHtml(eventsOn(today), nowMins, true)}</section>
            ${tomorrowHtml}
          </div>
          <div class="today-col">
            <section class="today-card"><h3 class="today-card-title">🍽️ Dinner tonight</h3>${dinnerHtml(dinnerOn(today))}</section>
            <section class="today-card"><h3 class="today-card-title">✅ Jobs today</h3>${jobsHtml}</section>
            ${countdownHtml}
          </div>
        </div>
        <button type="button" class="today-start-btn" id="btn-today-start">${buttonText}</button>
      </div>`;
  }

  function paint(el) {
    const part = partOfDay(new Date()).key;
    el.classList.remove("is-morning", "is-afternoon", "is-evening");
    el.classList.add(`is-${part}`);
    const scroll = el.scrollTop;
    el.innerHTML = render();
    el.scrollTop = scroll;
  }

  function closeTodayScreen() {
    const el = document.getElementById("today-screen");
    if (el) el.hidden = true;
    clearTimeout(autoCloseTimer);
    clearInterval(refreshTimer);
  }
  window.closeTodayScreen = closeTodayScreen;

  function showTodayScreen({ from = "wake", preview = false } = {}) {
    openedFrom = preview ? "preview" : from;
    let el = document.getElementById("today-screen");
    if (!el) {
      el = document.createElement("div");
      el.id = "today-screen";
      el.className = "today-screen";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "today-screen-title");
      document.body.appendChild(el);
      el.addEventListener("click", (e) => {
        // The button, or a tap outside the cards
        if (e.target.closest("#btn-today-start") || !e.target.closest(".today-card")) closeTodayScreen();
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) closeTodayScreen(); });
    }
    // Opened from Settings: close Settings first so it doesn't sit on top
    document.querySelectorAll("dialog[open]").forEach(d => { try { d.close(); } catch (err) {} });
    el.scrollTop = 0;
    paint(el);
    el.hidden = false;
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(closeTodayScreen, AUTO_CLOSE_MS);
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!el.hidden) paint(el); }, 60000); // times, "Next", jobs left
    setTimeout(() => { try { document.getElementById("btn-today-start").focus({ preventScroll: true }); } catch (err) {} }, 50);
  }
  window.showTodayScreen = showTodayScreen;

  // On unless a family switches it off (Settings > Sleep > Morning summary).
  // That switch only affects the automatic morning one; the "h" always works.
  const isEnabled = () => (window.boardSettings || {}).todayScreenEnabled !== false;
  window.isTodayScreenEnabled = isEnabled;

  // Settings: keep the switch in step when Settings opens, save on change
  window.syncTodayScreenSetting = () => {
    const box = document.getElementById("settings-today-enabled");
    if (box) box.checked = isEnabled();
  };
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "settings-today-enabled" && typeof window.saveBoardSettingsNow === "function") {
      window.saveBoardSettingsNow({ todayScreenEnabled: e.target.checked });
    }
  });

  // Ways in: the preview button in Settings, the "h" logo (sidebar), and the
  // family name at the top of each page (the only way in on portrait / phone,
  // where the sidebar becomes a bottom tab bar without the logo)
  const OPENERS = "#sidebar-brand-mark, .skylight-single-header .calendar-family-title";
  document.addEventListener("click", (e) => {
    if (!e.target.closest) return;
    if (e.target.closest("#btn-preview-today-screen")) { showTodayScreen({ preview: true }); return; }
    if (e.target.closest(OPENERS)) showTodayScreen({ from: "logo" });
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest(".skylight-single-header .calendar-family-title")) {
      e.preventDefault();
      showTodayScreen({ from: "logo" });
    }
  });
  const markOpeners = () => document.querySelectorAll(".skylight-single-header .calendar-family-title").forEach(t => {
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("title", "Today at a glance");
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markOpeners); else markOpeners();
})();
