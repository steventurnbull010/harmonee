// ============================================================================
// MEAL INGREDIENTS ⇄ SHOPPING LIST (js/meal-groceries.js)
// Planning a meal asks "Add the ingredients to the shopping list?" with each
// one ticked (untick what you've got). Removing or replacing a meal asks
// "Take its ingredients off the shopping list?" for the ones not yet bought.
// Ingredients another meal also needs stay on; just this meal's share comes off.
//
//   MealGroceries.afterPlan({ dateStr, slot, before, meal })  // meal just saved (before: what it replaced)
//   MealGroceries.afterRemove({ dateStr, slot, meal })        // meal just removed
//   MealGroceries.onList(meal, dateStr, slot)                 // its ingredients still on the list
//   MealGroceries.askRemove(meal, dateStr, slot)
//
// Each meal's ingredients are tagged "Title|YYYY-MM-DD|slot" on the list
// (the same key the Add to List buttons use), so nothing doubles up.
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SLOT = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const keyFor = (meal, dateStr, slot) => `${meal.title}|${dateStr}|${slot}`;
  const groceries = () => (typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : []).find(l => l.id === "groceries");
  const ingredientsOf = (meal) => (meal && typeof window.getPlannedMealIngredients === "function" ? window.getPlannedMealIngredients(meal) : (meal && meal.ingredients) || []) || [];

  function whenText(dateStr, slot) {
    const [y, m, d] = String(dateStr).split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((date - today) / 86400000);
    const day = diff === 0 ? "today" : diff === 1 ? "tomorrow" : `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
    return `${SLOT[slot] || "Dinner"} · ${day}`;
  }

  function onList(meal, dateStr, slot) {
    const list = groceries();
    if (!meal || !meal.title || !list || !window.Grocery || !window.Grocery.mealItemsOnList) return [];
    return window.Grocery.mealItemsOnList(list.items || [], keyFor(meal, dateStr, slot));
  }

  // ---- The dialog ------------------------------------------------------------------
  let dlg = null, done = null;
  function getDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "meal-groc-dialog";
    dlg.className = "meal-groc-dialog";
    dlg.setAttribute("aria-labelledby", "meal-groc-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-mg-skip]")) { finish(false); return; }
      if (e.target.closest("[data-mg-go]")) { finish(true); return; }
      if (e.target.closest("[data-mg-all]")) {
        const boxes = [...dlg.querySelectorAll("[data-mg-key]")];
        const on = !boxes.every(b => b.checked);
        boxes.forEach(b => { b.checked = on; });
        count();
      }
    });
    dlg.addEventListener("change", (e) => { if (e.target.matches("[data-mg-key]")) count(); });
    return dlg;
  }
  function count() {
    const n = dlg.querySelectorAll("[data-mg-key]:checked").length;
    const go = dlg.querySelector("[data-mg-go]");
    if (go) { go.textContent = `${dlg._verb} ${n} item${n === 1 ? "" : "s"}`; go.disabled = !n; }
    const all = dlg.querySelector("[data-mg-all]");
    if (all) all.textContent = [...dlg.querySelectorAll("[data-mg-key]")].every(b => b.checked) ? "Untick all" : "Tick all";
  }
  function finish(go) {
    const picked = go ? [...dlg.querySelectorAll("[data-mg-key]:checked")].map(b => b.getAttribute("data-mg-key")) : null;
    if (dlg.open) dlg.close();
    const cb = done; done = null;
    if (cb) cb(picked);
  }
  // rows: [{ key, text, note, on }]
  function ask({ title, sub, rows, verb, skip }) {
    return new Promise(resolve => {
      const d = getDialog();
      if (done) done(null);
      done = resolve;
      d._verb = verb;
      d.innerHTML = `<div class="meal-groc-card">
        <h2 class="meal-groc-title" id="meal-groc-title">${esc(title)}</h2>
        <p class="meal-groc-sub">${esc(sub)}</p>
        ${rows.length > 3 ? `<button type="button" class="meal-groc-all" data-mg-all>Untick all</button>` : ""}
        <ul class="meal-groc-list">${rows.map(r => `<li><label class="meal-groc-row">
          <input type="checkbox" data-mg-key="${esc(r.key)}"${r.on ? " checked" : ""}>
          <span class="meal-groc-text">${esc(r.text)}${r.note ? `<em>${esc(r.note)}</em>` : ""}</span>
        </label></li>`).join("")}</ul>
        <div class="meal-groc-actions">
          <button type="button" class="meal-groc-btn" data-mg-skip>${esc(skip)}</button>
          <button type="button" class="meal-groc-btn is-primary" data-mg-go></button>
        </div>
      </div>`;
      count();
      if (!d.open) d.showModal();
      setTimeout(() => { try { d.querySelector("[data-mg-go]").focus({ preventScroll: true }); } catch (e) {} }, 50);
    });
  }

  // ---- Add: after planning a meal --------------------------------------------------
  async function askAdd(meal, dateStr, slot) {
    const lines = ingredientsOf(meal);
    const list = groceries();
    if (!lines.length || !window.Grocery || !window.Grocery.lineText || typeof window.addIngredientsToGroceryList !== "function") return;
    const sk = keyFor(meal, dateStr, slot);
    // Already on the list for this day: nothing to ask
    if (list && (list.items || []).some(it => it.grocery && (it.grocery.sourceKeys || []).includes(sk))) return;
    const onNow = new Set((list ? list.items || [] : []).filter(it => !it.checked).map(it => (window.Grocery.detailsOf(it) || {}).key).filter(Boolean));
    const seen = new Map();
    lines.forEach((line, i) => {
      const t = window.Grocery.lineText(line);
      if (!t) return;
      if (seen.has(t.key)) { seen.get(t.key).lines.push(line); return; }
      seen.set(t.key, { key: t.key, text: t.text, basic: t.basic, lines: [line], note: t.basic ? "Usually in the cupboard" : onNow.has(t.key) ? "Already on the list: this adds to it" : "" });
    });
    const rows = [...seen.values()].map(r => ({ ...r, on: !r.basic }));
    if (!rows.length) return;
    const picked = await ask({ title: "Add the ingredients to the shopping list?", sub: `${meal.title} · ${whenText(dateStr, slot)}`, rows, verb: "Add", skip: "Not now" });
    if (!picked || !picked.length) return;
    const chosen = rows.filter(r => picked.includes(r.key)).flatMap(r => r.lines);
    const res = window.addIngredientsToGroceryList(chosen, meal.title, sk, true);
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    if (typeof window.showGroceryAddToast === "function") window.showGroceryAddToast(res, meal.title);
    refresh();
  }

  // ---- Remove: after a meal comes off the plan (or is replaced) --------------------
  async function askRemove(meal, dateStr, slot) {
    const items = onList(meal, dateStr, slot);
    if (!items.length || typeof window.mutateFamilyLists !== "function") return;
    const rows = items.map(i => ({ key: i.key, text: i.text, on: true, note: i.others.length ? `Also for ${i.others.join(", ")}: only ${meal.title}'s share comes off` : i.byHand ? `You added this yourself too: only ${meal.title}'s share comes off` : "" }));
    const picked = await ask({ title: "Take its ingredients off the shopping list?", sub: `${meal.title} · ${whenText(dateStr, slot)}`, rows, verb: "Take off", skip: "Keep them" });
    if (!picked || !picked.length) return;
    const res = window.mutateFamilyLists({ type: "groceryRemoveMeal", sourceKey: keyFor(meal, dateStr, slot), title: meal.title, lines: ingredientsOf(meal), keys: picked }) || { removed: [], reduced: 0 };
    const n = (res.removed || []).length + (res.reduced || 0);
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🛒 ${n} item${n === 1 ? "" : "s"} for ${meal.title} taken off the list`);
    refresh();
  }

  function refresh() {
    if (typeof window.updateGroceryBadgeCount === "function") { try { window.updateGroceryBadgeCount(); } catch (e) {} }
    if (typeof window.renderListsView === "function") { try { window.renderListsView(); } catch (e) {} }
    document.dispatchEvent(new CustomEvent("harmonee:voice-change"));
  }

  async function afterPlan({ dateStr, slot, before, meal }) {
    if (before && before.title && (!meal || before.title.trim().toLowerCase() !== String(meal.title || "").trim().toLowerCase())) await askRemove(before, dateStr, slot);
    if (meal && meal.title) await askAdd(meal, dateStr, slot);
  }
  async function afterRemove({ dateStr, slot, meal }) { await askRemove(meal, dateStr, slot); }

  window.MealGroceries = { afterPlan, afterRemove, onList, askRemove, askAdd };
})();
