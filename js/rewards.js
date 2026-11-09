// ============================================================================
// REWARDS PODIUM & LEADERBOARD MODULE (js/rewards.js)
// Champions Podium, Weekly Ledger, Pocket Money & Points Breakdown
// ============================================================================

// Points (or money) each member earned in one ISO week, from the chores'
// completion records. Used by the podium and by the Sunday bank in app.js,
// so both always agree.
function computeMemberScores(weekKey) {
  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
  const activeWeekKey = weekKey || getIsoWeekKey();
  const memberData = {};
  (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).forEach(m => {
    memberData[m] = { score: 0, tasks: [] };
  });

  function awardMemberTask(completer, rewardVal, taskTitle) {
    if (!completer) return;
    if (completer === "Team Effort") {
      (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).forEach(m => {
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    } else if (Array.isArray(completer)) {
      completer.forEach(raw => {
        const m = normalizeFamilyMemberName(raw);
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    } else if (typeof completer === "string") {
      completer.split(",").map(s => normalizeFamilyMemberName(s.trim())).forEach(m => {
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    }
  }

  (window.currentTasks || []).forEach(task => {
    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    const rewardVal = taskReward(task, isMoney); // js/utils.js: what the job shows

    if (isDaily && task.completedDays && Object.keys(task.completedDays).length > 0) {
      Object.entries(task.completedDays).forEach(([dayName, dayRecord]) => {
        if (!dayRecord) return;
        const completer = typeof dayRecord === "object" ? dayRecord.completedBy : dayRecord;
        const compWeek = typeof dayRecord === "object"
          ? (dayRecord.completedWeek || (dayRecord.completedAt ? getIsoWeekKey(new Date(dayRecord.completedAt)) : null))
          : null;
        if (completer && (!compWeek || compWeek === activeWeekKey)) {
          awardMemberTask(completer, rewardVal, `${task.title} (${dayName})`);
        }
      });
    } else if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      awardMemberTask(task.completedBy, rewardVal, task.title);
    }
  });

  return memberData;
}
window.computeMemberScores = computeMemberScores;

// ============================================================================
// REWARDS PAGE (render only: the scoring above and the goals data in
// js/reward-goals.js are unchanged). Built for young children on the kitchen
// tablet: big avatars in each person's own colour, a podium that grows and
// bounces, tap-to-boing, and a calm version when the device asks for less
// motion.
// ============================================================================

function rewardsReduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
window.rewardsReduceMotion = rewardsReduceMotion;

function rewardsPalette(name) {
  return typeof window.getMemberPalette === "function"
    ? window.getMemberPalette(name)
    : { primary: "#0284c7", lightBg: "#e0f2fe", darkBg: "rgba(2, 132, 199, 0.22)", border: "#7dd3fc", text: "#075985" };
}
window.rewardsPalette = rewardsPalette;

// Each person's colours as CSS variables, so the stylesheet does the rest
function rewardsPaletteStyle(pal) {
  return `--member-primary: ${pal.primary}; --member-light: ${pal.lightBg}; --member-dark: ${pal.darkBg || pal.lightBg}; --member-border: ${pal.border}; --member-text: ${pal.text};`;
}
window.rewardsPaletteStyle = rewardsPaletteStyle;

function rewardsSfx(name) {
  try {
    if (window.sfx && typeof window.sfx[name] === "function") window.sfx[name]();
  } catch (e) {}
}
window.rewardsSfx = rewardsSfx;

// A quick squish-and-bounce on whatever was tapped, with a click
function rewardsBounce(el) {
  if (!el) return;
  rewardsSfx("playClick");
  if (rewardsReduceMotion()) return;
  el.classList.remove("rw-boing");
  void el.offsetWidth; // restart the animation if it's tapped again quickly
  el.classList.add("rw-boing");
}
window.rewardsBounce = rewardsBounce;

// Confetti in someone's colours, bursting from an element on the page.
// Skipped when the device asks for reduced motion.
function rewardsConfettiFrom(el, colours) {
  if (rewardsReduceMotion() || typeof window.confetti !== "function") return;
  let origin = { x: 0.5, y: 0.6 };
  if (el && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && window.innerWidth > 0 && window.innerHeight > 0) {
      origin = {
        x: Math.min(0.95, Math.max(0.05, (r.left + r.width / 2) / window.innerWidth)),
        y: Math.min(0.9, Math.max(0.1, (r.top + r.height / 2) / window.innerHeight))
      };
    }
  }
  try {
    window.confetti({
      particleCount: 120,
      spread: 80,
      startVelocity: 38,
      origin,
      colors: (colours && colours.length) ? colours.concat(["#facc15", "#ffffff"]) : undefined
    });
  } catch (e) {}
}
window.rewardsConfettiFrom = rewardsConfettiFrom;

// Replay the entrance (pillars grow, avatars pop, bars fill) each time the
// Rewards page is opened, not on every live update while it's open.
let rewardsEntranceObserver = null;
let rewardsEntranceTimer = null;
function playRewardsEntrance(container) {
  if (!container || rewardsReduceMotion()) return;
  container.classList.remove("rw-enter");
  void container.offsetWidth;
  container.classList.add("rw-enter");
  clearTimeout(rewardsEntranceTimer);
  rewardsEntranceTimer = setTimeout(() => container.classList.remove("rw-enter"), 1600);
}
function watchRewardsEntrance() {
  const container = document.querySelector("#view-rewards .rewards-view-container");
  if (!container || rewardsEntranceObserver || typeof IntersectionObserver !== "function") return;
  let shown = false;
  rewardsEntranceObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !shown) { shown = true; playRewardsEntrance(container); }
      else if (!entry.isIntersecting) shown = false;
    });
  });
  rewardsEntranceObserver.observe(container);
}

