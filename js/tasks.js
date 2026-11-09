
// ============================================================================
// FAMILY TASKS MULTI-COLUMN BOARD & DRAWER ENGINE (js/tasks.js)
// Multi-Column Profiles Board, Routines, Gestures, Task Drawer & Mini DatePicker
// ============================================================================

// Universal Helper: Normalize an assignee value into a clean lowercase string array
function getAssignedMembersList(assignedTo) {
  if (!assignedTo) return [];
  if (Array.isArray(assignedTo)) {
    return assignedTo.map(m => String(m).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof assignedTo === "string") {
    return assignedTo.split(",").map(m => m.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}
window.getAssignedMembersList = getAssignedMembersList;

// Is this chore done (for this member) on the given date? Ticks are saved
// per weekday name ("Tuesday") with the ISO week they were made in, so a
// tick only counts for that week: this Tuesday's tick must not show on next
// Tuesday. A tick saved without a week counts for the current week only.
function isTaskDoneOnDate(task, date, memberLower = null) {
  if (!task) return false;
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const weekKey = getIsoWeekKey(date);
  const inWeek = (wk) => (wk ? wk === weekKey : weekKey === getIsoWeekKey(new Date()));
  const completers = (val) => Array.isArray(val)
    ? val.map(s => String(s).trim().toLowerCase())
    : (typeof val === "string" ? val.split(",").map(s => s.trim().toLowerCase()) : []);
  const isMultiAssign = getAssignedMembersList(task.assignedTo).length > 1;
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";

  if (isDaily) {
    const comp = task.completedDays && task.completedDays[dayName];
    if (!comp) return false;
    const compWeek = typeof comp === "object"
      ? (comp.completedWeek || (comp.completedAt ? getIsoWeekKey(new Date(comp.completedAt)) : null))
      : null;
    if (!inWeek(compWeek)) return false;
    if (isMultiAssign && memberLower) return completers(typeof comp === "object" ? comp.completedBy : comp).includes(memberLower);
    return true;
  }
  // A dated chore belongs to that one day; otherwise the tick must be from this week
  if (!task.date && !inWeek(task.completedWeek)) return false;
  if (isMultiAssign && memberLower) return completers(task.completedBy).includes(memberLower);
  return !!task.done;
}
window.isTaskDoneOnDate = isTaskDoneOnDate;

// ---------------------------------------------------------------------------
// Chores vs routines
// A ROUTINE is personal: everyone does their own (brush teeth, make your
// bed), so it can't be handed to someone else. A CHORE is a household job
// (dishwasher, dinner) that anyone can take over and get the points for.
// Set per task in the Tasks panel (task.kind); tasks saved before that
// existed are recognised by name.
// ---------------------------------------------------------------------------
const PERSONAL_ROUTINE_NAMES = /\b(brush(ing)? (your |my |their )?teeth|teeth|floss|make (your |my |the )?bed|tidy (your |my )?(room|bedroom|clothes|toys)|put (your |my )?clothes away|clothes away|get dressed|curtains|blinds|(school )?bag ready|pack (your |my )?(school )?bag|homework|reading|shower|bath(time)?|wash (your |my )?(face|hair|hands)|skincare|get ready for (school|bed)|pyjamas|pajamas|lunch ?box ready|practi[cs]e (piano|guitar|violin|instrument))\b/i;

function isPersonalRoutine(task) {
  if (!task) return false;
  if (task.kind === "routine") return true;
  if (task.kind === "chore") return false;
  return PERSONAL_ROUTINE_NAMES.test(task.title || "");
}
window.isPersonalRoutine = isPersonalRoutine;

// Who's doing a chore on a given day. A swap (dragging a chore to someone
// else) is saved for that one date in task.assignedOverrides, keyed by
// "ISO week|weekday", so the regular rota (assignedDays) and next week are
// untouched. null in an override means Up for grabs.
function getEffectiveAssignee(task, dayName, weekKey) {
  if (!task) return null;
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  // Any day this week: a grab or swap lasts the week ("2026-W46|any")
  if (isAnyDayWeekly(task)) {
    const k = `${weekKey}|any`;
    if (task.assignedOverrides && Object.prototype.hasOwnProperty.call(task.assignedOverrides, k)) return task.assignedOverrides[k];
    return task.assignedTo;
  }
  if (!isDaily) return task.assignedTo;
  const key = `${weekKey}|${dayName}`;
  if (task.assignedOverrides && Object.prototype.hasOwnProperty.call(task.assignedOverrides, key)) return task.assignedOverrides[key];
  if (task.assignedDays && task.assignedDays[dayName] !== undefined) return task.assignedDays[dayName];
  return task.assignedTo;
}
window.getEffectiveAssignee = getEffectiveAssignee;

// "Every week, any day": needs doing once a week, any day. It shows every day
// of the week until someone ticks it, then only on the day it was done.
function isAnyDayWeekly(task) {
  return !!task && task.repeat === "weekly" && task.anyDay === true;
}
window.isAnyDayWeekly = isAnyDayWeekly;

// True when an assignee value names no specific person (empty, or only the
// shared "Up for grabs" / "Anyone" / "Family" pools).
function isUnassignedValue(assignedTo) {
  const pools = ["up for grabs", "anyone", "family"];
  return getAssignedMembersList(assignedTo).every(m => pools.includes(m));
}
window.isUnassignedValue = isUnassignedValue;

// getTaskRoutineInfo(task) is in js/utils.js
window.getTaskRoutineInfo = getTaskRoutineInfo;

// 15. SKYLIGHT TASKS PAGE (Multi-Column Profiles Board & Gestures)
// ============================================================================
let tasksSelectedDate = new Date();
tasksSelectedDate.setHours(0, 0, 0, 0);

// Column category filter state (no longer used per person; kept for old callers)
let tasksColumnFilters = {};

// ---------------------------------------------------------------------------
// The board's filter bar: Morning / Afternoon / Evening / Chores, for every
// column at once. Today, before 12 shows Morning and Chores; from 12 shows
// Afternoon, Evening and Chores (the others are greyed out but a tap away).
// Taps hold until the next switchover (midday, or the next family day).
// Any other day shows everything.
// ---------------------------------------------------------------------------
const TASK_SLOTS = [
  { key: "morning", icon: "🌤️", label: "Morning" },
  { key: "afternoon", icon: "⛅", label: "Afternoon" },
  { key: "evening", icon: "🌙", label: "Evening" },
  { key: "chores", icon: "🧹", label: "Chores" }
];
let tasksSlotChoice = null; // { period, on: Set } after a tap
function tasksSlotPeriod(viewingToday) {
  if (!viewingToday) return "other-day";
  const now = new Date();
  const h = now.getHours();
  return `${familyDayKey(now)}|${h >= 4 && h < 12 ? "am" : "pm"}`; // midnight-4am still counts as the evening before
}
function tasksSlotsOn(viewingToday) {
  const period = tasksSlotPeriod(viewingToday);
  if (tasksSlotChoice && tasksSlotChoice.period === period) return tasksSlotChoice.on;
  if (!viewingToday) return new Set(TASK_SLOTS.map(x => x.key));
  return new Set(period.endsWith("|am") ? ["morning", "chores"] : ["afternoon", "evening", "chores"]);
}
function toggleTaskSlot(key, viewingToday) {
  const on = new Set(tasksSlotsOn(viewingToday));
  if (on.has(key)) on.delete(key); else on.add(key);
  tasksSlotChoice = { period: tasksSlotPeriod(viewingToday), on };
}
// Midday (or a new day) while the board is up: the defaults move on
let tasksLastSlotPeriod = null;
setInterval(() => {
  const p = tasksSlotPeriod(true);
  if (tasksLastSlotPeriod && p !== tasksLastSlotPeriod) {
    const view = document.getElementById("view-chores");
    if (view && view.style.display !== "none" && typeof renderSkylightTasksPage === "function") renderSkylightTasksPage();
  }
  tasksLastSlotPeriod = p;
}, 60000);

// Active filter in Tasks Filter Dropdown (member visibility)
let tasksActiveMemberFilter = null; // null = all visible, or array of member names

// Tick-to-sink: finished cards sit at the bottom of their own section, and a
// section where everything is done folds into one "all done" line.
// Everything here is page-view memory only; nothing is saved to the board.
const tasksExpandedDoneSections = new Set();   // "date|member|section" keys the user opened
const tasksSectionCollapseHold = new Map();    // key -> Date.now() when it may fold up
let tasksCollapseHoldTimer = null;
const tasksFlipMembers = new Map();            // member (lower case) -> Date.now() deadline for slide animations
const TASKS_FLIP_MS = 300;
const TASKS_COLLAPSE_HOLD_MS = 700;
let tasksLastRenderedDateKey = null;           // slides only run when the day shown hasn't changed

function tasksReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
}

// Called just before a card is ticked or unticked, so the next renders slide
// the cards of that column to their new places. If this tick finishes its
// section, the section stays open for a moment so the tick is seen landing.
function markTasksToggle(taskId, member, cardEl) {
  const mLower = String(member || "").toLowerCase();
  if (!mLower) return;
  tasksFlipMembers.set(mLower, Date.now() + 450);
  const group = cardEl && cardEl.closest ? cardEl.closest("[data-section-key]") : null;
  if (!group || tasksReducedMotion()) return;
  const open = group.querySelectorAll(".skylight-task-card:not(.is-completed)");
  if (open.length === 1 && open[0].getAttribute("data-task-id") === String(taskId)) {
    tasksSectionCollapseHold.set(group.getAttribute("data-section-key"), Date.now() + TASKS_COLLAPSE_HOLD_MS);
  }
}

function findTasksCard(taskId, member) {
  const container = document.getElementById("tasks-columns-grid");
  if (!container) return null;
  const mLower = String(member || "").toLowerCase();
  return Array.from(container.querySelectorAll(".skylight-task-card")).find(c =>
    c.getAttribute("data-task-id") === String(taskId) && (c.getAttribute("data-member") || "").toLowerCase() === mLower) || null;
}

// The tasks in one column of the Tasks page on a given day: a person's, or
// "Up for grabs". Shared by the Tasks page and the morning Today screen.
// A one-off chore (with a date) from an earlier day, not finished: it carries
// over to today, like Skylight, and shows an "Overdue" clock. Routines and
// weekly chores don't carry over (they come round again). Nothing is
// re-dated: it's worked out when shown, so every device agrees.
function isOverdueOn(task, date, memberLower = null) {
  if (!task || !task.date || task.archived) return false;
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  if (isDaily || task.repeat === "weekly") return false;
  const shown = getLocalDateKey(date);
  if (shown !== getLocalDateKey(new Date()) || task.date >= shown) return false; // only on today
  return !isTaskDoneOnDate(task, date, memberLower);
}
window.isOverdueOn = isOverdueOn;

// The family day runs until 4am: a chore ticked at 12:20am counts as done the
// day before, which is how a family thinks of a late evening
const FAMILY_DAY_ENDS_HOUR = 4;
function familyDayKey(when) {
  const d = new Date(when);
  if (isNaN(d)) return "";
  d.setHours(d.getHours() - FAMILY_DAY_ENDS_HOUR);
  return getLocalDateKey(d);
}
window.familyDayKey = familyDayKey;

function getTasksForColumn(colMember, date) {
  const isGrabPool = colMember === "Up for grabs";
  const mLower = String(colMember).toLowerCase();
  const selectedDateStr = getLocalDateKey(date);
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const isSelectedCurrentWeek = (getIsoWeekKey(date) === getIsoWeekKey(new Date()));
  const tasksSelectedDate = date;
  // Carried over: a one-off chore from an earlier day that nobody finished
  // shows on today too, until it's ticked or deleted (see isOverdueOn)
  // A one-off chore lives on one day: its own day while that's today or still
  // to come; once its day has passed, today while it's not done (Overdue),
  // and the day it was done once it's ticked. Past days show what was done then.
  const todayKey = getLocalDateKey(new Date());
  const doneDay = (task) => (task.completedAt ? familyDayKey(task.completedAt) : task.date);
  const onDate = (task, who) => {
    const done = isTaskDoneOnDate(task, date, who);
    if (task.date === selectedDateStr && selectedDateStr >= todayKey) return true;
    if (done) return task.date <= selectedDateStr && doneDay(task) === selectedDateStr || (task.date === selectedDateStr && doneDay(task) < task.date);
    return isOverdueOn(task, date, who);
  };
  // Any day this week: every day of the week until it's ticked, then the day
  // it was done (shown on past days only if it was done that day)
  const anyDayOn = (task) => {
    if (isTaskDoneOnDate(task, date)) return !!task.completedAt && familyDayKey(task.completedAt) === selectedDateStr;
    return selectedDateStr >= todayKey;
  };
  return (window.currentTasks || []).filter(task => {
      if (!task || typeof task !== "object") return false;
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const assigned = task.assignedTo || "Up for grabs";

      // A daily task's owner for the selected day: a swap for this date, else
      // its rota entry for this weekday, else its main assignee.
      const dailyAssignee = isDaily ? getEffectiveAssignee(task, dayName, getIsoWeekKey(tasksSelectedDate)) : task.assignedTo;

      if (isGrabPool) {
        if (isDaily) {
          // Daily tasks with nobody assigned for this day land here, so a
          // daily chore never silently drops off the board.
          return isUnassignedValue(dailyAssignee);
        }
        if (isAnyDayWeekly(task)) return isUnassignedValue(getEffectiveAssignee(task, dayName, getIsoWeekKey(tasksSelectedDate))) && anyDayOn(task);
        // Unassigned or assigned to Anyone / Up for grabs
        if (assigned === "Up for grabs" || assigned === "Anyone" || assigned === "Family") {
          if (task.date) return onDate(task, null);
          if (task.repeat === "weekly") return task.day === dayName;
          return isSelectedCurrentWeek; // a one-off is up for grabs all this week, not in future weeks
        }
        return false;
      }

      // Helper: check if task is assigned to this member (handles single string, comma-separated, or array)
      const isAssignedToThisMember = (assignedVal) => {
        if (!assignedVal) return false;
        if (Array.isArray(assignedVal)) {
          return assignedVal.some(v => String(v).trim().toLowerCase() === mLower);
        }
        if (typeof assignedVal === "string") {
          return assignedVal.split(",").map(v => v.trim().toLowerCase()).includes(mLower);
        }
        return false;
      };

      // Member column:
      if (isDaily) {
        return isAssignedToThisMember(dailyAssignee);
      }

      if (isAnyDayWeekly(task)) return isAssignedToThisMember(getEffectiveAssignee(task, dayName, getIsoWeekKey(tasksSelectedDate))) && anyDayOn(task);
      if (isAssignedToThisMember(task.assignedTo)) {
        if (task.date) return onDate(task, mLower);
        if (task.repeat === "weekly") return task.day === dayName;
        return isSelectedCurrentWeek && task.day === dayName;
      }
      return false;
  });
}
window.getTasksForColumn = getTasksForColumn;

function renderSkylightTasksPage() {
  const container = document.getElementById("tasks-columns-grid");
  if (!container) return;

  // Before the cards are rebuilt: remember each column's scroll, and where
  // each card sits in a column that has just had a tick (for the slide).
  const nowMs = Date.now();
  const reduceMotion = tasksReducedMotion();
  const savedScroll = new Map();
  const flipTops = new Map();
  tasksFlipMembers.forEach((until, m) => { if (until <= nowMs) tasksFlipMembers.delete(m); });
  const renderDateKey = getLocalDateKey(tasksSelectedDate);
  const sameDayShown = renderDateKey === tasksLastRenderedDateKey;
  tasksLastRenderedDateKey = renderDateKey;
  container.querySelectorAll(".skylight-tasks-col").forEach(col => {
    const m = (col.getAttribute("data-col-member") || "").toLowerCase();
    const body = col.querySelector(".tasks-col-body");
    if (body) savedScroll.set(m, body.scrollTop);
    if (!reduceMotion && sameDayShown && tasksFlipMembers.has(m)) {
      const tops = new Map();
      col.querySelectorAll(".skylight-task-card").forEach(c => tops.set(c.getAttribute("data-task-id"), c.getBoundingClientRect().top));
      flipTops.set(m, tops);
    }
  });
  // Sections showing their cards right now: if one folds up in this render,
  // its "all done" line fades in (and only then, not on every refresh)
  const prevOpenSections = new Set();
  container.querySelectorAll(".tasks-section-group[data-section-key]:not(.is-collapsed)").forEach(g => prevOpenSections.add(g.getAttribute("data-section-key")));
  let nextHoldMs = Infinity;

  const clockEl = document.getElementById("tasks-live-clock");
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const famEl = document.getElementById("tasks-family-name");
  if (famEl) {
    famEl.textContent = window.isDefaultTurnbullBoard ? "Turnbull Family" : ((window.boardSettings || {}).familyName || "Our Family");
  }

  // Update date banner
  const dateSubBar = document.getElementById("tasks-date-sub-bar");
  if (dateSubBar) {
    const dNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dow = dNames[tasksSelectedDate.getDay()];
    const mon = mNames[tasksSelectedDate.getMonth()];
    const dt = tasksSelectedDate.getDate();
    const yr = tasksSelectedDate.getFullYear();
    const isToday = (new Date()).toDateString() === tasksSelectedDate.toDateString();
    const dateText = isToday ? `Today • ${dow}, ${dt} ${mon}` : `${dow}, ${dt} ${mon} ${yr}`;
    // Up for grabs isn't a column any more: a button by the date, with how
    // many jobs are waiting, opens the Hand out panel (js/grabs-panel.js).
    // Red when one is important or overdue. While a job is being dragged,
    // dropping it here puts it back up for grabs.
    const jobs = typeof window.grabJobs === "function" ? window.grabJobs(tasksSelectedDate) : [];
    // Red when one is marked Important (big jobs are never "overdue")
    const urgent = jobs.some(t => t.isPriority);
    const grabLabel = BIG_JOBS_LABEL;
    // The day shown is on the Today button ("Today · Mon 9", or "Tue 10 Nov"),
    // so there's no separate date line taking up the board's room
    const todayBtn = document.getElementById("btn-tasks-today");
    if (todayBtn) {
      todayBtn.textContent = isToday ? `Today · ${dow.slice(0, 3)} ${dt}` : `${dow.slice(0, 3)} ${dt} ${mon}`;
      todayBtn.setAttribute("aria-label", isToday ? `Today, ${dateText.replace(/^Today • /, "")}` : `Showing ${dow} ${dt} ${mon}. Go back to today`);
      todayBtn.classList.toggle("is-other-day", !isToday);
    }
    dateSubBar.innerHTML = `<button type="button" class="tasks-grab-btn${jobs.length ? "" : " is-empty"}${urgent ? " is-urgent" : ""}" data-open-grabs data-grab-drop
        aria-label="${escapeHtml(jobs.length ? `${grabLabel}: ${jobs.length} nobody's doing yet. Hand them out` : `${grabLabel}: nothing waiting`)}">
        <span class="tasks-grab-btn-icon" aria-hidden="true">🛠️</span>
        <span class="tasks-grab-btn-label">${escapeHtml(grabLabel)}</span>
        <span class="tasks-grab-btn-count">${jobs.length}</span>
        <span class="tasks-grab-btn-drop">Drop it here for anyone</span>
      </button>`;
  }
  renderTasksSlotBar(container);
  // Quick grabs: small everyday jobs nobody owns, as pills to drag (js/quick-grabs.js)
  if (window.QuickGrabs) window.QuickGrabs.render(container, tasksSelectedDate, tasksSlotsOn(familyDayKey(new Date()) === getLocalDateKey(tasksSelectedDate)));

  const selectedDateStr = getLocalDateKey(tasksSelectedDate);
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekDays[tasksSelectedDate.getDay()];
  const isSelectedCurrentWeek = (getIsoWeekKey(tasksSelectedDate) === getIsoWeekKey(new Date()));
  // Ticks are saved against this week's weekday, so a future day can't be ticked yet
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const isFutureDay = tasksSelectedDate.getTime() > startOfToday.getTime();

  // One column per person. Up for grabs is the button by the date (above),
  // which opens the Hand out panel, so it doesn't take a column
  let columns = [...((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) || ["Steven", "Sorcha", "Ava", "Dara"])];

  if (tasksActiveMemberFilter && Array.isArray(tasksActiveMemberFilter)) {
    columns = columns.filter(c => tasksActiveMemberFilter.includes(c));
  }

  let totalTasksAllBoard = 0;
  let completedTasksAllBoard = 0;

  let columnsHtml = "";

  columns.forEach(colMember => {
    const isGrabPool = colMember === "Up for grabs";
    const mLower = colMember.toLowerCase();
    const pal = isGrabPool 
      ? { primary: "#ef4444", lightBg: "#fef2f2", border: "#fca5a5", text: "#991b1b", solid: "#ef4444" }
      : getMemberPalette(colMember);

    // This profile's tasks for the selected day (shared with the Today screen)
    let memberTasks = getTasksForColumn(colMember, tasksSelectedDate);

    // Check completed count
    const totalCount = memberTasks.length;
    let completedCount = 0;

    memberTasks.forEach(task => {
      if (isTaskDoneOnDate(task, tasksSelectedDate, mLower)) completedCount++;
    });

    // Which sections show: the board's filter bar (Anytime goes with Chores)
    const slotsOn = tasksSlotsOn(familyDayKey(new Date()) === getLocalDateKey(tasksSelectedDate));
    const showSlot = (k) => slotsOn.has(k === "anytime" ? "chores" : k);

    // Group tasks
    const morningTasks = [];
    const afternoonTasks = [];
    const eveningTasks = [];
    const anytimeTasks = [];
    const generalChores = [];

    memberTasks.forEach(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const rInfo = getTaskRoutineInfo(task);
      if (isDaily || task.routineSlot) {
        // No time of day set (and none in the title) means Anytime, not Evening
        const slot = task.routineSlot || (rInfo.label.includes("Morning") ? "morning" : (rInfo.label.includes("Afternoon") ? "afternoon" : (rInfo.label.includes("Evening") ? "evening" : "anytime")));
        if (slot === "morning") morningTasks.push(task);
        else if (slot === "afternoon") afternoonTasks.push(task);
        else if (slot === "evening") eveningTasks.push(task);
        else anytimeTasks.push(task);
      } else {
        generalChores.push(task);
      }
    });

    // Important ones first in each group (stable, so the rest keep their order)
    [morningTasks, afternoonTasks, eveningTasks, anytimeTasks, generalChores].forEach(list => {
      list.sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));
    });

    // Routine filter pills HTML
    const hasMorning = morningTasks.length > 0;
    const hasAfternoon = afternoonTasks.length > 0;
    const hasEvening = eveningTasks.length > 0;
    const hasAnytime = anytimeTasks.length > 0;
    const hasChores = generalChores.length > 0;

    const filterPillsHtml = ""; // the filter bar is board-wide now (renderTasksSlotBar)

    // Render task cards helper
    const renderCard = (t) => {
      const isDaily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      const isDone = isTaskDoneOnDate(t, tasksSelectedDate, mLower);
      const tIcon = t.icon || detectEmojiForChore(t.title) || "🪆";
      const isMoney = (window.boardSettings || {}).gameMode === "money";
      const curr = (window.boardSettings || {}).currency || "£";
      const valText = isMoney ? `${curr}${taskReward(t, true).toFixed(2)}` : `${taskPoints(t)} pts`;
      const timeSubtitle = t.time || (isDaily ? "Daily" : (isAnyDayWeekly(t) ? "This week" : "Today"));
      const overdue = !isDone && isOverdueOn(t, tasksSelectedDate, isGrabPool ? null : mLower);
      const important = !!t.isPriority && !isDone;
      const importantTag = important ? `<span class="skylight-task-important">Important</span>` : "";
      // Taken from Quick grabs for today (back in the tray tomorrow)
      const grabbed = !isGrabPool && !isDone && window.QuickGrabs && window.QuickGrabs.isGrabbedOn(t, tasksSelectedDate);
      const grabbedTag = grabbed ? `<span class="skylight-task-grabbed">⚡ Grabbed</span>` : "";
      const justGrabbed = grabbed && tasksJustGrabbed && tasksJustGrabbed.id === t.id && tasksJustGrabbed.member === colMember && tasksJustGrabbed.until > Date.now();
      const subHtml = overdue
        ? `<span class="skylight-task-overdue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Overdue</span>`
        : escapeHtml(timeSubtitle);

      // Up for grabs cards can't be ticked: they must be dragged into a
      // person's column first, which assigns the chore to them.
      const isGrabbable = isGrabPool && !isDone;
      // A chore in someone's column can be dragged to another person or back
      // to Up for grabs; personal routines (brush teeth...) stay put
      const isMovable = !isGrabPool && !isDone && !isPersonalRoutine(t);
      const actionHtml = (isFutureDay && !isGrabPool)
        ? `<span class="skylight-task-check-circle is-static is-future" title="You can tick this off on the day" aria-label="Not due yet"></span>`
        : isGrabPool
        ? (isDone
            ? `<span class="skylight-task-check-circle is-static" aria-label="Completed">✓</span>`
            : `<span class="skylight-task-grab-handle" aria-hidden="true" title="Drag to someone's column to claim">⠿</span>`)
        : `<button type="button" class="skylight-task-check-circle"
                  data-task-id="${t.id}" data-day="${dayName}" data-member="${escapeHtml(colMember)}" data-completed="${isDone ? 'true' : 'false'}"
                  title="${isDone ? 'Undo task' : 'Mark as complete'}">
            ${isDone ? '✓' : ''}
          </button>`;

      return `
        <div class="skylight-task-card ${isDone ? 'is-completed' : ''} ${isGrabbable ? 'is-grabbable' : ''} ${isMovable ? 'is-movable' : ''} ${important ? 'is-important' : ''} ${justGrabbed ? 'is-just-grabbed' : ''}"
             style="--card-color: ${pal.primary}; background: ${isDone ? 'rgba(0,0,0,0.03)' : pal.lightBg}; border-color: ${pal.border};"
             data-task-id="${t.id}" data-day="${dayName}" data-date="${selectedDateStr}" data-member="${escapeHtml(colMember)}">
          <div class="skylight-task-card-main">
            <span class="skylight-task-card-icon">${escapeHtml(tIcon)}</span>
            <div class="skylight-task-card-text">
              <span class="skylight-task-card-title">${escapeHtml(t.title)}</span>
              <span class="skylight-task-card-sub">${importantTag}${grabbedTag}${subHtml} • ${valText}</span>
            </div>
          </div>
          ${actionHtml}
        </div>
      `;
    };

    // Build Column Sections
    let bodySectionsHtml = "";
    if (totalCount === 0) {
      const emptyIcons = ["⭐", "👏", "✨", "🪅"];
      const randIcon = emptyIcons[Math.abs(colMember.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % emptyIcons.length];
      bodySectionsHtml = `
        <div class="tasks-col-empty-card">
          <span class="tasks-col-empty-icon">${randIcon}</span>
          <span class="tasks-col-empty-label">Nothing to do today.</span>
        </div>
      `;
    } else {
      let sectionsToShow = [];
      if (showSlot("morning") && morningTasks.length > 0) sectionsToShow.push({ key: "morning", title: "Morning", emoji: "🌤️", list: morningTasks });
      if (showSlot("afternoon") && afternoonTasks.length > 0) sectionsToShow.push({ key: "afternoon", title: "Afternoon", emoji: "⛅", list: afternoonTasks });
      if (showSlot("evening") && eveningTasks.length > 0) sectionsToShow.push({ key: "evening", title: "Evening", emoji: "🌙", list: eveningTasks });
      if (showSlot("anytime") && anytimeTasks.length > 0) sectionsToShow.push({ key: "anytime", title: "Anytime", emoji: "🕑", list: anytimeTasks });
      if (showSlot("chores") && generalChores.length > 0) sectionsToShow.push({ key: "chores", title: "Chores", emoji: "🧹", list: generalChores });

      bodySectionsHtml = sectionsToShow.map(sec => {
        // To-do cards first, finished ones after, each keeping its own order
        const todo = [], done = [];
        sec.list.forEach(t => (isTaskDoneOnDate(t, tasksSelectedDate, mLower) ? done : todo).push(t));
        const ordered = todo.concat(done);
        const secKey = `${selectedDateStr}|${mLower}|${sec.key}`;
        const keyAttr = escapeHtml(secKey);
        const allDone = !isFutureDay && todo.length === 0 && done.length > 0;
        const countText = `${done.length}/${sec.list.length}`;

        if (!allDone) {
          tasksExpandedDoneSections.delete(secKey);
          tasksSectionCollapseHold.delete(secKey);
        } else {
          const hold = tasksSectionCollapseHold.get(secKey);
          if (hold && hold > Date.now()) {
            // Just finished: stay open briefly so the last tick is seen
            nextHoldMs = Math.min(nextHoldMs, hold - Date.now());
          } else {
            tasksSectionCollapseHold.delete(secKey);
            if (!tasksExpandedDoneSections.has(secKey)) {
              return `
                <div class="tasks-section-group is-all-done is-collapsed" data-section-key="${keyAttr}">
                  <button type="button" class="tasks-section-done-chip${prevOpenSections.has(secKey) ? " is-fresh" : ""}" data-section-key="${keyAttr}" aria-expanded="false" aria-label="${escapeHtml(sec.title)}: all done, ${done.length} of ${sec.list.length}. Tap to show them." title="Show the finished ${escapeHtml(sec.title.toLowerCase())} jobs">
                    <span class="chip-emoji" aria-hidden="true">${escapeHtml(sec.emoji)}</span>
                    <span class="chip-label"><span class="chip-title">${escapeHtml(sec.title)}</span><span class="chip-note"> — all done!</span></span>
                    <span class="chip-count">${countText} ✓</span>
                  </button>
                </div>
              `;
            }
            return `
              <div class="tasks-section-group is-all-done is-expanded" data-section-key="${keyAttr}">
                <button type="button" class="tasks-section-heading tasks-section-done-toggle" data-section-key="${keyAttr}" aria-expanded="true" title="Fold up">
                  <span class="toggle-title">${escapeHtml(sec.title)}</span>
                  <span class="toggle-note"><span class="note-word">all done </span>${countText} ✓</span>
                  <span class="toggle-chevron" aria-hidden="true">▴</span>
                </button>
                ${ordered.map(renderCard).join("")}
              </div>
            `;
          }
        }
        return `
          <div class="tasks-section-group" data-section-key="${keyAttr}">
            <h4 class="tasks-section-heading">${escapeHtml(sec.title)}</h4>
            ${ordered.map(renderCard).join("")}
          </div>
        `;
      }).join("");
      // Everything for this person is in a slot that's switched off
      if (!sectionsToShow.length) bodySectionsHtml = `
        <div class="tasks-col-empty-card is-filtered">
          <span class="tasks-col-empty-icon">✨</span>
          <span class="tasks-col-empty-label">All clear for now</span>
        </div>`;
    }

    const isAllDone = totalCount > 0 && completedCount === totalCount;
    const initialLetter = isGrabPool ? "⚡" : colMember.charAt(0).toUpperCase();
    columnsHtml += `
      <div class="skylight-tasks-col" data-col-member="${escapeHtml(colMember)}" style="--card-color: ${pal.primary}; background: ${pal.lightBg}22; border-color: ${pal.border};">
        <div class="tasks-col-header" style="--head-bg: ${pal.lightBg};">
          <div class="tasks-col-top-row">
            <div class="tasks-col-profile-info">
              <div class="tasks-col-avatar" style="background: ${pal.primary};">${escapeHtml(initialLetter)}</div>
              <span class="tasks-col-name">${escapeHtml(displayMemberName(colMember))}</span>
            </div>
            <span class="tasks-col-progress-tally ${isAllDone ? 'all-done' : ''}">
              ${isAllDone ? '✓' : ''} ${completedCount}/${totalCount}
            </span>
          </div>
          ${filterPillsHtml}
        </div>
        <div class="tasks-col-body">
          ${bodySectionsHtml}
        </div>
      </div>
    `;
  });

  // Phones: which person's column is showing (kept across redraws)
  const phoneTabs = isTasksPhone();
  const shownMember = phoneTabs ? (tasksPhoneShown || tasksPhoneMember(container)) : null;

  container.innerHTML = columnsHtml;
  renderTasksPersonTabs(container, shownMember);

  // Put each column back where it was scrolled to, then slide the cards of a
  // just-ticked column from their old places to their new ones (FLIP).
  container.querySelectorAll(".skylight-tasks-col").forEach(col => {
    const m = (col.getAttribute("data-col-member") || "").toLowerCase();
    const body = col.querySelector(".tasks-col-body");
    if (body && savedScroll.has(m)) body.scrollTop = savedScroll.get(m);
    const tops = flipTops.get(m);
    if (!tops) return;
    col.querySelectorAll(".skylight-task-card").forEach(c => {
      const oldTop = tops.get(c.getAttribute("data-task-id"));
      if (oldTop === undefined || typeof c.animate !== "function") return;
      const dy = oldTop - c.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) {
        c.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
          { duration: TASKS_FLIP_MS, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
  });

  // A just-finished section folds up once its short pause is over
  if (tasksCollapseHoldTimer) { clearTimeout(tasksCollapseHoldTimer); tasksCollapseHoldTimer = null; }
  if (nextHoldMs !== Infinity) {
    tasksCollapseHoldTimer = setTimeout(() => {
      tasksCollapseHoldTimer = null;
      // Let the cards below the folding section slide up into place
      if (!tasksReducedMotion()) {
        tasksSectionCollapseHold.forEach((until, key) => {
          if (until <= Date.now() + 20) tasksFlipMembers.set(key.split("|")[1], Date.now() + 450);
        });
      }
      renderSkylightTasksPage();
    }, Math.max(0, nextHoldMs) + 20);
  }

  // Up for grabs: the button by the date opens the Hand out panel
  document.querySelectorAll("#tasks-date-sub-bar [data-open-grabs]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (typeof window.openGrabsPanel === "function") window.openGrabsPanel(tasksSelectedDate);
    };
  });

  // Wire the "all done" line (open it) and its header (fold it up again)
  container.querySelectorAll(".tasks-section-done-chip, .tasks-section-done-toggle").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const key = btn.getAttribute("data-section-key");
      if (tasksExpandedDoneSections.has(key)) tasksExpandedDoneSections.delete(key);
      else tasksExpandedDoneSections.add(key);
      tasksSectionCollapseHold.delete(key);
      renderSkylightTasksPage();
    };
  });

  // Wire filter pill buttons
  container.querySelectorAll(".routine-filter-circle-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const m = btn.getAttribute("data-member").toLowerCase();
      const f = btn.getAttribute("data-filter");
      tasksColumnFilters[m] = (tasksColumnFilters[m] === f) ? "all" : f;
      renderSkylightTasksPage();
    };
  });

  // Wire task card click -> opens quick card modal
  container.querySelectorAll(".skylight-task-card").forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest(".skylight-task-check-circle")) return;
      if (grabDragJustEnded) return; // a drag, not a tap
      const tid = card.getAttribute("data-task-id");
      const dName = card.getAttribute("data-day");
      const colMem = card.getAttribute("data-member") || null;
      openSkylightTaskQuickModal(tid, dName, colMem, card.getAttribute("data-date"));
    };
  });

  // Wire completion check circle click
  container.querySelectorAll(".skylight-task-check-circle").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tid = btn.getAttribute("data-task-id");
      const dName = btn.getAttribute("data-day");
      const mem = btn.getAttribute("data-member") || null;
      const isComp = btn.getAttribute("data-completed") === "true";
      markTasksToggle(tid, mem, btn.closest(".skylight-task-card"));
      if (isComp) {
        handleUndoTask(tid, dName, null, mem);
      } else {
        handleCompleteTaskWithCelebration(tid, dName, mem, btn.closest(".skylight-task-card")?.getAttribute("data-date"));
      }
    };
  });

  wireGrabDragAndDrop(container);
}
window.renderSkylightTasksPage = renderSkylightTasksPage;

