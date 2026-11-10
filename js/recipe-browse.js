// ============================================================================
// RECIPES TAB (js/recipe-browse.js)
// Meals has two tabs: "This week" (the plan) and "Recipes". Recipes is all
// photos: your family's recipes, favourites, then collections (Chicken,
// Veggie, Italian…) built from what's in the recipe list, and a search.
// Tapping a recipe opens its card, where "Add to meal plan" plans it.
//
// Rows, favourites and the card come from js/meals.js (window.RecipeRows).
// Collections only show when they have at least MIN recipes, so nothing is
// promised that isn't there.
// ============================================================================
(function () {
  const MIN = 4;
  let tab = "week";
  let state = { mode: "home", id: null };
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const R = () => window.RecipeRows;

  // ---- What a recipe is --------------------------------------------------------------
  const meal = (r) => String(r.mealType || r.category || "").toLowerCase();
  const tags = (r) => (Array.isArray(r.tags) ? r.tags : []).map(t => String(t).toLowerCase());
  // TheMealDB subtitles are "Country · Main ingredient"
  const part = (r, i) => String(String(r.subtitle || "").split("·")[i] || "").trim().toLowerCase();
  const isFamily = (r) => r.source === "family" || String(r.id || "").startsWith("family-");
  const isOwn = (r) => !String(r.id || "").startsWith("mealdb-");

  const COLLECTIONS = [
    // A fixed cover where the recipes' own photos don't suit (a fry-up for "Breakfast")
    { id: "breakfast", name: "Breakfast", cover: "images/recipes/stock/porridge.jpg", test: r => meal(r) === "breakfast" },
    { id: "lunch", name: "Lunch", test: r => meal(r) === "lunch" },
    { id: "veggie", name: "Veggie", test: r => ["vegetarian", "vegan"].includes(part(r, 1)) || tags(r).includes("veggie") || tags(r).includes("vegetarian") },
    { id: "chicken", name: "Chicken", test: r => part(r, 1) === "chicken" || part(r, 0) === "chicken" },
    { id: "beef", name: "Beef", test: r => part(r, 1) === "beef" },
    { id: "seafood", name: "Fish and seafood", test: r => part(r, 1) === "seafood" },
    { id: "pork", name: "Pork", test: r => part(r, 1) === "pork" },
    { id: "lamb", name: "Lamb", test: r => part(r, 1) === "lamb" },
    { id: "pasta", name: "Pasta", test: r => part(r, 1) === "pasta" || tags(r).includes("pasta") },
    { id: "snack", name: "Snacks and puddings", test: r => meal(r) === "snack" }
  ];
  const WORLD = [["British", "british"], ["Italian", "italian"], ["Spanish", "spanish"], ["Chinese", "chinese"], ["Indian", "india"], ["Thai", "thai"], ["Vietnamese", "vietnamese"], ["French", "france"], ["American", "united states"], ["Mexican", "mexican"], ["Turkish", "turkish"], ["Japanese", "japanese"], ["Greek", "greek"]]
    .map(([name, key]) => ({ id: "world-" + key.replace(/\s+/g, "-"), name, test: r => part(r, 0) === key }));
  const findCollection = (id) => [...COLLECTIONS, ...WORLD].find(c => c.id === id);

  // ---- Pictures ----------------------------------------------------------------------
  // TheMealDB serves smaller copies: /medium (about 40KB) for tiles, /small for rows
  function photo(r, size) {
    const src = String(r.image || r.imageUrl || "");
    if (/^https:\/\/www\.themealdb\.com\/images\/[\w\/.-]+\.(jpg|png)$/i.test(src)) return `${src}/${size}`;
    if (/^images\/[\w\/.-]+\.(jpg|jpeg|png|webp)$/i.test(src)) return src;
    if (window.RecipePhotos && window.RecipePhotos.isDataUrl(src)) return src; // a photo of your own dish
    return "";
  }
  // No photo (your own recipes, for now): a bright tile with its emoji
  const TINTS = ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#ddd6fe", "#a5f3fc"];
  function tint(r) { let h = 0; for (const c of String(r.title || r.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; }
  function picture(r, size, cls) {
    const src = photo(r, size);
    return src
      ? `<span class="${cls}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="${cls} is-emoji" style="background:${tint(r)}" aria-hidden="true">${esc(r.emoji || "🍲")}</span>`;
  }

  // ---- Pieces ------------------------------------------------------------------------
  function tile(r) {
    const fav = R().isFav(r);
    const sub = isFamily(r) ? "Family recipe" : String(r.subtitle || "").split("·").map(s => s.trim()).filter(Boolean).slice(0, 2).join(" · ");
    return `<div class="rb-tile">
      <button type="button" class="rb-open" data-rb-recipe="${esc(r.id)}">
        ${picture(r, "medium", "rb-photo")}
        <span class="rb-title">${esc(r.title)}</span>
        ${sub ? `<span class="rb-sub">${esc(sub)}</span>` : ""}
      </button>
      <button type="button" class="rb-fav${fav ? " is-on" : ""}" data-rb-fav="${esc(r.id)}" aria-pressed="${fav}" aria-label="Family favourite: ${esc(r.title)}">${window.heartIcon ? window.heartIcon(fav) : (fav ? "♥" : "♡")}</button>
    </div>`;
  }
  // Each collection gets its own cover photo (a built-in one if it can)
  let usedCovers = new Set();
  function collectionRow(c, list) {
    const withPhoto = list.filter(r => photo(r, "small"));
    const cover = c.cover ? { id: c.id, image: c.cover } : withPhoto.find(r => !isOwn(r) && !usedCovers.has(r.id)) || withPhoto.find(r => !usedCovers.has(r.id)) || withPhoto[0] || list[0];
    usedCovers.add(cover.id);
    return `<button type="button" class="rb-collection" data-rb-collection="${esc(c.id)}">
      ${picture(cover, "small", "rb-collection-photo")}
      <span class="rb-collection-words"><strong>${esc(c.name)}</strong><span>${list.length} recipes</span></span>
      <span class="rb-chevron" aria-hidden="true">›</span>
    </button>`;
  }
  const grid = (list, cls = "") => `<div class="rb-grid ${cls}">${list.map(tile).join("")}</div>`;

  // ---- Views -------------------------------------------------------------------------
  function topBar(q) {
    return `<div class="rb-top">
      <label class="rb-search"><span aria-hidden="true">🔍</span>
        <input type="search" data-rb-search placeholder="Search recipes or ingredients" autocomplete="off" aria-label="Search recipes" value="${esc(q)}">
      </label>
      <button type="button" class="rb-ideas-chip" data-open-genie title="Not sure what to make? Answer a few questions, get three ideas"><span aria-hidden="true">🪄</span> Ideas</button>
      <button type="button" class="rb-snap" data-snap-recipe><span aria-hidden="true">📷</span> Snap a recipe</button>
    </div>`;
  }

  function home(all) {
    usedCovers = new Set();
    const family = all.filter(isOwn);
    const favs = all.filter(r => !isOwn(r) && R().isFav(r));
    const sections = (cs) => cs.map(c => [c, all.filter(c.test)]).filter(([, l]) => l.length >= MIN).map(([c, l]) => collectionRow(c, l)).join("");
    return `
      <section class="rb-section">
        <h3 class="rb-h">Your family's recipes <span>${family.length}</span></h3>
        <div class="rb-grid rb-family">
          ${family.map(tile).join("")}
          <button type="button" class="rb-add" data-add-family-recipe><span aria-hidden="true">＋</span>Type a recipe</button>
        </div>
      </section>
      ${favs.length ? `<section class="rb-section"><h3 class="rb-h">❤️ Favourites <span>${favs.length}</span></h3><div class="rb-strip">${favs.map(tile).join("")}</div></section>` : ""}
      <section class="rb-section"><h3 class="rb-h">Collections</h3><div class="rb-collections">${sections(COLLECTIONS)}</div></section>
      <section class="rb-section"><h3 class="rb-h">Around the world</h3><div class="rb-collections">${sections(WORLD)}</div></section>
      <p class="rb-count">${all.length} recipes in all. Search to find any of them.</p>`;
  }

  function collection(all, c) {
    const list = all.filter(c.test);
    return `<div class="rb-back-row"><button type="button" class="rb-back" data-rb-home>‹ All recipes</button></div>
      <h3 class="rb-h rb-h-big">${esc(c.name)} <span>${list.length}</span></h3>
      ${grid(list)}`;
  }

  function search(all, q) {
    const s = q.toLowerCase();
    const hits = all.filter(r =>
      String(r.title || "").toLowerCase().includes(s)
      || String(r.subtitle || "").toLowerCase().includes(s)
      || (Array.isArray(r.ingredients) && r.ingredients.some(i => String(i || "").toLowerCase().includes(s))));
    hits.sort((a, b) => Number(isOwn(b)) - Number(isOwn(a)));
    if (!hits.length) return `<p class="rb-empty"><strong>Nothing called "${esc(q)}"</strong>Try another word, or snap it as your own recipe.</p>`;
    return `<h3 class="rb-h">${hits.length} found</h3>${grid(hits)}`;
  }

  function render() {
    const view = document.getElementById("meals-recipes-view");
    if (!view || !R() || tab !== "recipes") return;
    const all = R().all();
    const input = view.querySelector("[data-rb-search]");
    const q = input ? input.value.trim() : "";
    const hadFocus = input && document.activeElement === input;
    const body = q ? search(all, q)
      : state.mode === "collection" && findCollection(state.id) ? collection(all, findCollection(state.id))
      : home(all);
    if (!input) view.innerHTML = topBar("") + `<div class="rb-body" data-rb-body></div>`;
    view.querySelector("[data-rb-body]").innerHTML = body;
    view.classList.toggle("is-home", !q && state.mode !== "collection");
    if (hadFocus) view.querySelector("[data-rb-search]").focus();
  }

  // ---- Tabs --------------------------------------------------------------------------
  function setTab(next) {
    tab = next === "recipes" ? "recipes" : "week";
    const page = document.getElementById("view-meals");
    if (page) page.classList.toggle("is-recipes-tab", tab === "recipes");
    document.querySelectorAll("[data-meals-tab]").forEach(b => {
      const on = b.getAttribute("data-meals-tab") === tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", String(on));
    });
    const view = document.getElementById("meals-recipes-view");
    if (view) view.hidden = tab !== "recipes";
    if (tab === "recipes") { render(); if (view) view.scrollTop = 0; }
  }

  // ---- Taps --------------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-meals-tab]");
    if (t) { setTab(t.getAttribute("data-meals-tab")); return; }
    const view = document.getElementById("meals-recipes-view");
    if (!view || !view.contains(e.target)) return;
    const fav = e.target.closest("[data-rb-fav]");
    if (fav) {
      const on = R().toggleFav(fav.getAttribute("data-rb-fav"));
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", String(on));
      if (window.heartIcon) fav.innerHTML = window.heartIcon(on); else fav.textContent = on ? "♥" : "♡";
      fav.classList.remove("pop"); void fav.offsetWidth; if (on) fav.classList.add("pop");
      return;
    }
    const open = e.target.closest("[data-rb-recipe]");
    if (open) { const r = R().find(open.getAttribute("data-rb-recipe")); if (r) R().open(r); return; }
    const col = e.target.closest("[data-rb-collection]");
    if (col) { state = { mode: "collection", id: col.getAttribute("data-rb-collection") }; render(); view.scrollTop = 0; view.scrollIntoView({ block: "start" }); return; }
    if (e.target.closest("[data-rb-home]")) { state = { mode: "home", id: null }; render(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target && e.target.matches && e.target.matches("#meals-recipes-view [data-rb-search]")) render();
  });
  // A recipe added, changed or deleted (here or on another device)
  document.addEventListener("harmonee:data", () => render());

  window.RecipeBrowse = { setTab, refresh: render, tab: () => tab, collections: () => [...COLLECTIONS, ...WORLD] };
})();
