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
//   BankHolidays.on("2026-12-28")   -> "Day off for Boxing Day" | null (bank holidays only)
//   BankHolidays.dayOf("2026-12-26") -> { name: "Boxing Day", dayOff: "2026-12-28" } | null
//     a holiday on a weekend: its own date, when the day off has moved
//   BankHolidays.chipHtml(dateKey, "box" | "month" | "banner")   either kind
//   BankHolidays.eventFor(dateKey)   the holiday as an event, to open and add a
//     countdown or an icon to (22 Nov: tap the chip). Those are kept with the
//     imported events' extras (settings.eventExtras, id "bh-YYYY-MM-DD").
//   BankHolidays.countdownEvents()   holidays with a countdown switched on
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

  // A holiday on a weekend whose day off has moved: it's still that day
  function dayOf(dateKey) {
    const r = region();
    if (r === "off") return null;
    const days = window.BANK_HOLIDAYS_DATA && window.BANK_HOLIDAYS_DATA.days && window.BANK_HOLIDAYS_DATA.days[r];
    return (days && days[dateKey]) || null;
  }
  // "Monday 28th"
  function dayOffText(key) {
    const [y, m, d] = String(key).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }

  // ---- A holiday as an event (to open, count down to, give an icon) ----------
  const extrasOf = (id) => ((((window.boardSettings || {}).eventExtras) || {})[id]) || null;
  function eventFor(dateKey) {
    const bank = on(dateKey);
    const day = bank ? null : dayOf(dateKey);
    if (!bank && !day) return null;
    const id = `bh-${dateKey}`;
    const x = extrasOf(id) || {};
    const [y, m, d] = dateKey.split("-").map(Number);
    return {
      id, title: bank || day.name, date: dateKey, day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(y, m - 1, d).getDay()],
      time: "", duration: "All day", repeat: "none", member: "Family", source: "holiday",
      icon: x.icon || "🎉", countdown: !!x.countdown,
      description: bank ? (/^Day off for /.test(bank) ? "A bank holiday: the day off, as the holiday is at a weekend." : "A bank holiday.") : `Not a bank holiday this year: the day off is ${dayOffText(day.dayOff)}.`
    };
  }
  // Holidays someone's switched a countdown on for (still to come)
  function countdownEvents() {
    const today = typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(new Date()) : "";
    return Object.entries(((window.boardSettings || {}).eventExtras) || {})
      .filter(([id, x]) => /^bh-\d{4}-\d{2}-\d{2}$/.test(id) && x && x.countdown && id.slice(3) >= today)
      .map(([id]) => eventFor(id.slice(3))).filter(Boolean);
  }
  // Tapping a chip opens it (before the day's own tap, which would add an event)
  document.addEventListener("click", (e) => {
    const chip = e.target.closest && e.target.closest("[data-holiday-date]");
    if (!chip) return;
    const evt = eventFor(chip.getAttribute("data-holiday-date"));
    if (!evt || typeof window.openEventQuickView !== "function") return;
    e.preventDefault();
    e.stopPropagation();
    window.openEventQuickView(evt, evt.date);
  }, true);
  document.addEventListener("keydown", (e) => {
    if ((e.key !== "Enter" && e.key !== " ") || !e.target.closest || !e.target.closest("[data-holiday-date]")) return;
    e.preventDefault();
    e.target.closest("[data-holiday-date]").click();
  });

  // The chip, in the shape each calendar view uses for the day's dinner
  function chipHtml(dateKey, variant = "box") {
    const bank = on(dateKey);
    const day = bank ? null : dayOf(dateKey);
    if (!bank && !day) return "";
    const name = bank || day.name;
    const icon = esc((extrasOf(`bh-${dateKey}`) || {}).icon || "🎉");
    const tap = `data-holiday-date="${esc(dateKey)}" role="button" tabindex="0"`;
    const title = bank ? `Bank holiday: ${name}` : `${name} (the bank holiday is ${dayOffText(day.dayOff)})`;
    const label = bank ? "Bank holiday" : "Holiday";
    if (variant === "month") return `<div class="bank-holiday-chip is-month" ${tap} title="${esc(title)}"><span aria-hidden="true">${icon}</span><span class="bank-holiday-name">${esc(name)}</span></div>`;
    if (variant === "banner") return `<div class="bank-holiday-chip is-banner" ${tap} title="${esc(title)}"><span class="bank-holiday-icon" aria-hidden="true">${icon}</span><span class="bank-holiday-text"><span class="bank-holiday-label">${label}</span><span class="bank-holiday-name">${esc(name)}</span></span></div>`;
    return `<div class="bank-holiday-chip" ${tap} title="${esc(title)}"><span aria-hidden="true">${icon}</span><span class="bank-holiday-name">${esc(name)}</span></div>`;
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

  window.BankHolidays = { on, dayOf, chipHtml, eventFor, countdownEvents, region, renderSettings, REGIONS };
})();
