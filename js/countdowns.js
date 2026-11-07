// ============================================================================
// COUNTDOWNS (js/countdowns.js)
// "🎄 Christmas · 47 sleeps" next to the weather at the top of every page.
// Shows events switched to "Count down to it" (up to a year ahead) and
// birthdays (in the month before). The soonest comes first; wide screens show
// two. Tapping one opens the event. On a birthday the board does one burst
// of confetti the first time it's opened that day.
// ============================================================================
(function () {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const COUNTDOWN_DAYS = 400;  // switched-on countdowns: a bit over a year
  const BIRTHDAY_DAYS = 31;    // birthdays: the month before

  function nextOccurrence(evt, today, maxDays) {
    if (typeof window.isEventOnDate !== "function") return null;
    for (let i = 0; i <= maxDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (window.isEventOnDate(evt, window.getLocalDateKey(d), DAY_NAMES[d.getDay()], d)) return { date: d, days: i };
    }
    return null;
  }

  function upcoming() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = [];
    (window.familyEvents || []).forEach(evt => {
      if (!evt || typeof evt !== "object" || !(evt.countdown || evt.birthday)) return;
      const next = nextOccurrence(evt, today, evt.countdown ? COUNTDOWN_DAYS : BIRTHDAY_DAYS);
      if (next) list.push({ evt, ...next });
    });
    return list.sort((a, b) => a.days - b.days);
  }
  window.getUpcomingCountdowns = upcoming;

  const sleepsText = (days) => days === 0 ? "today! 🎉" : days === 1 ? "1 sleep" : `${days} sleeps`;

  function chipHtml(item) {
    const e = item.evt;
    const title = String(e.title || "Event");
    const label = `${title}: ${item.days === 0 ? "today" : item.days === 1 ? "1 sleep to go" : `${item.days} sleeps to go`}`;
    return `<button type="button" class="header-countdown-chip${item.days === 0 ? " is-today" : ""}" data-event-id="${escapeHtml(String(e.id))}" data-date="${window.getLocalDateKey(item.date)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="header-countdown-icon" aria-hidden="true">${escapeHtml(e.icon || (e.birthday ? "🎂" : "⏳"))}</span>
      <span class="header-countdown-title">${escapeHtml(title)}</span>
      <span class="header-countdown-sleeps">${escapeHtml(sleepsText(item.days))}</span>
    </button>`;
  }

  let lastHtml = null;
  function refreshCountdowns() {
    const items = upcoming().slice(0, 2);
    const html = items.map(chipHtml).join("");
    if (html !== lastHtml) {
      lastHtml = html;
      document.querySelectorAll(".calendar-header-left").forEach(left => {
        let wrap = left.querySelector(".header-countdowns");
        if (!wrap) {
          wrap = document.createElement("span");
          wrap.className = "header-countdowns";
          left.appendChild(wrap);
        }
        wrap.innerHTML = html;
      });
    }
    birthdayConfetti(items);
  }
  window.refreshCountdowns = refreshCountdowns;

  function birthdayConfetti(items) {
    if (!items.some(i => i.days === 0 && i.evt.birthday)) return;
    const key = `harmonee_birthday_confetti_${window.getLocalDateKey(new Date())}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch (e) { return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTimeout(() => { if (typeof window.triggerConfettiBurst === "function") window.triggerConfettiBurst(); }, 1200);
  }

  // Tap a chip: open that event on the day it's counting down to
  document.addEventListener("click", (e) => {
    const chip = e.target.closest && e.target.closest(".header-countdown-chip");
    if (!chip) return;
    const evt = (window.familyEvents || []).find(x => x && String(x.id) === chip.dataset.eventId);
    if (evt && typeof window.openEventQuickView === "function") {

      window.openEventQuickView(evt, chip.dataset.date);
    }
  });

  // Events arrive from Firestore after load and the day rolls over at
  // midnight, so check every 30 seconds (it only redraws when something changed)
  const start = () => { refreshCountdowns(); setInterval(refreshCountdowns, 30000); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 800));
  else setTimeout(start, 800);
})();