// Taps anywhere on the page: avatars and podium columns boing
function wireRewardsPageTaps() {
  const view = document.getElementById("view-rewards");
  if (!view || view.hasAttribute("data-rw-wired")) return;
  view.setAttribute("data-rw-wired", "true");
  view.addEventListener("click", (e) => {
    const target = e.target.closest("[data-rw-bounce]");
    if (target) rewardsBounce(target);
  });
  view.addEventListener("animationend", (e) => {
    if (e.target.classList && e.target.classList.contains("rw-boing")) e.target.classList.remove("rw-boing");
  });
}

function rewardsPlaceLabel(place) {
  return place === 1 ? "🥇" : (place === 2 ? "🥈" : (place === 3 ? "🥉" : `#${place}`));
}

// Podium: one column per person, kept between renders so a pillar grows
// smoothly when its score changes instead of being rebuilt.
function renderRewardsPodiumStage(stage, sortedMembers, formatScore) {
  const roster = sortedMembers.map(m => m.name).slice().sort().join("|");
  if (stage.getAttribute("data-roster") !== roster) {
    stage.setAttribute("data-roster", roster);
    stage.innerHTML = sortedMembers.map(m => {
      const pal = rewardsPalette(m.name);
      return `
        <button type="button" class="podium-col" data-member="${escapeHtml(m.name)}" data-rw-bounce style="${rewardsPaletteStyle(pal)}">
          <span class="podium-avatar-wrap">
            <span class="podium-crown" aria-hidden="true">👑</span>
            <span class="podium-avatar">${escapeHtml(m.name.charAt(0).toUpperCase())}</span>
          </span>
          <span class="podium-name">${escapeHtml(m.name)}</span>
          <span class="podium-pillar">
            <span class="podium-place" aria-hidden="true"></span>
            <span class="podium-bar-score"></span>
          </span>
        </button>`;
    }).join("");
  }

  const cols = {};
  stage.querySelectorAll(".podium-col").forEach(c => { cols[c.getAttribute("data-member")] = c; });

  const maxScore = sortedMembers.length > 0 ? Math.max(...sortedMembers.map(m => m.score)) : 0;
  const minBarHeight = 64;  // so 0 pts still has a step to stand on
  const maxBarHeight = 176; // tallest pillar, fits a 768px-tall tablet
  // Only reorder 2nd-1st-3rd once someone has points; with no scores yet keep
  // the family's own order so the podium matches the "Saving up for" cards.
  const many = sortedMembers.length >= 2 && maxScore > 0;

  sortedMembers.forEach((m, rankIdx) => {
    const col = cols[m.name];
    if (!col) return;
    const place = 1 + sortedMembers.filter(o => o.score > m.score).length;
    const isLeader = maxScore > 0 && m.score === maxScore;
    const height = maxScore > 0
      ? Math.round(minBarHeight + (m.score / maxScore) * (maxBarHeight - minBarHeight))
      : minBarHeight;
    // Olympic order: 2nd, 1st, 3rd, then everyone else
    const position = many ? (rankIdx === 0 ? 1 : (rankIdx === 1 ? 0 : rankIdx)) : rankIdx;

    col.classList.toggle("is-leader", isLeader);
    col.style.order = String(position);
    col.style.setProperty("--i", String(position));
    col.querySelector(".podium-pillar").style.height = `${height}px`;
    col.querySelector(".podium-bar-score").textContent = formatScore(m.score);
    col.querySelector(".podium-place").textContent = m.score > 0 ? rewardsPlaceLabel(place) : "";
    col.setAttribute("aria-label", `${m.name}: ${formatScore(m.score)} this week${m.score > 0 ? `, place ${place}` : ""}`);
  });
}

