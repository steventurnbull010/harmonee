// ============================================================================
// REWARD GOALS & REDEEM (js/reward-goals.js)
// Skylight-style rewards: each person saves up for goals ("Cinema trip, 50
// pts"), sees progress, and redeems when they have enough. Redeeming spends
// the points.
//
// Everything lives on the board doc so every device agrees:
//   rewardGoals:       [{ id, member, title, emoji, cost }]
//   rewardRedemptions: [{ id, goalId, member, title, emoji, cost, redeemedAt }]
//   rewardWeeks:       { "2026-W45": { Ava: 23, Dara: 12, ... }, ... }
//
// rewardWeeks is written by the Sunday reset in app.js (bankRewardWeek): it
// keeps each finished week's totals, keyed by week, so points carry over
// even though the chores themselves reset. Writing by week key means two
// devices doing the reset at once write the same numbers, never double.
//
// Spendable balance = banked past weeks + this week's live points − redeemed.
// ============================================================================

const REWARD_GOAL_EMOJIS = ["🎁", "🎬", "🍦", "🎮", "📱", "🧸", "⚽", "🍕", "🛍️", "🎨", "📚", "🏊", "🎢", "💷", "🌙", "🐶"];

function rewardDataCacheKey() {
  return (typeof boardCacheKey === "function") ? boardCacheKey("harmonee_reward_goals") : "harmonee_reward_goals";
}

(function loadRewardDataFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(rewardDataCacheKey()) || "null");
    window.rewardGoals = (cached && Array.isArray(cached.goals)) ? cached.goals : [];
    window.rewardRedemptions = (cached && Array.isArray(cached.redemptions)) ? cached.redemptions : [];
    window.rewardWeeks = (cached && cached.weeks && typeof cached.weeks === "object") ? cached.weeks : {};
  } catch (e) {
    window.rewardGoals = [];
    window.rewardRedemptions = [];
    window.rewardWeeks = {};
  }
})();

function cacheRewardData() {
  try {
    localStorage.setItem(rewardDataCacheKey(), JSON.stringify({
      goals: window.rewardGoals || [],
      redemptions: window.rewardRedemptions || [],
      weeks: window.rewardWeeks || {}
    }));
  } catch (e) {}
}

// Called from the board-doc listener in app.js whenever the board changes
function applyBoardRewardData(data) {
  if (!data) return;
  let changed = false;
  if (Array.isArray(data.rewardGoals)) { window.rewardGoals = data.rewardGoals; changed = true; }
  if (Array.isArray(data.rewardRedemptions)) { window.rewardRedemptions = data.rewardRedemptions; changed = true; }
  if (data.rewardWeeks && typeof data.rewardWeeks === "object") { window.rewardWeeks = data.rewardWeeks; changed = true; }
  if (changed) {
    cacheRewardData();
    renderRewardGoals();
  }
}
window.applyBoardRewardData = applyBoardRewardData;

function saveRewardDataToBoard(fields) {
  cacheRewardData();
  if (window.db && typeof window.setDoc === "function" && typeof window.doc === "function") {
    try {
      const payload = { ...fields };
      if (typeof window.serverTimestamp === "function") payload.updatedAt = window.serverTimestamp();
      window.setDoc(window.doc(window.db, "boards", window.currentBoardId || "turnbull"), payload, { merge: true })
        .catch(err => console.warn("Couldn't save rewards:", err));
    } catch (e) {
      console.warn("Couldn't save rewards:", e);
    }
  }
}

// Sunday reset in app.js calls this with last week's totals before the
// chores are cleared. Keyed by week, so repeating it is harmless.
function bankRewardWeek(weekKey, totals) {
  if (!weekKey || !totals) return;
  const clean = {};
  Object.entries(totals).forEach(([m, v]) => {
    const n = Number(v) || 0;
    if (n > 0) clean[m] = Math.round(n * 100) / 100;
  });
  if (Object.keys(clean).length === 0) return;
  if (window.rewardWeeks && window.rewardWeeks[weekKey]) return; // already banked
  window.rewardWeeks = { ...(window.rewardWeeks || {}), [weekKey]: clean };
  saveRewardDataToBoard({ rewardWeeks: { [weekKey]: clean } });
}
window.bankRewardWeek = bankRewardWeek;

function getRewardMoneyMode() {
  const s = window.boardSettings || {};
  return { isMoney: s.gameMode === "money", currency: s.currency || "£" };
}

