// ============================================================================
// A FEW IDEAS (js/meal-ideas.js)
// An empty week is bland and a bit daunting, so above the week sits a row of
// dinner ideas with photos: a couple of your family's own recipes and some
// from the recipe list (ones that suit everyone, if tastes are set in Magic
// Mealtime). A different handful each time you come to Meals; "More" opens
// the Recipes tab.
//
// Drag one onto a free slot to plan it (press and hold on a touch screen),
// or tap it for the recipe card and "Add to meal plan".
// It shows while this week or a later one has two or more free dinners.
// ============================================================================
(function () {
  const COUNT = 6;
  const SHOW_FROM_FREE_DINNERS = 2;
  let picks = null;          // the ideas showing, kept while you're on Meals
  let pickedAt = 0;
  let lastPlanned = new Set();
  let wasShowing = false;    // Meals was on screen last time (else: a new visit)
  let lastWeek = [];
  let lastAll = [];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const SLOT_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayKey = () => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(new Date()) : new Date().toISOString().slice(0, 10));
  const dayLabel = (key) => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d); return `${DAYS[dt.getDay()]} ${d}`; };
  const hasMeal = (key, slot) => { const m = typeof window.getMealForDate === "function" ? window.getMealForDate(key, slot) : null; return !!(m && m.title && String(m.title).trim()); };

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const hasPhoto = (r) => !!(r.image || r.imageUrl);
  const isOwn = (r) => !String(r.id || "").startsWith("mealdb-");
  const isDinner = (r) => String(r.mealType || r.category || "").toLowerCase() === "dinner";

  function choose(all, plannedIds) {
    const fits = (r) => !window.MealGenie || !window.MealGenie.fitsEveryone || window.MealGenie.fitsEveryone(r);
    const fresh = all.filter(r => hasPhoto(r) && isDinner(r) && !plannedIds.has(String(r.id)));
    const own = shuffle(fresh.filter(isOwn)).slice(0, 2);
    let pool = fresh.filter(r => !isOwn(r));
    if (pool.filter(fits).length >= COUNT) pool = pool.filter(fits);
    return [...own, ...shuffle(pool)].slice(0, COUNT).map(r => r.id);
  }

  // Free slots this week, from today on
  function freeDinners(week) {
    const t = todayKey();
    return week.filter(k => k >= t && !hasMeal(k, "dinner")).length;
  }

  function cardPhoto(r) {
    const src = String(r.image || r.imageUrl || "");
    if (/^https:\/\/www\.themealdb\.com\/images\/[\w\/.-]+\.(jpg|png)$/i.test(src)) return `${src}/small`;
    if (window.RecipePhotos && window.RecipePhotos.isDataUrl(src)) return src;
    return /^images\/[\w\/.-]+\.(jpg|jpeg|png|webp)$/i.test(src) ? src : "";
  }

  function render(week, all) {
    const box = document.getElementById("meal-ideas");
    const page = document.getElementById("view-meals");
    if (!box || !Array.isArray(week) || !Array.isArray(all)) return;
    lastWeek = week; lastAll = all;
    const showing = !!(page && page.style.display !== "none");
    if ((showing && !wasShowing) || Date.now() - pickedAt > 10 * 60 * 1000) picks = null; // a new visit: a new handful
    wasShowing = showing;

    if (freeDinners(week) < SHOW_FROM_FREE_DINNERS) { box.hidden = true; box.innerHTML = ""; return; }
    const plannedIds = new Set();
    week.forEach(k => ["breakfast", "lunch", "dinner"].forEach(s => { const m = window.getMealForDate && window.getMealForDate(k, s); if (m && m.recipeId) plannedIds.add(String(m.recipeId)); }));
    lastPlanned = plannedIds;
    if (!picks) { picks = choose(all, plannedIds); pickedAt = Date.now(); }
    let list = picks.map(id => all.find(r => String(r.id) === String(id))).filter(r => r && !plannedIds.has(String(r.id)));
    if (!list.length) { picks = choose(all, plannedIds); pickedAt = Date.now(); list = picks.map(id => all.find(r => String(r.id) === String(id))).filter(Boolean); }
    if (!list.length) { box.hidden = true; return; }

    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    box.hidden = false;
    box.innerHTML = `
      <div class="meal-ideas-head">
        <h3 class="meal-ideas-title">A few ideas</h3>
        <span class="meal-ideas-hint">${touch ? "Hold one and drag it onto a day, or tap it" : "Drag one onto a day, or click it"}</span>
        <button type="button" class="meal-ideas-more" data-meal-ideas-more>More</button>
      </div>
      <div class="meal-ideas-row" role="list">
        ${list.map(r => `<button type="button" class="meal-idea" role="listitem" data-idea-id="${esc(r.id)}" title="${esc(r.title)}">
          <span class="meal-idea-photo" style="background-image: url('${esc(cardPhoto(r))}')" aria-hidden="true"></span>
          <span class="meal-idea-name">${esc(r.title)}</span>
        </button>`).join("")}
      </div>`;
    wireDrag(box);
  }

  function find(id) { return lastAll.find(r => String(r.id) === String(id)) || (window.RecipeRows && window.RecipeRows.find(id)); }

  // Free slots on screen: the grid's empty cells, or the phone's "Add Dinner" buttons
  function freeZones() {
    const t = todayKey();
    const cells = [...document.querySelectorAll("#skylight-meals-matrix .matrix-meal-cell")].filter(c => c.offsetParent && c.querySelector(".meal-empty-slot") && (c.getAttribute("data-date") || "") >= t);
    const phone = [...document.querySelectorAll("#meals-mobile-cards-feed .mobile-slot-empty-btn")].filter(b => b.offsetParent && (b.getAttribute("data-date") || "") >= t);
    return [...cells, ...phone];
  }

  function wireDrag(box) {
    if (!window.ItemDrag || box.__ideasDrag) return;
    box.__ideasDrag = true;
    window.ItemDrag.attach(box, {
      itemSelector: ".meal-idea[data-idea-id]",
      // Near the top or bottom edge, the page scrolls (a phone's dinner is further down)
      scroller: () => document.scrollingElement,
      start(item) {
        const recipe = find(item.getAttribute("data-idea-id"));
        const zones = freeZones();
        return recipe && zones.length ? { zones, origin: null, data: { recipe } } : null;
      },
      label(ctx, zone) {
        const slot = zone.getAttribute("data-slot") || "dinner";
        return `${SLOT_NAMES[slot] || "Dinner"} · ${dayLabel(zone.getAttribute("data-date"))}`;
      },
      drop(ctx, zone) {
        if (!zone || !ctx.data.recipe || typeof window.planRecipeOn !== "function") return;
        const date = zone.getAttribute("data-date");
        const slot = zone.getAttribute("data-slot") || "dinner";
        // Saves it, chimes, redraws the week (it appears with its photo) and
        // asks about the shopping list, as planning from the recipe card does
        window.planRecipeOn(ctx.data.recipe, date, slot);
      }
    });
  }

  document.addEventListener("click", (e) => {
    const box = document.getElementById("meal-ideas");
    if (!box || !box.contains(e.target)) return;
    // "More": all the recipes (the Recipes tab)
    if (e.target.closest("[data-meal-ideas-more]")) {
      if (window.RecipeBrowse) window.RecipeBrowse.setTab("recipes");
      window.scrollTo({ top: 0 });
      return;
    }
    const card = e.target.closest(".meal-idea[data-idea-id]");
    if (card) { const r = find(card.getAttribute("data-idea-id")); if (r && window.RecipeRows) window.RecipeRows.open(r); }
  });

  window.MealIdeas = { render, picks: () => (picks || []).slice() };
})();
