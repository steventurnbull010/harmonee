// ============================================================================
// BANK HOLIDAYS (js/bank-holidays.js)
// UK bank holidays on the calendar (every view, beside the day's dinner) and
// on Today at a glance, from the government's list saved with harmonee
// (js/bank-holidays-data.js; refreshed yearly by scripts/update-bank-holidays.mjs).
// No requests leave the page.
//
// Which list is a board setting (Settings > Display > Bank holidays):
// England & Wales (the default), Scotland, Northern Ireland, or off.
//
//   BankHolidays.on("2026-12-26")   -> "Boxing Day" | null
//   BankHolidays.chipHtml(dateKey, "box" | "month" | "banner")
// ============================================================================
(function () {
  const REGIONS = {
    "england-and-wales": "England & Wales",
    "scotland": "Scotland",
    "northern-ireland": "Northern Ireland",
    "off": "Off"
  };
  const DEFAULT = "england-and-wales";
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  function region() {
    const r = (window.boardSettings || {}).bankHolidays;
    return REGIONS[r] ? r : DEFAULT;
  }

  function on(dateKey) {
    const r = region();
    if (r === "off") return null;
    const data = window.BANK_HOLIDAYS_DATA && window.BANK_HOLIDAYS_DATA.regions && window.BANK_HOLIDAYS_DATA.regions[r];
    return (data && data[dateKey]) || null;
  }

  // The chip, in the shape each calendar view uses for the day's dinner
  function chipHtml(dateKey, variant = "box") {
    const name = on(dateKey);
    if (!name) return "";
    const title = `Bank holiday: ${name}`;
    if (variant === "month") return `<div class="bank-holiday-chip is-month" title="${esc(title)}"><span aria-hidden="true">🎉</span><span class="bank-holiday-name">${esc(name)}</span></div>`;
    if (variant === "banner") return `<div class="bank-holiday-chip is-banner" title="${esc(title)}"><span class="bank-holiday-icon" aria-hidden="true">🎉</span><span class="bank-holiday-text"><span class="bank-holiday-label">Bank holiday</span><span class="bank-holiday-name">${esc(name)}</span></span></div>`;
    return `<div class="bank-holiday-chip" title="${esc(title)}"><span aria-hidden="true">🎉</span><span class="bank-holiday-name">${esc(name)}</span></div>`;
  }

  // Settings > Display: the choice, saved for the whole board
  function renderSettings() {
    const sel = document.getElementById("settings-bank-holidays");
    if (sel) sel.value = region();
  }
  document.addEventListener("change", (e) => {
    if (!e.target || e.target.id !== "settings-bank-holidays") return;
    const value = REGIONS[e.target.value] ? e.target.value : DEFAULT;
    if (typeof window.saveBoardSettingsNow === "function") {
      Promise.resolve(window.saveBoardSettingsNow({ bankHolidays: value })).then(() => {
        if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
        if (typeof window.notifyBoardChanged === "function") window.notifyBoardChanged();
      });
    }
  });

  window.BankHolidays = { on, chipHtml, region, renderSettings, REGIONS };
})();
