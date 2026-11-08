// ============================================================================
// SLIDE-UP SHEETS (js/sheet.js + css/sheet.css)
// harmonee's questions ("Add the ingredients to the shopping list?", "Save
// your changes?", "Replace Tuesday's dinner?") slide up from the bottom on
// phones, with a grab handle, and rise gently into the middle on tablets;
// they slide back down when answered. Any <dialog> with class "hm-sheet"
// gets the look; these helpers add the friendly close and a ready-made
// yes/no question in place of the browser's grey confirm() box.
//   await Sheet.confirm({ icon, title, text, yes, no, danger })  -> true/false
//   Sheet.close(dialog)  slides it away, then closes it
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function close(dlg, then) {
    if (!dlg || !dlg.open) { if (then) then(); return; }
    if (reduce()) { dlg.close(); if (then) then(); return; }
    dlg.classList.add("is-closing");
    setTimeout(() => {
      dlg.classList.remove("is-closing");
      if (dlg.open) dlg.close();
      if (then) then();
    }, 200);
  }

  let box = null, answer = null;
  function getBox() {
    if (box) return box;
    box = document.createElement("dialog");
    box.id = "hm-confirm";
    box.className = "hm-sheet hm-confirm";
    box.setAttribute("aria-labelledby", "hm-confirm-title");
    document.body.appendChild(box);
    box.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest("[data-sheet-no]")) { done(false); return; }
      if (e.target.closest("[data-sheet-yes]")) done(true);
    });
    return box;
  }
  function done(yes) {
    const cb = answer; answer = null;
    close(box, () => { if (cb) cb(yes); });
  }

  function confirm({ icon = "", title = "", text = "", yes = "Yes", no = "No thanks", danger = false } = {}) {
    return new Promise(resolve => {
      const d = getBox();
      if (answer) answer(false);
      answer = resolve;
      d.innerHTML = `<div class="hm-sheet-card">
        ${icon ? `<span class="hm-sheet-icon" aria-hidden="true">${icon}</span>` : ""}
        <h2 class="hm-sheet-title" id="hm-confirm-title">${esc(title)}</h2>
        ${text ? `<p class="hm-sheet-text">${esc(text)}</p>` : ""}
        <button type="button" class="hm-sheet-yes${danger ? " is-danger" : ""}" data-sheet-yes>${esc(yes)}</button>
        <button type="button" class="hm-sheet-no" data-sheet-no>${esc(no)}</button>
      </div>`;
      if (!d.open) d.showModal();
      setTimeout(() => { try { d.querySelector("[data-sheet-yes]").focus({ preventScroll: true }); } catch (e) {} }, 50);
    });
  }

  window.Sheet = { confirm, close };
})();