function formatRewardAmount(val) {
  const { isMoney, currency } = getRewardMoneyMode();
  const n = Math.max(0, Number(val) || 0);
  return isMoney ? `${currency}${n.toFixed(2)}` : `${Math.round(n)} pt${Math.round(n) === 1 ? "" : "s"}`;
}

function getMemberRewardBalance(member) {
  const thisWeek = (typeof getIsoWeekKey === "function") ? getIsoWeekKey() : null;
  let banked = 0;
  Object.entries(window.rewardWeeks || {}).forEach(([week, totals]) => {
    if (week === thisWeek || !totals) return; // this week comes from the live chores
    banked += Number(totals[member]) || 0;
  });
  let live = 0;
  if (typeof window.computeMemberScores === "function") {
    const scores = window.computeMemberScores();
    live = (scores[member] && scores[member].score) || 0;
  }
  const spent = (window.rewardRedemptions || [])
    .filter(r => r.member === member)
    .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  return Math.round((banked + live - spent) * 100) / 100;
}
window.getMemberRewardBalance = getMemberRewardBalance;

// ---------------------------------------------------------------------------
// Rewards page section
// ---------------------------------------------------------------------------
let rewardRedeemArmed = null; // goal id waiting for its confirming second tap
let rewardRedeemTimer = null;

