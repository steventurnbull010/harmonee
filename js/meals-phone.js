// ============================================================================
// THIS WEEK ON A PHONE (js/meals-phone.js)
// Phones (and small tablets) get their own This week, made for one thumb:
//   - One scrolling list of the seven days from today, dinner first: a photo
//     card when it's planned, a big "Plan dinner" when it isn't. Breakfast
//     and lunch are two small buttons under it.
//   - "Plan dinner" opens a sheet of photo ideas: tap one and it's planned.
//     "Show me others", a search, and "Type it" or "More choices" (the full
//     Plan Meal panel) for anything else. No dragging: on a phone the place
//     you'd drop on is usually off the bottom of the screen.
//   - Tap a planned meal for its details, where it can be moved to another
//     day or taken off the plan.
// Shown where the phone layout shows (css: up to 768px); tablets keep the grid.
// ============================================================================
(function () {
  const SLOT_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
  const SLOT_EMOJI = { breakfast: "🥞", lunch: "🥪", dinner: "🍽️" };
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const IDEAS = 4;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const keyOf = (d) => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(d) : d.toISOString().slice(0, 10));
  const dateOf = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
  const mealAt = (key, slot) => { const m = typeof window.getMealForDate === "function" ? window.getMealForDate(key, slot) : null; return m && m.title && String(m.title).trim() ? m : null; };
  // Who's cooking, for "Dinner · Ava cooking". "Not sure yet" isn't a name,
  // so it's left out (just "Dinner" until someone's chosen)
  const cooks = (meal) => String((meal && meal.cook) || "").split(/\s*(?:,|&|\band\b)\s*/).filter(n => n && !/^not sure( yet)?$/i.test(n)).map(n => (/^family$/i.test(n) ? "Everyone" : n)).join(" & ");
  let lastAll = [];

  function dayLabel(key, first) {
    const d = dateOf(key);
    const today = keyOf(new Date());
    const tomorrow = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return keyOf(t); })();
    const name = `${DAYS[d.getDay()]} ${d.getDate()}${first || d.getDate() === 1 ? ` ${MONTHS[d.getMonth()]}` : ""}`;
    return key === today ? `Today · ${name}` : key === tomorrow ? `Tomorrow · ${name}` : name;
  }

  function render(weekKeys, all) {
    const wrap = document.getElementById("skylight-meals-mobile-wrapper");
    if (!wrap || !Array.isArray(weekKeys)) return;
    lastAll = Array.isArray(all) ? all : [];
    let box = document.getElementById("meals-phone-week");
    if (!box) {
      box = document.createElement("div");
      box.id = "meals-phone-week";
      box.className = "meals-phone-week";
      wrap.prepend(box);
      box.addEventListener("click", onClick);
    }
    const photo = (meal, size) => (typeof window.mealPhotoUrl === "function" ? window.mealPhotoUrl(meal, lastAll, size) : "");
    const offset = window.mealsWeekOffset || 0;
    box.innerHTML = `
      ${offset > 0 ? `<button type="button" class="mp-nav" data-mp-week="0">↑ Back to today</button>` : ""}
      ${weekKeys.map((key, i) => {
        const dinner = mealAt(key, "dinner");
        const dPhoto = dinner ? photo(dinner, "medium") : "";
        const small = ["breakfast", "lunch"].map(slot => {
          const m = mealAt(key, slot);
          return m
            ? `<button type="button" class="mp-small is-planned" data-mp-meal data-date="${key}" data-slot="${slot}"><span aria-hidden="true">${esc(m.emoji || SLOT_EMOJI[slot])}</span><span class="mp-small-words"><small>${SLOT_NAMES[slot]}</small>${esc(window.MealDishes ? window.MealDishes.summary(m) : m.title)}</span></button>`
            : `<button type="button" class="mp-small" data-mp-plan data-date="${key}" data-slot="${slot}">＋ ${SLOT_NAMES[slot]}</button>`;
        }).join("");
        return `<section class="mp-day${key === keyOf(new Date()) ? " is-today" : ""}" data-date="${key}">
          <h3 class="mp-day-head">${esc(dayLabel(key, i === 0))}</h3>
          ${dinner
            ? `<button type="button" class="mp-dinner${dPhoto ? " has-photo" : ""}" data-mp-meal data-date="${key}" data-slot="dinner"${dPhoto ? ` style="--mp-photo: url('${esc(dPhoto)}')"` : ""}>
                ${dPhoto ? "" : `<span class="mp-dinner-emoji" aria-hidden="true">${esc(dinner.emoji || "🍽️")}</span>`}
                <span class="mp-dinner-words"><small>Dinner${cooks(dinner) ? ` · ${esc(cooks(dinner))} cooking` : ""}</small><strong>${esc(dinner.title)}</strong>${typeof window.mealMoreDishesHtml === "function" ? window.mealMoreDishesHtml(dinner, "mp-dinner-more") : ""}</span>
              </button>`
            : `<button type="button" class="mp-plan-dinner" data-mp-plan data-date="${key}" data-slot="dinner"><span aria-hidden="true">＋</span> Plan dinner</button>`}
          <div class="mp-small-row">${small}</div>
        </section>`;
      }).join("")}
      <button type="button" class="mp-nav" data-mp-week="${offset + 1}">Next 7 days ↓</button>`;
    // The phone header's 🛒 shows the shopping list's count
    const mini = document.getElementById("meals-grocery-mini-count");
    const big = document.getElementById("grocery-list-count-badge");
    if (mini && big) mini.textContent = big.textContent;
  }

  function onClick(e) {
    const plan = e.target.closest("[data-mp-plan]");
    if (plan) { openPlanSheet(plan.getAttribute("data-date"), plan.getAttribute("data-slot")); return; }
    const meal = e.target.closest("[data-mp-meal]");
    if (meal) {
      const key = meal.getAttribute("data-date"), slot = meal.getAttribute("data-slot");
      const m = mealAt(key, slot);
      if (m && typeof window.openMealDetailsPopover === "function") window.openMealDetailsPopover(m, key, slot);
      return;
    }
    const week = e.target.closest("[data-mp-week]");
    if (week && typeof window.setMealsWeek === "function") { window.setMealsWeek(parseInt(week.getAttribute("data-mp-week"), 10) || 0); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  // ---- "Plan dinner · Wed 11": tap a photo and it's planned ------------------------
  // add: adding another dish to the meal already planned (from its meal screen)
  let sheet = { date: "", slot: "dinner", picks: [], shown: new Set(), add: false };
  const isMeal = (r, slot) => String(r.mealType || r.category || "dinner").toLowerCase() === slot;
  const hasPhoto = (r) => !!(r && (r.image || r.imageUrl));
  const isOwn = (r) => !String(r.id || "").startsWith("mealdb-");
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // Adding a dish: the family's own recipes first (photo or not, puddings
  // too), then ideas with photos for that meal or for pudding
  function inMeal() {
    const m = mealAt(sheet.date, sheet.slot);
    return window.MealDishes ? window.MealDishes.dishesOf(m) : [];
  }
  function pickAddIdeas() {
    const there = inMeal();
    const notThere = (r) => !there.some(d => (d.recipeId != null && String(d.recipeId) === String(r.id)) || d.title === r.title);
    const all = (window.RecipeRows ? window.RecipeRows.all() : lastAll).filter(r => notThere(r) && !sheet.shown.has(r.id));
    const own = all.filter(isOwn).slice(0, 8);
    const pud = (r) => window.MealDishes && window.MealDishes.isPudding(r);
    const stock = shuffle(all.filter(r => !isOwn(r) && hasPhoto(r) && (isMeal(r, sheet.slot) || pud(r))));
    // A pudding among the ideas when there isn't one yet
    const wantPud = !there.some(d => d.course === "pudding") && !own.some(pud);
    const fill = wantPud ? [...stock.filter(pud).slice(0, 1), ...stock.filter(r => !pud(r))] : stock;
    let picks = [...own, ...fill].slice(0, Math.max(IDEAS, own.length + (own.length % 2)));
    if (picks.length < IDEAS) sheet.shown = new Set();
    picks.forEach(r => sheet.shown.add(r.id));
    return picks;
  }
  function pickIdeas() {
    if (sheet.add) return pickAddIdeas();
    const all = (window.RecipeRows ? window.RecipeRows.all() : lastAll).filter(r => hasPhoto(r) && isMeal(r, sheet.slot) && !sheet.shown.has(r.id));
    const fits = (r) => !window.MealGenie || !window.MealGenie.fitsEveryone || window.MealGenie.fitsEveryone(r);
    const own = shuffle(all.filter(isOwn)).slice(0, 1);
    let pool = all.filter(r => !isOwn(r));
    if (pool.filter(fits).length >= IDEAS) pool = pool.filter(fits);
    let picks = [...own, ...shuffle(pool)].slice(0, IDEAS);
    if (picks.length < IDEAS) { sheet.shown = new Set(); }
    picks.forEach(r => sheet.shown.add(r.id));
    return picks;
  }
  const tileImg = (r) => { const src = String(r.image || r.imageUrl || ""); return /^https:\/\/www\.themealdb\.com\/images\/[\w\/.-]+\.(jpg|png)$/i.test(src) ? `${src}/small` : src; };
  function tiles(list) {
    return list.map(r => `<button type="button" class="mp-idea" data-mp-pick="${esc(r.id)}">
        ${hasPhoto(r) ? `<span class="mp-idea-photo" style="background-image: url('${esc(tileImg(r))}')" aria-hidden="true"></span>` : `<span class="mp-idea-photo is-emoji" aria-hidden="true">${esc(r.emoji || (window.MealDishes && window.MealDishes.isPudding(r) ? "🍮" : "🍽️"))}</span>`}
        <span class="mp-idea-name">${esc(r.title)}</span>
      </button>`).join("");
  }
  function sheetBox() {
    let d = document.getElementById("meal-quick-plan");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "meal-quick-plan";
    d.className = "meal-quick-plan";
    d.setAttribute("aria-labelledby", "mqp-title");
    document.body.appendChild(d);
    d.addEventListener("click", (e) => {
      if (e.target === d) { d.close(); return; }
      const pick = e.target.closest("[data-mp-pick]");
      if (pick) {
        const r = (window.RecipeRows ? window.RecipeRows.find(pick.getAttribute("data-mp-pick")) : null);
        if (r && typeof window.planRecipeOn === "function") { d.close(); window.planRecipeOn(r, sheet.date, sheet.slot, { add: sheet.add }); }
        return;
      }
      if (e.target.closest("[data-mqp-others]")) { d.querySelector("[data-mqp-grid]").innerHTML = tiles(pickIdeas()); return; }
      if (e.target.closest("[data-mqp-close]")) { d.close(); return; }
      const more = e.target.closest("[data-mqp-more]");
      if (more) {
        d.close();
        if (typeof window.openPlanMealDrawer === "function") {
          window.openPlanMealDrawer(sheet.date, sheet.slot);
          if (more.getAttribute("data-mqp-more") === "type") { const t = document.getElementById("tab-new-entry"); if (t) t.click(); }
        }
      }
    });
    d.addEventListener("input", (e) => {
      if (!e.target.matches("[data-mqp-search]")) return;
      const q = e.target.value.trim().toLowerCase();
      const grid = d.querySelector("[data-mqp-grid]");
      const head = d.querySelector("[data-mqp-grid-head]");
      if (!q) { grid.innerHTML = tiles(sheet.picks); head.textContent = sheet.add ? ideasHead() : "A few ideas"; return; }
      const hits = (window.RecipeRows ? window.RecipeRows.all() : lastAll).filter(r => (hasPhoto(r) || sheet.add) && (String(r.title || "").toLowerCase().includes(q) || (r.ingredients || []).some(i => String(i).toLowerCase().includes(q))));
      hits.sort((a, b) => Number(isOwn(b)) - Number(isOwn(a)));
      head.textContent = hits.length ? `${hits.length} found` : `Nothing called "${e.target.value.trim()}"`;
      grid.innerHTML = tiles(hits.slice(0, 12));
    });
    return d;
  }
  const ideasHead = () => (sheet.picks.some(isOwn) ? "Your recipes first" : "A few ideas");
  function openPlanSheet(date, slot = "dinner", opts = {}) {
    sheet = { date, slot, picks: [], shown: new Set(), add: !!opts.add };
    sheet.picks = pickIdeas();
    const d = sheetBox();
    // One line each: "Plan dinner · Wed 11", then "Tomorrow · tap one…"
    const full = dayLabel(date, false);
    const when = (full.match(/^(Today|Tomorrow) · /) || [])[1] || "";
    const day = full.replace(/^(Today|Tomorrow) · /, "");
    d.innerHTML = `<div class="mqp-card">
        <div class="mqp-head">
          <div class="mqp-head-words"><h2 class="mqp-title" id="mqp-title">${sheet.add ? "Add to" : "Plan"} ${SLOT_NAMES[slot].toLowerCase()} · ${esc(day)}</h2><p class="mqp-sub">${when ? `${when} · tap` : "Tap"} one and it's ${sheet.add ? "added" : "planned"}</p></div>
          <button type="button" class="mqp-close" data-mqp-close aria-label="Close">✕</button>
        </div>
        <label class="mqp-search"><span aria-hidden="true">🔍</span><input type="search" data-mqp-search placeholder="Search recipes or ingredients" autocomplete="off" aria-label="Search recipes"></label>
        <p class="mqp-grid-head" data-mqp-grid-head>${sheet.add ? ideasHead() : "A few ideas"}</p>
        <div class="mqp-grid" data-mqp-grid>${tiles(sheet.picks)}</div>
        <div class="mqp-actions">
          <button type="button" class="mqp-link" data-mqp-others>↻ Show me others</button>
          ${sheet.add ? "" : `<button type="button" class="mqp-link" data-mqp-more="type">✏️ Type it</button>`}
          <button type="button" class="mqp-link" data-mqp-more="all">More choices</button>
        </div>
      </div>`;
    if (!d.open) d.showModal();
  }

  // ---- Move a planned meal to another day (from its details) ------------------------
  async function moveMeal(fromDate, slot) {
    const meal = mealAt(fromDate, slot);
    if (!meal || !window.Sheet || !window.Sheet.choose) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const options = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = keyOf(d);
      if (key === fromDate) continue;
      const there = mealAt(key, slot);
      options.push({ key, icon: there ? "🔁" : "➡️", label: dayLabel(key, false), sub: there ? `Swap with ${there.title}` : `${SLOT_NAMES[slot]} is free` });
    }
    const to = await window.Sheet.choose({ icon: meal.emoji || "🍽️", title: `Move ${meal.title}`, text: `To which day's ${SLOT_NAMES[slot].toLowerCase()}?`, options, cancel: "Keep it here" });
    if (to && typeof window.moveMealTo === "function") window.moveMealTo({ date: fromDate, slot }, { date: to, slot });
  }

  window.MealsPhone = { render, openPlanSheet, moveMeal };
})();
