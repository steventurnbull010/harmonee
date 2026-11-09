// ============================================================================
// MOVING EVENTS BY DRAGGING (js/calendar-drag.js)
// Press and hold an event (or press and move it with a mouse), then drop it:
//   - week view: on another day (same time);
//   - 3-day and day views: on a day and a time (15-minute steps; all-day
//     events keep being all day);
//   - month view: on another day.
// Uses js/item-drag.js, so it looks like moving a job on the Tasks board:
// the places it can go light up, the rest fades, and a label by the finger
// says where it's going.
//
// A repeating event asks first: just this one (that date is skipped and a
// one-off copy goes on the new day: evt.skipDates, read by isEventOnDate),
// or every one (the series moves). Birthdays don't move. Every move can be
// undone from the message that follows.
// ============================================================================
(function () {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SNAP = 15;

  const parseKey = (k) => { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, m - 1, d); };
  const keyOf = (d) => getLocalDateKey(d);
  const dayLabel = (k) => { const d = parseKey(k); return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const isAllDay = (evt) => !evt.time || /all\s*day/i.test(evt.time) || /all\s*day/i.test(evt.duration || "");
  const toMins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const clock = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60, h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
  };
  const events = () => window.familyEvents || (typeof loadFamilyEvents === "function" ? loadFamilyEvents() : []);
  const findEvent = (id) => events().find(e => String(e.id) === String(id));
  const view = () => window.currentCalendarView || "schedule";

  // The timeline's measurements, saved by js/calendar.js when it draws one
  function timeline(grid) {
    try { return JSON.parse(grid.dataset.timeline || "null"); } catch (e) { return null; }
  }

  // Where an event would start if let go here (timelines only)
  function startAt(ctx, zone, y) {
    const geo = ctx.data.geo;
    if (!geo || !zone.classList.contains("skylight-time-col") || ctx.data.allDay) return null;
    const top = y - ctx.grabY - zone.getBoundingClientRect().top - geo.topPadding;
    const mins = geo.startHour * 60 + (top / geo.hourHeight) * 60;
    const last = geo.endHour * 60 - SNAP;
    return Math.max(geo.startHour * 60, Math.min(last, Math.round(mins / SNAP) * SNAP));
  }

  function zoneDate(zone) {
    return zone.getAttribute("data-date") || zone.getAttribute("data-date-str");
  }

  function setup(grid) {
    if (!window.ItemDrag) return;
    window.ItemDrag.attach(grid, {
      itemSelector: ".skylight-card[data-event-id], .skylight-day-event-banner[data-event-id], .month-mini-event[data-event-id]",
      canDrag(item) {
        const evt = findEvent(item.getAttribute("data-event-id"));
        return !!evt && !evt.birthday;
      },
      start(item) {
        const evt = findEvent(item.getAttribute("data-event-id"));
        if (!evt) return null;
        const v = view();
        let zones;
        if (v === "month") zones = [...grid.querySelectorAll(".calendar-month-cell[data-date-str]")];
        else if (v === "week") zones = [...grid.querySelectorAll(".skylight-day-box[data-date]:not(.skylight-next-week-box)")];
        else zones = [...grid.querySelectorAll(".skylight-time-col[data-date]")];
        const origin = item.closest(".calendar-month-cell, .skylight-day-box, .skylight-time-col, [data-date]");
        const fromDate = origin ? zoneDate(origin) : (evt.date || null);
        return {
          zones,
          origin: (v === "week" || v === "month") ? origin : null, // on a timeline the day can take another time
          data: { evt, fromDate, geo: (v === "day" || v === "schedule") ? timeline(grid) : null, allDay: isAllDay(evt) }
        };
      },
      hit(ctx, x, y, under) {
        if (!under) return null;
        const zone = ctx.zones.find(z => z.contains(under));
        if (zone) return zone;
        // Below a short day in week view: the day above the finger
        return ctx.zones.find(z => { const r = z.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top - 4 && y <= r.bottom + 120; }) || null;
      },
      label(ctx, zone, x, y) {
        const k = zoneDate(zone);
        if (!k) return "";
        const start = startAt(ctx, zone, y);
        if (start !== null) return `${dayLabel(k)} · ${clock(start)}`;
        const same = k === ctx.data.fromDate;
        return same ? "Leave it here" : `Move to ${dayLabel(k)}`;
      },
      scroller: () => document.getElementById("skylight-trad-body-scroll") || grid.querySelector(".skylight-schedule-scroll, .skylight-trad-body-scroll"),
      drop(ctx, zone, x, y) {
        const toDate = zoneDate(zone);
        const start = startAt(ctx, zone, y);
        moveEvent(ctx.data.evt, ctx.data.fromDate, toDate, start);
      }
    });
  }

  // ---- Saving the move ----------------------------------------------------------------
  async function moveEvent(evt, fromDate, toDate, startMins) {
    if (!evt || !toDate) return;
    const oldStart = toMins(evt.time);
    const newTime = startMins !== null && startMins !== undefined ? hhmm(startMins) : evt.time;
    const dayChanged = !!fromDate && toDate !== fromDate;
    const timeChanged = startMins !== null && startMins !== undefined && startMins !== oldStart;
    if (!dayChanged && !timeChanged) return;

    const repeats = evt.repeat && evt.repeat !== "none" && evt.repeat !== "one-off";
    let which = "one";
    if (repeats) {
      const whenText = `${dayLabel(toDate)}${timeChanged ? ` at ${clock(startMins)}` : ""}`;
      const everyText = evt.repeat === "daily" || evt.repeat === "weekdays"
        ? (timeChanged ? `Every one at ${clock(startMins)}` : null)
        : evt.repeat === "weekly" || evt.repeat === "custom"
          ? `Every ${DAYS[parseKey(toDate).getDay()]}${timeChanged ? ` at ${clock(startMins)}` : ""}`
          : `Every one, ${dayChanged ? "on the new date" : `at ${clock(startMins)}`}`;
      const options = [{ key: "one", icon: "1️⃣", label: "Just this one", sub: `Only ${dayLabel(fromDate || toDate)} moves to ${whenText}` }];
      if (everyText) options.push({ key: "all", icon: "🔁", label: everyText, sub: "Moves the whole series" });
      which = window.Sheet && window.Sheet.choose
        ? await window.Sheet.choose({ icon: evt.icon || "📅", title: `Move "${evt.title}"?`, options })
        : (window.confirm(`Move every "${evt.title}"?`) ? "all" : "one");
      if (!which) return; // cancelled
    }

    const before = JSON.parse(JSON.stringify(events()));
    const list = events().slice();
    const idx = list.findIndex(e => String(e.id) === String(evt.id));
    if (idx === -1) return;
    const toDay = DAYS[parseKey(toDate).getDay()];

    if (!repeats) {
      list[idx] = { ...evt, date: toDate, day: toDay, time: newTime };
    } else if (which === "one") {
      // Skip that date in the series, and put a one-off copy on the new one
      const skip = Array.isArray(evt.skipDates) ? evt.skipDates.slice() : [];
      if (fromDate && !skip.includes(fromDate)) skip.push(fromDate);
      list[idx] = { ...evt, skipDates: skip };
      const copy = { ...evt, id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date: toDate, day: toDay, time: newTime, repeat: "none", movedFrom: evt.id };
      delete copy.skipDates;
      delete copy.countdown;
      list.push(copy);
    } else {
      // The whole series: shift its first date by the same number of days
      const shift = dayChanged && fromDate ? Math.round((parseKey(toDate) - parseKey(fromDate)) / 86400000) : 0;
      const moved = { ...evt, time: newTime };
      if (shift && evt.repeat !== "daily" && evt.repeat !== "weekdays") {
        if (evt.date) { const d = parseKey(evt.date); d.setDate(d.getDate() + shift); moved.date = keyOf(d); }
        moved.day = toDay;
      }
      list[idx] = moved;
    }

    window.familyEvents = list;
    saveFamilyEvents(list);
    if (typeof renderWeekCalendar === "function") renderWeekCalendar();
    const where = `${dayLabel(toDate)}${timeChanged ? ` at ${clock(startMins)}` : ""}`;
    const text = repeats && which === "all" ? `Every "${evt.title}" moved` : `"${evt.title}" moved to ${where}`;
    if (typeof showTaskMoveToast === "function") {
      showTaskMoveToast(text, () => {
        window.familyEvents = before;
        saveFamilyEvents(before);
        if (typeof renderWeekCalendar === "function") renderWeekCalendar();
      });
    } else if (typeof showCalendarToast === "function") {
      showCalendarToast(text);
    }
  }
  window.moveCalendarEvent = moveEvent; // for checks

  function init() {
    const grid = document.getElementById("calendar-week-grid");
    if (grid) setup(grid);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
