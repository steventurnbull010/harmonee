let familyLists = null;
window.familyLists = familyLists;

let activeListId = "groceries";
window.activeListId = activeListId;

// ============================================================================
// FAMILY LISTS HUB MODULE (js/lists.js)
// Dedicated Family Lists, Categories, Items, Grocery Integration
// ============================================================================

// ============================================================================
// SPRINT 2: DEDICATED FAMILY LISTS HUB
// ============================================================================

function loadFamilyLists() {
  if (familyLists && Array.isArray(familyLists) && familyLists.length > 0) return familyLists;
  try {
    const raw = localStorage.getItem(boardCacheKey("turnbull_family_lists"));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        familyLists = parsed;
        return familyLists;
      }
    }
  } catch(e) {}

  const existingGroceries = (window.familyGroceryList || (typeof loadFamilyGroceryList === "function" ? loadFamilyGroceryList() : [])) || [];

  familyLists = [
    {
      id: "groceries",
      title: "Family Groceries",
      emoji: "🛒",
      isDefault: true,
      items: existingGroceries.length > 0 ? existingGroceries : [
        { id: "g-1", text: "Fresh Mozzarella (250g)", checked: false },
        { id: "g-2", text: "Green Basil Pesto (190g)", checked: false },
        { id: "g-3", text: "Crème Fraîche (150g)", checked: false },
        { id: "g-4", text: "Frozen Garden Peas", checked: true }
      ]
    },
    {
      id: "todo",
      title: "Weekend To-Do & Errands",
      emoji: "📋",
      items: [
        { id: "td-1", text: "Book annual car service & MOT", checked: false },
        { id: "td-2", text: "Pick up dry cleaning", checked: false },
        { id: "td-3", text: "Wash dog & cat bedding", checked: true }
      ]
    },
    {
      id: "packing",
      title: "Holiday & Travel Packing",
      emoji: "🧳",
      items: [
        { id: "pk-1", text: "Passports, EHIC cards & boarding passes", checked: false },
        { id: "pk-2", text: "Phone chargers & European travel adapters", checked: false },
        { id: "pk-3", text: "Sunscreen SPF 50 & insect repellent", checked: false },
        { id: "pk-4", text: "Toothbrushes & travel toiletries", checked: true }
      ]
    }
  ];
  saveFamilyLists(familyLists);
  return familyLists;
}

