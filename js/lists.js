// ============================================================================
// FAMILY LISTS (js/lists.js)
// Skylight-style lists: every list shown side by side as a coloured column,
// each with its own quick-add box. "Groceries" is the one grocery list for
// the whole app; the Meals page reads and writes the same list.
//
// Lists live on the board doc (familyLists) and sync to every device. This
// file owns the only in-memory copy; app.js hands it board updates through
// applyBoardFamilyLists(). Every change goes through mutateFamilyLists()
// so two devices editing at once never lose each other's changes.
// ============================================================================

let familyLists = null;
window.familyLists = familyLists;

const GROCERIES_LIST_ID = "groceries";

// Pastel list colours: accent for the header and ticks, light for the column
const LIST_COLORS = {
  sky:     { accent: "#0284c7", light: "#e0f2fe", label: "Sky" },
  rose:    { accent: "#e11d48", light: "#ffe4e6", label: "Rose" },
  amber:   { accent: "#d97706", light: "#fef3c7", label: "Amber" },
  emerald: { accent: "#059669", light: "#d1fae5", label: "Green" },
  violet:  { accent: "#7c3aed", light: "#ede9fe", label: "Violet" },
  teal:    { accent: "#0d9488", light: "#ccfbf1", label: "Teal" },
  orange:  { accent: "#ea580c", light: "#ffedd5", label: "Orange" },
  slate:   { accent: "#475569", light: "#e2e8f0", label: "Slate" },
};
const LIST_COLOR_ORDER = Object.keys(LIST_COLORS);

function getListColor(list, index) {
  const key = (list && LIST_COLORS[list.color]) ? list.color : LIST_COLOR_ORDER[(index || 0) % LIST_COLOR_ORDER.length];
  return { key, ...LIST_COLORS[key] };
}

// Starter lists for a board that has none yet. Kept in memory only: nothing
// is saved until someone actually changes a list, so a device that hasn't
// received the board yet can never overwrite the family's real lists.
function makeStarterLists() {
  return [
    { id: GROCERIES_LIST_ID, title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [] },
    { id: "todo", title: "To-Do", emoji: "📋", color: "amber", items: [] },
  ];
}

function loadFamilyLists() {
  if (Array.isArray(familyLists) && familyLists.length > 0) return familyLists;
  try {
    const raw = localStorage.getItem(boardCacheKey("turnbull_family_lists"));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFamilyListsInMemory(parsed);
        return familyLists;
      }
    }
  } catch (e) {}
  setFamilyListsInMemory(makeStarterLists());
  return familyLists;
}

// The Groceries list object (created if a board somehow lacks one)
function getGroceriesList() {
  const lists = loadFamilyLists();
  let groc = lists.find(l => l.id === GROCERIES_LIST_ID);
  if (!groc) {
    groc = { id: GROCERIES_LIST_ID, title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [] };
    lists.unshift(groc);
  }
  if (!Array.isArray(groc.items)) groc.items = [];
  return groc;
}
window.getGroceriesList = getGroceriesList;

// ---------------------------------------------------------------------------
// Safe syncing between devices
//
// Every change is a small "op" (add these items, tick this item, delete
// these items...). The op is applied here straight away so the screen
// updates instantly, then queued and sent in a Firestore transaction that
// reads the board's CURRENT lists and re-applies the same op on top of them.
// Two devices changing lists at the same moment both keep their change:
// the transaction retries on whichever one loses the race.
//
// boards/{id}.familyLists stays the same array of lists (with items[]) that
// older app versions read and write. Deleted items and lists are also
// remembered in boards/{id}.familyListsDeleted ({ itemId or "list:<id>":
// time }) so an old tablet writing back a stale copy can't bring them back.
// The queue is kept on the device, so changes made offline survive a reload
// and go up when the connection returns.
// ---------------------------------------------------------------------------
const LISTS_TOMBSTONE_DAYS = 30;
const LISTS_PENDING_LIMIT = 500;
let listsServerBase = null;      // lists as last seen on the board
let listsServerTomb = {};        // familyListsDeleted as last seen
let listsViewTomb = {};          // server tombstones + ones from queued ops
let listsLastKnownJson = "[]";   // what this device last showed (for the saveFamilyLists diff)
let listsPending = null;         // queued ops not yet confirmed by the board
let listsFlushing = false;
let listsFlushAgain = false;
let listsBoardSeen = false;
let listsRetryTimer = null;

function cloneLists(lists) {
  return JSON.parse(JSON.stringify(Array.isArray(lists) ? lists : []));
}

function setFamilyListsInMemory(lists) {
  familyLists = lists;
  window.familyLists = lists;
  try { listsLastKnownJson = JSON.stringify(lists || []); } catch (e) { listsLastKnownJson = "[]"; }
  try { localStorage.setItem(boardCacheKey("turnbull_family_lists"), listsLastKnownJson); } catch (e) {}
}

