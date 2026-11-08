// ============================================================================
// SETTINGS FOLD-OUTS (js/settings-fold.js)
// Each Settings section folds away behind its heading, so the page isn't one
// long scroll: tap a heading to open or close it. The section buttons at the
// top open their section and jump to it. Which sections are open is
// remembered on this device; Profiles starts open, Reset starts closed.
// Works on the existing markup: nothing in index.html had to change.
// ============================================================================
(function () {
  const KEY = "harmonee_settings_open";
  const FIRST_OPEN = ["profiles"];
  const CHEVRON = '<svg class="settings-fold-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const keyOf = (sec) => sec.id.replace("settings-sec-", "");

  function remembered() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) ? v : FIRST_OPEN; } catch (e) { return FIRST_OPEN; }
  }
  function remember() {
    const open = [...document.querySelectorAll("#settings-modal .settings-section.is-foldable")].filter(s => !s.classList.contains("is-folded")).map(keyOf);
    try { localStorage.setItem(KEY, JSON.stringify(open)); } catch (e) {}
  }

  function setOpen(sec, open) {
    if (!sec || !sec.classList.contains("is-foldable")) return;
    sec.classList.toggle("is-folded", !open);
    const body = sec.querySelector(":scope > .settings-fold-body");
    const btn = sec.querySelector(".settings-fold-btn");
    if (body) body.hidden = !open;
    if (btn) btn.setAttribute("aria-expanded", String(open));
  }

  function prepare() {
    const sections = document.querySelectorAll("#settings-modal .settings-section");
    if (!sections.length) return false;
    const open = remembered();
    sections.forEach(sec => {
      if (sec.classList.contains("is-foldable") || !sec.id) return;
      const head = sec.querySelector(":scope > .settings-section-head") || sec.querySelector(":scope > h3");
      if (!head) return;
      const title = head.matches("h3") ? head : head.querySelector("h3");
      if (!title) return;
      // Everything after the heading goes into the part that folds away
      const body = document.createElement("div");
      body.className = "settings-fold-body";
      body.id = `${sec.id}-body`;
      [...sec.children].filter(c => c !== head).forEach(c => body.appendChild(c));
      sec.appendChild(body);
      // The heading becomes the button (its words and icon stay as they were)
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-fold-btn";
      btn.setAttribute("aria-controls", body.id);
      [...title.childNodes].forEach(n => btn.appendChild(n));
      btn.insertAdjacentHTML("beforeend", CHEVRON);
      title.appendChild(btn);
      head.classList.add("settings-fold-head");
      sec.classList.add("is-foldable");
      setOpen(sec, open.includes(keyOf(sec)) && !sec.classList.contains("settings-danger-zone"));
    });
    return true;
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("#settings-modal .settings-fold-btn");
    if (btn) {
      const sec = btn.closest(".settings-section");
      setOpen(sec, sec.classList.contains("is-folded"));
      remember();
      return;
    }
    // A section button at the top: open that section before the page jumps to it
    const chip = e.target.closest && e.target.closest("#settings-section-nav [data-section]");
    if (chip) {
      const sec = document.getElementById(`settings-sec-${chip.getAttribute("data-section")}`);
      if (sec && sec.classList.contains("is-folded")) { setOpen(sec, true); remember(); }
    }
  }, true);

  // Anything else that opens Settings at a section (e.g. "Choose services")
  window.openSettingsSection = (key) => {
    const sec = document.getElementById(`settings-sec-${key}`);
    if (sec && sec.classList.contains("is-folded")) { setOpen(sec, true); remember(); }
  };

  if (!prepare()) document.addEventListener("DOMContentLoaded", prepare);
  window.SettingsFold = { prepare, setOpen };
})();
