// ============================================================================
// QUICK GRABS (js/quick-grabs.js)
// Small everyday jobs nobody owns (litter trays, the dishwasher, feeding the
// cats) as pills in a tray above the Tasks board. Drag one into your column
// (or onto your name tab on a phone) and it's yours for that day only:
// tomorrow it's back in the tray. Tap a pill instead to pick who's grabbing it.
//
// A quick grab is a daily job, or a weekly "any day" one (it stays in the
// tray every day until someone does it, and a grab lasts that week), that
// isn't a personal routine and isn't marked "Bigger job" in the editor
// (task.grabSize = "big"). Those, and weekly-on-a-day or one-off jobs, stay in
// the Grab it panel (js/grabs-panel.js).
//
// Phone: the tray folds into one "⚡ 4 quick grabs" chip that opens the pills.
// Uses js/tasks.js: getTasksForColumn, isTaskDoneOnDate, wireGrabDraggable,
// moveTaskBetween, tasksSlotsOn, getEffectiveAssignee.
// ============================================================================
(function () {
  const POOL = "Up for grabs";
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ALL_GRABBED_MS = 3000;   // "All grabbed 🎉" before the tray folds away
  let expanded = false;          // the phone chip opened
  let scrollX = 0;               // where the row of pills was scrolled to
  let lastCount = null;          // pills shown last time, for "All grabbed"
  let lastDateKey = null;
  let allGrabbedUntil = 0;
  let allGrabbedTimer = null;

  const isDaily = (t) => t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));

  // A small everyday job anyone can grab (not a personal routine, not a bigger job)
  // (a daily job, or a weekly one for any day of the week)
  const anyDayWeekly = (t) => t.repeat === "weekly" && t.anyDay === true;
  function isQuickGrab(task) {
    return !!task && (isDaily(task) || anyDayWeekly(task)) && task.grabSize !== "big" && !(typeof isPersonalRoutine === "function" && isPersonalRoutine(task));
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
    // A weekly any-day grab lasts the week; a daily one, that day
    const key = `${getIsoWeekKey(date)}|${anyDayWeekly(task) ? "any" : dayName}`;
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
    // In the toolbar row, after the Morning / Evening buttons
    const slotBar = document.getElementById("tasks-slot-filters");
    if (slotBar && slotBar.parentNode) slotBar.parentNode.insertBefore(tray, slotBar.nextSibling);
    else grid.parentNode.insertBefore(tray, grid);
    tray.addEventListener("click", (e) => {
      if (e.target.closest("[data-quick-grabs-more]")) { expanded = !expanded; window.renderSkylightTasksPage(); return; }
      const arrow = e.target.closest("[data-quick-grabs-scroll]");
      if (arrow) {
        const row = tray.querySelector(".quick-grabs-pills");
        if (row) row.scrollBy({ left: Number(arrow.getAttribute("data-quick-grabs-scroll")) * Math.max(200, row.clientWidth * 0.8), behavior: "smooth" });
        return;
      }
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
    const oldRow = tray.querySelector(".quick-grabs-pills");
    if (oldRow) scrollX = oldRow.scrollLeft;
    tray.hidden = false;
    tray.className = `quick-grabs${phone ? " is-phone" : ""}${phone && !expanded ? " is-folded" : ""}`;
    // One row of pills that swipes sideways (arrows for a mouse), so the board
    // keeps its room however many jobs are waiting
    const row = `<div class="quick-grabs-row">
        <button type="button" class="quick-grabs-arrow is-prev" data-quick-grabs-scroll="-1" aria-label="Earlier quick grabs" hidden>‹</button>
        <div class="quick-grabs-pills" role="list">${jobs.map(t => pillHtml(t, date)).join("")}</div>
        <button type="button" class="quick-grabs-arrow is-next" data-quick-grabs-scroll="1" aria-label="More quick grabs" hidden>›</button>
      </div>`;
    if (phone) {
      tray.innerHTML = `
        <button type="button" class="quick-grabs-chip" data-quick-grabs-more aria-expanded="${expanded}">
          <span aria-hidden="true">⚡</span> ${label}<span class="quick-grabs-chev" aria-hidden="true">${expanded ? "▴" : "▾"}</span>
        </button>
        ${expanded ? `<p class="quick-grabs-hint">Swipe to see them all. Hold one and drop it on a name, or tap it</p>${row}` : ""}`;
    } else {
      tray.innerHTML = `
        <div class="quick-grabs-line">
          <p class="quick-grabs-title" title="Drag one to your column, or tap it"><span aria-hidden="true">⚡</span> ${label}</p>
          ${row}
        </div>`;
    }
    const pills = tray.querySelector(".quick-grabs-pills");
    if (pills) {
      pills.scrollLeft = scrollX;
      // Arrows and edge fades only where there's more to see that way
      const sync = () => {
        const max = pills.scrollWidth - pills.clientWidth;
        // A few pixels either way (scroll snapping) still counts as the end
        const atStart = pills.scrollLeft <= 12, atEnd = pills.scrollLeft >= max - 12;
        tray.querySelector(".is-prev").hidden = max <= 12 || atStart;
        tray.querySelector(".is-next").hidden = max <= 12 || atEnd;
        pills.classList.toggle("fade-start", max > 12 && !atStart);
        pills.classList.toggle("fade-end", max > 12 && !atEnd);
      };
      pills.addEventListener("scroll", sync, { passive: true });
      requestAnimationFrame(sync);
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