function pendingKey() { return boardCacheKey("harmonee_lists_pending"); }

function loadPendingOps() {
  if (listsPending) return listsPending;
  listsPending = [];
  try {
    const raw = localStorage.getItem(pendingKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) listsPending = parsed.filter(op => op && op.type && op.opId);
  } catch (e) {}
  return listsPending;
}

function savePendingOps() {
  try {
    if (listsPending && listsPending.length) localStorage.setItem(pendingKey(), JSON.stringify(listsPending));
    else localStorage.removeItem(pendingKey());
  } catch (e) {}
}

function pruneTombstones(tomb, now) {
  const cutoff = (now || Date.now()) - LISTS_TOMBSTONE_DAYS * 24 * 60 * 60 * 1000;
  const out = {};
  Object.keys(tomb || {}).forEach(k => {
    const t = Number(tomb[k]);
    if (t && t >= cutoff) out[k] = t;
  });
  return out;
}

// Drops deleted lists and items. Returns how many were removed.
function dropTombstoned(lists, tomb) {
  let removed = 0;
  for (let i = lists.length - 1; i >= 0; i--) {
    const l = lists[i];
    if (!l || typeof l !== "object" || tomb["list:" + l.id]) { lists.splice(i, 1); removed++; continue; }
    if (!Array.isArray(l.items)) { l.items = []; continue; }
    const before = l.items.length;
    l.items = l.items.filter(it => it && !tomb[it.id]);
    removed += before - l.items.length;
  }
  return removed;
}

function makeGroceriesList() {
  return { id: GROCERIES_LIST_ID, title: "Groceries", emoji: "🛒", color: "sky", isDefault: true, items: [] };
}

function findListForOp(lists, tomb, listId) {
  let list = lists.find(l => l.id === listId);
  // Groceries is shared with Meals: an op on it creates it if a board lacks it
  if (!list && listId === GROCERIES_LIST_ID && !tomb["list:" + GROCERIES_LIST_ID]) {
    list = makeGroceriesList();
    lists.unshift(list);
  }
  if (list && !Array.isArray(list.items)) list.items = [];
  return list || null;
}

// Applies one op to a lists array in place. Ops are safe to apply twice
// (adds skip ids already there; grocery adds skip a meal already added).
function applyListOp(lists, tomb, op, now) {
  now = now || Date.now();
  switch (op.type) {
    case "addItems": {
      const list = findListForOp(lists, tomb, op.listId);
      if (!list) return null;
      const fresh = (op.items || []).filter(it => it && it.id && !tomb[it.id] && !list.items.some(x => x.id === it.id));
      const copies = cloneLists(fresh);
      if (op.atEnd) list.items.push(...copies);
      else list.items.unshift(...copies);
      return { added: copies.length };
    }
    case "toggleItem": {
      const list = findListForOp(lists, tomb, op.listId);
      const item = list && list.items.find(i => i.id === op.itemId);
      if (item) item.checked = !!op.checked;
      return null;
    }
    case "updateItem": {
      const list = findListForOp(lists, tomb, op.listId);
      if (!list || !op.item) return null;
      const idx = list.items.findIndex(i => i.id === op.item.id);
      if (idx >= 0) list.items[idx] = cloneLists([op.item])[0];
      return null;
    }
    case "deleteItems": {
      const ids = new Set(op.itemIds || []);
      ids.forEach(id => { tomb[id] = now; });
      lists.forEach(l => { if (Array.isArray(l.items)) l.items = l.items.filter(i => !ids.has(i.id)); });
      return null;
    }
    case "upsertList": {
      const meta = op.list || {};
      if (!meta.id || tomb["list:" + meta.id]) return null;
      const target = lists.find(l => l.id === meta.id);
      const fields = {};
      ["title", "emoji", "color", "isDefault"].forEach(k => { if (meta[k] !== undefined) fields[k] = meta[k]; });
      if (target) Object.assign(target, fields);
      else lists.push({ id: meta.id, ...fields, items: [] });
      return null;
    }
    case "deleteList": {
      if (!op.listId || op.listId === GROCERIES_LIST_ID) return null;
      tomb["list:" + op.listId] = now;
      for (let i = lists.length - 1; i >= 0; i--) if (lists[i].id === op.listId) lists.splice(i, 1);
      return null;
    }
    case "groceryAddLines": {
      const list = findListForOp(lists, tomb, GROCERIES_LIST_ID);
      if (!list || !window.Grocery) return { added: 0, combined: 0, skipped: [], already: 0 };
      // Same ids every time this op runs, so a re-run inside a retried
      // transaction or on top of a new snapshot names the items the same
      const res = window.Grocery.addLinesToItems(list.items, op.lines || [], {
        title: op.title || "", sourceKey: op.sourceKey || "", includeBasics: !!op.includeBasics,
        idFor: (n) => `${op.idBase}-${n}`
      });
      list.items = list.items.filter(i => !tomb[i.id]);
      return res;
    }
    default:
      return null; // "noop": just rewrite the cleaned lists
  }
}

