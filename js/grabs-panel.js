// ============================================================================
// UP FOR GRABS PANEL (js/grabs-panel.js)
// Every job nobody has taken yet, for the day the Tasks page is showing, in
// the shared side panel. Each one has the family's names under it: tap a name
// to give it to them (the same claim as dragging it into their column, with
// the same "moved to … · Undo" toast).
//
// The Up for grabs column shows its first few jobs and a "See all" card that
// opens this, so a long list never needs scrolling and dragging.
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
        <ul class="grabs-list" id="grabs-list"></ul>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#btn-close-grabs").addEventListener("click", () => dlg.close());
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("close", () => { justGiven.clear(); lastOrder = []; });
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
          </div>
          ${whoRow}
        </li>`;
    }).join("");
  }

  function onClick(e) {
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

  function openGrabsPanel(date) {
    panelDate = date ? new Date(date) : new Date();
    const dlg = ensureDialog();
    render();
    if (!dlg.open) dlg.showModal();
  }
  window.openGrabsPanel = openGrabsPanel;

  // Changes from this or another device (someone took a job elsewhere)
  document.addEventListener("harmonee:data", () => {
    const dlg = document.getElementById("grabs-modal");
    if (dlg && dlg.open) render();
  });
})();
