// ============================================================================
// TODAY AT A GLANCE (js/today-screen.js)
// A calm summary of the day: the date and weather, what's on the calendar,
// tonight's dinner, how many jobs each person has left, and the next
// countdown. It follows the time of day:
//   morning    "Good morning", warm colours, "Start the day"
//   afternoon  "Good afternoon": finished events fade, the next is marked
//   evening    "Good evening", dusk colours, plus a Tomorrow card
// It opens by itself when the night clock wakes up, and any time from the
// "h" logo or the family name at the top of a page, and (if a family turns
// it on in Settings > Display) after the board has been left alone. It keeps
// itself up to date every minute while open.
//
//   showTodayScreen({ from: "wake" | "logo" | "idle" | "preview" })
// ============================================================================
(function () {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const AUTO_CLOSE_MS = 60 * 60 * 1000;
  let autoCloseTimer = null;
  let refreshTimer = null;
  let openedFrom = "wake";
  const expandedJobs = new Set(); // people whose jobs are shown (kept across refreshes)

  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const palette = (name) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#64748b" });
  const avatar = (name) => `<span class="today-avatar" style="background:${palette(name).primary}" aria-hidden="true">${esc(String(name).charAt(0).toUpperCase())}</span>`;
  const startMins = (evt) => (typeof window.getEventMinutes === "function" ? window.getEventMinutes(evt) : 0);

  function partOfDay(now) {
    const h = now.getHours();
    // A friendly wave, not a weather symbol: the weather has its own place on
    // the date line, and "Good afternoon ☀️" would be wrong on a rainy day
    if (h < 12) return { key: "morning", text: "Good morning", icon: "👋" };
    if (h < 18) return { key: "afternoon", text: "Good afternoon", icon: "👋" };
    return { key: "evening", text: "Good evening", icon: "👋" };
  }

  // "9am", "12:30pm"
  function clockText(evt) {
    const mins = startMins(evt);
    const h = Math.floor(mins / 60) % 24, m = mins % 60;
    return `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
  }

  // "9am – 5pm", "9:45 – 11:45am" (am/pm once when both are the same), like
  // the calendar's event cards
  function rangeText(evt) {
    const start = startMins(evt);
    const end = start + lengthMins(evt);
    const fmt = (mins, withPeriod) => {
      const h = Math.floor(mins / 60) % 24, m = Math.round(mins % 60);
      return `${h % 12 === 0 ? 12 : h % 12}${m ? ":" + String(m).padStart(2, "0") : ""}${withPeriod ? (h >= 12 ? "pm" : "am") : ""}`;
    };
    const samePeriod = (Math.floor(start / 60) % 24 >= 12) === (Math.floor(end / 60) % 24 >= 12);
    return `${fmt(start, !samePeriod)} – ${fmt(end, true)}`;
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
      const isDone = (t) => typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(t, day, lower);
      const items = tasks.map(t => ({ task: t, done: isDone(t) })).sort((a, b) => a.done - b.done); // to do first
      const left = items.filter(i => !i.done).length;
      return { name, total: tasks.length, left, items };
    }).filter(r => r.total > 0);
  }

  function dinnerOn(day) {
    const meal = typeof window.getMealForDate === "function" ? window.getMealForDate(day, "dinner") : null;
    const cooks = meal && meal.cook ? String(meal.cook).split(/,|&/).map(s => s.trim()).filter(n => n && (window.familyMembers || []).includes(n)) : [];
    if (!(meal && meal.title)) return null;
    // Its photo: the meal's own, else its recipe's (only an exact recipe -
    // a home-made "Chicken" mustn't borrow some other chicken dish's picture)
    let photo = meal.image || meal.imageUrl || null;
    if (!photo && typeof window.findRecipeByIdOrTitle === "function") {
      const r = window.findRecipeByIdOrTitle(meal.recipeId || meal.title);
      if (r && (r.id === meal.recipeId || String(r.title).toLowerCase() === String(meal.title).toLowerCase())) photo = r.image || r.imageUrl || null;
    }
    return { meal, cooks, photo };
  }

  // Today's events. When "isToday", finished ones fade. (No "Next"/"Now" badge:
  // the next event is only "next" for the people going to it.)
  function eventsListHtml(events, nowMins, isToday) {
    if (!events.length) return `<p class="today-empty">${isToday ? "Nothing on the calendar today." : "Nothing on the calendar."}</p>`;
    return `<ul class="today-list">${events.map(({ evt, allDay }) => {
      let state = "";
      if (isToday && !allDay && startMins(evt) + lengthMins(evt) <= nowMins) state = " is-past";
      return `<li class="today-row${state}">
        <span class="today-time">${allDay ? "All day" : esc(rangeText(evt))}</span>
        <span class="today-row-title">${esc(evt.icon || "📅")} ${esc(evt.title || "Event")}</span>
        <span class="today-avatars">${peopleIn(evt).map(avatar).join("")}</span>
      </li>`;
    }).join("")}</ul>`;
  }

  function dinnerHtml(d) {
    if (!d) return `<p class="today-empty">Not planned yet.</p><div class="today-card-foot">${addBtn("data-plan-dinner", "Plan dinner")}</div>`;
    // "Chef: Steven", "Chefs: Steven & Sorcha", "Chefs: Steven, Sorcha, Ava & Dara"
    const n = d.cooks.length;
    const names = n <= 1 ? d.cooks.join("") : `${d.cooks.slice(0, -1).join(", ")} & ${d.cooks[n - 1]}`;
    const shown = d.cooks.slice(0, 4);
    const chefs = n ? `<p class="today-chefs">
        <span class="today-avatars">${shown.map(avatar).join("")}${n > 4 ? `<span class="today-avatar is-more" aria-hidden="true">+${n - 4}</span>` : ""}</span>
        <span class="today-chefs-text"><span class="today-chefs-label">${n === 1 ? "Chef" : "Chefs"}:</span> ${esc(names)}</span>
      </p>` : "";
    return `<div class="today-dinner-wrap${d.photo ? " has-photo" : ""}">
      ${d.photo ? `<img class="today-dinner-photo" src="${esc(d.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="today-dinner-text">
        <p class="today-dinner">${d.photo ? "" : `${esc(d.meal.emoji || "🍽️")} `}${esc(d.meal.title)}</p>
        ${chefs}
      </div>
    </div>`;
  }

  // Every "add" on this screen looks the same: a soft sky-blue pill with a "+"
  // (the "+" is drawn, so it sits exactly in the middle of its circle)
  const PLUS_ICON = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  window.TODAY_PLUS_ICON = PLUS_ICON;
  const addBtn = (attrs, label) => `<button type="button" class="today-add-btn" ${attrs}><span class="today-add-plus" aria-hidden="true">${PLUS_ICON}</span> ${label}</button>`;

  // ---- Which cards show (Customise; saved for the whole board) ----------------
  const CARDS = [
    { key: "events",    label: "Today's plans",        icon: "📅" },
    { key: "tomorrow",  label: "Tomorrow's first thing", icon: "🌅", note: "Mornings and afternoons" },
    { key: "countdown", label: "Countdown",            icon: "⏳" },
    { key: "music",     label: "Music",                icon: "🎵" },
    { key: "weather",   label: "Weather",              icon: "🌦️", note: "Uses the town in Settings › Display" },
    { key: "films",     label: "Watch together",       icon: "🍿", note: "Films and series on your streaming services", when: () => !!(window.FilmNight && window.FilmNight.ready()) },
    { key: "dinner",    label: "Dinner tonight",       icon: "🍽️" },
    { key: "groceries", label: "Groceries",            icon: "🛒" },
    { key: "jobs",      label: "Tasks today",          icon: "✅" }
  ];
  const cardOn = (key) => (((window.boardSettings || {}).todayCards) || {})[key] !== false;

  // ---- Card order (Make it yours, ↑ ↓): one list in screen order. On tablets
  // and computers the "|" splits it into the left and right columns; on phones
  // the cards simply stack in this order. Saved for the whole board as
  // boardSettings.todayLayout; cards added to harmonee later join their usual side.
  const DEFAULT_LAYOUT = ["events", "tomorrow", "countdown", "music", "films", "|", "weather", "dinner", "groceries", "jobs"];
  function cardLayout() {
    const known = CARDS.map(c => c.key);
    const saved = (window.boardSettings || {}).todayLayout;
    let out = (Array.isArray(saved) ? saved : DEFAULT_LAYOUT).filter((k, i, a) => (k === "|" || known.includes(k)) && a.indexOf(k) === i);
    if (!out.includes("|")) out.push("|");
    known.forEach(k => {
      if (out.includes(k)) return;
      if (DEFAULT_LAYOUT.indexOf(k) < DEFAULT_LAYOUT.indexOf("|")) out.splice(out.indexOf("|"), 0, k); else out.push(k);
    });
    return out;
  }
  const cardShown = (key) => { const c = CARDS.find(x => x.key === key); return !!c && (!c.when || c.when()); };
  // Move a card one place up or down past the next card you can see in the list
  // (or across the column line)
  function moveCard(key, dir) {
    const list = cardLayout();
    const from = list.indexOf(key);
    let to = from + dir;
    while (to >= 0 && to < list.length && list[to] !== "|" && !cardShown(list[to])) to += dir;
    if (from < 0 || to < 0 || to >= list.length) return null;
    [list[from], list[to]] = [list[to], list[from]];
    return list;
  }

  function openCustomise() {
    let dlg = document.getElementById("today-customise");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "today-customise";
      dlg.className = "save-prompt-dialog today-customise-dialog";
      dlg.setAttribute("aria-labelledby", "today-customise-title");
      document.body.appendChild(dlg);
      dlg.addEventListener("cancel", (e) => { e.preventDefault(); dlg.close(); });
      dlg.addEventListener("close", () => { const el = document.getElementById("today-screen"); if (el && !el.hidden) paint(el); });
      dlg.addEventListener("click", async (e) => {
        if (e.target === dlg || e.target.closest("[data-customise-done]")) { dlg.close(); return; }
        const mv = e.target.closest("[data-move]");
        if (mv) {
          const key = mv.getAttribute("data-move"), dir = Number(mv.getAttribute("data-dir"));
          const next = moveCard(key, dir);
          if (!next) return;
          if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ todayLayout: next });
          drawCustomise();
          const again = dlg.querySelector(`[data-move="${key}"][data-dir="${dir}"]`);
          if (again && !again.disabled) again.focus(); else { const other = dlg.querySelector(`[data-move="${key}"]:not([disabled])`); if (other) other.focus(); }
          const el = document.getElementById("today-screen");
          if (el && !el.hidden) paint(el);
          return;
        }
        const sw = e.target.closest("[data-card]");
        if (!sw) return;
        const key = sw.getAttribute("data-card");
        const cards = { ...(((window.boardSettings || {}).todayCards) || {}) };
        // Save on or off explicitly: the board's settings are merged, so a
        // removed "off" would come straight back from the board
        cards[key] = !cardOn(key);
        if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ todayCards: cards });
        drawCustomise();
        // Show the change on the screen behind straight away
        const el = document.getElementById("today-screen");
        if (el && !el.hidden) paint(el);
      });
    }
    drawCustomise();
    if (!dlg.open) dlg.showModal();
  }
  function drawCustomise() {
    const dlg = document.getElementById("today-customise");
    dlg.innerHTML = `<div class="save-prompt-card today-customise-card">
      <h2 class="save-prompt-title" id="today-customise-title">Make it yours</h2>
      <p class="save-prompt-text">Choose what shows here, and use the arrows to put it in your order. It changes on every device.</p>
      <ul class="today-customise-list">${(() => {
        const rows = cardLayout().filter(k => k === "|" || cardShown(k));
        const up = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
        const down = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
        return rows.map((k, i) => {
          if (k === "|") return `<li class="today-customise-split" aria-hidden="true"><span>Right-hand column on tablets</span></li>`;
          const c = CARDS.find(x => x.key === k);
          return `<li class="today-customise-item">
            <button type="button" class="today-customise-row" data-card="${c.key}" role="switch" aria-checked="${cardOn(c.key)}">
              <span class="today-customise-icon" aria-hidden="true">${c.icon}</span>
              <span class="today-customise-label">${esc(c.label)}${c.note ? `<span class="today-customise-note">${esc(c.note)}</span>` : ""}</span>
              <span class="today-customise-switch${cardOn(c.key) ? " is-on" : ""}" aria-hidden="true"><span></span></span>
            </button>
            <span class="today-customise-moves">
              <button type="button" class="today-customise-move" data-move="${c.key}" data-dir="-1" aria-label="Move ${esc(c.label)} up"${i === 0 ? " disabled" : ""}>${up}</button>
              <button type="button" class="today-customise-move" data-move="${c.key}" data-dir="1" aria-label="Move ${esc(c.label)} down"${i === rows.length - 1 ? " disabled" : ""}>${down}</button>
            </span>
          </li>`;
        }).join("");
      })()}</ul>
      <button type="button" class="save-prompt-btn is-primary today-customise-done" data-customise-done>Done</button>
    </div>`;
  }

  // ---- Tomorrow's first thing (mornings and afternoons) ---------------------------
  function tomorrowFirstHtml(tomorrow) {
    const evs = eventsOn(tomorrow);
    if (!evs.length) return "";
    const timed = evs.filter(e => !e.allDay);
    const first = timed[0] || evs[0];
    const more = evs.length - 1;
    const when = first.allDay ? "all day" : clockText(first.evt);
    return `<section class="today-card today-card-next">
      <h3 class="today-card-title">🌅 Tomorrow · ${DAY_NAMES[tomorrow.getDay()]}</h3>
      <p class="today-next-line">${esc(first.evt.icon || "📅")} <strong>${esc(first.evt.title || "Event")}</strong>, ${esc(when)}${more ? ` <span class="today-next-more">+${more} more</span>` : ""}</p>
    </section>`;
  }

  // ---- Groceries: how many, the first few, Shop / Add ---------------------------------
  function groceriesHtml() {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    const list = lists.find(l => l.id === "groceries");
    if (!list) return "";
    const left = (list.items || []).filter(i => !i.checked);
    const name = (i) => (window.Grocery ? window.Grocery.displayText(i) : i.text);
    const preview = left.slice(0, 4).map(name);
    return `<section class="today-card today-card-groceries">
      <h3 class="today-card-title">🛒 Groceries</h3>
      ${left.length
        ? `<p class="today-groc-count"><strong>${left.length}</strong> ${left.length === 1 ? "item" : "items"} to get</p>
           <p class="today-groc-preview">${esc(preview.join(", "))}${left.length > preview.length ? "…" : ""}</p>`
        : `<p class="today-empty">Nothing on the list.</p>`}
      <div class="today-groc-actions">
        ${left.length ? `<button type="button" class="today-groc-btn is-primary today-shop-btn" data-groc="shop"><span class="today-shop-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg></span>Shop</button>` : ""}
        ${addBtn('data-groc="add"', "Add to shopping list")}
      </div>
    </section>`;
  }

  function render() {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const part = partOfDay(now);
    // The weather, in words so rain is obvious: "· 🌧️ Rain, 9°"
    const wx = window.currentWeatherNow;
    const weatherLine = wx ? ` · <span class="today-weather"><span aria-hidden="true">${esc(wx.icon)}</span> ${esc(wx.text)}, ${esc(wx.temp)}°</span>` : "";

    // Jobs
    const jobs = jobsOn(today);
    const jobsHtml = jobs.length
      ? `<ul class="today-list">${jobs.map(j => {
          const isGrab = j.name === "Up for grabs";
          const label = j.left === 0 ? "All done ✓" : `${j.left} ${j.left === 1 ? "task" : "tasks"} left`;
          const open = expandedJobs.has(j.name);
          const icon = (t) => t.icon || (typeof window.detectEmojiForChore === "function" && window.detectEmojiForChore(t.title)) || "🪆";
          return `<li class="today-job${open ? " is-open" : ""}">
            <button type="button" class="today-row today-job-toggle" data-job="${esc(j.name)}" aria-expanded="${open}">
              ${isGrab ? `<span class="today-avatar is-grab" aria-hidden="true">+</span>` : avatar(j.name)}
              <span class="today-row-title">${isGrab ? "Grab it" : esc(j.name)}</span>
              <span class="today-count${j.left === 0 ? " is-done" : ""}">${label}</span>
              <svg class="today-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            ${open ? `<ul class="today-job-list">${j.items.map(({ task, done }) => `<li>
              <button type="button" class="today-job-item${done ? " is-done" : ""}" data-tick-job="${esc(task.id)}" data-job-member="${esc(j.name)}" aria-pressed="${done}" aria-label="${isGrab ? `Open Tasks to grab ${esc(task.title || "this task")}` : `${done ? "Untick" : "Tick"} ${esc(task.title || "task")}`}">
                <span class="today-job-check" aria-hidden="true">${done ? "✓" : ""}</span>
                <span class="today-job-name">${esc(icon(task))} ${esc(task.title || "Task")}</span>
                ${isGrab && !done ? `<span class="today-job-grab">Grab it →</span>` : ""}
              </button>
            </li>`).join("")}</ul>` : ""}
          </li>`;
        }).join("")}</ul>`
      : `<p class="today-empty">No tasks today.</p>`;

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
        <p class="today-sub today-tomorrow-dinner">🍽️ ${tDinner ? `${esc(tDinner.meal.title)}${tDinner.cooks.length ? ` · ${tDinner.cooks.length === 1 ? "Chef" : "Chefs"}: ${esc(tDinner.cooks.length === 1 ? tDinner.cooks[0] : `${tDinner.cooks.slice(0, -1).join(", ")} & ${tDinner.cooks[tDinner.cooks.length - 1]}`)}` : ""}` : "Dinner not planned yet"}</p>
      </section>`;
    }

    const buttonText = openedFrom === "wake" ? "Start the day" : openedFrom === "preview" ? "Close preview" : "Open the board";

    // Each card, in the family's order (Make it yours)
    const cardHtml = {
      events: () => cardOn("events") ? `<section class="today-card today-card-events"><h3 class="today-card-title">📅 Today</h3>${eventsListHtml(eventsOn(today), nowMins, true)}<div class="today-card-foot">${addBtn('data-quick="event"', "Add event")}</div></section>` : "",
      // Evenings show "Tomorrow" in full (with the Today card); otherwise "Tomorrow's first thing"
      tomorrow: () => part.key === "evening" ? (cardOn("events") ? tomorrowHtml : "") : (cardOn("tomorrow") ? tomorrowFirstHtml(tomorrow) : ""),
      countdown: () => cardOn("countdown") ? countdownHtml : "",
      music: () => cardOn("music") && window.Music ? window.Music.todayCardHtml() : "",
      films: () => cardOn("films") && window.FilmNight ? window.FilmNight.cardHtml() : "",
      weather: () => cardOn("weather") && window.WeatherCard ? window.WeatherCard.html(now) : "",
      dinner: () => cardOn("dinner") ? `<section class="today-card"><h3 class="today-card-title">🍽️ Dinner tonight</h3>${dinnerHtml(dinnerOn(today))}</section>` : "",
      groceries: () => cardOn("groceries") ? groceriesHtml() : "",
      jobs: () => cardOn("jobs") ? `<section class="today-card"><h3 class="today-card-title">✅ Tasks today</h3>${jobsHtml}<div class="today-card-foot">${addBtn('data-quick="job"', "Add task")}</div></section>` : ""
    };
    const order = cardLayout();
    const split = order.indexOf("|");
    const colLeft = order.slice(0, split).map(k => (cardHtml[k] ? cardHtml[k]() : "")).join("");
    const colRight = order.slice(split + 1).map(k => (cardHtml[k] ? cardHtml[k]() : "")).join("");

    return `
      <div class="today-inner">
        <header class="today-head">
          <p class="today-wordmark" aria-label="harmonee"><span aria-hidden="true">harmonee</span></p>
          <h2 class="today-greeting" id="today-screen-title">${part.text} ${part.icon}</h2>
          <p class="today-date">${DAY_NAMES[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}${weatherLine}</p>
          ${window.Voice && window.Voice.supported() ? `<button type="button" class="today-say-it" data-voice data-voice-intro aria-label="Add by voice: shopping, events, tasks and meals">${window.Voice.MIC_SVG}<span>Add by voice</span></button>` : ""}
          ${openedFrom === "preview" ? `<p class="today-preview-note">Preview: this opens each morning when the night clock switches off, and any time you tap the "h"</p>` : ""}
        </header>
        <div class="today-grid">
          <div class="today-col">${colLeft}</div>
          <div class="today-col">${colRight}</div>
        </div>
        <button type="button" class="today-customise-link" data-customise><strong>Make it yours</strong> · choose what shows here</button>
      </div>
      <button type="button" class="today-close-btn" id="btn-today-start" aria-label="${buttonText}" title="${buttonText}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
      </button>`;
  }

  function paint(el) {
    const part = partOfDay(new Date()).key;
    el.classList.remove("is-morning", "is-afternoon", "is-evening");
    el.classList.add(`is-${part}`);
    const scroll = el.scrollTop;
    el.innerHTML = render();
    el.scrollTop = scroll;
  }

  // ---- Tick a job from here (same as the Tasks page: points, celebrations) ----
  function tickJob(taskId, member) {
    const now = new Date();
    const dayName = DAY_NAMES[now.getDay()];
    const task = (window.currentTasks || []).find(t => t.id === taskId);
    if (!task) return;
    if (member === "Up for grabs") {
      closeTodayScreen();
      if (typeof window.switchSkylightView === "function") window.switchSkylightView("chores");
      return;
    }
    const done = typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(task, now, member.toLowerCase());
    if (done) { if (typeof window.handleUndoTask === "function") window.handleUndoTask(taskId, dayName, null, member); }
    else if (typeof window.handleCompleteTaskWithCelebration === "function") window.handleCompleteTaskWithCelebration(taskId, dayName, member);
    const el = document.getElementById("today-screen");
    setTimeout(() => { if (el && !el.hidden) paint(el); }, 60);
    setTimeout(() => { if (el && !el.hidden) paint(el); }, 700); // after the save settles
  }

  // ---- Quick add: list item (a small panel here), event, job --------------------
  function runQuick(kind) {
    const el = document.getElementById("today-screen");
    if (kind === "event" && typeof window.openEventModal === "function") {
      // The event panel opens on top of this screen; redraw when it closes
      window.openEventModal();
      const dlg = document.getElementById("event-modal");
      if (dlg) dlg.addEventListener("close", () => { if (el && !el.hidden) paint(el); }, { once: true });
      return;
    }
    if (kind === "job" && typeof window.openSkylightTaskDrawer === "function") {
      closeTodayScreen(); // the job panel sits on the page, not above this screen
      if (typeof window.switchSkylightView === "function") window.switchSkylightView("chores");
      setTimeout(() => window.openSkylightTaskDrawer(), 250);
      return;
    }
    if (kind === "list") openQuickList();
  }

  let quickListId = "groceries";
  function openQuickList() {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    if (!lists.length) return;
    if (!lists.some(l => l.id === quickListId)) quickListId = lists[0].id;
    let dlg = document.getElementById("quick-list-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "quick-list-dialog";
      dlg.className = "quick-list-dialog";
      dlg.setAttribute("aria-labelledby", "quick-list-title");
      document.body.appendChild(dlg);
      dlg.addEventListener("cancel", (e) => { e.preventDefault(); dlg.close(); });
      dlg.addEventListener("close", () => { const el = document.getElementById("today-screen"); if (el && !el.hidden) paint(el); });
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg || e.target.closest("[data-quick-close]")) { dlg.close(); return; }
        const pick = e.target.closest("[data-quick-list]");
        if (pick) { quickListId = pick.getAttribute("data-quick-list"); drawQuickList(); focusQuickInput(); return; }
        const usual = e.target.closest("[data-quick-usual]");
        if (usual) { quickAdd(usual.getAttribute("data-quick-usual")); return; }
      });
      dlg.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = dlg.querySelector("#quick-list-input");
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        quickAdd(text);
        focusQuickInput();
      });
    }
    dlg._log = [];
    drawQuickList();
    if (!dlg.open) dlg.showModal();
    focusQuickInput();
  }
  function focusQuickInput() { setTimeout(() => { try { document.getElementById("quick-list-input").focus(); } catch (e) {} }, 60); }

  function quickAdd(text) {
    const dlg = document.getElementById("quick-list-dialog");
    if (typeof window.addTextsToList !== "function") return;
    const res = window.addTextsToList(quickListId, [text]);
    const name = res.added[0] ? res.added[0].text : (res.already[0] || res.back[0] || {}).text || text;
    const note = res.added.length ? "added" : res.already.length ? "already on the list" : "back on the list";
    dlg._log = [{ name, note }, ...(dlg._log || [])].slice(0, 5);
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    if (typeof window.renderListsView === "function") window.renderListsView();
    drawQuickList();
  }

  function drawQuickList() {
    const dlg = document.getElementById("quick-list-dialog");
    const lists = window.loadFamilyLists();
    const list = lists.find(l => l.id === quickListId) || lists[0];
    const usuals = typeof window.getListUsuals === "function" ? window.getListUsuals(list).slice(0, 8) : [];
    const typed = (dlg.querySelector("#quick-list-input") || {}).value || "";
    dlg.innerHTML = `
      <form class="quick-list-card" autocomplete="off">
        <div class="quick-list-head">
          <h2 class="quick-list-title" id="quick-list-title">Add to a list</h2>
          <button type="button" class="quick-list-done" data-quick-close>Done</button>
        </div>
        ${lists.length > 1 ? `<div class="quick-list-pills" role="group" aria-label="Which list">${lists.map(l => `<button type="button" class="quick-list-pill${l.id === list.id ? " is-on" : ""}" data-quick-list="${esc(l.id)}" aria-pressed="${l.id === list.id}">${esc(l.emoji || "📋")} ${esc(l.title)}</button>`).join("")}</div>` : ""}
        <div class="quick-list-row">
          <input id="quick-list-input" class="quick-list-input" type="text" placeholder="Add to ${esc(list.title)}" aria-label="Add to ${esc(list.title)}" enterkeyhint="done" value="${esc(typed)}">
          ${window.Voice && window.Voice.supported() ? window.Voice.micButton("list", "Say what to add").replace('data-voice="list"', `data-voice="list" data-voice-list="${esc(list.id)}"`) : ""}
          <button type="submit" class="quick-list-add">Add</button>
        </div>
        ${usuals.length ? `<div class="quick-list-usuals" role="group" aria-label="Usuals">${usuals.map(u => `<button type="button" class="quick-list-usual" data-quick-usual="${esc(u.text)}"><span aria-hidden="true">+</span> ${esc(u.text)}</button>`).join("")}</div>` : ""}
        ${(dlg._log || []).length ? `<ul class="quick-list-log" aria-live="polite">${dlg._log.map(l => `<li><span aria-hidden="true">${l.note === "added" ? "✓" : "•"}</span> ${esc(l.name)} <em>${esc(l.note)}</em></li>`).join("")}</ul>` : ""}
      </form>`;
  }

  // Anything on the board changed (an event saved, a task ticked, a meal
  // planned, here or on another device): redraw, once, a moment later
  let dataTimer = null;
  document.addEventListener("harmonee:data", () => {
    clearTimeout(dataTimer);
    dataTimer = setTimeout(() => {
      const el = document.getElementById("today-screen");
      if (el && !el.hidden) paint(el);
    }, 150);
  });

  // Fresh weather (every half hour) or film listings: redraw
  document.addEventListener("harmonee:films", () => {
    const el = document.getElementById("today-screen");
    if (el && !el.hidden) paint(el);
  });
  document.addEventListener("harmonee:weather", () => {
    const el = document.getElementById("today-screen");
    if (el && !el.hidden) paint(el);
  });

  // Something added or removed by voice: show it here straight away
  document.addEventListener("harmonee:voice-change", () => {
    const el = document.getElementById("today-screen");
    if (el && !el.hidden) paint(el);
    const dlg = document.getElementById("quick-list-dialog");
    if (dlg && dlg.open) drawQuickList();
  });

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
        // Show / hide a person's jobs
        const job = e.target.closest("[data-job]");
        if (job) {
          const name = job.getAttribute("data-job");
          if (expandedJobs.has(name)) expandedJobs.delete(name); else expandedJobs.add(name);
          paint(el);
          return;
        }
        if (e.target.closest("[data-customise]")) { openCustomise(); return; }
        const groc = e.target.closest("[data-groc]");
        if (groc) {
          if (groc.getAttribute("data-groc") === "shop") {
            closeTodayScreen();
            if (typeof window.openShopMode === "function") window.openShopMode("groceries");
          } else {
            quickListId = "groceries";
            openQuickList();
          }
          return;
        }
        // Quick add
        const quick = e.target.closest("[data-quick]");
        if (quick) { runQuick(quick.getAttribute("data-quick")); return; }
        // Tick a job (Grab it ones go to Tasks, where someone claims them)
        const tickBtn = e.target.closest("[data-tick-job]");
        if (tickBtn) { tickJob(tickBtn.getAttribute("data-tick-job"), tickBtn.getAttribute("data-job-member")); return; }
        // No dinner yet: go to Meals with the Plan Meal panel open for tonight
        if (e.target.closest("[data-plan-dinner]")) {
          closeTodayScreen();
          if (typeof window.switchSkylightView === "function") window.switchSkylightView("meals");
          const key = window.getLocalDateKey(new Date());
          setTimeout(() => { if (typeof window.openPlanMealDrawer === "function") window.openPlanMealDrawer(key, "dinner"); }, 350);
          return;
        }
        // The button, or a tap outside the cards
        if (e.target.closest("#btn-today-start") || !e.target.closest(".today-card")) closeTodayScreen();
      });
      // Esc closes this screen, unless it's closing a panel opened from it
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden && !document.querySelector("dialog[open]")) closeTodayScreen(); });
    }
    // Opened from Settings: close Settings first so it doesn't sit on top
    document.querySelectorAll("dialog[open]").forEach(d => { try { d.close(); } catch (err) {} });
    el.scrollTop = 0;
    paint(el);
    el.hidden = false;
    clearTimeout(autoCloseTimer);
    // The morning one gives way to the board after an hour; opened from the
    // "h" or after the board was left alone, it stays until someone taps
    if (openedFrom === "wake") autoCloseTimer = setTimeout(closeTodayScreen, AUTO_CLOSE_MS);
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!el.hidden) paint(el); }, 60000); // times, finished events fading, jobs left
    setTimeout(() => { try { document.getElementById("btn-today-start").focus({ preventScroll: true }); } catch (err) {} }, 50);
  }
  window.showTodayScreen = showTodayScreen;

  // On unless a family switches it off (Settings > Sleep > Morning summary).
  // That switch only affects the automatic morning one; the "h" always works.
  const isEnabled = () => (window.boardSettings || {}).todayScreenEnabled !== false;
  window.isTodayScreenEnabled = isEnabled;

  // ---- When the board is left alone (Settings > Display, this device only) ----
  // 0 = stay where it is (default). Otherwise show Today at a glance after that
  // many minutes with nobody touching the screen. Per device, so the kitchen
  // tablet can do it without phones ever doing it.
  const IDLE_KEY = "harmonee_today_idle_minutes";
  const idleMinutes = () => { try { return parseInt(localStorage.getItem(IDLE_KEY), 10) || 0; } catch (e) { return 0; } };
  let lastActivity = Date.now();
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(type =>
    document.addEventListener(type, () => { lastActivity = Date.now(); }, { capture: true, passive: true }));
  const shown = (id) => { const x = document.getElementById(id); return !!(x && x.offsetParent !== null && getComputedStyle(x).display !== "none" && !x.hidden); };
  setInterval(() => {
    const mins = idleMinutes();
    if (!mins || document.hidden) return;
    if (Date.now() - lastActivity < mins * 60000) return;
    const today = document.getElementById("today-screen");
    if (today && !today.hidden) return;
    if (document.querySelector("dialog[open]")) return;             // a panel is open: someone's mid-task
    if (shown("ambient-sleep-overlay") || shown("board-join-screen")) return;
    showTodayScreen({ from: "idle" });
  }, 20000);

  // Settings: keep the controls in step when Settings opens, save on change
  window.syncTodayScreenSetting = () => {
    const box = document.getElementById("settings-today-enabled");
    if (box) box.checked = isEnabled();
    const sel = document.getElementById("settings-today-idle");
    if (sel) sel.value = String(idleMinutes());
  };
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "settings-today-enabled" && typeof window.saveBoardSettingsNow === "function") {
      window.saveBoardSettingsNow({ todayScreenEnabled: e.target.checked });
    }
    if (e.target && e.target.id === "settings-today-idle") {
      try { localStorage.setItem(IDLE_KEY, e.target.value); } catch (err) {}
      lastActivity = Date.now();
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

  // ---- Phones open on Today at a glance -----------------------------------------
  // On a phone you mostly want "what's on" and to add or tick something, so
  // the app opens here; ✕ goes to the full board. (Tablets open on the board.)
  const openOnPhone = () => {
    if (!window.matchMedia("(max-width: 600px)").matches) return;
    if (shown("board-join-screen") || shown("ambient-sleep-overlay")) return;
    const setup = document.getElementById("setup-wizard");
    if (setup && !setup.hidden) return; // a new family is still setting up
    const today = document.getElementById("today-screen");
    if (today && !today.hidden) return;
    showTodayScreen({ from: "logo" });
    // Events, meals and jobs arrive from the board a moment after opening
    [1500, 4000].forEach(ms => setTimeout(() => { const el = document.getElementById("today-screen"); if (el && !el.hidden) paint(el); }, ms));
  };
  if (document.readyState === "complete") setTimeout(openOnPhone, 600);
  else window.addEventListener("load", () => setTimeout(openOnPhone, 600));

  // Confetti draws on its own layer (100 by default), which would be hidden
  // behind this screen and Shop mode: lift every burst above them
  const liftConfetti = () => {
    const c = window.confetti;
    if (typeof c !== "function" || c._lifted) return;
    const lifted = (opts = {}) => c({ zIndex: 200000, ...opts });
    Object.assign(lifted, c);
    lifted._lifted = true;
    window.confetti = lifted;
  };
  if (document.readyState === "complete") liftConfetti(); else window.addEventListener("load", liftConfetti);
})();
