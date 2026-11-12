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
  const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"], ["pudding", "Pudding"]];
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
    if (window.RecipeBrowse) window.RecipeBrowse.refresh();
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
          <p class="family-recipe-note" data-fr-note role="status" hidden>✓ All filled in. Check it over, then Save.</p>
          <label class="ev-field"><span class="ev-field-label">Name</span>
            <span class="family-recipe-name-row">
              <input class="ev-native-input family-recipe-emoji" data-fr="emoji" maxlength="4" aria-label="Emoji" placeholder="🍲">
              <input class="ev-native-input" data-fr="title" maxlength="80" placeholder="Grandad's beef stew" aria-label="Recipe name" required>
            </span>
          </label>
          <div class="ev-field"><span class="ev-field-label">Photo of the dish <small>optional</small></span>
            <!-- One tile: tap to add a photo; with one, it fills the tile (Change, ✕) -->
            <div class="fr-dish">
              <button type="button" class="fr-dish-tile is-empty" data-fr-dish-pick aria-label="Add a photo of the dish">
                <span class="fr-dish-img" data-fr-dish-preview aria-hidden="true"></span>
                <span class="fr-dish-add" aria-hidden="true"><span class="fr-dish-plus">＋</span><span>Add a photo of the dish</span></span>
                <span class="fr-dish-change" aria-hidden="true">📷 Change</span>
              </button>
              <button type="button" class="fr-dish-remove" data-fr-dish-remove aria-label="Remove the photo" hidden>✕</button>
            </div>
          </div>
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
          <div class="ev-field"><span class="ev-field-label">Ingredients <small data-fr-count="ingredients"></small></span>
            <textarea data-fr="ingredients" hidden aria-hidden="true" tabindex="-1"></textarea>
            <ul class="fr-lines is-ingredients" data-fr-lines="ingredients" aria-label="Ingredients"></ul>
            <button type="button" class="fr-add-line" data-fr-add="ingredients">＋ Add an ingredient</button>
          </div>
          <div class="ev-field"><span class="ev-field-label">Method <small data-fr-count="method"></small></span>
            <textarea data-fr="method" hidden aria-hidden="true" tabindex="-1"></textarea>
            <ol class="fr-lines is-method" data-fr-lines="method" aria-label="Method"></ol>
            <button type="button" class="fr-add-line" data-fr-add="method">＋ Add a step</button>
          </div>
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
      if (e.target.closest("[data-fr-dish-pick]")) { pickDish(); return; }
      if (e.target.closest("[data-fr-dish-remove]")) { dish = { ...dish, data: null, removed: true }; showDish(); return; }
      if (e.target.closest("[data-fr-delete]")) { askDelete(); return; }
      const add = e.target.closest("[data-fr-add]");
      if (add) { addLine(add.getAttribute("data-fr-add")); return; }
      const rm = e.target.closest("[data-fr-remove]");
      if (rm) { removeLine(rm.closest(".fr-line")); }
    });
    wireLines(dlg);
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

  // ---- Photo of the dish (js/recipe-photos.js) ----------------------------------------
  // existing: the recipe's photo { rev } when editing; data: a new photo picked
  // here (saved with the recipe); removed: Remove tapped
  let dish = { existing: null, data: null, removed: false, recipe: null };
  function showDish() {
    const box = document.querySelector("#family-recipe-modal [data-fr-dish-preview]");
    if (!box) return;
    const current = dish.data || (!dish.removed && dish.existing && window.RecipePhotos ? window.RecipePhotos.url(dish.recipe) : "");
    const has = !!(dish.data || (!dish.removed && dish.existing));
    box.style.backgroundImage = current ? `url('${current}')` : "";
    const tile = document.querySelector("#family-recipe-modal [data-fr-dish-pick]");
    tile.classList.toggle("is-empty", !has);
    tile.setAttribute("aria-label", has ? "Change the photo of the dish" : "Add a photo of the dish");
    document.querySelector("#family-recipe-modal [data-fr-dish-remove]").hidden = !has;
  }
  function pickDish() {
    if (!window.RecipePhotos) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    input.addEventListener("click", (e) => e.stopPropagation());
    const form = document.getElementById("family-recipe-modal");
    (form && form.open ? form : document.body).appendChild(input);
    const done = () => setTimeout(() => input.remove(), 0);
    input.addEventListener("cancel", done);
    input.addEventListener("change", async () => {
      done();
      const file = input.files && input.files[0];
      if (!file) return;
      const err = document.querySelector("#family-recipe-modal [data-fr-error]");
      try {
        dish = { ...dish, data: await window.RecipePhotos.shrink(file), removed: false };
        if (err) err.textContent = "";
      } catch (e) {
        if (err) err.textContent = e.message || "Couldn't use that photo.";
      }
      showDish();
    });
    input.click();
  }

  // ---- Ingredients and method as lists ---------------------------------------------
  // One row per ingredient, numbered steps with room between them, each
  // growing to fit its words (a photo of a cookbook page used to land as one
  // long block in a small box you had to scroll inside). Enter starts the
  // next row; Backspace in an empty row removes it; pasting several lines
  // makes several rows. The hidden boxes above hold the text, one per line,
  // which is what saving reads.
  const PLACEHOLDER = { ingredients: ["500g beef mince", "1 onion, chopped", "2 carrots"], method: ["Brown the mince in a large pan.", "Add the onion and carrots…"] };
  const linesBox = (kind) => document.querySelector(`#family-recipe-modal [data-fr-lines="${kind}"]`);
  function lineHtml(kind, text, n) {
    const ph = PLACEHOLDER[kind][Math.min(n, PLACEHOLDER[kind].length - 1)];
    const label = kind === "method" ? `Step ${n + 1}` : `Ingredient ${n + 1}`;
    return `<li class="fr-line"><textarea class="fr-line-text" rows="1" data-fr-line="${kind}" aria-label="${label}" placeholder="${esc(n < PLACEHOLDER[kind].length ? ph : "")}">${esc(text)}</textarea><button type="button" class="fr-line-remove" data-fr-remove aria-label="Remove ${label.toLowerCase()}">×</button></li>`;
  }
  function autosize(t) {
    if (!t) return;
    t.style.height = "auto";
    if (t.scrollHeight) t.style.height = `${t.scrollHeight}px`;
  }
  const autosizeAll = () => document.querySelectorAll("#family-recipe-modal .fr-line-text").forEach(autosize);
  function syncKind(kind) {
    const box = linesBox(kind);
    if (!box) return;
    const texts = [...box.querySelectorAll(".fr-line-text")].map(t => t.value.trim()).filter(Boolean);
    field(kind).value = texts.join("\n");
    const count = document.querySelector(`#family-recipe-modal [data-fr-count="${kind}"]`);
    if (count) count.textContent = texts.length ? (kind === "method" ? `${texts.length} step${texts.length === 1 ? "" : "s"}` : `${texts.length}`) : "";
    // Renumber the labels (the numbers you see come from the list itself)
    box.querySelectorAll(".fr-line-text").forEach((t, n) => t.setAttribute("aria-label", `${kind === "method" ? "Step" : "Ingredient"} ${n + 1}`));
  }
  function renderLines(kind) {
    const box = linesBox(kind);
    if (!box) return;
    const texts = String(field(kind).value || "").split("\n").map(x => x.trim()).filter(Boolean);
    box.innerHTML = (texts.length ? texts : [""]).map((t, n) => lineHtml(kind, t, n)).join("");
    syncKind(kind);
    requestAnimationFrame(autosizeAll);
  }
  function insertAfter(li, kind, text = "") {
    const n = [...li.parentNode.children].indexOf(li) + 1;
    li.insertAdjacentHTML("afterend", lineHtml(kind, text, n));
    const t = li.nextElementSibling.querySelector(".fr-line-text");
    autosize(t);
    return t;
  }
  function addLine(kind) {
    const box = linesBox(kind);
    if (!box) return;
    const last = box.lastElementChild;
    const lastText = last && last.querySelector(".fr-line-text");
    // An empty last row is reused rather than adding another
    const t = lastText && !lastText.value.trim() ? lastText : (last ? insertAfter(last, kind) : null);
    if (t) { t.focus(); t.scrollIntoView({ block: "nearest" }); }
    syncKind(kind);
  }
  function removeLine(li) {
    if (!li) return;
    const box = li.parentNode;
    const kind = box.getAttribute("data-fr-lines");
    const prev = li.previousElementSibling;
    if (box.children.length === 1) { li.querySelector(".fr-line-text").value = ""; autosize(li.querySelector(".fr-line-text")); }
    else li.remove();
    syncKind(kind);
    const focusOn = prev ? prev.querySelector(".fr-line-text") : box.querySelector(".fr-line-text");
    if (focusOn) { focusOn.focus(); const v = focusOn.value.length; focusOn.setSelectionRange(v, v); }
  }
  function wireLines(dlg) {
    dlg.addEventListener("input", (e) => {
      const t = e.target.closest && e.target.closest(".fr-line-text");
      if (!t) return;
      // A line break typed or dropped in: split into rows
      if (t.value.includes("\n")) {
        const parts = t.value.split("\n").map(x => x.trim());
        t.value = parts.shift();
        let li = t.closest(".fr-line");
        parts.filter(Boolean).forEach(part => { const nt = insertAfter(li, t.getAttribute("data-fr-line"), part); li = nt.closest(".fr-line"); });
      }
      autosize(t);
      syncKind(t.getAttribute("data-fr-line"));
    });
    dlg.addEventListener("keydown", (e) => {
      const t = e.target.closest && e.target.closest(".fr-line-text");
      if (!t) return;
      const kind = t.getAttribute("data-fr-line");
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        // Split where the cursor is: the rest goes on a new row below
        const at = t.selectionStart;
        const rest = t.value.slice(at).trim();
        t.value = t.value.slice(0, at).trim();
        autosize(t);
        const nt = insertAfter(t.closest(".fr-line"), kind, rest);
        nt.focus();
        nt.setSelectionRange(0, 0);
        syncKind(kind);
        return;
      }
      if (e.key === "Backspace" && t.selectionStart === 0 && t.selectionEnd === 0) {
        const li = t.closest(".fr-line");
        const prev = li.previousElementSibling;
        if (!prev) return;
        e.preventDefault();
        // Join this row onto the end of the one above
        const pt = prev.querySelector(".fr-line-text");
        const join = pt.value.length;
        pt.value = pt.value + (t.value ? (pt.value ? " " : "") + t.value : "");
        li.remove();
        autosize(pt);
        pt.focus();
        pt.setSelectionRange(join, join);
        syncKind(kind);
      }
    });
    // Sizes are only known once the panel is on screen
    dlg.addEventListener("transitionend", autosizeAll);
    window.addEventListener("resize", () => { if (dlg.open) autosizeAll(); });
  }

  function fill(r, fromPhoto) {
    field("title").value = r.title || "";
    field("emoji").value = r.emoji || "";
    field("servings").value = r.servings || "";
    field("prep").value = parseInt(r.prepTime, 10) || "";
    field("cook").value = parseInt(r.cookTime, 10) || "";
    field("ingredients").value = (r.ingredients || []).join("\n");
    field("method").value = (r.instructions || []).join("\n");
    renderLines("ingredients");
    renderLines("method");
    setMeal(r.mealType || r.category || "dinner");
    const note = document.querySelector("#family-recipe-modal [data-fr-note]");
    if (note) note.hidden = !fromPhoto;
    // Filled in from a photo: where it came from doesn't matter now, so the
    // "From a photo" button goes (it's back for the next new recipe)
    const fromBtn = document.querySelector("#family-recipe-modal [data-fr-photo]");
    if (fromBtn && fromPhoto) fromBtn.hidden = true;
  }

  // Set the form up for a new recipe (or one to edit), without showing it
  function prepare(r, opts = {}) {
    const dlg = dialog();
    editingId = r ? r.id : null;
    dlg.querySelector("#family-recipe-title").textContent = r ? "Edit recipe" : "Add a recipe";
    dlg.querySelector("[data-fr-delete]").hidden = !r;
    // "From a photo" is for a new recipe (on one being edited it would only overwrite it)
    dlg.querySelector("[data-fr-photo]").hidden = !!r || !(window.MagicImport && window.MagicImport.available("recipe"));
    dlg.querySelector("[data-fr-error]").textContent = "";
    fill(r || { mealType: opts.mealType || "dinner" }, false);
    dish = { existing: r && r.photo && r.photo.rev ? { rev: r.photo.rev } : null, data: null, removed: false, recipe: r || null };
    showDish();
    return dlg;
  }

  function openEditor(id = null, opts = {}) {
    const r = id ? list().find(x => x.id === id) : null;
    const dlg = prepare(r, opts);
    if (!dlg.open) dlg.showModal();
    requestAnimationFrame(autosizeAll);
    setTimeout(autosizeAll, 350); // after the panel has slid in
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
      title, emoji: /\p{Extended_Pictographic}/u.test(emoji) ? emoji : mealType === "pudding" ? "🍮" : "🍲",
      subtitle: "Family recipe",
      category: mealType, mealType, tags: [mealType, "family"],
      source: "family", sourceName: "Family recipe",
      servings: num(field("servings").value, 50),
      prepTime: num(field("prep").value, 600) ? String(num(field("prep").value, 600)) : "",
      cookTime: num(field("cook").value, 1440) ? String(num(field("cook").value, 1440)) : "",
      ingredients, instructions,
      updatedAt: new Date().toISOString()
    };
    // The photo of the dish: a new one is saved to its own document (it
    // syncs when there's a signal); the recipe just remembers its rev
    if (dish.data && window.RecipePhotos) {
      const rev = Date.now();
      recipe.photo = { rev };
      window.RecipePhotos.save(recipe.id, dish.data, rev).catch(e => console.warn("Couldn't save the dish photo:", e));
    } else if (dish.removed) {
      if (window.RecipePhotos) window.RecipePhotos.remove(recipe.id);
    } else if (dish.existing) {
      recipe.photo = { rev: dish.existing.rev };
    }
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
    if (r.photo && window.RecipePhotos) window.RecipePhotos.remove(r.id);
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
    const form = document.getElementById("family-recipe-modal");
    (form && form.open ? form : document.body).appendChild(input);
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

  // "📷 Snap a recipe": straight to the camera / photos; the form opens
  // filled in once it's read. Without the photo reader, the empty form.
  function snap(opts = {}) {
    if (!(window.MagicImport && window.MagicImport.available("recipe"))) { openEditor(null, opts); return; }
    const dlg = prepare(null, opts);
    if (dlg.open) dlg.close();
    pickPhotos();
  }

  // The button in the Meals recipe list, and Edit on a family recipe's card
  document.addEventListener("click", (e) => {
    const snapBtn = e.target.closest("[data-snap-recipe]");
    if (snapBtn) { e.preventDefault(); e.stopPropagation(); snap({ mealType: snapBtn.getAttribute("data-meal") || undefined }); return; }
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

  window.FamilyRecipes = { list, save, remove, openEditor, snap, fromBoard, _fill: fill };
})();
