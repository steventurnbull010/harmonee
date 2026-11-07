// ============================================================================
// COUNTDOWNS (js/countdowns.js)
// Beside the weather at the top of every page: the soonest countdown as a
// tile ("3 sleeps" + "🏆 Tom's Lifetime Achievement Award"), and "+2" when
// more are coming up, which opens a "Coming up" list of them all.
// Counts down to events switched to "Count down to it" (up to a year ahead)
// and to birthdays (in the month before). A repeating event only ever counts
// down to its next date, so it takes one place, not one per repeat.
// Tapping a countdown opens the event. On a birthday the board does one burst
// of confetti the first time it's opened that day.
// ============================================================================
(function () {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
    return list.sort((a, b) => a.days - b.days || String(a.evt.title).localeCompare(String(b.evt.title)));
  }
  window.getUpcomingCountdowns = upcoming;

  // The number tile: "3 / SLEEPS", "1 / SLEEP", or "🎉 / TODAY"
  const numTile = (days) => days === 0
    ? `<span class="header-countdown-num" aria-hidden="true"><b>🎉</b><small>Today</small></span>`
    : `<span class="header-countdown-num" aria-hidden="true"><b>${days}</b><small>${days === 1 ? "sleep" : "sleeps"}</small></span>`;
  const spoken = (item) => `${item.evt.title || "Event"}: ${item.days === 0 ? "today" : item.days === 1 ? "1 sleep to go" : `${item.days} sleeps to go`}`;
  const icon = (e) => e.icon || (e.birthday ? "🎂" : "⏳");
  const dataAttrs = (item) => `data-event-id="${escapeHtml(String(item.evt.id))}" data-date="${window.getLocalDateKey(item.date)}"`;

  function tileHtml(item) {
    return `<button type="button" class="header-countdown-chip${item.days === 0 ? " is-today" : ""}" ${dataAttrs(item)} aria-label="${escapeHtml(spoken(item))}" title="${escapeHtml(spoken(item))}">
      ${numTile(item.days)}
      <span class="header-countdown-name"><span class="header-countdown-icon" aria-hidden="true">${escapeHtml(icon(item.evt))}</span><span class="header-countdown-title">${escapeHtml(item.evt.title || "Event")}</span></span>
    </button>`;
  }

  function listHtml(items) {
    return `<p class="countdown-list-head">Coming up</p>` + items.map(item => {
      const d = item.date;
      const when = item.days === 0 ? "Today" : `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      return `<button type="button" class="countdown-list-item" ${dataAttrs(item)} aria-label="${escapeHtml(spoken(item))}">
        ${numTile(item.days)}
        <span class="countdown-list-text">
          <span class="countdown-list-title">${escapeHtml(icon(item.evt))} ${escapeHtml(item.evt.title || "Event")}</span>
          <span class="countdown-list-date">${escapeHtml(when)}</span>
        </span>
      </button>`;
    }).join("");
  }

  let lastHtml = null;
  let lastItems = [];
  function refreshCountdowns() {
    const items = upcoming();
    lastItems = items;
    const more = items.length - 1;
    const html = items.length
      ? tileHtml(items[0]) + (more > 0 ? `<button type="button" class="header-countdown-more" aria-label="${more} more coming up" aria-haspopup="true">+${more}</button>` : "")
      : "";
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
      const pop = document.getElementById("countdown-list-pop");
      if (pop && !pop.hidden) pop.innerHTML = listHtml(items);
    }
    fitTiles();
    birthdayConfetti(items);
  }
  window.refreshCountdowns = refreshCountdowns;

  // When the header is too full to show the name readably (under ~110px and
  // still cut off after wrapping to two lines), the
  // tile goes compact: number and icon only, and tapping it opens the list.
  // Measured rather than set by screen width, because family names and
  // headers differ from page to page.
  function fitTiles() {
    document.querySelectorAll(".header-countdown-chip").forEach(chip => {
      if (!chip.offsetParent) return; // page not showing; fitted when it is
      chip.classList.remove("is-compact");
      // Squeezed = the name box is narrow AND the name still doesn't fit in its
      // two lines (a short name like "Football" in a narrow box is fine)
      const box = chip.querySelector(".header-countdown-name");
      if (!box) return;
      const w = box.getBoundingClientRect().width;
      const cutOff = box.scrollHeight > box.clientHeight + 1;
      if (w < 48 || (w < 110 && cutOff)) chip.classList.add("is-compact");
    });
  }
  window.fitCountdownTiles = fitTiles;
  let fitTimer = null;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitTiles, 150); });
  // Pages are shown by switching display, so fit again when one becomes visible
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-view]")) setTimeout(fitTiles, 120);
  }, true);

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

  // ---- "Coming up" list, opened from +2 --------------------------------------
  function getPop() {
    let pop = document.getElementById("countdown-list-pop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "countdown-list-pop";
      pop.className = "countdown-list-pop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Coming up");
      pop.hidden = true;
      document.body.appendChild(pop);
    }
    return pop;
  }
  function openList(anchor) {
    const pop = getPop();
    pop.innerHTML = listHtml(lastItems);
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    pop.style.top = `${Math.round(r.bottom + 8)}px`;
    pop.style.left = `${Math.round(Math.max(16, Math.min(r.left, window.innerWidth - w - 16)))}px`;
    anchor.setAttribute("aria-expanded", "true");
  }
  function closeList() {
    const pop = document.getElementById("countdown-list-pop");
    if (pop) pop.hidden = true;
    document.querySelectorAll(".header-countdown-more[aria-expanded]").forEach(b => b.removeAttribute("aria-expanded"));
  }

  function openEvent(el) {
    const evt = (window.familyEvents || []).find(x => x && String(x.id) === el.dataset.eventId);
    if (evt && typeof window.openEventQuickView === "function") window.openEventQuickView(evt, el.dataset.date);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const more = t.closest(".header-countdown-more");
    if (more) {
      const pop = document.getElementById("countdown-list-pop");
      if (pop && !pop.hidden) closeList(); else openList(more);
      return;
    }
    // Phones only show the number and icon, so the tile opens the list (with
    // names and dates) instead of jumping straight into the event
    const tile = t.closest(".header-countdown-chip");
    if (tile && (tile.classList.contains("is-compact") || window.matchMedia("(max-width: 600px)").matches)) {
      const pop = document.getElementById("countdown-list-pop");
      if (pop && !pop.hidden) closeList(); else openList(tile);
      return;
    }
    const item = t.closest(".header-countdown-chip, .countdown-list-item");
    if (item) { closeList(); openEvent(item); return; }
    if (!t.closest("#countdown-list-pop")) closeList(); // tap anywhere else
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeList(); });
  window.addEventListener("resize", closeList);
  document.addEventListener("scroll", closeList, true);

  // Events arrive from Firestore after load and the day rolls over at
  // midnight, so check every 30 seconds (it only redraws when something changed)
  const start = () => { refreshCountdowns(); setInterval(refreshCountdowns, 30000); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 800));
  else setTimeout(start, 800);
})();
