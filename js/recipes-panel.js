// ============================================================================
// RECIPES PANEL (js/recipes-panel.js)
// "📖 Recipes" on the Meals page: the family's own recipes, favourites and a
// search across every recipe, without going through Plan Meal. Tapping one
// opens its card, where "Add to meal plan" plans it.
//
// Rows, favourites and the card come from js/meals.js (window.RecipeRows).
// ============================================================================
(function () {
  const MAX_RESULTS = 30;
  let showAll = false;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  function dialog() {
    let dlg = document.getElementById("recipes-panel");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "recipes-panel";
    dlg.className = "roster-dialog recipes-panel-dialog";
    dlg.setAttribute("aria-labelledby", "recipes-panel-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-rp-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="recipes-panel-title" class="modal-title">Recipes</h2></div>
        <div class="recipes-panel-body">
          <div class="drawer-input-row drawer-search-bar recipes-panel-search">
            <span class="drawer-input-icon search-icon" aria-hidden="true">🔍</span>
            <input type="search" class="drawer-input-title drawer-search-input" data-rp-search placeholder="Search recipes or ingredients" autocomplete="off" aria-label="Search recipes">
          </div>
          <button type="button" class="family-recipe-add" data-add-family-recipe>
            <span aria-hidden="true">＋</span> Add your own recipe
          </button>
          <div class="drawer-recipes-list recipes-panel-list" data-rp-list aria-live="polite"></div>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.querySelector("[data-rp-close]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => { if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock(); });
    dlg.querySelector("[data-rp-search]").addEventListener("input", () => { showAll = false; render(); });
    dlg.querySelector("[data-rp-list]").addEventListener("click", onListClick);
    return dlg;
  }

  function onListClick(e) {
    const R = window.RecipeRows;
    if (!R) return;
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.stopPropagation();
      const on = R.toggleFav(fav.getAttribute("data-fav"));
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", String(on));
      fav.innerHTML = on ? "♥" : "♡";
      setTimeout(render, on ? 450 : 0);
      return;
    }
    if (e.target.closest("[data-rp-more]")) { showAll = true; render(); return; }
    const row = e.target.closest(".drawer-recipe-card");
    if (row) {
      const r = R.find(row.getAttribute("data-recipe-id"));
      if (r) R.open(r);
    }
  }

  const isOwn = (r) => !String(r.id || "").startsWith("mealdb-");

  function render() {
    const dlg = document.getElementById("recipes-panel");
    const R = window.RecipeRows;
    if (!dlg || !R) return;
    const list = dlg.querySelector("[data-rp-list]");
    const q = dlg.querySelector("[data-rp-search]").value.trim().toLowerCase();
    const all = R.all();
    const rows = (rs) => rs.map(R.rowHtml).join("");

    if (q) {
      const hits = all.filter(r =>
        String(r.title || "").toLowerCase().includes(q)
        || String(r.subtitle || "").toLowerCase().includes(q)
        || (Array.isArray(r.ingredients) && r.ingredients.some(i => String(i || "").toLowerCase().includes(q))));
      // The family's own first
      hits.sort((a, b) => Number(isOwn(b)) - Number(isOwn(a)));
      if (!hits.length) {
        list.innerHTML = `<p class="recipes-panel-empty"><strong>Nothing called "${esc(q)}"</strong>Try another word, or add it as your own recipe.</p>`;
        return;
      }
      const shown = showAll ? hits : hits.slice(0, MAX_RESULTS);
      list.innerHTML = rows(shown)
        + (hits.length > shown.length ? `<button type="button" class="drawer-recipes-more" data-rp-more>Show ${hits.length - shown.length} more</button>` : "");
      return;
    }

    const own = all.filter(isOwn);
    const favs = all.filter(r => !isOwn(r) && R.isFav(r));
    list.innerHTML =
      `<p class="drawer-recipes-heading">Your recipes</p>`
      + (own.length ? rows(own) : `<p class="drawer-fav-empty">Recipes you add show here.</p>`)
      + `<p class="drawer-recipes-heading">❤️ Family favourites</p>`
      + (favs.length ? rows(favs) : `<p class="drawer-fav-empty">Tap the <span aria-hidden="true">♡</span> on any recipe to keep your family's favourites here.</p>`)
      + `<p class="recipes-panel-hint">Search above to find any of the ${all.length} recipes.</p>`;
  }

  function open() {
    const dlg = dialog();
    const search = dlg.querySelector("[data-rp-search]");
    search.value = "";
    showAll = false;
    render();
    if (!dlg.open) dlg.showModal();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
    if (typeof window.scrollPanelToTop === "function") window.scrollPanelToTop(dlg);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-recipes]")) { e.preventDefault(); open(); }
  });
  // A recipe added, changed or deleted (here or on another device)
  document.addEventListener("harmonee:data", () => { const d = document.getElementById("recipes-panel"); if (d && d.open) render(); });

  window.RecipesPanel = { open, refresh: render };
})();
