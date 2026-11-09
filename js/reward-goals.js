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
  const boardId = getSaveBoardId();
  if (boardId && window.db && typeof window.setDoc === "function" && typeof window.doc === "function") {
    try {
      const payload = { ...fields };
      if (typeof window.serverTimestamp === "function") payload.updatedAt = window.serverTimestamp();
      window.setDoc(window.doc(window.db, "boards", boardId), payload, { merge: true })
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

// Remembered between renders so live updates (which re-render often) only
// animate what actually changed:
const rewardGoalShownPct = new Map();   // goal id -> % the bar showed last time
const rewardGoalWasReady = new Map();   // goal id -> was it ready last time
// Data settles in the first few seconds after the page loads (cache, then
// the live board), so a goal "becoming ready" then isn't a real moment.
const REWARD_GOALS_SETTLE_MS = 5000;
const rewardGoalsLoadedAt = Date.now();

function renderRewardGoals() {
  const grid = document.getElementById("rewards-goals-grid");
  if (!grid) return;
  const members = window.familyMembers || [];
  const goals = window.rewardGoals || [];
  const redemptions = window.rewardRedemptions || [];
  const paletteStyle = typeof window.rewardsPaletteStyle === "function"
    ? window.rewardsPaletteStyle
    : (pal) => `--member-primary: ${pal.primary}; --member-light: ${pal.lightBg}; --member-border: ${pal.border}; --member-text: ${pal.text};`;
  const liveScores = typeof window.computeMemberScores === "function" ? window.computeMemberScores() : {};
  const visible = grid.getClientRects().length > 0;
  const settled = Date.now() - rewardGoalsLoadedAt > REWARD_GOALS_SETTLE_MS;
  const justReady = []; // goals that have just crossed into "ready" while someone's watching
  const fills = [];     // [element, target %] to animate after the HTML is in

  const shownMember = rewardGoalsPhoneShown || null;
  grid.innerHTML = members.map(member => {
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(member) : { primary: "#0284c7", lightBg: "#e0f2fe", border: "#7dd3fc", text: "#075985" };
    const balance = getMemberRewardBalance(member);
    // Split for grown-ups: earned this week, and what's left over from before
    const live = (liveScores[member] && liveScores[member].score) || 0;
    const saved = Math.round((balance - live) * 100) / 100;
    const memberGoals = goals.filter(g => g.member === member).sort((a, b) => (a.cost || 0) - (b.cost || 0));
    const recent = redemptions.filter(r => r.member === member)
      .sort((a, b) => String(b.redeemedAt).localeCompare(String(a.redeemedAt)))
      .slice(0, 2);

    const goalsHtml = memberGoals.length ? memberGoals.map(g => {
      const cost = Number(g.cost) || 0;
      const pct = cost > 0 ? Math.min(100, Math.round((balance / cost) * 100)) : 100;
      const ready = balance >= cost && cost > 0;
      const armed = rewardRedeemArmed === g.id;

      // Celebrate only a real change seen on screen, never the first look
      if (visible && settled && rewardGoalWasReady.has(g.id) && !rewardGoalWasReady.get(g.id) && ready) justReady.push(g.id);
      if (visible || !rewardGoalWasReady.has(g.id)) rewardGoalWasReady.set(g.id, ready);
      const fromPct = rewardGoalShownPct.has(g.id) ? rewardGoalShownPct.get(g.id) : pct;
      rewardGoalShownPct.set(g.id, pct);

      const btn = ready
        ? `<button type="button" class="reward-goal-redeem ${armed ? "is-armed" : ""}" data-redeem-goal="${escapeHtml(g.id)}">${armed ? "Tap again to redeem" : "🎉 Redeem"}</button>`
        : `<span class="reward-goal-togo">${formatRewardAmount(cost - balance)} to go</span>`;
      return `
        <div class="reward-goal-row ${ready ? "is-ready" : ""}" data-goal-row="${escapeHtml(g.id)}">
          <button type="button" class="reward-goal-main" data-edit-goal="${escapeHtml(g.id)}" title="Edit goal">
            <span class="reward-goal-emoji">${escapeHtml(g.emoji || "🎁")}</span>
            <span class="reward-goal-text">
              <span class="reward-goal-title">${escapeHtml(g.title)}</span>
              <span class="reward-goal-cost">${formatRewardAmount(Math.min(balance, cost))} of ${formatRewardAmount(cost)}</span>
            </span>
          </button>
          <div class="reward-goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeHtml(g.title)}: ${pct}%">
            <div class="reward-goal-bar-fill" data-fill-goal="${escapeHtml(g.id)}" data-pct="${pct}" style="width: ${fromPct}%;">
              <span class="reward-goal-bar-star" aria-hidden="true">${ready ? "🌟" : "⭐"}</span>
            </div>
          </div>
          <div class="reward-goal-action">${btn}</div>
        </div>`;
    }).join("") : `<p class="reward-goals-empty">No goals yet. What is ${escapeHtml(member)} saving up for?</p>`;

    const recentHtml = recent.length ? `
      <div class="reward-goals-recent">
        ${recent.map(r => `<span>✓ ${escapeHtml(r.emoji || "🎁")} ${escapeHtml(r.title)} · ${new Date(r.redeemedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>`).join("")}
      </div>` : "";

    const splitHtml = `
      <div class="reward-goals-split">
        <span class="reward-goals-chip">⭐ This week <strong>${formatRewardAmount(live)}</strong></span>
        ${saved > 0 ? `<span class="reward-goals-chip">🏦 Saved <strong>${formatRewardAmount(saved)}</strong></span>` : ""}
      </div>`;

    return `
      <div class="reward-goals-member" data-goals-member="${escapeHtml(member)}" style="${paletteStyle(pal)}">
        <div class="reward-goals-member-head">
          <button type="button" class="reward-goals-avatar" data-rw-bounce aria-label="${escapeHtml(member)}">${escapeHtml(member.charAt(0).toUpperCase())}</button>
          <div class="reward-goals-member-names">
            <span class="reward-goals-member-name">${escapeHtml(member)}</span>
            <span class="reward-goals-balance"><strong>${formatRewardAmount(balance)}</strong> to spend</span>
          </div>
        </div>
        ${splitHtml}
        <div class="reward-goals-list">${goalsHtml}</div>
        ${recentHtml}
        <button type="button" class="reward-goals-add" data-add-goal-for="${escapeHtml(member)}">+ Add goal</button>
      </div>`;
  }).join("");

  renderRewardGoalsTabs(grid, shownMember);

  // Bars grow from where they were to where they are now
  grid.querySelectorAll("[data-fill-goal]").forEach(el => fills.push(el));
  if (fills.length) {
    void grid.offsetWidth; // lock in the starting widths so the change animates
    fills.forEach(el => { el.style.width = `${el.getAttribute("data-pct")}%`; });
  }

  // Someone just reached a goal: a burst of confetti in their colour
  if (justReady.length) {
    const reduce = typeof window.rewardsReduceMotion === "function" && window.rewardsReduceMotion();
    justReady.forEach(id => {
      const row = grid.querySelector(`[data-goal-row="${CSS.escape(id)}"]`);
      if (!row) return;
      if (!reduce) row.classList.add("is-just-ready");
      const goal = goals.find(g => g.id === id);
      const pal = goal && typeof window.getMemberPalette === "function" ? window.getMemberPalette(goal.member) : null;
      if (typeof window.rewardsConfettiFrom === "function") window.rewardsConfettiFrom(row, pal ? [pal.primary, pal.border] : null);
    });
    try {
      if (typeof sfx !== "undefined" && sfx && typeof sfx.playCelebrationChime === "function") sfx.playCelebrationChime();
    } catch (e) {}
  }

  if (!grid.hasAttribute("data-wired")) {
    grid.setAttribute("data-wired", "true");
    grid.addEventListener("click", onRewardGoalsGridClick);
  }
}
window.renderRewardGoals = renderRewardGoals;

// With a parent PIN set, adding/editing goals and redeeming need the PIN
const rewardParentOk = (reason) => (window.ParentPin ? window.ParentPin.require(reason) : Promise.resolve(true));

async function onRewardGoalsGridClick(e) {
  const addBtn = e.target.closest("[data-add-goal-for]");
  if (addBtn) {
    const who = addBtn.getAttribute("data-add-goal-for");
    if (await rewardParentOk("reward goals")) openRewardGoalPanel(null, who);
    return;
  }

  const editBtn = e.target.closest("[data-edit-goal]");
  if (editBtn) {
    const goalId = editBtn.getAttribute("data-edit-goal");
    if (await rewardParentOk("reward goals")) openRewardGoalPanel(goalId);
    return;
  }

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
    if (!(await rewardParentOk("rewards"))) { renderRewardGoals(); return; }
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
    // Confetti in their colour (skipped for reduced motion), and the trophy chime
    const reduce = typeof window.rewardsReduceMotion === "function" && window.rewardsReduceMotion();
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(goal.member) : null;
    if (!reduce && typeof window.confetti === "function") {
      window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: pal ? [pal.primary, pal.border, "#facc15", "#ffffff"] : undefined });
    }
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
  if (!goal) focusAfterPanelOpens(document.getElementById("reward-goal-name"));
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


// ============================================================================
// PHONES: ONE PERSON AT A TIME (same as Tasks)
// Four tall goal cards stacked made the page three screens long. On phones
// a row of tabs (avatar, name, points to spend) sits over full-width cards
// that snap as you swipe; tap a tab to jump. Tablets keep the grid.
// ============================================================================
var rewardGoalsPhoneShown = null;
var rewardGoalsTabScrollUntil = 0;
function rewardGoalsIsPhone() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;
}
function rewardGoalsShownByScroll(grid) {
  const cards = [...grid.querySelectorAll(".reward-goals-member")];
  if (!cards.length || !grid.clientWidth) return null;
  const i = Math.max(0, Math.min(cards.length - 1, Math.round(grid.scrollLeft / grid.clientWidth)));
  return cards[i].getAttribute("data-goals-member");
}
function markRewardGoalsTab(member) {
  document.querySelectorAll("#rewards-goals-tabs .tasks-person-tab").forEach(t => {
    const on = t.getAttribute("data-goals-tab") === member;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
}
function renderRewardGoalsTabs(grid, showMember) {
  let bar = document.getElementById("rewards-goals-tabs");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "rewards-goals-tabs";
    bar.className = "tasks-person-tabs rewards-goals-tabs";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Whose goals");
    grid.parentNode.insertBefore(bar, grid);
    bar.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-goals-tab]");
      if (!tab) return;
      const card = [...grid.querySelectorAll(".reward-goals-member")].find(c => c.getAttribute("data-goals-member") === tab.getAttribute("data-goals-tab"));
      if (!card) return;
      rewardGoalsPhoneShown = tab.getAttribute("data-goals-tab");
      rewardGoalsTabScrollUntil = Date.now() + 700;
      const reduce = typeof window.rewardsReduceMotion === "function" && window.rewardsReduceMotion();
      grid.scrollTo({ left: card.offsetLeft - grid.offsetLeft, behavior: reduce ? "auto" : "smooth" });
      markRewardGoalsTab(rewardGoalsPhoneShown);
    });
    let raf = 0;
    grid.addEventListener("scroll", () => {
      if (raf || !rewardGoalsIsPhone()) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (Date.now() < rewardGoalsTabScrollUntil) return;
        rewardGoalsPhoneShown = rewardGoalsShownByScroll(grid);
        markRewardGoalsTab(rewardGoalsPhoneShown);
      });
    }, { passive: true });
  }
  const cards = [...grid.querySelectorAll(".reward-goals-member")];
  bar.innerHTML = cards.map(card => {
    const m = card.getAttribute("data-goals-member");
    const avatar = card.querySelector(".reward-goals-avatar");
    const bal = card.querySelector(".reward-goals-balance strong");
    const color = avatar ? getComputedStyle(avatar).backgroundColor : "#94a3b8";
    return `<button type="button" class="tasks-person-tab" role="tab" data-goals-tab="${escapeHtml(m)}" style="--tab-color: ${color};">
      <span class="tasks-person-tab-avatar">${escapeHtml(m.charAt(0).toUpperCase())}</span>
      <span class="tasks-person-tab-name">${escapeHtml(m)}</span>
      <span class="tasks-person-tab-tally">${bal ? escapeHtml(bal.textContent.trim()) : ""}</span>
    </button>`;
  }).join("");
  if (!rewardGoalsIsPhone()) return;
  const target = cards.find(c => c.getAttribute("data-goals-member") === showMember) || cards[0];
  if (target) grid.scrollLeft = target.offsetLeft - grid.offsetLeft;
  rewardGoalsPhoneShown = target ? target.getAttribute("data-goals-member") : null;
  markRewardGoalsTab(rewardGoalsPhoneShown);
}
