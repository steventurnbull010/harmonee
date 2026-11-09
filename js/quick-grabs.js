// ============================================================================
// QUICK GRABS (js/quick-grabs.js)
// Small everyday jobs nobody owns (litter trays, the dishwasher, feeding the
// cats) as pills in a tray above the Tasks board. Drag one into your column
// (or onto your name tab on a phone) and it's yours for that day only:
// tomorrow it's back in the tray. Tap a pill instead to pick who's grabbing it.
//
// A quick grab is a daily job that isn't a personal routine and isn't marked
// "Bigger job" in the editor (task.grabSize = "big"); those, and weekly or
// one-off jobs, stay in the Grab it panel (js/grabs-panel.js).
//
// Phone: the tray folds into one "⚡ 4 quick grabs" chip that opens the pills.
// Uses js/tasks.js: getTasksForColumn, isTaskDoneOnDate, wireGrabDraggable,
// moveTaskBetween, tasksSlotsOn, getEffectiveAssignee.
// ============================================================================
(function () {
  const POOL = "Up for grabs";
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const SHOW_FIRST = 6;          // tablet and laptop: pills before "+3 more"
  const ALL_GRABBED_MS = 3000;   // "All grabbed 🎉" before the tray folds away
  let expanded = false;          // "+3 more" opened, or the phone chip opened
  let lastCount = null;          // pills shown last time, for "All grabbed"
  let lastDateKey = null;
  let allGrabbedUntil = 0;
  let allGrabbedTimer = null;

  const isDaily = (t) => t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));

  // A small everyday job anyone can grab (not a personal routine, not a bigger job)
  function isQuickGrab(task) {
    return !!task && isDaily(task) && task.grabSize !== "big" && !(typeof isPersonalRoutine === "function" && isPersonalRoutine(task));
  }

  // Nobody's on it by default that weekday (before any one-day grab)
  function normallyUnassigned(task, dayName) {
    const base = task.assignedDays && task.assignedDays[dayName] !== undefined ? task.assignedDays[dayName] : task.assignedTo;
    return typeof isUnassignedValue === "function" ? isUnassignedValue(base) : !base;
  }

  // Grabbed from the tray for this date: a quick grab someone took for the day
  function isGrabbedOn(task, date) {
    if (!isQuickGrab(task)) return false;
    const dayName = DAYS[date.getDay()];
    if (!normallyUnassigned(task, dayName)) return false;
    const key = `${getIsoWeekKey(date)}|${dayName}`;
    const o = task.assignedOverrides || {};
    return Object.prototype.hasOwnProperty.call(o, key) && !(typeof isUnassignedValue === "function" ? isUnassignedValue(o[key]) : !o[key]);
  }

  // Morning / afternoon / evening / anytime, as the board groups it
  function slotOf(task) {
    if (task.routineSlot) return task.routineSlot;
    const label = (typeof getTaskRoutineInfo === "function" ? getTaskRoutineInfo(task).label : "") || "";
    return label.includes("Morning") ? "morning" : label.includes("Afternoon") ? "afternoon" : label.includes("Evening") ? "evening" : "anytime";
  }

  // The tray's jobs for a date: still up for grabs, not done, in a time of day
  // that's showing on the board (Anytime goes with Chores, as in the columns)
  function quickGrabsOn(date, slotsOn) {
    if (typeof getTasksForColumn !== "function") return [];
    const order = { morning: 1, afternoon: 2, evening: 3, anytime: 4 };
    return getTasksForColumn(POOL, date)
      .filter(t => isQuickGrab(t) && !isTaskDoneOnDate(t, date))
      .filter(t => !slotsOn || slotsOn.has(slotOf(t) === "anytime" ? "chores" : slotOf(t)))
      .sort((a, b) => (order[slotOf(a)] || 9) - (order[slotOf(b)] || 9));
  }

  function pointsText(task) {
    const s = window.boardSettings || {};
    if (s.gameMode === "money") return `+${s.currency || "£"}${taskReward(task, true).toFixed(2)}`;
    return `+${taskPoints(task)}`;
  }

  function pillHtml(task, date) {
    const icon = task.icon || (typeof detectEmojiForChore === "function" ? detectEmojiForChore(task.title) : "") || "⚡";
    const dateKey = getLocalDateKey(date);
    return `<button type="button" class="quick-grab-pill" data-quick-grab="${esc(task.id)}" data-task-id="${esc(task.id)}" data-day="${DAYS[date.getDay()]}" data-date="${dateKey}" data-member="${POOL}"
        aria-label="${esc(task.title)}, ${esc(pointsText(task).replace("+", ""))} ${(window.boardSettings || {}).gameMode === "money" ? "" : "points"}. Drag to someone, or tap to choose who's grabbing it">
      <span class="quick-grab-icon" aria-hidden="true">${esc(icon)}</span>
      <span class="quick-grab-title">${esc(task.title)}</span>
      <span class="quick-grab-pts" aria-hidden="true">${esc(pointsText(task))}</span>
    </button>`;
  }

  // Above the board, under the Morning / Evening buttons
  function ensureTray(grid) {
    let tray = document.getElementById("tasks-quick-grabs");
    if (tray) return tray;
    tray = document.createElement("section");
    tray.id = "tasks-quick-grabs";
    tray.className = "quick-grabs";
    tray.setAttribute("aria-label", "Quick grabs");
    tray.setAttribute("data-grab-drop", ""); // a grabbed job dropped here goes back up for grabs
    const slotBar = document.getElementById("tasks-slot-filters");
    if (slotBar && slotBar.parentNode === grid.parentNode) grid.parentNode.insertBefore(tray, slotBar.nextSibling);
    else grid.parentNode.insertBefore(tray, grid);
    tray.addEventListener("click", (e) => {
      if (e.target.closest("[data-quick-grabs-more]")) { expanded = !expanded; window.renderSkylightTasksPage(); return; }
      const pill = e.target.closest("[data-quick-grab]");
      if (!pill || (typeof grabDragJustEnded !== "undefined" && grabDragJustEnded)) return;
      openSkylightTaskQuickModal(pill.getAttribute("data-task-id"), pill.getAttribute("data-day"), POOL, pill.getAttribute("data-date"));
    });
    return tray;
  }

  function render(grid, date, slotsOn) {
    if (!grid || !grid.parentNode) return;
    const tray = ensureTray(grid);
    const dateKey = getLocalDateKey(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d0 = new Date(date); d0.setHours(0, 0, 0, 0);
    if (dateKey !== lastDateKey) { lastDateKey = dateKey; lastCount = null; expanded = false; allGrabbedUntil = 0; }

    // Past days: nothing to grab any more
    const jobs = d0 < today ? [] : quickGrabsOn(date, slotsOn);
    if (!jobs.length) {
      // The last one just went: a moment of "All grabbed", then the tray folds away
      if (lastCount > 0 && !allGrabbedUntil) {
        allGrabbedUntil = Date.now() + ALL_GRABBED_MS;
        clearTimeout(allGrabbedTimer);
        allGrabbedTimer = setTimeout(() => { allGrabbedUntil = 0; lastCount = 0; window.renderSkylightTasksPage(); }, ALL_GRABBED_MS + 50);
      }
      lastCount = 0;
      if (allGrabbedUntil > Date.now()) {
        tray.hidden = false;
        tray.className = "quick-grabs is-all-grabbed";
        tray.innerHTML = `<p class="quick-grabs-done" role="status">All grabbed 🎉</p>`;
      } else {
        tray.hidden = true;
        tray.innerHTML = "";
      }
      return;
    }
    allGrabbedUntil = 0;
    lastCount = jobs.length;

    const phone = typeof isTasksPhone === "function" && isTasksPhone();
    const n = jobs.length;
    const label = `${n} quick grab${n === 1 ? "" : "s"}`;
    tray.hidden = false;
    tray.className = `quick-grabs${phone ? " is-phone" : ""}${phone && !expanded ? " is-folded" : ""}`;
    if (phone) {
      tray.innerHTML = `
        <button type="button" class="quick-grabs-chip" data-quick-grabs-more aria-expanded="${expanded}">
          <span aria-hidden="true">⚡</span> ${label}<span class="quick-grabs-chev" aria-hidden="true">${expanded ? "▴" : "▾"}</span>
        </button>
        ${expanded ? `<p class="quick-grabs-hint">Hold one and drop it on a name, or tap it</p>
          <div class="quick-grabs-pills">${jobs.map(t => pillHtml(t, date)).join("")}</div>` : ""}`;
    } else {
      const shown = expanded ? jobs : jobs.slice(0, SHOW_FIRST);
      const more = n - shown.length;
      tray.innerHTML = `
        <p class="quick-grabs-head"><span class="quick-grabs-title"><span aria-hidden="true">⚡</span> Quick grabs</span><span class="quick-grabs-hint">drag one to your column</span></p>
        <div class="quick-grabs-pills">
          ${shown.map(t => pillHtml(t, date)).join("")}
          ${more > 0 ? `<button type="button" class="quick-grabs-more" data-quick-grabs-more aria-expanded="false">+${more} more</button>`
            : (expanded && n > SHOW_FIRST ? `<button type="button" class="quick-grabs-more" data-quick-grabs-more aria-expanded="true">Show fewer</button>` : "")}
        </div>`;
    }
    if (typeof wireGrabDraggable === "function") tray.querySelectorAll(".quick-grab-pill").forEach(p => wireGrabDraggable(p, grid));
  }

  // After a grab on a phone: fold the tray and show that person's column, so
  // the job can be seen landing
  function afterGrab(member) {
    if (!(typeof isTasksPhone === "function" && isTasksPhone())) return;
    expanded = false;
    setTimeout(() => {
      const tab = [...document.querySelectorAll("#tasks-person-tabs [data-person-tab]")].find(t => t.getAttribute("data-person-tab") === member);
      if (tab) tab.click();
    }, 50);
  }

  window.QuickGrabs = { render, isQuickGrab, isGrabbedOn, quickGrabsOn, afterGrab };
})();