// ============================================================================
// UP FOR GRABS: DRAG A CHORE INTO A PERSON'S COLUMN TO CLAIM IT
// Touch: press and hold a card (so a normal swipe still scrolls the list),
// then drag. Mouse: just drag. Dropping on a person's column assigns it to
// them: daily chores for that day only, one-off chores outright.
// ============================================================================
const GRAB_HOLD_MS = 280;
const GRAB_MOVE_CANCEL_PX = 10;
const GRAB_EDGE_SCROLL_PX = 70;
let grabDrag = null;
let grabDragJustEnded = false;
let tasksJustGrabbed = null; // { id, member, until }: the card that just arrived pops

function wireGrabDragAndDrop(container) {
  container.querySelectorAll(".skylight-task-card.is-grabbable, .skylight-task-card.is-movable").forEach(card => wireGrabDraggable(card, container));
}

// One thing that can be picked up and dropped on a person (a card on the
// board, or a quick grab pill above it, js/quick-grabs.js). It needs
// data-task-id, data-day, data-date and data-member (where it is now).
function wireGrabDraggable(card, container) {
  // Touch: press-and-hold to pick up
  card.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    if (e.target.closest(".skylight-task-check-circle")) return; // that's a tick, not a drag
    const t = e.touches[0];
    const pending = { card, container, startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastY: t.clientY };
    pending.holdTimer = setTimeout(() => beginGrabDrag(pending, pending.lastX, pending.lastY), GRAB_HOLD_MS);
    grabDrag = pending;
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    if (!grabDrag || grabDrag.card !== card) return;
    const t = e.touches[0];
    grabDrag.lastX = t.clientX;
    grabDrag.lastY = t.clientY;
    if (!grabDrag.active) {
      // Moved before the hold finished: the user is scrolling, not grabbing
      if (Math.hypot(t.clientX - grabDrag.startX, t.clientY - grabDrag.startY) > GRAB_MOVE_CANCEL_PX) {
        clearTimeout(grabDrag.holdTimer);
        grabDrag = null;
      }
      return;
    }
    e.preventDefault(); // stop the page scrolling while dragging
    moveGrabDrag(t.clientX, t.clientY);
  }, { passive: false });

  const finishTouch = () => {
    if (!grabDrag || grabDrag.card !== card) return;
    clearTimeout(grabDrag.holdTimer);
    if (grabDrag.active) endGrabDrag();
    else grabDrag = null;
  };
  card.addEventListener("touchend", finishTouch);
  card.addEventListener("touchcancel", finishTouch);

  // Mouse: drag once the pointer moves a few pixels
  card.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".skylight-task-check-circle")) return; // that's a tick, not a drag
    e.preventDefault(); // no text selection while dragging
    const pending = { card, container, startX: e.clientX, startY: e.clientY };
    grabDrag = pending;
    const onMove = (ev) => {
      if (grabDrag !== pending) return;
      if (!pending.active) {
        if (Math.hypot(ev.clientX - pending.startX, ev.clientY - pending.startY) < 6) return;
        beginGrabDrag(pending, ev.clientX, ev.clientY);
      }
      moveGrabDrag(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (grabDrag !== pending) return;
      if (pending.active) endGrabDrag();
      else grabDrag = null; // plain click: card.onclick opens the quick view
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
window.wireGrabDraggable = wireGrabDraggable;

function beginGrabDrag(state, x, y) {
  if (grabDrag !== state) return;
  const rect = state.card.getBoundingClientRect();
  const ghost = state.card.cloneNode(true);
  ghost.classList.add("skylight-task-drag-ghost");
  ghost.style.width = rect.width + "px";
  ghost.style.left = rect.left + "px";
  ghost.style.top = rect.top + "px";
  document.body.appendChild(ghost);

  state.ghost = ghost;
  state.offsetX = x - rect.left;
  state.offsetY = y - rect.top;
  state.active = true;
  state.taskId = state.card.getAttribute("data-task-id");
  state.day = state.card.getAttribute("data-day");
  state.date = state.card.getAttribute("data-date");
  state.fromMember = state.card.getAttribute("data-member");
  state.card.classList.add("is-drag-source");
  // Make it clear where it can go: the column (and phone tab) it came from
  // fades with the rest of the page; every other person's column, their
  // tab and the Grab it button stay bright, each saying what a drop does
  const fromLower = String(state.fromMember || "").toLowerCase();
  document.querySelectorAll("#tasks-columns-grid .skylight-tasks-col, #tasks-person-tabs [data-person-tab]").forEach(el => {
    const m = el.getAttribute("data-col-member") || el.getAttribute("data-person-tab") || "";
    el.classList.toggle("is-drag-origin", m.toLowerCase() === fromLower);
    if (el.classList.contains("skylight-tasks-col")) el.setAttribute("data-drop-label", `Give to ${displayMemberName(m)}`);
  });
  document.body.classList.add("is-grab-dragging");
  if (navigator.vibrate) navigator.vibrate(15);
  moveGrabDrag(x, y);
}

function moveGrabDrag(x, y) {
  const state = grabDrag;
  if (!state || !state.active) return;
  state.ghost.style.left = (x - state.offsetX) + "px";
  state.ghost.style.top = (y - state.offsetY) + "px";

  // Nudge the board sideways when dragging near its edges, so columns that
  // are off-screen can still be reached
  const board = state.container;
  const bRect = board.getBoundingClientRect();
  const overBoard = y >= bRect.top && y <= bRect.bottom; // not over the phone tabs above it
  if (overBoard && x < bRect.left + GRAB_EDGE_SCROLL_PX) board.scrollLeft -= 14;
  else if (overBoard && x > bRect.right - GRAB_EDGE_SCROLL_PX) board.scrollLeft += 14;

  // The page scrolls now (not each column): near the top or bottom, scroll it
  const page = document.querySelector("#view-chores .skylight-tasks-page-container");
  if (page) {
    const pr = page.getBoundingClientRect();
    if (y < pr.top + GRAB_EDGE_SCROLL_PX) page.scrollTop -= 14;
    else if (y > pr.bottom - GRAB_EDGE_SCROLL_PX) page.scrollTop += 14;
  }

  const under = document.elementFromPoint(x, y);
  // Over the Grab it button: put the job back up for grabs
  const grabDrop = under ? under.closest("[data-grab-drop]") : null;
  if (grabDrop) {
    if (state.targetCol !== grabDrop) {
      if (state.targetCol) state.targetCol.classList.remove("is-drop-target");
      grabDrop.classList.add("is-drop-target");
      state.targetCol = grabDrop;
      state.targetMember = state.fromMember === "Up for grabs" ? null : "Up for grabs";
    }
    return;
  }
  // Phones: the person tabs along the top take a drop too
  const tab = under ? under.closest("#tasks-person-tabs [data-person-tab]") : null;
  if (tab) {
    const m = tab.getAttribute("data-person-tab");
    const target = m !== state.fromMember ? tab : null;
    if (state.targetCol !== target) {
      if (state.targetCol) state.targetCol.classList.remove("is-drop-target");
      if (target) target.classList.add("is-drop-target");
      state.targetCol = target;
      state.targetMember = target ? m : null;
    }
    return;
  }
  let col = under ? under.closest(".skylight-tasks-col") : null;
  // Below a short column (or past the bottom of a long one): whoever's lane
  // the finger is in, so a job can be dropped anywhere under someone's name
  if (!col && under && board.contains(under)) {
    col = Array.from(board.querySelectorAll(".skylight-tasks-col")).find(c => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && x >= r.left && x <= r.right;
    }) || null;
  }
  const member = col ? col.getAttribute("data-col-member") : null;
  // Any other column, including back to Up for grabs
  const target = (member && member !== state.fromMember) ? col : null;
  if (state.targetCol !== target) {
    if (state.targetCol) state.targetCol.classList.remove("is-drop-target");
    if (target) target.classList.add("is-drop-target");
    state.targetCol = target;
    state.targetMember = target ? member : null;
  }
}

function endGrabDrag() {
  const state = grabDrag;
  grabDrag = null;
  if (!state) return;
  if (state.ghost) state.ghost.remove();
  state.card.classList.remove("is-drag-source");
  document.querySelectorAll(".is-drag-origin").forEach(el => el.classList.remove("is-drag-origin"));
  if (state.targetCol) state.targetCol.classList.remove("is-drop-target");
  document.body.classList.remove("is-grab-dragging");

  // Swallow the click the browser fires right after a mouse drag
  grabDragJustEnded = true;
  setTimeout(() => { grabDragJustEnded = false; }, 60);

  if (state.targetMember) moveTaskBetween(state.taskId, state.date, state.fromMember, state.targetMember);
}

// Move a chore from one column to another for one date: Up for grabs to a
// person (claim), person to person (swap), or person back to Up for grabs.
// Daily chores change for that date only (task.assignedOverrides), leaving
// the rota and other weeks alone; one-off chores change outright. Whoever
// ends up with it gets the points when they tick it. Shows an Undo message.
function moveTaskBetween(taskId, dateStr, fromMember, toMember) {
  const task = (window.currentTasks || []).find(t => t.id === taskId);
  if (!task || !dateStr || fromMember === toMember) return;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const weekKey = getIsoWeekKey(date);
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const pools = ["up for grabs", "anyone", "family"];

  // Work out the new assignee: swap fromMember for toMember (shared chores
  // keep their other people)
  const anyDay = isAnyDayWeekly(task);
  const overrideKey = isDaily ? `${weekKey}|${dayName}` : (anyDay ? `${weekKey}|any` : null);
  const current = overrideKey ? getEffectiveAssignee(task, dayName, weekKey) : task.assignedTo;
  let people = getAssigneeNames(current).filter(n => !pools.includes(n.toLowerCase()));
  if (fromMember !== "Up for grabs") people = people.filter(n => n.toLowerCase() !== fromMember.toLowerCase());
  else people = [];
  if (toMember !== "Up for grabs" && !people.some(n => n.toLowerCase() === toMember.toLowerCase())) people.push(toMember);
  const newValue = people.length === 0 ? null : (people.length === 1 ? people[0] : people);

  const before = overrideKey
    ? { assignedOverrides: JSON.parse(JSON.stringify(task.assignedOverrides || {})) }
    : { assignedTo: task.assignedTo === undefined ? null : JSON.parse(JSON.stringify(task.assignedTo)) };

  let payload;
  if (overrideKey) {
    const thisWeek = getIsoWeekKey(new Date());
    const overrides = {};
    // keep this week's and future swaps; drop old ones
    Object.entries(task.assignedOverrides || {}).forEach(([k, v]) => { if (k.split("|")[0] >= thisWeek) overrides[k] = v; });
    overrides[overrideKey] = newValue;
    task.assignedOverrides = overrides;
    payload = { assignedOverrides: overrides };
  } else {
    task.assignedTo = newValue;
    payload = { assignedTo: newValue };
  }
  // Grabbed from the pool: the card pops in its new column for a moment
  if (fromMember === "Up for grabs" && toMember !== "Up for grabs") {
    tasksJustGrabbed = { id: task.id, member: toMember, until: Date.now() + 1500 };
    if (window.QuickGrabs) window.QuickGrabs.afterGrab(toMember);
  }
  saveTaskAssignment(task, payload);

  const where = displayMemberName(toMember);
  const quick = !!(window.QuickGrabs && window.QuickGrabs.isQuickGrab(task));
  // "⚡ Ava grabbed Litter trays · +1 point when it's ticked"
  const isMoney = (window.boardSettings || {}).gameMode === "money";
  const worth = isMoney
    ? `+${(window.boardSettings || {}).currency || "£"}${taskReward(task, true).toFixed(2)}`
    : `+${taskPoints(task)} point${taskPoints(task) === 1 ? "" : "s"}`;
  const text = fromMember === "Up for grabs" && toMember !== "Up for grabs"
    ? `⚡ ${where} grabbed ${task.title}${anyDay ? " for this week" : ""} · ${worth} when it's ticked`
    : (toMember === "Up for grabs" ? `${task.title} is back in ${quick ? "Quick grabs" : BIG_JOBS_LABEL}` : `${task.title} moved to ${where}`);
  showTaskMoveToast(text, () => {
    Object.assign(task, before);
    saveTaskAssignment(task, before);
  });
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.moveTaskBetween = moveTaskBetween;

function saveTaskAssignment(task, payload) {
  saveLocalCache(window.currentTasks || []);
  if (db) {
    try {
      updateDoc(getTaskDocRef(task.id), payload).catch(console.error);
    } catch (err) {
      console.error("Failed to save chore move:", err);
    }
  }
  renderSkylightTasksPage();
}

// Kept for anything that still calls it: claiming from Up for grabs
function claimGrabTask(taskId, day, member) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const want = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(day);
  const date = new Date(today);
  if (want !== -1) date.setDate(today.getDate() - ((today.getDay() + 6) % 7) + ((want + 6) % 7));
  moveTaskBetween(taskId, getLocalDateKey(date), "Up for grabs", member);
}
window.claimGrabTask = claimGrabTask;

// "Make the Family Dinner moved to Dara · Undo" along the bottom, 8 seconds
let taskMoveToastTimer = null;
function showTaskMoveToast(text, onUndo) {
  let toast = document.getElementById("task-move-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "task-move-toast";
    toast.className = "task-move-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  // Inside an open panel (e.g. Hand out), so Undo isn't under its dimmed backdrop
  const openPanels = [...document.querySelectorAll("dialog[open]")];
  const host = openPanels.length ? openPanels[openPanels.length - 1] : document.body;
  if (toast.parentNode !== host) host.appendChild(toast);
  toast.innerHTML = `<span>${escapeHtml(text)}</span><button type="button" class="task-move-undo">Undo</button>`;
  toast.classList.add("is-visible");
  toast.querySelector(".task-move-undo").onclick = () => {
    toast.classList.remove("is-visible");
    clearTimeout(taskMoveToastTimer);
    onUndo();
  };
  clearTimeout(taskMoveToastTimer);
  taskMoveToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 8000);
}

// --- Task Completion with Sound & Full Celebration Trigger ---
function handleCompleteTaskWithCelebration(taskId, targetDay, memberCompleter = null, dateStr = null) {
  const task = (window.currentTasks || []).find(t => t.id === taskId);
  if (!task) return;

  // The week this tick belongs to (the card's date, else this week). The
  // weekly reset keeps only this week's ticks, so every tick must say its week.
  let tickDate = new Date();
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    tickDate = new Date(y, m - 1, d);
  }
  const tickWeek = getIsoWeekKey(tickDate);

  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const assignedList = getAssignedMembersList(task.assignedTo);
  const isMultiAssign = assignedList.length > 1;
  const completer = memberCompleter || (assignedList.length > 0 ? assignedList[0] : (task.assignedTo || "Family"));
  const completerLower = completer.toLowerCase();

  // That day's tick as it was before this one (to save only what's new)
  const priorDayRec = isDaily && task.completedDays ? task.completedDays[targetDay] || null : null;
  if (isDaily) {
    if (!task.completedDays) task.completedDays = {};
    const existing = task.completedDays[targetDay];
    if (isMultiAssign) {
      let currentList = [];
      if (existing) {
        currentList = Array.isArray(existing.completedBy) ? [...existing.completedBy] : (typeof existing.completedBy === "string" ? existing.completedBy.split(",").map(s => s.trim()) : []);
      }
      if (!currentList.some(m => m.toLowerCase() === completerLower)) {
        currentList.push(completer);
      }
      task.completedDays[targetDay] = {
        completedBy: currentList,
        completedAt: new Date().toISOString(),
        completedWeek: tickWeek
      };
    } else {
      task.completedDays[targetDay] = {
        completedBy: completer,
        completedAt: new Date().toISOString(),
        completedWeek: tickWeek
      };
    }
  } else {
    if (isMultiAssign) {
      let currentList = Array.isArray(task.completedBy) ? [...task.completedBy] : (typeof task.completedBy === "string" ? task.completedBy.split(",").map(s => s.trim()) : []);
      if (!currentList.some(m => m.toLowerCase() === completerLower)) {
        currentList.push(completer);
      }
      task.completedBy = currentList;
      task.done = assignedList.every(m => currentList.some(c => c.toLowerCase() === m));
      task.completedAt = new Date().toISOString();
      task.completedWeek = tickWeek;
    } else {
      task.done = true;
      task.completedBy = completer;
      task.completedAt = new Date().toISOString();
      task.completedWeek = tickWeek;
    }
  }

  saveLocalCache(window.currentTasks || []);
  if (db) {
    try {
      // Only this tick, so two tablets ticking at once both keep theirs:
      // a daily chore writes just that day; a shared chore adds this person
      // to the list of who did it rather than replacing the list
      const FP = window.FieldPath;
      const args = [];
      const field = (...path) => (FP ? new FP(...path) : path.join("."));
      if (isDaily) {
        const rec = task.completedDays[targetDay];
        if (isMultiAssign && window.arrayUnion && (!priorDayRec || Array.isArray(priorDayRec.completedBy))) {
          args.push(field("completedDays", targetDay, "completedBy"), window.arrayUnion(completer),
            field("completedDays", targetDay, "completedAt"), rec.completedAt,
            field("completedDays", targetDay, "completedWeek"), rec.completedWeek);
        } else {
          args.push(field("completedDays", targetDay), rec);
        }
      } else {
        const multiList = isMultiAssign && Array.isArray(task.completedBy) && window.arrayUnion;
        args.push(field("done"), task.done,
          field("completedBy"), multiList ? window.arrayUnion(completer) : task.completedBy,
          field("completedAt"), task.completedAt,
          field("completedWeek"), tickWeek);
      }
      updateDoc(getTaskDocRef(taskId), ...args).catch(err => console.warn("Couldn't save the tick:", err));
    } catch (err) {}
  }

  // Play crisp completion chime
  if (typeof sfx !== "undefined" && sfx && sfx.playTaskDone) sfx.playTaskDone();
  if (typeof window.celebrateFirst === "function") window.celebrateFirst("tick");

  renderSkylightTasksPage();

  // Confetti and "+7 points" with this week's leaderboard; or, if that
  // finished their day, their buddy (js/tick-cheer.js, js/buddies.js)
  if (window.TickCheer) window.TickCheer.afterTick(completer, task, tickDate);
  else if (window.Buddies) window.Buddies.checkFinished(completer, tickDate);

  // Check if ALL tasks for today are now completed!
  checkAllTasksCompletedCelebration();
}
window.handleCompleteTaskWithCelebration = handleCompleteTaskWithCelebration;

