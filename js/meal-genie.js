// ============================================================================
// MEAL GENIE (js/meal-genie.js)
// "Not sure what to cook?" A few quick taps (which meal, what you're in the
// mood for, which flavours, how much effort), then three suggestions from
// the family's recipes and the built-in library, each with "Plan for <day>"
// (planned straight away on the next free day) and "Recipe" (the full card,
// where any day can be picked). No AI and no internet needed.
// Matching: Veggie is strict (never meat or fish); the rest are preferences,
// so it always finds something. Family recipes and favourites score higher;
// meals already planned this week score lower.
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const STEPS = {
    meal: { q: "Which meal?", opts: [
      { key: "breakfast", icon: "🥞", label: "Breakfast" },
      { key: "lunch", icon: "🥪", label: "Lunch" },
      { key: "dinner", icon: "🍝", label: "Dinner" }] },
    mood: { q: "In the mood for…", opts: [
      { key: "veggie", icon: "🥬", label: "Veggie" },
      { key: "chicken", icon: "🍗", label: "Chicken" },
      { key: "meat", icon: "🥩", label: "Meat" },
      { key: "fish", icon: "🐟", label: "Fish" },
      { key: "any", icon: "🤷", label: "Anything" }] },
    flavour: { q: "What flavours?", opts: [
      { key: "comfort", icon: "🇬🇧", label: "Comfort classics" },
      { key: "med", icon: "🇮🇹", label: "Italian & Mediterranean" },
      { key: "spicy", icon: "🌶️", label: "Indian & spicy" },
      { key: "asian", icon: "🥢", label: "Asian" },
      { key: "any", icon: "🌍", label: "Surprise me" }] },
    effort: { q: "How much effort?", opts: [
      { key: "quick", icon: "⚡", label: "Quick & easy" },
      { key: "cook", icon: "🍲", label: "Happy to cook" },
      { key: "any", icon: "👌", label: "Either" }] }
  };
  const FLAVOURS = {
    comfort: ["british", "irish", "united states", "american", "france", "french", "canadian"],
    med: ["italian", "greek", "spanish", "france", "french", "moroccan", "portuguese"],
    spicy: ["india", "indian", "jamaican", "mexican", "thai", "moroccan", "egyptian", "syrian", "malaysian"],
    asian: ["chinese", "japanese", "vietnamese", "thai", "korean", "malaysian", "filipino"]
  };
  const MEAT = /\b(beef|lamb|pork|bacon|sausages?|mince|ham|turkey|chorizo|steak|veal|duck|pancetta|prosciutto|salami|black pudding|goat meat|venison)\b/i;
  const CHICKEN = /\bchicken\b/i;
  const SPICY = /\b(spicy|curry|chilli|chili|masala|tikka|jalfrezi|korma|dal|dhal|vindaloo|harissa|jerk|sriracha|cajun|madras|biryani)\b/i;
  const FISH = /\b(fish|salmon|cod|tuna|prawns?|shrimp|haddock|mackerel|anchov(y|ies)|sardines?|crab|mussels?|squid|tilapia|trout|seafood)\b/i;

  let state = null; // { step, answers, seen: Set, results: [] }

  // ---- Matching --------------------------------------------------------------------
  function cuisineOf(r) { return String(r.subtitle || r.cuisine || "").split("·")[0].trim().toLowerCase(); }
  // (fish sauce and the like don't make a dish "fish")
  // Everything in it (for Veggie, which is strict: chicken stock still counts)
  function rawText(r) { return [r.title, ...(r.ingredients || [])].join(" "); }
  // The main thing (for preferences): stock and sauces aren't the dish
  function ingredientsText(r) {
    return rawText(r)
      .replace(/\b(fish|oyster|anchovy) sauce\b/gi, "sauce")
      .replace(/\b(chicken|beef|lamb|fish|vegetable|pork) (stock|broth|bouillon|stock cubes?|gravy granules)\b/gi, "stock");
  }
  function isVeggie(r) {
    const t = rawText(r).replace(/\bvegetable (stock|broth)\b/gi, "stock");
    if ((r.tags || []).includes("veggie")) return !MEAT.test(t) && !CHICKEN.test(t) && !FISH.test(t);
    return !MEAT.test(t) && !CHICKEN.test(t) && !FISH.test(t);
  }
  function isQuick(r) { return (r.ingredients || []).length <= 9 && (r.instructions || []).length <= 6; }
  function plannedThisWeek() {
    const titles = new Set();
    const get = window.getMealForDate;
    if (typeof get !== "function") return titles;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = -3; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      ["breakfast", "lunch", "dinner"].forEach(slot => { const m = get(d, slot); if (m && m.title) titles.add(m.title.trim().toLowerCase()); });
    }
    return titles;
  }

  function rank() {
    const a = state.answers;
    const all = typeof window.getAllFamilyRecipes === "function" ? window.getAllFamilyRecipes() : [];
    const planned = plannedThisWeek();
    const slot = a.meal || "dinner";
    const scored = all.map((r, i) => {
      const type = String(r.mealType || r.category || "dinner").toLowerCase();
      const text = ingredientsText(r);
      let score = 0;
      if (type === slot) score += 6;
      else if (slot === "lunch" && type === "dinner") score += 2; // light dinners work for lunch
      else if (slot === "dinner" && type === "lunch") score += 1;
      else score -= 10;
      if (a.mood === "veggie" && !isVeggie(r)) return null; // strict
      if (a.mood === "veggie") score += 3;
      if (a.mood === "chicken") score += CHICKEN.test(text) ? 6 : -5;
      if (a.mood === "meat") score += MEAT.test(text) ? 6 : -5;
      if (a.mood === "fish") score += FISH.test(text) ? 6 : -5;
      if (a.flavour && a.flavour !== "any") {
        if ((FLAVOURS[a.flavour] || []).includes(cuisineOf(r))) score += 4;
        if (a.flavour === "spicy" && SPICY.test(text)) score += 3;
      }
      if (a.effort === "quick") score += isQuick(r) ? 2 : -1;
      if (a.effort === "cook") score += isQuick(r) ? 0 : 1;
      if (!String(r.id || "").startsWith("mealdb-")) score += 1.5; // the family's own
      if (r.isFavorite) score += 1.5;
      if (planned.has(String(r.title || "").trim().toLowerCase())) score -= 4;
      // A little shuffle so "Show me others" and repeat visits vary
      score += ((i * 7919 + state.shuffle * 104729) % 97) / 97;
      return { r, score };
    }).filter(Boolean);
    scored.sort((x, y) => y.score - x.score);
    // Only the right kind of meal (no roast dinners for breakfast)
    return scored.filter(x => x.score > -4).map(x => x.r).filter(r => r.title);
  }

  // The next day (from today) with nothing planned for this meal
  function nextFreeDay(slot) {
    const get = window.getMealForDate;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const m = typeof get === "function" ? get(d, slot) : null;
      if (!m || !m.title) return d;
    }
    return today;
  }
  const keyOf = (d) => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(d) : d.toISOString().slice(0, 10));
  function dayLabel(d) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    return diff === 0 ? "tonight" : diff === 1 ? "tomorrow" : `${DAYS[d.getDay()]} ${d.getDate()}`;
  }

  // ---- The sheet -------------------------------------------------------------------
  let dlg = null;
  function getDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "meal-genie";
    dlg.className = "hm-sheet meal-genie";
    dlg.setAttribute("aria-labelledby", "genie-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("click", onClick);
    return dlg;
  }
  function close() { if (window.Sheet) window.Sheet.close(dlg); else dlg.close(); }

  const ORDER = ["meal", "mood", "flavour", "effort"];
  function stepsFor() { return state.answers.meal === "breakfast" ? ["meal"] : ORDER; }

  function draw() {
    const steps = stepsFor();
    const head = `<div class="genie-head">
      <span class="genie-mark" aria-hidden="true">🧞</span>
      <div><h2 class="genie-title" id="genie-title">Meal Genie</h2><p class="genie-sub">Not sure what to cook? I'll find you something.</p></div>
      <button type="button" class="genie-x" data-genie="close" aria-label="Close">✕</button>
    </div>`;
    if (state.step < steps.length) {
      const key = steps[state.step];
      const st = STEPS[key];
      dlg.innerHTML = `<div class="genie-card">${head}
        <ol class="genie-dots" aria-label="Question ${state.step + 1} of ${steps.length}">${steps.map((_, i) => `<li class="${i === state.step ? "is-now" : i < state.step ? "is-done" : ""}"></li>`).join("")}</ol>
        <p class="genie-q">${esc(st.q)}</p>
        <div class="genie-opts${st.opts.length > 3 ? " is-many" : ""}">${st.opts.map(o => `<button type="button" class="genie-opt${state.answers[key] === o.key ? " is-on" : ""}" data-genie="pick" data-key="${key}" data-val="${o.key}"><span class="genie-opt-icon" aria-hidden="true">${o.icon}</span><span>${esc(o.label)}</span></button>`).join("")}</div>
        ${state.step > 0 ? `<button type="button" class="genie-back" data-genie="back">‹ Back</button>` : ""}
      </div>`;
      return;
    }
    // Results
    const list = state.results.slice(state.page * 3, state.page * 3 + 3);
    const slot = state.answers.meal || "dinner";
    const free = nextFreeDay(slot);
    dlg.innerHTML = `<div class="genie-card">${head}
      <p class="genie-q">${list.length ? "How about one of these?" : "I couldn't find anything for that. Try different answers?"}</p>
      <ul class="genie-results">${list.map(r => `<li class="genie-result">
        ${r.image ? `<img class="genie-photo" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="genie-photo is-emoji" aria-hidden="true">${esc(r.emoji || "🍽️")}</span>`}
        <div class="genie-result-body">
          <strong class="genie-result-title">${esc(r.title)}</strong>
          ${r.subtitle ? `<span class="genie-result-sub">${esc(r.subtitle)}</span>` : ""}
          <div class="genie-result-actions">
            <button type="button" class="genie-plan" data-genie="plan" data-id="${esc(r.id)}">📅 Plan for ${esc(dayLabel(free))}</button>
            <button type="button" class="genie-recipe" data-genie="recipe" data-id="${esc(r.id)}">📖 Recipe</button>
          </div>
        </div>
      </li>`).join("")}</ul>
      <div class="genie-foot">
        ${state.results.length > 3 ? `<button type="button" class="genie-more" data-genie="more">🔄 Show me others</button>` : ""}
        <button type="button" class="genie-back" data-genie="restart">↺ Start again</button>
      </div>
    </div>`;
  }

  function onClick(e) {
    if (e.target === dlg) { close(); return; }
    const b = e.target.closest("[data-genie]");
    if (!b) return;
    const act = b.getAttribute("data-genie");
    if (act === "close") { close(); return; }
    if (act === "back") { state.step = Math.max(0, state.step - 1); draw(); return; }
    if (act === "restart") { start(state.answers.meal); return; }
    if (act === "pick") {
      state.answers[b.getAttribute("data-key")] = b.getAttribute("data-val");
      state.step++;
      if (state.step >= stepsFor().length) { state.results = rank(); state.page = 0; }
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      draw();
      return;
    }
    if (act === "more") {
      state.page++;
      if (state.page * 3 >= state.results.length) { state.shuffle++; state.results = rank(); state.page = 0; }
      draw();
      return;
    }
    const recipe = state.results.find(r => String(r.id) === b.getAttribute("data-id"));
    if (!recipe) return;
    const slot = state.answers.meal || "dinner";
    if (act === "plan") {
      const day = nextFreeDay(slot);
      close();
      setTimeout(() => {
        if (typeof window.planRecipeOn === "function") window.planRecipeOn(recipe, keyOf(day), slot);
        if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🧞 ${recipe.title} planned for ${dayLabel(day)}!`);
      }, 250);
      return;
    }
    if (act === "recipe") {
      close();
      setTimeout(() => { if (typeof window.openCookingRecipeModal === "function") window.openCookingRecipeModal(recipe, keyOf(nextFreeDay(slot)), slot); }, 250);
    }
  }

  // Opens with a guess at the meal from the time of day (still asked)
  function start(meal) {
    const h = new Date().getHours();
    const guess = meal || (h < 10 ? "breakfast" : h < 14 ? "lunch" : "dinner");
    state = { step: 0, answers: { meal: guess }, page: 0, results: [], shuffle: Math.floor(Date.now() / 60000) % 1000 };
    getDialog();
    draw();
    if (!dlg.open) dlg.showModal();
  }

  window.MealGenie = { open: start };
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-open-genie]")) start();
  });
})();
