// ============================================================================
// WHAT'S IN THE FRIDGE? (js/fridge.js) · asked for by Steven, 17 Nov
// Like Skylight's Fridge Photo, but it looks in your own recipes first.
//
// The point: what can we make right now with what's here? So no shopping.
//   1. What have you got: Breakfast, Lunch or Dinner (always asked, at the
//      top), then up to 5 photos (fridge, freezer, cupboard) and/or type or
//      say it ("half a bag of spinach, eggs").
//   2. Check: what we read, as a tick list. Untick what's wrong, fix the
//      words, add anything we missed (photos miss things in drawers).
//   3. Ideas you can make now:
//      - From your recipes: the family's recipes and the built-in ones with
//        everything here, or just one or two things short (said honestly:
//        "Just missing a lemon"). Salt, pepper, oil, water and dried spices
//        count as in the cupboard. Everyone's diet and won't-eats are kept to
//        (Magic Mealtime). No AI and no cost.
//      - Something new: one tap and Gemini makes up a recipe from only what's
//        ticked plus cupboard basics (js/magic-import.js, about a penny). Save
//        it to your recipes, or plan it (which saves it too).
//      Cook it opens the recipe; planning from here doesn't ask about the
//      shopping list (js/meal-groceries.js skipNext).
//
// Photos are shrunk and sent to be read, and never kept.
//
//   Fridge.open(meal?, { date? })
//   Fridge.match(recipe, haveKeys)   -> { have, need, total } (for the tests)
// ============================================================================
(function () {
  const MAX_PHOTOS = 5;
  const MAX_SHORT = 2;     // a recipe this many things short still shows ("Just missing a lemon")
  const MAX_TYPED = 300;   // characters in the typing box
  const PER_PAGE = 3;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MEALS = [
    { key: "breakfast", icon: "🥞", label: "Breakfast" },
    { key: "lunch", icon: "🥪", label: "Lunch" },
    { key: "dinner", icon: "🍝", label: "Dinner" }
  ];

  // ---- Matching (no AI) ---------------------------------------------------------------
  // Dried spices and herbs, oil and other cupboard basics: they don't count either way
  const SPICES = /\b(cumin|paprika|turmeric|oregano|cinnamon|nutmeg|chilli powder|chili powder|chilli flakes|chili flakes|cayenne|garam masala|curry powder|mixed herbs|dried \w+|bay leaf|bay leaves|allspice|cloves|cardamom|coriander seeds?|cumin seeds?|fennel seeds?|mustard seeds?|five spice|italian seasoning|ground \w+|vanilla extract|baking powder|bicarbonate|baking soda|stock cubes?|stock pot|sugar|caster sugar|plain flour|self[- ]raising flour|flour|cornflour|vinegar|soy sauce|worcestershire sauce|tomato pur[eé]e|oil|water)\b/i;
  // "coconut milk" isn't milk; "milk" in the fridge isn't coconut milk
  const QUALIFIERS = ["coconut", "almond", "oat", "soy", "soya", "rice", "condensed", "evaporated", "sweet", "spring", "sesame", "peanut"];
  // Meat and fish: chicken is chicken, breast or thigh
  const PROTEINS = ["chicken", "beef", "pork", "lamb", "turkey", "salmon", "cod", "haddock", "tuna", "prawn", "sausage", "bacon", "ham", "mince", "tofu", "egg"];
  const sing = (w) => w.replace(/(ies)$/, "y").replace(/(oes)$/, "o").replace(/([^s])s$/, "$1");
  const wordsOf = (key) => String(key || "").toLowerCase().split(/[^a-z]+/).filter(Boolean).map(sing);

  // An ingredient line -> its key ("2 red peppers, sliced" -> "red pepper"), or null
  function keyOfLine(line) {
    if (window.Grocery && window.Grocery.parseLine) { const p = window.Grocery.parseLine(line); return p ? { key: p.key, basic: !!p.basic } : null; }
    const k = String(line || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    return k ? { key: k, basic: false } : null;
  }
  // Is this recipe ingredient something they've got?
  function same(recipeKey, haveKey) {
    if (recipeKey === haveKey) return true;
    const r = wordsOf(recipeKey), h = wordsOf(haveKey);
    if (!r.length || !h.length) return false;
    // A qualifier on one side only: different things
    if (QUALIFIERS.some(q => r.includes(q) !== h.includes(q))) return false;
    const rLast = r[r.length - 1], hLast = h[h.length - 1];
    if (h.includes(rLast) || r.includes(hLast)) return true;
    return PROTEINS.some(p => r.includes(p) && h.includes(p));
  }
  // recipe + the keys of what they've got -> { have: [lines], need: [lines], haveKeys, total }
  function match(recipe, haveKeys) {
    const have = [], need = [], gotKeys = [];
    const seen = new Set();
    (recipe && recipe.ingredients || []).forEach(line => {
      const k = keyOfLine(line);
      if (!k || k.basic || SPICES.test(String(line)) || seen.has(k.key)) return;
      seen.add(k.key);
      if (haveKeys.some(h => same(k.key, h))) { have.push(line); gotKeys.push(k.key); } else need.push(line);
    });
    return { have, need, haveKeys: gotKeys, total: have.length + need.length };
  }
  // What a need line is called on its own ("2 red peppers" -> "red peppers")
  function nameOf(line) {
    if (window.Grocery && window.Grocery.parseLine) { const p = window.Grocery.parseLine(line); if (p) return (p.label || p.name).toLowerCase(); }
    return String(line).toLowerCase();
  }

  function rankRecipes(all, haveKeys, slot) {
    const fits = (r) => !window.MealGenie || !window.MealGenie.fitsEveryone || window.MealGenie.fitsEveryone(r);
    return all.map(r => {
      const type = String(r.mealType || r.category || "dinner").toLowerCase();
      let fit = type === slot ? 4 : (slot === "lunch" && type === "dinner") ? 1 : (slot === "dinner" && type === "lunch") ? 0.5 : null;
      if (fit === null) return null; // no puddings for dinner, no roasts for breakfast
      const m = match(r, haveKeys);
      // Make it now: everything here, or at most two things short
      if (!m.total || m.need.length > MAX_SHORT || m.have.length < (m.total <= 3 ? 1 : 2)) return null;
      // Short of the thing it's named after ("Long beans" with no beans): not really makeable
      const titleWords = wordsOf(r.title);
      if (m.need.some(line => { const k = keyOfLine(line); const w = k ? wordsOf(k.key) : []; return w.length && titleWords.includes(w[w.length - 1]); })) return null;
      if (!fits(r)) return null;
      const own = !String(r.id || "").startsWith("mealdb-");
      // Using more of what's here beats being one thing short of something
      const score = m.have.length * 2 - m.need.length * 3 + fit + (own ? 1 : 0);
      return { r, m, score };
    }).filter(Boolean).sort((a, b) => ((a.m.need.length ? 1 : 0) - (b.m.need.length ? 1 : 0)) || (b.score - a.score));
  }

  // ---- The sheet --------------------------------------------------------------------
  let dlg = null, state = null, fileInput = null;
  const people = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
  const keyOfDate = (d) => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(d) : d.toISOString().slice(0, 10));
  // Made now: today (or the day of the meal slot it was opened from)
  const planDay = () => state.date || (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })();
  const slotTaken = (d) => { const m = typeof window.getMealForDate === "function" ? window.getMealForDate(d, state.meal) : null; return !!(m && m.title); };
  function dayLabel(d, slot) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return slot === "dinner" ? "tonight" : "today";
    return diff === 1 ? "tomorrow" : `${DAYS[d.getDay()]} ${d.getDate()}`;
  }
  // "Plan for tonight", or "Add to tonight's dinner" when something's already planned
  function planWords(d) {
    const when = dayLabel(d, state.meal);
    if (!state.date && slotTaken(d)) return when === "tonight" ? "Add to tonight's dinner" : `Add to ${when === "today" ? "today" : when}'s ${state.meal}`;
    return `Plan for ${when}`;
  }

  function getDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "fridge-sheet";
    dlg.className = "hm-sheet meal-genie fridge-sheet";
    dlg.setAttribute("aria-labelledby", "fridge-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("input", (e) => {
      if (e.target.id === "fridge-typed") { state.typed = e.target.value; syncShowNext(); return; }
      const t = e.target.closest("[data-fr-text]");
      if (t) { const it = state.items[Number(t.getAttribute("data-fr-text"))]; if (it) it.text = t.value; syncCheckCount(); }
    });
    dlg.addEventListener("change", (e) => {
      const t = e.target.closest("[data-fr-tick]");
      if (!t) return;
      const it = state.items[Number(t.getAttribute("data-fr-tick"))];
      if (it) it.on = t.checked;
      t.closest(".list-review-row").classList.toggle("is-off", !t.checked);
      syncCheckCount();
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target.id === "fridge-extra") { e.preventDefault(); addExtra(); return; }
      if (e.target.closest("[data-fr-text]")) { e.preventDefault(); e.target.blur(); }
    });
    return dlg;
  }
  function close() {
    if (state) state.ticket++;
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    if (!dlg) return;
    if (window.Sheet) window.Sheet.close(dlg); else if (dlg.open) dlg.close();
  }

  const head = (sub) => `<div class="genie-head">
      <span class="genie-mark" aria-hidden="true">🧊</span>
      <div><h2 class="genie-title" id="fridge-title">What's in the fridge?</h2><p class="genie-sub">${esc(sub)}</p></div>
      <button type="button" class="genie-x" data-fr="close" aria-label="Close">✕</button>
    </div>`;
  const typedItems = () => String(state.typed || "").split(/[\n,]+/).map(s => s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean).slice(0, 40);

  function draw() {
    const canPhoto = !!(window.MagicImport && window.MagicImport.available("fridge"));
    const slotWord = (MEALS.find(m => m.key === state.meal) || MEALS[2]).label.toLowerCase();
    if (state.step === "show") {
      const thumbs = state.photos.map((p, i) => `<div class="fridge-thumb"><img src="${p.dataUrl}" alt="Photo ${i + 1}"><button type="button" class="fridge-thumb-x" data-fr="unphoto" data-i="${i}" aria-label="Remove photo ${i + 1}">✕</button></div>`).join("");
      const canTalk = !!(window.Voice && window.Voice.supported());
      dlg.innerHTML = `<div class="genie-card">${head("Show us what's in, and we'll find something to make.")}
        <p class="genie-q" id="fridge-meal-q">Which meal?</p>
        <div class="fridge-meals" role="radiogroup" aria-labelledby="fridge-meal-q">${MEALS.map(m => `<button type="button" class="fridge-meal${state.meal === m.key ? " is-on" : ""}" role="radio" aria-checked="${state.meal === m.key}" data-fr="meal" data-val="${m.key}"><span aria-hidden="true">${m.icon}</span> ${esc(m.label)}</button>`).join("")}</div>
        <p class="genie-q">What have you got?</p>
        ${canPhoto ? `<p class="genie-hint">Take a photo of the fridge, freezer or cupboard (up to ${MAX_PHOTOS}), or type it, or both.</p>
        <div class="fridge-photos">${thumbs}${state.photos.length < MAX_PHOTOS ? `<button type="button" class="fridge-add-photo" data-fr="photo"><span class="fridge-add-photo-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"></path><circle cx="12" cy="13" r="3.5"></circle></svg></span><span>${state.photos.length ? "Add another" : "Add a photo"}</span></button>` : ""}</div>` : `<p class="genie-hint">Type what you've got: one a line, or with commas.</p>`}
        <label class="fridge-type-label" for="fridge-typed">${canPhoto ? `Or type${canTalk ? " or say" : ""} what you've got` : `Type${canTalk ? " or say" : ""} what you've got`}</label>
        <div class="fridge-typed-wrap">
          <textarea id="fridge-typed" class="fridge-typed${canTalk ? " has-mic" : ""}" rows="3" maxlength="${MAX_TYPED}" placeholder="e.g. eggs, half a bag of spinach, cheddar, leftover rice">${esc(state.typed)}</textarea>
          ${canTalk ? `<button type="button" class="fridge-mic${state.listening ? " is-listening" : ""}" data-fr="talk" aria-pressed="${!!state.listening}" aria-label="${state.listening ? "Stop listening" : "Say what you've got"}" title="${state.listening ? "Stop listening" : "Say what you've got"}">${window.Voice.MIC_SVG}</button>` : ""}
        </div>
        ${state.listening ? `<p class="fridge-listening" role="status">Listening… say what you've got</p>` : ""}
        ${state.error ? `<p class="fridge-error" role="alert">${esc(state.error)}</p>` : ""}
        <div class="genie-foot is-sticky">
          <span></span>
          <button type="button" class="genie-plan" data-fr="read">Next</button>
        </div>
      </div>`;
      syncShowNext();
      return;
    }
    if (state.step === "reading") {
      dlg.innerHTML = `<div class="genie-card">${head(`Finding you a ${slotWord}.`)}
        <div class="fridge-reading" role="status" aria-live="polite">
          <div class="fridge-reading-photos">${state.photos.map(p => `<span class="fridge-reading-photo"><img src="${p.dataUrl}" alt=""><span class="magic-import-scan" aria-hidden="true"></span></span>`).join("")}</div>
          <p class="genie-q">Having a look in your fridge…</p>
          <p class="genie-hint">We're spotting the food in your photo${state.photos.length === 1 ? "" : "s"}. This takes a few seconds.</p>
        </div>
        <div class="genie-foot"><span></span><button type="button" class="genie-back" data-fr="cancel-read">Cancel</button></div>
      </div>`;
      return;
    }
    if (state.step === "check") {
      const rows = state.items.map((it, n) => `<label class="list-review-row${it.on ? "" : " is-off"}">
          <input type="checkbox" class="list-review-tick" data-fr-tick="${n}" ${it.on ? "checked" : ""} aria-label="Use ${esc(it.text || "this")}">
          <input type="text" class="list-review-text" data-fr-text="${n}" value="${esc(it.text)}" aria-label="Food ${n + 1}" autocomplete="off" enterkeyhint="done">
        </label>`).join("");
      dlg.innerHTML = `<div class="genie-card">${head(`Finding you a ${slotWord}.`)}
        <p class="genie-q">Is this right?</p>
        ${state.fromPhotos ? `<p class="fridge-note">📷 We might have misread something. Untick anything that's wrong, or tap the words to change them.</p>` : ""}
        <div class="list-review">
          <div class="list-review-head"><span class="list-review-count" id="fridge-count"></span><button type="button" class="list-review-all" data-fr="all">Untick all</button></div>
          ${rows ? `<div class="list-review-items">${rows}</div>` : `<p class="genie-hint">Nothing yet. Add what you've got below.</p>`}
        </div>
        <div class="fridge-extra-row">
          <input type="text" id="fridge-extra" class="fridge-extra" placeholder="Add something we missed" autocomplete="off" enterkeyhint="done" aria-label="Add something we missed">
          <button type="button" class="genie-recipe" data-fr="extra">＋ Add</button>
        </div>
        <div class="genie-foot is-sticky">
          <button type="button" class="genie-back" data-fr="to-show">‹ Back</button>
          <button type="button" class="genie-plan" data-fr="find" id="fridge-find">Find meals</button>
        </div>
      </div>`;
      syncCheckCount();
      return;
    }
    // Results
    const slot = state.meal;
    const list = state.results.slice(state.page * PER_PAGE, state.page * PER_PAGE + PER_PAGE);
    const canIdea = !!(window.MagicImport && window.MagicImport.available("idea"));
    const need = (m) => m.need.length === 0 ? `<span class="fridge-need is-none">✓ You've got everything</span>`
      : `<span class="fridge-need">Just missing ${esc(m.need.map(nameOf).join(" and "))}</span>`;
    const today = state.date || (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })();
    const planLabel = esc(planWords(today));
    const ideaHtml = () => {
      const idea = state.idea;
      if (!canIdea) return "";
      if (!idea) return `<button type="button" class="fridge-idea-btn" data-fr="idea"><span aria-hidden="true">✨</span><span><strong>Make up a new recipe</strong><small>From just what you've got, to suit everyone</small></span></button>`;
      if (idea.loading) return `<div class="fridge-idea is-loading" role="status"><span class="fridge-idea-spin" aria-hidden="true">✨</span> Thinking up a recipe…</div>`;
      if (idea.error) return `<div class="fridge-idea"><p class="fridge-error" role="alert">${esc(idea.error)}</p><button type="button" class="genie-recipe" data-fr="idea">Try again</button></div>`;
      const r = idea.recipe, m = idea.m;
      const mins = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);
      return `<div class="fridge-idea">
        <div class="fridge-idea-top"><span class="fridge-idea-emoji" aria-hidden="true">${esc(r.emoji || "🍲")}</span>
          <div><strong class="genie-result-title">${esc(r.title)}</strong>
          <span class="genie-result-sub">Made up for you${mins ? ` · about ${mins} mins` : ""}${r.servings ? ` · serves ${r.servings}` : ""}</span></div></div>
        ${m ? `<p class="fridge-have-line">${need(m)}</p>` : ""}
        ${idea.unsuitable ? `<p class="fridge-error">Check it over: it may have something someone won't eat.</p>` : ""}
        <details class="fridge-idea-more"><summary>Ingredients and method</summary>
          <ul>${r.ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
          <ol>${r.instructions.map(i => `<li>${esc(i)}</li>`).join("")}</ol>
        </details>
        <div class="genie-result-actions">
          <button type="button" class="genie-plan" data-fr="cook-idea">🍳 Cook it</button>
          <button type="button" class="genie-recipe" data-fr="plan-idea">📅 ${planLabel}</button>
          <button type="button" class="genie-recipe" data-fr="save-idea"${idea.saved ? " disabled" : ""}>${idea.saved ? "✓ Saved" : "💾 Save recipe"}</button>
          <button type="button" class="genie-recipe" data-fr="idea">🔄 Another</button>
        </div>
      </div>`;
    };
    dlg.innerHTML = `<div class="genie-card">${head(`Finding you a ${state.meal === "dinner" ? "dinner" : state.meal}.`)}
      <p class="genie-q">${!list.length ? "Nothing in your recipes fits what's here" : state.results.some(x => !x.m.need.length) ? "You can make these now" : "So close: just a thing or two short"}</p>
      ${list.length ? "" : `<p class="genie-hint">${canIdea ? "Let's make up something new from what you've got instead." : "Try adding a few more things."}</p>`}
      <ul class="genie-results">${list.map(({ r, m }) => `<li class="genie-result">
        ${r.image ? `<img class="genie-photo" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="genie-photo is-emoji" aria-hidden="true">${esc(r.emoji || "🍽️")}</span>`}
        <div class="genie-result-body">
          <strong class="genie-result-title">${esc(r.title)}</strong>
          <span class="fridge-have-line">${need(m)}</span>
          <div class="genie-result-actions">
            <button type="button" class="genie-plan" data-fr="recipe" data-id="${esc(r.id)}">🍳 Cook it</button>
            <button type="button" class="genie-recipe" data-fr="plan" data-id="${esc(r.id)}">📅 ${planLabel}</button>
          </div>
        </div>
      </li>`).join("")}</ul>
      ${state.results.length > PER_PAGE ? `<button type="button" class="genie-more" data-fr="more">🔄 Show me others</button>` : ""}
      ${canIdea ? `<p class="genie-q fridge-new-q">Something new</p>${ideaHtml()}` : ""}
      <div class="genie-foot">
        <button type="button" class="genie-back" data-fr="to-check">‹ Change what I've got</button>
      </div>
    </div>`;
  }

  function syncShowNext() {
    const go = dlg && dlg.querySelector('[data-fr="read"]');
    if (go) go.disabled = !state.photos.length && !typedItems().length;
  }
  function syncCheckCount() {
    const on = state.items.filter(it => it.on && it.text.trim()).length;
    const c = dlg.querySelector("#fridge-count");
    if (c) c.textContent = `${on} of ${state.items.length} ticked`;
    const all = dlg.querySelector('[data-fr="all"]');
    if (all) all.textContent = state.items.length && state.items.every(it => it.on) ? "Untick all" : "Tick all";
    const find = dlg.querySelector("#fridge-find");
    if (find) find.disabled = !on;
  }
  function addExtra() {
    const input = dlg.querySelector("#fridge-extra");
    const text = input ? input.value.trim() : "";
    if (!text) return;
    text.split(/,+/).map(s => s.trim()).filter(Boolean).forEach(t => {
      if (!state.items.some(it => it.text.trim().toLowerCase() === t.toLowerCase())) state.items.push({ text: t, on: true });
    });
    draw();
    const again = dlg.querySelector("#fridge-extra");
    if (again) again.focus();
  }
  // Merge in new items (no doubles, case aside)
  function mergeItems(texts) {
    texts.forEach(t => { if (!state.items.some(it => it.text.trim().toLowerCase() === t.toLowerCase())) state.items.push({ text: t, on: true }); });
  }

  function pickPhotos() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;
      fileInput.hidden = true;
      fileInput.addEventListener("click", (e) => e.stopPropagation());
      fileInput.addEventListener("change", async () => {
        const files = [...(fileInput.files || [])].slice(0, MAX_PHOTOS - state.photos.length);
        fileInput.value = "";
        for (const f of files) {
          try { const s = await window.MagicImport.shrink(f); state.photos.push({ file: f, dataUrl: s.dataUrl }); }
          catch (err) { state.error = err.message; }
        }
        if (state.step === "show") draw();
      });
    }
    // Inside the sheet: some browsers won't open a file box from outside the open dialog
    if (fileInput.parentElement !== dlg) dlg.appendChild(fileInput);
    fileInput.click();
  }

  async function read() {
    state.error = "";
    const typed = typedItems();
    if (!state.photos.length) {
      state.items = []; state.fromPhotos = false;
      mergeItems(typed);
      state.step = "check"; draw();
      return;
    }
    const ticket = ++state.ticket;
    state.step = "reading"; draw();
    try {
      const found = await window.MagicImport.readFood(state.photos.map(p => p.file));
      if (ticket !== state.ticket) return;
      state.items = []; state.fromPhotos = true;
      mergeItems([...found, ...typed]);
      if (!found.length && !typed.length) { state.step = "show"; state.error = "We couldn't spot any food. Try a closer photo in good light, or type what you've got."; draw(); return; }
      state.step = "check"; draw();
    } catch (err) {
      if (ticket !== state.ticket) return;
      state.step = "show"; state.error = err.message; draw();
    }
  }

  function haveKeys() {
    return state.items.filter(it => it.on && it.text.trim()).map(it => keyOfLine(it.text)).filter(Boolean).map(k => k.key);
  }
  function find() {
    const all = typeof window.getAllFamilyRecipes === "function" ? window.getAllFamilyRecipes() : [];
    state.results = rankRecipes(all, haveKeys(), state.meal);
    state.page = 0;
    state.idea = null;
    state.step = "results";
    draw();
    const card = dlg.querySelector(".genie-card");
    if (card) card.scrollTop = 0;
  }

  async function idea() {
    const ticket = ++state.ticket;
    state.idea = { loading: true };
    draw();
    const have = state.items.filter(it => it.on && it.text.trim()).map(it => it.text.trim());
    try {
      const avoid = window.MealGenie && window.MealGenie.tastesSummary ? window.MealGenie.tastesSummary() : "";
      const r = await window.MagicImport.invent({ meal: state.meal, have, avoid, serves: Math.max(2, people().length || 4) });
      if (ticket !== state.ticket) return;
      const recipe = {
        id: `family-${Date.now()}`,
        title: r.title, emoji: r.emoji || "🍲",
        subtitle: "Family recipe", category: state.meal, mealType: state.meal, tags: [state.meal, "family"],
        source: "family", sourceName: "Family recipe",
        servings: r.servings || null, prepTime: r.prepTime || "", cookTime: r.cookTime || "",
        ingredients: r.ingredients, instructions: r.instructions,
        updatedAt: new Date().toISOString()
      };
      const unsuitable = !!(window.MealGenie && window.MealGenie.fitsEveryone && !window.MealGenie.fitsEveryone(recipe));
      state.idea = { recipe, m: match(recipe, haveKeys()), unsuitable, saved: false };
      draw();
      const el = dlg.querySelector(".fridge-idea");
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (err) {
      if (ticket !== state.ticket) return;
      state.idea = { error: err.message };
      draw();
    }
  }
  function saveIdea() {
    const idea = state.idea;
    if (!idea || !idea.recipe || !window.FamilyRecipes) return null;
    if (!idea.saved) { window.FamilyRecipes.save(idea.recipe); idea.saved = true; }
    return idea.recipe;
  }

  // Into the plan for today. It's made from what's here, so no "add the
  // ingredients to the shopping list?"
  function plan(recipe) {
    const slot = state.meal;
    const day = planDay();
    const fromDrawer = !!state.date;
    const add = !fromDrawer && slotTaken(day);
    close();
    setTimeout(() => {
      if (fromDrawer && typeof window.closePlanMealDrawer === "function") window.closePlanMealDrawer();
      if (window.MealGroceries && window.MealGroceries.skipNext) window.MealGroceries.skipNext();
      if (typeof window.planRecipeOn === "function") window.planRecipeOn(recipe, keyOfDate(day), slot, add ? { add: true } : {});
      if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🧊 ${recipe.title} ${add ? "added to" : "planned for"} ${dayLabel(day, slot)}${add ? `'s ${slot}` : ""}!`);
    }, 250);
  }

  // The recipe card, to cook from now
  function cook(recipe) {
    const slot = state.meal, day = planDay();
    close();
    setTimeout(() => { if (typeof window.openCookingRecipeModal === "function") window.openCookingRecipeModal(recipe, keyOfDate(day), slot); }, 250);
  }

  // 🎤 on the typing box: what's said goes in the box (no meaning read into it)
  let rec = null;
  function talk() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return;
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    const r = new Rec();
    rec = r;
    r.lang = "en-GB";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = [...e.results].map(x => x[0].transcript).join(" ").trim();
      if (!said) return;
      const now = String(state.typed || "").trim();
      state.typed = (now ? `${now.replace(/[,\s]+$/, "")}, ${said}` : said).slice(0, MAX_TYPED);
    };
    const done = () => { if (rec === r) rec = null; state.listening = false; if (state.step === "show") draw(); };
    r.onend = done;
    r.onerror = done;
    try { r.start(); state.listening = true; draw(); } catch (e) { rec = null; }
  }

  function onClick(e) {
    if (e.target === dlg) { close(); return; }
    const b = e.target.closest("[data-fr]");
    if (!b) return;
    const act = b.getAttribute("data-fr");
    if (act === "close") { close(); return; }
    if (act === "meal") { state.meal = b.getAttribute("data-val"); draw(); return; }
    if (act === "talk") { talk(); return; }
    if (act === "photo") { pickPhotos(); return; }
    if (act === "unphoto") { state.photos.splice(Number(b.getAttribute("data-i")), 1); draw(); return; }
    if (act === "read") { read(); return; }
    if (act === "cancel-read") { state.ticket++; state.step = "show"; draw(); return; }
    if (act === "to-show") { state.step = "show"; draw(); return; }
    if (act === "to-check") { state.ticket++; state.step = "check"; draw(); return; }
    if (act === "all") { const allOn = state.items.every(it => it.on); state.items.forEach(it => { it.on = !allOn; }); draw(); return; }
    if (act === "extra") { addExtra(); return; }
    if (act === "find") { find(); return; }
    if (act === "more") { state.page = (state.page + 1) * PER_PAGE >= state.results.length ? 0 : state.page + 1; draw(); return; }
    if (act === "idea") { idea(); return; }
    if (act === "save-idea") {
      const r = saveIdea();
      if (r) { draw(); if (typeof window.showCalendarToast === "function") window.showCalendarToast(`💾 ${r.title} saved to your recipes`); }
      return;
    }
    if (act === "plan-idea") { const r = saveIdea(); if (r) plan(r); return; }
    if (act === "cook-idea") { const r = state.idea && state.idea.recipe; if (r) cook(r); return; }
    const hit = state.results.find(x => String(x.r.id) === b.getAttribute("data-id"));
    if (!hit) return;
    if (act === "plan") { plan(hit.r); return; }
    if (act === "recipe") cook(hit.r);
  }

  // meal: "breakfast" | "lunch" | "dinner" (a guess from the time if not given)
  // opts.date: "2026-11-17" when opened from that day's meal slot
  function open(meal, opts = {}) {
    const h = new Date().getHours();
    const known = ["breakfast", "lunch", "dinner"].includes(meal);
    const date = opts.date ? new Date(`${opts.date}T00:00:00`) : null;
    state = {
      step: "show",
      meal: known ? meal : (h < 10 ? "breakfast" : h < 14 ? "lunch" : "dinner"),
      date: date && !isNaN(date) ? date : null,
      photos: [], typed: "", listening: false, items: [], fromPhotos: false, results: [], page: 0, idea: null, error: "", ticket: 0
    };
    getDialog();
    draw();
    if (!dlg.open) dlg.showModal();
  }

  window.Fridge = { open, match, _same: same, _rank: rankRecipes };
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-open-fridge]")) open();
  });
})();