function checkAllTasksCompletedCelebration() {
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekDays[tasksSelectedDate.getDay()];
  const selectedDateStr = getLocalDateKey(tasksSelectedDate);

  let total = 0;
  let done = 0;

  (window.currentTasks || []).forEach(task => {
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    let forToday = false;
    if (isDaily) forToday = true;
    else if (task.date) forToday = (task.date === selectedDateStr);
    else if (task.day === dayName) forToday = true;

    if (forToday) {
      total++;
      if (isDaily) {
        if (task.completedDays && task.completedDays[dayName]) done++;
      } else {
        if (task.done) done++;
      }
    }
  });

  if (total > 0 && done === total) {
    // Trigger celebration overlay! (after a buddy's turn, if one is showing)
    if (window.Buddies) window.Buddies.whenClosed(showSkylightCelebration);
    else showSkylightCelebration();
  }
}

function showSkylightCelebration() {
  const overlay = document.getElementById("skylight-celebration-overlay");
  if (overlay) overlay.style.display = "flex";

  if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  const dismissBtn = document.getElementById("btn-celebration-dismiss");
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      if (overlay) overlay.style.display = "none";
    };
  }
}
window.showSkylightCelebration = showSkylightCelebration;

// ============================================================================
// 16. SKYLIGHT TASK QUICK ACTION MODAL (Card Click)
// ============================================================================
let currentQuickTaskId = null;
let currentQuickTaskDay = null;

