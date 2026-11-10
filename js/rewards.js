// ============================================================================
// REWARDS: SCORES AND SHARED PIECES (js/rewards.js)
// This week's points per person, and the colours, sounds and confetti the
// Rewards page uses. The page itself is drawn by js/rewards-page.js.
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
// SHARED PIECES for the Rewards page: each person's colours, tap-to-boing,
// confetti in their colours, and a calm version when the device asks for
// less motion.
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

function renderPodiumRewards() {
  const modeBadge = document.getElementById("rewards-mode-badge");
  const weekLabel = document.getElementById("rewards-week-label");
  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
  const currency = (window.boardSettings && window.boardSettings.currency) || "£";

  if (modeBadge) modeBadge.textContent = isMoney ? `Pocket money (${currency})` : "Points";
  // "Week Commencing 2nd Nov" on tablets, "Week of 2nd Nov" on phones (so
  // the countdown fits on the same line, like the other pages)
  if (weekLabel) weekLabel.innerHTML = `<span class="rw-week-long">Week Commencing</span><span class="rw-week-short">Week of</span> ${escapeHtml(getWeekCommencingDateStr())}`;

  const confettiBtn = document.getElementById("btn-podium-confetti");
  if (confettiBtn && !confettiBtn.hasAttribute("data-wired")) {
    confettiBtn.setAttribute("data-wired", "true");
    confettiBtn.addEventListener("click", () => {
      if (!rewardsReduceMotion() && typeof triggerConfettiBurst === "function") triggerConfettiBurst();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (rewardsReduceMotion()) return;
      document.querySelectorAll("#rewards-leaderboard .rw-lb-row").forEach(r => {
        r.classList.remove("rw-boing");
        void r.offsetWidth;
        r.classList.add("rw-boing");
      });
    });
  }

  wireRewardsPageTaps();
  watchRewardsEntrance();
  if (window.RewardsPage) window.RewardsPage.render();
}
window.renderPodiumRewards = renderPodiumRewards;
