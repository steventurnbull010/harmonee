// ============================================================================
// SHARED DATE PICKER (js/date-picker.js)
// The month-grid picker first built for the Tasks panel ("Select date",
// 7 Nov 2026, Dismiss / Select), used for every date in the app.
//
//   openDatePicker({ value, onSelect })   value: Date or "YYYY-MM-DD"
//
// Every <input type="date"> on the page is also upgraded: the input is
// hidden and a button that looks like the field (same classes) shows the
// date and opens this picker. Picking a date sets input.value and fires
// "input" and "change", so the code that owns the field doesn't change.
// Setting input.value from code updates the button too.
//
// The picker is a <dialog>, so it opens on top of the side panels (which are
// dialogs themselves and sit in the browser's top layer).
// ============================================================================

(function () {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const toDate = (v) => {
    if (v instanceof Date && !isNaN(v)) { const d = new Date(v); d.setHours(0, 0, 0, 0); return d; }
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); }
    const t = new Date(); t.setHours(0, 0, 0, 0); return t;
  };
  const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  function openDatePicker({ value = null, onSelect = null } = {}) {
    const modal = document.getElementById("skylight-datepicker-modal");
    if (!modal) return;
    let selected = toDate(value);              // only committed on Select
    const viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const today = toDate(null);

    const render = () => {
      const yr = viewMonth.getFullYear(), mo = viewMonth.getMonth();
      document.getElementById("datepicker-month-name").textContent = `${MONTHS[mo]} ${yr}`;
      document.getElementById("datepicker-selected-label").textContent =
        selected.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      const grid = document.getElementById("datepicker-days-grid");
      const firstDay = new Date(yr, mo, 1).getDay();
      const lastDate = new Date(yr, mo + 1, 0).getDate();
      let html = "";
      for (let i = 0; i < firstDay; i++) html += `<span class="datepicker-day-cell is-other-month"></span>`;
      for (let d = 1; d <= lastDate; d++) {
        const isSel = selected.getFullYear() === yr && selected.getMonth() === mo && selected.getDate() === d;
        const isToday = today.getFullYear() === yr && today.getMonth() === mo && today.getDate() === d;
        html += `<button type="button" class="datepicker-day-cell ${isSel ? "is-selected" : ""} ${isToday ? "is-today" : ""}" data-day="${d}" aria-pressed="${isSel}" aria-label="${d} ${MONTHS[mo]} ${yr}">${d}</button>`;
      }
      grid.innerHTML = html;
      grid.querySelectorAll("[data-day]").forEach(btn => {
        btn.onclick = () => { selected = new Date(yr, mo, parseInt(btn.dataset.day, 10)); render(); };
      });
    };

    const close = () => {
      if (typeof modal.close === "function" && modal.open) modal.close();
      else modal.style.display = "none";
    };
    document.getElementById("btn-datepicker-prev").onclick = () => { viewMonth.setMonth(viewMonth.getMonth() - 1); render(); };
    document.getElementById("btn-datepicker-next").onclick = () => { viewMonth.setMonth(viewMonth.getMonth() + 1); render(); };
    document.getElementById("btn-datepicker-dismiss").onclick = close;
    document.getElementById("btn-datepicker-select").onclick = () => {
      close();
      if (typeof onSelect === "function") onSelect(new Date(selected), toKey(selected));
    };
    modal.onclick = (e) => { if (e.target === modal) close(); }; // tap outside the card

    render();
    if (typeof modal.showModal === "function") { if (!modal.open) modal.showModal(); }
    else modal.style.display = "flex";
    setTimeout(() => { try { modal.querySelector(".datepicker-day-cell.is-selected")?.focus({ preventScroll: true }); } catch (e) {} }, 30);
  }
  window.openDatePicker = openDatePicker;

  // ---- Upgrade <input type="date"> fields to open this picker -------------
  const label = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key || "")
    ? toDate(key).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Pick a date";

  function upgradeDateInput(input) {
    if (!input || input.dataset.pickerUpgraded) return;
    input.dataset.pickerUpgraded = "true";
    input.required = false; // hidden fields can't show "please fill in"; the code always sets a date

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${input.className} date-field-button`;
    btn.setAttribute("aria-label", input.getAttribute("aria-label") || "Date");
    btn.innerHTML = `<span class="date-field-button-text"></span><svg class="date-field-button-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
    const textEl = btn.querySelector(".date-field-button-text");
    input.insertAdjacentElement("afterend", btn);
    input.classList.add("date-field-hidden-input");

    // Keep the button in step when code sets input.value
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const refresh = () => { textEl.textContent = label(proto.get.call(input)); };
    Object.defineProperty(input, "value", {
      configurable: true,
      get() { return proto.get.call(this); },
      set(v) { proto.set.call(this, v); refresh(); }
    });
    refresh();

    const open = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      openDatePicker({
        value: input.value,
        onSelect: (_d, key) => {
          input.value = key;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    };
    btn.addEventListener("click", open);
    // A <label for> around or pointing at the field opens it too
    input.addEventListener("click", open);
  }
  window.upgradeDateInput = upgradeDateInput;

  const upgradeAll = () => document.querySelectorAll('input[type="date"]').forEach(upgradeDateInput);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", upgradeAll);
  else upgradeAll();
})();