function openSkylightTaskQuickModal(taskId, targetDay, colMember = null, dateStr = null) {
  const task = (window.currentTasks || []).find(t => t.id === taskId);
  if (!task) return;
  const overlay = document.getElementById("skylight-task-quick-modal");
  if (!overlay) return;

  currentQuickTaskId = taskId;
  currentQuickTaskDay = targetDay;

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";

  // Which date this card is for: given by the Tasks page, else this week's
  // occurrence of targetDay
  let cardDate;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    cardDate = new Date(y, m - 1, d);
  } else {
    cardDate = new Date(); cardDate.setHours(0, 0, 0, 0);
    const want = DAYS.indexOf(targetDay);
    if (want !== -1) cardDate.setDate(cardDate.getDate() - ((cardDate.getDay() + 6) % 7) + ((want + 6) % 7));
  }
  const dayName = DAYS[cardDate.getDay()];
  const weekKey = getIsoWeekKey(cardDate);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isFuture = cardDate.getTime() > todayStart.getTime();
  const isToday = cardDate.getTime() === todayStart.getTime();
  const mLower = colMember ? colMember.toLowerCase() : null;
  const isDone = isTaskDoneOnDate(task, cardDate, mLower);

  // Who's on it that day
  const pools = ["up for grabs", "anyone", "family"];
  const assigneeValue = isDaily ? getEffectiveAssignee(task, dayName, weekKey) : task.assignedTo;
  const people = getAssigneeNames(assigneeValue).filter(n => !pools.includes(n.toLowerCase()));
  const shown = (mLower && people.length > 1) ? people.filter(n => n.toLowerCase() === mLower) : people;
  const grabPal = { primary: "#ef4444" };

  // Title, colour square and "Friday 6 November · Evening"
  document.getElementById("quick-card-title").textContent = task.title;
  const swatch = document.getElementById("quick-card-swatch");
  if (swatch) swatch.style.background = shown.length ? getMemberPalette(shown[0]).primary : grabPal.primary;
  const slotLabel = isDaily ? ({ morning: "Morning", afternoon: "Afternoon", evening: "Evening", anytime: "Anytime" }[task.routineSlot] || getTaskRoutineInfo(task).label.replace(/^\S+\s/, "") || "Anytime") : "";
  // A one-off chore set for a weekday shows that day, in the week being viewed
  let whenDate = cardDate;
  if (!isDaily && DAYS.includes(task.day) && task.day !== dayName) {
    whenDate = new Date(cardDate);
    whenDate.setDate(whenDate.getDate() - ((whenDate.getDay() + 6) % 7) + ((DAYS.indexOf(task.day) + 6) % 7));
  }
  const whenIsToday = whenDate.getTime() === todayStart.getTime();
  const whenParts = [`${whenIsToday ? "Today, " : ""}${DAYS[whenDate.getDay()]} ${whenDate.getDate()} ${MONTHS[whenDate.getMonth()]}`];
  if (task.time && /^\d{1,2}:\d{2}/.test(task.time)) whenParts.push(task.time.slice(0, 5));
  else if (slotLabel) whenParts.push(slotLabel);
  document.getElementById("quick-card-datetime").textContent = whenParts.join(" · ");

  // Who
  const assigneeEl = document.getElementById("quick-card-assignee");
  if (assigneeEl) {
    if (!shown.length) {
      assigneeEl.innerHTML = `<span class="task-pop-avatar" style="background:${grabPal.primary}">⚡</span><span>${GRAB_LABEL}</span>`;
    } else {
      const avatars = shown.map(n => `<span class="task-pop-avatar" style="background:${getMemberPalette(n).primary}">${escapeHtml(n.charAt(0).toUpperCase())}</span>`).join("");
      assigneeEl.innerHTML = `<span class="task-pop-avatars">${avatars}</span><span>${escapeHtml(formatAssigneeNames(shown))}</span>`;
    }
  }

  // How often
  let repeatText;
  if (isDaily) repeatText = (task.assignedDays && Object.keys(task.assignedDays).length) ? "Every day, on a rota" : "Every day";
  else if (task.repeat === "weekly" && DAYS.includes(task.day)) repeatText = `Every ${task.day}`;
  else if (task.date) repeatText = "Just this once";
  else if (DAYS.includes(task.day)) repeatText = `Once, on ${task.day}`;
  else repeatText = "Once, any day this week";
  document.getElementById("quick-card-repeat").textContent = repeatText;

  // Chore or routine
  document.getElementById("quick-card-kind").textContent = isPersonalRoutine(task)
    ? "Routine · everyone does their own"
    : "Chore · anyone can take it over";

  // Points
  const isMoney = (window.boardSettings || {}).gameMode === "money";
  const curr = (window.boardSettings || {}).currency || "£";
  const pts = taskPoints(task);
  document.getElementById("quick-card-reward").textContent = isMoney ? `${curr}${(pts / 10).toFixed(2)}` : `${pts} point${pts === 1 ? "" : "s"}`;

  // Done by
  const doneRow = document.getElementById("quick-card-done-row");
  if (doneRow) {
    let by = null;
    if (isDone) {
      const rec = isDaily ? (task.completedDays || {})[dayName] : null;
      const raw = isDaily ? (rec && typeof rec === "object" ? rec.completedBy : rec) : task.completedBy;
      by = getAssigneeNames(raw).map(n => normalizeFamilyMemberName ? normalizeFamilyMemberName(n) : n);
    }
    doneRow.style.display = isDone ? "" : "none";
    document.getElementById("quick-card-done-text").textContent = isDone ? (by && by.length ? `Done by ${formatAssigneeNames(by)}` : "Done") : "";
  }

  // The one action, or a hint when it doesn't apply
  const compBtn = document.getElementById("btn-quick-card-complete");
  const hint = document.getElementById("quick-card-hint");
  const isGrabPool = colMember === "Up for grabs" || (!colMember && !shown.length);
  let hintText = "";
  if (isGrabPool && !isDone) hintText = `Tap ${BIG_JOBS_LABEL}, at the top, to give it to someone.`;
  else if (isFuture) hintText = "You can tick this off on the day.";
  compBtn.style.display = hintText ? "none" : "";
  hint.textContent = hintText;
  hint.style.display = hintText ? "" : "none";
  const QG = window.QuickGrabs;
  const pastDay = cardDate.getTime() < todayStart.getTime();
  // A quick grab nobody has yet: who's grabbing it? (the same as dragging it to them)
  if (isGrabPool && !isDone && !pastDay && QG && QG.isQuickGrab(task)) {
    hint.innerHTML = `<span class="quick-pick-title">Who's grabbing it?</span><span class="quick-pick-people">${(window.familyMembers || []).map(n =>
      `<button type="button" class="quick-pick-person" data-quick-pick="${escapeHtml(n)}" style="--who:${getMemberPalette(n).primary}"><span class="quick-pick-avatar" aria-hidden="true">${escapeHtml(n.charAt(0).toUpperCase())}</span>${escapeHtml(displayMemberName(n))}</button>`).join("")}</span>`;
    hint.style.display = "";
    hint.querySelectorAll("[data-quick-pick]").forEach(b => {
      b.onclick = () => { close(); moveTaskBetween(taskId, getLocalDateKey(cardDate), "Up for grabs", b.getAttribute("data-quick-pick")); };
    });
  }
  // Grabbed for today: hand it back to the tray
  if (!isGrabPool && !isDone && colMember && QG && QG.isGrabbedOn(task, cardDate)) {
    hint.innerHTML = `<button type="button" class="quick-give-back" data-quick-give-back>↩ Give it back to Quick grabs</button>`;
    hint.style.display = "";
    hint.querySelector("[data-quick-give-back]").onclick = () => { close(); moveTaskBetween(taskId, getLocalDateKey(cardDate), colMember, "Up for grabs"); };
  }
  compBtn.textContent = isDone ? "Mark as not done" : "Mark as complete";
  compBtn.classList.toggle("is-undo", isDone);

  const close = () => {
    overlay.style.display = "none";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  compBtn.onclick = () => {
    close();
    if (colMember) markTasksToggle(taskId, colMember, findTasksCard(taskId, colMember));
    if (isDone) handleUndoTask(taskId, targetDay, null, colMember);
    else handleCompleteTaskWithCelebration(taskId, targetDay, colMember, getLocalDateKey(cardDate));
  };
  document.getElementById("btn-quick-card-close").onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById("btn-quick-card-edit").onclick = () => { close(); openSkylightTaskDrawer(taskId); };
  document.getElementById("btn-quick-card-delete").onclick = () => { close(); openDeleteTaskModal(taskId); };

  overlay.style.display = "flex";
  setTimeout(() => { try { document.getElementById("btn-quick-card-close").focus({ preventScroll: true }); } catch (e) {} }, 50);
}
window.openSkylightTaskQuickModal = openSkylightTaskQuickModal;

