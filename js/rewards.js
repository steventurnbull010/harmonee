// ============================================================================
// REWARDS PODIUM & LEADERBOARD MODULE (js/rewards.js)
// Champions Podium, Weekly Ledger, Pocket Money & Points Breakdown
// ============================================================================

// ============================================================================
function renderPodiumRewards() {
  const stage = document.getElementById("podium-stage");
  const grid = document.getElementById("rewards-members-grid");
  const modeBadge = document.getElementById("rewards-mode-badge");
  const weekLabel = document.getElementById("rewards-week-label");
  if (!stage || !grid) return;

  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
  const currency = (window.boardSettings && window.boardSettings.currency) || "£";
  const activeWeekKey = getIsoWeekKey();

  if (modeBadge) modeBadge.textContent = isMoney ? `Pocket Money (${currency})` : "Points Mode";
  if (weekLabel) weekLabel.textContent = `${getWeekCommencingLabel(false)} • Live Household Standings`;

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
    const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
      ? task.rewardValue 
      : (isMoney ? 1.00 : (task.points || 1));

    if (isDaily && task.completedDays && Object.keys(task.completedDays).length > 0) {
      Object.entries(task.completedDays).forEach(([dayName, dayRecord]) => {
        if (!dayRecord) return;
        const completer = typeof dayRecord === "object" ? dayRecord.completedBy : dayRecord;
        const compWeek = typeof dayRecord === "object" ? dayRecord.completedWeek : null;
        if (completer && (!compWeek || compWeek === activeWeekKey)) {
          awardMemberTask(completer, rewardVal, `${task.title} (${dayName})`);
        }
      });
    } else if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      awardMemberTask(task.completedBy, rewardVal, task.title);
    }
  });

  const sortedMembers = (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).map((name, idx) => ({
    name,
    color: getMemberColor(idx),
    score: memberData[name] ? memberData[name].score : 0,
    tasks: memberData[name] ? memberData[name].tasks : []
  })).sort((a, b) => b.score - a.score);

  const formatScore = (val) => isMoney ? `${currency}${val.toFixed(2)}` : `${val} pt${val === 1 ? "" : "s"}`;

  const maxScore = sortedMembers.length > 0 ? Math.max(...sortedMembers.map(m => m.score)) : 0;
  const minBarHeight = 65; // base pillar height so 0 pts has a visible, clean platform
  const maxBarHeight = 210; // tallest pillar height

  stage.innerHTML = sortedMembers.map((m, rankIdx) => {
    const isLeader = maxScore > 0 && m.score === maxScore;
    const nameLower = m.name.toLowerCase();

    let pastelClass = "pillar-pastel-default";
    if (isLeader) {
      pastelClass = "pillar-pastel-leader";
    } else if (nameLower.includes("sorcha")) {
      pastelClass = "pillar-pastel-purple";
    } else if (nameLower.includes("ava")) {
      pastelClass = "pillar-pastel-lavender";
    } else if (nameLower.includes("dara")) {
      pastelClass = "pillar-pastel-mint";
    } else if (nameLower.includes("steven")) {
      pastelClass = "pillar-pastel-sky";
    } else {
      const fallbackPastels = [
        "pillar-pastel-sky", 
        "pillar-pastel-purple", 
        "pillar-pastel-lavender", 
        "pillar-pastel-mint"
      ];
      pastelClass = fallbackPastels[rankIdx % fallbackPastels.length];
    }

    let pillarHeight = minBarHeight;
    if (maxScore > 0) {
      pillarHeight = Math.round(minBarHeight + (m.score / maxScore) * (maxBarHeight - minBarHeight));
    }

    const crownHtml = isLeader ? `<span class="podium-crown">👑</span>` : "";

    return `
      <div class="podium-col ${pastelClass} ${isLeader ? "is-leader" : ""}" data-member="${escapeHtml(m.name)}">
        <div class="podium-avatar-wrap">
          ${crownHtml}
          <div class="podium-avatar" style="background: ${m.color.bg}; border: 2.5px solid ${m.color.border};">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
        </div>
        <div class="podium-name">${escapeHtml(m.name)}</div>
        <div class="podium-pillar" style="height: ${pillarHeight}px;">
          <span class="podium-bar-score">${formatScore(m.score)}</span>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = sortedMembers.map((m, rankIdx) => {
    const rankBadge = rankIdx === 0 ? "👑 Leader" : (rankIdx === 1 ? "🥈 2nd" : (rankIdx === 2 ? "🥉 3rd" : `#${rankIdx + 1}`));
    const tasksCount = m.tasks.length;
    const taskListHtml = tasksCount > 0
      ? `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 0.82rem; line-height: 1.5;">${m.tasks.map(t => `<li style="margin-bottom: 2px;">✓ ${escapeHtml(t)}</li>`).join("")}</ul>`
      : `<span class="rewards-empty-note">No completed chores recorded this week yet.</span>`;

    return `
      <div class="rewards-member-card">
        <div class="rewards-card-top">
          <div class="rewards-card-person">
            <div class="rewards-card-avatar" style="background: ${m.color.bg}; border: 2px solid ${m.color.border};">
              ${escapeHtml(m.name.charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="rewards-card-name">${escapeHtml(m.name)} <span style="font-size: 0.75rem; font-weight: 700; opacity: 0.8;">(${rankBadge})</span></div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${tasksCount} chore${tasksCount === 1 ? "" : "s"} completed</div>
            </div>
          </div>
          <div class="rewards-card-score">${formatScore(m.score)}</div>
        </div>
        <div class="rewards-card-tasklist">
          <strong style="font-size: 0.82rem; color: var(--text-heading);">This Week Completed Chores:</strong>
          ${taskListHtml}
        </div>
      </div>
    `;
  }).join("");

  const confettiBtn = document.getElementById("btn-podium-confetti");
  if (confettiBtn && !confettiBtn.hasAttribute("data-wired")) {
    confettiBtn.setAttribute("data-wired", "true");
    confettiBtn.addEventListener("click", () => {
      if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    });
  }

  // Render Household Habit Streaks Showcase
  const streaksGrid = document.getElementById("rewards-streaks-grid");
  if (streaksGrid) {
    const streakTasks = (window.currentTasks || [])
      .filter(t => (t.streak && t.streak >= 2) || (t.repeat === "daily" || t.day === "Daily"))
      .sort((a, b) => (b.streak || 0) - (a.streak || 0));

    if (streakTasks.length === 0 || !streakTasks.some(t => t.streak && t.streak >= 1)) {
      streaksGrid.innerHTML = `
        <div class="streak-card-item" style="grid-column: 1 / -1; justify-content: center; text-align: center; color: var(--text-secondary); font-size: 0.88rem; padding: 18px;">
          <span>🔥 Complete daily routines consecutively (e.g. Feed cats, Empty Dishwasher) to build family habit streaks!</span>
        </div>
      `;
    } else {
      streaksGrid.innerHTML = streakTasks.slice(0, 6).map(t => {
        const streakCount = t.streak || 1;
        const assignedName = formatAssigneeNames(t.assignedTo);
        const initial = assignedName.charAt(0).toUpperCase();
        return `
          <div class="streak-card-item">
            <div class="streak-item-left">
              <div class="streak-member-avatar">${escapeHtml(initial)}</div>
              <div>
                <div class="streak-item-title">${escapeHtml(t.title)}</div>
                <div class="streak-item-sub">${escapeHtml(assignedName)} • Daily Routine</div>
              </div>
            </div>
            <div class="streak-count-badge ${streakCount >= 7 ? 'milestone' : ''}">
              <span>🔥</span>
              <span>${streakCount}d</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}
window.renderPodiumRewards = renderPodiumRewards;


window.renderPodiumRewards = renderPodiumRewards;
