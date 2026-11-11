// ============================================================================
// REWARD GOALS & REDEEM (js/reward-goals.js)
// Skylight-style rewards: each person saves up for goals ("Cinema trip, 50
// pts"), sees progress, and redeems when they have enough. Redeeming spends
// the points.
//
// Everything lives on the board doc so every device agrees:
//   rewardGoals:       [{ id, member, title, emoji, cost, once? }]
//                      once: true = gone after it's redeemed (a Lego set);
//                      otherwise it starts again (pocket money), as Skylight's
//                      "Renew after redeeming" (agreed with Steven, 11 Nov)
//   rewardRedemptions: [{ id, goalId, member, title, emoji, cost, redeemedAt }]
//   rewardWeeks:       { "2026-W45": { Ava: 23, Dara: 12, ... }, ... }
//   familyGoal:        { title, target, photo? } (everyone's stars this week)
//   rewardStickers:    { "ava": { first: "2026-11-10", ... } }
// Goals can also have photo: a key from js/reward-photos.js, or "none".
// The page itself is drawn by js/rewards-page.js.
//
// rewardWeeks is written by the Sunday reset in app.js (bankRewardWeek): it
// keeps each finished week's totals, keyed by week, so points carry over
// even though the chores themselves reset. Writing by week key means two
// devices doing the reset at once write the same numbers, never double.
//
// Spendable balance = banked past weeks + this week's live points − redeemed.
// ============================================================================


function rewardDataCacheKey() {
  return (typeof boardCacheKey === "function") ? boardCacheKey("harmonee_reward_goals") : "harmonee_reward_goals";
}

(function loadRewardDataFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(rewardDataCacheKey()) || "null");
    window.rewardGoals = (cached && Array.isArray(cached.goals)) ? cached.goals : [];
    window.rewardRedemptions = (cached && Array.isArray(cached.redemptions)) ? cached.redemptions : [];
    window.rewardWeeks = (cached && cached.weeks && typeof cached.weeks === "object") ? cached.weeks : {};
    window.familyRewardGoal = (cached && cached.familyGoal && typeof cached.familyGoal === "object") ? cached.familyGoal : null;
    window.rewardStickers = (cached && cached.stickers && typeof cached.stickers === "object") ? cached.stickers : {};
    // Until the board arrives, changes are worked out from this saved copy
    if (cached && window.BoardSync) {
      window.BoardSync.setBaseline("rewardGoals", window.rewardGoals);
      window.BoardSync.setBaseline("rewardRedemptions", window.rewardRedemptions);
    }
  } catch (e) {
    window.rewardGoals = [];
    window.rewardRedemptions = [];
    window.rewardWeeks = {};
    window.familyRewardGoal = null;
    window.rewardStickers = {};
  }
})();

function cacheRewardData() {
  try {
    localStorage.setItem(rewardDataCacheKey(), JSON.stringify({
      goals: window.rewardGoals || [],
      redemptions: window.rewardRedemptions || [],
      weeks: window.rewardWeeks || {},
      familyGoal: window.familyRewardGoal || null,
      stickers: window.rewardStickers || {}
    }));
  } catch (e) {}
}
window.cacheRewardData = cacheRewardData;

// Called from the board-doc listener in app.js whenever the board changes
function applyBoardRewardData(data) {
  if (!data) return;
  let changed = false;
  // This device's unsaved changes stay on top until they're saved (js/board-sync.js)
  const sync = window.BoardSync;
  if (Array.isArray(data.rewardGoals)) {
    window.rewardGoals = sync ? sync.withPending("rewardGoals", data.rewardGoals) : data.rewardGoals;
    if (sync) sync.setBaseline("rewardGoals", window.rewardGoals);
    changed = true;
  }
  if (Array.isArray(data.rewardRedemptions)) {
    window.rewardRedemptions = sync ? sync.withPending("rewardRedemptions", data.rewardRedemptions) : data.rewardRedemptions;
    if (sync) sync.setBaseline("rewardRedemptions", window.rewardRedemptions);
    changed = true;
  }
  if (data.rewardWeeks && typeof data.rewardWeeks === "object") { window.rewardWeeks = data.rewardWeeks; changed = true; }
  // The family goal and stickers: whatever the board has (none is none)
  const fam = data.familyGoal && typeof data.familyGoal === "object" ? data.familyGoal : null;
  if (JSON.stringify(fam) !== JSON.stringify(window.familyRewardGoal || null)) { window.familyRewardGoal = fam; changed = true; }
  const stickers = data.rewardStickers && typeof data.rewardStickers === "object" ? data.rewardStickers : {};
  if (JSON.stringify(stickers) !== JSON.stringify(window.rewardStickers || {})) { window.rewardStickers = stickers; changed = true; }
  // From now on new stickers can be given (js/rewards-page.js)
  if (!window.rewardBoardLoaded) { window.rewardBoardLoaded = true; changed = true; }
  if (changed) {
    cacheRewardData();
    renderRewardGoals();
  }
}
window.applyBoardRewardData = applyBoardRewardData;