// ============================================================================
// 17. SKYLIGHT RIGHT-SIDE SLIDE-IN DRAWER (Add / Edit Task)
// ============================================================================
let drawerCurrentType = "chore"; // "chore" (swappable) or "routine" (personal)
let drawerSchedule = "once";      // "once", "weekly" or "daily"
let drawerWeeklyAnyDay = false;   // every week, on any day (not one weekday)
let drawerSelectedProfiles = ["Steven"];
let drawerSelectedDate = new Date();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function drawerDateForNew() {
  const today = startOfDay(new Date());
  const viewed = startOfDay(tasksSelectedDate || today);
  return viewed < today ? today : viewed;
}
function drawerDateForTask(task) {
  const today = startOfDay(new Date());
  if (task && task.date) {
    if (typeof isOverdueOn === "function" && isOverdueOn(task, new Date())) return today;
    const [y, m, d] = String(task.date).split("-").map(Number);
    const own = new Date(y, m - 1, d);
    return isNaN(own) ? today : own;
  }
  // No date (weekly, or "this week"): its weekday in the week being looked at
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const idx = task ? days.indexOf(task.day) : -1;
  if (idx < 0) return drawerDateForNew();
  const base = startOfDay(tasksSelectedDate || today);
  const out = new Date(base); out.setDate(base.getDate() - base.getDay() + idx);
  return out;
}
let drawerRoutineFreq = 1;
let drawerRoutineFreqUnit = "day";
let drawerRoutineSlot = "morning";
let drawerRewardValue = 10;
let drawerSelectedEmoji = "🪴";

// Rota: a different person on different days (stored as task.assignedDays,
// the same field the calendar and Up for grabs claims use). null = Up for grabs.
const ROTA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let drawerRotaEnabled = false;
let drawerRota = {};
let drawerTaskHadRota = false;

// Emojis for chores and routines, grouped by the kind of job. Kept to emojis
// that every tablet from the last few years can show.
const TASK_EMOJI_GROUPS = [
  // First, because these are what routines are made of. Some also appear in
  // their own group further down.
  { name: "Daily routines", items: [["🛏️","Make your bed"],["🪥","Brush teeth"],["👕","Get dressed"],["🪟","Open the curtains"],["🥣","Breakfast"],["🎒","Get your bag ready"],["🧸","Tidy your room"],["🧺","Clothes in the wash"],["⏰","Wake up"],["🛀","Bath time"],["📚","Reading"],["😴","Bedtime"]] },
  { name: "Cleaning", items: [["🧹","Sweep"],["🧽","Scrub"],["🧼","Soap"],["🪣","Mop"],["🧴","Spray"],["🫧","Bubbles"],["🪟","Windows"],["🛁","Bath"],["🚿","Shower"],["🚽","Toilet"],["🧻","Toilet roll"],["🗑️","Bins"],["♻️","Recycling"],["✨","Tidy up"]] },
  { name: "Kitchen & meals", items: [["🍽️","Dishes"],["🍴","Set the table"],["🍳","Cook"],["🥣","Breakfast"],["🥪","Packed lunch"],["🍱","Lunchbox"],["🥗","Salad"],["🍲","Dinner"],["☕","Tea or coffee"],["🥛","Milk"],["🛒","Shopping"],["🥕","Veg"],["🍎","Fruit"],["🧊","Fridge"]] },
  { name: "Laundry & bedroom", items: [["🧺","Laundry"],["👕","Clothes"],["👖","Trousers"],["🧦","Socks"],["👟","Shoes"],["🧥","Coat"],["👔","Ironing"],["🛏️","Make the bed"],["🧸","Toys"],["🎒","School bag"],["🪞","Mirror"],["🧷","Mending"]] },
  { name: "DIY & repairs", items: [["🔨","Hammer"],["🪛","Screwdriver"],["🔧","Spanner"],["🪚","Saw"],["🧰","Toolbox"],["🪜","Ladder"],["🖌️","Paint"],["🎨","Decorate"],["🛠️","Building"],["📏","Measure"],["💡","Light bulb"],["🔌","Plug"],["🔋","Batteries"],["🪝","Hook"],["🔩","Nuts and bolts"],["🚪","Door"]] },
  { name: "Garden & outside", items: [["🌱","Plant"],["🪴","Pot plant"],["🌻","Flowers"],["🌳","Tree"],["🌿","Weeding"],["🍂","Leaves"],["💧","Water"],["🏡","House"],["🚗","Car"],["🚲","Bike"],["📬","Post"],["📦","Parcel"],["❄️","Snow"],["☔","Rain"]] },
  { name: "Pets", items: [["🐶","Dog"],["🐱","Cat"],["🐟","Fish"],["🐰","Rabbit"],["🐹","Hamster"],["🐦","Bird"],["🐢","Tortoise"],["🦮","Walk the dog"],["🦴","Feed"],["🐾","Pet care"]] },
  { name: "Getting ready & health", items: [["🪥","Brush teeth"],["🛀","Bath time"],["💇","Hair"],["😴","Bedtime"],["⏰","Wake up"],["☀️","Morning"],["🌙","Evening"],["💊","Medicine"],["💪","Exercise"],["🧘","Calm time"],["🚰","Drink water"],["🩺","Doctor"]] },
  { name: "School & learning", items: [["📚","Homework"],["📖","Reading"],["✏️","Writing"],["📝","Notes"],["🧮","Maths"],["💻","Computer"],["🔬","Science"],["🌍","Geography"],["🎓","Study"],["🗣️","Practise"]] },
  { name: "Activities & clubs", items: [["⚽","Football"],["🏀","Basketball"],["🎾","Tennis"],["🏊","Swimming"],["🥋","Martial arts"],["🩰","Dance"],["🏃","Running"],["🎹","Piano"],["🎸","Guitar"],["🎤","Singing"],["🧩","Puzzle"],["🎮","Games"],["📵","Screen-free"]] },
  { name: "Errands & money", items: [["🛍️","Shopping bags"],["💰","Money"],["🪙","Pocket money"],["🧾","Bills"],["✉️","Letter"],["📞","Phone call"],["🗓️","Plan"],["🔑","Keys"],["🚌","Bus"],["🏦","Bank"]] },
  { name: "Other", items: [["⭐","Star"],["✅","Done"],["❤️","Kindness"],["🎁","Gift"],["🎉","Party"],["📌","Reminder"],["🙏","Thank you"],["👍","Good job"]] }
];

