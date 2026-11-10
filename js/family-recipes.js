// ============================================================================
// FAMILY RECIPES (js/family-recipes.js)
// A family's own recipes: add, edit and delete them, saved to the board (the
// customRecipes list on the board document, through js/board-sync.js like
// events), so every device has them. They show in the Meals recipe list with
// the built-in ones, and their card says "Recipe: Family recipe" with Edit.
//
// The form: name, which meal, serves, prep and cook minutes, an emoji, the
// ingredients (one a line) and the method (one step a line). "📷 Fill in from
// a photo" reads a page of a recipe book or a handwritten card (up to three
// photos, for one that runs over) with js/magic-import.js, then fills the form
// to check before saving. No photo of the page is kept.
//
//   FamilyRecipes.list()              the board's own recipes
//   FamilyRecipes.openEditor(id?)     new (no id) or edit
//   FamilyRecipes.save(recipe) / remove(id)
// ============================================================================
(function () {
  const FIELD = "customRecipes";
  const MAX = 100;
  const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const cacheKey = () => (typeof window.boardCacheKey === "function" ? window.boardCacheKey("turnbull_custom_recipes") : "turnbull_custom_recipes");
  const clean = (s, max) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const lines = (text, max, each) => String(text || "").split(/\n+/).map(l => clean(l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ""), each)).filter(Boolean).slice(0, max);

  // ---- The list ----------------------------------------------------------------------
  function list() {
    let out = [];
    try { out = JSON.parse(localStorage.getItem(cacheKey()) || "[]"); } catch (e) {}
    // Plus any from this device's older, unshared store (before they synced)
    try {
      const old = JSON.parse(localStorage.getItem("turnbull_custom_recipes") || "[]");
      if (Array.isArray(old) && cacheKey() !== "turnbull_custom_recipes") old.forEach(r => { if (r && r.id && !out.some(x => x.id === r.id)) out.push(r); });
    } catch (e) {}
    return (Array.isArray(out) ? out : []).filter(r => r && typeof r === "object" && r.id && r.title);
  }
  // The board sent its list (app.js): keep this device's unsaved changes on top
  function fromBoard(recipes) {
    const all = window.BoardSync ? window.BoardSync.withPending(FIELD, recipes) : recipes;
    if (window.BoardSync) window.BoardSync.setBaseline(FIELD, recipes);
    try { localStorage.setItem(cacheKey(), JSON.stringify(all)); } catch (e) {}
  }
  function store(next, before) {
    try { localStorage.setItem(cacheKey(), JSON.stringify(next)); } catch (e) {}
    if (window.BoardSync && window.BoardSync.saveListChanges) {
      // First change before the board has sent any: compare with what was here
      if (window.BoardSync.getBaseline(FIELD) === undefined) window.BoardSync.setBaseline(FIELD, before);
      window.BoardSync.saveListChanges(FIELD, next);
    }
    if (typeof window.renderDrawerRecipeList === "function") window.renderDrawerRecipeList();
    if (typeof window.notifyBoardChanged === "function") window.notifyBoardChanged();
  }
  function save(recipe) {
    const all = list();
    const next = [recipe, ...all.filter(r => r.id !== recipe.id)].slice(0, MAX);
    store(next, all);
    return recipe;
  }
  function remove(id) {
    const all = list();
    const gone = all.find(r => r.id === id);
    store(all.filter(r => r.id !== id), all);
    return gone;
  }

  // ---- The form ----------------------------------------------------------------------
  let editingId = null;
  function dialog() {
    let dlg = document.getElementById("family-recipe-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "family-recipe-modal";
    dlg.className = "roster-dialog family-recipe-dialog";
    dlg.setAttribute("aria-labelledby", "family-recipe-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-fr-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="family-recipe-title" class="modal-title">Add a recipe</h2></div>
        <form class="family-recipe-form" id="family-recipe-form" novalidate>
          <button type="button" class="family-recipe-photo" data-fr-photo aria-label="Fill in from a photo of a recipe book page or a handwritten recipe" hidden>
            <span aria-hidden="true">📷</span> From a photo
          </button>
          <p class="family-recipe-note" data-fr-note role="status" hidden>📷 Filled in. Check it, then Save.</p>
          <label class="ev-field"><span class="ev-field-label">Name</span>
            <span class="family-recipe-name-row">
              <input class="ev-native-input family-recipe-emoji" data-fr="emoji" maxlength="4" aria-label="Emoji" placeholder="🍲">
              <input class="ev-native-input" data-fr="title" maxlength="80" placeholder="Grandad's beef stew" aria-label="Recipe name" required>
            </span>
          </label>
          <div class="ev-field"><span class="ev-field-label">Which meal</span>
            <div class="drawer-segmented-pills family-recipe-meals" role="radiogroup" aria-label="Which meal">
              ${MEALS.map(([k, label]) => `<button type="button" class="drawer-pill-segment" data-fr-meal="${k}" role="radio" aria-checked="false">${label}</button>`).join("")}
            </div>
          </div>
          <div class="family-recipe-numbers">
            <label class="ev-field"><span class="ev-field-label">Serves</span><input class="ev-native-input" data-fr="servings" type="number" min="1" max="50" inputmode="numeric" aria-label="Serves"></label>
            <label class="ev-field"><span class="ev-field-label">Prep (mins)</span><input class="ev-native-input" data-fr="prep" type="number" min="0" max="600" inputmode="numeric" aria-label="Prep minutes"></label>
            <label class="ev-field"><span class="ev-field-label">Cook (mins)</span><input class="ev-native-input" data-fr="cook" type="number" min="0" max="1440" inputmode="numeric" aria-label="Cook minutes"></label>
          </div>
          <label class="ev-field"><span class="ev-field-label">Ingredients <small>one on each line</small></span>
            <textarea class="ev-native-input family-recipe-text" data-fr="ingredients" rows="7" placeholder="500g beef mince&#10;1 onion, chopped&#10;2 carrots" aria-label="Ingredients"></textarea></label>
          <label class="ev-field"><span class="ev-field-label">Method <small>one step on each line</small></span>
            <textarea class="ev-native-input family-recipe-text" data-fr="method" rows="7" placeholder="Brown the mince in a large pan.&#10;Add the onion and carrots…" aria-label="Method"></textarea></label>
          <p class="family-recipe-error" data-fr-error role="alert"></p>
          <div class="family-recipe-actions">
            <button type="button" class="settings-outline-btn is-quiet" data-fr-delete hidden>Delete</button>
            <button type="submit" class="btn-primary-modal">Save recipe</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.querySelector("[data-fr-close]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => { if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock(); });
    dlg.addEventListener("click", (e) => {
      const meal = e.target.closest("[data-fr-meal]");
      if (meal) { setMeal(meal.getAttribute("data-fr-meal")); return; }
      if (e.target.closest("[data-fr-photo]")) { pickPhotos(); return; }
      if (e.target.closest("[data-fr-delete]")) { askDelete(); }
    });
    dlg.querySelector("#family-recipe-form").addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    return dlg;
  }
  const field = (k) => document.querySelector(`#family-recipe-modal [data-fr="${k}"]`);
  function setMeal(k) {
    document.querySelectorAll("#family-recipe-modal [data-fr-meal]").forEach(b => {
      const on = b.getAttribute("data-fr-meal") === k;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
  }
  const mealChosen = () => (document.querySelector("#family-recipe-modal [data-fr-meal].active") || {}).getAttribute?.("data-fr-meal") || "dinner";

  function fill(r, fromPhoto) {
    field("title").value = r.title || "";
    field("emoji").value = r.emoji || "";
    field("servings").value = r.servings || "";
    field("prep").value = parseInt(r.prepTime, 10) || "";
    field("cook").value = parseInt(r.cookTime, 10) || "";
    field("ingredients").value = (r.ingredients || []).join("\n");
    field("method").value = (r.instructions || []).join("\n");
    setMeal(r.mealType || r.category || "dinner");
    const note = document.querySelector("#family-recipe-modal [data-fr-note]");
    if (note) note.hidden = !fromPhoto;
  }

  function openEditor(id = null, opts = {}) {
    const dlg = dialog();
    const r = id ? list().find(x => x.id === id) : null;
    editingId = r ? r.id : null;
    dlg.querySelector("#family-recipe-title").textContent = r ? "Edit recipe" : "Add a recipe";
    dlg.querySelector("[data-fr-delete]").hidden = !r;
    dlg.querySelector("[data-fr-photo]").hidden = !(window.MagicImport && window.MagicImport.available("recipe"));
    dlg.querySelector("[data-fr-error]").textContent = "";
    fill(r || { mealType: opts.mealType || "dinner" }, false);
    if (!dlg.open) dlg.showModal();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
    // Straight into the name with a keyboard and mouse. Not on a phone or
    // tablet: the keyboard would pop up over "From a photo".
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (!r && !touch) setTimeout(() => { try { field("title").focus({ preventScroll: true }); } catch (e) {} }, 50);
  }

  function submit() {
    const err = document.querySelector("#family-recipe-modal [data-fr-error]");
    const title = clean(field("title").value, 80);
    const ingredients = lines(field("ingredients").value, 60, 160);
    const instructions = lines(field("method").value, 40, 600);
    if (!title) { err.textContent = "Give it a name first."; field("title").focus(); return; }
    if (!ingredients.length && !instructions.length) { err.textContent = "Add the ingredients or the method (or both)."; return; }
    const mealType = mealChosen();
    const num = (v, max) => { const n = parseInt(v, 10); return n > 0 && n <= max ? n : null; };
    const emoji = clean(field("emoji").value, 4);
    const recipe = {
      id: editingId || `family-${Date.now()}`,
      title, emoji: /\p{Extended_Pictographic}/u.test(emoji) ? emoji : "🍲",
      subtitle: "Family recipe",
      category: mealType, mealType, tags: [mealType, "family"],
      source: "family", sourceName: "Family recipe",
      servings: num(field("servings").value, 50),
      prepTime: num(field("prep").value, 600) ? String(num(field("prep").value, 600)) : "",
      cookTime: num(field("cook").value, 1440) ? String(num(field("cook").value, 1440)) : "",
      ingredients, instructions,
      updatedAt: new Date().toISOString()
    };
    save(recipe);
    document.getElementById("family-recipe-modal").close();
    const view = () => { if (typeof window.openCookingRecipeModal === "function") window.openCookingRecipeModal(recipe); };
    if (typeof window.showActionToast === "function") {
      window.showActionToast({ icon: recipe.emoji, title: "Recipe saved", text: title, action: { label: "View recipe", onClick: view }, ms: 10000 });
    } else if (typeof window.showCalendarToast === "function") window.showCalendarToast(`${recipe.emoji} Saved ${title} to your recipes`);
  }

  async function askDelete() {
    const r = list().find(x => x.id === editingId);
    if (!r) return;
    const ask = { icon: "🗑️", danger: true, yes: "Delete it", no: "Keep it", title: `Delete "${r.title}"?`, text: "It comes off the recipes for everyone on the board. Meals already planned with it stay planned." };
    const sure = window.Sheet ? await window.Sheet.confirm(ask) : window.confirm(ask.title);
    if (!sure) return;
    remove(r.id);
    document.getElementById("family-recipe-modal").close();
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🗑️ Deleted ${r.title}`);
  }

  // ---- From a photo (js/magic-import.js) ---------------------------------------------
  function pickPhotos() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    // In the page while it's open: some browsers (and iPhones) won't open a
    // file box that isn't. Inside the form, so its click doesn't count as a
    // tap outside the Plan Meal panel underneath (which would close it).
    input.hidden = true;
    input.addEventListener("click", (e) => e.stopPropagation());
    (document.getElementById("family-recipe-modal") || document.body).appendChild(input);
    const done = () => setTimeout(() => input.remove(), 0);
    input.addEventListener("cancel", done);
    input.addEventListener("change", async () => {
      done();
      const files = [...(input.files || [])].slice(0, 3);
      if (!files.length || !window.MagicImport || !window.MagicImport.readRecipe) return;
      const recipe = await window.MagicImport.readRecipe(files);
      if (!recipe) return; // it said why
      const dlg = dialog();
      if (!dlg.open) dlg.showModal();
      fill({ ...recipe, mealType: recipe.mealType || mealChosen() }, true);
    });
    input.click();
  }

  // The button in the Meals recipe list, and Edit on a family recipe's card
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-family-recipe]");
    if (add) { e.preventDefault(); openEditor(null, { mealType: add.getAttribute("data-meal") || undefined }); return; }
    const edit = e.target.closest("[data-edit-family-recipe]");
    if (edit) {
      e.preventDefault();
      const cooking = document.getElementById("cooking-recipe-modal");
      if (cooking && cooking.open) cooking.close();
      openEditor(edit.getAttribute("data-edit-family-recipe"));
    }
  });

  window.FamilyRecipes = { list, save, remove, openEditor, fromBoard, _fill: fill };
})();