function saveFamilyLists(lists) {
  familyLists = lists;
  try {
    localStorage.setItem(boardCacheKey("turnbull_family_lists"), JSON.stringify(lists));
    const groc = lists.find(l => l.id === "groceries");
    if (groc) {
      window.familyGroceryList = groc.items;
      localStorage.setItem(boardCacheKey("turnbull_grocery_list_v2"), JSON.stringify(groc.items));
      if (typeof updateGroceryBadgeCount === "function") updateGroceryBadgeCount();
    }
  } catch(e) {}

  if (db && typeof setDoc === "function") {
    try {
      const boardDocRef = doc(db, "boards", (window.currentBoardId || "turnbull"));
      setDoc(boardDocRef, {
        familyLists: lists,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch(e) {}
  }
}

function renderListsView() {
  const lists = familyLists || loadFamilyLists();
  const selectorBar = document.getElementById("lists-selector-bar");
  const activeTitle = document.getElementById("active-list-title");
  const activeEmoji = document.getElementById("active-list-emoji");
  const activeProgressFill = document.getElementById("active-list-progress-fill");
  const activeProgressText = document.getElementById("active-list-progress-text");
  const btnDelete = document.getElementById("btn-lists-delete-list");
  const btnClearChecked = document.getElementById("btn-lists-clear-checked");
  const itemsUl = document.getElementById("list-items-ul");

  if (!lists || lists.length === 0) return;

  let currentList = lists.find(l => l.id === activeListId);
  if (!currentList) {
    currentList = lists[0];
    activeListId = currentList.id;
  }

  // 1. Render Selector Tabs
  if (selectorBar) {
    selectorBar.innerHTML = lists.map(list => {
      const remaining = list.items ? list.items.filter(i => !i.checked).length : 0;
      const isActive = list.id === activeListId;
      return `
        <button type="button" class="list-tab-pill ${isActive ? 'active' : ''}" data-list-id="${list.id}">
          <span>${list.emoji || '📋'}</span>
          <span>${escapeHtml(list.title)}</span>
          <span class="tab-count-badge">${remaining}</span>
        </button>
      `;
    }).join("");

    selectorBar.querySelectorAll(".list-tab-pill").forEach(pill => {
      pill.onclick = () => {
        const id = pill.getAttribute("data-list-id");
        activeListId = id;
        if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
        renderListsView();
      };
    });
  }

  // 2. Render Active List Header & Progress
  if (activeTitle) activeTitle.textContent = currentList.title;
  if (activeEmoji) activeEmoji.textContent = currentList.emoji || "📋";

  const totalItems = currentList.items ? currentList.items.length : 0;
  const completedItems = currentList.items ? currentList.items.filter(i => i.checked).length : 0;
  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (activeProgressFill) activeProgressFill.style.width = `${percent}%`;
  if (activeProgressText) {
    activeProgressText.textContent = totalItems === 0 
      ? "No items yet" 
      : `${completedItems} of ${totalItems} done (${percent}%)`;
  }

  if (btnDelete) {
    btnDelete.style.display = currentList.isDefault ? "none" : "inline-block";
    btnDelete.onclick = () => handleDeleteList(currentList.id, currentList.title);
  }

  if (btnClearChecked) {
    btnClearChecked.disabled = completedItems === 0;
    btnClearChecked.style.opacity = completedItems === 0 ? "0.5" : "1";
    btnClearChecked.textContent = completedItems > 0 ? `Clear Completed (${completedItems})` : "Clear Completed";
    btnClearChecked.onclick = () => handleClearCompletedListItems(currentList.id);
  }

  // 3. Render List Items
  if (itemsUl) {
    if (totalItems === 0) {
      itemsUl.innerHTML = `
        <li style="text-align: center; padding: 40px 10px; color: var(--text-muted); list-style: none;">
          <p style="font-size: 2rem; margin: 0 0 8px 0;">${currentList.emoji || '📋'}</p>
          <p style="font-weight: 700; font-size: 1.05rem; margin: 0; color: var(--text-primary);">This list is empty!</p>
          <p style="font-size: 0.85rem; margin: 4px 0 0 0;">Type an item above to add it to ${escapeHtml(currentList.title)}</p>
        </li>
      `;
    } else {
      itemsUl.innerHTML = currentList.items.map(item => {
        return `
          <li class="list-item-row ${item.checked ? 'is-checked' : ''}" data-item-id="${item.id}">
            <div class="list-item-left">
              <input type="checkbox" class="list-item-checkbox" id="chk-li-${item.id}" ${item.checked ? 'checked' : ''}>
              <label for="chk-li-${item.id}" class="list-item-text">${escapeHtml(item.text)}</label>
            </div>
            <button type="button" class="btn-list-item-del" data-item-id="${item.id}" title="Remove item">✕</button>
          </li>
        `;
      }).join("");

      itemsUl.querySelectorAll(".list-item-row").forEach(row => {
        const itemId = row.getAttribute("data-item-id");
        const chk = row.querySelector(".list-item-checkbox");
        if (chk) {
          chk.onchange = () => {
            handleToggleListItem(currentList.id, itemId, chk.checked);
          };
        }
        const delBtn = row.querySelector(".btn-list-item-del");
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            handleDeleteListItem(currentList.id, itemId);
          };
        }
      });
    }
  }

  // 4. Wire Quick Add input
  const quickInput = document.getElementById("list-quick-add-input");
  const btnAdd = document.getElementById("btn-list-add-item");
  if (btnAdd && !btnAdd.hasAttribute("data-wired")) {
    btnAdd.setAttribute("data-wired", "true");
    btnAdd.onclick = () => {
      if (!quickInput) return;
      const text = quickInput.value.trim();
      if (!text) return;
      handleAddItemToList(activeListId, text);
      quickInput.value = "";
      quickInput.focus();
    };
  }
  if (quickInput && !quickInput.hasAttribute("data-wired")) {
    quickInput.setAttribute("data-wired", "true");
    quickInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = quickInput.value.trim();
        if (!text) return;
        handleAddItemToList(activeListId, text);
        quickInput.value = "";
      }
    };
  }

  // 5. Wire Create New List Button
  const btnNewList = document.getElementById("btn-create-new-list");
  if (btnNewList && !btnNewList.hasAttribute("data-wired")) {
    btnNewList.setAttribute("data-wired", "true");
    btnNewList.onclick = () => openCreateListModal();
  }
}
window.renderListsView = renderListsView;

