// ============================================================================
// GOOD MORNING / TODAY SCREEN (js/today-screen.js)
// When the night clock switches off in the morning, the board opens on a
// summary of the day before the normal pages: the date and weather, what's on
// the calendar, tonight's dinner, how many jobs each person has, and the next
// countdown. "Start the day" (or a tap outside the cards) goes to the board;
// it also closes by itself after an hour.
//
//   showTodayScreen({ preview })   Settings > Sleep has a preview button
// ============================================================================
(function () {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const AUTO_CLOSE_MS = 60 * 60 * 1000;
  let autoCloseTimer = null;

  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const palette = (name) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#64748b" });
  const avatar = (name) => `<span class="today-avatar" style="background:${palette(name).primary}" aria-hidden="true">${esc(String(name).charAt(0).toUpperCase())}</span>`;

  function greeting(now) {
    const h = now.getHours();
    if (h < 12) return { text: "Good morning", icon: "☀️" };
    if (h < 18) return { text: "Good afternoon", icon: "🌤️" };
    return { text: "Good evening", icon: "🌙" };
  }

  // "9am", "12:30pm"
  function clockText(evt) {
    const mins = typeof window.getEventMinutes === "function" ? window.getEventMinutes(evt) : 0;
    const h = Math.floor(mins / 60) % 24, m = mins % 60;
    return `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
  }

  function eventsToday(today) {
    const key = window.getLocalDateKey(today);
    const dayName = DAY_NAMES[today.getDay()];
    return (window.familyEvents || [])
      .filter(e => e && typeof e === "object" && typeof window.isEventOnDate === "function" && window.isEventOnDate(e, key, dayName, today))
      .map(e => (typeof window.eventForDay === "function" ? window.eventForDay(e, today) : e))
      .map(e => ({ evt: e, allDay: !e.time || /all\s*day/i.test(e.time) }))
      .sort((a, b) => (a.allDay === b.allDay ? (window.getEventMinutes ? window.getEventMinutes(a.evt) - window.getEventMinutes(b.evt) : 0) : (a.allDay ? -1 : 1)));
  }

  function peopleIn(evt) {
    return String(evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(n => n && !/^(family|whole family|everyone)$/i.test(n));
  }

  function jobsToday(today) {
    if (typeof window.getTasksForColumn !== "function") return [];
    const cols = [...(window.familyMembers || []), "Up for grabs"];
    return cols.map(name => {
      const tasks = window.getTasksForColumn(name, today);
      const lower = name.toLowerCase();
      const left = tasks.filter(t => !(typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(t, today, lower))).length;
      return { name, total: tasks.length, left };
    }).filter(r => r.total > 0);
  }

  function render(preview) {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const g = greeting(now);
    const weather = (document.getElementById("calendar-weather-badge") || {}).textContent || "";

    // Calendar
    const events = eventsToday(today);
    const eventsHtml = events.length
      ? `<ul class="today-list">${events.map(({ evt, allDay }) => {
          const who = peopleIn(evt);
          return `<li class="today-row">
            <span class="today-time">${allDay ? "All day" : esc(clockText(evt))}</span>
            <span class="today-row-title">${esc(evt.icon || "📅")} ${esc(evt.title || "Event")}</span>
            <span class="today-avatars">${who.map(avatar).join("")}</span>
          </li>`;
        }).join("")}</ul>`
      : `<p class="today-empty">Nothing on the calendar today.</p>`;

    // Dinner
    const meal = typeof window.getMealForDate === "function" ? window.getMealForDate(today, "dinner") : null;
    const cooks = meal && meal.cook ? String(meal.cook).split(/,|&/).map(s => s.trim()).filter(n => n && (window.familyMembers || []).includes(n)) : [];
    const dinnerHtml = meal && meal.title
      ? `<p class="today-dinner">${esc(meal.emoji || "🍽️")} ${esc(meal.title)}</p>${cooks.length ? `<p class="today-sub">${cooks.map(avatar).join("")} ${esc(cooks.join(" & "))} cooking</p>` : ""}`
      : `<p class="today-empty">Not planned yet.</p>`;

    // Jobs
    const jobs = jobsToday(today);
    const jobsHtml = jobs.length
      ? `<ul class="today-list">${jobs.map(j => {
          const isGrab = j.name === "Up for grabs";
          const label = j.left === 0 ? "All done ✓" : `${j.left} ${j.left === 1 ? "job" : "jobs"}`;
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

    return `
      <div class="today-inner">
        <header class="today-head">
          <h2 class="today-greeting" id="today-screen-title">${g.text} ${g.icon}</h2>
          <p class="today-date">${DAY_NAMES[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}${weather.trim() ? ` · ${esc(weather.trim())}` : ""}</p>
          ${preview ? `<p class="today-preview-note">Preview: this shows each morning when the night clock switches off</p>` : ""}
        </header>
        <div class="today-grid">
          <section class="today-card today-card-events"><h3 class="today-card-title">📅 Today</h3>${eventsHtml}</section>
          <div class="today-col">
            <section class="today-card"><h3 class="today-card-title">🍽️ Dinner tonight</h3>${dinnerHtml}</section>
            <section class="today-card"><h3 class="today-card-title">✅ Jobs today</h3>${jobsHtml}</section>
            ${countdownHtml}
          </div>
        </div>
        <button type="button" class="today-start-btn" id="btn-today-start">Start the day</button>
      </div>`;
  }

  function closeTodayScreen() {
    const el = document.getElementById("today-screen");
    if (el) el.hidden = true;
    clearTimeout(autoCloseTimer);
  }
  window.closeTodayScreen = closeTodayScreen;

  function showTodayScreen({ preview = false } = {}) {
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
    el.innerHTML = render(preview);
    el.hidden = false;
    el.scrollTop = 0;
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(closeTodayScreen, AUTO_CLOSE_MS);
    setTimeout(() => { try { document.getElementById("btn-today-start").focus({ preventScroll: true }); } catch (err) {} }, 50);
  }
  window.showTodayScreen = showTodayScreen;

  // On unless a family switches it off (Settings > Sleep > Morning summary)
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
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("#btn-preview-today-screen")) showTodayScreen({ preview: true });
  });
})();
