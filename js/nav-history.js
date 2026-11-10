// ============================================================================
// BACK AND FORWARD (js/nav-history.js)
// harmonee is one page that swaps what's on screen, so the browser used to
// see no history at all: the phone's Back button left the app. Now:
//   - Each page has its own address: #calendar, #tasks, #meals,
//     #meals/recipes, #lists, #rewards. Back and Forward move between them,
//     a refresh stays on the page, and a link can open a page directly.
//   - Back closes what's open first: a pop-up or side panel, the Plan Meal
//     panel, a list opened on a phone, a recipe collection. (Shop mode looks
//     after its own Back, js/shop-mode.js.)
// The kitchen tablet, tapped between pages all day, doesn't pile up history
// without end: after 60 steps it stops adding and just updates the address.
// ============================================================================
(function () {
  const HASH_OF = { calendar: "calendar", chores: "tasks", meals: "meals", lists: "lists", rewards: "rewards" };
  const VIEW_OF = { calendar: "calendar", tasks: "chores", chores: "chores", meals: "meals", lists: "lists", rewards: "rewards" };
  const MAX_STEPS = 60;
  let started = false;
  let restoring = false;
  let ignorePops = 0;
  let steps = 0;
  const layers = []; // open things Back should close first: { id, close }

  function parse(hash) {
    const [v, sub] = String(hash || "").replace(/^#/, "").split("/");
    const view = VIEW_OF[v];
    return view ? { view, tab: view === "meals" && sub === "recipes" ? "recipes" : "week" } : null;
  }
  const hashFor = (view, tab) => `#${HASH_OF[view] || "calendar"}${view === "meals" && tab === "recipes" ? "/recipes" : ""}`;
  const urlWith = (hash) => location.pathname + location.search + hash;
  const current = () => ({ view: window.currentActiveView || "calendar", tab: window.RecipeBrowse ? window.RecipeBrowse.tab() : "week" });

  // A page (or the Meals tab) was shown: give it its own step in the history
  function record() {
    if (restoring) return;
    const cur = current();
    const hash = hashFor(cur.view, cur.tab);
    const state = { hm: true, view: cur.view, tab: cur.tab };
    try {
      if (!started) { started = true; history.replaceState(state, "", urlWith(hash)); return; }
      if (location.hash === hash) return;
      steps++;
      if (steps > MAX_STEPS) history.replaceState(state, "", urlWith(hash));
      else history.pushState(state, "", urlWith(hash));
    } catch (e) {}
  }

  // Something Back should close first opened / closed
  function openLayer(id, close) {
    if (!started || restoring || layers.some(l => l.id === id)) return;
    layers.push({ id, close });
    try { history.pushState({ ...(history.state || {}), hm: true, layer: id }, "", location.href); } catch (e) {}
  }
  function closedLayer(id) {
    const i = layers.findIndex(l => l.id === id);
    if (i < 0) return;
    layers.splice(i, 1);
    // Closed with its own button: take its step back off the history too
    if (history.state && history.state.layer === id) { ignorePops++; try { history.back(); } catch (e) { ignorePops--; } }
  }

  window.addEventListener("popstate", (e) => {
    if (ignorePops) { ignorePops--; return; }
    if (document.body.classList.contains("shop-mode-open")) return; // Shop mode closes itself
    if (layers.length) {
      const layer = layers.pop();
      try { layer.close(); } catch (err) {}
      return;
    }
    const st = (e.state && e.state.hm && e.state.view) ? e.state : parse(location.hash);
    if (!st || typeof window.switchSkylightView !== "function") return;
    restoring = true;
    try {
      if (st.view !== window.currentActiveView) window.switchSkylightView(st.view);
      if (st.view === "meals" && window.RecipeBrowse && window.RecipeBrowse.tab() !== (st.tab || "week")) window.RecipeBrowse.setTab(st.tab || "week");
    } finally { restoring = false; }
  });

  // ---- What counts as "open" ----------------------------------------------------------
  // Pop-ups and side panels (<dialog>), however they're closed. Back presses
  // their own close button, so they tidy up as they normally would.
  const NOT_FOR_BACK = new Set(["board-join-screen"]);
  function closeDialog(d) {
    const btn = d.querySelector("[data-sheet-no], [data-mqp-close], [data-fr-close], [data-rp-close], #btn-popover-close, .btn-cooking-close, .btn-modal-close");
    if (btn) btn.click();
    if (d.open) d.close();
  }
  let dialogN = 0;
  function watchDialogs() {
    new MutationObserver((muts) => {
      muts.forEach(m => {
        const d = m.target;
        if (!(d instanceof HTMLDialogElement)) return;
        if (!d.id) d.id = `hm-dialog-${++dialogN}`;
        if (NOT_FOR_BACK.has(d.id)) return;
        if (d.open) openLayer(`dialog:${d.id}`, () => closeDialog(d));
        else closedLayer(`dialog:${d.id}`);
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  }
  // Things that aren't dialogs: watched by a check of their own
  const WATCHED = [
    { id: "plan-drawer", isOpen: () => { const d = document.getElementById("plan-meal-drawer"); return !!(d && d.style.display && d.style.display !== "none"); },
      close: () => { const b = document.getElementById("btn-close-plan-drawer"); if (b) b.click(); else if (window.closePlanMealDrawer) window.closePlanMealDrawer(); } },
    { id: "phone-list", isOpen: () => { const b = document.getElementById("lists-board"); return !!(b && b.classList.contains("is-phone-detail") && window.matchMedia("(max-width: 600px)").matches); },
      close: () => { const b = document.querySelector("#lists-board [data-lists-back]"); if (b) b.click(); } },
    { id: "recipe-collection", isOpen: () => !!document.querySelector("#meals-recipes-view:not([hidden]) [data-rb-home]"),
      close: () => { const b = document.querySelector("#meals-recipes-view [data-rb-home]"); if (b) b.click(); } }
  ];
  const wasOpen = {};
  function checkWatched() {
    WATCHED.forEach(w => {
      const open = w.isOpen();
      if (open && !wasOpen[w.id]) openLayer(w.id, w.close);
      if (!open && wasOpen[w.id]) closedLayer(w.id);
      wasOpen[w.id] = open;
    });
  }
  function watchOthers() {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; checkWatched(); });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"], childList: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { watchDialogs(); watchOthers(); });
  else { watchDialogs(); watchOthers(); }

  window.NavHistory = {
    viewShown: record,
    tabShown: record,
    // At start-up: the page (and Meals tab) the address asks for, if any
    fromAddress: () => parse(location.hash),
    _layers: () => layers.map(l => l.id)
  };
})();
