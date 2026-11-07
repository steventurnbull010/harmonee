// ============================================================================
// FAMILY CALENDAR MULTI-VIEW ENGINE (js/calendar.js)
// 8-Container Week Grid, Day View, 3-Day Schedule, Month View, Event CRUD & Drag-Drop
// ============================================================================

// Calendar View State
let currentCalendarView = window.currentCalendarView || "schedule";
try {
  const savedView = localStorage.getItem("chore_calendar_view");
  if (savedView && ["day", "schedule", "week", "month"].includes(savedView)) {
    currentCalendarView = savedView;
  }
} catch (e) {}
window.currentCalendarView = currentCalendarView;

// Calendar displays events only. Chores live on dedicated Chores board page.
let currentCalendarContentFilter = window.currentCalendarContentFilter || "events";
window.currentCalendarContentFilter = currentCalendarContentFilter;

// Hourly timeline zoom level for Schedule (3-Day) view
let scheduleHourHeight = window.scheduleHourHeight || 64;
try {
  const savedHeight = localStorage.getItem("chore_schedule_hour_height");
  if (savedHeight) {
    const parsedH = parseInt(savedHeight, 10);
    if (parsedH >= 38 && parsedH <= 110) scheduleHourHeight = parsedH;
  }
} catch (e) {}
window.scheduleHourHeight = scheduleHourHeight;

let calendarAnchorDate = window.calendarAnchorDate || new Date();
calendarAnchorDate.setHours(0, 0, 0, 0);
window.calendarAnchorDate = calendarAnchorDate;

let currentCalendarWeekOffset = window.currentCalendarWeekOffset || 0;
window.currentCalendarWeekOffset = currentCalendarWeekOffset;

// Calendar Member Filters State
let activeCalendarMemberFilter = window.activeCalendarMemberFilter || null;
let activeCalendarMemberFilters = window.activeCalendarMemberFilters || null;
try {
  const savedMembers = localStorage.getItem("chore_calendar_member_filters");
  if (savedMembers) {
    const parsed = JSON.parse(savedMembers);
    if (Array.isArray(parsed)) {
      activeCalendarMemberFilters = parsed;
      activeCalendarMemberFilter = parsed.length === 1 ? parsed[0] : (parsed.length > 1 ? parsed.join(" / ") : null);
    }
  }
} catch (e) {}
window.activeCalendarMemberFilter = activeCalendarMemberFilter;
window.activeCalendarMemberFilters = activeCalendarMemberFilters;

function isMemberSelected(memberStr) {
  if (activeCalendarMemberFilters === null) return true;
  if (activeCalendarMemberFilters.length === 0) return false;
  if (!memberStr) return true;

  if (Array.isArray(memberStr)) {
    return memberStr.some(m => isMemberSelected(m));
  }

  const str = String(memberStr).trim();
  const lower = str.toLowerCase();
  if (lower.includes("family") || lower.includes("everyone") || lower.includes("anyone") || lower.includes("whole family") || lower.includes("up for grabs")) {
    return true;
  }
  return activeCalendarMemberFilters.some(m => lower.includes(m.toLowerCase()));
}
window.isMemberSelected = isMemberSelected;

// Universal Event Minutes Calculator
function getEventMinutes(evt) {
  if (!evt) return 720;
  const t = (evt.time || "").trim().toLowerCase();
  if (!t || t === "all day") return 0;
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return 720;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}
window.getEventMinutes = getEventMinutes;

// ============================================================================
// 14. CALENDAR VIEW (Skylight 7-Day Timeline Grid & Family Events)
// ============================================================================
const EVENT_EMOJI_LIST = [
  // Education & Learning
  "📚", "💼", "🎓", "🔬", "📝", "💻", "🧠", "🎨",
  // Lessons & Activities
  "🚗", "🎹", "🎸", "🎤", "🥋", "🏊", "💃", "⚽",
  // Sports & Recreation
  "🏀", "🎾", "🚲", "🏃", "🏋️", "🏐", "🎯", "🧗",
  // Family & Social
  "👨‍👩‍👧‍👦", "🎂", "🍽️", "☕", "🍕", "🎬", "🍿", "🎉",
  // Appointments & Health
  "🏥", "🩺", "🦷", "💇", "🐕", "🐱", "🛒", "✈️",
  // General & Priorities
  "📅", "⏰", "⭐", "✨", "🔔", "📌", "🏆", "🌟"
];

// Icons for calendar events, grouped by the kind of thing it is, in the same
// big-tile picker as the Tasks panel
const EVENT_EMOJI_GROUPS = [
  { name: "General", items: [["📅","Event"],["⏰","Reminder"],["📌","Important"],["🔔","Alert"],["⭐","Special"],["✅","To do"],["🗑️","Bin day"],["♻️","Recycling"]] },
  { name: "School & learning", items: [["🏫","School"],["📚","Homework"],["🎓","Exam"],["✏️","Tutor"],["🔬","Science"],["🧮","Maths"],["💻","Computer"],["🎒","School trip"],["🗣️","Parents' evening"],["📝","Test"]] },
  { name: "Sport & clubs", items: [["⚽","Football"],["🏀","Basketball"],["🎾","Tennis"],["🏊","Swimming"],["🥋","Martial arts"],["🩰","Dance"],["🏃","Running"],["🚴","Cycling"],["🏋️","Gym"],["🏐","Volleyball"],["⛳","Golf"],["🧗","Climbing"],["🤸","Gymnastics"],["🏉","Rugby"],["🏑","Hockey"],["🐴","Riding"]] },
  { name: "Music & arts", items: [["🎹","Piano"],["🎸","Guitar"],["🎻","Violin"],["🥁","Drums"],["🎤","Singing"],["🎨","Art"],["🎭","Drama"],["📷","Photography"],["🎼","Music lesson"]] },
  { name: "Health & appointments", items: [["🩺","Doctor"],["🏥","Hospital"],["🦷","Dentist"],["💊","Pharmacy"],["💉","Vaccine"],["👓","Optician"],["💇","Haircut"],["🧘","Yoga"],["🐾","Vet"]] },
  { name: "Family & friends", items: [["👨‍👩‍👧‍👦","Family"],["🎂","Birthday"],["🎉","Party"],["🎁","Present"],["🍽️","Dinner"],["☕","Coffee"],["🍕","Pizza"],["🏡","Visit"],["👶","Baby"],["💒","Wedding"],["🛌","Sleepover"],["📞","Call"]] },
  { name: "Days out", items: [["🎬","Cinema"],["🍿","Film night"],["🎳","Bowling"],["🎡","Fair"],["🏟️","Match"],["🛍️","Shopping"],["🌳","Park"],["🏖️","Beach"],["⛺","Camping"],["🦁","Zoo"],["🏰","Day trip"],["🎢","Theme park"]] },
  { name: "Travel", items: [["✈️","Flight"],["🚆","Train"],["🚗","Drive"],["🚌","Bus"],["⛴️","Ferry"],["🧳","Holiday"],["🏨","Hotel"],["🗺️","Trip"]] },
  { name: "Work & errands", items: [["💼","Work"],["🏢","Office"],["🛒","Groceries"],["🏦","Bank"],["📮","Post"],["🔧","Repair"],["🚙","Car service"],["🧾","Bills"],["🔑","Keys"]] },
  { name: "Holidays & seasons", items: [["🎄","Christmas"],["🎃","Halloween"],["🐣","Easter"],["💝","Valentine's"],["🎆","Fireworks"],["🍀","St Patrick's"],["🕯️","Celebration"],["☀️","Summer"],["❄️","Winter"]] }
];

function detectEmojiForTitle(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("business") || t.includes("finance") || t.includes("econ")) return "💼";
  if (t.includes("math") || t.includes("algebra") || t.includes("calc")) return "📚";
  if (t.includes("english") || t.includes("read") || t.includes("essay") || t.includes("tutor") || t.includes("study") || t.includes("school") || t.includes("biology") || t.includes("chemistry") || t.includes("physics") || t.includes("science")) return "📚";
  if (t.includes("driv") || t.includes("car")) return "🚗";
  if (t.includes("music") || t.includes("piano") || t.includes("keyboard")) return "🎹";
  if (t.includes("guitar")) return "🎸";
  if (t.includes("sing") || t.includes("choir")) return "🎤";
  if (t.includes("swim")) return "🏊";
  if (t.includes("football") || t.includes("soccer")) return "⚽";
  if (t.includes("basket")) return "🏀";
  if (t.includes("tennis")) return "🎾";
  if (t.includes("karate") || t.includes("judo") || t.includes("martial") || t.includes("taekwondo")) return "🥋";
  if (t.includes("gym") || t.includes("fit") || t.includes("workout")) return "🏋️";
  if (t.includes("dance") || t.includes("ballet")) return "💃";
  if (t.includes("bike") || t.includes("cycl")) return "🚲";
  if (t.includes("run") || t.includes("track")) return "🏃";
  if (t.includes("art") || t.includes("draw") || t.includes("paint")) return "🎨";
  if (t.includes("code") || t.includes("comput") || t.includes("tech") || t.includes("programm")) return "💻";
  if (t.includes("doctor") || t.includes("gp") || t.includes("hospital") || t.includes("clinic")) return "🏥";
  if (t.includes("dentist") || t.includes("teeth") || t.includes("ortho")) return "🦷";
  if (t.includes("hair") || t.includes("barber")) return "💇";
  if (t.includes("family") || t.includes("cousin") || t.includes("grand") || t.includes("roast")) return "👨‍👩‍👧‍👦";
  if (t.includes("birth") || t.includes("party")) return "🎂";
  if (t.includes("dinner") || t.includes("lunch") || t.includes("restaur") || t.includes("meal")) return "🍽️";
  if (t.includes("cinema") || t.includes("movie") || t.includes("film")) return "🎬";
  if (t.includes("shop") || t.includes("grocer")) return "🛒";
  if (t.includes("dog") || t.includes("cat") || t.includes("vet")) return "🐕";
  if (t.includes("trip") || t.includes("flight") || t.includes("holiday") || t.includes("airport")) return "✈️";
  return null;
}

// ---------------------------------------------------------------------------
// Add an event straight from the hourly grid, like Google Calendar:
//  - tap or click an empty spot: a 1-hour event starting at that half hour
//  - mouse: press and drag down (or up) to pick the start and end
//  - touch: press and hold for a moment, then drag; a quick swipe still scrolls
// A shaded block follows your finger or mouse and shows the times, then the
// Add Event panel opens with the date, start and length filled in.
// ---------------------------------------------------------------------------
function wireTimeGridCreate(gridContainer, geo) {
  const { startHour, endHour, hourHeight, topPadding } = geo;
  const SNAP = 15;                       // minutes, while dragging
  const HOLD_MS = 350;                   // touch: hold this long to start a drag
  const minMin = startHour * 60;
  const maxMin = endHour * 60;

  const fmt = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
  };
  const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const minutesAt = (col, clientY) => {
    const y = clientY - col.getBoundingClientRect().top - topPadding;
    return minMin + (y / hourHeight) * 60;
  };
  const snap = (mins, step) => Math.max(minMin, Math.min(maxMin, Math.round(mins / step) * step));
  const isEmptySpot = (target) => !target.closest(".skylight-card, .skylight-timed-event-block, button, a, .skylight-box-meal");

  let sel = null; // { col, anchor, start, end, ghost }

  const draw = () => {
    if (!sel) return;
    const top = topPadding + ((sel.start - minMin) / 60) * hourHeight;
    const height = Math.max(((sel.end - sel.start) / 60) * hourHeight, hourHeight / 4);
    if (!sel.ghost) {
      sel.ghost = document.createElement("div");
      sel.ghost.className = "time-grid-new-event";
      sel.col.appendChild(sel.ghost);
    }
    sel.ghost.style.top = `${top}px`;
    sel.ghost.style.height = `${height}px`;
    sel.ghost.innerHTML = `<span class="time-grid-new-event-title">New event</span><span class="time-grid-new-event-time">${fmt(sel.start)} – ${fmt(sel.end)}</span>`;
  };
  const begin = (col, clientY) => {
    const anchor = snap(Math.floor(minutesAt(col, clientY) / SNAP) * SNAP, SNAP);
    sel = { col, anchor, start: anchor, end: Math.min(maxMin, anchor + SNAP), ghost: null };
    draw();
  };
  const extend = (clientY) => {
    if (!sel) return;
    const m = snap(minutesAt(sel.col, clientY), SNAP);
    if (m >= sel.anchor) { sel.start = sel.anchor; sel.end = Math.max(m, sel.anchor + SNAP); }
    else { sel.start = m; sel.end = sel.anchor + SNAP; }
    sel.end = Math.min(maxMin, sel.end);
    draw();
  };
  const open = (col, start, end) => {
    const dateStr = col.getAttribute("data-date");
    const dayName = col.getAttribute("data-day");
    if (typeof openEventModal === "function") {
      openEventModal(null, dayName, dateStr, { start: hhmm(start), duration: formatEventDuration(end - start) });
    }
  };
  const finish = () => {
    if (!sel) return;
    const { col, start, end, ghost } = sel;
    sel = null;
    // Keep the shaded block on the calendar while the panel is open, so you
    // can see the slot you picked; it goes when the panel closes (saving
    // redraws the calendar with the real event in its place)
    open(col, start, end);
    const modal = document.getElementById("event-modal");
    if (ghost) {
      if (modal && modal.open) modal.addEventListener("close", () => ghost.remove(), { once: true });
      else ghost.remove();
    }
  };
  const cancel = () => { if (sel && sel.ghost) sel.ghost.remove(); sel = null; };

  gridContainer.querySelectorAll(".skylight-time-col").forEach(col => {
    // Mouse and pen: press, drag, release. A plain click becomes a 1-hour event.
    col.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || e.button !== 0 || !isEmptySpot(e.target)) return;
      e.preventDefault();
      const downY = e.clientY;
      let dragged = false;
      begin(col, downY);
      const move = (ev) => {
        if (!dragged && Math.abs(ev.clientY - downY) < 6) return;
        dragged = true;
        extend(ev.clientY);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!dragged && sel) {
          // plain click: the half hour you clicked in, for an hour
          const s = snap(Math.floor(minutesAt(col, downY) / 30) * 30, 30);
          sel.start = Math.min(s, maxMin - 60);
          sel.end = sel.start + 60;
          draw();
        }
        finish();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });

    // Touch: a tap makes a 1-hour event; press and hold, then drag, to pick a
    // range. Moving before the hold kicks in is a normal scroll or swipe.
    let holdTimer = null, touchStartY = 0, touchStartX = 0, moved = false, holding = false;
    col.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || !isEmptySpot(e.target)) return;
      const t = e.touches[0];
      touchStartY = t.clientY; touchStartX = t.clientX; moved = false; holding = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        holding = true;
        begin(col, touchStartY);
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
      }, HOLD_MS);
    }, { passive: true });
    col.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (holding) {
        if (e.cancelable) e.preventDefault(); // drag the selection, don't scroll
        extend(t.clientY);
        return;
      }
      if (Math.abs(t.clientY - touchStartY) > 8 || Math.abs(t.clientX - touchStartX) > 8) {
        moved = true;
        clearTimeout(holdTimer);
      }
    }, { passive: false });
    col.addEventListener("touchend", (e) => {
      clearTimeout(holdTimer);
      if (holding) {
        holding = false;
        if (e.cancelable) e.preventDefault(); // no click after a drag
        finish();
        return;
      }
      if (moved || !isEmptySpot(e.target)) return;
      // Quick tap: an hour from the half hour you tapped
      if (e.cancelable) e.preventDefault();
      const s = snap(Math.floor(minutesAt(col, touchStartY) / 30) * 30, 30);
      sel = { col, anchor: s, start: Math.min(s, maxMin - 60), end: Math.min(s, maxMin - 60) + 60, ghost: null };
      draw();
      finish();
    });
    col.addEventListener("touchcancel", () => { clearTimeout(holdTimer); holding = false; cancel(); });
  });
}