function handleAddItemToList(listId, text) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  if (!list.items) list.items = [];

  list.items.unshift({
    id: "item-" + Date.now(),
    text: text,
    checked: false,
    addedAt: new Date().toISOString()
  });

  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

function handleToggleListItem(listId, itemId, checked) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  item.checked = checked;
  saveFamilyLists(lists);
  if (checked && typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) {
    sfx.playCelebrationChime();
  } else if (typeof sfx !== "undefined" && sfx && sfx.playClick) {
    sfx.playClick();
  }
  renderListsView();
}

function handleDeleteListItem(listId, itemId) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
  renderListsView();
}

function handleClearCompletedListItems(listId) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  list.items = list.items.filter(i => !i.checked);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

let selectedNewListEmoji = "📋";

function openCreateListModal() {
  const modal = document.getElementById("create-list-modal");
  if (!modal) return;
  const input = document.getElementById("new-list-title-input");
  if (input) input.value = "";
  selectedNewListEmoji = "📋";

  const emojis = document.querySelectorAll(".emoji-picker-btn");
  emojis.forEach(btn => {
    btn.classList.toggle("selected", btn.getAttribute("data-emoji") === "📋");
    btn.onclick = () => {
      selectedNewListEmoji = btn.getAttribute("data-emoji");
      emojis.forEach(b => b.classList.toggle("selected", b === btn));
    };
  });

  const btnClose = document.getElementById("btn-close-create-list");
  const btnCancel = document.getElementById("btn-cancel-create-list");
  const btnSave = document.getElementById("btn-save-new-list");

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (btnSave) {
    btnSave.onclick = () => {
      const title = input ? input.value.trim() : "";
      if (!title) {
        alert("Please enter a title for your list.");
        return;
      }
      const lists = familyLists || loadFamilyLists();
      const newListId = "list-" + Date.now();
      lists.push({
        id: newListId,
        title: title,
        emoji: selectedNewListEmoji || "📋",
        items: []
      });
      saveFamilyLists(lists);
      activeListId = newListId;
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (typeof showCalendarToast === "function") {
        showCalendarToast(`Created list: ${selectedNewListEmoji} ${title}!`);
      }
      renderListsView();
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
  if (input) input.focus();
}
window.openCreateListModal = openCreateListModal;

function handleDeleteList(listId, title) {
  if (confirm(`Are you sure you want to delete "${title}"?`)) {
    const lists = (familyLists || loadFamilyLists()).filter(l => l.id !== listId);
    activeListId = lists.length > 0 ? lists[0].id : "groceries";
    saveFamilyLists(lists);
    if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
    if (typeof showCalendarToast === "function") {
      showCalendarToast(`Deleted list: ${title}`);
    }
    renderListsView();
  }
}
window.handleDeleteList = handleDeleteList;


window.loadFamilyLists = loadFamilyLists;
window.saveFamilyLists = saveFamilyLists;
window.handleAddItemToList = handleAddItemToList;
window.handleToggleListItem = handleToggleListItem;
window.handleDeleteListItem = handleDeleteListItem;
window.handleClearCompletedListItems = handleClearCompletedListItems;
