// ============================================================================
// FAMILY STICKY NOTE MODULE (js/sticky-note.js)
// Message of the Day, Live Sync, Sticky Dialog
// ============================================================================

let familyStickyNote = null;
window.familyStickyNote = familyStickyNote;
let selectedStickyColor = "yellow";
window.selectedStickyColor = selectedStickyColor;

// SPRINT 2: FAMILY STICKY NOTE / MESSAGE OF THE DAY
// ============================================================================

function loadFamilyStickyNote() {
  if (familyStickyNote !== null && familyStickyNote !== undefined) return familyStickyNote;
  try {
    const raw = localStorage.getItem(boardCacheKey("turnbull_sticky_note"));
    if (raw === "none" || raw === "null" || !raw) {
      familyStickyNote = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.text && !parsed.deleted) {
      familyStickyNote = parsed;
      return familyStickyNote;
    }
  } catch(e) {}
  familyStickyNote = null;
  return null;
}

function saveFamilyStickyNote(note) {
  if (note && note.text && !note.deleted) {
    familyStickyNote = note;
    try {
      localStorage.setItem(boardCacheKey("turnbull_sticky_note"), JSON.stringify(note));
    } catch(e) {}
  } else {
    familyStickyNote = null;
    try {
      localStorage.setItem(boardCacheKey("turnbull_sticky_note"), "none");
    } catch(e) {}
  }
  if (db && typeof setDoc === "function") {
    try {
      const boardDocRef = doc(db, "boards", (window.currentBoardId || "turnbull"));
      setDoc(boardDocRef, {
        stickyNote: familyStickyNote || null,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch(e) {}
  }
}

function renderFamilyStickyNote() {
  const container = document.getElementById("family-sticky-container");
  const card = document.getElementById("family-sticky-card");
  const textEl = document.getElementById("sticky-message-text");
  const authorEl = document.getElementById("sticky-author-badge");
  const timeEl = document.getElementById("sticky-time-badge");
  if (!container || !card || !textEl) return;

  const note = (familyStickyNote !== undefined && familyStickyNote !== null) ? familyStickyNote : loadFamilyStickyNote();
  if (!note || !note.text || !note.text.trim() || note.deleted) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  card.className = `family-sticky-card color-${note.color || 'yellow'}`;
  textEl.textContent = note.text;
  textEl.style.fontStyle = "normal";
  textEl.style.opacity = "1";
  if (authorEl) authorEl.textContent = note.author ? `From ${note.author}` : "Family Note";
  if (timeEl) {
    timeEl.textContent = "Today";
  }
}
window.renderFamilyStickyNote = renderFamilyStickyNote;

function openStickyNoteModal() {
  const modal = document.getElementById("sticky-note-modal");
  if (!modal) return;
  const input = document.getElementById("sticky-input-text");
  const authorSelect = document.getElementById("sticky-input-author");
  const note = (familyStickyNote !== undefined && familyStickyNote !== null) ? familyStickyNote : loadFamilyStickyNote();

  if (input) input.value = (note && note.text && !note.deleted) ? note.text : "";
  // "Signed by": this family's people (the page itself names nobody)
  if (authorSelect) {
    const people = (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
    const extra = note && note.author && note.author !== "Family" && !people.includes(note.author) ? [note.author] : [];
    authorSelect.innerHTML = `<option value="Family">❤️ The whole family</option>` +
      [...people, ...extra].map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    authorSelect.value = (note && note.author) ? note.author : "Family";
  }
  selectedStickyColor = (note && note.color) ? note.color : "yellow";

  const pills = document.querySelectorAll(".sticky-color-pill");
  pills.forEach(pill => {
    pill.classList.toggle("selected", pill.getAttribute("data-color") === selectedStickyColor);
    pill.onclick = () => {
      selectedStickyColor = pill.getAttribute("data-color");
      pills.forEach(p => p.classList.toggle("selected", p === pill));
    };
  });

  const btnClose = document.getElementById("btn-close-sticky-modal");
  const btnCancel = document.getElementById("btn-cancel-sticky");
  const btnSave = document.getElementById("btn-save-sticky");
  const btnClear = document.getElementById("btn-clear-sticky");

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (btnClear) {
    btnClear.textContent = "Delete Note";
    btnClear.style.display = (note && note.text && !note.deleted) ? "inline-flex" : "none";
    btnClear.onclick = () => {
      saveFamilyStickyNote(null);
      renderFamilyStickyNote();
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
      if (typeof showCalendarToast === "function") showCalendarToast("🗑️ Deleted note from the board.");
    };
  }
  if (btnSave) {
    btnSave.onclick = () => {
      const text = input ? input.value.trim() : "";
      if (!text) {
        saveFamilyStickyNote(null);
      } else {
        const author = authorSelect ? authorSelect.value : "Family";
        saveFamilyStickyNote({
          text: text,
          author: author,
          color: selectedStickyColor || "yellow",
          updatedAt: new Date().toISOString()
        });
      }
      renderFamilyStickyNote();
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (typeof showCalendarToast === "function") showCalendarToast("📌 Pinned message to the family board!");
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
  if (input) focusAfterPanelOpens(input);
}
window.openStickyNoteModal = openStickyNoteModal;


window.loadFamilyStickyNote = loadFamilyStickyNote;
window.saveFamilyStickyNote = saveFamilyStickyNote;
window.renderFamilyStickyNote = renderFamilyStickyNote;
window.openStickyNoteModal = openStickyNoteModal;
