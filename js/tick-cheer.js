// ============================================================================
// THE TICK POP-UP (js/tick-cheer.js)
// Ticking a job off: confetti, then a card with what it earned ("+7 points
// for Ava!"), her total this week, and the family's leaderboard for the week
// with her row lit up (and "Ava moves up to 2nd!" if she has). It goes by
// itself after 4 seconds, or on a tap; ticking another job straight away
// just updates it, so a run of ticks isn't held up.
//
// When the tick finishes someone's day, their buddy (js/buddies.js) is the
// celebration instead. Scores come from computeMemberScores (js/rewards.js),
// which counts what each job shows (js/utils.js taskReward).
// Phone: a card above the bottom bar. Tablet and laptop: a centred card.
// ============================================================================
(function () {
  const SHOW_MS = 4000;
  let timer = null;

  const isMoney = () => ((window.boardSettings || {}).gameMode === "money");
  const currency = () => ((window.boardSettings || {}).currency || "£");
  const fmt = (n) => isMoney() ? `${currency()}${Number(n).toFixed(2)}` : `${Math.round(n)} pt${Math.round(n) === 1 ? "" : "s"}`;
  const earned = (n) => isMoney() ? `+${currency()}${Number(n).toFixed(2)}` : `+${Math.round(n)} point${Math.round(n) === 1 ? "" : "s"}`;
  const palette = (n) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(n) : { primary: "#0284c7", lightBg: "#e0f2fe" });
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
  const names = (list) => list.length <= 1 ? (list[0] || "") : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;

  // This week's leaderboard, best first (ties share a place)
  function board(adjust = {}) {
    const scores = typeof window.computeMemberScores === "function" ? window.computeMemberScores() : {};
    const rows = (window.familyMembers || []).map(m => ({ name: m, score: Math.max(0, ((scores[m] && scores[m].score) || 0) - (adjust[m] || 0)) }));
    rows.sort((a, b) => b.score - a.score);
    let place = 0, last = null;
    rows.forEach((r, i) => { if (r.score !== last) { place = i + 1; last = r.score; } r.place = place; });
    return rows;
  }

  function confettiFor(colours) {
    if (reduceMotion() || typeof window.confetti !== "function") return;
    const opts = { zIndex: 100030, colors: [...colours, "#facc15", "#ffffff"], disableForReducedMotion: true };
    window.confetti({ ...opts, particleCount: 60, angle: 60, spread: 65, origin: { x: 0.08, y: 0.75 } });
    window.confetti({ ...opts, particleCount: 60, angle: 120, spread: 65, origin: { x: 0.92, y: 0.75 } });
    setTimeout(() => window.confetti({ ...opts, particleCount: 50, spread: 100, startVelocity: 35, origin: { x: 0.5, y: 0.35 } }), 150);
  }

  // who: a name, a list, "Ava, Dara" or "Team Effort"; task: the job ticked
  function show(who, task) {
    const everyone = window.familyMembers || [];
    const people = who === "Team Effort" ? everyone.slice()
      : (Array.isArray(who) ? who : String(who || "").split(",")).map(s => String(s).trim()).filter(n => everyone.includes(n));
    if (!people.length || !task) return;
    const each = typeof window.taskReward === "function" ? window.taskReward(task) : 1;
    if (!each) return; // a job worth no points doesn't move the stars
    const before = board(Object.fromEntries(people.map(p => [p, each])));
    const now = board();
    const first = people[0];
    const pal = palette(first);
    const mine = now.find(r => r.name === first);
    const was = before.find(r => r.name === first);
    const movedUp = people.length === 1 && mine && was && mine.place < was.place && mine.score > 0;
    const top = Math.max(1, ...now.map(r => r.score));

    close(true);
    const el = document.createElement("div");
    el.className = "tick-cheer";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.setProperty("--who", pal.primary);
    el.innerHTML = `
      <div class="tick-cheer-card">
        <div class="tick-cheer-head">
          <span class="tick-cheer-avatars" aria-hidden="true">${people.slice(0, 4).map(p => `<span class="tick-cheer-avatar" style="background:${palette(p).primary}">${escapeHtml(p.charAt(0).toUpperCase())}</span>`).join("")}</span>
          <div class="tick-cheer-text">
            <p class="tick-cheer-earned">${escapeHtml(earned(each))}${people.length > 1 ? " each" : ""}</p>
            <p class="tick-cheer-for">${people.length > 1 ? `for ${escapeHtml(names(people))}` : `for ${escapeHtml(first)}`} · ${escapeHtml(task.title || "")}</p>
          </div>
        </div>
        ${movedUp ? `<p class="tick-cheer-moved">⬆️ ${escapeHtml(first)} moves up to ${ordinal(mine.place)}!</p>`
          : (people.length === 1 && mine ? `<p class="tick-cheer-total">${escapeHtml(first)} has ${escapeHtml(fmt(mine.score))} this week</p>` : "")}
        <p class="tick-cheer-board-title">This week</p>
        <ol class="tick-cheer-board">
          ${now.map(r => {
            const lit = people.includes(r.name);
            const old = (before.find(b => b.name === r.name) || r).score;
            const medal = r.score > 0 ? ({ 1: "🥇", 2: "🥈", 3: "🥉" }[r.place] || "") : "";
            return `<li class="tick-cheer-row${lit ? " is-lit" : ""}" style="--row:${palette(r.name).primary}">
              <span class="tick-cheer-place" aria-label="${ordinal(r.place)}">${medal || r.place}</span>
              <span class="tick-cheer-name">${escapeHtml(r.name)}</span>
              <span class="tick-cheer-bar"><i style="--from:${(old / top) * 100}%; --to:${(r.score / top) * 100}%"></i></span>
              <span class="tick-cheer-score">${escapeHtml(fmt(r.score))}</span>
            </li>`;
          }).join("")}
        </ol>
        <span class="tick-cheer-timer" aria-hidden="true"></span>
      </div>`;
    el.addEventListener("click", () => close());
    // Inside an open panel, so it isn't under the panel's backdrop
    const panels = [...document.querySelectorAll("dialog[open]")];
    (panels.length ? panels[panels.length - 1] : document.body).appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
    confettiFor(people.map(p => palette(p).primary));
    timer = setTimeout(() => close(), SHOW_MS);
  }

  function close(instant) {
    clearTimeout(timer);
    timer = null;
    document.querySelectorAll(".tick-cheer").forEach(el => {
      if (instant) { el.remove(); return; }
      el.classList.remove("is-in");
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 250);
    });
  }

  // After a tick: the buddy if that finished someone's day, else this card
  function afterTick(who, task, date) {
    if (window.Buddies) window.Buddies.checkFinished(who === "Team Effort" ? (window.familyMembers || []) : who, date || new Date());
    if (window.Buddies && window.Buddies.isShowing()) { close(true); confettiFor([palette(String(who).split(",")[0].trim()).primary]); return; }
    show(who, task);
  }

  window.TickCheer = { show, close, afterTick, SHOW_MS };
})();
