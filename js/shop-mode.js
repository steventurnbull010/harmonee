// ============================================================================
// SHOP MODE (js/shop-mode.js)
// A full-screen, one-handed version of a list for using in the shop:
// - Groceries are grouped by aisle (js/aisles.js), in shop order
// - Ticking is calm: the item greys out where it is, then after a moment
//   slides into "In the trolley" at the bottom (tap it there to put it back)
// - No delete buttons, so nothing gets removed by accident
// - The screen stays awake (where the browser allows it)
// - Things the family adds at home while you're out pop in marked "New"
// - "Finished shopping" clears the trolley from the list (tap twice)
// Ticks go through mutateFamilyLists, so they sync like any other change and
// work offline in the shop.
//
//   openShopMode(listId)     the 🛒 Shop button on each list opens it
// ============================================================================
(function () {
  const SETTLE_MS = 1300;      // how long a ticked item stays put before moving
  let shop = null;             // { listId, seen, settling, armed, pushed }
  let wakeLock = null;

  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const textOf = (item) => (window.Grocery ? window.Grocery.displayText(item) : item.text) || "";
  const forOf = (item) => (window.Grocery ? window.Grocery.sourcesLabel(item) : "");
  const getList = () => (typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : (window.familyLists || [])).find(l => l.id === (shop && shop.listId));
  const isGroceries = (list) => !!(window.Aisles && window.Aisles.isGroceryList(list));

  // ---- Keep the screen on while shopping --------------------------------------
  async function holdScreenOn() {
    try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
  }
  function letScreenSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
  document.addEventListener("visibilitychange", () => { if (shop && document.visibilityState === "visible") holdScreenOn(); });

  // ---- Drawing -------------------------------------------------------------------
  function rowHtml(item, state) {
    const isNew = shop.seen && !shop.seen.has(item.id);
    const forLine = forOf(item);
    return `<li>
      <button type="button" class="shop-row${state === "settling" ? " is-settling" : ""}${state === "trolley" ? " is-in-trolley" : ""}${isNew && state === "open" ? " is-new" : ""}" data-shop-item="${esc(item.id)}" aria-pressed="${item.checked ? "true" : "false"}">
        <span class="shop-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
        <span class="shop-row-text">
          <span class="shop-row-name">${esc(textOf(item))}${isNew && state === "open" ? `<span class="shop-new">New</span>` : ""}</span>
          ${forLine ? `<span class="shop-row-for">${esc(forLine)}</span>` : ""}
        </span>
      </button>
    </li>`;
  }

  function render() {
    const el = document.getElementById("shop-mode");
    const list = getList();
    if (!el || !list) { closeShopMode(); return; }
    const items = Array.isArray(list.items) ? list.items : [];
    const now = Date.now();
    // Still "on the shelf": not ticked, or ticked a moment ago and settling
    const settlingIds = new Set([...shop.settling.keys()].filter(id => shop.settling.get(id) > now));
    const onShelf = items.filter(i => !i.checked || settlingIds.has(i.id));
    const trolley = items.filter(i => i.checked && !settlingIds.has(i.id));
    const ticked = items.filter(i => i.checked).length;
    const pct = items.length ? Math.round((ticked / items.length) * 100) : 0;

    let shelfHtml = "";
    if (isGroceries(list) && window.Aisles) {
      const groups = new Map(window.Aisles.AISLES.map(a => [a.key, []]));
      onShelf.forEach(i => groups.get(window.Aisles.aisleFor(textOf(i))).push(i));
      shelfHtml = window.Aisles.AISLES.filter(a => groups.get(a.key).length).map(a => {
        const its = groups.get(a.key);
        const left = its.filter(i => !i.checked).length;
        return `<section class="shop-aisle" aria-label="${esc(a.label)}">
          <h3 class="shop-aisle-title"><span aria-hidden="true">${a.icon}</span> ${esc(a.label)}${left ? `<span class="shop-aisle-count">${left}</span>` : ""}</h3>
          <ul class="shop-rows">${its.map(i => rowHtml(i, i.checked ? "settling" : "open")).join("")}</ul>
        </section>`;
      }).join("");
    } else if (onShelf.length) {
      shelfHtml = `<section class="shop-aisle"><ul class="shop-rows">${onShelf.map(i => rowHtml(i, i.checked ? "settling" : "open")).join("")}</ul></section>`;
    }

    const allDone = items.length > 0 && onShelf.length === 0;
    const body = `
      ${items.length === 0 ? `<div class="shop-empty"><span aria-hidden="true">📝</span><p>Nothing on ${esc(list.title)} yet.</p></div>` : ""}
      ${allDone ? `<div class="shop-empty is-done"><span aria-hidden="true">🎉</span><p>Everything's in the trolley!</p></div>` : ""}
      ${shelfHtml}
      ${trolley.length ? `<section class="shop-aisle shop-trolley" aria-label="In the trolley">
        <h3 class="shop-aisle-title"><span aria-hidden="true">🛒</span> In the trolley<span class="shop-aisle-count">${trolley.length}</span></h3>
        <p class="shop-trolley-hint">Tap one to put it back on the list</p>
        <ul class="shop-rows">${trolley.map(i => rowHtml(i, "trolley")).join("")}</ul>
      </section>` : ""}`;

    const scroller = el.querySelector(".shop-body");
    const scroll = scroller ? scroller.scrollTop : 0;
    el.innerHTML = `
      <header class="shop-head">
        <button type="button" class="shop-close" data-shop-close aria-label="Close shop mode">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <div class="shop-titles">
          <h2 class="shop-title" id="shop-mode-title">${esc(list.emoji || "🛒")} ${esc(list.title || "Shopping")}</h2>
          <p class="shop-progress-text">${items.length ? `${ticked} of ${items.length} in the trolley` : "Empty"}</p>
        </div>
      </header>
      <div class="shop-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <div class="shop-body">${body}</div>
      ${ticked ? `<footer class="shop-foot">
        <button type="button" class="shop-finish${shop.armed ? " is-armed" : ""}" data-shop-finish>
          ${shop.armed ? `Tap again to clear ${ticked} from the list` : `Finished shopping · clear ${ticked} from the list`}
        </button>
      </footer>` : ""}`;
    const newScroller = el.querySelector(".shop-body");
    if (newScroller) newScroller.scrollTop = scroll;
  }

  // ---- Actions ---------------------------------------------------------------
  function tick(itemId) {
    const list = getList();
    const item = list && (list.items || []).find(i => i.id === itemId);
    if (!item) return;
    const checked = !item.checked;
    window.mutateFamilyLists({ type: "toggleItem", listId: list.id, itemId, checked });
    if (typeof sfx !== "undefined" && sfx) {
      if (checked && sfx.playClick) sfx.playClick();
      else if (!checked && sfx.playClick) sfx.playClick();
    }
    if (navigator.vibrate) { try { navigator.vibrate(checked ? 12 : 6); } catch (e) {} }
    shop.seen.add(itemId);
    shop.armed = false;
    if (checked) {
      // Stays where it is for a moment (so nothing shifts under your thumb),
      // then moves to the trolley
      shop.settling.set(itemId, Date.now() + SETTLE_MS);
      setTimeout(() => { if (shop) { shop.settling.delete(itemId); render(); } }, SETTLE_MS + 30);
    } else {
      shop.settling.delete(itemId);
    }
    render();
  }

  function finish() {
    const list = getList();
    if (!list) return;
    if (!shop.armed) {
      shop.armed = true;
      clearTimeout(shop.armTimer);
      shop.armTimer = setTimeout(() => { if (shop) { shop.armed = false; render(); } }, 4000);
      render();
      return;
    }
    shop.armed = false;
    const ticked = (list.items || []).filter(i => i.checked).map(i => i.id);
    if (ticked.length) window.mutateFamilyLists({ type: "deleteItems", listId: list.id, itemIds: ticked });
    const left = (getList().items || []).filter(i => !i.checked).length;
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(left ? `Cleared ${ticked.length} from ${list.title}` : "Shopping done! 🎉");
    if (left) render(); else closeShopMode();
  }

  // ---- Open / close ------------------------------------------------------------
  function openShopMode(listId) {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    shop = { listId, seen: new Set((list.items || []).map(i => i.id)), settling: new Map(), armed: false, pushed: false };
    let el = document.getElementById("shop-mode");
    if (!el) {
      el = document.createElement("div");
      el.id = "shop-mode";
      el.className = "shop-mode";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "shop-mode-title");
      document.body.appendChild(el);
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-shop-close]")) { closeShopMode(); return; }
        if (e.target.closest("[data-shop-finish]")) { finish(); return; }
        const row = e.target.closest("[data-shop-item]");
        if (row) tick(row.getAttribute("data-shop-item"));
      });
    }
    el.hidden = false;
    document.body.classList.add("shop-mode-open");
    render();
    holdScreenOn();
    // The phone's Back button / gesture closes Shop mode instead of leaving
    try { history.pushState({ harmoneeShop: true }, ""); shop.pushed = true; } catch (e) {}
  }
  window.openShopMode = openShopMode;

  function closeShopMode(fromBack = false) {
    const el = document.getElementById("shop-mode");
    if (el) { el.hidden = true; el.innerHTML = ""; }
    document.body.classList.remove("shop-mode-open");
    letScreenSleep();
    const pushed = shop && shop.pushed;
    shop = null;
    if (pushed && !fromBack) { try { history.back(); } catch (e) {} }
    if (typeof window.renderListsView === "function") window.renderListsView();
  }
  window.closeShopMode = closeShopMode;
  window.addEventListener("popstate", () => { if (shop) closeShopMode(true); });

  // Lists changed on another device (or from the Meals page): redraw
  window.refreshShopMode = () => { if (shop) render(); };

  // The 🛒 Shop button on each list (Lists page)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-shop-list]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openShopMode(btn.getAttribute("data-shop-list"));
  }, true);
})();
