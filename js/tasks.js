
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
    if (!inWeek(typeof comp === "object" ? comp.completedWeek : null)) return false;
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
  if (!isDaily) return task.assignedTo;
  const key = `${weekKey}|${dayName}`;
  if (task.assignedOverrides && Object.prototype.hasOwnProperty.call(task.assignedOverrides, key)) return task.assignedOverrides[key];
  if (task.assignedDays && task.assignedDays[dayName] !== undefined) return task.assignedDays[dayName];
  return task.assignedTo;
}
window.getEffectiveAssignee = getEffectiveAssignee;

// True when an assignee value names no specific person (empty, or only the
// shared "Up for grabs" / "Anyone" / "Family" pools).
function isUnassignedValue(assignedTo) {
  const pools = ["up for grabs", "anyone", "family"];
  return getAssignedMembersList(assignedTo).every(m => pools.includes(m));
}
window.isUnassignedValue = isUnassignedValue;

// Universal Helper: Categorize task into routine slot (Morning, Afternoon, Evening) or standard Chore
function getTaskRoutineInfo(task) {
  if (!task) return { order: 3, label: "" };
  if (task.routineSlot === "morning") return { order: 1, label: "☀️ Morning" };
  if (task.routineSlot === "afternoon") return { order: 2, label: "⛅ Afternoon" };
  if (task.routineSlot === "evening") return { order: 4, label: "🌙 Evening" };
  if (task.routineSlot === "anytime") return { order: 5, label: "🕑 Anytime" };

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
window.getTaskRoutineInfo = getTaskRoutineInfo;

// 15. SKYLIGHT TASKS PAGE (Multi-Column Profiles Board & Gestures)
// ============================================================================
let tasksSelectedDate = new Date();
tasksSelectedDate.setHours(0, 0, 0, 0);

// Column category filter state: { [memberLower]: 'all' | 'morning' | 'afternoon' | 'evening' | 'chores' }
let tasksColumnFilters = {};

// Active filter in Tasks Filter Dropdown (member visibility)
let tasksActiveMemberFilter = null; // null = all visible, or array of member names

function renderSkylightTasksPage() {
  const container = document.getElementById("tasks-columns-grid");
  if (!container) return;

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
    dateSubBar.textContent = isToday ? `Today • ${dow}, ${dt} ${mon}` : `${dow}, ${dt} ${mon} ${yr}`;
  }

  const selectedDateStr = getLocalDateKey(tasksSelectedDate);
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekDays[tasksSelectedDate.getDay()];
  const isSelectedCurrentWeek = (getIsoWeekKey(tasksSelectedDate) === getIsoWeekKey(new Date()));
  // Ticks are saved against this week's weekday, so a future day can't be ticked yet
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const isFutureDay = tasksSelectedDate.getTime() > startOfToday.getTime();

  // Active columns: Family Members + "Up for grabs"
  let columns = [...((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];

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

    // Filter tasks belonging to this profile for today
    let memberTasks = (window.currentTasks || []).filter(task => {
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
        // Unassigned or assigned to Anyone / Up for grabs
        if (assigned === "Up for grabs" || assigned === "Anyone" || assigned === "Family") {
          if (task.date) return task.date === selectedDateStr;
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

      if (isAssignedToThisMember(task.assignedTo)) {
        if (task.date) return task.date === selectedDateStr;
        if (task.repeat === "weekly") return task.day === dayName;
        return isSelectedCurrentWeek && task.day === dayName;
      }
      return false;
    });

    // Check completed count
    const totalCount = memberTasks.length;
    let completedCount = 0;

    memberTasks.forEach(task => {
      if (isTaskDoneOnDate(task, tasksSelectedDate, mLower)) completedCount++;
    });

    totalTasksAllBoard += totalCount;
    completedTasksAllBoard += completedCount;

    // Filter pills (Morning, Afternoon, Evening, Chores)
    const activeFilter = tasksColumnFilters[mLower] || "all";

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

    // Routine filter pills HTML
    const hasMorning = morningTasks.length > 0;
    const hasAfternoon = afternoonTasks.length > 0;
    const hasEvening = eveningTasks.length > 0;
    const hasAnytime = anytimeTasks.length > 0;
    const hasChores = generalChores.length > 0;

    let filterPillsHtml = "";
    if (hasMorning || hasAfternoon || hasEvening || hasAnytime || hasChores) {
      filterPillsHtml = `
        <div class="tasks-col-routine-filters">
          ${hasMorning ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'morning' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="morning" title="Show Morning routines">
              <div class="circle-icon-wrap">🌤️</div>
              <span class="circle-label">Morning</span>
            </button>
          ` : ''}
          ${hasAfternoon ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'afternoon' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="afternoon" title="Show Afternoon routines">
              <div class="circle-icon-wrap">⛅</div>
              <span class="circle-label">Afternoon</span>
            </button>
          ` : ''}
          ${hasEvening ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'evening' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="evening" title="Show Evening routines">
              <div class="circle-icon-wrap">🌙</div>
              <span class="circle-label">Evening</span>
            </button>
          ` : ''}
          ${hasAnytime ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'anytime' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="anytime" title="Show Anytime routines">
              <div class="circle-icon-wrap">🕑</div>
              <span class="circle-label">Anytime</span>
            </button>
          ` : ''}
          ${hasChores ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'chores' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="chores" title="Show Chores">
              <div class="circle-icon-wrap">🧹</div>
              <span class="circle-label">Chores</span>
            </button>
          ` : ''}
        </div>
      `;
    }

    // Render task cards helper
    const renderCard = (t) => {
      const isDaily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      const isDone = isTaskDoneOnDate(t, tasksSelectedDate, mLower);
      const tIcon = t.icon || detectEmojiForChore(t.title) || "🪆";
      const isMoney = (window.boardSettings || {}).gameMode === "money";
      const curr = (window.boardSettings || {}).currency || "£";
      const valText = isMoney ? `${curr}${((t.value || 10) / 10).toFixed(2)}` : `${t.value || 10} pts`;
      const timeSubtitle = t.time || (isDaily ? "Daily" : "Today");

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
        <div class="skylight-task-card ${isDone ? 'is-completed' : ''} ${isGrabbable ? 'is-grabbable' : ''} ${isMovable ? 'is-movable' : ''}"
             style="background: ${isDone ? 'rgba(0,0,0,0.03)' : pal.lightBg}; border-color: ${pal.border};"
             data-task-id="${t.id}" data-day="${dayName}" data-date="${selectedDateStr}" data-member="${escapeHtml(colMember)}">
          <div class="skylight-task-card-main">
            <span class="skylight-task-card-icon">${escapeHtml(tIcon)}</span>
            <div class="skylight-task-card-text">
              <span class="skylight-task-card-title">${escapeHtml(t.title)}</span>
              <span class="skylight-task-card-sub">${escapeHtml(timeSubtitle)} • ${valText}</span>
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
      if (activeFilter === "all" || activeFilter === "morning") {
        if (morningTasks.length > 0) sectionsToShow.push({ title: "Morning", list: morningTasks });
      }
      if (activeFilter === "all" || activeFilter === "afternoon") {
        if (afternoonTasks.length > 0) sectionsToShow.push({ title: "Afternoon", list: afternoonTasks });
      }
      if (activeFilter === "all" || activeFilter === "evening") {
        if (eveningTasks.length > 0) sectionsToShow.push({ title: "Evening", list: eveningTasks });
      }
      if (activeFilter === "all" || activeFilter === "anytime") {
        if (anytimeTasks.length > 0) sectionsToShow.push({ title: "Anytime", list: anytimeTasks });
      }
      if (activeFilter === "all" || activeFilter === "chores") {
        if (generalChores.length > 0) sectionsToShow.push({ title: "Chores", list: generalChores });
      }

      bodySectionsHtml = sectionsToShow.map(sec => `
        <div class="tasks-section-group">
          <h4 class="tasks-section-heading">${sec.title}</h4>
          ${sec.list.map(renderCard).join("")}
        </div>
      `).join("");
    }

    const isAllDone = totalCount > 0 && completedCount === totalCount;
    const initialLetter = isGrabPool ? "⚡" : colMember.charAt(0).toUpperCase();

    columnsHtml += `
      <div class="skylight-tasks-col" data-col-member="${escapeHtml(colMember)}" style="background: ${pal.lightBg}22; border-color: ${pal.border};">
        <div class="tasks-col-header">
          <div class="tasks-col-top-row">
            <div class="tasks-col-profile-info">
              <div class="tasks-col-avatar" style="background: ${pal.primary};">${escapeHtml(initialLetter)}</div>
              <span class="tasks-col-name">${escapeHtml(colMember)}</span>
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

  container.innerHTML = columnsHtml;

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
      if (isComp) {
        handleUndoTask(tid, dName, null, mem);
      } else {
        handleCompleteTaskWithCelebration(tid, dName, mem);
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

function wireGrabDragAndDrop(container) {
  container.querySelectorAll(".skylight-task-card.is-grabbable, .skylight-task-card.is-movable").forEach(card => {
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
  });
}

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
  if (x < bRect.left + GRAB_EDGE_SCROLL_PX) board.scrollLeft -= 14;
  else if (x > bRect.right - GRAB_EDGE_SCROLL_PX) board.scrollLeft += 14;

  const under = document.elementFromPoint(x, y);
  const col = under ? under.closest(".skylight-tasks-col") : null;
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
  const current = isDaily ? getEffectiveAssignee(task, dayName, weekKey) : task.assignedTo;
  let people = getAssigneeNames(current).filter(n => !pools.includes(n.toLowerCase()));
  if (fromMember !== "Up for grabs") people = people.filter(n => n.toLowerCase() !== fromMember.toLowerCase());
  else people = [];
  if (toMember !== "Up for grabs" && !people.some(n => n.toLowerCase() === toMember.toLowerCase())) people.push(toMember);
  const newValue = people.length === 0 ? null : (people.length === 1 ? people[0] : people);

  const before = isDaily
    ? { assignedOverrides: JSON.parse(JSON.stringify(task.assignedOverrides || {})) }
    : { assignedTo: task.assignedTo === undefined ? null : JSON.parse(JSON.stringify(task.assignedTo)) };

  let payload;
  if (isDaily) {
    const thisWeek = getIsoWeekKey(new Date());
    const overrides = {};
    // keep this week's and future swaps; drop old ones
    Object.entries(task.assignedOverrides || {}).forEach(([k, v]) => { if (k.split("|")[0] >= thisWeek) overrides[k] = v; });
    overrides[`${weekKey}|${dayName}`] = newValue;
    task.assignedOverrides = overrides;
    payload = { assignedOverrides: overrides };
  } else {
    task.assignedTo = newValue;
    payload = { assignedTo: newValue };
  }
  saveTaskAssignment(task, payload);

  const where = toMember === "Up for grabs" ? "Up for grabs" : toMember;
  showTaskMoveToast(`${task.title} moved to ${where}`, () => {
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
function handleCompleteTaskWithCelebration(taskId, targetDay, memberCompleter = null) {
  const task = (window.currentTasks || []).find(t => t.id === taskId);
  if (!task) return;

  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const assignedList = getAssignedMembersList(task.assignedTo);
  const isMultiAssign = assignedList.length > 1;
  const completer = memberCompleter || (assignedList.length > 0 ? assignedList[0] : (task.assignedTo || "Family"));
  const completerLower = completer.toLowerCase();

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
        completedAt: new Date().toISOString()
      };
    } else {
      task.completedDays[targetDay] = {
        completedBy: completer,
        completedAt: new Date().toISOString()
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
    } else {
      task.done = true;
      task.completedBy = completer;
      task.completedAt = new Date().toISOString();
    }
  }

  saveLocalCache(window.currentTasks || []);
  if (db) {
    try {
      const docRef = getTaskDocRef(taskId);
      updateDoc(docRef, {
        done: task.done,
        completedBy: task.completedBy,
        completedAt: task.completedAt,
        completedDays: task.completedDays || {}
      });
    } catch (err) {}
  }

  // Play crisp completion chime
  if (typeof sfx !== "undefined" && sfx && sfx.playTaskDone) sfx.playTaskDone();

  renderSkylightTasksPage();

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
    // Trigger celebration overlay!
    showSkylightCelebration();
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
      assigneeEl.innerHTML = `<span class="task-pop-avatar" style="background:${grabPal.primary}">⚡</span><span>Up for grabs</span>`;
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
  const pts = task.value || 10;
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
  if (isGrabPool && !isDone) hintText = "Drag it into someone's column to claim it.";
  else if (isFuture) hintText = "You can tick this off on the day.";
  compBtn.style.display = hintText ? "none" : "";
  hint.textContent = hintText;
  hint.style.display = hintText ? "" : "none";
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
    if (isDone) handleUndoTask(taskId, targetDay, null, colMember);
    else handleCompleteTaskWithCelebration(taskId, targetDay, colMember);
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
let drawerSchedule = "once";      // "once" or "daily"
let drawerSelectedProfiles = ["Steven"];
let drawerSelectedDate = new Date();
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
  { name: "Cleaning", items: [["🧹","Sweep"],["🧽","Scrub"],["🧼","Soap"],["🪣","Mop"],["🧴","Spray"],["🫧","Bubbles"],["🪟","Windows"],["🛁","Bath"],["🚿","Shower"],["🚽","Toilet"],["🧻","Toilet roll"],["🗑️","Bins"],["♻️","Recycling"],["✨","Tidy up"]] },
  { name: "Kitchen & meals", items: [["🍽️","Dishes"],["🍴","Set the table"],["🍳","Cook"],["🥣","Breakfast"],["🥪","Packed lunch"],["🍱","Lunchbox"],["🥗","Salad"],["🍲","Dinner"],["☕","Tea or coffee"],["🥛","Milk"],["🛒","Shopping"],["🥕","Veg"],["🍎","Fruit"],["🧊","Fridge"]] },
  { name: "Laundry & bedroom", items: [["🧺","Laundry"],["👕","Clothes"],["👖","Trousers"],["🧦","Socks"],["👟","Shoes"],["🧥","Coat"],["👔","Ironing"],["🛏️","Make the bed"],["🧸","Toys"],["🎒","School bag"],["🪞","Mirror"],["🧷","Mending"]] },
  { name: "DIY & repairs", items: [["🔨","Hammer"],["🪛","Screwdriver"],["🔧","Spanner"],["🪚","Saw"],["🧰","Toolbox"],["🪜","Ladder"],["🖌️","Paint"],["🎨","Decorate"],["🧱","Building"],["📏","Measure"],["💡","Light bulb"],["🔌","Plug"],["🔋","Batteries"],["🪝","Hook"],["🔩","Nuts and bolts"],["🚪","Door"]] },
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
      const label = p ? p : "Up for grabs";
      return `<button type="button" class="drawer-rota-pill ${on ? "is-selected" : ""}" data-rota-day="${day}" data-rota-person="${p ? escapeHtml(p) : ""}" aria-pressed="${on}" aria-label="${escapeHtml(label)} on ${day}" title="${escapeHtml(label)}" style="--rota-color: ${pal.primary};">${p ? escapeHtml(badge(p)) : "⚡"}${tick}</button>`;
    }).join("");
    const who = chosen.length
      ? chosen.map(p => `<span class="drawer-rota-chip" style="--rota-color: ${getMemberPalette(p).primary};"><span class="drawer-rota-chip-dot"></span>${escapeHtml(p)}</span>`).join("")
      : `<span class="drawer-rota-chip is-grab"><span aria-hidden="true">⚡</span>Up for grabs</span>`;
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

function openSkylightTaskDrawer(taskId = null) {
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
    drawerSchedule = isDaily ? "daily" : "once";
    // Once: weekly repeat and time
    const repeatToggle = document.getElementById("drawer-toggle-repeat");
    const repeatSelect = document.getElementById("drawer-chore-repeat-select");
    if (repeatToggle) repeatToggle.checked = task.repeat === "weekly";
    if (repeatSelect) repeatSelect.value = task.repeat === "weekly" ? "weekly" : "none";
    const timeToggle = document.getElementById("drawer-toggle-time");
    const timeInput = document.getElementById("drawer-chore-time-input");
    if (timeToggle) timeToggle.checked = !isDaily && !!task.time && /^\d{1,2}:\d{2}/.test(task.time);
    if (timeInput && timeToggle && timeToggle.checked) timeInput.value = task.time.slice(0, 5);
    drawerRewardValue = task.value || 10;
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
    const repeatToggle = document.getElementById("drawer-toggle-repeat");
    if (repeatToggle) repeatToggle.checked = false;
    const timeToggle = document.getElementById("drawer-toggle-time");
    if (timeToggle) timeToggle.checked = false;
    drawerRewardValue = 1;
    drawerRoutineSlot = "morning";
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

  // Date label
  document.getElementById("drawer-chore-date-label").textContent = drawerSelectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  overlay.style.display = "flex";

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
        <span class="drawer-profile-name">${escapeHtml(p)}</span>
      </button>
    `;
  }).join("");

  row.querySelectorAll(".drawer-profile-pill").forEach(btn => {
    btn.onclick = () => {
      const p = btn.getAttribute("data-profile");
      if (p === "Up for grabs") {
        drawerSelectedProfiles = ["Up for grabs"];
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
  if (rotaOn) {
    el.textContent = "Changes each day. Pick who does it in the rota below.";
    return;
  }
  const people = drawerSelectedProfiles.filter(p => p !== "Up for grabs");
  if (!people.length) {
    el.classList.add("is-grab");
    el.textContent = "Up for grabs: anyone can claim it.";
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

  // How often: one date, or every day at a time of day
  document.querySelectorAll("#drawer-schedule-pills [data-schedule]").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-schedule") === drawerSchedule);
  });
  updateDrawerWhoSummary();
  if (choreFields) choreFields.style.display = drawerSchedule === "once" ? "block" : "none";
  if (routineFields) routineFields.style.display = drawerSchedule === "daily" ? "block" : "none";

  // Once: show the time and weekly options when switched on
  const timeToggle = document.getElementById("drawer-toggle-time");
  const timeWrap = document.getElementById("drawer-chore-time-selector");
  const timeLabel = document.getElementById("drawer-chore-time-label");
  const timeInput = document.getElementById("drawer-chore-time-input");
  if (timeWrap && timeToggle) timeWrap.style.display = timeToggle.checked ? "" : "none";
  if (timeLabel && timeToggle) timeLabel.textContent = timeToggle.checked && timeInput ? timeInput.value : "All Day";
  const repeatToggle = document.getElementById("drawer-toggle-repeat");
  const repeatWrap = document.getElementById("drawer-chore-repeat-selector");
  const repeatLabel = document.getElementById("drawer-chore-repeat-label");
  const repeatSelect = document.getElementById("drawer-chore-repeat-select");
  if (repeatWrap && repeatToggle) repeatWrap.style.display = repeatToggle.checked ? "" : "none";
  if (repeatToggle && repeatSelect && repeatToggle.checked && repeatSelect.value === "none") repeatSelect.value = "weekly";
  if (repeatLabel && repeatToggle) repeatLabel.textContent = repeatToggle.checked && repeatSelect && repeatSelect.value === "weekly" ? "Weekly on this day" : "Does not repeat";
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
  ["drawer-toggle-time", "drawer-toggle-repeat", "drawer-chore-time-input", "drawer-chore-repeat-select"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", syncDrawerTypeUI);
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

  // Date picker trigger on Date row
  const choreDateLabel = document.getElementById("drawer-chore-date-label");
  if (choreDateLabel) {
    choreDateLabel.style.cursor = "pointer";
    choreDateLabel.onclick = () => { openSkylightDatePickerModal(); };
  }

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
        day: isRoutine ? "Daily" : dName,
        date: (isRoutine || isWeekly) ? null : dStr,
        repeat: isRoutine ? "daily" : (isWeekly ? "weekly" : "none"),
        kind: drawerCurrentType, // "routine" stays with each person; "chore" can be swapped
        routineSlot: isRoutine ? drawerRoutineSlot : null,
        value: drawerRewardValue,
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
        if (typeof alignDropdownOnScreen === "function") {
          alignDropdownOnScreen(tasksFilterMenu, btnTasksFilter);
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

function renderTasksFilterMenu() {
  const menu = document.getElementById("tasks-filter-dropdown-menu");
  if (!menu) return;

  const profiles = [...((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];
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
    const pal = isGrab ? { primary: "#ef4444", name: "Up for grabs" } : getMemberPalette(p);
    const isMemberActive = isAllActive || (tasksActiveMemberFilter && tasksActiveMemberFilter.includes(p));

    html += `
      <div class="skylight-filter-row ${isMemberActive ? 'is-active' : ''}" data-task-filter="${escapeHtml(p)}" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-color-dot" style="background: ${pal.primary};" title="${escapeHtml(pal.name)}"></span>
          <span class="skylight-filter-member-name">${escapeHtml(p)}</span>
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
let pickerCurrentMonth = new Date();

function openSkylightDatePickerModal() {
  const modal = document.getElementById("skylight-datepicker-modal");
  if (!modal) return;
  pickerCurrentMonth = new Date(drawerSelectedDate);
  renderDatePickerCalendar();
  modal.style.display = "flex";

  document.getElementById("btn-datepicker-dismiss").onclick = () => { modal.style.display = "none"; };
  document.getElementById("btn-datepicker-select").onclick = () => {
    document.getElementById("drawer-chore-date-label").textContent = drawerSelectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    modal.style.display = "none";
  };
}

function renderDatePickerCalendar() {
  const yr = pickerCurrentMonth.getFullYear();
  const mo = pickerCurrentMonth.getMonth();
  const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("datepicker-month-name").textContent = `${mNames[mo]} ${yr}`;
  document.getElementById("datepicker-selected-label").textContent = drawerSelectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  const firstDay = new Date(yr, mo, 1).getDay(); // 0 is Sun
  const lastDate = new Date(yr, mo + 1, 0).getDate();
  const grid = document.getElementById("datepicker-days-grid");
  if (!grid) return;

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += `<span class="datepicker-day-cell is-other-month"></span>`;
  }
  for (let d = 1; d <= lastDate; d++) {
    const isSel = (drawerSelectedDate.getFullYear() === yr && drawerSelectedDate.getMonth() === mo && drawerSelectedDate.getDate() === d);
    html += `<button type="button" class="datepicker-day-cell ${isSel ? 'is-selected' : ''}" data-day="${d}">${d}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".datepicker-day-cell[data-day]").forEach(btn => {
    btn.onclick = () => {
      const d = parseInt(btn.getAttribute("data-day"), 10);
      drawerSelectedDate = new Date(yr, mo, d);
      drawerSelectedDate.setHours(0, 0, 0, 0);
      renderDatePickerCalendar();
    };
  });

  document.getElementById("btn-datepicker-prev").onclick = () => {
    pickerCurrentMonth.setMonth(pickerCurrentMonth.getMonth() - 1);
    renderDatePickerCalendar();
  };
  document.getElementById("btn-datepicker-next").onclick = () => {
    pickerCurrentMonth.setMonth(pickerCurrentMonth.getMonth() + 1);
    renderDatePickerCalendar();
  };
}

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