// Rebuilds what this device shows: the board's lists plus anything still queued
function recomputeFamilyListsView() {
  const base = cloneLists(listsServerBase || familyLists || makeStarterLists());
  listsViewTomb = { ...listsServerTomb };
  dropTombstoned(base, listsViewTomb);
  loadPendingOps().forEach(op => applyListOp(base, listsViewTomb, op, op.at));
  setFamilyListsInMemory(base);
}

// The one way lists change. Applies the op on screen now, queues it, and
// sends it to the board. Returns what the op returned locally (grocery adds
// return { added, combined, skipped, already } for the toast).
function mutateFamilyLists(op) {
  if (!op || !op.type) return null;
  const lists = loadFamilyLists();
  op = { ...op, opId: op.opId || ("op-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)), at: op.at || Date.now() };
  if (op.type === "groceryAddLines" && !op.idBase) op.idBase = "g-" + op.at + "-" + Math.random().toString(36).slice(2, 7);
  const result = applyListOp(lists, listsViewTomb, op, op.at);
  setFamilyListsInMemory(lists);
  const queue = loadPendingOps();
  queue.push(op);
  if (queue.length > LISTS_PENDING_LIMIT) {
    console.warn("Lists: too many unsent changes, dropping the oldest");
    queue.splice(0, queue.length - LISTS_PENDING_LIMIT);
  }
  savePendingOps();
  if (typeof window.updateGroceryBadgeCount === "function") window.updateGroceryBadgeCount();
  scheduleListsFlush(0);
  return result;
}
window.mutateFamilyLists = mutateFamilyLists;

function scheduleListsFlush(delay) {
  clearTimeout(listsRetryTimer);
  listsRetryTimer = setTimeout(flushListOps, delay || 0);
}

// Errors worth waiting out (offline, not joined yet, contention)
const LISTS_TRANSIENT_ERRORS = ["unavailable", "deadline-exceeded", "aborted", "failed-precondition", "permission-denied", "unauthenticated", "resource-exhausted", "cancelled", "internal", "unknown"];

// "No access" errors: one can happen while the device is still signing in,
// but several in a row means this device has lost access to the board (for
// example it was removed in Settings). Then we stop retrying every 30 seconds,
// keep the unsent changes on this device, and say so on the Lists page.
const LISTS_ACCESS_ERRORS = ["permission-denied", "unauthenticated"];
const LISTS_ACCESS_GIVE_UP = 3;
let listsAccessFailures = 0;
let listsAccessLost = false;

function showListsAccessLost(on) {
  listsAccessLost = on;
  const view = document.getElementById("view-lists");
  let banner = document.getElementById("lists-access-banner");
  if (!on) { if (banner) banner.remove(); return; }
  if (!view || banner) return;
  const n = loadPendingOps().length;
  banner = document.createElement("div");
  banner.id = "lists-access-banner";
  banner.className = "lists-access-banner";
  banner.setAttribute("role", "alert");
  banner.innerHTML = `
    <span class="lists-access-icon" aria-hidden="true">🔐</span>
    <span class="lists-access-text"><strong>This device can't save to the board any more.</strong>
      ${n ? `Your last ${n === 1 ? "change is" : `${n} changes are`} kept here and will save once it's back in.` : ""}
      Enter the family code again to reconnect.</span>
    <button type="button" class="lists-access-btn">Enter family code</button>`;
  // Reloading runs the normal check, which asks for the family code
  banner.querySelector("button").onclick = () => window.location.reload();
  view.insertBefore(banner, view.firstChild);
}

async function flushListOps() {
  const queue = loadPendingOps();
  if (!queue.length) return;
  if (listsAccessLost) return; // waiting for the family code (see showListsAccessLost)
  if (!window.db || typeof window.runTransaction !== "function" || !listsBoardSeen) return;
  if (listsFlushing) { listsFlushAgain = true; return; }
  listsFlushing = true;
  const batch = queue.slice();
  const ref = window.doc(window.db, "boards", (window.currentBoardId || "turnbull"));
  try {
    await window.runTransaction(window.db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const now = Date.now();
      const tomb = pruneTombstones(data.familyListsDeleted, now);
      const lists = Array.isArray(data.familyLists) ? cloneLists(data.familyLists) : cloneLists(listsServerBase || makeStarterLists());
      dropTombstoned(lists, tomb);
      batch.forEach(op => applyListOp(lists, tomb, op, op.at));
      // mergeFields replaces these three fields whole (so pruned tombstones
      // really go) and leaves everything else on the board alone
      tx.set(ref, {
        familyLists: lists,
        familyListsDeleted: tomb,
        updatedAt: window.serverTimestamp()
      }, { mergeFields: ["familyLists", "familyListsDeleted", "updatedAt"] });
    });
    const sent = new Set(batch.map(op => op.opId));
    listsPending = loadPendingOps().filter(op => !sent.has(op.opId));
    savePendingOps();
    listsAccessFailures = 0;
  } catch (err) {
    const code = (err && err.code) || "";
    if (LISTS_ACCESS_ERRORS.includes(code)) listsAccessFailures++; else listsAccessFailures = 0;
    if (listsAccessFailures >= LISTS_ACCESS_GIVE_UP) {
      console.warn("Lists: this device has lost access to the board; keeping changes and waiting for the family code");
      showListsAccessLost(true);
    } else if (LISTS_TRANSIENT_ERRORS.includes(code) || !code) {
      scheduleListsFlush(30000);
    } else {
      // Something the board will never accept: give up on these changes
      batch.forEach(op => { op.failures = (op.failures || 0) + 1; });
      const dead = new Set(batch.filter(op => op.failures >= 5).map(op => op.opId));
      if (dead.size) console.warn("Lists: couldn't save some changes, giving up:", err);
      listsPending = loadPendingOps().filter(op => !dead.has(op.opId));
      savePendingOps();
      if (listsPending.length) scheduleListsFlush(30000);
    }
    if (!listsAccessLost) console.warn("Lists: couldn't sync yet, will retry:", code || err);
  } finally {
    listsFlushing = false;
    if (listsFlushAgain) {
      listsFlushAgain = false;
      scheduleListsFlush(0);
    }
  }
}
window.flushListOps = flushListOps;

window.addEventListener("online", () => scheduleListsFlush(0));
setInterval(() => { if (loadPendingOps().length && !listsFlushing) flushListOps(); }, 30000);

// Kept for older callers that change the lists array and save it whole.
// Works out what changed against what this device last showed and sends
// just those changes, so it can't wipe out changes from other devices.
function saveFamilyLists(lists) {
  if (!Array.isArray(lists)) return;
  let before = [];
  try { before = JSON.parse(listsLastKnownJson) || []; } catch (e) {}
  const ops = [];
  const metaOf = (l) => ({ id: l.id, title: l.title, emoji: l.emoji, color: l.color, isDefault: l.isDefault });
  const beforeById = new Map(before.map(l => [l.id, l]));
  const afterIds = new Set(lists.map(l => l && l.id));
  before.forEach(l => { if (!afterIds.has(l.id)) ops.push({ type: "deleteList", listId: l.id }); });
  lists.forEach(l => {
    if (!l || !l.id) return;
    const items = Array.isArray(l.items) ? l.items : [];
    const old = beforeById.get(l.id);
    if (!old) {
      ops.push({ type: "upsertList", list: metaOf(l) });
      if (items.length) ops.push({ type: "addItems", listId: l.id, items: cloneLists(items), atEnd: true });
      return;
    }
    if (JSON.stringify(metaOf(l)) !== JSON.stringify(metaOf(old))) ops.push({ type: "upsertList", list: metaOf(l) });
    const oldItems = Array.isArray(old.items) ? old.items : [];
    const oldById = new Map(oldItems.map(i => [i.id, i]));
    const newIds = new Set(items.map(i => i && i.id));
    const removed = oldItems.filter(i => !newIds.has(i.id)).map(i => i.id);
    if (removed.length) ops.push({ type: "deleteItems", listId: l.id, itemIds: removed });
    // New items above the first existing one go to the top, the rest to the end
    const firstOld = items.findIndex(i => i && oldById.has(i.id));
    const top = [], end = [];
    items.forEach((i, idx) => {
      if (!i || !i.id) return;
      const prev = oldById.get(i.id);
      if (!prev) ((firstOld === -1 || idx < firstOld) ? top : end).push(i);
      else if (JSON.stringify(prev) !== JSON.stringify(i)) ops.push({ type: "updateItem", listId: l.id, item: cloneLists([i])[0] });
    });
    if (end.length) ops.push({ type: "addItems", listId: l.id, items: cloneLists(end), atEnd: true });
    if (top.length) ops.push({ type: "addItems", listId: l.id, items: cloneLists(top) });
  });
  // Start from what was showing, then apply the changes as ops
  setFamilyListsInMemory(before);
  ops.forEach(op => mutateFamilyLists(op));
  if (!ops.length) setFamilyListsInMemory(lists);
}

// Called by the board listener in app.js whenever the board doc changes
function applyBoardFamilyLists(lists, deleted) {
  listsBoardSeen = true;
  if (Array.isArray(lists)) {
    listsServerTomb = pruneTombstones(deleted);
    const base = cloneLists(lists);
    // An older app version may have written back items someone deleted:
    // hide them, and write the cleaned lists back once
    const resurrected = dropTombstoned(base, listsServerTomb);
    listsServerBase = base;
    recomputeFamilyListsView();
    if (resurrected && !loadPendingOps().some(op => op.type === "noop")) mutateFamilyLists({ type: "noop" });
    if (typeof window.updateGroceryBadgeCount === "function") window.updateGroceryBadgeCount();
    const view = document.getElementById("view-lists");
    if (view && view.style.display !== "none") renderListsView();
    if (typeof window.refreshShopMode === "function") window.refreshShopMode(); // js/shop-mode.js
  }
  if (loadPendingOps().length) scheduleListsFlush(0);
}
window.applyBoardFamilyLists = applyBoardFamilyLists;

// ---------------------------------------------------------------------------
// Rendering: all lists side by side
// ---------------------------------------------------------------------------
function renderListsView() {
  const board = document.getElementById("lists-board");
  if (!board) return;
  const lists = loadFamilyLists();

  // Keep whatever someone was typing, and where, across the re-render
  const active = document.activeElement;
  const typingListId = active && active.matches && active.matches(".list-column-add input") ? active.closest("[data-list-id]").getAttribute("data-list-id") : null;
  const drafts = {};
  board.querySelectorAll(".list-column-add input").forEach(inp => {
    if (inp.value) drafts[inp.closest("[data-list-id]").getAttribute("data-list-id")] = inp.value;
  });

  updateListsHeader();

  // Which item was just ticked, so only that box plays the little pop
  const justTicked = listsJustTicked;
  listsJustTicked = null;

  if (lists.length === 0) {
    board.innerHTML = `
      <div class="lists-page-empty">
        <span class="lists-page-empty-icon" aria-hidden="true">📝</span>
        <p class="lists-page-empty-title">No lists yet</p>
        <p class="lists-page-empty-text">Make one for the food shop, packing or jobs for the weekend.</p>
        <button type="button" class="btn-skylight-primary-pill" data-new-list>
          <span class="pill-icon">＋</span>
          <span class="pill-text">New List</span>
        </button>
      </div>`;
  } else board.innerHTML = lists.map((list, index) => {
    const col = getListColor(list, index);
    const items = Array.isArray(list.items) ? list.items : [];
    const open = items.filter(i => !i.checked);
    const done = items.filter(i => i.checked);
    const countText = items.length === 0 ? "Empty" : `${open.length} to do${done.length ? ` · ${done.length} done` : ""}`;
    const itemHtml = (item) => {
      const text = window.Grocery ? window.Grocery.displayText(item) : item.text;
      const forLine = window.Grocery ? window.Grocery.sourcesLabel(item) : "";
      const pop = justTicked === item.id ? " is-just-ticked" : "";
      return `
      <li class="list-row ${item.checked ? "is-checked" : ""}${pop}" data-item-id="${escapeHtml(item.id)}">
        <button type="button" class="list-row-check" data-toggle-item aria-pressed="${item.checked ? "true" : "false"}" aria-label="${item.checked ? "Untick" : "Tick"} ${escapeHtml(text)}">
          <span class="list-row-box" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
          <span class="list-row-text">
            <span class="list-row-name">${escapeHtml(text)}</span>
            ${forLine ? `<span class="list-row-for">${escapeHtml(forLine)}</span>` : ""}
          </span>
        </button>
        <button type="button" class="list-row-del" data-delete-item aria-label="Remove ${escapeHtml(text)}">✕</button>
      </li>`;
    };
    return `
      <section class="list-column" data-list-id="${escapeHtml(list.id)}" style="--list-accent: ${col.accent}; --list-light: ${col.light};">
        <header class="list-column-head">
          <span class="list-column-emoji" aria-hidden="true">${escapeHtml(list.emoji || "📋")}</span>
          <div class="list-column-titles">
            <h3 class="list-column-title">${escapeHtml(list.title)}</h3>
            <span class="list-column-count">${countText}</span>
          </div>
          ${open.length ? `<button type="button" class="list-column-shop" data-shop-list="${escapeHtml(list.id)}" aria-label="Shop mode for ${escapeHtml(list.title)}" title="Shop mode: big, one-handed, sorted by aisle">🛒 Shop</button>` : ""}
          <button type="button" class="list-column-edit" data-edit-list aria-label="Edit ${escapeHtml(list.title)}" title="Rename, icon, colour">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
        </header>
        <form class="list-column-add" data-add-item>
          <input type="text" placeholder="Add to ${escapeHtml(list.title)}" aria-label="Add to ${escapeHtml(list.title)}" autocomplete="off" enterkeyhint="done">
          <button type="button" data-open-add-panel aria-label="Add several items to ${escapeHtml(list.title)}" title="Add several at once">+</button>
        </form>
        <ul class="list-column-items">
          ${open.map(itemHtml).join("")}
          ${done.map(itemHtml).join("")}
          ${items.length === 0 ? `<li class="list-column-empty">Nothing on this list yet. Add something above.</li>` : ""}
        </ul>
        ${done.length ? `<button type="button" class="list-column-clear" data-clear-done>Clear ${done.length} done</button>` : ""}
      </section>`;
  }).join("");

  Object.entries(drafts).forEach(([id, val]) => {
    const inp = board.querySelector(`[data-list-id="${CSS.escape(id)}"] .list-column-add input`);
    if (inp) inp.value = val;
  });
  if (typingListId) {
    const inp = board.querySelector(`[data-list-id="${CSS.escape(typingListId)}"] .list-column-add input`);
    if (inp) inp.focus();
  }

  if (!board.hasAttribute("data-wired")) {
    board.setAttribute("data-wired", "true");
    board.addEventListener("click", onListsBoardClick);
    board.addEventListener("submit", onListsBoardSubmit);
  }

  const btnNewList = document.getElementById("btn-create-new-list");
  if (btnNewList && !btnNewList.hasAttribute("data-wired")) {
    btnNewList.setAttribute("data-wired", "true");
    btnNewList.onclick = () => openCreateListModal();
  }
}
window.renderListsView = renderListsView;

// Same header as Tasks and Meals: family name and the time (the weather
// badge is filled in by js/weather.js)
function updateListsHeader() {
  const famEl = document.getElementById("lists-family-name");
  if (famEl) famEl.textContent = window.isDefaultTurnbullBoard ? "Turnbull Family" : ((window.boardSettings || {}).familyName || "Our Family");
  const clockEl = document.getElementById("lists-live-clock");
  if (clockEl) clockEl.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
setInterval(() => {
  const view = document.getElementById("view-lists");
  if (view && view.style.display !== "none") updateListsHeader();
}, 30000);

let listsJustTicked = null;

function onListsBoardSubmit(e) {
  const form = e.target.closest("[data-add-item]");
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;
  const listId = form.closest("[data-list-id]").getAttribute("data-list-id");
  input.value = "";
  handleAddItemToList(listId, text);
  const again = document.querySelector(`#lists-board [data-list-id="${CSS.escape(listId)}"] .list-column-add input`);
  if (again) again.focus();
}

function onListsBoardClick(e) {
  if (e.target.closest("[data-new-list]")) { openCreateListModal(); return; }
  const column = e.target.closest("[data-list-id]");
  if (!column) return;
  const listId = column.getAttribute("data-list-id");
  const row = e.target.closest("[data-item-id]");

  if (e.target.closest("[data-toggle-item]") && row) {
    const list = loadFamilyLists().find(l => l.id === listId);
    const item = list && (list.items || []).find(i => i.id === row.getAttribute("data-item-id"));
    if (item) {
      if (!item.checked) listsJustTicked = item.id;
      handleToggleListItem(listId, item.id, !item.checked);
    }
    return;
  }
  if (e.target.closest("[data-delete-item]") && row) {
    handleDeleteListItem(listId, row.getAttribute("data-item-id"));
    return;
  }
  if (e.target.closest("[data-clear-done]")) {
    handleClearCompletedListItems(listId);
    return;
  }
  if (e.target.closest("[data-edit-list]")) {
    openCreateListModal(listId);
    return;
  }
  if (e.target.closest("[data-open-add-panel]")) {
    const typed = column.querySelector(".list-column-add input");
    const draft = typed ? typed.value.trim() : "";
    if (typed) typed.value = "";
    openAddListItemPanel(listId, draft);
  }
}

// ---------------------------------------------------------------------------
// Add items side panel (#list-item-modal): + on a list opens it. One item
// per line, so a whole shop can go in at once.
// ---------------------------------------------------------------------------
let addPanelListId = GROCERIES_LIST_ID;

function renderAddPanelListPicker() {
  const row = document.getElementById("list-item-list-picker");
  if (!row) return;
  const lists = loadFamilyLists();
  row.innerHTML = lists.map((l, i) => {
    const col = getListColor(l, i);
    const on = l.id === addPanelListId;
    return `<button type="button" class="drawer-profile-pill list-item-picker-pill ${on ? "active is-selected" : ""}" data-pick-list="${escapeHtml(l.id)}" aria-pressed="${on}" style="--profile-color: ${col.accent}; --list-accent: ${col.accent}; --list-light: ${col.light};">
      <span class="drawer-profile-avatar list-item-picker-emoji">${escapeHtml(l.emoji || "📋")}<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span></span>
      <span class="drawer-profile-name">${escapeHtml(l.title)}</span>
    </button>`;
  }).join("");
  const list = lists.find(l => l.id === addPanelListId);
  const heading = document.getElementById("list-item-title");
  if (heading) heading.textContent = list ? `Add to ${list.title}` : "Add Items";
}

function openAddListItemPanel(listId, draft = "") {
  const modal = document.getElementById("list-item-modal");
  if (!modal) return;
  addPanelListId = listId || GROCERIES_LIST_ID;
  const textarea = document.getElementById("list-item-text");
  textarea.value = draft;
  renderAddPanelListPicker();

  if (!modal.hasAttribute("data-wired")) {
    modal.setAttribute("data-wired", "true");
    document.getElementById("btn-close-list-item").addEventListener("click", () => modal.close());
    document.getElementById("list-item-list-picker").addEventListener("click", (e) => {
      const pill = e.target.closest("[data-pick-list]");
      if (!pill) return;
      addPanelListId = pill.getAttribute("data-pick-list");
      renderAddPanelListPicker();
    });
    document.getElementById("list-item-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const lines = document.getElementById("list-item-text").value
        .split("\n").map(s => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
      if (lines.length === 0) { document.getElementById("list-item-text").focus(); return; }
      if (!loadFamilyLists().some(l => l.id === addPanelListId)) return;
      const stamp = Date.now();
      // Keep the order they were typed in, at the top of the list
      mutateFamilyLists({ type: "addItems", listId: addPanelListId, items: lines.map((text, i) => ({
        id: `item-${stamp}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        text,
        checked: false,
        addedAt: new Date().toISOString()
      })) });
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      modal.close();
      renderListsView();
    });
  }

  if (!modal.open) modal.showModal();
  focusAfterPanelOpens(textarea, () => textarea.setSelectionRange(textarea.value.length, textarea.value.length));
}
window.openAddListItemPanel = openAddListItemPanel;

// ---------------------------------------------------------------------------
// Item changes
// ---------------------------------------------------------------------------
function handleAddItemToList(listId, text) {
  if (!loadFamilyLists().some(l => l.id === listId) && listId !== GROCERIES_LIST_ID) return;
  mutateFamilyLists({ type: "addItems", listId, items: [{
    id: "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    text,
    checked: false,
    addedAt: new Date().toISOString()
  }] });
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

function handleToggleListItem(listId, itemId, checked) {
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  const item = list && (list.items || []).find(i => i.id === itemId);
  if (!item) return;
  mutateFamilyLists({ type: "toggleItem", listId, itemId, checked: !!checked });
  if (typeof sfx !== "undefined" && sfx) {
    if (checked && sfx.playCelebrationChime) sfx.playCelebrationChime();
    else if (sfx.playClick) sfx.playClick();
  }
  renderListsView();
}

function handleDeleteListItem(listId, itemId) {
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  mutateFamilyLists({ type: "deleteItems", listId, itemIds: [itemId] });
  if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
  renderListsView();
}

function handleClearCompletedListItems(listId) {
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  // Only what is ticked on this screen now: something ticked on another
  // device a moment ago stays until someone sees it
  const ticked = list.items.filter(i => i.checked).map(i => i.id);
  if (!ticked.length) return;
  mutateFamilyLists({ type: "deleteItems", listId, itemIds: ticked });
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

// ---------------------------------------------------------------------------
// New / edit list side panel (#create-list-modal)
// ---------------------------------------------------------------------------
let listPanelEmoji = "📋";

// Icons for lists, grouped loosely: shopping, home, family, school,
// travel and outdoors, food, celebrations, pets and hobbies.
const LIST_EMOJIS = [
  "📋", "📝", "✅", "⭐", "📌", "💡",
  "🛒", "🛍️", "🥦", "🍎", "🥖", "🧀", "🍼", "🧃", "🍕", "🍰",
  "🏠", "🧹", "🧺", "🛠️", "🔧", "🪴", "🛏️", "🚿", "🗑️", "💡",
  "👪", "👶", "🧸", "🎒", "📚", "✏️", "🏫", "💊", "🩺",
  "🧳", "✈️", "🚗", "⛺", "🏖️", "🏔️", "🗺️", "🎫",
  "🎁", "🎂", "🎄", "🎃", "🐣", "🎉", "💌",
  "🐶", "🐱", "🐟", "⚽", "🎨", "🎸", "🎮", "📷", "💪", "🧘",
  "💷", "📅", "📞", "💻"
].filter((e, i, a) => a.indexOf(e) === i);

function renderListEmojiPicker(modal) {
  const row = document.getElementById("new-list-emoji-picker");
  if (!row) return;
  const emojis = LIST_EMOJIS.includes(listPanelEmoji) ? LIST_EMOJIS : [listPanelEmoji, ...LIST_EMOJIS];
  row.innerHTML = emojis.map(e =>
    `<button type="button" class="drawer-emoji-item emoji-picker-btn ${e === listPanelEmoji ? "is-selected selected" : ""}" data-emoji="${e}" aria-label="Icon ${e}" aria-pressed="${e === listPanelEmoji}">${e}</button>`).join("");
}
let listPanelColor = "sky";

function renderListColorPicker() {
  const row = document.getElementById("new-list-color-picker");
  if (!row) return;
  row.innerHTML = LIST_COLOR_ORDER.map(key => {
    const c = LIST_COLORS[key];
    const on = key === listPanelColor;
    return `<button type="button" class="list-color-swatch ${on ? "is-selected" : ""}" data-color="${key}" aria-label="${c.label}" aria-pressed="${on}" style="--list-accent: ${c.accent}; --list-light: ${c.light};"><span></span></button>`;
  }).join("");
}

function openCreateListModal(listId = null) {
  const modal = document.getElementById("create-list-modal");
  if (!modal) return;
  const lists = loadFamilyLists();
  const editing = listId ? lists.find(l => l.id === listId) : null;
  const input = document.getElementById("new-list-title-input");
  const titleEl = document.getElementById("create-list-title");
  const btnSave = document.getElementById("btn-save-new-list");
  const btnDelete = document.getElementById("btn-delete-list-panel");

  if (input) input.value = editing ? editing.title : "";
  listPanelEmoji = editing ? (editing.emoji || "📋") : "📋";
  listPanelColor = editing ? getListColor(editing, lists.indexOf(editing)).key : LIST_COLOR_ORDER[lists.length % LIST_COLOR_ORDER.length];
  if (titleEl) titleEl.textContent = editing ? "Edit List" : "New List";
  if (btnSave) btnSave.textContent = editing ? "Save" : "Create List";
  if (btnDelete) {
    // Groceries is shared with Meals, so it stays
    btnDelete.style.display = (editing && editing.id !== GROCERIES_LIST_ID) ? "" : "none";
    btnDelete.textContent = "Delete List";
    btnDelete.removeAttribute("data-armed");
  }

  renderListEmojiPicker(modal);
  const emojiRow = document.getElementById("new-list-emoji-picker");
  if (emojiRow) {
    emojiRow.onclick = (e) => {
      const btn = e.target.closest("[data-emoji]");
      if (!btn) return;
      listPanelEmoji = btn.getAttribute("data-emoji");
      emojiRow.querySelectorAll(".emoji-picker-btn").forEach(b => {
        b.classList.toggle("selected", b === btn);
        b.classList.toggle("is-selected", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
    };
  }

  renderListColorPicker();
  const colorRow = document.getElementById("new-list-color-picker");
  if (colorRow) {
    colorRow.onclick = (e) => {
      const sw = e.target.closest("[data-color]");
      if (!sw) return;
      listPanelColor = sw.getAttribute("data-color");
      renderListColorPicker();
    };
  }

  const closeModal = () => { if (modal.open) modal.close(); };
  const btnClose = document.getElementById("btn-close-create-list");
  const btnCancel = document.getElementById("btn-cancel-create-list");
  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  if (btnSave) {
    btnSave.onclick = () => {
      const title = input ? input.value.trim() : "";
      if (!title) { if (input) input.focus(); return; }
      mutateFamilyLists({ type: "upsertList", list: {
        id: editing ? editing.id : "list-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
        title, emoji: listPanelEmoji, color: listPanelColor
      } });
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime && !editing) sfx.playCelebrationChime();
      renderListsView();
      if (!editing) {
        const cols = document.querySelectorAll("#lists-board .list-column");
        const last = cols[cols.length - 1];
        if (last) last.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
      }
    };
  }

  // Return in the name box saves, like the other panels
  if (input) input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.isComposing && btnSave) { e.preventDefault(); btnSave.click(); }
  };

  if (btnDelete) {
    btnDelete.onclick = () => {
      if (!editing) return;
      // Two taps, like Redeem, instead of a browser confirm box
      if (btnDelete.getAttribute("data-armed") !== "true") {
        btnDelete.setAttribute("data-armed", "true");
        btnDelete.textContent = "Tap again to delete";
        setTimeout(() => { btnDelete.removeAttribute("data-armed"); btnDelete.textContent = "Delete List"; }, 4000);
        return;
      }
      mutateFamilyLists({ type: "deleteList", listId: editing.id });
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
      renderListsView();
    };
  }

  if (!modal.open) modal.showModal();
  if (input && !editing) focusAfterPanelOpens(input);
}
window.openCreateListModal = openCreateListModal;

function handleDeleteList(listId) {
  if (listId === GROCERIES_LIST_ID) return;
  mutateFamilyLists({ type: "deleteList", listId });
  renderListsView();
}
window.handleDeleteList = handleDeleteList;

window.loadFamilyLists = loadFamilyLists;
window.saveFamilyLists = saveFamilyLists;
window.handleAddItemToList = handleAddItemToList;
window.handleToggleListItem = handleToggleListItem;
window.handleDeleteListItem = handleDeleteListItem;
window.handleClearCompletedListItems = handleClearCompletedListItems;