function renderRewardGoals() {
  const grid = document.getElementById("rewards-goals-grid");
  if (!grid) return;
  const members = window.familyMembers || [];
  const goals = window.rewardGoals || [];
  const redemptions = window.rewardRedemptions || [];

  grid.innerHTML = members.map(member => {
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(member) : { primary: "#0284c7", lightBg: "#e0f2fe", border: "#7dd3fc", text: "#075985" };
    const balance = getMemberRewardBalance(member);
    const memberGoals = goals.filter(g => g.member === member).sort((a, b) => (a.cost || 0) - (b.cost || 0));
    const recent = redemptions.filter(r => r.member === member)
      .sort((a, b) => String(b.redeemedAt).localeCompare(String(a.redeemedAt)))
      .slice(0, 2);

    const goalsHtml = memberGoals.length ? memberGoals.map(g => {
      const cost = Number(g.cost) || 0;
      const pct = cost > 0 ? Math.min(100, Math.round((balance / cost) * 100)) : 100;
      const ready = balance >= cost && cost > 0;
      const armed = rewardRedeemArmed === g.id;
      const btn = ready
        ? `<button type="button" class="reward-goal-redeem ${armed ? "is-armed" : ""}" data-redeem-goal="${escapeHtml(g.id)}">${armed ? "Tap again to redeem" : "Redeem"}</button>`
        : `<span class="reward-goal-togo">${formatRewardAmount(cost - balance)} to go</span>`;
      return `
        <div class="reward-goal-row ${ready ? "is-ready" : ""}">
          <button type="button" class="reward-goal-main" data-edit-goal="${escapeHtml(g.id)}" title="Edit goal">
            <span class="reward-goal-emoji">${escapeHtml(g.emoji || "🎁")}</span>
            <span class="reward-goal-text">
              <span class="reward-goal-title">${escapeHtml(g.title)}</span>
              <span class="reward-goal-cost">${formatRewardAmount(Math.min(balance, cost))} of ${formatRewardAmount(cost)}</span>
            </span>
          </button>
          <div class="reward-goal-bar"><div class="reward-goal-bar-fill" style="width: ${pct}%; background: ${pal.primary};"></div></div>
          <div class="reward-goal-action">${btn}</div>
        </div>`;
    }).join("") : `<p class="reward-goals-empty">No goals yet. What is ${escapeHtml(member)} saving up for?</p>`;

    const recentHtml = recent.length ? `
      <div class="reward-goals-recent">
        ${recent.map(r => `<span>✓ ${escapeHtml(r.emoji || "🎁")} ${escapeHtml(r.title)} · ${new Date(r.redeemedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>`).join("")}
      </div>` : "";

    return `
      <div class="reward-goals-member" style="--member-primary: ${pal.primary}; --member-light: ${pal.lightBg}; --member-border: ${pal.border}; --member-text: ${pal.text};">
        <div class="reward-goals-member-head">
          <span class="reward-goals-avatar" style="background: ${pal.primary};">${escapeHtml(member.charAt(0).toUpperCase())}</span>
          <div class="reward-goals-member-names">
            <span class="reward-goals-member-name">${escapeHtml(member)}</span>
            <span class="reward-goals-balance">${formatRewardAmount(balance)} to spend</span>
          </div>
        </div>
        <div class="reward-goals-list">${goalsHtml}</div>
        ${recentHtml}
        <button type="button" class="reward-goals-add" data-add-goal-for="${escapeHtml(member)}">+ Add goal</button>
      </div>`;
  }).join("");

  if (!grid.hasAttribute("data-wired")) {
    grid.setAttribute("data-wired", "true");
    grid.addEventListener("click", onRewardGoalsGridClick);
  }
}
window.renderRewardGoals = renderRewardGoals;

function onRewardGoalsGridClick(e) {
  const addBtn = e.target.closest("[data-add-goal-for]");
  if (addBtn) { openRewardGoalPanel(null, addBtn.getAttribute("data-add-goal-for")); return; }

  const editBtn = e.target.closest("[data-edit-goal]");
  if (editBtn) { openRewardGoalPanel(editBtn.getAttribute("data-edit-goal")); return; }

  const redeemBtn = e.target.closest("[data-redeem-goal]");
  if (redeemBtn) {
    const goalId = redeemBtn.getAttribute("data-redeem-goal");
    // Two taps, so a passing elbow on the kitchen tablet can't spend points
    if (rewardRedeemArmed !== goalId) {
      rewardRedeemArmed = goalId;
      clearTimeout(rewardRedeemTimer);
      rewardRedeemTimer = setTimeout(() => { rewardRedeemArmed = null; renderRewardGoals(); }, 4000);
      renderRewardGoals();
      return;
    }
    rewardRedeemArmed = null;
    clearTimeout(rewardRedeemTimer);
    redeemRewardGoal(goalId);
  }
}

function redeemRewardGoal(goalId) {
  const goal = (window.rewardGoals || []).find(g => g.id === goalId);
  if (!goal) return;
  const cost = Number(goal.cost) || 0;
  if (getMemberRewardBalance(goal.member) < cost) { renderRewardGoals(); return; }

  const entry = {
    id: `redeem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    goalId: goal.id,
    member: goal.member,
    title: goal.title,
    emoji: goal.emoji || "🎁",
    cost,
    redeemedAt: new Date().toISOString()
  };
  window.rewardRedemptions = [...(window.rewardRedemptions || []), entry];
  saveRewardDataToBoard({ rewardRedemptions: window.rewardRedemptions });
  renderRewardGoals();

  try {
    if (typeof window.confetti === "function") window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    if (typeof sfx !== "undefined" && sfx && typeof sfx.playTrophyChime === "function") sfx.playTrophyChime();
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Add / edit goal side panel (#reward-goal-modal, styled by js/side-panel.js)
// ---------------------------------------------------------------------------
let rewardGoalPanelMember = null;
let rewardGoalPanelEmoji = "🎁";

function openRewardGoalPanel(goalId = null, member = null) {
  const dialog = document.getElementById("reward-goal-modal");
  if (!dialog) return;
  const goal = goalId ? (window.rewardGoals || []).find(g => g.id === goalId) : null;
  const { isMoney, currency } = getRewardMoneyMode();

  rewardGoalPanelMember = goal ? goal.member : (member || (window.familyMembers || [])[0] || "");
  rewardGoalPanelEmoji = goal ? (goal.emoji || "🎁") : "🎁";

  document.getElementById("reward-goal-title").textContent = goal ? "Edit Reward Goal" : "Add Reward Goal";
  document.getElementById("reward-goal-id").value = goal ? goal.id : "";
  document.getElementById("reward-goal-name").value = goal ? goal.title : "";
  document.getElementById("reward-goal-cost").value = goal ? goal.cost : (isMoney ? 5 : 50);
  document.getElementById("reward-goal-cost").step = isMoney ? "0.5" : "1";
  document.getElementById("reward-goal-cost-label").textContent = isMoney ? `Cost (${currency})` : "Points needed";
  document.getElementById("btn-delete-reward-goal").style.display = goal ? "" : "none";
  document.getElementById("btn-save-reward-goal").textContent = goal ? "Save" : "Add Goal";

  const presets = isMoney ? [2, 5, 10, 20] : [20, 50, 100, 200];
  document.getElementById("reward-goal-presets").innerHTML = presets.map(p =>
    `<button type="button" class="reward-goal-preset" data-cost="${p}">${isMoney ? `${currency}${p}` : `${p} pts`}</button>`).join("");

  renderRewardGoalPanelPickers();
  wireRewardGoalPanel();
  if (!dialog.open) dialog.showModal();
  setTimeout(() => { if (!goal) document.getElementById("reward-goal-name").focus(); }, 60);
}
window.openRewardGoalPanel = openRewardGoalPanel;

function renderRewardGoalPanelPickers() {
  const membersRow = document.getElementById("reward-goal-members");
  membersRow.innerHTML = (window.familyMembers || []).map(m => {
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(m) : { primary: "#0284c7" };
    const on = m === rewardGoalPanelMember;
    return `<button type="button" class="reward-goal-member-pill ${on ? "is-selected" : ""}" data-member="${escapeHtml(m)}" aria-pressed="${on}">
      <span class="reward-goal-member-dot" style="background: ${pal.primary};">${escapeHtml(m.charAt(0).toUpperCase())}</span>${escapeHtml(m)}
    </button>`;
  }).join("");

  const emojiRow = document.getElementById("reward-goal-emojis");
  emojiRow.innerHTML = REWARD_GOAL_EMOJIS.map(em =>
    `<button type="button" class="reward-goal-emoji-btn ${em === rewardGoalPanelEmoji ? "is-selected" : ""}" data-emoji="${em}" aria-label="Icon ${em}">${em}</button>`).join("");
}

function wireRewardGoalPanel() {
  const dialog = document.getElementById("reward-goal-modal");
  if (dialog.hasAttribute("data-wired")) return;
  dialog.setAttribute("data-wired", "true");

  document.getElementById("btn-close-reward-goal").addEventListener("click", () => dialog.close());

  document.getElementById("reward-goal-members").addEventListener("click", (e) => {
    const pill = e.target.closest("[data-member]");
    if (!pill) return;
    rewardGoalPanelMember = pill.getAttribute("data-member");
    renderRewardGoalPanelPickers();
  });
  document.getElementById("reward-goal-emojis").addEventListener("click", (e) => {
    const b = e.target.closest("[data-emoji]");
    if (!b) return;
    rewardGoalPanelEmoji = b.getAttribute("data-emoji");
    renderRewardGoalPanelPickers();
  });

  const costInput = document.getElementById("reward-goal-cost");
  const stepCost = (dir) => {
    const { isMoney } = getRewardMoneyMode();
    const step = isMoney ? 0.5 : 5;
    const next = Math.max(step, (Number(costInput.value) || 0) + dir * step);
    costInput.value = isMoney ? next.toFixed(2).replace(/\.00$/, "") : Math.round(next);
  };
  document.getElementById("btn-goal-cost-minus").addEventListener("click", () => stepCost(-1));
  document.getElementById("btn-goal-cost-plus").addEventListener("click", () => stepCost(1));
  document.getElementById("reward-goal-presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cost]");
    if (b) costInput.value = b.getAttribute("data-cost");
  });

  document.getElementById("reward-goal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("reward-goal-name").value.trim();
    const cost = Math.round((Number(costInput.value) || 0) * 100) / 100;
    if (!title || cost <= 0 || !rewardGoalPanelMember) {
      if (!title) document.getElementById("reward-goal-name").focus();
      else costInput.focus();
      return;
    }
    const id = document.getElementById("reward-goal-id").value;
    const goals = [...(window.rewardGoals || [])];
    if (id) {
      const idx = goals.findIndex(g => g.id === id);
      if (idx !== -1) goals[idx] = { ...goals[idx], title, cost, emoji: rewardGoalPanelEmoji, member: rewardGoalPanelMember };
    } else {
      goals.push({ id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, cost, emoji: rewardGoalPanelEmoji, member: rewardGoalPanelMember });
    }
    window.rewardGoals = goals;
    saveRewardDataToBoard({ rewardGoals: goals });
    dialog.close();
    renderRewardGoals();
  });

  document.getElementById("btn-delete-reward-goal").addEventListener("click", () => {
    const id = document.getElementById("reward-goal-id").value;
    if (!id) return;
    const btn = document.getElementById("btn-delete-reward-goal");
    // Same two-tap rule as Redeem
    if (btn.getAttribute("data-armed") !== "true") {
      btn.setAttribute("data-armed", "true");
      btn.textContent = "Tap again to delete";
      setTimeout(() => { btn.removeAttribute("data-armed"); btn.textContent = "Delete Goal"; }, 4000);
      return;
    }
    btn.removeAttribute("data-armed");
    btn.textContent = "Delete Goal";
    window.rewardGoals = (window.rewardGoals || []).filter(g => g.id !== id);
    saveRewardDataToBoard({ rewardGoals: window.rewardGoals });
    dialog.close();
    renderRewardGoals();
  });
}
