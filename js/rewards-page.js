// ============================================================================
// REWARDS PAGE (js/rewards-page.js)
// Agreed with Steven, 10 Nov:
//   1. "This week's stars" at the top: a bar for each person, with their
//      buddy and a crown for whoever's ahead. No places and no "last".
//   2. Under it, the family goal: everyone's stars this week add up to one
//      treat together ("Together: 124 of 200 towards Pizza and film night").
//   3. A card for each person, grown-ups too: today's jobs as a ring, points
//      to spend, the goal they're saving for (with a photo), their best
//      streak and their stickers. A person with no goal gets a quiet
//      "＋ Set a goal for Ava". Tap a card for everything else.
//   On phones the cards are one person per swipe, with tabs above.
//
// Stickers are earned from real things that happened, kept on the board so
// they stay once earned: rewardStickers: { "ava": { first: "2026-11-10" } }.
// Everything else here is worked out from the chores, goals and the banked
// weeks in js/reward-goals.js.
// ============================================================================
(function () {
  const STICKERS = [
    { id: "first", emoji: "⭐", name: "First job", how: "Do a first job" },
    { id: "streak7", emoji: "🔥", name: "7 days in a row", how: "Do a daily job 7 days running" },
    { id: "points50", emoji: "💯", name: "50 points", nameMoney: "First £5", how: "Earn 50 points", howMoney: "Earn £5" },
    { id: "big", emoji: "💪", name: "Big job", how: "Do a Big job" },
    { id: "reward", emoji: "🎁", name: "First reward", how: "Spend points on a reward" },
    { id: "team", emoji: "🤝", name: "Team goal", how: "Reach a family goal together" }
  ];

  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const lower = (n) => String(n || "").trim().toLowerCase();
  const members = () => window.familyMembers || [];
  const money = () => { const s = window.boardSettings || {}; return { isMoney: s.gameMode === "money", currency: s.currency || "£" }; };
  const fmt = (v) => (typeof formatRewardAmount === "function" ? formatRewardAmount(v) : String(v));
  const palette = (name) => (typeof window.rewardsPalette === "function" ? window.rewardsPalette(name) : { primary: "#0284c7", lightBg: "#e0f2fe", border: "#7dd3fc", text: "#075985" });
  const palStyle = (name) => (typeof window.rewardsPaletteStyle === "function" ? window.rewardsPaletteStyle(palette(name)) : "");
  const reduceMotion = () => typeof window.rewardsReduceMotion === "function" && window.rewardsReduceMotion();
  const weekKey = () => (typeof getIsoWeekKey === "function" ? getIsoWeekKey() : "");
  const dateKey = (d = new Date()) => (window.Streaks ? window.Streaks.keyOf(d) : d.toISOString().slice(0, 10));
  const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches;

  // ---- Who did what ---------------------------------------------------------------------
  function completersOf(val) {
    if (!val) return [];
    if (val === "Team Effort") return members().map(lower);
    const list = Array.isArray(val) ? val : String(val).split(",");
    return list.map(s => lower(typeof normalizeFamilyMemberName === "function" ? normalizeFamilyMemberName(String(s).trim()) : s));
  }
  function scoresThisWeek() {
    return typeof window.computeMemberScores === "function" ? window.computeMemberScores(weekKey()) : {};
  }
  // Everything they've ever earned (banked weeks and this week), before spending
  function lifetimeEarned(name, live) {
    const thisWeek = weekKey();
    let banked = 0;
    Object.entries(window.rewardWeeks || {}).forEach(([wk, totals]) => {
      if (wk !== thisWeek && totals) banked += Number(totals[name]) || 0;
    });
    return banked + live;
  }
  // Their own daily jobs, with the streak each one is on
  function dailyJobsOf(name) {
    const me = lower(name);
    const S = window.Streaks;
    if (!S) return [];
    return (window.currentTasks || [])
      .filter(t => S.isDailyTask(t) && (window.getAssigneeNames ? window.getAssigneeNames(t.assignedTo) : []).map(lower).includes(me))
      .map(t => ({ task: t, n: S.streakOf(t) }))
      .sort((a, b) => b.n - a.n);
  }
  // Did a Big job this week
  function didBigJob(name) {
    const me = lower(name);
    const wk = weekKey();
    return (window.currentTasks || []).some(t => {
      if (!t || t.grabSize !== "big") return false;
      if (t.completedDays) {
        const hit = Object.values(t.completedDays).some(rec => {
          if (!rec) return false;
          const by = typeof rec === "object" ? rec.completedBy : rec;
          const recWeek = typeof rec === "object" ? (rec.completedWeek || null) : null;
          return (!recWeek || recWeek === wk) && completersOf(by).includes(me);
        });
        if (hit) return true;
      }
      return !!(t.done && (!t.completedWeek || t.completedWeek === wk) && completersOf(t.completedBy).includes(me));
    });
  }
  // Today's jobs: how many there are and how many are done
  function today(name) {
    if (typeof window.getTasksForColumn !== "function") return { total: 0, done: 0 };
    const d = new Date();
    const jobs = window.getTasksForColumn(name, d) || [];
    const done = jobs.filter(t => typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(t, d, lower(name))).length;
    return { total: jobs.length, done };
  }

  // ---- The family goal ------------------------------------------------------------------
  const familyGoal = () => {
    const g = window.familyRewardGoal;
    return g && g.title && Number(g.target) > 0 ? g : null;
  };
  function familyTotal(scores) {
    return Math.round(members().reduce((sum, m) => sum + ((scores[m] && scores[m].score) || 0), 0) * 100) / 100;
  }

  // ---- Stickers ------------------------------------------------------------------------
  function stickerName(s) { return money().isMoney && s.nameMoney ? s.nameMoney : s.name; }
  function stickerHow(s) { return money().isMoney && s.howMoney ? s.howMoney : s.how; }
  const storedStickers = (name) => ((window.rewardStickers || {})[lower(name)]) || {};
  function earnedNow(name, ctx) {
    const live = (ctx.scores[name] && ctx.scores[name].score) || 0;
    const earned = lifetimeEarned(name, live);
    const got = new Set();
    if (earned > 0) got.add("first");
    if (dailyJobsOf(name).some(j => j.n >= 7)) got.add("streak7");
    if (earned >= (money().isMoney ? 5 : 50)) got.add("points50");
    if (didBigJob(name)) got.add("big");
    if ((window.rewardRedemptions || []).some(r => r.member === name)) got.add("reward");
    if (ctx.goal && ctx.total >= Number(ctx.goal.target)) got.add("team");
    return got;
  }
  const freshStickers = new Set(); // "ava:first", earned while this page was open: they glow
  function saveSticker(name, id, day) {
    const key = lower(name);
    window.rewardStickers = { ...(window.rewardStickers || {}), [key]: { ...storedStickers(name), [id]: day } };
    if (typeof window.cacheRewardData === "function") window.cacheRewardData();
    const sync = window.BoardSync;
    if (sync && sync.writeFields([[["rewardStickers", key, id], day]])) return;
    const boardId = typeof getSaveBoardId === "function" ? getSaveBoardId() : null;
    if (boardId && window.db && window.setDoc && window.doc) {
      window.setDoc(window.doc(window.db, "boards", boardId), { rewardStickers: { [key]: { [id]: day } } }, { merge: true }).catch(() => {});
    }
  }
  // New stickers are only given once the board itself has loaded, so a stale
  // saved copy can't hand out one that's already on the board
  function awardStickers(ctx) {
    if (!window.rewardBoardLoaded) return;
    const day = dateKey();
    members().forEach(name => {
      const have = storedStickers(name);
      earnedNow(name, ctx).forEach(id => {
        if (have[id]) return;
        saveSticker(name, id, day);
        if (ctx.watching) {
          freshStickers.add(`${lower(name)}:${id}`);
          const s = STICKERS.find(x => x.id === id);
          if (s && typeof window.showActionToast === "function") window.showActionToast({ icon: s.emoji, title: `${name} got a sticker`, text: stickerName(s), ms: 5000 });
        }
      });
    });
  }
  function stickersOf(name) {
    const have = storedStickers(name);
    return STICKERS.map(s => ({ ...s, on: have[s.id] || null, fresh: freshStickers.has(`${lower(name)}:${s.id}`) }));
  }

  // ---- Small pieces --------------------------------------------------------------------
  function face(name, cls = "") {
    const B = window.Buddies;
    const id = B && B.getMemberBuddy ? B.getMemberBuddy(name) : null;
    if (id && B.svgFor) return `<span class="rw-face is-buddy ${cls}" aria-hidden="true">${B.svgFor(id)}</span>`;
    return `<span class="rw-face ${cls}" aria-hidden="true">${esc(String(name).charAt(0).toUpperCase())}</span>`;
  }
  function ring(done, total) {
    const r = 20;
    const c = 2 * Math.PI * r;
    const pct = total > 0 ? done / total : 0;
    const label = total > 0 ? `${done} of ${total} today` : "No jobs today";
    return `
      <span class="rw-ring ${total > 0 && done >= total ? "is-full" : ""}" role="img" aria-label="${label}">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle class="rw-ring-track" cx="24" cy="24" r="${r}"/><circle class="rw-ring-fill" cx="24" cy="24" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>
        <span class="rw-ring-text">${total > 0 ? (done >= total ? "✓" : `${done}/${total}`) : "–"}</span>
      </span>`;
  }
  function photoBox(goal, cls = "") {
    const url = window.RewardPhotos ? window.RewardPhotos.photoFor(goal) : null;
    return url
      ? `<span class="rw-goal-photo ${cls}" style="background-image: url('${url}')" aria-hidden="true"></span>`
      : `<span class="rw-goal-photo is-emoji ${cls}" aria-hidden="true">${esc(goal.emoji || "🎁")}</span>`;
  }

  // ---- Goals ------------------------------------------------------------------------------
  const shownPct = new Map();  // goal id -> % its bar showed last time
  const wasReady = new Map();  // goal id -> was it ready last time
  const SETTLE_MS = 5000;      // data settles in the first seconds after loading
  const loadedAt = Date.now();
  const goalsOf = (name) => (window.rewardGoals || []).filter(g => g.member === name).sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  // The goal on their card: one they can have now, else the nearest one
  function currentGoal(name, balance) {
    const goals = goalsOf(name);
    return goals.find(g => balance >= (Number(g.cost) || 0)) || goals[0] || null;
  }
  function goalState(g, balance, ctx) {
    const cost = Number(g.cost) || 0;
    const pct = cost > 0 ? Math.min(100, Math.round((Math.max(0, balance) / cost) * 100)) : 100;
    const ready = cost > 0 && balance >= cost;
    if (ctx.watching && ctx.settled && wasReady.has(g.id) && !wasReady.get(g.id) && ready) ctx.justReady.push(g);
    if (ctx.watching || !wasReady.has(g.id)) wasReady.set(g.id, ready);
    return { cost, pct, ready };
  }
  function barHtml(g, pct, ready) {
    const key = `${g.id}`;
    const from = shownPct.has(key) ? shownPct.get(key) : pct;
    shownPct.set(key, pct);
    return `
      <span class="rw-goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(g.title)}: ${pct}%">
        <span class="rw-goal-bar-fill" data-rw-fill="${pct}" style="width: ${from}%;"><span aria-hidden="true">${ready ? "🌟" : "⭐"}</span></span>
      </span>`;
  }
  function actionHtml(g, cost, balance, ready) {
    const armed = typeof window.rewardRedeemArmedId === "function" && window.rewardRedeemArmedId() === g.id;
    return ready
      ? `<button type="button" class="rw-redeem ${armed ? "is-armed" : ""}" data-redeem-goal="${esc(g.id)}">${armed ? "Tap again to redeem" : "🎉 Redeem"}</button>`
      : `<span class="rw-goal-togo">${fmt(cost - balance)} to go</span>`;
  }

  // ---- 1. This week's stars ---------------------------------------------------------------
  const shownLb = new Map(); // name -> % width last time
  function leaderboardHtml(ctx) {
    const order = members().map((name, i) => ({ name, i, score: (ctx.scores[name] && ctx.scores[name].score) || 0 }))
      .sort((a, b) => (b.score - a.score) || (a.i - b.i));
    const top = order.length ? order[0].score : 0;
    const rows = order.map(m => {
      const pct = top > 0 && m.score > 0 ? Math.max(4, Math.round((m.score / top) * 100)) : 0;
      const from = shownLb.has(m.name) ? shownLb.get(m.name) : pct;
      shownLb.set(m.name, pct);
      const leader = top > 0 && m.score === top;
      return `
        <li class="rw-lb-row ${leader ? "is-leader" : ""}" style="${palStyle(m.name)}" data-rw-bounce data-lb-person="${esc(m.name)}">
          <span class="rw-lb-face">${face(m.name)}${leader ? `<span class="rw-lb-crown" aria-hidden="true">👑</span>` : ""}</span>
          <span class="rw-lb-name">${esc(m.name)}</span>
          <span class="rw-lb-track" aria-hidden="true"><span class="rw-lb-fill" data-rw-fill="${pct}" style="width: ${from}%;"></span></span>
          <span class="rw-lb-score">${fmt(m.score)}</span>
        </li>`;
    }).join("");
    const note = top > 0 ? "" : `<p class="rw-lb-note">No stars yet this week. Every job ticked fills a bar.</p>`;
    return `<ol class="rw-lb-list" aria-label="This week's stars">${rows}</ol>${note}`;
  }

  // ---- 2. The family goal -----------------------------------------------------------------
  function familyHtml(ctx) {
    const g = ctx.goal;
    if (!g) {
      return `
        <button type="button" class="rw-family-add" data-family-goal>
          <span class="rw-family-add-plus" aria-hidden="true">＋</span>
          <span><strong>Set a family goal</strong><small>Everyone's stars this week add up to one treat together</small></span>
        </button>`;
    }
    const target = Number(g.target) || 0;
    const pct = Math.min(100, Math.round((ctx.total / target) * 100));
    const done = ctx.total >= target;
    const from = shownPct.has("family") ? shownPct.get("family") : pct;
    shownPct.set("family", pct);
    if (ctx.watching && ctx.settled && wasReady.has("family") && !wasReady.get("family") && done) ctx.familyJustDone = true;
    if (ctx.watching || !wasReady.has("family")) wasReady.set("family", done);
    return `
      <div class="rw-family ${done ? "is-done" : ""}">
        ${photoBox(g, "rw-family-photo")}
        <div class="rw-family-words">
          <p class="rw-family-line">${done
            ? `🎉 <strong>You did it!</strong> ${esc(g.title)} is on.`
            : `<strong>Together: ${fmt(ctx.total)} of ${fmt(target)}</strong> towards ${esc(g.title)}`}</p>
          <span class="rw-family-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Family goal: ${pct}%">
            <span class="rw-family-fill" data-rw-fill="${pct}" style="width: ${from}%;"></span>
          </span>
          <small class="rw-family-sub">${done ? "Everyone's stars this week got there." : `${fmt(target - ctx.total)} to go this week, all of you together`}</small>
        </div>
        <button type="button" class="rw-family-edit" data-family-goal aria-label="Change the family goal">✎</button>
      </div>`;
  }

  // ---- 3. A card for each person ---------------------------------------------------------
  function personCardHtml(name, ctx) {
    const balance = typeof window.getMemberRewardBalance === "function" ? window.getMemberRewardBalance(name) : 0;
    const t = today(name);
    const goals = goalsOf(name);
    const g = currentGoal(name, balance);
    const best = dailyJobsOf(name)[0];
    const stickers = stickersOf(name).filter(s => s.on);

    let goalHtml;
    if (g) {
      // Every goal's state is tracked, so any that just became ready celebrates
      goals.filter(x => x !== g).forEach(x => goalState(x, balance, ctx));
      const st = goalState(g, balance, ctx);
      const more = goals.length - 1;
      goalHtml = `
        <div class="rw-card-goal ${st.ready ? "is-ready" : ""}" data-goal-row="${esc(g.id)}">
          ${photoBox(g)}
          <div class="rw-card-goal-words">
            <span class="rw-card-goal-title">${esc(g.title)}</span>
            ${barHtml(g, st.pct, st.ready)}
            <span class="rw-card-goal-foot">${actionHtml(g, st.cost, balance, st.ready)}${more > 0 ? `<span class="rw-card-more">+${more} more</span>` : ""}</span>
          </div>
        </div>`;
    } else {
      goalHtml = `<button type="button" class="rw-card-setgoal" data-add-goal-for="${esc(name)}">＋ Set a goal for ${esc(name)}</button>`;
    }

    const streakHtml = best && best.n >= 1
      ? `<span class="rw-chip is-streak" title="${esc(best.task.title)}">🔥 ${best.n} day${best.n === 1 ? "" : "s"}</span>` : "";
    const stickerHtml = stickers.length
      ? `<span class="rw-card-stickers" aria-label="${stickers.length} sticker${stickers.length === 1 ? "" : "s"}">${stickers.map(s => `<span class="rw-sticker-mini ${s.fresh ? "is-fresh" : ""}" title="${esc(stickerName(s))}">${s.emoji}</span>`).join("")}</span>` : "";

    return `
      <article class="rw-person" data-person="${esc(name)}" style="${palStyle(name)}" tabindex="0" aria-label="${esc(name)}: open">
        <header class="rw-person-head">
          ${face(name, "rw-person-face")}
          <span class="rw-person-names">
            <span class="rw-person-name">${esc(name)}</span>
            <span class="rw-person-balance"><strong>${fmt(balance)}</strong> to spend</span>
          </span>
          ${ring(t.done, t.total)}
        </header>
        ${goalHtml}
        ${(streakHtml || stickerHtml) ? `<footer class="rw-person-foot">${streakHtml}${stickerHtml}</footer>` : ""}
      </article>`;
  }

  // Phones: tabs over the cards, one person per swipe (like Tasks)
  let phoneShown = null;
  let tabScrollUntil = 0;
  function markTab(name) {
    document.querySelectorAll("#rewards-people-tabs [data-people-tab]").forEach(t => {
      const on = t.getAttribute("data-people-tab") === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    // Phones: the stars row stands in for the tabs, so it shows whose card is open too
    document.querySelectorAll("#rewards-leaderboard [data-lb-person]").forEach(r => r.classList.toggle("is-shown", isPhone() && r.getAttribute("data-lb-person") === name));
  }
  // Phones: tap a face in the stars row to swipe to that person's card
  function showCard(name) {
    const grid = document.getElementById("rewards-people-grid");
    const card = grid && grid.querySelector(`[data-person="${CSS.escape(name)}"]`);
    if (!card) return;
    phoneShown = name;
    tabScrollUntil = Date.now() + 700;
    grid.scrollTo({ left: card.offsetLeft - grid.offsetLeft, behavior: reduceMotion() ? "auto" : "smooth" });
    markTab(name);
  }
  function renderTabs(grid) {
    const bar = document.getElementById("rewards-people-tabs");
    if (!bar) return;
    bar.innerHTML = members().map(name => `
      <button type="button" class="tasks-person-tab" role="tab" data-people-tab="${esc(name)}" style="--tab-color: ${palette(name).primary};">
        <span class="tasks-person-tab-avatar">${esc(name.charAt(0).toUpperCase())}</span>
        <span class="tasks-person-tab-name">${esc(name)}</span>
      </button>`).join("");
    if (!bar.hasAttribute("data-wired")) {
      bar.setAttribute("data-wired", "true");
      bar.addEventListener("click", (e) => {
        const tab = e.target.closest("[data-people-tab]");
        if (!tab) return;
        const card = grid.querySelector(`[data-person="${CSS.escape(tab.getAttribute("data-people-tab"))}"]`);
        if (!card) return;
        phoneShown = tab.getAttribute("data-people-tab");
        tabScrollUntil = Date.now() + 700;
        grid.scrollTo({ left: card.offsetLeft - grid.offsetLeft, behavior: reduceMotion() ? "auto" : "smooth" });
        markTab(phoneShown);
      });
      let raf = 0;
      grid.addEventListener("scroll", () => {
        if (raf || !isPhone()) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (Date.now() < tabScrollUntil || !grid.clientWidth) return;
          const cards = [...grid.querySelectorAll("[data-person]")];
          const i = Math.max(0, Math.min(cards.length - 1, Math.round(grid.scrollLeft / grid.clientWidth)));
          phoneShown = cards[i] ? cards[i].getAttribute("data-person") : null;
          markTab(phoneShown);
        });
      }, { passive: true });
    }
    if (!isPhone()) return;
    const cards = [...grid.querySelectorAll("[data-person]")];
    const target = cards.find(c => c.getAttribute("data-person") === phoneShown) || cards[0];
    if (target) grid.scrollLeft = target.offsetLeft - grid.offsetLeft;
    phoneShown = target ? target.getAttribute("data-person") : null;
    markTab(phoneShown);
  }

  // ---- The person panel ----------------------------------------------------------------
  let panelPerson = null;
  function panelHtml(name, ctx) {
    const balance = typeof window.getMemberRewardBalance === "function" ? window.getMemberRewardBalance(name) : 0;
    const live = (ctx.scores[name] && ctx.scores[name].score) || 0;
    const saved = Math.round((balance - live) * 100) / 100;
    const goals = goalsOf(name);
    const done = (ctx.scores[name] && ctx.scores[name].tasks) || [];
    const recent = (window.rewardRedemptions || []).filter(r => r.member === name)
      .sort((a, b) => String(b.redeemedAt).localeCompare(String(a.redeemedAt))).slice(0, 3);
    const streaks = dailyJobsOf(name).filter(j => j.n >= 1);
    const when = (k) => { try { return new Date(`${k}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" }); } catch (e) { return k; } };

    const goalRows = goals.map(g => {
      const st = goalState(g, balance, ctx);
      return `
        <div class="rp-goal ${st.ready ? "is-ready" : ""}" data-goal-row="${esc(g.id)}">
          <button type="button" class="rp-goal-main" data-edit-goal="${esc(g.id)}" aria-label="Change ${esc(g.title)}">
            ${photoBox(g, "rp-goal-photo")}
            <span class="rp-goal-words">
              <span class="rp-goal-title">${esc(g.title)}</span>
              <span class="rp-goal-cost">${fmt(Math.min(Math.max(0, balance), st.cost))} of ${fmt(st.cost)}</span>
            </span>
          </button>
          ${barHtml(g, st.pct, st.ready)}
          <span class="rp-goal-action">${actionHtml(g, st.cost, balance, st.ready)}</span>
        </div>`;
    }).join("");

    return `
      <div class="rp-hero" style="${palStyle(name)}">
        ${face(name, "rp-face")}
        <div class="rp-hero-words">
          <span class="rp-balance"><strong>${fmt(balance)}</strong> to spend</span>
          <span class="rp-chips">
            <span class="rw-chip">⭐ This week ${fmt(live)}</span>
            ${saved > 0 ? `<span class="rw-chip">🏦 Saved ${fmt(saved)}</span>` : ""}
          </span>
        </div>
      </div>

      <section class="rp-section" style="${palStyle(name)}">
        <h3 class="rp-head">Saving up for</h3>
        ${goalRows || `<p class="rp-empty">Nothing yet. What would ${esc(name)} like to save up for?</p>`}
        <button type="button" class="rp-add" data-add-goal-for="${esc(name)}">＋ Add a goal</button>
        ${recent.length ? `<p class="rp-recent">${recent.map(r => `✓ ${esc(r.emoji || "🎁")} ${esc(r.title)} · ${new Date(r.redeemedAt).toLocaleDateString([], { day: "numeric", month: "short" })}`).join("<br>")}</p>` : ""}
      </section>

      <section class="rp-section">
        <h3 class="rp-head">Stickers</h3>
        <div class="rp-stickers">
          ${stickersOf(name).map(s => `
            <span class="rp-sticker ${s.on ? "is-on" : ""} ${s.fresh ? "is-fresh" : ""}">
              <span class="rp-sticker-emoji" aria-hidden="true">${s.emoji}</span>
              <strong>${esc(stickerName(s))}</strong>
              <small>${s.on ? when(s.on) : esc(stickerHow(s))}</small>
            </span>`).join("")}
        </div>
      </section>

      ${streaks.length ? `
      <section class="rp-section">
        <h3 class="rp-head">Streaks</h3>
        <ul class="rp-list">${streaks.map(j => `<li><span class="rp-streak-n">🔥 ${j.n}</span> ${esc(j.task.title)} <small>${j.n} day${j.n === 1 ? "" : "s"} in a row</small></li>`).join("")}</ul>
      </section>` : ""}

      <section class="rp-section">
        <h3 class="rp-head">Done this week</h3>
        ${done.length ? `<ul class="rp-list">${done.map(t => `<li>✓ ${esc(t)}</li>`).join("")}</ul>` : `<p class="rp-empty">Nothing ticked yet this week.</p>`}
      </section>`;
  }
  function openPerson(name) {
    const dlg = document.getElementById("reward-person-modal");
    if (!dlg) return;
    panelPerson = name;
    document.getElementById("reward-person-title").textContent = name;
    wirePanel(dlg);
    render();
    if (!dlg.open) dlg.showModal();
  }
  function wirePanel(dlg) {
    if (dlg.hasAttribute("data-wired")) return;
    dlg.setAttribute("data-wired", "true");
    document.getElementById("btn-close-reward-person").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => { panelPerson = null; });
    dlg.addEventListener("click", onClick);
  }

  // ---- The family goal panel -----------------------------------------------------------
  let familyPhoto = "";
  function openFamilyGoal() {
    const dlg = document.getElementById("family-goal-modal");
    if (!dlg) return;
    const g = familyGoal();
    const { isMoney, currency } = money();
    familyPhoto = g ? (g.photo || "") : "";
    document.getElementById("family-goal-title").textContent = g ? "Family goal" : "Set a family goal";
    document.getElementById("family-goal-name").value = g ? g.title : "";
    const target = document.getElementById("family-goal-target");
    target.value = g ? g.target : (isMoney ? 20 : 200);
    target.step = isMoney ? "0.5" : "1";
    document.getElementById("family-goal-target-label").textContent = isMoney ? `Everyone together earns (${currency})` : "Everyone's points together";
    const presets = isMoney ? [10, 20, 30, 50] : [100, 150, 200, 300];
    document.getElementById("family-goal-presets").innerHTML = presets.map(p =>
      `<button type="button" class="reward-goal-preset" data-cost="${p}">${isMoney ? `${currency}${p}` : `${p} pts`}</button>`).join("");
    document.getElementById("btn-delete-family-goal").style.display = g ? "" : "none";
    document.getElementById("btn-save-family-goal").textContent = g ? "Save" : "Set goal";
    paintFamilyPhotos();
    wireFamilyPanel(dlg);
    if (!dlg.open) dlg.showModal();
    if (!g && typeof window.focusAfterPanelOpens === "function") window.focusAfterPanelOpens(document.getElementById("family-goal-name"));
  }
  function paintFamilyPhotos() {
    const row = document.getElementById("family-goal-photos");
    if (row && window.RewardPhotos) row.innerHTML = window.RewardPhotos.pickerHtml(familyPhoto, document.getElementById("family-goal-name").value, "🎉");
  }
  function saveFamilyGoal(value) {
    window.familyRewardGoal = value;
    if (typeof window.cacheRewardData === "function") window.cacheRewardData();
    const sync = window.BoardSync;
    if (sync && sync.writeFields([[["familyGoal"], value || sync.DELETE]])) { render(); return; }
    const boardId = typeof getSaveBoardId === "function" ? getSaveBoardId() : null;
    if (boardId && window.db && window.setDoc && window.doc) {
      window.setDoc(window.doc(window.db, "boards", boardId), { familyGoal: value || null }, { merge: true }).catch(() => {});
    }
    render();
  }
  function wireFamilyPanel(dlg) {
    if (dlg.hasAttribute("data-wired")) return;
    dlg.setAttribute("data-wired", "true");
    const target = document.getElementById("family-goal-target");
    document.getElementById("btn-close-family-goal").addEventListener("click", () => dlg.close());
    document.getElementById("family-goal-name").addEventListener("input", () => { if (!familyPhoto) paintFamilyPhotos(); });
    document.getElementById("family-goal-photos").addEventListener("click", (e) => {
      const b = e.target.closest("[data-photo-pick]");
      if (!b) return;
      familyPhoto = b.getAttribute("data-photo-pick");
      paintFamilyPhotos();
    });
    const step = (dir) => {
      const { isMoney } = money();
      const s = isMoney ? 1 : 10;
      const next = Math.max(s, (Number(target.value) || 0) + dir * s);
      target.value = isMoney ? String(next) : String(Math.round(next));
    };
    document.getElementById("btn-family-target-minus").addEventListener("click", () => step(-1));
    document.getElementById("btn-family-target-plus").addEventListener("click", () => step(1));
    document.getElementById("family-goal-presets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cost]");
      if (b) target.value = b.getAttribute("data-cost");
    });
    document.getElementById("family-goal-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("family-goal-name");
      const title = name.value.trim();
      const n = Math.round((Number(target.value) || 0) * 100) / 100;
      if (!title) { name.focus(); return; }
      if (n <= 0) { target.focus(); return; }
      const value = { title, target: n };
      if (familyPhoto) value.photo = familyPhoto;
      saveFamilyGoal(value);
      dlg.close();
    });
    const del = document.getElementById("btn-delete-family-goal");
    del.addEventListener("click", () => {
      // Two taps, like deleting a goal
      if (del.getAttribute("data-armed") !== "true") {
        del.setAttribute("data-armed", "true");
        del.textContent = "Tap again to remove";
        setTimeout(() => { del.removeAttribute("data-armed"); del.textContent = "Remove goal"; }, 4000);
        return;
      }
      del.removeAttribute("data-armed");
      del.textContent = "Remove goal";
      saveFamilyGoal(null);
      dlg.close();
    });
  }

  // ---- Taps ------------------------------------------------------------------------------
  const parentOk = (reason) => (window.ParentPin ? window.ParentPin.require(reason) : Promise.resolve(true));
  async function onClick(e) {
    if (e.target.closest("[data-redeem-goal], [data-add-goal-for], [data-edit-goal]")) {
      if (typeof window.onRewardGoalClick === "function") window.onRewardGoalClick(e);
      return;
    }
    if (e.target.closest("[data-family-goal]")) {
      if (await parentOk("the family goal")) openFamilyGoal();
      return;
    }
    const lb = e.target.closest("[data-lb-person]");
    if (lb && isPhone()) { showCard(lb.getAttribute("data-lb-person")); return; }
    const card = e.target.closest("[data-person]");
    if (card && !e.target.closest("button, a")) openPerson(card.getAttribute("data-person"));
  }
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest && e.target.closest("[data-person]");
    if (!card || e.target !== card) return;
    e.preventDefault();
    openPerson(card.getAttribute("data-person"));
  }

  // ---- Drawing it all ------------------------------------------------------------------
  function grow(root) {
    const fills = [...root.querySelectorAll("[data-rw-fill]")];
    if (!fills.length) return;
    void root.offsetWidth; // lock in the starting widths so the change animates
    fills.forEach(el => { el.style.width = `${el.getAttribute("data-rw-fill")}%`; });
  }
  function render() {
    const lb = document.getElementById("rewards-leaderboard");
    const fam = document.getElementById("rewards-family");
    const grid = document.getElementById("rewards-people-grid");
    if (!lb || !fam || !grid) return;
    const scores = scoresThisWeek();
    const goal = familyGoal();
    const view = document.getElementById("view-rewards");
    const ctx = {
      scores, goal, total: familyTotal(scores),
      watching: !!(view && view.getClientRects().length),
      settled: Date.now() - loadedAt > SETTLE_MS,
      justReady: [], familyJustDone: false
    };
    awardStickers(ctx);

    lb.innerHTML = leaderboardHtml(ctx);
    fam.innerHTML = familyHtml(ctx);
    grid.innerHTML = members().map(name => personCardHtml(name, ctx)).join("");
    renderTabs(grid);
    [lb, fam, grid].forEach(grow);

    const dlg = document.getElementById("reward-person-modal");
    const body = document.getElementById("reward-person-body");
    if (dlg && dlg.open && body && panelPerson && members().includes(panelPerson)) {
      body.innerHTML = panelHtml(panelPerson, ctx);
      grow(body);
    } else if (body && panelPerson) {
      body.innerHTML = panelHtml(panelPerson, ctx);
    }

    if (view && !view.hasAttribute("data-rp-wired")) {
      view.setAttribute("data-rp-wired", "true");
      view.addEventListener("click", onClick);
      view.addEventListener("keydown", onKey);
    }

    // Someone just reached a goal, or the family did: confetti and a chime
    const bursts = ctx.justReady.map(g => ({ el: document.querySelector(`#rewards-people-grid [data-goal-row="${CSS.escape(g.id)}"]`), pal: palette(g.member) }));
    if (ctx.familyJustDone) bursts.push({ el: fam, pal: null });
    if (bursts.length) {
      bursts.forEach(b => {
        if (b.el && !reduceMotion()) b.el.classList.add("is-just-ready");
        if (typeof window.rewardsConfettiFrom === "function") window.rewardsConfettiFrom(b.el, b.pal ? [b.pal.primary, b.pal.border] : null);
      });
      try { if (window.sfx && typeof window.sfx.playCelebrationChime === "function") window.sfx.playCelebrationChime(); } catch (e) {}
    }
  }

  window.RewardsPage = { render, openPerson, openFamilyGoal, STICKERS, earnedNow: (name) => { const s = scoresThisWeek(); const g = familyGoal(); return [...earnedNow(name, { scores: s, goal: g, total: familyTotal(s) })]; } };
})();
