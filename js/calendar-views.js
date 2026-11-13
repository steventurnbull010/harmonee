// ============================================================================
// CALENDAR VIEWS, REDESIGNED (js/calendar-views.js) · agreed with Steven 11 Nov
//
// The calendar's own bar, under the page header: the month ("November 2026")
// with ‹ Today ›, the views as buttons (Day · 3 days · Week · Month; phones
// Day · Week · Month) and a face for each person (tap to hide or show their
// events). Then:
//
//   Phones
//     Day    a week strip (Mon–Sun, a dot when something's on), then that
//            day's dinner and events in time order. No month calendar.
//     Week   one list: past days folded away, empty days one thin line.
//     Month  a compact Monday-first grid of dots; the chosen day's events
//            listed underneath.
//   Tablets and computers
//     Week   seven real columns, Mon–Sun: dinner on top, then events in time
//            order; today stands out, days gone by are greyed.
//     Day    the timeline (js/calendar.js) for one day, under the week strip.
//     3 days and Month stay in js/calendar.js (fitted and sorted there).
//
// Taps on event cards, dinner chips and "+ Add" go through the calendar's
// existing handler in app.js (same classes and data-date / data-day).
// ============================================================================
(function () {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MON = MONTHS.map(m => m.slice(0, 3));

  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;
  const keyOf = (d) => window.getLocalDateKey(d);
  const idxOf = (d) => (d.getDay() + 6) % 7; // Monday = 0
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(startOfDay(d), -idxOf(d));
  const palette = (name) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#0284c7", lightBg: "#e0f2fe", border: "#7dd3fc", text: "#075985" });
  const peopleOf = (evt) => String(evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  // The calendar's own date (js/calendar.js); window's copy can lag behind
  const anchor = () => startOfDay((typeof calendarAnchorDate !== "undefined" && calendarAnchorDate) || window.calendarAnchorDate || new Date());
  const filters = () => (typeof activeCalendarMemberFilters !== "undefined" ? activeCalendarMemberFilters : window.activeCalendarMemberFilters);

  // ---- One shared time order: all-day first, then by start time ----------------------
  const isAllDay = (e) => !e.time || /all\s*day/i.test(e.time);
  function byTime(a, b) {
    const aa = isAllDay(a), bb = isAllDay(b);
    if (aa !== bb) return aa ? -1 : 1;
    const ma = window.getEventMinutes ? window.getEventMinutes(a) : 0;
    const mb = window.getEventMinutes ? window.getEventMinutes(b) : 0;
    return (ma - mb) || String(a.title || "").localeCompare(String(b.title || ""));
  }

  // "8:15am", "10am", "All day"
  function timeLabel(e) {
    if (isAllDay(e)) return "All day";
    const m = window.getEventMinutes ? window.getEventMinutes(e) : 0;
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
  }

  // ---- What's on a day ------------------------------------------------------------------
  function eventsOn(date) {
    const ds = keyOf(date);
    const dayName = DAYS[idxOf(date)];
    let list = (window.shownEvents ? window.shownEvents() : (window.familyEvents || []))
      .filter(e => e && typeof e === "object" && window.isEventOnDate(e, ds, dayName, date))
      .map(e => (typeof window.eventForDay === "function" ? window.eventForDay(e, date) : e));
    if (filters() !== null && typeof window.isMemberSelected === "function") list = list.filter(e => window.isMemberSelected(e.member));
    return list.sort(byTime);
  }
  function dayInfo(date) {
    const d = startOfDay(date);
    const today = startOfDay(new Date());
    const ds = keyOf(d);
    return {
      date: d, ds,
      dayName: DAYS[idxOf(d)], short: SHORT[idxOf(d)], num: d.getDate(),
      isToday: d.getTime() === today.getTime(),
      isPast: d.getTime() < today.getTime(),
      isTomorrow: d.getTime() === addDays(today, 1).getTime(),
      meal: typeof window.getMealForDate === "function" ? window.getMealForDate(d) : null,
      holiday: window.BankHolidays ? window.BankHolidays.chipHtml(ds, "box") : "",
      weather: typeof window.getForecastForDate === "function" ? window.getForecastForDate(ds) : null,
      events: eventsOn(d)
    };
  }
  const hasAnything = (info) => info.events.length > 0 || !!(info.meal && info.meal.title) || !!info.holiday;

  // ---- Pieces ----------------------------------------------------------------------------
  function mealHtml(info) {
    if (!(info.meal && info.meal.title)) return "";
    return `
      <div class="skylight-box-meal is-planned cv-meal" data-date="${info.ds}" data-day="${info.dayName}" title="Dinner: ${esc(info.meal.title)}">
        <span class="box-meal-icon">${esc(info.meal.emoji || "🍽️")}</span>
        <span class="box-meal-title"><small>Dinner</small>${esc(info.meal.title)}</span>
      </div>`;
  }
  function cardHtml(evt) {
    const people = peopleOf(evt);
    const pal = palette(people[0] || "Family");
    const bg = people.length >= 2
      ? `linear-gradient(135deg, ${pal.lightBg} 0%, ${pal.lightBg} 48%, ${palette(people[1]).lightBg} 52%)`
      : pal.lightBg;
    const faces = people.map(m => `<span class="skylight-avatar ${people.length > 1 ? "avatar-mini" : ""}" style="background: ${palette(m).primary}; color: #fff;" title="${esc(m)}">${esc(m.charAt(0).toUpperCase())}</span>`).join("");
    const length = !isAllDay(evt) && evt.duration && !/all\s*day/i.test(evt.duration) ? ` · ${esc(evt.duration)}` : "";
    return `
      <div class="skylight-card cv-card" data-event-id="${esc(evt.id)}" style="background: ${bg}; border-color: ${pal.border}; --cv-edge: ${pal.primary};" title="${esc(evt.title)}">
        <span class="cv-card-time">${esc(timeLabel(evt))}</span>
        <span class="cv-card-main">
          <span class="cv-card-title" style="color: ${pal.text};">${esc(evt.icon || "📅")} ${esc(evt.title)}${(evt.repeat && evt.repeat !== "none") || evt.repeatText ? ` <span class="cv-repeat" title="${esc(evt.repeatText || "Repeats")}">🔁</span>` : ""}${evt.source === "google" ? ` <span class="ev-g" title="From Google Calendar">G</span>` : ""}</span>
          ${length ? `<span class="cv-card-sub">${esc(timeLabel(evt))}${length}</span>` : ""}
        </span>
        <span class="skylight-card-avatar-wrap">${faces}</span>
      </div>`;
  }
  function weatherHtml(info) {
    const w = info.weather;
    if (!w) return "";
    return `<span class="cv-weather" title="${esc(w.condition || "")}">${w.icon || ""}${w.maxTemp !== null && w.maxTemp !== undefined ? ` ${Math.round(w.maxTemp)}°` : ""}</span>`;
  }
  function addBtn(info, label = "＋ Add") {
    return `<button type="button" class="btn-discreet-add-event cv-add" data-date="${info.ds}" data-day="${info.dayName}" aria-label="Add an event on ${info.dayName} ${info.num}">${label}</button>`;
  }
  function dayWord(info) {
    if (info.isToday) return "Today";
    if (info.isTomorrow) return "Tomorrow";
    return info.dayName;
  }

  // The week strip: Mon–Sun with a dot for days with something on
  function stripHtml(selected, mode) {
    const mon = mondayOf(selected);
    const sel = keyOf(selected);
    return `<div class="cv-strip" role="tablist" aria-label="Days this week">${Array.from({ length: 7 }, (_, i) => {
      const info = dayInfo(addDays(mon, i));
      return `<button type="button" class="cv-strip-day ${info.ds === sel ? "is-on" : ""} ${info.isToday ? "is-today" : ""} ${info.isPast ? "is-past" : ""}" data-cv-day="${info.ds}" data-cv-mode="${mode}" role="tab" aria-selected="${info.ds === sel}" aria-label="${info.dayName} ${info.num}${hasAnything(info) ? ", something on" : ""}">
        <span class="cv-strip-name">${info.short.charAt(0)}<span class="cv-strip-rest">${info.short.slice(1)}</span></span>
        <span class="cv-strip-num">${info.num}</span>
        <span class="cv-strip-dot ${hasAnything(info) ? "is-on" : ""}" aria-hidden="true"></span>
      </button>`;
    }).join("")}</div>`;
  }

  // ---- Phone: Day --------------------------------------------------------------------------
  // Today's weather is already at the top of the page, so only other days show
  // theirs here; adding is the + button, which adds to the day on screen
  function phoneDayHtml(date) {
    const info = dayInfo(date);
    const list = `${info.holiday}${mealHtml(info)}${info.events.map(cardHtml).join("")}`;
    return `
      ${stripHtml(date, "day")}
      <section class="cv-day ${info.isToday ? "is-today" : ""}" data-date="${info.ds}" data-day="${info.dayName}">
        <header class="cv-day-head">
          <h3 class="cv-day-title">${dayWord(info)}<small>${info.isToday || info.isTomorrow ? `${info.dayName} ` : ""}${info.num} ${MONTHS[info.date.getMonth()]}</small></h3>
          ${info.isToday ? "" : weatherHtml(info)}
        </header>
        <div class="cv-day-list">${list || `<p class="cv-empty">Nothing planned.</p>`}</div>
      </section>`;
  }

  // ---- Phone: Week (one list) ----------------------------------------------------------------
  let showPast = false;
  function phoneWeekHtml(date) {
    const mon = mondayOf(date);
    const days = Array.from({ length: 7 }, (_, i) => dayInfo(addDays(mon, i)));
    // Only this week folds its gone days away; a past week shows in full
    const thisWeek = days.some(d => d.isToday);
    const past = thisWeek ? days.filter(d => d.isPast) : [];
    const rest = thisWeek ? days.filter(d => !d.isPast) : days;
    const pastCount = past.reduce((n, d) => n + d.events.length, 0);
    // The days of this week that have gone: folded into one bar that says
    // what it is ("Earlier this week"), so opening it doesn't read as last week
    const pastDays = `${past[0] ? past[0].short : ""}${past.length > 1 ? `–${past[past.length - 1].short}` : ""}`;
    const pastHtml = past.length ? `
      <button type="button" class="cv-past-toggle" data-cv-past aria-expanded="${showPast}">${showPast
        ? `▾ Hide earlier this week`
        : `▸ Earlier this week · ${pastDays} · ${pastCount ? `${pastCount} event${pastCount === 1 ? "" : "s"}` : "nothing on"}`}</button>
      ${showPast ? past.map(dayBlock).join("") : ""}` : "";
    return `${stripHtml(date, "week")}<div class="cv-week-list">${pastHtml}${rest.map(dayBlock).join("")}</div>`;

    function dayBlock(info) {
      if (!hasAnything(info)) {
        return `<div class="cv-week-day is-empty ${info.isPast ? "is-past" : ""}" data-date="${info.ds}" data-day="${info.dayName}" id="cv-day-${info.ds}">
          <span class="cv-week-day-name">${info.isToday ? "Today" : `${info.short} ${info.num}`}</span>
          <span class="cv-empty-line">Nothing planned</span>
          ${addBtn(info, "＋")}
        </div>`;
      }
      return `<section class="cv-week-day ${info.isToday ? "is-today" : ""} ${info.isPast ? "is-past" : ""}" data-date="${info.ds}" data-day="${info.dayName}" id="cv-day-${info.ds}">
        <header class="cv-week-day-head">
          <span class="cv-week-day-name">${dayWord(info)}<small>${info.isToday || info.isTomorrow ? ` · ${info.short} ${info.num}` : ` ${info.num}`}</small></span>
          ${weatherHtml(info)}
          ${addBtn(info, "＋")}
        </header>
        ${info.holiday}${mealHtml(info)}${info.events.map(cardHtml).join("")}
      </section>`;
    }
  }

  // ---- Phone: Month (dots, then the chosen day's list) ---------------------------------------
  function phoneMonthHtml(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = mondayOf(first);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const weeks = Math.ceil((idxOf(first) + last.getDate()) / 7);
    const sel = keyOf(date);
    let cells = "";
    for (let i = 0; i < weeks * 7; i++) {
      const info = dayInfo(addDays(start, i));
      const other = info.date.getMonth() !== date.getMonth();
      const colours = [...new Set(info.events.flatMap(peopleOf))].slice(0, 3).map(m => palette(m).primary);
      if (info.meal && info.meal.title && colours.length < 3) colours.push("#f97316");
      cells += `<button type="button" class="cv-month-cell ${other ? "is-other" : ""} ${info.isToday ? "is-today" : ""} ${info.ds === sel ? "is-on" : ""}" data-cv-day="${info.ds}" data-cv-mode="month" aria-label="${info.dayName} ${info.num} ${MONTHS[info.date.getMonth()]}${info.events.length ? `, ${info.events.length} event${info.events.length === 1 ? "" : "s"}` : ""}">
        <span class="cv-month-num">${info.num}</span>
        <span class="cv-month-dots" aria-hidden="true">${colours.map(c => `<i style="background:${c}"></i>`).join("")}</span>
      </button>`;
    }
    const info = dayInfo(date);
    return `
      <div class="cv-month">
        <div class="cv-month-names">${SHORT.map(s => `<span>${s.charAt(0)}</span>`).join("")}</div>
        <div class="cv-month-grid">${cells}</div>
      </div>
      <section class="cv-day cv-month-day" data-date="${info.ds}" data-day="${info.dayName}">
        <header class="cv-day-head">
          <h3 class="cv-day-title">${dayWord(info)}<small>${info.isToday || info.isTomorrow ? `${info.dayName} ` : ""}${info.num} ${MONTHS[info.date.getMonth()]}</small></h3>
          ${addBtn(info, "＋ Add")}
        </header>
        <div class="cv-day-list">${`${info.holiday}${mealHtml(info)}${info.events.map(cardHtml).join("")}` || `<p class="cv-empty">Nothing planned.</p>`}</div>
      </section>`;
  }

  // ---- Tablets and computers: Week, seven columns ----------------------------------------------
  function tabletWeekHtml(date) {
    const mon = mondayOf(date);
    return `<div class="cv-week-cols">${Array.from({ length: 7 }, (_, i) => {
      const info = dayInfo(addDays(mon, i));
      return `<section class="cv-col ${info.isToday ? "is-today" : ""} ${info.isPast ? "is-past" : ""}" data-date="${info.ds}" data-day="${info.dayName}">
        <header class="cv-col-head">
          <span class="cv-col-name">${info.short}</span>
          <span class="cv-col-num">${info.num}</span>
          ${weatherHtml(info)}
        </header>
        <div class="cv-col-body">
          ${info.holiday}${mealHtml(info)}${info.events.map(cardHtml).join("")}
          ${addBtn(info, "＋")}
        </div>
      </section>`;
    }).join("")}</div>`;
  }

  // ---- The calendar's own bar -----------------------------------------------------------------
  function titleFor(view, date) {
    if (view === "day") {
      const info = dayInfo(date);
      return isPhone() ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}` : `${info.dayName} ${info.num} ${MONTHS[date.getMonth()]}`;
    }
    if (view === "week" || view === "schedule") {
      const s = view === "week" ? mondayOf(date) : date;
      const e = addDays(s, view === "week" ? 6 : 2);
      if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
      return `${MON[s.getMonth()]} – ${MON[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
  function renderToolbar(view) {
    const bar = document.getElementById("calendar-toolbar");
    if (!bar) return;
    const title = document.getElementById("cal-toolbar-title");
    if (title) title.textContent = titleFor(view, anchor());
    // "Today" only when today isn't already on screen (like most calendar apps)
    const todayBtn = document.getElementById("btn-calendar-today");
    if (todayBtn) {
      const t = startOfDay(new Date()), a = anchor();
      let showing;
      if (view === "month") showing = a.getMonth() === t.getMonth() && a.getFullYear() === t.getFullYear();
      else if (view === "week") showing = mondayOf(a).getTime() === mondayOf(t).getTime();
      else if (view === "schedule" && !isPhone()) showing = t >= a && t <= addDays(a, 2);
      else showing = a.getTime() === t.getTime();
      todayBtn.hidden = showing;
    }
    const views = isPhone() ? [["day", "Day"], ["week", "Week"], ["month", "Month"]] : [["day", "Day"], ["schedule", "3 days"], ["week", "Week"], ["month", "Month"]];
    const sw = document.getElementById("cal-view-switch");
    if (sw) sw.innerHTML = views.map(([v, label]) => `<button type="button" class="cal-view-btn ${v === view || (isPhone() && view === "schedule" && v === "day") ? "is-on" : ""}" data-cal-view="${v}" aria-pressed="${v === view}">${label}</button>`).join("");
    const people = document.getElementById("cal-people");
    if (people) {
      const f = filters();
      people.innerHTML = (window.familyMembers || []).map(m => {
        const on = f === null || f.includes(m);
        const pal = palette(m);
        return `<button type="button" class="cal-face ${on ? "is-on" : ""}" data-cal-face="${esc(m)}" style="--face: ${pal.primary};" aria-pressed="${on}" title="${on ? `Hide ${esc(m)}'s events` : `Show ${esc(m)}'s events`}">${esc(m.charAt(0).toUpperCase())}</button>`;
      }).join("");
    }
    wire();
  }

  // ---- Taps ----------------------------------------------------------------------------------
  function toggleFace(name) {
    const everyone = window.familyMembers || [];
    let f = filters();
    let list = f === null ? [...everyone] : [...f];
    list = list.includes(name) ? list.filter(m => m !== name) : [...list, name];
    const all = everyone.every(m => list.includes(m));
    const next = all ? null : list;
    // Shared with js/calendar.js (its let) and app.js
    try { activeCalendarMemberFilters = next; } catch (e) {}
    try { activeCalendarMemberFilter = next && next.length === 1 ? next[0] : (next && next.length > 1 ? next.join(" / ") : null); } catch (e) {}
    window.activeCalendarMemberFilters = next;
    try {
      if (next === null) localStorage.removeItem("chore_calendar_member_filters");
      else localStorage.setItem("chore_calendar_member_filters", JSON.stringify(next));
    } catch (e) {}
    window.renderWeekCalendar();
  }
  let wired = false;
  function wire() {
    if (wired) return;
    const bar = document.getElementById("calendar-toolbar");
    const grid = document.getElementById("calendar-week-grid");
    if (!bar || !grid) return;
    wired = true;
    bar.addEventListener("click", (e) => {
      const v = e.target.closest("[data-cal-view]");
      if (v) { window.setCalendarView(v.getAttribute("data-cal-view"), currentViewKeepsDate(v.getAttribute("data-cal-view"))); return; }
      const face = e.target.closest("[data-cal-face]");
      if (face) { toggleFace(face.getAttribute("data-cal-face")); return; }
      if (e.target.closest("#cal-toolbar-title") && isPhone() && window.currentCalendarView !== "month") window.setCalendarView("month", anchor());
    });
    grid.addEventListener("click", (e) => {
      const day = e.target.closest("[data-cv-day]");
      if (day) {
        e.stopPropagation();
        const [y, m, d] = day.getAttribute("data-cv-day").split("-").map(Number);
        const date = new Date(y, m - 1, d);
        const mode = day.getAttribute("data-cv-mode");
        if (mode === "week") {
          // In the week list: jump to that day
          const el = document.getElementById(`cv-day-${day.getAttribute("data-cv-day")}`);
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
          window.setCalendarView("day", date);
          return;
        }
        window.setCalendarView(mode === "month" ? "month" : "day", date);
        return;
      }
      if (e.target.closest("[data-cv-past]")) { e.stopPropagation(); showPast = !showPast; window.renderWeekCalendar(); }
    }, true);
  }
  // Switching views keeps the day you're looking at
  function currentViewKeepsDate(view) {
    if (view === "schedule" && startOfDay(new Date()).getTime() >= mondayOf(anchor()).getTime() && startOfDay(new Date()).getTime() <= addDays(mondayOf(anchor()), 6).getTime()) return new Date();
    return anchor();
  }

  // ---- Drawing -------------------------------------------------------------------------------
  // Returns true when this module drew the view (js/calendar.js then stops)
  function render(view, grid) {
    renderToolbar(view);
    const date = anchor();
    if (isPhone()) {
      // The 3-day timeline doesn't fit a phone: it shows as Day
      const v = view === "schedule" ? "day" : view;
      grid.className = `calendar-week-grid cv-phone cv-phone-${v}`;
      grid.innerHTML = v === "day" ? phoneDayHtml(date) : v === "week" ? phoneWeekHtml(date) : phoneMonthHtml(date);
      return true;
    }
    if (view === "week") {
      grid.className = "calendar-week-grid cv-tablet-week";
      grid.innerHTML = tabletWeekHtml(date);
      return true;
    }
    return false;
  }
  // Tablets' Day view: the week strip above the one-day timeline
  function stripAbove(grid) {
    if (!grid || isPhone()) return;
    grid.insertAdjacentHTML("afterbegin", stripHtml(anchor(), "day"));
    grid.classList.add("cv-has-strip");
  }

  window.CalendarViews = { render, renderToolbar, stripAbove, byTime, timeLabel, dayInfo, isPhone };
})();