function renderDrawerRota() {
  const toggle = document.getElementById("drawer-toggle-rota");
  const wrap = document.getElementById("drawer-rota-days");
  const sub = document.getElementById("drawer-rota-sub");
  if (!toggle || !wrap) return;
  toggle.checked = drawerRotaEnabled;
  wrap.style.display = drawerRotaEnabled ? "" : "none";
  if (sub) sub.textContent = drawerRotaEnabled ? "Pick who does it each day" : "Same people every day";
  updateDrawerWhoSummary();
  if (!drawerRotaEnabled) { wrap.innerHTML = ""; return; }

  const people = [...(window.familyMembers || []), null];
  // Two letters where initials clash (Steven / Sorcha -> St / So)
  const members = window.familyMembers || [];
  const badge = (p) => {
    const first = p.charAt(0).toUpperCase();
    const clash = members.filter(m => m.charAt(0).toUpperCase() === first).length > 1;
    if (!clash) return first;
    const digit = p.match(/\d+$/);
    return digit ? first + digit[0] : first + p.charAt(1).toLowerCase();
  };
  const tick = `<span class="drawer-rota-tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
  wrap.innerHTML = ROTA_DAYS.map(day => {
    const chosen = Array.isArray(drawerRota[day]) ? drawerRota[day] : [];
    const pills = people.map(p => {
      const on = p === null ? !chosen.length : chosen.includes(p);
      const pal = p ? getMemberPalette(p) : { primary: "#ef4444" };
      const label = p ? p : GRAB_LABEL;
      return `<button type="button" class="drawer-rota-pill ${on ? "is-selected" : ""}" data-rota-day="${day}" data-rota-person="${p ? escapeHtml(p) : ""}" aria-pressed="${on}" aria-label="${escapeHtml(label)} on ${day}" title="${escapeHtml(label)}" style="--rota-color: ${pal.primary};">${p ? escapeHtml(badge(p)) : "⚡"}${tick}</button>`;
    }).join("");
    const who = chosen.length
      ? chosen.map(p => `<span class="drawer-rota-chip" style="--rota-color: ${getMemberPalette(p).primary};"><span class="drawer-rota-chip-dot"></span>${escapeHtml(p)}</span>`).join("")
      : `<span class="drawer-rota-chip is-grab"><span aria-hidden="true">⚡</span>${GRAB_LABEL}</span>`;
    return `<div class="drawer-rota-row${chosen.length ? "" : " is-grab"}"><span class="drawer-rota-day">${day.slice(0, 3)}</span><div class="drawer-rota-who">${who}</div><div class="drawer-rota-pills" role="group" aria-label="Who's on ${day}">${pills}</div></div>`;
  }).join("");
}

function wireDrawerRota() {
  const toggle = document.getElementById("drawer-toggle-rota");
  const wrap = document.getElementById("drawer-rota-days");
  if (!toggle || !wrap || toggle.hasAttribute("data-wired")) return;
  toggle.setAttribute("data-wired", "true");
  toggle.addEventListener("change", () => {
    drawerRotaEnabled = toggle.checked;
    if (drawerRotaEnabled) {
      // Every day starts as Up for grabs; tap people to put them on it
      ROTA_DAYS.forEach(d => { if (!Array.isArray(drawerRota[d])) drawerRota[d] = []; });
    }
    renderDrawerRota();
  });
  wrap.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-rota-day]");
    if (!pill) return;
    const day = pill.getAttribute("data-rota-day");
    const person = pill.getAttribute("data-rota-person");
    const current = Array.isArray(drawerRota[day]) ? drawerRota[day] : [];
    if (!person) drawerRota[day] = []; // Up for grabs clears the day
    else drawerRota[day] = current.includes(person) ? current.filter(p => p !== person) : [...current, person];
    renderDrawerRota();
  });
}

// prefill (new tasks only, e.g. from voice): { title, people: [names], date, daily, slot, weekly }
function openSkylightTaskDrawer(taskId = null, prefill = null) {
  const overlay = document.getElementById("skylight-task-drawer-overlay");
  if (!overlay) return;

  const headingEl = document.getElementById("task-drawer-heading");
  const submitBtn = document.getElementById("btn-drawer-submit");
  const idInput = document.getElementById("drawer-task-id");
  const titleInput = document.getElementById("drawer-task-title");

  if (taskId) {
    const task = (window.currentTasks || []).find(t => t.id === taskId);
    if (!task) return;
    headingEl.textContent = "Edit Task";
    submitBtn.textContent = "Save";
    idInput.value = task.id;
    titleInput.value = task.title || "";
    drawerSelectedEmoji = task.icon || "🪴";
    if (Array.isArray(task.assignedTo)) {
      drawerSelectedProfiles = [...task.assignedTo];
    } else if (task.assignedTo && typeof task.assignedTo === "string") {
      drawerSelectedProfiles = task.assignedTo.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      drawerSelectedProfiles = ["Up for grabs"];
    }
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    drawerCurrentType = isPersonalRoutine(task) ? "routine" : "chore";
    drawerSchedule = isDaily ? "daily" : (task.repeat === "weekly" ? "weekly" : "once");
    drawerWeeklyAnyDay = isAnyDayWeekly(task);
    // The chore's own day (the panel used to keep whatever date it last had,
    // so saving could move a chore). Overdue: today, so saving moves it here.
    drawerSelectedDate = drawerDateForTask(task);
    // Once: weekly repeat and time
    const repeatToggle = document.getElementById("drawer-toggle-repeat");
    const repeatSelect = document.getElementById("drawer-chore-repeat-select");
    if (repeatToggle) repeatToggle.checked = task.repeat === "weekly";
    if (repeatSelect) repeatSelect.value = task.repeat === "weekly" ? "weekly" : "none";
    const timeToggle = document.getElementById("drawer-toggle-time");
    const timeInput = document.getElementById("drawer-chore-time-input");
    if (timeToggle) timeToggle.checked = !isDaily && !!task.time && /^\d{1,2}:\d{2}/.test(task.time);
    if (timeInput && timeToggle && timeToggle.checked) timeInput.value = task.time.slice(0, 5);
    drawerRewardValue = Math.min(10, taskPoints(task));
    { const imp = document.getElementById("drawer-toggle-important"); if (imp) imp.checked = !!task.isPriority; }
    { const big = document.getElementById("drawer-toggle-big-job"); if (big) { big.checked = task.grabSize === "big"; big.onchange = updateDrawerWhoSummary; } }
    // Same rule as the board: no time of day set (or in the title) = Anytime
    if (task.routineSlot) {
      drawerRoutineSlot = task.routineSlot;
    } else {
      const lbl = getTaskRoutineInfo(task).label;
      drawerRoutineSlot = lbl.includes("Morning") ? "morning" : (lbl.includes("Afternoon") ? "afternoon" : (lbl.includes("Evening") ? "evening" : "anytime"));
    }
  } else {
    headingEl.textContent = "Add Task";
    submitBtn.textContent = "Add";
    idInput.value = "";
    titleInput.value = "";
    drawerSelectedEmoji = "🪴";
    drawerSelectedProfiles = [((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) && (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"])[0]) || "Steven"];
    drawerCurrentType = "chore";
    drawerSchedule = "once";
    drawerWeeklyAnyDay = false;
    // New: the day being looked at on the Tasks page (today if that's past)
    drawerSelectedDate = drawerDateForNew();
    const repeatToggle = document.getElementById("drawer-toggle-repeat");
    if (repeatToggle) repeatToggle.checked = false;
    const timeToggle = document.getElementById("drawer-toggle-time");
    if (timeToggle) timeToggle.checked = false;
    drawerRewardValue = 1;
    drawerRoutineSlot = "morning";
    { const imp = document.getElementById("drawer-toggle-important"); if (imp) imp.checked = false; }
    { const big = document.getElementById("drawer-toggle-big-job"); if (big) { big.checked = false; big.onchange = updateDrawerWhoSummary; } }
    if (prefill) {
      if (prefill.title) {
        titleInput.value = prefill.title;
        const guess = typeof detectEmojiForChore === "function" ? detectEmojiForChore(prefill.title) : null;
        if (guess) drawerSelectedEmoji = guess;
      }
      if (Array.isArray(prefill.people) && prefill.people.length) drawerSelectedProfiles = [...prefill.people];
      if (prefill.date instanceof Date && !isNaN(prefill.date)) drawerSelectedDate = new Date(prefill.date);
      if (prefill.daily) { drawerSchedule = "daily"; drawerCurrentType = "routine"; drawerRoutineSlot = prefill.slot || "anytime"; }
      else if (prefill.weekly) drawerSchedule = "weekly";
    }
  }

  // Rota (different person each day)
  const rotaTask = taskId ? (window.currentTasks || []).find(t => t.id === taskId) : null;
  const rotaSource = rotaTask && rotaTask.assignedDays && typeof rotaTask.assignedDays === "object" ? rotaTask.assignedDays : null;
  drawerTaskHadRota = !!(rotaSource && Object.keys(rotaSource).length);
  drawerRotaEnabled = drawerTaskHadRota;
  drawerRota = {};
  if (drawerRotaEnabled) {
    const pools = ["up for grabs", "anyone", "family"];
    ROTA_DAYS.forEach(d => {
      drawerRota[d] = getAssigneeNames(rotaSource[d]).filter(n => !pools.includes(n.toLowerCase()));
    });
  }
  wireDrawerRota();
  renderDrawerRota();

  // Sync Emoji preview
  document.getElementById("drawer-emoji-preview").textContent = drawerSelectedEmoji;
  document.getElementById("drawer-emoji-grid").style.display = "none";

  // Sync Profiles pills
  renderDrawerProfilesRow();

  // Sync Frequency UI
  const freqNum = document.getElementById("drawer-routine-freq-num");
  if (freqNum) freqNum.textContent = drawerRoutineFreq;
  ["day", "week"].forEach(u => {
    const b = document.getElementById(`btn-routine-unit-${u}`);
    if (b) b.classList.toggle("active", u === drawerRoutineFreqUnit);
  });

  // Sync Routine slot UI
  ["morning", "afternoon", "evening", "anytime"].forEach(s => {
    const b = document.getElementById(`btn-routine-slot-${s}`);
    if (b) b.classList.toggle("active", s === drawerRoutineSlot);
  });

  // Sync Type Switcher
  syncDrawerTypeUI();

  // Sync Reward text
  syncDrawerRewardUI();

  // Date label, day pills and time (one place does it)
  syncDrawerTypeUI();

  overlay.style.display = "flex";
  if (typeof window.scrollPanelToTop === "function") window.scrollPanelToTop(overlay);

  // Back button closes
  document.getElementById("btn-task-drawer-back").onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };
}
window.openSkylightTaskDrawer = openSkylightTaskDrawer;

function renderDrawerProfilesRow() {
  const row = document.getElementById("drawer-profiles-row");
  if (!row) return;

  const profiles = [...((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];
  row.innerHTML = profiles.map(p => {
    const isGrab = p === "Up for grabs";
    const pal = isGrab ? { primary: "#ef4444" } : getMemberPalette(p);
    const initial = isGrab ? "⚡" : p.charAt(0).toUpperCase();
    const isActive = drawerSelectedProfiles.some(sp => sp.toLowerCase() === p.toLowerCase());
    return `
      <button type="button" class="drawer-profile-pill ${isActive ? 'active' : ''}" data-profile="${escapeHtml(p)}" aria-pressed="${isActive}" style="--profile-color: ${pal.primary};">
        <span class="drawer-profile-avatar">${escapeHtml(initial)}<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></span>
        <span class="drawer-profile-name">${escapeHtml(displayMemberName(p))}</span>
      </button>
    `;
  }).join("");

  row.querySelectorAll(".drawer-profile-pill").forEach(btn => {
    btn.onclick = () => {
      const p = btn.getAttribute("data-profile");
      if (p === "Up for grabs") {
        drawerSelectedProfiles = ["Up for grabs"];
        // Anyone can take it, so it's a chore (a routine stays with each person)
        if (drawerCurrentType === "routine") { drawerCurrentType = "chore"; syncDrawerTypeUI(); }
      } else {
        drawerSelectedProfiles = drawerSelectedProfiles.filter(sp => sp !== "Up for grabs");
        const idx = drawerSelectedProfiles.findIndex(sp => sp.toLowerCase() === p.toLowerCase());
        if (idx !== -1) {
          // Deselect profile, but leave at least this one if it's the only one
          if (drawerSelectedProfiles.length > 1) {
            drawerSelectedProfiles.splice(idx, 1);
          }
        } else {
          drawerSelectedProfiles.push(p);
        }
      }
      renderDrawerProfilesRow();
    };
  });
  updateDrawerWhoSummary();
}

// One plain line under the people saying who's on it, so it's obvious at a
// glance. With the rota on, the rota decides, so the row steps back.
function updateDrawerWhoSummary() {
  const el = document.getElementById("drawer-who-summary");
  const row = document.getElementById("drawer-profiles-row");
  if (!el) return;
  const rotaOn = drawerRotaEnabled && drawerSchedule === "daily";
  if (row) row.classList.toggle("is-overridden", rotaOn);
  el.classList.toggle("is-grab", false);
  el.classList.toggle("is-quick", false);
  if (rotaOn) {
    el.textContent = "Changes each day. Pick who does it in the rota below.";
    return;
  }
  const people = drawerSelectedProfiles.filter(p => p !== "Up for grabs");
  if (!people.length) {
    el.classList.add("is-grab");
    // Where it'll show, so nobody has to guess
    const big = !!(document.getElementById("drawer-toggle-big-job") || {}).checked;
    const routine = drawerCurrentType === "routine";
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = drawerSelectedDate ? DAYS[drawerSelectedDate.getDay()] : "its day";
    const quick = !big && !routine && (drawerSchedule === "daily" || (drawerSchedule === "weekly" && drawerWeeklyAnyDay));
    el.classList.toggle("is-quick", quick);
    // Anyone plus Routine doesn't fit: say so, rather than quietly "Big jobs"
    if (routine) { el.textContent = "A routine stays with each person, so nobody can grab it. Pick who does it, or choose Chore to make it a quick grab."; return; }
    if (drawerSchedule === "daily" && !big && !routine) el.textContent = "⚡ A quick grab: a pill above the board every day, for anyone to drag into their column.";
    else if (drawerSchedule === "weekly" && drawerWeeklyAnyDay && !big && !routine) el.textContent = "⚡ A quick grab: a pill above the board every day this week until someone does it.";
    else if (drawerSchedule === "daily") el.textContent = `🛠️ In ${BIG_JOBS_LABEL} every day, for anyone to take.`;
    else if (drawerSchedule === "weekly" && drawerWeeklyAnyDay) el.textContent = `🛠️ In ${BIG_JOBS_LABEL} every day this week until someone does it.`;
    else if (drawerSchedule === "weekly") el.textContent = `🛠️ In ${BIG_JOBS_LABEL} every ${day}, for anyone to take.`;
    else el.textContent = `🛠️ In ${BIG_JOBS_LABEL} on ${day}, for anyone to take.`;
  } else if (people.length === 1) {
    el.textContent = `${people[0]} is doing it.`;
  } else {
    el.textContent = `${formatAssigneeNames(people)} are doing it.`;
  }
}

function syncDrawerTypeUI() {
  const btnChore = document.getElementById("btn-drawer-type-chore");
  const btnRoutine = document.getElementById("btn-drawer-type-routine");
  const choreFields = document.getElementById("drawer-chore-fields");
  const routineFields = document.getElementById("drawer-routine-fields");
  const hint = document.getElementById("drawer-type-hint");

  // Chore / Routine: can it be handed to someone else?
  if (btnChore) btnChore.classList.toggle("active", drawerCurrentType === "chore");
  if (btnRoutine) btnRoutine.classList.toggle("active", drawerCurrentType === "routine");
  if (hint) hint.textContent = drawerCurrentType === "routine"
    ? "Something personal everyone does for themselves. It stays with each person."
    : "A household job. Anyone can take it over and get the points.";

  // How often: once (a date), every week (a day of the week) or every day (a time of day)
  document.querySelectorAll("#drawer-schedule-pills [data-schedule]").forEach(b => {
    const on = b.getAttribute("data-schedule") === drawerSchedule;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  updateDrawerWhoSummary();
  const isDailySchedule = drawerSchedule === "daily";
  const isWeeklySchedule = drawerSchedule === "weekly";
  if (choreFields) choreFields.style.display = isDailySchedule ? "none" : "block";
  // Quick grab or bigger job: only a daily household job asks
  const bigRow = document.getElementById("drawer-big-job-row");
  if (bigRow) bigRow.hidden = !((isDailySchedule || (isWeeklySchedule && drawerWeeklyAnyDay)) && drawerCurrentType === "chore");
  updateDrawerWhoSummary();
  if (routineFields) routineFields.style.display = isDailySchedule ? "block" : "none";

  // What the save reads: weekly or not
  const repeatToggle = document.getElementById("drawer-toggle-repeat");
  const repeatSelect = document.getElementById("drawer-chore-repeat-select");
  if (repeatToggle) repeatToggle.checked = isWeeklySchedule;
  if (repeatSelect) repeatSelect.value = isWeeklySchedule ? "weekly" : "none";

  // On: a date (once) or a day of the week (every week)
  const heading = document.getElementById("drawer-chore-day-heading");
  const dateBtn = document.getElementById("drawer-chore-date-btn");
  const weekdays = document.getElementById("drawer-chore-weekdays");
  if (heading) heading.textContent = isWeeklySchedule ? "Every" : "On";
  if (dateBtn) dateBtn.hidden = isWeeklySchedule;
  if (weekdays) weekdays.hidden = !isWeeklySchedule;
  const dateLabel = document.getElementById("drawer-chore-date-label");
  if (dateLabel && drawerSelectedDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(drawerSelectedDate); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    const nice = drawerSelectedDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    dateLabel.textContent = diff === 0 ? `Today · ${nice}` : diff === 1 ? `Tomorrow · ${nice}` : nice;
  }
  if (weekdays && drawerSelectedDate) {
    const wd = String(drawerSelectedDate.getDay());
    weekdays.querySelectorAll("[data-weekday-any]").forEach(b => {
      b.classList.toggle("active", drawerWeeklyAnyDay);
      b.setAttribute("aria-checked", String(drawerWeeklyAnyDay));
    });
    weekdays.querySelectorAll("[data-weekday]").forEach(b => {
      const on = !drawerWeeklyAnyDay && b.getAttribute("data-weekday") === wd;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  // Time: any time, or a set time
  const timeToggle = document.getElementById("drawer-toggle-time");
  const timeField = document.getElementById("drawer-chore-time-field");
  const timed = !!(timeToggle && timeToggle.checked);
  document.querySelectorAll("#drawer-chore-time-pills [data-time-mode]").forEach(b => {
    const on = (b.getAttribute("data-time-mode") === "set") === timed;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  if (timeField) timeField.hidden = !timed;
}

function syncDrawerRewardUI() {
  const isMoney = (window.boardSettings || {}).gameMode === "money";
  const curr = (window.boardSettings || {}).currency || "£";
  document.getElementById("drawer-reward-mode-text").textContent = isMoney ? `Pocket Money (${curr})` : `Reward Points`;
  document.getElementById("drawer-reward-display").textContent = isMoney ? `${curr}${(drawerRewardValue / 10).toFixed(2)}` : `${drawerRewardValue} pts`;
}

// Wire drawer interactions (steppers, accordion, date picker trigger, submit)
function initSkylightTaskDrawerEvents() {
  const btnChore = document.getElementById("btn-drawer-type-chore");
  const btnRoutine = document.getElementById("btn-drawer-type-routine");
  if (btnChore) btnChore.onclick = () => { drawerCurrentType = "chore"; syncDrawerTypeUI(); };
  if (btnRoutine) btnRoutine.onclick = () => {
    drawerCurrentType = "routine";
    // Routines are usually daily: suggest it for a new one
    if (!document.getElementById("drawer-task-id").value) drawerSchedule = "daily";
    syncDrawerTypeUI();
  };
  document.querySelectorAll("#drawer-schedule-pills [data-schedule]").forEach(b => {
    b.onclick = () => { drawerSchedule = b.getAttribute("data-schedule"); syncDrawerTypeUI(); };
  });
  // Every week: tap a day; it starts on the next one from today (never in the past)
  document.querySelectorAll("#drawer-chore-weekdays [data-weekday]").forEach(b => {
    b.onclick = () => {
      const want = Number(b.getAttribute("data-weekday"));
      drawerWeeklyAnyDay = false;
      const next = new Date(); next.setHours(0, 0, 0, 0);
      next.setDate(next.getDate() + ((want - next.getDay() + 7) % 7));
      drawerSelectedDate = next;
      syncDrawerTypeUI();
    };
  });
  // Every week, any day: shows every day until someone does it
  const anyDayBtn = document.querySelector("#drawer-chore-weekdays [data-weekday-any]");
  if (anyDayBtn) anyDayBtn.onclick = () => { drawerWeeklyAnyDay = true; syncDrawerTypeUI(); };
  // Time: any time, or set one (opens the time box)
  document.querySelectorAll("#drawer-chore-time-pills [data-time-mode]").forEach(b => {
    b.onclick = () => {
      const timeToggle = document.getElementById("drawer-toggle-time");
      if (timeToggle) timeToggle.checked = b.getAttribute("data-time-mode") === "set";
      syncDrawerTypeUI();
      if (timeToggle && timeToggle.checked) {
        const input = document.getElementById("drawer-chore-time-input");
        if (input && !(window.isTouchScreen && window.isTouchScreen())) input.focus();
      }
    };
  });

  // Emoji accordion
  const emojiTrigger = document.getElementById("drawer-emoji-trigger");
  const emojiGrid = document.getElementById("drawer-emoji-grid");
  if (emojiTrigger && emojiGrid) {
    emojiGrid.innerHTML = TASK_EMOJI_GROUPS.map(g => `
      <div class="drawer-emoji-group">
        <div class="drawer-emoji-group-title">${escapeHtml(g.name)}</div>
        <div class="drawer-emoji-group-items">${g.items.map(([em, label]) => `<button type="button" class="drawer-emoji-item" data-emoji="${em}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${em}</button>`).join("")}</div>
      </div>`).join("");
    emojiTrigger.onclick = () => {
      const opening = emojiGrid.style.display === "none";
      emojiGrid.style.display = opening ? "block" : "none";
      emojiTrigger.setAttribute("aria-expanded", String(opening));
      if (opening) {
        emojiGrid.querySelectorAll(".drawer-emoji-item").forEach(b => b.classList.toggle("is-selected", b.getAttribute("data-emoji") === drawerSelectedEmoji));
        emojiGrid.scrollTop = 0;
      }
    };
    emojiTrigger.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); emojiTrigger.onclick(); } };
    emojiGrid.querySelectorAll(".drawer-emoji-item").forEach(btn => {
      btn.onclick = () => {
        drawerSelectedEmoji = btn.getAttribute("data-emoji");
        document.getElementById("drawer-emoji-preview").textContent = drawerSelectedEmoji;
        emojiGrid.style.display = "none";
        emojiTrigger.setAttribute("aria-expanded", "false");
      };
    });
  }

  // Routine stepper
  const btnFreqDown = document.getElementById("btn-routine-freq-down");
  const btnFreqUp = document.getElementById("btn-routine-freq-up");
  const freqNum = document.getElementById("drawer-routine-freq-num");
  if (btnFreqDown && btnFreqUp && freqNum) {
    btnFreqDown.onclick = () => {
      drawerRoutineFreq = Math.max(1, drawerRoutineFreq - 1);
      freqNum.textContent = drawerRoutineFreq;
    };
    btnFreqUp.onclick = () => {
      drawerRoutineFreq = Math.min(14, drawerRoutineFreq + 1);
      freqNum.textContent = drawerRoutineFreq;
    };
  }

  // Routine unit segments (Day, Week)
  ["day", "week"].forEach(unit => {
    const btn = document.getElementById(`btn-routine-unit-${unit}`);
    if (btn) {
      btn.onclick = () => {
        drawerRoutineFreqUnit = unit;
        ["day", "week"].forEach(u => {
          const b = document.getElementById(`btn-routine-unit-${u}`);
          if (b) b.classList.toggle("active", u === unit);
        });
      };
    }
  });

  // Routine slot segments (Morning, Afternoon, Evening)
  ["morning", "afternoon", "evening", "anytime"].forEach(slot => {
    const btn = document.getElementById(`btn-routine-slot-${slot}`);
    if (btn) {
      btn.onclick = () => {
        drawerRoutineSlot = slot;
        ["morning", "afternoon", "evening", "anytime"].forEach(s => {
          const b = document.getElementById(`btn-routine-slot-${s}`);
          if (b) b.classList.toggle("active", s === slot);
        });
      };
    }
  });

  // Reward points stepper (1 to 10 points)
  const btnMinus = document.getElementById("btn-drawer-reward-minus");
  const btnPlus = document.getElementById("btn-drawer-reward-plus");
  if (btnMinus && btnPlus) {
    btnMinus.onclick = () => {
      drawerRewardValue = Math.max(1, drawerRewardValue - 1);
      syncDrawerRewardUI();
    };
    btnPlus.onclick = () => {
      drawerRewardValue = Math.min(10, drawerRewardValue + 1);
      syncDrawerRewardUI();
    };
  }

  // Once: the date button opens the date picker
  const choreDateBtn = document.getElementById("drawer-chore-date-btn");
  if (choreDateBtn) choreDateBtn.onclick = () => { openSkylightDatePickerModal(); };

  // Form submit
  const form = document.getElementById("skylight-task-drawer-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById("drawer-task-id").value;
      const title = document.getElementById("drawer-task-title").value.trim();
      if (!title) return;

      const isRoutine = (drawerSchedule === "daily"); // repeats every day at a time of day
      const repeatToggle = document.getElementById("drawer-toggle-repeat");
      const repeatSelect = document.getElementById("drawer-chore-repeat-select");
      const isWeekly = !isRoutine && repeatToggle && repeatToggle.checked && repeatSelect && repeatSelect.value === "weekly";
      const anyDay = isWeekly && drawerWeeklyAnyDay;
      const timeToggle = document.getElementById("drawer-toggle-time");
      const timeInput = document.getElementById("drawer-chore-time-input");
      const choreTime = (!isRoutine && timeToggle && timeToggle.checked && timeInput && timeInput.value) ? timeInput.value : null;
      const dName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][drawerSelectedDate.getDay()];
      const dStr = getLocalDateKey(drawerSelectedDate);

      let effectiveAssigned = null;
      if (drawerSelectedProfiles.length === 1 && drawerSelectedProfiles[0] === "Up for grabs") {
        effectiveAssigned = null;
      } else if (drawerSelectedProfiles.length === 1) {
        effectiveAssigned = drawerSelectedProfiles[0];
      } else if (drawerSelectedProfiles.length > 1) {
        effectiveAssigned = drawerSelectedProfiles; // Array of member names
      }

      const taskData = {
        title,
        icon: drawerSelectedEmoji,
        assignedTo: effectiveAssigned,
        taskType: isRoutine ? "Daily Task" : "Standard",
        day: isRoutine ? "Daily" : (anyDay ? "Anyday" : dName),
        anyDay: anyDay || null,
        date: (isRoutine || isWeekly) ? null : dStr,
        repeat: isRoutine ? "daily" : (isWeekly ? "weekly" : "none"),
        kind: drawerCurrentType, // "routine" stays with each person; "chore" can be swapped
        routineSlot: isRoutine ? drawerRoutineSlot : null,
        value: drawerRewardValue,
        isPriority: !!(document.getElementById("drawer-toggle-important") || {}).checked,
        // A daily job nobody owns: a quick grab pill, or a bigger job in the Grab it panel
        grabSize: (isRoutine || anyDay) && (document.getElementById("drawer-toggle-big-job") || {}).checked ? "big" : null,
        order: isRoutine ? ({ morning: 1, afternoon: 2, evening: 4, anytime: 5 }[drawerRoutineSlot] || 4) : 3
      };
      if (!isRoutine) taskData.time = choreTime; // one-off chores can have a time
      if (isRoutine && drawerRotaEnabled) {
        taskData.assignedDays = {};
        ROTA_DAYS.forEach(d => {
          const who = Array.isArray(drawerRota[d]) ? drawerRota[d] : [];
          taskData.assignedDays[d] = who.length === 0 ? null : (who.length === 1 ? who[0] : who);
        });
      } else if (drawerTaskHadRota) {
        taskData.assignedDays = {}; // rota switched off: same people every day
      }

      if (id) {
        // Edit existing
        const idx = (window.currentTasks || []).findIndex(t => t.id === id);
        if (idx !== -1) {
          (window.currentTasks || [])[idx] = { ...(window.currentTasks || [])[idx], ...taskData };
          saveLocalCache(window.currentTasks || []);
          if (db) {
            try {
              const docRef = getTaskDocRef(id);
              await updateDoc(docRef, taskData);
            } catch (err) {}
          }
        }
      } else {
        // Create new
        const newId = `task-${Date.now()}`;
        const newTask = {
          id: newId,
          ...taskData,
          done: false,
          completedBy: null,
          completedAt: null
        };
        (window.currentTasks || []).push(newTask);
        saveLocalCache(window.currentTasks || []);
        if (typeof window.celebrateFirst === "function") window.celebrateFirst("chore");
        if (db) {
          try {
            const docRef = getTaskDocRef(newId);
            await setDoc(docRef, newTask);
          } catch (err) {}
        }
      }

      document.getElementById("skylight-task-drawer-overlay").style.display = "none";
      if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
      renderSkylightTasksPage();
      if (typeof window.renderApp === "function") window.renderApp();
    };
  }

  // Tasks Day Navigation
  const btnTasksPrev = document.getElementById("btn-tasks-prev-day");
  const btnTasksToday = document.getElementById("btn-tasks-today");
  const btnTasksNext = document.getElementById("btn-tasks-next-day");
  if (btnTasksPrev) {
    btnTasksPrev.onclick = () => {
      tasksSelectedDate.setDate(tasksSelectedDate.getDate() - 1);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }
  if (btnTasksToday) {
    btnTasksToday.onclick = () => {
      tasksSelectedDate = new Date();
      tasksSelectedDate.setHours(0, 0, 0, 0);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }
  if (btnTasksNext) {
    btnTasksNext.onclick = () => {
      tasksSelectedDate.setDate(tasksSelectedDate.getDate() + 1);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }

  // Tasks Filter Dropdown
  const btnTasksFilter = document.getElementById("btn-tasks-filter-dropdown");
  const tasksFilterMenu = document.getElementById("tasks-filter-dropdown-menu");
  if (btnTasksFilter && tasksFilterMenu) {
    btnTasksFilter.onclick = (e) => {
      e.stopPropagation();
      const isOpen = tasksFilterMenu.style.display === "block";
      tasksFilterMenu.style.display = isOpen ? "none" : "block";
      btnTasksFilter.setAttribute("aria-expanded", isOpen ? "false" : "true");
      btnTasksFilter.classList.toggle("is-open", !isOpen);
      if (!isOpen) {
        renderTasksFilterMenu();
        if (typeof window.alignDropdownOnScreen === "function") {
          window.alignDropdownOnScreen(tasksFilterMenu, btnTasksFilter);
        }
      }
    };
  }

  // Floating + FAB on Tasks page -> opens drawer
  const btnTasksFab = document.getElementById("btn-floating-add-task");
  if (btnTasksFab) {
    btnTasksFab.onclick = () => {
      openSkylightTaskDrawer();
    };
  }

  // Swipe navigation on Tasks Board (smooth touch gesture)
  const tasksGrid = document.getElementById("tasks-columns-grid");
  if (tasksGrid && !tasksGrid.hasAttribute("data-gestures-wired")) {
    tasksGrid.setAttribute("data-gestures-wired", "true");
    let tStartX = 0;
    let tStartY = 0;
    let tDiffX = 0;
    let isTracking = false;

    tasksGrid.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      // Phones: a sideways swipe moves between people, not days
      if (isTasksPhone()) { isTracking = false; return; }
      if (e.target.closest("button, .skylight-task-card, .routine-filter-circle-btn")) return;
      tStartX = e.touches[0].clientX;
      tStartY = e.touches[0].clientY;
      tDiffX = 0;
      isTracking = true;
    }, { passive: true });

    tasksGrid.addEventListener("touchmove", (e) => {
      if (!isTracking || e.touches.length !== 1) return;
      tDiffX = e.touches[0].clientX - tStartX;
    }, { passive: true });

    tasksGrid.addEventListener("touchend", () => {
      if (!isTracking) return;
      isTracking = false;
      if (Math.abs(tDiffX) > 60) {
        if (tDiffX < 0) {
          // Swiped left -> next day
          tasksSelectedDate.setDate(tasksSelectedDate.getDate() + 1);
        } else {
          // Swiped right -> previous day
          tasksSelectedDate.setDate(tasksSelectedDate.getDate() - 1);
        }
        renderSkylightTasksPage();
        if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      }
    });
  }
}

// ============================================================================
// PHONES: ONE PERSON AT A TIME
// Five columns don't fit a phone, so (like Skylight's phone app) each person
// gets the full width and a row of tabs at the top shows everyone with their
// tally. Tap a tab, or swipe sideways, to move between people. Tablets keep
// the side-by-side columns.
// ============================================================================
let tasksPhoneShown = null;      // the person whose column is showing
let tasksPhoneTabScrollUntil = 0; // while a tapped tab slides into view
function isTasksPhone() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;
}

// The column that's in view right now (by scroll position)
function tasksPhoneMember(grid) {
  const cols = [...grid.querySelectorAll(".skylight-tasks-col")];
  if (!cols.length || !grid.clientWidth) return null;
  const i = Math.round(grid.scrollLeft / grid.clientWidth);
  const col = cols[Math.max(0, Math.min(cols.length - 1, i))];
  return col ? col.getAttribute("data-col-member") : null;
}

function renderTasksPersonTabs(grid, showMember) {
  let bar = document.getElementById("tasks-person-tabs");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "tasks-person-tabs";
    bar.className = "tasks-person-tabs";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Whose tasks");
    grid.parentNode.insertBefore(bar, grid);
    bar.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-person-tab]");
      if (!tab) return;
      const col = [...grid.querySelectorAll(".skylight-tasks-col")].find(c => c.getAttribute("data-col-member") === tab.getAttribute("data-person-tab"));
      if (!col) return;
      tasksPhoneShown = tab.getAttribute("data-person-tab");
      tasksPhoneTabScrollUntil = Date.now() + 700;
      grid.scrollTo({ left: col.offsetLeft - grid.offsetLeft, behavior: tasksReducedMotion() ? "auto" : "smooth" });
      markTasksPersonTab(tasksPhoneShown);
    });
    let raf = 0;
    grid.addEventListener("scroll", () => {
      if (raf || !isTasksPhone()) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (Date.now() < tasksPhoneTabScrollUntil) return; // passing other people on the way
        tasksPhoneShown = tasksPhoneMember(grid);
        markTasksPersonTab(tasksPhoneShown);
      });
    }, { passive: true });
  }
  const cols = [...grid.querySelectorAll(".skylight-tasks-col")];
  bar.innerHTML = cols.map(col => {
    const m = col.getAttribute("data-col-member");
    const avatar = col.querySelector(".tasks-col-avatar");
    const tally = col.querySelector(".tasks-col-progress-tally");
    const done = tally && tally.classList.contains("all-done");
    return `<button type="button" class="tasks-person-tab${done ? " is-done" : ""}" role="tab" data-person-tab="${escapeHtml(m)}" style="--tab-color: ${avatar ? avatar.style.background : "#94a3b8"};">
      <span class="tasks-person-tab-avatar">${avatar ? avatar.innerHTML : ""}</span>
      <span class="tasks-person-tab-name">${escapeHtml(displayMemberName(m))}</span>
      <span class="tasks-person-tab-tally">${tally ? escapeHtml(tally.textContent.trim()) : ""}</span>
    </button>`;
  }).join("");
  if (!isTasksPhone()) return;
  // Stay on the same person after a redraw
  const target = cols.find(c => c.getAttribute("data-col-member") === showMember) || cols[0];
  if (target) grid.scrollLeft = target.offsetLeft - grid.offsetLeft;
  tasksPhoneShown = target ? target.getAttribute("data-col-member") : null;
  markTasksPersonTab(tasksPhoneShown);
}

function markTasksPersonTab(member) {
  document.querySelectorAll("#tasks-person-tabs .tasks-person-tab").forEach(t => {
    const on = t.getAttribute("data-person-tab") === member;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function renderTasksSlotBar(grid) {
  if (!grid) return;
  let bar = document.getElementById("tasks-slot-filters");
  if (!bar) {
    // One toolbar row above the board: the times of day, then Quick grabs
    // (js/quick-grabs.js puts its tray in here, after these buttons)
    let toolbar = document.getElementById("tasks-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "tasks-toolbar";
      toolbar.className = "tasks-toolbar";
      grid.parentNode.insertBefore(toolbar, grid);
    }
    bar = document.createElement("div");
    bar.id = "tasks-slot-filters";
    bar.className = "tasks-slot-filters";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Show");
    toolbar.appendChild(bar);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-slot-filter]");
      if (!b) return;
      toggleTaskSlot(b.getAttribute("data-slot-filter"), familyDayKey(new Date()) === getLocalDateKey(tasksSelectedDate));
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      renderSkylightTasksPage();
    });
  }
  const on = tasksSlotsOn(familyDayKey(new Date()) === getLocalDateKey(tasksSelectedDate));
  bar.innerHTML = TASK_SLOTS.map(x => `<button type="button" class="tasks-slot-pill${on.has(x.key) ? " is-on" : ""}" data-slot-filter="${x.key}" aria-pressed="${on.has(x.key)}" title="${x.label}"><span aria-hidden="true">${x.icon}</span> <b class="tasks-slot-label">${x.label}</b></button>`).join("");
}

function renderTasksFilterMenu() {
  const menu = document.getElementById("tasks-filter-dropdown-menu");
  if (!menu) return;

  // People only: Up for grabs has its own button by the date
  const profiles = [...((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) || ["Steven", "Sorcha", "Ava", "Dara"])];
  const isAllActive = (tasksActiveMemberFilter === null || tasksActiveMemberFilter.length === profiles.length);

  let html = `
    <div class="skylight-filter-list">
      <!-- Select All Row -->
      <div class="skylight-filter-row ${isAllActive ? 'is-active' : ''}" data-task-filter="ALL" role="button" tabindex="0">
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
          <div class="skylight-filter-toggle ${isAllActive ? 'is-on' : ''}" aria-label="Select All Toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
  `;

  profiles.forEach(p => {
    const isGrab = p === "Up for grabs";
    const pal = isGrab ? { primary: "#ef4444", name: GRAB_LABEL } : getMemberPalette(p);
    const isMemberActive = isAllActive || (tasksActiveMemberFilter && tasksActiveMemberFilter.includes(p));

    html += `
      <div class="skylight-filter-row ${isMemberActive ? 'is-active' : ''}" data-task-filter="${escapeHtml(p)}" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-color-dot" style="background: ${pal.primary};" title="${escapeHtml(pal.name)}"></span>
          <span class="skylight-filter-member-name">${escapeHtml(displayMemberName(p))}</span>
        </div>
        <div class="skylight-filter-member-right">
          <div class="skylight-filter-toggle ${isMemberActive ? 'is-on' : ''}" aria-label="${escapeHtml(p)} toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    </div>
  `;

  menu.innerHTML = html;

  // Click handler on menu rows
  menu.querySelectorAll(".skylight-filter-row").forEach(row => {
    row.onclick = (e) => {
      e.stopPropagation();
      const filterKey = row.getAttribute("data-task-filter");
      if (filterKey === "ALL") {
        const nextChecked = !isAllActive;
        tasksActiveMemberFilter = nextChecked ? null : [];
      } else {
        const currentList = (tasksActiveMemberFilter === null) ? [...profiles] : [...tasksActiveMemberFilter];
        const idx = currentList.indexOf(filterKey);
        if (idx !== -1) {
          currentList.splice(idx, 1);
        } else {
          currentList.push(filterKey);
        }
        tasksActiveMemberFilter = (currentList.length === profiles.length) ? null : currentList;
      }
      renderTasksFilterMenu();
      renderSkylightTasksPage();
    };
  });
}


// ============================================================================
// 18. SKYLIGHT MINI CALENDAR DATE PICKER MODAL
// ============================================================================

// The picker itself lives in js/date-picker.js and is shared by every date
// field in the app
function openSkylightDatePickerModal() {
  if (typeof window.openDatePicker !== "function") return;
  window.openDatePicker({
    value: drawerSelectedDate,
    onSelect: (d) => {
      drawerSelectedDate = d;
      syncDrawerTypeUI();
    }
  });
}
function renderDatePickerCalendar() {} // kept for anything that still calls it

// Window Exports
window.tasksSelectedDate = tasksSelectedDate;
window.tasksColumnFilters = tasksColumnFilters;
window.tasksActiveMemberFilter = tasksActiveMemberFilter;
window.renderSkylightTasksPage = renderSkylightTasksPage;
window.handleCompleteTaskWithCelebration = handleCompleteTaskWithCelebration;
window.checkAllTasksCompletedCelebration = checkAllTasksCompletedCelebration;
window.showSkylightCelebration = showSkylightCelebration;
window.openSkylightTaskQuickModal = openSkylightTaskQuickModal;
window.openSkylightTaskDrawer = openSkylightTaskDrawer;
window.initSkylightTaskDrawerEvents = initSkylightTaskDrawerEvents;
window.renderTasksFilterMenu = renderTasksFilterMenu;
window.openSkylightDatePickerModal = openSkylightDatePickerModal;
window.renderDatePickerCalendar = renderDatePickerCalendar;