function saveRewardDataToBoard(fields) {
  cacheRewardData();
  // Goals and redemptions: only the items that changed, applied to the
  // board's latest list, so two devices redeeming at once both count
  const sync = window.BoardSync;
  if (sync) {
    const rest = { ...fields };
    ["rewardGoals", "rewardRedemptions"].forEach(f => {
      if (Array.isArray(rest[f])) { sync.saveListChanges(f, rest[f]); delete rest[f]; }
    });
    if (rest.rewardWeeks) {
      // Each week by its own key
      sync.writeFields(Object.entries(rest.rewardWeeks).map(([week, totals]) => [["rewardWeeks", week], totals]));
      delete rest.rewardWeeks;
    }
    if (!Object.keys(rest).length) return;
    fields = rest;
  }
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

window.rewardRedeemArmedId = () => rewardRedeemArmed;

// The page (leaderboard, family goal, person cards) is drawn by
// js/rewards-page.js; everything here that changes a goal redraws it
function renderRewardGoals() {
  if (window.RewardsPage) window.RewardsPage.render();
}
window.renderRewardGoals = renderRewardGoals;

// With a parent PIN set, adding/editing goals and redeeming need the PIN
const rewardParentOk = (reason) => (window.ParentPin ? window.ParentPin.require(reason) : Promise.resolve(true));

async function onRewardGoalClick(e) {
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
window.onRewardGoalClick = onRewardGoalClick;

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
  if (goal.once) {
    // A one-off: it's had, so it leaves their card (its own photo goes too)
    if (goal.photo === "own" && window.RecipePhotos) window.RecipePhotos.remove(`goal-${goal.id}`);
    window.rewardGoals = (window.rewardGoals || []).filter(g => g.id !== goal.id);
    saveRewardDataToBoard({ rewardRedemptions: window.rewardRedemptions, rewardGoals: window.rewardGoals });
  } else {
    saveRewardDataToBoard({ rewardRedemptions: window.rewardRedemptions });
  }
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
// The photo chooser's state (js/reward-photos.js): choice "" (picked for you),
// a stock key, "own" or "none"
let rewardGoalPhoto = { choice: "", title: "", own: "", ownNew: false, open: false };
let rewardGoalOnce = false;
let rewardGoalMoreIdeas = false;

// Ideas under "What's the reward?": four to start (pocket money first, the
// one most families want), "More ideas" for the rest. Tapping one fills in
// the name (which picks its photo) and whether it starts again: pocket money
// comes round again, a new toy is a one-off. (Asked for by Steven, 11 Nov.)
// Each name matches its photo in js/reward-photos.js.
const REWARD_GOAL_IDEAS = [
  { title: "Pocket money", emoji: "💷", once: false },
  { title: "Cinema trip", emoji: "🎬", once: false },
  { title: "Screen time", emoji: "📱", once: false },
  { title: "Pizza night", emoji: "🍕", once: false },
  { title: "Day out", emoji: "🎢", once: false },
  { title: "Sleepover", emoji: "⛺", once: false },
  { title: "Stay up late", emoji: "🌙", once: false },
  { title: "Ice cream", emoji: "🍦", once: false },
  { title: "Games night", emoji: "🎲", once: false },
  { title: "Meal out", emoji: "🍽️", once: false },
  { title: "Swimming", emoji: "🏊", once: false },
  { title: "New toy", emoji: "🧸", once: true },
  { title: "New book", emoji: "📚", once: true },
  { title: "Shopping", emoji: "🛍️", once: false },
  { title: "Pamper day", emoji: "🛁", once: false },
  { title: "Night out", emoji: "🍸", once: false }
];
const REWARD_GOAL_IDEAS_SHOWN = 4;

// Who → What's the reward → Photo → Points (a slider with shortcuts). The
// emoji is worked out from the photo (11 Nov: the Icon row went; it was a
// second way of choosing the same thing)
function openRewardGoalPanel(goalId = null, member = null) {
  const dialog = document.getElementById("reward-goal-modal");
  if (!dialog) return;
  const goal = goalId ? (window.rewardGoals || []).find(g => g.id === goalId) : null;
  const P = window.RewardPhotos;

  rewardGoalPanelMember = goal ? goal.member : (member || (window.familyMembers || [])[0] || "");
  rewardGoalPhoto = P ? P.stateFor(goal) : { choice: "", title: "" };
  rewardGoalOnce = !!(goal && goal.once);
  rewardGoalMoreIdeas = false;

  document.getElementById("reward-goal-title").textContent = goal ? "Edit goal" : `New goal${rewardGoalPanelMember ? ` for ${rewardGoalPanelMember}` : ""}`;
  document.getElementById("reward-goal-id").value = goal ? goal.id : "";
  document.getElementById("reward-goal-name").value = goal ? goal.title : "";
  document.getElementById("btn-delete-reward-goal").style.display = goal ? "" : "none";
  document.getElementById("btn-save-reward-goal").textContent = goal ? "Save" : "Add goal";

  const o = P ? P.sliderOptions("person", goal ? goal.cost : null) : null;
  const cost = document.getElementById("reward-goal-cost");
  cost.value = o ? String(o.value) : String(goal ? goal.cost : 50);
  document.getElementById("reward-goal-cost-label").textContent = o && o.money ? `Cost (${o.currency})` : "Points needed";
  const pts = document.getElementById("reward-goal-points");
  if (P && pts) { pts.innerHTML = P.sliderHtml(o); P.wireSlider(pts, cost, o); }

  renderRewardGoalPanelPickers();
  renderRewardGoalRepeat();
  renderRewardGoalIdeas(!goal);
  wireRewardGoalPanel();
  if (!dialog.open) dialog.showModal();
  if (!goal) focusAfterPanelOpens(document.getElementById("reward-goal-name"));
}
window.openRewardGoalPanel = openRewardGoalPanel;

function renderRewardGoalPanelPickers() {
  const membersRow = document.getElementById("reward-goal-members");
  // The same person picker as events and chores (js/utils.js memberPillHtml)
  membersRow.classList.add("drawer-profiles-pills-row");
  membersRow.innerHTML = (window.familyMembers || []).map(m =>
    memberPillHtml(m, { buddy: true, active: m === rewardGoalPanelMember, attrs: `data-member="${escapeHtml(m)}"` })).join("");
  renderRewardGoalPhotos();
}

function renderRewardGoalPhotos() {
  const box = document.getElementById("reward-goal-photo");
  if (!box || !window.RewardPhotos) return;
  rewardGoalPhoto.title = document.getElementById("reward-goal-name").value;
  box.innerHTML = window.RewardPhotos.chooserHtml(rewardGoalPhoto);
  window.RewardPhotos.wireChooser(box, () => rewardGoalPhoto, (next) => { Object.assign(rewardGoalPhoto, next); renderRewardGoalPhotos(); });
}

// The ideas (new goals only; an existing goal already has its name)
function renderRewardGoalIdeas(show) {
  const box = document.getElementById("reward-goal-ideas");
  if (!box) return;
  if (show === false) { box.hidden = true; box.innerHTML = ""; return; }
  if (show === true) box.hidden = false;
  if (box.hidden) return;
  const typed = document.getElementById("reward-goal-name").value.trim().toLowerCase();
  const list = rewardGoalMoreIdeas ? REWARD_GOAL_IDEAS : REWARD_GOAL_IDEAS.slice(0, REWARD_GOAL_IDEAS_SHOWN);
  box.innerHTML = list.map(i => {
    const on = typed === i.title.toLowerCase();
    return `<button type="button" class="reward-goal-idea${on ? " is-on" : ""}" data-idea="${escapeHtml(i.title)}" aria-pressed="${on}"><span aria-hidden="true">${i.emoji}</span>${escapeHtml(i.title)}</button>`;
  }).join("") + `<button type="button" class="reward-goal-idea is-more" data-ideas-more aria-expanded="${rewardGoalMoreIdeas}">${rewardGoalMoreIdeas ? "Fewer ideas" : "More ideas"}</button>`;
}

// Start again (pocket money, screen time) or Remove it (a one-off treat)
function renderRewardGoalRepeat() {
  document.querySelectorAll("#reward-goal-repeat [data-repeat]").forEach(b => {
    const on = (b.getAttribute("data-repeat") === "once") === rewardGoalOnce;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const hint = document.getElementById("reward-goal-repeat-hint");
  if (hint) hint.textContent = rewardGoalOnce
    ? "For a one-off, like a new Lego set: it leaves their card once it's redeemed."
    : "For things they earn again and again, like pocket money or screen time.";
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
  document.getElementById("reward-goal-repeat").addEventListener("click", (e) => {
    const b = e.target.closest("[data-repeat]");
    if (!b) return;
    rewardGoalOnce = b.getAttribute("data-repeat") === "once";
    renderRewardGoalRepeat();
  });
  // Typing the reward picks a photo for it
  document.getElementById("reward-goal-name").addEventListener("input", () => { renderRewardGoalPhotos(); renderRewardGoalIdeas(); });
  document.getElementById("reward-goal-ideas").addEventListener("click", (e) => {
    if (e.target.closest("[data-ideas-more]")) { rewardGoalMoreIdeas = !rewardGoalMoreIdeas; renderRewardGoalIdeas(); return; }
    const b = e.target.closest("[data-idea]");
    const idea = b && REWARD_GOAL_IDEAS.find(i => i.title === b.getAttribute("data-idea"));
    if (!idea) return;
    document.getElementById("reward-goal-name").value = idea.title;
    rewardGoalOnce = idea.once;
    // The photo follows the new name (unless one was chosen by hand)
    if (rewardGoalPhoto.choice !== "own") rewardGoalPhoto.choice = "";
    renderRewardGoalRepeat();
    renderRewardGoalPhotos();
    renderRewardGoalIdeas();
    if (window.sfx && typeof window.sfx.playTick === "function") window.sfx.playTick(0.5);
  });

  const costInput = document.getElementById("reward-goal-cost");
  document.getElementById("reward-goal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("reward-goal-name").value.trim();
    const cost = Math.round((Number(costInput.value) || 0) * 100) / 100;
    if (!title || cost <= 0 || !rewardGoalPanelMember) {
      if (!title) document.getElementById("reward-goal-name").focus();
      return;
    }
    const existingId = document.getElementById("reward-goal-id").value;
    const id = existingId || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const goals = [...(window.rewardGoals || [])];
    const idx = goals.findIndex(g => g.id === id);
    const before = idx !== -1 ? goals[idx] : {};
    let photoFields = { photo: rewardGoalPhoto.choice || "", photoRev: null };
    try { if (window.RewardPhotos) photoFields = await window.RewardPhotos.savePhoto(id, rewardGoalPhoto, before); }
    catch (err) { console.warn("Couldn't save the goal's photo:", err); }
    const next = { ...before, id, title, cost, member: rewardGoalPanelMember };
    if (rewardGoalOnce) next.once = true; else delete next.once;
    if (photoFields.photo) next.photo = photoFields.photo; else delete next.photo;
    if (photoFields.photoRev) next.photoRev = photoFields.photoRev; else delete next.photoRev;
    next.emoji = window.RewardPhotos ? window.RewardPhotos.emojiFor(next) : "🎁";
    if (idx !== -1) goals[idx] = next; else goals.push(next);
    window.rewardGoals = goals;
    saveRewardDataToBoard({ rewardGoals: goals });
    if (typeof sfx !== "undefined" && sfx && typeof sfx.playSuccess === "function") sfx.playSuccess();
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
      setTimeout(() => { btn.removeAttribute("data-armed"); btn.textContent = "Delete goal"; }, 4000);
      return;
    }
    btn.removeAttribute("data-armed");
    btn.textContent = "Delete goal";
    const gone = (window.rewardGoals || []).find(g => g.id === id);
    if (gone && gone.photo === "own" && window.RecipePhotos) window.RecipePhotos.remove(`goal-${id}`);
    window.rewardGoals = (window.rewardGoals || []).filter(g => g.id !== id);
    saveRewardDataToBoard({ rewardGoals: window.rewardGoals });
    dialog.close();
    renderRewardGoals();
  });
}