// For grown-ups: who did what this week, compact, chores tucked away
function renderRewardsStandings(grid, sortedMembers, formatScore) {
  grid.innerHTML = sortedMembers.map(m => {
    const pal = rewardsPalette(m.name);
    const place = 1 + sortedMembers.filter(o => o.score > m.score).length;
    const tied = sortedMembers.filter(o => o.score === m.score).length > 1;
    const placeText = m.score > 0 ? `${tied ? "Joint " : ""}${place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`}` : "";
    const tasksCount = m.tasks.length;
    const choresHtml = tasksCount > 0
      ? `<details class="rewards-card-tasklist">
           <summary>${tasksCount} chore${tasksCount === 1 ? "" : "s"} done</summary>
           <ul>${m.tasks.map(t => `<li>✓ ${escapeHtml(t)}</li>`).join("")}</ul>
         </details>`
      : `<span class="rewards-empty-note">No chores done yet this week.</span>`;

    return `
      <div class="rewards-member-card" style="${rewardsPaletteStyle(pal)}">
        <div class="rewards-card-top">
          <span class="rewards-card-avatar">${escapeHtml(m.name.charAt(0).toUpperCase())}</span>
          <div class="rewards-card-names">
            <span class="rewards-card-name">${escapeHtml(m.name)}</span>
            ${placeText ? `<span class="rewards-card-place">${placeText}</span>` : ""}
          </div>
          <span class="rewards-card-score">${formatScore(m.score)}</span>
        </div>
        ${choresHtml}
      </div>`;
  }).join("");
}

// Daily routines done day after day. Only real streaks are shown.
function renderRewardsStreaks(streaksGrid) {
  const streakTasks = (window.currentTasks || [])
    .filter(t => (t.streak && t.streak >= 2) || (t.repeat === "daily" || t.day === "Daily"))
    .sort((a, b) => (b.streak || 0) - (a.streak || 0));

  if (streakTasks.length === 0 || !streakTasks.some(t => t.streak && t.streak >= 1)) {
    streaksGrid.innerHTML = `
      <p class="rw-streaks-empty">
        <span class="rw-streaks-empty-flame" aria-hidden="true">🔥</span>
        <span>Do a daily routine (like feeding the cats or emptying the dishwasher) day after day to light a streak!</span>
      </p>`;
    return;
  }

  streaksGrid.innerHTML = streakTasks.filter(t => t.streak && t.streak >= 1).slice(0, 6).map(t => {
    const count = Number(t.streak) || 1;
    const names = typeof window.getAssigneeNames === "function" ? window.getAssigneeNames(t.assignedTo) : [];
    const assignedName = formatAssigneeNames(t.assignedTo);
    const pal = rewardsPalette(names[0] || null);
    const milestone = count >= 7;
    return `
      <button type="button" class="rw-streak ${milestone ? "is-milestone" : ""}" data-rw-bounce style="${rewardsPaletteStyle(pal)}"
              aria-label="${escapeHtml(t.title)}: ${count} day${count === 1 ? "" : "s"} in a row, ${escapeHtml(assignedName)}">
        <span class="rw-streak-flame-wrap" aria-hidden="true">
          <span class="rw-streak-flame">🔥</span>
          <span class="rw-streak-count">${count}</span>
        </span>
        <span class="rw-streak-text">
          <span class="rw-streak-days">${count} day${count === 1 ? "" : "s"} in a row${milestone ? " 🏆" : ""}</span>
          <span class="rw-streak-title">${escapeHtml(t.title)}</span>
          <span class="rw-streak-who">${escapeHtml(assignedName)}</span>
        </span>
      </button>`;
  }).join("");
}

function renderPodiumRewards() {
  const stage = document.getElementById("podium-stage");
  const grid = document.getElementById("rewards-members-grid");
  const modeBadge = document.getElementById("rewards-mode-badge");
  const weekLabel = document.getElementById("rewards-week-label");
  if (!stage || !grid) return;

  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
  const currency = (window.boardSettings && window.boardSettings.currency) || "£";
  const activeWeekKey = getIsoWeekKey();

  if (modeBadge) modeBadge.textContent = isMoney ? `Pocket money (${currency})` : "Points";
  // "Week Commencing 2nd Nov" on tablets, "Week of 2nd Nov" on phones (so
  // the countdown fits on the same line, like the other pages)
  if (weekLabel) weekLabel.innerHTML = `<span class="rw-week-long">Week Commencing</span><span class="rw-week-short">Week of</span> ${escapeHtml(getWeekCommencingDateStr())}`;

  const memberData = computeMemberScores(activeWeekKey);

  const sortedMembers = (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).map(name => ({
    name,
    score: memberData[name] ? memberData[name].score : 0,
    tasks: memberData[name] ? memberData[name].tasks : []
  })).sort((a, b) => b.score - a.score);

  const formatScore = (val) => isMoney ? `${currency}${val.toFixed(2)}` : `${val} pt${val === 1 ? "" : "s"}`;

  renderRewardsPodiumStage(stage, sortedMembers, formatScore);
  renderRewardsStandings(grid, sortedMembers, formatScore);

  const confettiBtn = document.getElementById("btn-podium-confetti");
  if (confettiBtn && !confettiBtn.hasAttribute("data-wired")) {
    confettiBtn.setAttribute("data-wired", "true");
    confettiBtn.addEventListener("click", () => {
      if (!rewardsReduceMotion() && typeof triggerConfettiBurst === "function") triggerConfettiBurst();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      const st = document.getElementById("podium-stage");
      if (st && !rewardsReduceMotion()) {
        st.querySelectorAll(".podium-col").forEach(c => {
          c.classList.remove("rw-boing");
          void c.offsetWidth;
          c.classList.add("rw-boing");
        });
      }
    });
  }

  const streaksGrid = document.getElementById("rewards-streaks-grid");
  if (streaksGrid) renderRewardsStreaks(streaksGrid);

  wireRewardsPageTaps();
  watchRewardsEntrance();

  if (typeof window.renderRewardGoals === "function") window.renderRewardGoals();
}
window.renderPodiumRewards = renderPodiumRewards;
