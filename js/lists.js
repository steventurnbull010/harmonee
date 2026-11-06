// ============================================================================
// FAMILY LISTS (js/lists.js)
// Skylight-style lists: every list shown side by side as a coloured column,
// each with its own quick-add box. "Groceries" is the one grocery list for
// the whole app; the Meals page reads and writes the same list.
//
// Lists live on the board doc (familyLists) and sync to every device. This
// file owns the only in-memory copy; app.js hands it board updates through
// applyBoardFamilyLists().
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

function setFamilyListsInMemory(lists) {
  familyLists = lists;
  window.familyLists = lists;
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

function saveFamilyLists(lists) {
  setFamilyListsInMemory(lists);
  try {
    localStorage.setItem(boardCacheKey("turnbull_family_lists"), JSON.stringify(lists));
  } catch (e) {}
  if (typeof window.updateGroceryBadgeCount === "function") window.updateGroceryBadgeCount();

  if (window.db && typeof window.setDoc === "function") {
    try {
      window.setDoc(window.doc(window.db, "boards", (window.currentBoardId || "turnbull")), {
        familyLists: lists,
        updatedAt: window.serverTimestamp()
      }, { merge: true }).catch(err => console.warn("Couldn't save lists:", err));
    } catch (e) {}
  }
}

// Called by the board listener in app.js when lists change on any device
function applyBoardFamilyLists(lists) {
  if (!Array.isArray(lists)) return;
  setFamilyListsInMemory(lists);
  try { localStorage.setItem(boardCacheKey("turnbull_family_lists"), JSON.stringify(lists)); } catch (e) {}
  if (typeof window.updateGroceryBadgeCount === "function") window.updateGroceryBadgeCount();
  const view = document.getElementById("view-lists");
  if (view && view.style.display !== "none") renderListsView();
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

  board.innerHTML = lists.map((list, index) => {
    const col = getListColor(list, index);
    const items = Array.isArray(list.items) ? list.items : [];
    const open = items.filter(i => !i.checked);
    const done = items.filter(i => i.checked);
    const countText = items.length === 0 ? "Empty" : `${open.length} to do${done.length ? ` · ${done.length} done` : ""}`;
    const itemHtml = (item) => `
      <li class="list-row ${item.checked ? "is-checked" : ""}" data-item-id="${escapeHtml(item.id)}">
        <button type="button" class="list-row-check" data-toggle-item aria-pressed="${item.checked ? "true" : "false"}" aria-label="${item.checked ? "Untick" : "Tick"} ${escapeHtml(item.text)}">
          <span class="list-row-box">${item.checked ? "✓" : ""}</span>
          <span class="list-row-text">${escapeHtml(item.text)}</span>
        </button>
        <button type="button" class="list-row-del" data-delete-item aria-label="Remove ${escapeHtml(item.text)}">✕</button>
      </li>`;
    return `
      <section class="list-column" data-list-id="${escapeHtml(list.id)}" style="--list-accent: ${col.accent}; --list-light: ${col.light};">
        <header class="list-column-head">
          <span class="list-column-emoji">${escapeHtml(list.emoji || "📋")}</span>
          <div class="list-column-titles">
            <h3 class="list-column-title">${escapeHtml(list.title)}</h3>
            <span class="list-column-count">${countText}</span>
          </div>
          <button type="button" class="list-column-edit" data-edit-list aria-label="Edit ${escapeHtml(list.title)}">✎</button>
        </header>
        <form class="list-column-add" data-add-item>
          <input type="text" placeholder="Add to ${escapeHtml(list.title)}" aria-label="Add to ${escapeHtml(list.title)}" autocomplete="off" enterkeyhint="done">
          <button type="button" data-open-add-panel aria-label="Add items to ${escapeHtml(list.title)}">+</button>
        </form>
        <ul class="list-column-items">
          ${open.map(itemHtml).join("")}
          ${done.map(itemHtml).join("")}
          ${items.length === 0 ? `<li class="list-column-empty">Nothing here yet</li>` : ""}
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
  const column = e.target.closest("[data-list-id]");
  if (!column) return;
  const listId = column.getAttribute("data-list-id");
  const row = e.target.closest("[data-item-id]");

  if (e.target.closest("[data-toggle-item]") && row) {
    const list = loadFamilyLists().find(l => l.id === listId);
    const item = list && (list.items || []).find(i => i.id === row.getAttribute("data-item-id"));
    if (item) handleToggleListItem(listId, item.id, !item.checked);
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
    return `<button type="button" class="list-item-picker-pill ${on ? "is-selected" : ""}" data-pick-list="${escapeHtml(l.id)}" aria-pressed="${on}" style="--list-accent: ${col.accent}; --list-light: ${col.light};">
      <span>${escapeHtml(l.emoji || "📋")}</span>${escapeHtml(l.title)}
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
      const lists = loadFamilyLists();
      const list = lists.find(l => l.id === addPanelListId);
      if (!list) return;
      if (!Array.isArray(list.items)) list.items = [];
      const stamp = Date.now();
      // Keep the order they were typed in, at the top of the list
      list.items = lines.map((text, i) => ({
        id: `item-${stamp}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        text,
        checked: false,
        addedAt: new Date().toISOString()
      })).concat(list.items);
      saveFamilyLists(lists);
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
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  if (!Array.isArray(list.items)) list.items = [];
  list.items.unshift({
    id: "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    text,
    checked: false,
    addedAt: new Date().toISOString()
  });
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

function handleToggleListItem(listId, itemId, checked) {
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  const item = list && (list.items || []).find(i => i.id === itemId);
  if (!item) return;
  item.checked = checked;
  saveFamilyLists(lists);
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
  list.items = list.items.filter(i => i.id !== itemId);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
  renderListsView();
}

function handleClearCompletedListItems(listId) {
  const lists = loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  list.items = list.items.filter(i => !i.checked);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

// ---------------------------------------------------------------------------
// New / edit list side panel (#create-list-modal)
// ---------------------------------------------------------------------------
let listPanelEmoji = "📋";
let listPanelColor = "sky";

function renderListColorPicker() {
  const row = document.getElementById("new-list-color-picker");
  if (!row) return;
  row.innerHTML = LIST_COLOR_ORDER.map(key => {
    const c = LIST_COLORS[key];
    const on = key === listPanelColor;
    return `<button type="button" class="list-color-swatch ${on ? "is-selected" : ""}" data-color="${key}" aria-label="${c.label}" aria-pressed="${on}" style="background: ${c.light}; border-color: ${c.accent};"><span style="background: ${c.accent};"></span></button>`;
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

  const emojis = modal.querySelectorAll(".emoji-picker-btn");
  emojis.forEach(btn => {
    btn.classList.toggle("selected", btn.getAttribute("data-emoji") === listPanelEmoji);
    btn.onclick = () => {
      listPanelEmoji = btn.getAttribute("data-emoji");
      emojis.forEach(b => b.classList.toggle("selected", b === btn));
    };
  });

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
      const current = loadFamilyLists();
      if (editing) {
        const target = current.find(l => l.id === editing.id);
        if (target) Object.assign(target, { title, emoji: listPanelEmoji, color: listPanelColor });
      } else {
        current.push({ id: "list-" + Date.now(), title, emoji: listPanelEmoji, color: listPanelColor, items: [] });
      }
      saveFamilyLists(current);
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
      saveFamilyLists(loadFamilyLists().filter(l => l.id !== editing.id));
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
  saveFamilyLists(loadFamilyLists().filter(l => l.id !== listId));
  renderListsView();
}
window.handleDeleteList = handleDeleteList;

window.loadFamilyLists = loadFamilyLists;
window.saveFamilyLists = saveFamilyLists;
window.handleAddItemToList = handleAddItemToList;
window.handleToggleListItem = handleToggleListItem;
window.handleDeleteListItem = handleDeleteListItem;
window.handleClearCompletedListItems = handleClearCompletedListItems;
