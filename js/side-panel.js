// ============================================================================
// SHARED SIDE PANEL (js/side-panel.js)
// Every add/edit form in harmonee opens the same way as the Tasks drawer:
// a right-hand panel that slides in, with a ← back button and a serif title,
// rounded inputs, and one pill-shaped Save button pinned to the bottom.
//
// The forms keep their own markup and logic. This script just restyles the
// listed <dialog>s: it builds the Tasks-style header, routes ← and taps on the
// dimmed backdrop through each dialog's existing close button (so any cleanup
// those handlers do still runs), and adds the .side-panel class the styles in
// css/side-panel.css hang off.
// ============================================================================

const SIDE_PANEL_DIALOGS = [
  "event-modal",        // Calendar: add / edit event
  "task-modal",         // Calendar: edit chore for a day
  "sticky-note-modal",  // Home: message of the day
  "create-list-modal",  // Lists: new list
  "roster-modal",       // Family members
  "settings-modal",     // Settings
];

function upgradeToSidePanel(dialog) {
  if (!dialog || dialog.classList.contains("side-panel")) return;
  const body = dialog.querySelector(".modal-content");
  if (!body) return;

  dialog.classList.add("side-panel");
  body.classList.add("side-panel-body");

  const closeBtn = dialog.querySelector(".btn-modal-close");
  const titleEl = body.querySelector(".modal-title");

  const header = document.createElement("div");
  header.className = "side-panel-header";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "side-panel-back";
  back.setAttribute("aria-label", "Back");
  back.textContent = "←";
  back.addEventListener("click", () => {
    if (closeBtn) closeBtn.click();
    // Belt and braces: if that handler didn't close it, close it ourselves.
    if (dialog.open) dialog.close();
  });
  header.appendChild(back);
  if (titleEl) {
    titleEl.classList.add("side-panel-title");
    header.appendChild(titleEl);
  }
  body.prepend(header);

  // The old corner ✕ stays in the DOM (its handler is what ← calls) but hidden.
  if (closeBtn) closeBtn.classList.add("side-panel-hidden-close");

  // Tapping the dimmed area to the left closes the panel, like the Tasks drawer.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && dialog.open) back.click();
  });
}

function initSidePanels() {
  SIDE_PANEL_DIALOGS.forEach((id) => upgradeToSidePanel(document.getElementById(id)));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidePanels);
} else {
  initSidePanels();
}
window.upgradeToSidePanel = upgradeToSidePanel;
