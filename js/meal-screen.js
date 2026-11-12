// ============================================================================
// A PLANNED MEAL (js/meal-screen.js)
// What opens when you tap a planned meal on the Meals page. The dish's photo
// across the top with its name on it, then (when the meal has several
// dishes) a tab for each one, the buttons (Add to list, Move, Add a dish),
// and the recipe laid out openly: ingredients, then the method with the
// blue numbered steps. Phones get it full screen; tablets and laptops a big
// panel in the middle with ingredients and method side by side.
// A dish with no photo gets a soft banner with its emoji instead.
//
//   MealScreen.open(meal, dateStr, slot, dishIndex)
//   MealScreen.isOpenFor(dateStr, slot)
// The old function name still works: openMealDetailsPopover(meal, dateStr, slot)
// ============================================================================
(function () {
  const SLOT = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    bin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
  };
  let state = { meal: null, dateStr: "", slot: "dinner", dish: 0 };

  const get = (d, s) => (typeof window.getMealForDate === "function" ? window.getMealForDate(d, s) : null);
  const dishesOf = (meal) => (window.MealDishes ? window.MealDishes.dishesOf(meal) : [meal]);
  const recipeOf = (dish) => (typeof window.findRecipeByIdOrTitle === "function" && (dish.recipeId || dish.title) ? window.findRecipeByIdOrTitle(dish.recipeId || dish.title) : null);
  const photoOf = (dish, size) => (typeof window.mealPhotoUrl === "function" ? window.mealPhotoUrl(dish, typeof window.getAllFamilyRecipes === "function" ? window.getAllFamilyRecipes() : [], size) : "");
  // Only what's saved: the recipe's own ingredients and steps, or the meal's
  const ingredientsOf = (dish) => { const r = recipeOf(dish); return ((r && r.ingredients && r.ingredients.length ? r.ingredients : dish.ingredients) || []).filter(Boolean).map(i => String(i).replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean); };
  const stepsOf = (dish) => { const r = recipeOf(dish); return ((r && r.instructions && r.instructions.length ? r.instructions : dish.instructions) || []).filter(Boolean).map(s => String(s).replace(/^\s*(?:step\s*)?\d{1,2}\s*[.):-]?\s+(?=\S)/i, "").trim()).filter(Boolean); };
  function minutes(n) {
    if (!n) return "";
    const h = Math.floor(n / 60), m = n % 60;
    return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`;
  }
  function timeOf(dish) {
    const r = recipeOf(dish);
    if (!r) return 0;
    const prep = parseInt(r.prepTime, 10) || 0, cook = parseInt(r.cookTime, 10) || 0;
    return r.totalMinutes || (prep + cook) || 0;
  }
  function dayText(dateStr) {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    if (!y) return "";
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((date - today) / 86400000);
    const plain = `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
    return diff === 0 ? `Today · ${plain}` : diff === 1 ? `Tomorrow · ${plain}` : plain;
  }

  function box() {
    let d = document.getElementById("meal-view");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "meal-view";
    d.className = "meal-view";
    d.setAttribute("aria-labelledby", "mv-title");
    document.body.appendChild(d);
    d.addEventListener("click", onClick);
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    d.addEventListener("keydown", onKey);
    return d;
  }

  function render() {
    const d = box();
    const { meal, dateStr, slot } = state;
    const dishes = dishesOf(meal);
    if (!dishes.length) { close(); return; }
    if (state.dish >= dishes.length) state.dish = 0;
    const dish = dishes[state.dish];
    const several = dishes.length > 1;
    const photo = photoOf(dish, "large");
    const ingredients = ingredientsOf(dish);
    const steps = stepsOf(dish);
    const notes = String(meal.notes || "").trim();
    const recipe = recipeOf(dish);
    const mins = timeOf(dish);
    const cooks = typeof window.mealCooksHtml === "function" ? window.mealCooksHtml(meal.cook) : { names: "", avatars: "" };
    const serves = recipe && recipe.servings ? `Serves ${recipe.servings}` : "";
    const anyIngredients = dishes.some(x => ingredientsOf(x).length);
    const canAdd = !!window.MealDishes && dishes.length < window.MealDishes.MAX_DISHES;
    const kicker = `${SLOT[slot] || "Meal"} · ${dayText(dateStr)}`;

    d.innerHTML = `<article class="mv-card">
      <header class="mv-hero${photo ? " has-photo" : " is-plain"} mv-slot-${esc(slot)}"${photo ? ` style="--mv-photo: url('${esc(photo)}')"` : ""}>
        <div class="mv-hero-bar">
          <button type="button" class="mv-round" id="btn-popover-close" aria-label="Close" title="Close">${ICON.back}</button>
          <span class="mv-hero-tools">
            <button type="button" class="mv-round" id="btn-popover-edit-meal" aria-label="Change this ${esc((SLOT[slot] || "meal").toLowerCase())}" title="Change this ${esc((SLOT[slot] || "meal").toLowerCase())}">${ICON.edit}</button>
            <button type="button" class="mv-round is-danger" id="btn-popover-delete-meal" aria-label="Take ${several ? `the whole ${esc((SLOT[slot] || "meal").toLowerCase())}` : "it"} off the plan" title="Take ${several ? `the whole ${esc((SLOT[slot] || "meal").toLowerCase())}` : "it"} off the plan">${ICON.bin}</button>
          </span>
        </div>
        ${photo ? "" : `<span class="mv-hero-emoji" aria-hidden="true">${esc(dish.emoji || "🍽️")}</span>`}
        <div class="mv-hero-words">
          <p class="mv-kicker">${esc(kicker)}</p>
          <h2 class="mv-title" id="mv-title">${esc(dish.title)}</h2>
          ${cooks.names || mins || serves || dish.course === "pudding" ? `<p class="mv-facts">
            ${dish.course === "pudding" && several ? `<span class="mv-fact">🍮 Pudding</span>` : ""}
            ${cooks.names ? `<span class="mv-fact mv-fact-cook">${cooks.avatars}${esc(cooks.names)}</span>` : ""}
            ${mins ? `<span class="mv-fact">⏱️ ${esc(minutes(mins))}</span>` : ""}
            ${serves ? `<span class="mv-fact">👥 ${esc(serves)}</span>` : ""}
          </p>` : ""}
        </div>
      </header>

      ${several ? `<div class="mv-dishes" role="tablist" aria-label="Dishes">${dishes.map((x, i) => {
        const p = photoOf(x, "small");
        return `<button type="button" role="tab" class="mv-dish${i === state.dish ? " is-on" : ""}" data-mv-dish="${i}" aria-selected="${i === state.dish}">
          ${p ? `<span class="mv-dish-pic" style="background-image: url('${esc(p)}')" aria-hidden="true"></span>` : `<span class="mv-dish-pic is-emoji" aria-hidden="true">${esc(x.emoji || "🍽️")}</span>`}
          <span class="mv-dish-name">${x.course === "pudding" ? "<small>Pudding</small> " : ""}${esc(x.title)}</span>
        </button>`;
      }).join("")}</div>` : ""}

      <div class="mv-actions">
        ${anyIngredients ? `<button type="button" class="mv-action" id="btn-popover-add-to-grocery"><span aria-hidden="true">🛒</span> ${several ? "Add all to list" : "Add to list"}</button>` : ""}
        <button type="button" class="mv-action" id="btn-popover-move-meal"><span aria-hidden="true">📅</span> Move</button>
        ${canAdd ? `<button type="button" class="mv-action is-add" data-mv-add><span aria-hidden="true">＋</span> Add a dish</button>` : ""}
      </div>

      <div class="mv-body${ingredients.length && steps.length ? " has-both" : ""}">
        ${ingredients.length ? `<section class="mv-section mv-ingredients" aria-labelledby="mv-ing-head">
          <h3 class="mv-head" id="mv-ing-head">Ingredients <span class="mv-count">${ingredients.length}</span></h3>
          <ul class="mv-ing-list">${ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        </section>` : ""}
        ${steps.length ? `<section class="mv-section mv-method" aria-labelledby="mv-method-head">
          <h3 class="mv-head" id="mv-method-head">Method</h3>
          <ol class="mv-steps">${steps.map((s, i) => `<li class="mv-step"><span class="mv-step-num" aria-hidden="true">${i + 1}</span><span class="mv-step-text">${esc(s)}</span></li>`).join("")}</ol>
        </section>` : ""}
        ${!ingredients.length && !steps.length ? `<section class="mv-section mv-notes">
          ${notes && state.dish === 0 ? `<h3 class="mv-head">Notes</h3><p class="mv-notes-text">${esc(notes)}</p>` : `<p class="mv-empty">No recipe saved for ${esc(dish.title)}.</p>`}
        </section>` : ""}
        ${several ? `<p class="mv-remove-wrap"><button type="button" class="mv-remove" data-mv-remove>Take ${esc(dish.title)} off ${esc((SLOT[slot] || "the meal").toLowerCase())}</button></p>` : ""}
      </div>
    </article>`;
  }

  function open(meal, dateStr, slot = "dinner", dishIndex = 0) {
    if (!meal || !meal.title) return;
    const wasOpen = isOpenFor(dateStr, slot);
    state = { meal, dateStr, slot, dish: dishIndex || 0 };
    render();
    const d = box();
    if (!d.open) d.showModal();
    if (!wasOpen) {
      const card = d.querySelector(".mv-card");
      if (card) card.scrollTop = 0;
      try { d.querySelector("#btn-popover-close").focus({ preventScroll: true }); } catch (e) {}
    }
  }
  function isOpenFor(dateStr, slot) {
    const d = document.getElementById("meal-view");
    return !!(d && d.open && state.dateStr === dateStr && state.slot === slot);
  }
  function close() {
    const d = document.getElementById("meal-view");
    if (d && d.open) d.close();
  }
  // After a change elsewhere: show what's planned now (or close if nothing is)
  function refresh(dishIndex) {
    const now = get(state.dateStr, state.slot);
    if (!now || !now.title) { close(); return; }
    state.meal = now;
    if (dishIndex != null) state.dish = dishIndex;
    render();
  }
  const redraw = () => {
    if (typeof window.renderMealsView === "function") window.renderMealsView();
    if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  };
  const toast = (t) => { if (typeof window.showCalendarToast === "function") window.showCalendarToast(t); };
  const click = () => { if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick(); };

  function addToList(btn) {
    const { meal, dateStr, slot } = state;
    if (typeof window.addIngredientsToGroceryList !== "function") return;
    const total = { added: 0, combined: 0, skipped: [], already: 0 };
    dishesOf(meal).forEach(dish => {
      const lines = ingredientsOf(dish);
      if (!lines.length) return;
      const res = window.addIngredientsToGroceryList(lines, dish.title, `${dish.title}|${dateStr}|${slot}`) || {};
      total.added += res.added || 0;
      total.combined += res.combined || 0;
      total.already += res.already || 0;
      total.skipped = total.skipped.concat(res.skipped || []);
    });
    btn.classList.add("is-done");
    btn.innerHTML = `<span aria-hidden="true">✓</span> On the list`;
    click();
    if (typeof window.showGroceryAddToast === "function") window.showGroceryAddToast(total, dishesOf(meal).length > 1 ? (SLOT[slot] || "this meal").toLowerCase() : meal.title);
  }

  async function removeAll() {
    const { meal, dateStr, slot } = state;
    const dishes = dishesOf(meal);
    if (dishes.length > 1 && window.Sheet) {
      const ok = await window.Sheet.confirm({ icon: "🍽️", title: `Take all ${dishes.length} dishes off?`, text: dishes.map(x => x.title).join(", "), yes: "Take them off", no: "Keep them", danger: true });
      if (!ok) return;
    }
    if (typeof window.setMealForDate === "function") window.setMealForDate(dateStr, null, slot);
    close();
    if (window.MealGroceries) window.MealGroceries.afterRemove({ dateStr, slot, meal });
    redraw();
    click();
    toast(`Removed ${dishes.length > 1 ? `${SLOT[slot] || "the meal"}` : meal.title} from the plan`);
  }

  function removeDish() {
    const { meal, dateStr, slot } = state;
    const dish = dishesOf(meal)[state.dish];
    if (!dish || !window.MealDishes) return;
    const next = window.MealDishes.withoutDish(meal, state.dish);
    if (typeof window.setMealForDate === "function") window.setMealForDate(dateStr, next, slot);
    redraw();
    click();
    const undo = () => { window.setMealForDate(dateStr, meal, slot); redraw(); if (isOpenFor(dateStr, slot)) refresh(state.dish); };
    if (typeof window.showActionToast === "function") window.showActionToast({ icon: dish.emoji || "🍽️", title: "Taken off", text: `${dish.title} is still in your recipes`, action: { label: "Undo", onClick: undo }, ms: 6000 });
    refresh(Math.max(0, state.dish - 1));
    if (window.MealGroceries) window.MealGroceries.afterRemove({ dateStr, slot, meal: dish });
  }

  function onClick(e) {
    const d = e.currentTarget;
    if (e.target === d) { close(); return; } // the dimmed page around the panel
    const t = (sel) => e.target.closest(sel);
    if (t("#btn-popover-close")) { close(); return; }
    const tab = t("[data-mv-dish]");
    if (tab) {
      state.dish = parseInt(tab.getAttribute("data-mv-dish"), 10) || 0;
      render();
      const on = d.querySelector(".mv-dish.is-on");
      if (on) { try { on.focus({ preventScroll: true }); on.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (err) {} }
      return;
    }
    if (t("#btn-popover-edit-meal")) { close(); if (typeof window.openPlanMealDrawer === "function") window.openPlanMealDrawer(state.dateStr, state.slot); return; }
    if (t("#btn-popover-delete-meal")) { removeAll(); return; }
    if (t("#btn-popover-move-meal")) { close(); if (window.MealsPhone) window.MealsPhone.moveMeal(state.dateStr, state.slot); return; }
    const add = t("#btn-popover-add-to-grocery");
    if (add) { if (!add.classList.contains("is-done")) addToList(add); return; }
    if (t("[data-mv-add]")) {
      // Picks go to addDishToMeal (js/meals.js), which redraws this screen
      if (window.MealsPhone && window.MealsPhone.openPlanSheet) window.MealsPhone.openPlanSheet(state.dateStr, state.slot, { add: true });
      return;
    }
    if (t("[data-mv-remove]")) { removeDish(); return; }
  }
  // ← and → move between the dish tabs
  function onKey(e) {
    if (!e.target.closest || !e.target.closest("[data-mv-dish]") || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const n = dishesOf(state.meal).length;
    state.dish = (state.dish + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    render();
    const on = document.querySelector("#meal-view .mv-dish.is-on");
    if (on) on.focus();
    e.preventDefault();
  }

  window.MealScreen = { open, isOpenFor, close, refresh };
  window.openMealDetailsPopover = (meal, dateStr, slot = "dinner") => open(meal, dateStr, slot, 0);
})();