// "8 hours", "1.5 hours", "45 mins": the same wording the duration list and
// the calendar's height maths use
function formatEventDuration(mins) {
  if (mins < 60) return `${mins} mins`;
  const h = Math.round((mins / 60) * 100) / 100;
  return h === 1 ? "1 hour" : `${h} hours`;
}
window.formatEventDuration = formatEventDuration;

// Lengths outside the fixed list (a 9 to 5 drag is "8 hours") get their own
// option, so the panel can show and save them
function setEventDurationValue(select, value) {
  if (!select) return;
  const v = value || "1 hour";
  select.querySelectorAll("option[data-custom]").forEach(o => o.remove());
  if (![...select.options].some(o => o.value === v)) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    opt.setAttribute("data-custom", "true");
    const allDay = [...select.options].find(o => o.value === "All Day");
    select.insertBefore(opt, allDay || null);
  }
  select.value = v;
}

// slot (optional): { start: "09:00", duration: "8 hours" } from tapping or
// dragging on the calendar grid
function openEventModal(evt = null, defaultDay = null, defaultDate = null, slot = null) {
  const modal = document.getElementById("event-modal");
  const form = document.getElementById("form-event");
  const modalTitle = document.getElementById("event-modal-title");
  const idInput = document.getElementById("event-id-input");
  const titleInput = document.getElementById("event-title-input");
  const dateInput = document.getElementById("event-date-input");
  const daySelect = document.getElementById("event-day-select");
  const selectedDayBadge = document.getElementById("event-selected-day-badge");
  const timeInput = document.getElementById("event-time-input");
  const timeDisplayText = document.getElementById("time-display-text");
  const time12hHint = document.getElementById("time-12h-hint");
  const durationSelect = document.getElementById("event-duration-select");
  const repeatSelect = document.getElementById("event-repeat-select");
  const repeatOptWeekly = document.getElementById("repeat-opt-weekly");
  const repeatOptMonthly = document.getElementById("repeat-opt-monthly");
  const repeatOptAnnually = document.getElementById("repeat-opt-annually");
  const memberInput = document.getElementById("event-member-input");
  const descInput = document.getElementById("event-description-input");
  const locationInput = document.getElementById("event-location-input");
  const iconInput = document.getElementById("event-icon-input");
  const categoryInput = document.getElementById("event-category-input");
  const btnDelete = document.getElementById("btn-delete-event");
  const emojiDisplay = document.getElementById("event-emoji-display");
  const modalTrophy = document.getElementById("event-modal-trophy");
  const btnEmojiPicker = document.getElementById("btn-event-emoji-picker");
  const emojiPalette = document.getElementById("event-emoji-palette");
  const btnClosePalette = document.getElementById("btn-close-emoji-palette");
  const emojiPaletteGrid = document.getElementById("emoji-palette-grid");

  if (!modal) return;

  const weekDaysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  let currentHour = "16";
  let currentMinute = "30";
  let currentDay = "Tuesday";
  let currentDateKey = getLocalDateKey(new Date());

  // 1. Event Date & Day Helper
  const setDate = (target) => {
    let dObj;
    if (target instanceof Date) {
      dObj = new Date(target);
    } else if (typeof target === "string" && /^\d{4}-\d{2}-\d{2}$/.test(target)) {
      const [y, m, d] = target.split("-").map(Number);
      dObj = new Date(y, m - 1, d);
    } else {
      dObj = new Date();
    }
    if (isNaN(dObj.getTime())) dObj = new Date();
    dObj.setHours(0, 0, 0, 0);

    currentDateKey = getLocalDateKey(dObj);
    const dayOfWeekIdx = dObj.getDay() === 0 ? 6 : dObj.getDay() - 1;
    const dayName = weekDaysList[dayOfWeekIdx] || "Tuesday";
    currentDay = dayName;

    if (dateInput) dateInput.value = currentDateKey;
    if (daySelect) daySelect.value = dayName;

    // Format badge: e.g. "Tuesday, 15 Dec 2026"
    const formattedBadge = dObj.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    if (selectedDayBadge) selectedDayBadge.textContent = `· ${dayName}`;

    if (repeatOptWeekly) repeatOptWeekly.textContent = `Weekly on ${dayName}`;
    if (repeatOptMonthly) repeatOptMonthly.textContent = `Monthly on the ${getOrdinal(dObj.getDate())}`;
    if (repeatOptAnnually) {
      const monthDayStr = dObj.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      repeatOptAnnually.textContent = `Annually on ${monthDayStr}`;
    }
  };

  // Wire Date Input change
  if (dateInput) {
    dateInput.onchange = (e) => {
      if (e.target.value) setDate(e.target.value);
    };
  }

  // Wire Quick Date Pills
  document.querySelectorAll(".quick-date-pill").forEach(pill => {
    pill.onclick = (e) => {
      e.preventDefault();
      const offset = pill.getAttribute("data-offset");
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (offset === "0") {
        setDate(d);
      } else if (offset === "1") {
        d.setDate(d.getDate() + 1);
        setDate(d);
      } else if (offset === "weekend") {
        const curDay = d.getDay(); // 0 is Sun, 6 is Sat
        const daysUntilSat = (6 - curDay + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilSat);
        setDate(d);
      } else if (offset === "7") {
        d.setDate(d.getDate() + 7);
        setDate(d);
      } else if (offset === "30") {
        d.setMonth(d.getMonth() + 1);
        setDate(d);
      }
    };
  });

  // Determine initial date
  let initialDateToSet = null;
  if (evt) {
    if (evt.date) {
      initialDateToSet = evt.date;
    } else if (evt.day) {
      const today = new Date();
      const curIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const targetIdx = weekDaysList.indexOf(evt.day);
      const diff = targetIdx >= 0 ? (targetIdx - curIdx) : 0;
      const d = new Date(today);
      d.setDate(d.getDate() + diff);
      initialDateToSet = getLocalDateKey(d);
    }
  } else if (defaultDate) {
    initialDateToSet = defaultDate;
  } else if (calendarAnchorDate && (currentCalendarView === "day" || currentCalendarView === "schedule")) {
    initialDateToSet = getLocalDateKey(calendarAnchorDate);
  } else if (defaultDay) {
    const today = new Date();
    const curIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const targetIdx = weekDaysList.indexOf(defaultDay);
    const diff = targetIdx >= 0 ? (targetIdx - curIdx) : 0;
    const d = new Date(today);
    d.setDate(d.getDate() + diff);
    initialDateToSet = getLocalDateKey(d);
  } else {
    initialDateToSet = getLocalDateKey(new Date());
  }

  setDate(initialDateToSet);

  // 2. 24h Time Carousel Helper
  const parseTimeString = (str) => {
    if (!str || str.toLowerCase() === "all day") {
      return { hour: "09", minute: "00" };
    }
    const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return { hour: "16", minute: "30" };
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toLowerCase() : null;

    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;

    const validMins = [0, 15, 30, 45];
    const nearestMin = validMins.reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev);

    return {
      hour: String(Math.min(23, Math.max(0, h))).padStart(2, "0"),
      minute: String(nearestMin).padStart(2, "0")
    };
  };

  const setTime = (hourStr, minStr) => {
    currentHour = String(hourStr).padStart(2, "0");
    currentMinute = String(minStr).padStart(2, "0");
    const time24 = `${currentHour}:${currentMinute}`;

    const hNum = parseInt(currentHour, 10);
    const ampm = hNum >= 12 ? "PM" : "AM";
    const h12 = hNum % 12 || 12;
    const display12 = `${h12}:${currentMinute} ${ampm}`;

    if (timeDisplayText) timeDisplayText.textContent = time24;
    if (time12hHint) time12hHint.textContent = `(${display12})`;
    if (timeInput) timeInput.value = time24;

    document.querySelectorAll(".hour-chip").forEach(chip => {
      const h = chip.getAttribute("data-hour");
      if (h === currentHour) {
        chip.classList.add("is-selected");
        chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        chip.classList.remove("is-selected");
      }
    });

    document.querySelectorAll(".minute-chip").forEach(chip => {
      const m = chip.getAttribute("data-minute");
      if (m === currentMinute) {
        chip.classList.add("is-selected");
      } else {
        chip.classList.remove("is-selected");
      }
    });
  };

  // Wire Hour Chips
  document.querySelectorAll(".hour-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const h = chip.getAttribute("data-hour");
      if (h) setTime(h, currentMinute);
    };
  });

  // Wire Minute Chips
  document.querySelectorAll(".minute-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const m = chip.getAttribute("data-minute");
      if (m) setTime(currentHour, m);
    };
  });

  // Wire Hour Prev/Next Carousel Arrows
  const btnHourPrev = document.getElementById("btn-hour-prev");
  const btnHourNext = document.getElementById("btn-hour-next");
  if (btnHourPrev) {
    btnHourPrev.onclick = (e) => {
      e.preventDefault();
      let h = parseInt(currentHour, 10) - 1;
      if (h < 0) h = 23;
      setTime(String(h).padStart(2, "0"), currentMinute);
    };
  }
  if (btnHourNext) {
    btnHourNext.onclick = (e) => {
      e.preventDefault();
      let h = parseInt(currentHour, 10) + 1;
      if (h > 23) h = 0;
      setTime(String(h).padStart(2, "0"), currentMinute);
    };
  }

  // 3. Multi-Member Selection
  // New events start as the whole family, or whoever the calendar is
  // filtered to
  const boardMembers = (window.familyMembers && window.familyMembers.length) ? window.familyMembers : ["Steven", "Sorcha", "Ava", "Dara"];
  const filtered = Array.isArray(activeCalendarMemberFilters) ? activeCalendarMemberFilters.filter(m => boardMembers.includes(m)) : [];
  let selectedEventMembers = filtered.length ? [...filtered] : ["Family"];

  // Same avatar picker as the Tasks panel: picked people are filled in their
  // colour with a tick, with a sentence underneath saying who it's for
  const updateMemberChipsUI = () => {
    const row = document.getElementById("event-who-row");
    const summary = document.getElementById("event-who-summary");
    const isFamily = (n) => /^(family|whole family|everyone)$/i.test(n);
    if (selectedEventMembers.some(isFamily) || !selectedEventMembers.length) selectedEventMembers = ["Family"];
    const known = selectedEventMembers.filter(n => !isFamily(n));
    if (row) {
      const tick = `<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
      const pills = [...boardMembers, ...known.filter(n => !boardMembers.includes(n)), "Family"].map(p => {
        const fam = p === "Family";
        const color = fam ? "#f59e0b" : getMemberPalette(p).primary;
        const on = fam ? selectedEventMembers[0] === "Family" : selectedEventMembers.includes(p);
        return `<button type="button" class="drawer-profile-pill ${on ? "active" : ""}" data-event-member="${escapeHtml(p)}" aria-pressed="${on}" style="--profile-color: ${color};">
          <span class="drawer-profile-avatar">${fam ? "👪" : escapeHtml(p.charAt(0).toUpperCase())}${tick}</span>
          <span class="drawer-profile-name">${fam ? "Everyone" : escapeHtml(p)}</span>
        </button>`;
      }).join("");
      row.innerHTML = pills;
      row.querySelectorAll("[data-event-member]").forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const m = btn.getAttribute("data-event-member");
          if (m === "Family") {
            selectedEventMembers = ["Family"];
          } else {
            selectedEventMembers = selectedEventMembers.filter(x => !isFamily(x));
            selectedEventMembers = selectedEventMembers.includes(m) ? selectedEventMembers.filter(x => x !== m) : [...selectedEventMembers, m];
            if (!selectedEventMembers.length) selectedEventMembers = ["Family"];
          }
          updateMemberChipsUI();
        };
      });
    }
    if (summary) {
      const people = selectedEventMembers.filter(n => !isFamily(n));
      summary.textContent = !people.length ? "For everyone in the family."
        : people.length === 1 ? `For ${people[0]}.`
        : `For ${people.slice(0, -1).join(", ")} & ${people[people.length - 1]}.`;
    }
    if (memberInput) memberInput.value = selectedEventMembers.join(" & ") || "Family";
  };

  // 4. Emoji Selector & Auto-Detection Helper
  let isManualEmoji = false;
  const setEmoji = (emoji) => {
    const em = emoji || "📅";
    if (iconInput) iconInput.value = em;
    if (emojiDisplay) emojiDisplay.textContent = em;
    if (modalTrophy) modalTrophy.textContent = em;

    if (emojiPaletteGrid) {
      emojiPaletteGrid.querySelectorAll(".drawer-emoji-item").forEach(item => {
        if (item.getAttribute("data-emoji") === em) item.classList.add("is-selected");
        else item.classList.remove("is-selected");
      });
    }
  };

  // Populate emoji palette grid once if empty
  if (emojiPaletteGrid && emojiPaletteGrid.children.length === 0) {
    emojiPaletteGrid.innerHTML = EVENT_EMOJI_GROUPS.map(g => `
      <div class="drawer-emoji-group">
        <div class="drawer-emoji-group-title">${escapeHtml(g.name)}</div>
        <div class="drawer-emoji-group-items">${g.items.map(([em, label]) => `<button type="button" class="drawer-emoji-item" data-emoji="${em}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${em}</button>`).join("")}</div>
      </div>`).join("");

    emojiPaletteGrid.querySelectorAll(".drawer-emoji-item").forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const chosen = item.getAttribute("data-emoji");
        if (chosen) {
          isManualEmoji = true;
          setEmoji(chosen);
          if (emojiPalette) emojiPalette.style.display = "none";
          if (btnEmojiPicker) btnEmojiPicker.setAttribute("aria-expanded", "false");
        }
      };
    });
  }

  if (btnEmojiPicker) {
    btnEmojiPicker.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!emojiPalette) return;
      const isOpen = emojiPalette.style.display !== "none";
      emojiPalette.style.display = isOpen ? "none" : "block";
      btnEmojiPicker.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) emojiPalette.scrollTop = 0;
    };
    btnEmojiPicker.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") btnEmojiPicker.onclick(e); };
  }

  if (btnClosePalette) {
    btnClosePalette.onclick = (e) => {
      e.preventDefault();
      if (emojiPalette) emojiPalette.style.display = "none";
    };
  }

  if (emojiPalette) {
    emojiPalette.style.display = "none";
  }

  if (titleInput) {
    titleInput.oninput = () => {
      if (!isManualEmoji) {
        const detected = detectEmojiForTitle(titleInput.value);
        if (detected) setEmoji(detected);
        else if (!titleInput.value.trim()) setEmoji("📅");
      }
    };
  }

  // Populate data when editing vs creating
  if (evt) {
    if (modalTitle) modalTitle.textContent = "Edit Event";
    if (idInput) idInput.value = evt.id || "";
    if (titleInput) titleInput.value = evt.title || "";
    setEventDurationValue(durationSelect, evt.duration || "1 hour");
    if (repeatSelect) repeatSelect.value = evt.repeat || "none";
    if (descInput) descInput.value = evt.description || "";
    if (locationInput) locationInput.value = evt.location || "";
    if (categoryInput) categoryInput.value = evt.category || "Other";

    isManualEmoji = true;
    setEmoji(evt.icon || "📅");

    const parsed = parseTimeString(evt.time || "16:30");
    setTime(parsed.hour, parsed.minute);
    
    const curMem = evt.member || "Family";
    selectedEventMembers = curMem.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    if (selectedEventMembers.length === 0) selectedEventMembers = ["Family"];
    updateMemberChipsUI();
    if (btnDelete) btnDelete.style.display = "inline-block";
  } else {
    if (modalTitle) modalTitle.textContent = "Add Event";
    if (idInput) idInput.value = "";
    if (titleInput) titleInput.value = "";
    setEventDurationValue(durationSelect, (slot && slot.duration) || "1 hour");
    if (repeatSelect) repeatSelect.value = "none"; // Defaults to One-Off
    if (descInput) descInput.value = "";
    if (locationInput) locationInput.value = "";
    if (categoryInput) categoryInput.value = "Other";

    isManualEmoji = false;
    setEmoji("📅");

    if (slot && /^\d{2}:\d{2}$/.test(slot.start || "")) {
      const [sh, sm] = slot.start.split(":");
      setTime(sh, sm); // where you tapped or dragged on the calendar
    } else {
      // The next half hour from now, like Google Calendar
      const n = new Date();
      const next = Math.min(23 * 60 + 30, Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30);
      setTime(String(Math.floor(next / 60)).padStart(2, "0"), String(next % 60).padStart(2, "0"));
    }

    selectedEventMembers = filtered.length ? [...filtered] : ["Family"];
    updateMemberChipsUI();
    if (btnDelete) btnDelete.style.display = "none";
  }

  // When: Starts and Ends (the device's own time pickers) and All day. Saving
  // still uses the start time plus a length, so Ends sets the length.
  const startInput = document.getElementById("event-start-time");
  const endInput = document.getElementById("event-end-time");
  const allDayToggle = document.getElementById("event-allday-toggle");
  const timeRow = document.getElementById("event-time-row");
  const durLabel = document.getElementById("event-duration-label");
  const toMins = (hhmm) => { const [h, m] = (hhmm || "00:00").split(":").map(Number); return h * 60 + m; };
  const toHHMM = (mins) => { const t = ((mins % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  const durationMins = (str) => {
    const m = String(str || "").match(/(\d+(?:\.\d+)?)\s*(h|hour|hr|min|m)/i);
    if (!m) return 60;
    return /^m/i.test(m[2]) ? Math.round(parseFloat(m[1])) : Math.round(parseFloat(m[1]) * 60);
  };
  const showLength = (mins) => { if (durLabel) durLabel.textContent = `· ${formatEventDuration(mins)}`; };
  const syncWhenUI = () => {
    const allDay = durationSelect && durationSelect.value === "All Day";
    if (allDayToggle) allDayToggle.checked = allDay;
    if (timeRow) timeRow.style.display = allDay ? "none" : "";
    const start = (timeInput && timeInput.value) || "09:00";
    const len = allDay ? 60 : durationMins(durationSelect && durationSelect.value);
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = toHHMM(toMins(start) + len);
    showLength(len);
  };
  if (startInput) startInput.onchange = () => {
    if (!startInput.value) return;
    const len = toMins(endInput && endInput.value) - toMins(timeInput.value);
    const [h, m] = startInput.value.split(":");
    setTime(h, m);
    if (endInput) endInput.value = toHHMM(toMins(startInput.value) + (len > 0 ? len : 60)); // keep the same length
  };
  if (endInput) endInput.onchange = () => {
    if (!endInput.value) return;
    let len = toMins(endInput.value) - toMins(startInput.value);
    if (len <= 0) { len = 15; endInput.value = toHHMM(toMins(startInput.value) + 15); }
    setEventDurationValue(durationSelect, formatEventDuration(len));
    showLength(len);
  };
  if (allDayToggle) allDayToggle.onchange = () => {
    setEventDurationValue(durationSelect, allDayToggle.checked ? "All Day" : "1 hour");
    syncWhenUI();
  };
  syncWhenUI();

  // Wire preset suggestion chips
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const pTitle = chip.getAttribute("data-title");
      const pIcon = chip.getAttribute("data-icon") || "📅";
      const pCat = chip.getAttribute("data-category") || "Other";
      const pTime = chip.getAttribute("data-time") || "16:30";
      const pDuration = chip.getAttribute("data-duration") || "1 hour";
      const pFor = chip.getAttribute("data-for");

      if (titleInput) titleInput.value = pTitle;
      isManualEmoji = true;
      setEmoji(pIcon);
      if (categoryInput) categoryInput.value = pCat;
      if (durationSelect) durationSelect.value = pDuration;
      if (repeatSelect) repeatSelect.value = "none"; // Defaults to One-Off

      const parsed = parseTimeString(pTime);
      setTime(parsed.hour, parsed.minute);

      if (pFor) {
        if (pFor === "Family") selectedEventMembers = ["Family"];
        else selectedEventMembers = [pFor];
        updateMemberChipsUI();
      }
    };
  });

  // Wire member chips (Multi-select)
  const closeEventModal = () => {
    if (modal) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  const btnClose = document.getElementById("btn-close-event-modal");
  const btnCancel = document.getElementById("btn-cancel-event-modal");
  if (btnClose) btnClose.onclick = closeEventModal;
  if (btnCancel) btnCancel.onclick = closeEventModal;

  if (btnDelete) {
    btnDelete.onclick = (e) => {
      e.preventDefault();
      const eventId = idInput.value;
      if (!eventId) return;

      if (!window.familyEvents) window.familyEvents = loadFamilyEvents();
      const evtToDelete = (window.familyEvents || []).find(x => x.id === eventId);
      const evtTitle = evtToDelete ? evtToDelete.title : (titleInput ? titleInput.value : "Calendar Event");
      const evtTime = evtToDelete ? `${evtToDelete.day} at ${evtToDelete.time}` : "";

      showDeleteConfirmation({
        icon: "🗓️",
        title: "Delete Calendar Event?",
        itemTitle: evtTitle,
        warning: evtTime ? `This will permanently remove this event (${evtTime}) from your calendar schedule.` : "This will permanently remove this event from your calendar schedule.",
        confirmLabel: "Delete Event",
        onConfirm: () => {
          window.familyEvents = (window.familyEvents || []).filter(x => x.id !== eventId);
          saveFamilyEvents(window.familyEvents);
          renderWeekCalendar();
          closeEventModal();
          if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
        }
      });
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const eventId = idInput.value || `evt_${Date.now()}`;
      const title = titleInput.value.trim();
      if (!title) return;

      const date = (dateInput && dateInput.value) ? dateInput.value : currentDateKey;
      const day = (daySelect && daySelect.value) ? daySelect.value : currentDay;
      const time = (timeInput && timeInput.value.trim()) ? timeInput.value.trim() : `${currentHour}:${currentMinute}`;
      const duration = durationSelect ? durationSelect.value : "1 hour";
      const repeat = repeatSelect ? repeatSelect.value : "none";
      const member = memberInput.value || "Family";
      const description = descInput ? descInput.value.trim() : "";
      const location = locationInput.value.trim();
      const icon = iconInput.value || "📅";
      const category = categoryInput.value || "Other";

      if (!window.familyEvents) window.familyEvents = loadFamilyEvents();
      const existingIdx = (window.familyEvents || []).findIndex(x => x.id === eventId);
      const newEvt = {
        id: eventId,
        title,
        date,
        day,
        time,
        duration,
        repeat,
        member,
        description,
        location,
        icon,
        category
      };

      if (!Array.isArray(window.familyEvents)) window.familyEvents = [];
      if (existingIdx >= 0) {
        window.familyEvents[existingIdx] = newEvt;
      } else {
        window.familyEvents.push(newEvt);
      }

      saveFamilyEvents(window.familyEvents);
      renderWeekCalendar();
      closeEventModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    };
  }

  if (!modal.open) {
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "true");
  }
}
window.openEventModal = openEventModal;

// ============================================================================
// SKYLIGHT CALENDAR MULTI-VIEW ENGINE (Day, Schedule 3-Day, Week, Month)
// ============================================================================

function formatCalendarRange(view, anchorDate, startDate, dayCount) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (view === "day") {
    const d = anchorDate || new Date();
    return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
  }
  if (view === "schedule") {
    const start = startDate || new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]}`;
    } else {
      return `${start.getDate()} ${monthNames[start.getMonth()]} – ${end.getDate()} ${monthNames[end.getMonth()]}`;
    }
  }
  if (view === "week") {
    const start = startDate || new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]}`;
    } else {
      return `${start.getDate()} ${monthNames[start.getMonth()]} – ${end.getDate()} ${monthNames[end.getMonth()]}`;
    }
  }
  if (view === "month") {
    const d = anchorDate || new Date();
    return `${fullMonthNames[d.getMonth()]} ${d.getFullYear()}`;
  }
  return "";
}

function setCalendarView(view, targetDate = null) {
  if (!["day", "schedule", "week", "month"].includes(view)) view = "week";
  currentCalendarView = view;
  window.currentCalendarView = view;
  if (targetDate) {
    calendarAnchorDate = new Date(targetDate);
    calendarAnchorDate.setHours(0, 0, 0, 0);
  } else if (view === "schedule") {
    // Schedule view strictly shows Today, Tomorrow, and Next Day by default
    calendarAnchorDate = new Date();
    calendarAnchorDate.setHours(0, 0, 0, 0);
  } else if (view === "day" && !calendarAnchorDate) {
    calendarAnchorDate = new Date();
    calendarAnchorDate.setHours(0, 0, 0, 0);
  }
  try {
    localStorage.setItem("chore_calendar_view", view);
  } catch (e) {}
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.setCalendarView = setCalendarView;

function setCalendarContentFilter(filter) {
  if (!["all", "events", "chores"].includes(filter)) filter = "all";
  currentCalendarContentFilter = filter;
  try {
    localStorage.setItem("chore_calendar_content_filter", filter);
  } catch (e) {}
  syncCalendarContentFilterUI();
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.setCalendarContentFilter = setCalendarContentFilter;

function syncCalendarContentFilterUI() {
  document.querySelectorAll(".calendar-filter-btn").forEach(btn => {
    const f = btn.getAttribute("data-filter");
    const isActive = f === currentCalendarContentFilter;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
window.syncCalendarContentFilterUI = syncCalendarContentFilterUI;

function navigateCalendar(dir, stepDays = null) {
  if (currentCalendarView === "day") {
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + dir);
  } else if (currentCalendarView === "schedule") {
    // When dragging/swiping day-by-day, stepDays is 1. When clicking arrows, stepDays is 3.
    const steps = (typeof stepDays === "number") ? stepDays : 3;
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + (dir * steps));
  } else if (currentCalendarView === "week") {
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + (dir * 7));
  } else if (currentCalendarView === "month") {
    calendarAnchorDate.setMonth(calendarAnchorDate.getMonth() + dir);
  }
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.navigateCalendar = navigateCalendar;

function renderCalendarMonthView(gridContainer, anchorDate, today, familyEventsList, currentTasksList, dinnerThemes, activeMemberFilter) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  const firstDayDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const weekShortLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const weekdaysHtml = weekShortLabels.map(s => `<div class="month-weekday-label">${s}</div>`).join("");

  let cellsHtml = "";
  let dayCounter = 1;
  let nextMonthDay = 1;
  const totalCells = (firstDayDow + totalDays) > 35 ? 42 : 35;

  for (let cellIdx = 0; cellIdx < totalCells; cellIdx++) {
    let cellDate;
    let isOtherMonth = false;
    let dayNum;

    if (cellIdx < firstDayDow) {
      dayNum = prevMonthLastDay - firstDayDow + cellIdx + 1;
      cellDate = new Date(year, month - 1, dayNum);
      isOtherMonth = true;
    } else if (dayCounter <= totalDays) {
      dayNum = dayCounter++;
      cellDate = new Date(year, month, dayNum);
    } else {
      dayNum = nextMonthDay++;
      cellDate = new Date(year, month + 1, dayNum);
      isOtherMonth = true;
    }

    const isToday = today.toDateString() === cellDate.toDateString();
    const dayDowIdx = cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1;
    const dayName = weekDayNames[dayDowIdx];
    const dateStr = getLocalDateKey(cellDate);

    let dayEvents = ((window.familyEvents || []) || []).filter(e => isEventOnDate(e, dateStr, dayName, cellDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }

    const activeWeekKey = getIsoWeekKey(new Date());
    const todayDateStr = getLocalDateKey(new Date());
    const cellWeekKey = getIsoWeekKey(cellDate);
    const isCellCurrentWeek = (cellWeekKey === activeWeekKey);
    const isCellFutureDate = (dateStr > todayDateStr);

    let dayTasks = (window.currentTasks || []).filter(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      if (isDaily) return true;
      const isWeekly = task.repeat === "weekly";
      if (isWeekly) return task.day === dayName;
      if (task.done) {
        if (task.completedAt) {
          return getLocalDateKey(task.completedAt) === dateStr;
        }
        return isCellCurrentWeek && task.completedDay === dayName;
      }
      if (isCellCurrentWeek) {
        return task.day === dayName;
      }
      return task.date ? task.date === dateStr : false;
    });
    if (activeCalendarMemberFilters !== null) {
      dayTasks = dayTasks.filter(task => {
        const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
        let assigned = "Anyone";
        if (isCellCurrentWeek && isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
          assigned = task.assignedDays[dayName] || "Anyone";
        } else {
          assigned = isDaily ? "Anyone" : (task.assignedTo || "Anyone");
        }
        return isMemberSelected(assigned);
      });
    }

    const totalChores = dayTasks.length;
    const completedChores = isCellFutureDate ? 0 : dayTasks.filter(t => {
      const isDaily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      if (isDaily) {
        if (t.completedDays && t.completedDays[dayName]) {
          const rec = t.completedDays[dayName];
          const compDateStr = (typeof rec === "object" && rec !== null && rec.completedAt) ? getLocalDateKey(rec.completedAt) : null;
          if (compDateStr) return compDateStr === dateStr;
          return isCellCurrentWeek;
        }
        return false;
      }
      const isWeekly = t.repeat === "weekly";
      if (isWeekly) {
        if (t.completedWeeks && t.completedWeeks[cellWeekKey]) return true;
        if (t.done && t.completedAt && getIsoWeekKey(new Date(t.completedAt)) === cellWeekKey) return true;
        return false;
      }
      return !!t.done && (t.completedAt ? getLocalDateKey(t.completedAt) === dateStr : isCellCurrentWeek);
    }).length;

    const cellMeal = getMealForDate(cellDate);
    const dinnerSnippet = (cellMeal && cellMeal.title && !isOtherMonth)
      ? `<div class="month-cell-dinner" data-date-str="${dateStr}" title="Planned Dinner: ${escapeHtml(cellMeal.title)} — Tap to view recipe">
           <span class="month-dinner-icon">${escapeHtml(cellMeal.emoji || '🍽️')}</span>
           <span class="month-dinner-title">${escapeHtml(cellMeal.title)}</span>
         </div>`
      : "";

    // In Month View: only scheduled events are rendered as chips.
    // Chores are cleanly summarized at the bottom as a count badge (e.g. ✓ 5/5).
    const cellItems = [];

    // 1. Scheduled Events (Tutors, lessons, rehearsals, activities)
    dayEvents.forEach(evt => {
      const mList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
      const pal = getMemberPalette(mList[0] || "family");
      cellItems.push({
        type: "event",
        icon: evt.icon || "📅",
        title: evt.title,
        sub: evt.time || "All Day",
        pal: pal
      });
    });

    const maxItems = 2;
    const visibleItems = cellItems.slice(0, maxItems);
    const extraCount = cellItems.length - maxItems;

    const itemChipsHtml = visibleItems.map(item => {
      return `
        <div class="month-mini-event" 
             style="background: ${item.pal.lightBg}; color: ${item.pal.text}; border-left-color: ${item.pal.primary};" 
             title="${escapeHtml(item.title)} (${escapeHtml(item.sub)})">
          <span class="mini-icon">${escapeHtml(item.icon)}</span>
          <span class="mini-title">${escapeHtml(item.title)}</span>
        </div>
      `;
    }).join("") + (extraCount > 0 ? `<div class="month-mini-event month-more-badge" style="color: var(--text-muted); font-size: 0.65rem;">+${extraCount} more</div>` : "");

    const choresBadge = totalChores > 0
      ? `<div class="month-cell-chores ${completedChores === totalChores ? 'all-done' : ''}">${completedChores === totalChores ? '✓' : '🧹'} ${completedChores}/${totalChores}</div>`
      : "";

    let monthContentHtml = "";
    if (currentCalendarContentFilter === "events") {
      monthContentHtml = `<div class="month-cell-events">${itemChipsHtml}</div>`;
    } else if (currentCalendarContentFilter === "chores") {
      monthContentHtml = choresBadge ? `<div class="month-cell-events is-chores-only">${choresBadge}</div>` : "";
    } else {
      monthContentHtml = `<div class="month-cell-events">${itemChipsHtml}</div>${choresBadge}`;
    }

    cellsHtml += `
      <div class="calendar-month-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}" 
           data-date-str="${dateStr}"
           title="Tap to open ${dayName}, ${dayNum} in Day View">
        <div class="month-cell-header">
          <span class="month-cell-date">${dayNum}</span>
        </div>
        ${dinnerSnippet}
        ${monthContentHtml}
      </div>
    `;
  }

  gridContainer.className = "calendar-week-grid view-month";
  gridContainer.innerHTML = `
    <div class="calendar-month-container">
      <div class="calendar-month-weekdays">${weekdaysHtml}</div>
      <div class="calendar-month-grid">${cellsHtml}</div>
    </div>
  `;

  gridContainer.querySelectorAll(".month-cell-dinner").forEach(din => {
    din.onclick = (e) => {
      e.stopPropagation();
      const dStr = din.getAttribute("data-date-str");
      if (typeof openPlanMealModalForDate === "function") {
        openPlanMealModalForDate(dStr);
      }
    };
  });

  gridContainer.querySelectorAll(".calendar-month-cell").forEach(cell => {
    cell.onclick = () => {
      const dStr = cell.getAttribute("data-date-str");
      if (dStr) {
        const [y, m, d] = dStr.split("-").map(Number);
        const cellDate = new Date(y, m - 1, d);
        cellDate.setHours(0, 0, 0, 0);
        setCalendarView("day", cellDate);
      }
    };
  });
}

function renderWeekCalendar() {
  const gridContainer = document.getElementById("calendar-week-grid");
  if (!gridContainer) return;

  const viewContainer = document.querySelector(".calendar-view-container");
  if (viewContainer) {
    viewContainer.classList.toggle("view-week-active", currentCalendarView === "week");
  }

  // 1. Live Clock & Header
  const clockEl = document.getElementById("calendar-live-clock");
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const famTitleEl = document.getElementById("calendar-family-name");
  if (famTitleEl) {
    famTitleEl.textContent = isDefaultTurnbullBoard ? "Turnbull Family" : (boardSettings.familyName || "Our Family");
  }

  // 1b. Render Family Sticky Note / Message of the Day
  renderFamilyStickyNote();
  const btnEditSticky = document.getElementById("btn-edit-sticky");
  if (btnEditSticky && (!btnEditSticky.hasAttribute || !btnEditSticky.hasAttribute("data-wired"))) {
    if (typeof btnEditSticky.setAttribute === "function") btnEditSticky.setAttribute("data-wired", "true");
    btnEditSticky.onclick = (e) => {
      e.stopPropagation();
      openStickyNoteModal();
    };
  }
  const stickyCard = document.getElementById("family-sticky-card");
  if (stickyCard && (!stickyCard.hasAttribute || !stickyCard.hasAttribute("data-wired"))) {
    if (typeof stickyCard.setAttribute === "function") stickyCard.setAttribute("data-wired", "true");
    stickyCard.onclick = () => {
      openStickyNoteModal();
    };
  }
  const btnAddNote = document.getElementById("btn-calendar-add-note");
  if (btnAddNote && (!btnAddNote.hasAttribute || !btnAddNote.hasAttribute("data-wired"))) {
    if (typeof btnAddNote.setAttribute === "function") btnAddNote.setAttribute("data-wired", "true");
    btnAddNote.onclick = (e) => {
      e.stopPropagation();
      openStickyNoteModal();
    };
  }

  // 2. View Dropdown label & active checks (Header shows "View")
  const currentViewLabel = document.getElementById("current-view-label");
  if (currentViewLabel) {
    currentViewLabel.textContent = "View";
  }

  const viewDropdownMenu = document.getElementById("view-dropdown-menu");
  if (viewDropdownMenu) {
    viewDropdownMenu.querySelectorAll(".dropdown-menu-item").forEach(item => {
      const v = item.getAttribute("data-view");
      const isActive = v === currentCalendarView;
      item.classList.toggle("active", isActive);
      const checkEl = item.querySelector(".dropdown-item-check");
      if (checkEl) checkEl.textContent = isActive ? "✓" : "";
    });
  }

  // 3. Consolidated Filter Dropdown label & active checks (Members only)
  const currentFilterLabel = document.getElementById("current-filter-label");
  const filterActiveDot = document.getElementById("filter-active-dot");
  if (currentFilterLabel && filterActiveDot) {
    if (activeCalendarMemberFilters !== null) {
      if (activeCalendarMemberFilters.length === 0) {
        currentFilterLabel.textContent = "Filter (0)";
      } else {
        currentFilterLabel.textContent = `Filter (${activeCalendarMemberFilters.length})`;
      }
      filterActiveDot.style.display = "inline-block";
    } else {
      currentFilterLabel.textContent = "Filter";
      filterActiveDot.style.display = "none";
    }
  }

  // Content filter menu item active states
  const filterDropdownMenu = document.getElementById("filter-dropdown-menu");
  if (filterDropdownMenu) {
    filterDropdownMenu.querySelectorAll("[data-content-filter]").forEach(item => {
      const f = item.getAttribute("data-content-filter");
      const isActive = f === currentCalendarContentFilter;
      item.classList.toggle("active", isActive);
      const checkEl = item.querySelector(".dropdown-item-check");
      if (checkEl) checkEl.textContent = isActive ? "✓" : "";
    });
  }

  // Dynamic Family Members in Filter Dropdown (Skylight Pill + Toggle Switches)
  const filterMembersList = document.getElementById("filter-members-list");
  if (filterMembersList) {
    // Select All is active if activeCalendarMemberFilters is null OR contains all family members
    const selectAllActive = (activeCalendarMemberFilters === null) || 
      (Array.isArray(activeCalendarMemberFilters) && (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).every(m => activeCalendarMemberFilters.includes(m)));

    // Row 1: Select All with icon and toggle switch
    let membersHtml = `
      <div class="skylight-filter-row ${selectAllActive ? 'is-active' : ''}" data-member-filter="ALL" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-icon-select-all" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span class="skylight-filter-member-name">Select All</span>
        </div>
        <div class="skylight-filter-member-right">
          <div class="skylight-filter-toggle ${selectAllActive ? 'is-on' : ''}" aria-label="Select All Toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
    `;

    // Row 2+: Each Family Member Profile with their designated Skylight color dot, name, and toggle switch (pencils removed)
    (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).forEach((member) => {
      const pal = getMemberPalette(member);
      // Member is active if Select All is active OR member is explicitly in activeCalendarMemberFilters
      const isMemberActive = (activeCalendarMemberFilters === null) 
        ? true 
        : activeCalendarMemberFilters.includes(member);

      membersHtml += `
        <div class="skylight-filter-row ${isMemberActive ? 'is-active' : ''}" data-member-filter="${escapeHtml(member)}" role="button" tabindex="0">
          <div class="skylight-filter-member-left">
            <span class="skylight-filter-color-dot" style="background: ${pal.primary};" title="${escapeHtml(pal.name)}"></span>
            <span class="skylight-filter-member-name">${escapeHtml(member)}</span>
          </div>
          <div class="skylight-filter-member-right">
            <div class="skylight-filter-toggle ${isMemberActive ? 'is-on' : ''}" aria-label="${escapeHtml(member)} toggle">
              <span class="skylight-toggle-thumb"></span>
            </div>
          </div>
        </div>
      `;
    });

    filterMembersList.innerHTML = membersHtml;
  }

  // 4. Compute Dates & Recurrence
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const currentMeals = (window.weeklyMeals || null) || (typeof loadWeeklyMeals === "function" ? loadWeeklyMeals() : DEFAULT_WEEKLY_MEALS);
  const dinnerThemes = {};
  weekDays.forEach(day => {
    const m = currentMeals && currentMeals[day];
    dinnerThemes[day] = {
      isPlanned: !!(m && m.title && m.title.trim().length > 0),
      title: (m && m.title && m.title.trim().length > 0) ? m.title.trim() : "+ Plan Dinner"
    };
  });

  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
  const currency = (window.boardSettings && window.boardSettings.currency) || "£";

  // Auto-align completed non-daily chores to the day they were completed
  (window.currentTasks || []).forEach(task => {
    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    if (!isDaily && task.done && task.completedAt) {
      try {
        const compDate = new Date(task.completedAt);
        const compDayIdx = compDate.getDay();
        const compDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][compDayIdx];
        if (compDayName && task.day !== compDayName) {
          task.day = compDayName;
          task.completedDay = compDayName;
        }
      } catch (e) {}
    }
  });

  // Navigation tooltips
  const prevBtn = document.getElementById("btn-calendar-prev-week");
  const nextBtn = document.getElementById("btn-calendar-next-week");
  if (prevBtn && nextBtn) {
    if (currentCalendarView === "day") {
      prevBtn.title = "Previous Day";
      nextBtn.title = "Next Day";
    } else if (currentCalendarView === "schedule") {
      prevBtn.title = "Previous 3 Days";
      nextBtn.title = "Next 3 Days";
    } else if (currentCalendarView === "month") {
      prevBtn.title = "Previous Month";
      nextBtn.title = "Next Month";
    } else {
      prevBtn.title = "Previous Week";
      nextBtn.title = "Next Week";
    }
  }

  // Handle Month View
  if (currentCalendarView === "month") {
    if (!window.familyEvents) window.familyEvents = loadFamilyEvents();
    renderCalendarMonthView(gridContainer, calendarAnchorDate, today, (window.familyEvents || []), (window.currentTasks || []), dinnerThemes, activeCalendarMemberFilter);
    return;
  }

  if (!window.familyEvents) window.familyEvents = loadFamilyEvents();

  // Helper: Routine label for chores
  function getTaskRoutineInfo(task) {
    const t = (task.title || "").toLowerCase();
    const cat = (task.category || task.taskType || "").toLowerCase();
    if (t.includes("(morning)") || t.includes("morning") || cat.includes("morning")) {
      return { order: 1, label: "☀️ Morning" };
    }
    if (t.includes("(afternoon)") || t.includes("afternoon") || cat.includes("afternoon")) {
      return { order: 2, label: "⛅ Afternoon" };
    }
    if (t.includes("(evening)") || t.includes("evening") || t.includes("dinner") || t.includes("bed") || t.includes("night") || cat.includes("evening")) {
      return { order: 4, label: "🌙 Evening" };
    }
    return { order: 3, label: "" };
  }

  // Helper: Event minutes for sorting
  function getEventMinutes(evt) {
    const t = (evt.time || "").trim().toLowerCase();
    if (!t || t === "all day") return 0;
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return 720;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3] ? m[3].toLowerCase() : null;
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return h * 60 + min;
  }

  // Helper: Task completion status
  const getTaskCompletionOnDay = (task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate) => {
    if (isColFutureDate) {
      return { isCompleted: false, completerName: null };
    }
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    if (isDaily) {
      if (!task.completedDays || !task.completedDays[dayName]) {
        return { isCompleted: false, completerName: null };
      }
      const rec = task.completedDays[dayName];
      const compDateStr = (typeof rec === "object" && rec !== null && rec.completedAt)
        ? getLocalDateKey(rec.completedAt)
        : null;
      if (compDateStr) {
        if (compDateStr === colDateStr) {
          const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
          return { isCompleted: true, completerName: by };
        }
        return { isCompleted: false, completerName: null };
      }
      if (isColCurrentWeek) {
        const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
        return { isCompleted: true, completerName: by };
      }
      return { isCompleted: false, completerName: null };
    }

    const isWeekly = task.repeat === "weekly";
    const colWeekKey = getIsoWeekKey(colDate);
    if (isWeekly) {
      if (task.completedWeeks && task.completedWeeks[colWeekKey]) {
        const rec = task.completedWeeks[colWeekKey];
        const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
        return { isCompleted: true, completerName: by };
      }
      if (task.done && task.completedAt && getIsoWeekKey(new Date(task.completedAt)) === colWeekKey) {
        return { isCompleted: true, completerName: task.completedBy || "Family" };
      }
      return { isCompleted: false, completerName: null };
    }

    if (!task.done) return { isCompleted: false, completerName: null };
    if (task.completedAt) {
      if (getLocalDateKey(task.completedAt) === colDateStr) {
        return { isCompleted: true, completerName: task.completedBy || "Family" };
      }
      return { isCompleted: false, completerName: null };
    }
    if (isColCurrentWeek && task.completedDay === dayName) {
      return { isCompleted: true, completerName: task.completedBy || "Family" };
    }
    return { isCompleted: false, completerName: null };
  };

  // Helper: Render Skylight Event Card (Title top, time underneath, avatar right)
  const renderSkylightEventCard = (evt) => {
    const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    let inlineStyleAttr = "";

    if (membersList.length >= 2) {
      const pal1 = getMemberPalette(membersList[0]);
      const pal2 = getMemberPalette(membersList[1]);
      inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
    } else {
      const pal = getMemberPalette(membersList[0] || "Family");
      inlineStyleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
    }

    const memberAvatarsHtml = membersList.map(m => {
      const pal = getMemberPalette(m);
      const isMini = membersList.length > 1;
      return `<span class="skylight-avatar ${isMini ? 'avatar-mini' : ''}" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
    }).join("");

    let repeatBadgeHtml = "";
    if (evt.repeat && evt.repeat !== "none") {
      repeatBadgeHtml = ` <span title="Repeats: ${escapeHtml(evt.repeat)}">🔁</span>`;
    }

    const durationText = evt.duration ? ` (${escapeHtml(evt.duration)})` : "";
    const timeSubtitle = evt.time ? `${escapeHtml(evt.time)}${durationText}` : "All day";

    return `
      <div class="skylight-card" ${inlineStyleAttr} data-event-id="${evt.id}" title="Tap to view/edit ${escapeHtml(evt.title)}">
        <div class="skylight-card-main">
          <div class="skylight-card-title-row">
            <span class="skylight-card-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}${repeatBadgeHtml}</span>
          </div>
          <span class="skylight-card-sub">${timeSubtitle}</span>
        </div>
        <div class="skylight-card-avatar-wrap">
          ${memberAvatarsHtml}
        </div>
      </div>
    `;
  };

  // Helper: Render Skylight Chore Card (Title top, time/points underneath, avatar right)
  const renderSkylightChoreCard = (task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate) => {
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    const isWeekly = task.repeat === "weekly";
    const { isCompleted, completerName: rawCompleter } = getTaskCompletionOnDay(task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate);
    const completerName = rawCompleter ? normalizeFamilyMemberName(rawCompleter) : null;

    let assigned = "Anyone";
    if (isColCurrentWeek) {
      if (isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
        assigned = task.assignedDays[dayName] || "Anyone";
      } else {
        assigned = task.assignedTo || "Anyone";
      }
    } else {
      assigned = isDaily ? "Anyone" : (task.assignedTo || "Anyone");
    }
    // Shared chores store several people as a list; this code works on "Ava, Dara"
    if (typeof assigned !== "string") assigned = getAssigneeNames(assigned).join(", ") || "Anyone";

    const effectivePerson = (isCompleted && completerName) ? completerName : assigned;
    const isUnassigned = !effectivePerson || effectivePerson.toLowerCase() === "anyone" || effectivePerson.toLowerCase() === "unassigned" || effectivePerson.toLowerCase() === "up for grabs";
    let inlineStyleAttr = "";

    const taskMembers = (effectivePerson || "").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    if (taskMembers.length >= 2 && !isUnassigned) {
      const pal1 = getMemberPalette(taskMembers[0]);
      const pal2 = getMemberPalette(taskMembers[1]);
      inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
    } else if (!isUnassigned) {
      const pal = getMemberPalette(effectivePerson);
      inlineStyleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
    } else {
      inlineStyleAttr = `style="background: var(--bg-surface, #f8fafc); border-color: var(--card-border, #e2e8f0); color: var(--text-secondary, #64748b);"`;
    }

    const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
      ? task.rewardValue 
      : (isMoney ? 1.00 : (task.points || 1));
    const rewardText = isMoney ? `${currency}${rewardVal.toFixed(2)}` : `+${rewardVal} pt${rewardVal > 1 ? "s" : ""}`;

    const isFutureLocked = (isDaily || isWeekly) && isColFutureDate;

    const checkTitleText = isCompleted
      ? `Completed by ${escapeHtml(completerName || 'Family')} (Click to undo)`
      : (isFutureLocked
          ? `⏰ Chores can only be completed on their scheduled day (${dayName})`
          : `Click to complete and claim ${rewardText}`);

    const isPriority = task.isPriority && !isCompleted;
    const priorityBadgeHtml = isPriority ? `<span style="color: #ef4444; font-weight: 800; font-size: 0.72rem; margin-right: 2px;" title="High Priority">🚨</span>` : "";

    const choreIcon = task.icon || detectEmojiForChore(task.title);
    const choreIconHtml = choreIcon ? `<span class="chore-icon">${escapeHtml(choreIcon)}</span> ` : "";

    const repeatBadgeHtml = isWeekly ? ` <span title="Repeats Weekly on ${escapeHtml(task.day)}">🔁</span>` : "";
    const streakBadgeHtml = (task.streak && task.streak >= 2)
      ? ` <span class="chore-streak-badge ${task.streak >= 7 ? 'milestone' : ''}" title="${task.streak}-Day Streak!">🔥 ${task.streak}d</span>`
      : "";

    const routineInfo = getTaskRoutineInfo(task);
    const choreSubText = isCompleted
      ? `✓ ${escapeHtml(completerName || assigned)} • ${rewardText}`
      : `${routineInfo.label ? routineInfo.label + ' • ' : ''}${rewardText}`;

    // Avatars on right
    let choreAvatarsHtml = "";
    if (isCompleted && completerName) {
      const pal = getMemberPalette(completerName);
      choreAvatarsHtml = `<span class="skylight-avatar" style="background: ${pal.primary};" title="Completed by ${escapeHtml(completerName)}">${escapeHtml(completerName.charAt(0).toUpperCase())}</span>`;
    } else if (isUnassigned) {
      choreAvatarsHtml = `<span class="skylight-avatar avatar-unassigned" title="Grab it">⚡</span>`;
    } else if (taskMembers.length > 1) {
      choreAvatarsHtml = taskMembers.map(m => {
        const pal = getMemberPalette(m);
        return `<span class="skylight-avatar avatar-mini" style="background: ${pal.primary};" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
      }).join("");
    } else {
      const pal = getMemberPalette(effectivePerson);
      choreAvatarsHtml = `<span class="skylight-avatar" style="background: ${pal.primary};" title="${escapeHtml(effectivePerson)}">${escapeHtml(effectivePerson.charAt(0).toUpperCase())}</span>`;
    }

    return `
      <div class="skylight-card ${pastelClass} ${isCompleted ? 'is-done' : ''} ${isPriority ? 'is-priority-chore' : ''}" 
           ${splitStyleAttr}
           data-task-id="${task.id}" data-day="${dayName}" data-date="${colDateStr}">
        <div class="skylight-card-main">
          <div class="skylight-card-title-row">
            <button type="button" class="skylight-chore-check ${isCompleted ? 'is-checked' : ''} ${isFutureLocked ? 'is-future-locked' : ''}" 
                    data-task-id="${task.id}" data-day="${dayName}" data-date="${colDateStr}" data-completed="${isCompleted ? 'true' : 'false'}"
                    data-future-locked="${isFutureLocked ? 'true' : 'false'}"
                    ${isFutureLocked ? 'disabled' : ''}
                    title="${escapeHtml(checkTitleText)}">
              ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>' : (isFutureLocked ? '<span style="font-size: 9px;">🔒</span>' : '')}
            </button>
            ${priorityBadgeHtml}
            <span class="skylight-card-title">${choreIconHtml}${escapeHtml(task.title)}${repeatBadgeHtml}${streakBadgeHtml}</span>
          </div>
          <span class="skylight-card-sub">${escapeHtml(choreSubText)}</span>
        </div>
        <div class="skylight-card-avatar-wrap">
          ${choreAvatarsHtml}
        </div>
      </div>
    `;
  };

  // =========================================================================
  // VIEW MODE: WEEK (Skylight 8-Container 4x2 Grid)
  // Starts on Monday of current anchor week, 8th container is clean "Next Week" card
  // =========================================================================
  if (currentCalendarView === "week") {
    let boxesHtml = "";
    const anchor = new Date(calendarAnchorDate);
    anchor.setHours(0, 0, 0, 0);

    // Monday of the anchor's week
    const weekStart = new Date(anchor);
    const dayOfWeek = weekStart.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    weekStart.setDate(weekStart.getDate() + diffToMonday);

    // Containers 0 to 6 (Monday through Sunday)
    for (let i = 0; i < 7; i++) {
      const colDate = new Date(weekStart);
      colDate.setDate(weekStart.getDate() + i);
      const colDayIdx = colDate.getDay() === 0 ? 6 : colDate.getDay() - 1;
      const dayName = weekDays[colDayIdx];
      const shortName = weekShort[colDayIdx];
      const dayDateNum = colDate.getDate();
      const isToday = today.toDateString() === colDate.toDateString();
      const colDateStr = getLocalDateKey(colDate);
      const activeWeekKey = getIsoWeekKey(new Date());
      const todayDateStr = getLocalDateKey(new Date());
      const colWeekKey = getIsoWeekKey(colDate);
      const isColCurrentWeek = (colWeekKey === activeWeekKey);
      const isColFutureDate = (colDateStr > todayDateStr);

      // Day tasks
      let dayTasks = (window.currentTasks || []).filter(task => {
        if (!task || typeof task !== "object") return false;
        const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
        if (isDaily) return true;
        if (task.repeat === "weekly") return task.day === dayName;
        if (task.done) {
          if (task.completedAt) return getLocalDateKey(task.completedAt) === colDateStr;
          return isColCurrentWeek && task.completedDay === dayName;
        }
        if (task.date) return task.date === colDateStr;
        return isColCurrentWeek && task.day === dayName;
      });

      // Day events
      let dayEvents = ((window.familyEvents || []) || []).filter(e => e && typeof e === "object" && isEventOnDate(e, colDateStr, dayName, colDate));

      // Active member filter (supports multi-member e.g. Steven / Dara / Ava)
      if (activeCalendarMemberFilters !== null) {
        dayEvents = dayEvents.filter(e => isMemberSelected(e.member));

        dayTasks = dayTasks.filter(task => {
          const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
          const { isCompleted, completerName } = getTaskCompletionOnDay(task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate);
          if (isCompleted && completerName && isMemberSelected(completerName)) return true;
          let dayAssigned = task.assignedTo || "Anyone";
          if (isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
            dayAssigned = task.assignedDays[dayName] || "Anyone";
          }
          return isMemberSelected(dayAssigned);
        });
      }

      // Sort events chronologically
      dayEvents.sort((a, b) => getEventMinutes(a) - getEventMinutes(b));

      // Sort chores: pending first, completed last
      dayTasks.sort((a, b) => {
        const doneA = getTaskCompletionOnDay(a, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate).isCompleted ? 1 : 0;
        const doneB = getTaskCompletionOnDay(b, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate).isCompleted ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        return getTaskRoutineInfo(a).order - getTaskRoutineInfo(b).order;
      });

      // Cards HTML (Events only on Calendar; Chores on dedicated Chores board)
      let dayCards = [];
      dayEvents.forEach(evt => dayCards.push(renderSkylightEventCard(evt)));

      // Subtitle count
      const evtCount = dayEvents.length;
      let countSubtitle = evtCount === 1 ? "1 event" : (evtCount > 1 ? `${evtCount} events` : "No events");

      const colMeal = getMealForDate(colDate);
      const mealHtml = (colMeal && colMeal.title)
        ? `<div class="skylight-box-meal is-planned" data-date="${colDateStr}" data-day="${dayName}" title="Dinner: ${escapeHtml(colMeal.title)} — Tap to view recipe">
            <span class="box-meal-icon">${escapeHtml(colMeal.emoji || '🍽️')}</span>
            <span class="box-meal-title">${escapeHtml(colMeal.title)}</span>
          </div>`
        : "";

      // Real-time day weather forecast from Open-Meteo
      const dayWeather = getForecastForDate(colDateStr);
      const weatherIconHtml = dayWeather
        ? `<span class="day-weather-icon" title="${escapeHtml(dayWeather.condition)}${dayWeather.maxTemp !== null ? ` • High ${dayWeather.maxTemp}° / Low ${dayWeather.minTemp}°` : ''}${dayWeather.rainProb ? ` • ${dayWeather.rainProb}% rain` : ''}" style="cursor: pointer;" onclick="openWeatherForecastModal()">${dayWeather.icon}</span>`
        : "";

      boxesHtml += `
        <div class="skylight-day-box ${isToday ? 'is-today-box' : ''}" data-date="${colDateStr}" data-day="${dayName}">
          <div class="skylight-day-box-header">
            <div class="day-box-header-row">
              <div class="day-box-title-wrap">
                <span class="day-name-label">${shortName}</span>
                <span class="day-num-label ${isToday ? 'today-badge-circle' : ''}">${dayDateNum}</span>
              </div>
              <div class="day-box-header-actions">
                ${weatherIconHtml}
                <button type="button" class="btn-discreet-add-event" data-date="${colDateStr}" data-day="${dayName}">+ Add Event</button>
              </div>
            </div>
            <div class="day-count-subtitle">${countSubtitle}</div>
          </div>
          <div class="skylight-day-box-body">
            ${mealHtml}
            ${dayCards.join("")}
          </div>
        </div>
      `;
    }

    // Container 7: Next Week Panel (Matching Skylight with clean Date Range header, no cramped cards)
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(weekStart.getDate() + 7);
    const nextWeekEnd = new Date(weekStart);
    nextWeekEnd.setDate(weekStart.getDate() + 13);

    const nwStartDayIdx = nextWeekStart.getDay() === 0 ? 6 : nextWeekStart.getDay() - 1;
    const nwStartDayName = weekDays[nwStartDayIdx];
    const nwStartDateStr = getLocalDateKey(nextWeekStart);

    const nwMonthStart = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][nextWeekStart.getMonth()];
    const nwMonthEnd = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][nextWeekEnd.getMonth()];
    const nextWeekRangeLabel = (nextWeekStart.getMonth() === nextWeekEnd.getMonth())
      ? `${nwMonthStart} ${nextWeekStart.getDate()} - ${nextWeekEnd.getDate()}`
      : `${nwMonthStart} ${nextWeekStart.getDate()} - ${nwMonthEnd} ${nextWeekEnd.getDate()}`;

    // Count how many events are scheduled for next week
    let nwEventsCount = 0;
    for (let d = 0; d < 7; d++) {
      const nwDate = new Date(nextWeekStart);
      nwDate.setDate(nextWeekStart.getDate() + d);
      const nwDayIdx = nwDate.getDay() === 0 ? 6 : nwDate.getDay() - 1;
      const nwDayName = weekDays[nwDayIdx];
      const nwDateStr = getLocalDateKey(nwDate);
      let dayEvts = ((window.familyEvents || []) || []).filter(e => e && typeof e === "object" && isEventOnDate(e, nwDateStr, nwDayName, nwDate));
      if (activeCalendarMemberFilters !== null) {
        dayEvts = dayEvts.filter(e => isMemberSelected(e.member));
      }
      nwEventsCount += dayEvts.length;
    }

    boxesHtml += `
      <div class="skylight-day-box skylight-next-week-box" data-date="${nwStartDateStr}" data-day="${nwStartDayName}">
        <div class="skylight-day-box-header">
          <div class="day-box-header-row">
            <span class="day-name-label" style="font-family: inherit; font-size: 1.15rem; font-weight: 500;">Next Week</span>
          </div>
          <div class="day-count-subtitle" style="font-size: 0.82rem; color: var(--text-secondary);">${nextWeekRangeLabel}</div>
        </div>
        <div class="skylight-day-box-body next-week-skylight-body" style="cursor: pointer;" title="Tap to view next week" onclick="navigateCalendar(1)">
          ${nwEventsCount > 0 ? `<div class="next-week-summary-pill">${nwEventsCount} ${nwEventsCount === 1 ? 'event' : 'events'} scheduled &rsaquo;</div>` : ''}
        </div>
      </div>
    `;

    gridContainer.className = "calendar-week-grid view-week";
    gridContainer.innerHTML = boxesHtml;
    return;
  }

  // =========================================================================
  // VIEW MODE: DAY (Skylight Split-Screen View: Mini Month on Left, Events on Right)
  // =========================================================================
  if (currentCalendarView === "day") {
    const currentDayDate = new Date(calendarAnchorDate);
    currentDayDate.setHours(0, 0, 0, 0);
    const dayDowIdx = currentDayDate.getDay() === 0 ? 6 : currentDayDate.getDay() - 1;
    const dayName = weekDays[dayDowIdx];
    const colDateStr = getLocalDateKey(currentDayDate);

    const isToday = today.toDateString() === currentDayDate.toDateString();
    const isYesterday = (new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)).toDateString() === currentDayDate.toDateString();
    const isTomorrow = (new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)).toDateString() === currentDayDate.toDateString();

    let dayTitleHeading = dayName;
    if (isToday) dayTitleHeading = "Today";
    else if (isYesterday) dayTitleHeading = "Yesterday";
    else if (isTomorrow) dayTitleHeading = "Tomorrow";

    // 1. Build Left Side: Interactive Mini Month Calendar
    const year = currentDayDate.getFullYear();
    const month = currentDayDate.getMonth();
    const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthYearTitle = `${monthNamesFull[month]} ${year}`;

    const monthFirstDay = new Date(year, month, 1);
    const monthLastDay = new Date(year, month + 1, 0);
    const totalDaysInMonth = monthLastDay.getDate();

    // Sunday-first order to match Skylight hardware exactly: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    const miniWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const firstDowSun0 = monthFirstDay.getDay(); // 0 is Sunday
    const prevMonthLastDayNum = new Date(year, month, 0).getDate();

    let miniCellsHtml = "";
    const totalMiniCells = (firstDowSun0 + totalDaysInMonth) > 35 ? 42 : 35;
    let dayCountNum = 1;
    let nextMonthDayNum = 1;

    for (let cIdx = 0; cIdx < totalMiniCells; cIdx++) {
      let cellDate;
      let isOtherMonth = false;
      let dNum;

      if (cIdx < firstDowSun0) {
        dNum = prevMonthLastDayNum - firstDowSun0 + cIdx + 1;
        cellDate = new Date(year, month - 1, dNum);
        isOtherMonth = true;
      } else if (dayCountNum <= totalDaysInMonth) {
        dNum = dayCountNum++;
        cellDate = new Date(year, month, dNum);
      } else {
        dNum = nextMonthDayNum++;
        cellDate = new Date(year, month + 1, dNum);
        isOtherMonth = true;
      }

      const isSelectedDay = currentDayDate.toDateString() === cellDate.toDateString();
      const isActualToday = today.toDateString() === cellDate.toDateString();
      const cDateStr = getLocalDateKey(cellDate);

      // Check if this date has events
      const hasEvents = ((window.familyEvents || []) || []).some(e => isEventOnDate(e, cDateStr, weekDays[cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1], cellDate));

      miniCellsHtml += `
        <button type="button" class="mini-calendar-cell ${isOtherMonth ? 'is-other-month' : ''} ${isSelectedDay ? 'is-selected-day' : ''} ${isActualToday ? 'is-actual-today' : ''} ${hasEvents ? 'has-events' : ''}" 
                data-date-str="${cDateStr}" title="${cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}">
          <span class="mini-day-number">${dNum}</span>
          ${hasEvents ? '<span class="mini-event-dot"></span>' : ''}
        </button>
      `;
    }

    // 2. Build Right Side: Day's Full Events List (Ordered All-day first, then chronologically)
    let dayEvents = ((window.familyEvents || []) || []).filter(e => isEventOnDate(e, colDateStr, dayName, currentDayDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }

    // Sort: All Day first, then by time
    dayEvents.sort((a, b) => {
      const aIsAllDay = !a.time || a.time.trim().toLowerCase() === "all day";
      const bIsAllDay = !b.time || b.time.trim().toLowerCase() === "all day";
      if (aIsAllDay && !bIsAllDay) return -1;
      if (!aIsAllDay && bIsAllDay) return 1;
      return getEventMinutes(a) - getEventMinutes(b);
    });

    let eventRowsHtml = "";
    if (dayEvents.length === 0) {
      eventRowsHtml = `
        <div class="skylight-day-empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">No events scheduled for ${dayTitleHeading}</div>
          <div class="empty-sub">Tap the ＋ button at bottom-right or Magic Import above to add an event.</div>
        </div>
      `;
    } else {
      dayEvents.forEach(evt => {
        const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
        let styleAttr = "";
        let borderAccent = "";

        if (membersList.length >= 2) {
          const pal1 = getMemberPalette(membersList[0]);
          const pal2 = getMemberPalette(membersList[1]);
          styleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
          borderAccent = pal1.primary;
        } else {
          const pal = getMemberPalette(membersList[0] || "Family");
          styleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
          borderAccent = pal.primary;
        }

        const memberAvatarsHtml = membersList.map(m => {
          const pal = getMemberPalette(m);
          return `<span class="skylight-day-avatar" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
        }).join("");

        const durationText = evt.duration ? ` (${escapeHtml(evt.duration)})` : "";
        const timeSubtitle = evt.time ? `${escapeHtml(evt.time)}${durationText}` : "All day";

        let repeatBadge = "";
        if (evt.repeat && evt.repeat !== "none") {
          repeatBadge = ` <span title="Repeats: ${escapeHtml(evt.repeat)}">🔁</span>`;
        }

        eventRowsHtml += `
          <div class="skylight-day-event-banner" ${styleAttr} data-event-id="${evt.id}" role="button" tabindex="0" title="Tap to view/edit ${escapeHtml(evt.title)}">
            <div class="day-event-left-info">
              <span class="day-event-banner-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}${repeatBadge}</span>
              <span class="day-event-banner-time">${timeSubtitle}</span>
            </div>
            <div class="day-event-right-avatars">
              ${memberAvatarsHtml}
            </div>
          </div>
        `;
      });
    }

    // Optional Dinner banner for the day
    const dayMeal = getMealForDate(currentDayDate);
    let mealBannerHtml = "";
    if (dayMeal && dayMeal.title) {
      mealBannerHtml = `
        <div class="skylight-day-dinner-banner" data-date="${colDateStr}" data-day="${dayName}" title="Dinner: ${escapeHtml(dayMeal.title)} — Tap to view recipe">
          <span class="day-dinner-icon">${escapeHtml(dayMeal.emoji || '🍽️')}</span>
          <div class="day-dinner-text">
            <span class="day-dinner-label">Tonight's Dinner</span>
            <span class="day-dinner-title">${escapeHtml(dayMeal.title)}</span>
          </div>
        </div>
      `;
    }

    gridContainer.className = "calendar-week-grid view-skylight-day";
    gridContainer.innerHTML = `
      <div class="skylight-split-day-container">
        <!-- Left Column: Mini Month Calendar Grid -->
        <div class="skylight-split-day-left">
          <div class="mini-month-header">
            <h3 class="mini-month-title">${monthYearTitle}</h3>
          </div>
          <div class="mini-month-weekdays-row">
            ${miniWeekdays.map(d => `<span class="mini-weekday-col">${d}</span>`).join("")}
          </div>
          <div class="mini-month-days-grid">
            ${miniCellsHtml}
          </div>
        </div>

        <!-- Right Column: Heading and Full Event Bars -->
        <div class="skylight-split-day-right">
          <div class="skylight-day-heading-row">
            <h2 class="skylight-day-heading">${dayTitleHeading}</h2>
            <div class="skylight-day-date-sub">${dayName}, ${currentDayDate.getDate()} ${monthNamesFull[month]}</div>
          </div>
          ${mealBannerHtml}
          <div class="skylight-day-events-scroll-list">
            ${eventRowsHtml}
          </div>
        </div>
      </div>
    `;

    // Wire clicks on mini-calendar dates to jump to that date instantly
    gridContainer.querySelectorAll(".mini-calendar-cell").forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const dStr = cell.getAttribute("data-date-str");
        if (dStr) {
          const [y, m, d] = dStr.split("-").map(Number);
          const targetD = new Date(y, m - 1, d);
          targetD.setHours(0, 0, 0, 0);
          setCalendarView("day", targetD);
        }
      };
    });

    // Wire dinner click
    const dinBanner = gridContainer.querySelector(".skylight-day-dinner-banner");
    if (dinBanner) {
      dinBanner.onclick = (e) => {
        e.stopPropagation();
        const dStr = dinBanner.getAttribute("data-date");
        if (typeof openPlanMealModalForDate === "function") {
          openPlanMealModalForDate(dStr);
        }
      };
    }

    return;
  }

  // =========================================================================
  // VIEW MODES: SCHEDULE (3-Day) (Continuous Skylight Time-Grid Layout)
  // =========================================================================
  let startDate = new Date(calendarAnchorDate);
  startDate.setHours(0, 0, 0, 0);
  let dayCount = 3;

  // Hourly timeline: 6 AM to 11 PM (6:00 to 23:00) covering early morning drop-offs & late activities
  const startHour = 6;
  const endHour = 23;
  const totalHours = endHour - startHour; // 17 hours
  const hourHeight = scheduleHourHeight; // dynamic pixels per hour (pinch/zoom controllable)
  const topPadding = 14; // padding so 6 AM text label is never cut off
  const totalGridHeight = (totalHours * hourHeight) + topPadding + 14; // full comfortable height

  const now = new Date();
  const currentHourDecimal = now.getHours() + (now.getMinutes() / 60);
  const nowTopPx = topPadding + ((currentHourDecimal - startHour) * hourHeight);
  const showNowLine = currentHourDecimal >= startHour && currentHourDecimal <= endHour;

  // Build Time Gutter labels
  let timeLabelsHtml = "";
  for (let h = startHour; h <= endHour; h++) {
    const period = h >= 12 ? "pm" : "am";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    timeLabelsHtml += `
      <div class="skylight-time-slot-label" style="top: ${topPadding + ((h - startHour) * hourHeight)}px;">
        <span>${displayH} ${period}</span>
      </div>
    `;
  }

  // Pre-calculate day columns data
  const columnsData = [];
  for (let i = 0; i < dayCount; i++) {
    const colDate = new Date(startDate);
    colDate.setDate(startDate.getDate() + i);
    const colDayIdx = colDate.getDay() === 0 ? 6 : colDate.getDay() - 1;
    const dayName = weekDays[colDayIdx];
    const shortName = weekShort[colDayIdx];
    const dayDateNum = colDate.getDate();
    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][colDate.getMonth()];
    const isToday = today.toDateString() === colDate.toDateString();
    const colDateStr = getLocalDateKey(colDate);

    let dayEvents = (window.familyEvents || []).filter(e => isEventOnDate(e, colDateStr, dayName, colDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }
    dayEvents.sort((a, b) => getEventMinutes(a) - getEventMinutes(b));

    const allDayEvents = [];
    const timedEvents = [];
    dayEvents.forEach(evt => {
      const t = (evt.time || "").trim().toLowerCase();
      if (!t || t === "all day") {
        allDayEvents.push(evt);
      } else {
        timedEvents.push(evt);
      }
    });

    const colMeal = getMealForDate(colDate);

    columnsData.push({
      colDate,
      colDateStr,
      dayName,
      shortName,
      dayDateNum,
      monthShort,
      isToday,
      allDayEvents,
      timedEvents,
      colMeal
    });
  }

  // Generate HTML for Skylight continuous layout with dividing lines
  let colHeadersHtml = "";
  let allDayBannersHtml = "";
  let dayColumnsHtml = "";

  const chevronLeftSvg = '<svg class="icon-chevron-wide" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  const chevronRightSvg = '<svg class="icon-chevron-wide" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  columnsData.forEach((col, idx) => {
    // Header
    const prevArrow = (idx === 0) ? `<button type="button" class="col-nav-arrow col-nav-prev" title="Previous" aria-label="Previous">${chevronLeftSvg}</button>` : '';
    const nextArrow = (idx === dayCount - 1) ? `<button type="button" class="col-nav-arrow col-nav-next" title="Next" aria-label="Next">${chevronRightSvg}</button>` : '';

    colHeadersHtml += `
      <div class="skylight-grid-day-header ${col.isToday ? 'is-today-header' : ''}" data-date="${col.colDateStr}">
        <div class="day-header-main-row">
          ${prevArrow}
          <span class="grid-header-dayname">${col.shortName}</span>
          <span class="grid-header-daynum ${col.isToday ? 'today-badge-circle' : ''}">${col.dayDateNum}</span>
          <span class="grid-header-month">${col.monthShort}</span>
        </div>
        ${nextArrow ? `<div class="day-header-nav-right">${nextArrow}</div>` : ''}
      </div>
    `;

    // Top All-day / Dinner banner slot
    let bannerItemsHtml = "";
    if (col.colMeal && col.colMeal.title) {
      bannerItemsHtml += `
        <div class="skylight-box-meal is-planned" data-date="${col.colDateStr}" data-day="${col.dayName}" title="Dinner: ${escapeHtml(col.colMeal.title)} — Tap to view recipe">
          <span class="box-meal-icon">${escapeHtml(col.colMeal.emoji || '🍽️')}</span>
          <span class="box-meal-title">${escapeHtml(col.colMeal.title)}</span>
        </div>
      `;
    }
    col.allDayEvents.forEach(evt => {
      bannerItemsHtml += renderSkylightEventCard(evt);
    });

    allDayBannersHtml += `
      <div class="skylight-allday-col ${col.isToday ? 'is-today-col' : ''}">
        ${bannerItemsHtml}
      </div>
    `;

    // Timed Events in the hourly track
    let timedBlocksHtml = "";
    col.timedEvents.forEach(evt => {
      const minutes = getEventMinutes(evt);
      const startMinFromGutter = minutes - (startHour * 60);
      const topPx = topPadding + Math.max(0, (startMinFromGutter / 60) * hourHeight);

      // Duration: parse duration or default 60 mins
      let durMinutes = 60;
      if (evt.duration) {
        const dm = evt.duration.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hr|min|m)/i);
        if (dm) {
          const val = parseFloat(dm[1]);
          if (/min|m/i.test(evt.duration) && !/h/i.test(evt.duration)) {
            durMinutes = val;
          } else {
            durMinutes = val * 60;
          }
        }
      }
      const heightPx = Math.max(38, Math.min((durMinutes / 60) * hourHeight, totalGridHeight - topPx));

      // Member color palette
      const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
      let inlineStyleAttr = "";
      if (membersList.length >= 2) {
        const pal1 = getMemberPalette(membersList[0]);
        const pal2 = getMemberPalette(membersList[1]);
        inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border: 1.5px solid ${pal1.border}; color: ${pal1.text}; top: ${topPx}px; height: ${heightPx}px;"`;
      } else {
        const pal = getMemberPalette(membersList[0] || "Family");
        inlineStyleAttr = `style="background: ${pal.lightBg}; border: 1.5px solid ${pal.border}; color: ${pal.text}; top: ${topPx}px; height: ${heightPx}px;"`;
      }

      const memberAvatarsHtml = membersList.map(m => {
        const pal = getMemberPalette(m);
        const isMini = membersList.length > 1;
        return `<span class="skylight-avatar ${isMini ? 'avatar-mini' : ''}" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
      }).join("");

      timedBlocksHtml += `
        <div class="skylight-timed-event-block skylight-card" ${inlineStyleAttr} data-event-id="${evt.id}" title="Tap to view/edit ${escapeHtml(evt.title)}">
          <div class="skylight-card-main">
            <div class="skylight-card-title-row">
              <span class="skylight-card-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}</span>
            </div>
            <span class="skylight-card-sub">${escapeHtml(evt.time || "")}${evt.duration ? ` (${escapeHtml(evt.duration)})` : ""}</span>
          </div>
          <div class="skylight-card-avatar-wrap">
            ${memberAvatarsHtml}
          </div>
        </div>
      `;
    });

    // Current time indicator line if today
    let todayLineHtml = "";
    if (col.isToday && showNowLine) {
      todayLineHtml = `
        <div class="skylight-current-time-line" style="top: ${nowTopPx}px;">
          <span class="current-time-dot"></span>
        </div>
      `;
    }

    // Horizontal hour grid lines inside column
    let hourLinesHtml = "";
    for (let h = 0; h < totalHours; h++) {
      hourLinesHtml += `<div class="skylight-hour-grid-line" style="top: ${topPadding + (h * hourHeight)}px;"></div>`;
    }

    dayColumnsHtml += `
      <div class="skylight-time-col ${col.isToday ? 'is-today-col' : ''}" data-date="${col.colDateStr}" data-day="${col.dayName}">
        ${hourLinesHtml}
        ${todayLineHtml}
        ${timedBlocksHtml}
      </div>
    `;
  });

  gridContainer.className = `skylight-trad-calendar-grid days-${dayCount}`;
  gridContainer.innerHTML = `
    <div class="skylight-schedule-scroll-container" id="skylight-schedule-scroll-container">
      <div class="skylight-schedule-scroll-inner">
        <!-- Fixed Header Row with Day Names & Dates -->
        <div class="skylight-trad-header-row">
          <div class="skylight-gutter-corner"></div>
          <div class="skylight-days-header-track">
            ${colHeadersHtml}
          </div>
        </div>

        <!-- All-Day Banners / Dinners Row -->
        <div class="skylight-trad-allday-row">
          <div class="skylight-gutter-allday-label">all-day</div>
          <div class="skylight-allday-track">
            ${allDayBannersHtml}
          </div>
        </div>

        <!-- Scrollable Hourly Time Grid -->
        <div class="skylight-trad-body-row" id="skylight-trad-body-scroll">
          <!-- Left Time Gutter with 12pm, 1pm, 2pm... -->
          <div class="skylight-trad-time-gutter" style="height: ${totalGridHeight}px;">
            ${timeLabelsHtml}
          </div>

          <!-- Day Columns with vertical dividing lines -->
          <div class="skylight-trad-columns-track" style="height: ${totalGridHeight}px;">
            ${dayColumnsHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  // Auto-scroll into near current hour on load
  const bodyScroll = document.getElementById("skylight-trad-body-scroll");
  if (bodyScroll && showNowLine) {
    bodyScroll.scrollTop = Math.max(0, nowTopPx - 100);
  }

  wireTimeGridCreate(gridContainer, { startHour, endHour, hourHeight, topPadding });

  // Wire day column navigation arrows (shifts by 1 day for smooth browsing)
  gridContainer.querySelectorAll(".col-nav-prev").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      navigateCalendar(-1, 1);
    };
  });
  gridContainer.querySelectorAll(".col-nav-next").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      navigateCalendar(1, 1);
    };
  });

  // ========================================================================
  // SKYLIGHT SMOOTH HORIZONTAL SWIPE, DRAG & PINCH-TO-ZOOM
  // ========================================================================
  const attachSkylightCalendarGestures = () => {
    const wrap = gridContainer.querySelector(".skylight-schedule-scroll-inner, .skylight-trad-grid-wrap");
    const bodyScrollEl = document.getElementById("skylight-trad-body-scroll");
    if (!wrap) return;

    // --- 1. Pinch-to-Zoom Time Scale (Zoom between ~4 hours and ~8 hours visible) ---
    let initialPinchDistance = null;
    let initialHourHeight = scheduleHourHeight;

    const getPinchDistance = (touches) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // --- 2. Smooth 1:1 Horizontal Drag / Swipe Navigation ---
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let isHorizontalGesture = false;
    let isVerticalGesture = false;
    let isTracking = false;
    let isPinching = false;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Pinch zoom detected
        isPinching = true;
        isTracking = false;
        isHorizontalGesture = false;
        initialPinchDistance = getPinchDistance(e.touches);
        initialHourHeight = scheduleHourHeight;
        wrap.style.transform = "";
        return;
      }

      if (e.touches.length !== 1) return;
      isPinching = false;

      // Don't intercept button or card clicks
      if (e.target.closest("button, .skylight-card, .skylight-box-meal")) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      deltaX = 0;
      isHorizontalGesture = false;
      isVerticalGesture = false;
      isTracking = true;
    };

    const onTouchMove = (e) => {
      // Handle Pinch Zoom
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getPinchDistance(e.touches);
        if (initialPinchDistance > 0) {
          const scale = dist / initialPinchDistance;
          // Clamp hourHeight between 38px (zoomed out: ~7-8 hrs visible) and 90px (zoomed in: ~3.5-4 hrs visible)
          const newHeight = Math.round(Math.max(38, Math.min(90, initialHourHeight * scale)));
          if (Math.abs(newHeight - scheduleHourHeight) >= 2) {
            scheduleHourHeight = newHeight;
            try { localStorage.setItem("chore_schedule_hour_height", String(scheduleHourHeight)); } catch (err) {}
            renderWeekCalendar();
          }
        }
        return;
      }

      if (!isTracking || e.touches.length !== 1 || isVerticalGesture) return;
      const t = e.touches[0];
      const diffX = t.clientX - startX;
      const diffY = t.clientY - startY;

      if (!isHorizontalGesture && !isVerticalGesture) {
        if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
          if (Math.abs(diffX) > Math.abs(diffY) * 1.1) {
            isHorizontalGesture = true;
          } else {
            isVerticalGesture = true;
            isTracking = false;
            return;
          }
        }
      }

      if (isHorizontalGesture) {
        // Prevent accidental vertical jump while dragging horizontally
        if (e.cancelable) e.preventDefault();
        deltaX = diffX;
        wrap.style.transform = `translateX(${deltaX}px)`;
        wrap.style.transition = "none";
      }
    };

    const onTouchEnd = (e) => {
      if (isPinching) {
        if (e.touches.length < 2) isPinching = false;
        return;
      }

      if (!isTracking) return;
      isTracking = false;

      if (isHorizontalGesture) {
        const threshold = 65; // pixels to trigger day shift
        if (Math.abs(deltaX) > threshold) {
          const shiftDirection = deltaX < 0 ? 1 : -1;
          const exitX = shiftDirection === 1 ? -window.innerWidth * 0.4 : window.innerWidth * 0.4;
          wrap.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.25, 1)";
          wrap.style.transform = `translateX(${exitX}px)`;
          setTimeout(() => {
            navigateCalendar(shiftDirection, 1);
          }, 180);
          return;
        }
      }

      // Snap back if threshold not met
      wrap.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
      wrap.style.transform = "translateX(0px)";
      setTimeout(() => {
        if (wrap) wrap.style.transform = "";
      }, 230);
    };

    wrap.addEventListener("touchstart", onTouchStart, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd, { passive: true });
    wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // --- 3. Desktop / Trackpad Wheel Zoom (Ctrl/Cmd + wheel) ---
    if (bodyScrollEl) {
      bodyScrollEl.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.94 : 1.06;
          const newH = Math.round(Math.max(38, Math.min(90, scheduleHourHeight * factor)));
          if (newH !== scheduleHourHeight) {
            scheduleHourHeight = newH;
            try { localStorage.setItem("chore_schedule_hour_height", String(scheduleHourHeight)); } catch (err) {}
            renderWeekCalendar();
          }
        }
      }, { passive: false });
    }

    // --- 4. Desktop Mouse Drag Support ---
    let mouseStartX = 0;
    let isMouseDown = false;
    let mouseDeltaX = 0;

    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, .skylight-card, .skylight-box-meal, input, select")) return;
      isMouseDown = true;
      mouseStartX = e.clientX;
      mouseDeltaX = 0;
      wrap.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      mouseDeltaX = e.clientX - mouseStartX;
      if (Math.abs(mouseDeltaX) > 8) {
        wrap.style.transform = `translateX(${mouseDeltaX}px)`;
        wrap.style.transition = "none";
      }
    });

    window.addEventListener("mouseup", () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      wrap.style.cursor = "";

      if (Math.abs(mouseDeltaX) > 65) {
        const shiftDir = mouseDeltaX < 0 ? 1 : -1;
        const exitX = shiftDir === 1 ? -window.innerWidth * 0.4 : window.innerWidth * 0.4;
        wrap.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.25, 1)";
        wrap.style.transform = `translateX(${exitX}px)`;
        setTimeout(() => {
          navigateCalendar(shiftDir, 1);
        }, 180);
      } else {
        wrap.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
        wrap.style.transform = "translateX(0px)";
        setTimeout(() => {
          if (wrap) wrap.style.transform = "";
        }, 230);
      }
    });
  };

  attachSkylightCalendarGestures();

  // ========================================================================
  // DRAG & DROP FOR CHORES (Moving chores between days)
  // ========================================================================
  const dayCols = gridContainer.querySelectorAll(".calendar-day-col");

  // Helper: Move chore to a new day
  const moveChoreToDay = async (taskId, targetDay) => {
    if (!taskId || !targetDay) return;
    const task = (window.currentTasks || []).find(t => t.id === taskId);
    if (!task) return;

    if (task.day === "Daily" || task.taskType === "Daily Task") {
      showCalendarToast("Daily chores repeat every day and cannot be moved");
      return;
    }

    if (task.day === targetDay && (!task.done || task.completedDay === targetDay)) {
      return;
    }

    task.day = targetDay;
    if (task.done) {
      task.completedDay = targetDay;
    }

    saveLocalCache((window.currentTasks || []));
    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, {
          day: targetDay,
          ...(task.done ? { completedDay: targetDay } : {})
        });
      } catch (err) {
        console.warn("Firestore update failed, saved locally:", err);
      }
    }

    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    renderWeekCalendar();
    renderApp();
    renderSkylightTasksPage();
    showCalendarToast(`Moved "${task.title}" to ${targetDay}`);
  };

  // 1. Desktop HTML5 Drag and Drop
  gridContainer.querySelectorAll(".calendar-card.is-draggable").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      const taskId = card.getAttribute("data-task-id");
      e.dataTransfer.setData("text/plain", taskId);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("is-dragging");
      gridContainer.classList.add("is-drag-active");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      gridContainer.classList.remove("is-drag-active");
      dayCols.forEach(col => col.classList.remove("drag-over"));
    });
  });

  dayCols.forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!col.classList.contains("drag-over")) {
        dayCols.forEach(c => c.classList.remove("drag-over"));
        col.classList.add("drag-over");
      }
    });

    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove("drag-over");
      }
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      gridContainer.classList.remove("is-drag-active");
      const taskId = e.dataTransfer.getData("text/plain");
      const targetDay = col.getAttribute("data-day");
      if (taskId && targetDay) {
        moveChoreToDay(taskId, targetDay);
      }
    });
  });

  // 2. Touch Drag & Drop for Touchscreens & Tablets
  let touchDragItem = null;
  let touchDragGhost = null;
  let touchTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isTouchDragging = false;

  gridContainer.querySelectorAll(".calendar-card.is-draggable").forEach(card => {
    card.addEventListener("touchstart", (e) => {
      // Don't drag if clicking directly on the check button
      if (e.target.closest(".calendar-card-check")) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDragItem = card;
      isTouchDragging = false;

      // Long-press threshold (180ms) so immediate taps still work
      touchTimer = setTimeout(() => {
        isTouchDragging = true;
        card.classList.add("is-dragging");
        gridContainer.classList.add("is-drag-active");

        // Create floating ghost
        touchDragGhost = card.cloneNode(true);
        touchDragGhost.classList.add("touch-drag-ghost");
        touchDragGhost.style.width = `${card.offsetWidth}px`;
        touchDragGhost.style.left = `${touch.clientX - card.offsetWidth / 2}px`;
        touchDragGhost.style.top = `${touch.clientY - 24}px`;
        document.body.appendChild(touchDragGhost);

        if (navigator.vibrate) navigator.vibrate(25);
      }, 180);
    }, { passive: true });

    card.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
      if (!isTouchDragging && dist > 10) {
        clearTimeout(touchTimer);
        return;
      }

      if (isTouchDragging) {
        e.preventDefault(); // Prevent page scroll while dragging card
        if (touchDragGhost) {
          touchDragGhost.style.left = `${touch.clientX - touchDragGhost.offsetWidth / 2}px`;
          touchDragGhost.style.top = `${touch.clientY - 24}px`;
        }

        // Highlight column under touch point
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const colUnder = elUnder ? elUnder.closest(".calendar-day-col") : null;
        dayCols.forEach(c => {
          if (c === colUnder) c.classList.add("drag-over");
          else c.classList.remove("drag-over");
        });
      }
    }, { passive: false });

    card.addEventListener("touchend", (e) => {
      clearTimeout(touchTimer);
      if (isTouchDragging && touchDragItem) {
        const touch = e.changedTouches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const colUnder = elUnder ? elUnder.closest(".calendar-day-col") : null;
        const targetDay = colUnder ? colUnder.getAttribute("data-day") : null;
        const taskId = touchDragItem.getAttribute("data-task-id");

        if (touchDragGhost && touchDragGhost.parentNode) {
          touchDragGhost.parentNode.removeChild(touchDragGhost);
        }
        touchDragGhost = null;
        touchDragItem.classList.remove("is-dragging");
        gridContainer.classList.remove("is-drag-active");
        dayCols.forEach(c => c.classList.remove("drag-over"));

        if (taskId && targetDay) {
          moveChoreToDay(taskId, targetDay);
        }
      }
      isTouchDragging = false;
      touchDragItem = null;
    });

    card.addEventListener("touchcancel", () => {
      clearTimeout(touchTimer);
      if (touchDragGhost && touchDragGhost.parentNode) {
        touchDragGhost.parentNode.removeChild(touchDragGhost);
      }
      touchDragGhost = null;
      if (touchDragItem) touchDragItem.classList.remove("is-dragging");
      gridContainer.classList.remove("is-drag-active");
      dayCols.forEach(c => c.classList.remove("drag-over"));
      isTouchDragging = false;
      touchDragItem = null;
    });
  });
}



window.detectEmojiForTitle = detectEmojiForTitle;
window.openEventModal = openEventModal;
window.formatCalendarRange = formatCalendarRange;
window.setCalendarView = setCalendarView;
window.setCalendarContentFilter = setCalendarContentFilter;
window.syncCalendarContentFilterUI = syncCalendarContentFilterUI;
window.navigateCalendar = navigateCalendar;
window.renderCalendarMonthView = renderCalendarMonthView;
window.renderWeekCalendar = renderWeekCalendar;
window.getEventMinutes = getEventMinutes;
