// ============================================================================
// UP FOR GRABS PANEL (js/grabs-panel.js)
// Every job nobody has taken yet, for the day the Tasks page is showing, in
// the shared side panel. Each one has the family's names under it: tap a name
// to give it to them (the same claim as dragging it into their column, with
// the same "moved to … · Undo" toast).
//
// Opened from the "Grab it" button by the date on the Tasks page (Up for
// grabs isn't a column). Each job can also be edited or deleted here, and
// "Add a job for anyone" starts a new one already set to Grab it.
// Uses js/tasks.js (getTasksForColumn, moveTaskBetween, isTaskDoneOnDate,
// isOverdueOn) and js/utils.js (displayMemberName, getLocalDateKey).
// ============================================================================
(function () {
  const POOL = "Up for grabs";
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let panelDate = null;
  const justGiven = new Map(); // taskId -> who, shown for a moment before the row goes
  let lastOrder = [];          // the rows as last shown, so they don't jump about
  const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
  const ICON_DELETE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s ?? "")) : String(s ?? ""));
  const nameOf = (n) => (typeof displayMemberName === "function" ? displayMemberName(n) : n);
  const members = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);

  // The jobs still up for grabs on a day: important ones first, then ones
  // carried over from earlier days, then the rest in the board's order
  function grabJobs(date) {
    if (typeof getTasksForColumn !== "function") return [];
    const list = getTasksForColumn(POOL, date).filter(t => !(typeof isTaskDoneOnDate === "function" && isTaskDoneOnDate(t, date)));
    const rank = (t) => (t.isPriority ? 0 : 2) + (typeof isOverdueOn === "function" && isOverdueOn(t, date) ? 0 : 1);
    return list.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map(x => x.t);
  }
  window.grabJobs = grabJobs;

  function dayLabel(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  // When an overdue job was meant for ("Was Saturday")
  function wasFor(task) {
    if (!task.date) return "";
    const [y, m, d] = String(task.date).split("-").map(Number);
    if (!y) return "";
    const when = new Date(y, m - 1, d);
    return `Was for ${DAYS[when.getDay()]} ${when.getDate()} ${MONTHS[when.getMonth()]}`;
  }

  function ensureDialog() {
    let dlg = document.getElementById("grabs-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "grabs-modal";
    dlg.className = "roster-dialog grabs-dialog";
    dlg.setAttribute("aria-labelledby", "grabs-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" id="btn-close-grabs" aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="grabs-title" class="modal-title">Up for grabs</h2></div>
        <p class="grabs-intro" id="grabs-intro"></p>
        <button type="button" class="grabs-add" data-grabs-add><span aria-hidden="true">＋</span> Add a job for anyone</button>
        <ul class="grabs-list" id="grabs-list"></ul>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#btn-close-grabs").addEventListener("click", () => dlg.close());
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("close", () => {
      justGiven.clear(); lastOrder = [];
      if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
    });
    return dlg;
  }

  function render() {
    const dlg = document.getElementById("grabs-modal");
    if (!dlg || !panelDate) return;
    const jobs = grabJobs(panelDate);
    // A job just given stays where it was until it fades out
    const all = window.currentTasks || [];
    const shown = [];
    lastOrder.forEach(id => {
      const t = jobs.find(j => j.id === id) || (justGiven.has(id) ? all.find(j => j.id === id) : null);
      if (t) shown.push(t);
    });
    jobs.forEach(t => { if (!shown.includes(t)) shown.push(t); });
    lastOrder = shown.map(t => t.id);
    const people = members();
    const title = dlg.querySelector("#grabs-title");
    if (title) title.textContent = nameOf(POOL); // the column's name ("Grab it")
    const intro = dlg.querySelector("#grabs-intro");
    const list = dlg.querySelector("#grabs-list");
    intro.textContent = jobs.length
      ? `${dayLabel(panelDate)}: ${jobs.length} job${jobs.length === 1 ? "" : "s"} nobody has taken yet. Tap a name to give it to them.`
      : `${dayLabel(panelDate)}: nothing left up for grabs.`;
    if (!shown.length) {
      list.innerHTML = `<li class="grabs-empty"><span aria-hidden="true">🎉</span> Everything has someone doing it.</li>`;
      return;
    }
    const isMoney = (window.boardSettings || {}).gameMode === "money";
    const curr = (window.boardSettings || {}).currency || "£";
    list.innerHTML = shown.map(t => {
      const given = justGiven.get(t.id);
      const icon = t.icon || (typeof window.detectEmojiForChore === "function" && window.detectEmojiForChore(t.title)) || "🪆";
      const overdue = typeof isOverdueOn === "function" && isOverdueOn(t, panelDate);
      const value = isMoney ? `${curr}${((t.value || 10) / 10).toFixed(2)}` : `${t.value || 10} pts`;
      const meta = [
        t.isPriority ? `<span class="grabs-tag is-important">Important</span>` : "",
        overdue ? `<span class="grabs-tag is-overdue">Overdue</span><span>${esc(wasFor(t))}</span>` : "",
        `<span>${esc(value)}</span>`
      ].filter(Boolean).join("");
      // The same person picker as everywhere else: tap a name to give it to them
      const pills = people.map(p => memberPillHtml(p, {
        active: given === p,
        attrs: `data-give="${esc(t.id)}" data-person="${esc(p)}"${given ? " disabled" : ""}`,
        ariaLabel: `Give ${t.title} to ${nameOf(p)}`
      })).join("");
      const whoRow = `<div class="drawer-profiles-pills-row grabs-people" role="group" aria-label="Who's doing ${esc(t.title)}">${pills}</div>`
        + (given ? `<p class="grabs-given" role="status">✓ ${esc(nameOf(given))} is doing it</p>` : "");
      return `<li class="grabs-job${given ? " is-given" : ""}${t.isPriority ? " is-important" : ""}" data-job="${esc(t.id)}">
          <div class="grabs-job-top">
            <span class="grabs-job-icon" aria-hidden="true">${esc(icon)}</span>
            <div class="grabs-job-text">
              <span class="grabs-job-title">${esc(t.title)}</span>
              <span class="grabs-job-meta">${meta}</span>
            </div>
            ${given ? "" : `<div class="grabs-job-actions">
              <button type="button" class="grabs-icon-btn" data-grabs-edit="${esc(t.id)}" aria-label="Edit ${esc(t.title)}" title="Edit">${ICON_EDIT}</button>
              <button type="button" class="grabs-icon-btn is-delete" data-grabs-delete="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Delete">${ICON_DELETE}</button>
            </div>`}
          </div>
          ${whoRow}
        </li>`;
    }).join("");
  }

  function onClick(e) {
    const dlg = document.getElementById("grabs-modal");
    // Add a job for anyone: the usual new-job panel, already set to Grab it
    if (e.target.closest("[data-grabs-add]")) {
      const day = panelDate;
      dlg.close();
      if (typeof window.openSkylightTaskDrawer === "function") window.openSkylightTaskDrawer(null, { people: [POOL], date: day });
      return;
    }
    const edit = e.target.closest("[data-grabs-edit]");
    if (edit) {
      dlg.close();
      if (typeof window.openSkylightTaskDrawer === "function") window.openSkylightTaskDrawer(edit.getAttribute("data-grabs-edit"));
      return;
    }
    const del = e.target.closest("[data-grabs-delete]");
    if (del) { deleteJob(del.getAttribute("data-grabs-delete")); return; }
    const btn = e.target.closest("[data-give]");
    if (!btn || !panelDate || typeof moveTaskBetween !== "function") return;
    const id = btn.getAttribute("data-give");
    const who = btn.getAttribute("data-person");
    if (justGiven.has(id)) return;
    // Show who's doing it for a moment, then let the row go
    justGiven.set(id, who);
    moveTaskBetween(id, getLocalDateKey(panelDate), POOL, who);
    render();
    setTimeout(() => {
      justGiven.delete(id);
      const row = document.querySelector(`#grabs-list [data-job="${CSS.escape(id)}"]`);
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (row && !reduce && typeof row.animate === "function") {
        const h = row.offsetHeight;
        row.animate([{ opacity: 1, height: `${h}px` }, { opacity: 0, height: "0px", marginTop: "-8px", paddingTop: "0px", paddingBottom: "0px" }],
          { duration: 260, easing: "ease-in" }).onfinish = render;
      } else render();
    }, 1200);
  }

  // Delete, after asking, with Undo (the same delete and restore voice uses)
  async function deleteJob(id) {
    const task = (window.currentTasks || []).find(t => t.id === id);
    if (!task || typeof window.deleteTaskById !== "function") return;
    const ask = { icon: "🗑️", danger: true, yes: "Delete it", no: "Keep it",
      title: `Delete "${task.title}"?`, text: "It comes off the board for everyone." };
    const sure = window.Sheet ? await window.Sheet.confirm(ask) : window.confirm(ask.title);
    if (!sure) return;
    const copy = await window.deleteTaskById(id);
    render();
    if (copy && typeof showTaskMoveToast === "function" && typeof window.restoreTask === "function") {
      showTaskMoveToast(`${task.title} deleted`, () => { window.restoreTask(copy); setTimeout(render, 300); });
    }
  }

  function openGrabsPanel(date) {
    panelDate = date ? new Date(date) : new Date();
    const dlg = ensureDialog();
    render();
    if (!dlg.open) dlg.showModal();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
  }
  window.openGrabsPanel = openGrabsPanel;

  // Changes from this or another device (someone took a job elsewhere)
  document.addEventListener("harmonee:data", () => {
    const dlg = document.getElementById("grabs-modal");
    if (dlg && dlg.open) render();
  });
})();
