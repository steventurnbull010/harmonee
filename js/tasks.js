
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

// Universal Helper: Categorize task into routine slot (Morning, Afternoon, Evening) or standard Chore
function getTaskRoutineInfo(task) {
  if (!task) return { order: 3, label: "" };
  if (task.routineSlot === "morning") return { order: 1, label: "☀️ Morning" };
  if (task.routineSlot === "afternoon") return { order: 2, label: "⛅ Afternoon" };
  if (task.routineSlot === "evening") return { order: 4, label: "🌙 Evening" };

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

      if (isGrabPool) {
        // Unassigned or assigned to Anyone / Up for grabs
        if (!isDaily && (assigned === "Up for grabs" || assigned === "Anyone" || assigned === "Family")) {
          return task.date ? task.date === selectedDateStr : (task.day === dayName || isSelectedCurrentWeek);
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
        if (task.assignedDays && task.assignedDays[dayName] !== undefined) {
          return isAssignedToThisMember(task.assignedDays[dayName]);
        }
        return isAssignedToThisMember(task.assignedTo);
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
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const assignedList = getAssignedMembersList(task.assignedTo);
      const isMultiAssign = assignedList.length > 1;

      if (isDaily) {
        const comp = task.completedDays && task.completedDays[dayName];
        if (comp) {
          if (isMultiAssign) {
            const list = Array.isArray(comp.completedBy) ? comp.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof comp.completedBy === "string" ? comp.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
            if (list.includes(mLower)) completedCount++;
          } else {
            completedCount++;
          }
        }
      } else {
        if (isMultiAssign) {
          const list = Array.isArray(task.completedBy) ? task.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof task.completedBy === "string" ? task.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
          if (list.includes(mLower)) completedCount++;
        } else {
          if (task.done) completedCount++;
        }
      }
    });

    totalTasksAllBoard += totalCount;
    completedTasksAllBoard += completedCount;

    // Filter pills (Morning, Afternoon, Evening, Chores)
    const activeFilter = tasksColumnFilters[mLower] || "all";

    // Group tasks
    const morningTasks = [];
    const afternoonTasks = [];
    const eveningTasks = [];
    const generalChores = [];

    memberTasks.forEach(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const rInfo = getTaskRoutineInfo(task);
      if (isDaily || task.routineSlot) {
        const slot = task.routineSlot || (rInfo.label.includes("Morning") ? "morning" : (rInfo.label.includes("Afternoon") ? "afternoon" : "evening"));
        if (slot === "morning") morningTasks.push(task);
        else if (slot === "afternoon") afternoonTasks.push(task);
        else eveningTasks.push(task);
      } else {
        generalChores.push(task);
      }
    });

    // Routine filter pills HTML
    const hasMorning = morningTasks.length > 0;
    const hasAfternoon = afternoonTasks.length > 0;
    const hasEvening = eveningTasks.length > 0;
    const hasChores = generalChores.length > 0;

    let filterPillsHtml = "";
    if (hasMorning || hasAfternoon || hasEvening || hasChores) {
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
      const assignedList = getAssignedMembersList(t.assignedTo);
      const isMultiAssign = assignedList.length > 1;
      let isDone = false;
      if (isDaily) {
        const comp = t.completedDays && t.completedDays[dayName];
        if (comp) {
          if (isMultiAssign) {
            const list = Array.isArray(comp.completedBy) ? comp.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof comp.completedBy === "string" ? comp.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
            isDone = list.includes(mLower);
          } else {
            isDone = true;
          }
        }
      } else {
        if (isMultiAssign) {
          const list = Array.isArray(t.completedBy) ? t.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof t.completedBy === "string" ? t.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
          isDone = list.includes(mLower);
        } else {
          isDone = !!t.done;
        }
      }
      const tIcon = t.icon || detectEmojiForChore(t.title) || "🪆";
      const isMoney = (window.boardSettings || {}).gameMode === "money";
      const curr = (window.boardSettings || {}).currency || "£";
      const valText = isMoney ? `${curr}${((t.value || 10) / 10).toFixed(2)}` : `${t.value || 10} pts`;
      const timeSubtitle = t.time || (isDaily ? "Daily" : "Today");

      return `
        <div class="skylight-task-card ${isDone ? 'is-completed' : ''}" 
             style="background: ${isDone ? 'rgba(0,0,0,0.03)' : pal.lightBg}; border-color: ${pal.border};"
             data-task-id="${t.id}" data-day="${dayName}" data-date="${selectedDateStr}" data-member="${escapeHtml(colMember)}">
          <div class="skylight-task-card-main">
            <span class="skylight-task-card-icon">${escapeHtml(tIcon)}</span>
            <div class="skylight-task-card-text">
              <span class="skylight-task-card-title">${escapeHtml(t.title)}</span>
              <span class="skylight-task-card-sub">${escapeHtml(timeSubtitle)} • ${valText}</span>
            </div>
          </div>
          <button type="button" class="skylight-task-check-circle" 
                  data-task-id="${t.id}" data-day="${dayName}" data-member="${escapeHtml(colMember)}" data-completed="${isDone ? 'true' : 'false'}"
                  title="${isDone ? 'Undo task' : 'Mark as complete'}">
            ${isDone ? '✓' : ''}
          </button>
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
      <div class="skylight-tasks-col" style="background: ${pal.lightBg}22; border-color: ${pal.border};">
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
      const tid = card.getAttribute("data-task-id");
      const dName = card.getAttribute("data-day");
      const colMem = card.getAttribute("data-member") || null;
      openSkylightTaskQuickModal(tid, dName, colMem);
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
}
window.renderSkylightTasksPage = renderSkylightTasksPage;

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

function openSkylightTaskQuickModal(taskId, targetDay, colMember = null) {
  const task = (window.currentTasks || []).find(t => t.id === taskId);
  if (!task) return;

  currentQuickTaskId = taskId;
  currentQuickTaskDay = targetDay;

  const overlay = document.getElementById("skylight-task-quick-modal");
  if (!overlay) return;

  document.getElementById("quick-card-title").textContent = task.title;
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  document.getElementById("quick-card-datetime").textContent = isDaily ? `${targetDay} Routine • ${task.time || 'Anytime'}` : `${task.day || targetDay} Chore • ${task.time || 'Today'}`;

  const assignedList = getAssignedMembersList(task.assignedTo);
  const isMultiAssign = assignedList.length > 1;

  const assigneeEl = document.getElementById("quick-card-assignee");
  if (assigneeEl) {
    if (isMultiAssign) {
      const avatars = assignedList.map(m => {
        const pal = getMemberPalette(m);
        return `<span class="skylight-avatar avatar-mini" style="background: ${pal.primary}; color: #fff;">${m.charAt(0).toUpperCase()}</span>`;
      }).join("");
      assigneeEl.innerHTML = `
        <div style="display: flex; gap: 4px; align-items: center;">${avatars}</div>
        <span style="font-weight: 500;">${escapeHtml(assignedList.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(", "))}</span>
      `;
    } else {
      const assigned = task.assignedTo || "Up for grabs";
      const pal = (assigned === "Up for grabs" || assigned === "Anyone") ? { primary: "#ef4444" } : getMemberPalette(assigned);
      assigneeEl.innerHTML = `
        <span class="skylight-avatar avatar-mini" style="background: ${pal.primary}; color: #fff;">${assigned.charAt(0).toUpperCase()}</span>
        <span style="font-weight: 500;">${escapeHtml(assigned)}</span>
      `;
    }
  }

  const isMoney = (window.boardSettings || {}).gameMode === "money";
  const curr = (window.boardSettings || {}).currency || "£";
  document.getElementById("quick-card-reward").textContent = isMoney ? `${curr}${((task.value || 10) / 10).toFixed(2)}` : `${task.value || 10} pts`;

  const compBtn = document.getElementById("btn-quick-card-complete");
  const mLower = colMember ? colMember.toLowerCase() : null;
  let isDone = false;
  if (isDaily) {
    const comp = task.completedDays && task.completedDays[targetDay];
    if (comp) {
      if (isMultiAssign && mLower) {
        const list = Array.isArray(comp.completedBy) ? comp.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof comp.completedBy === "string" ? comp.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
        isDone = list.includes(mLower);
      } else {
        isDone = true;
      }
    }
  } else {
    if (isMultiAssign && mLower) {
      const list = Array.isArray(task.completedBy) ? task.completedBy.map(s => String(s).trim().toLowerCase()) : (typeof task.completedBy === "string" ? task.completedBy.split(",").map(s => s.trim().toLowerCase()) : []);
      isDone = list.includes(mLower);
    } else {
      isDone = !!task.done;
    }
  }

  compBtn.textContent = isDone ? "Mark as Incomplete" : "Mark as Complete";
  compBtn.onclick = () => {
    overlay.style.display = "none";
    if (isDone) {
      handleUndoTask(taskId, targetDay, null, colMember);
    } else {
      handleCompleteTaskWithCelebration(taskId, targetDay, colMember);
    }
  };

  overlay.style.display = "flex";

  // Wire close
  document.getElementById("btn-quick-card-close").onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };

  // Wire Edit -> opens right drawer prefilled
  document.getElementById("btn-quick-card-edit").onclick = () => {
    overlay.style.display = "none";
    openSkylightTaskDrawer(taskId);
  };

  // Wire Delete
  document.getElementById("btn-quick-card-delete").onclick = () => {
    overlay.style.display = "none";
    openDeleteTaskModal(taskId);
  };
}
window.openSkylightTaskQuickModal = openSkylightTaskQuickModal;

// ============================================================================
// 17. SKYLIGHT RIGHT-SIDE SLIDE-IN DRAWER (Add / Edit Task)
// ============================================================================
let drawerCurrentType = "chore";
let drawerSelectedProfiles = ["Steven"];
let drawerSelectedDate = new Date();
let drawerRoutineFreq = 1;
let drawerRoutineFreqUnit = "day";
let drawerRoutineSlot = "morning";
let drawerRewardValue = 10;
let drawerSelectedEmoji = "🪴";

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
    drawerCurrentType = (isDaily || task.routineSlot) ? "routine" : "chore";
    drawerRewardValue = task.value || 10;
    drawerRoutineSlot = task.routineSlot || "morning";
  } else {
    headingEl.textContent = "Add Task";
    submitBtn.textContent = "Add";
    idInput.value = "";
    titleInput.value = "";
    drawerSelectedEmoji = "🪴";
    drawerSelectedProfiles = [((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]) && (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"])[0]) || "Steven"];
    drawerCurrentType = "chore";
    drawerRewardValue = 1;
    drawerRoutineSlot = "morning";
  }

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
  ["morning", "afternoon", "evening"].forEach(s => {
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
      <button type="button" class="drawer-profile-pill ${isActive ? 'active' : ''}" data-profile="${escapeHtml(p)}" style="--profile-color: ${pal.primary}; color: ${pal.primary};">
        <span class="drawer-profile-avatar" style="background: ${pal.primary};">${escapeHtml(initial)}</span>
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
}

function syncDrawerTypeUI() {
  const btnChore = document.getElementById("btn-drawer-type-chore");
  const btnRoutine = document.getElementById("btn-drawer-type-routine");
  const choreFields = document.getElementById("drawer-chore-fields");
  const routineFields = document.getElementById("drawer-routine-fields");

  if (btnChore) btnChore.classList.toggle("active", drawerCurrentType === "chore");
  if (btnRoutine) btnRoutine.classList.toggle("active", drawerCurrentType === "routine");
  if (choreFields) choreFields.style.display = drawerCurrentType === "chore" ? "block" : "none";
  if (routineFields) routineFields.style.display = drawerCurrentType === "routine" ? "block" : "none";
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
  if (btnRoutine) btnRoutine.onclick = () => { drawerCurrentType = "routine"; syncDrawerTypeUI(); };

  // Emoji accordion
  const emojiTrigger = document.getElementById("drawer-emoji-trigger");
  const emojiGrid = document.getElementById("drawer-emoji-grid");
  if (emojiTrigger && emojiGrid) {
    emojiGrid.innerHTML = EVENT_EMOJI_LIST.map(em => `<button type="button" class="drawer-emoji-item" data-emoji="${em}">${em}</button>`).join("");
    emojiTrigger.onclick = () => {
      emojiGrid.style.display = (emojiGrid.style.display === "none") ? "grid" : "none";
    };
    emojiGrid.querySelectorAll(".drawer-emoji-item").forEach(btn => {
      btn.onclick = () => {
        drawerSelectedEmoji = btn.getAttribute("data-emoji");
        document.getElementById("drawer-emoji-preview").textContent = drawerSelectedEmoji;
        emojiGrid.style.display = "none";
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
  ["morning", "afternoon", "evening"].forEach(slot => {
    const btn = document.getElementById(`btn-routine-slot-${slot}`);
    if (btn) {
      btn.onclick = () => {
        drawerRoutineSlot = slot;
        ["morning", "afternoon", "evening"].forEach(s => {
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

      const isRoutine = (drawerCurrentType === "routine");
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
        date: isRoutine ? null : dStr,
        repeat: isRoutine ? "daily" : "none",
        routineSlot: isRoutine ? drawerRoutineSlot : null,
        value: drawerRewardValue,
        order: isRoutine ? (drawerRoutineSlot === 'morning' ? 1 : (drawerRoutineSlot === 'afternoon' ? 2 : 4)) : 3
      };

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


