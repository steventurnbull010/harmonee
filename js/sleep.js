
function toggleSleepTheme() {
  let activeTheme = localStorage.getItem("harmonee_theme") || localStorage.getItem("chore_theme") || "light";
  activeTheme = activeTheme === "dark" ? "light" : "dark";
  localStorage.setItem("harmonee_theme", activeTheme);
  if (typeof applyTheme === "function") {
    applyTheme(activeTheme);
  } else {
    document.body.classList.toggle("theme-dark", activeTheme === "dark");
  }
  if (typeof sfx !== "undefined" && sfx && sfx.playUndoPop) sfx.playUndoPop();

  const sleepIcon = document.getElementById("sidebar-sleep-icon");
  if (sleepIcon) {
    sleepIcon.innerHTML = activeTheme === "dark"
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}
window.toggleSleepTheme = toggleSleepTheme;

// State
let sleepScreenTemporaryWakeUntil = 0;
// The night clock only comes on once nobody has touched the screen for 2
// minutes. Before, a tap kept it away for just 60 seconds, so it came down
// on whoever was using the board at night (half way through adding a recipe
// on a phone). The kitchen tablet, untouched at night, still dims as before.
const SLEEP_IDLE_MS = 2 * 60 * 1000;
let lastScreenActivityAt = Date.now();
["pointerdown", "keydown", "input", "change", "wheel", "touchmove"].forEach((t) =>
  document.addEventListener(t, () => { lastScreenActivityAt = Date.now(); }, { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => { if (!document.hidden) lastScreenActivityAt = Date.now(); });
let isSleepScreenActive = false;
window.isSleepScreenActive = isSleepScreenActive;

// ============================================================================
// AMBIENT SLEEP WINDOW & NIGHT CLOCK (js/sleep.js)
// ============================================================================

function activateAmbientSleepScreen(isPreview = false) {
  const overlay = document.getElementById("ambient-sleep-overlay");
  if (!overlay) return;
  const clockEl = document.getElementById("sleep-screen-clock");
  const dateEl = document.getElementById("sleep-screen-date");
  const weatherEl = document.getElementById("sleep-screen-weather");
  const wakeTextEl = document.getElementById("sleep-screen-wake-text");

  const now = new Date();
  if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dateEl) dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  
  // Weather badge text
  const weatherBadge = document.getElementById("calendar-weather-badge");
  if (weatherEl) {
    if (weatherBadge && typeof weatherBadge.textContent === "string" && weatherBadge.textContent.trim()) {
      weatherEl.textContent = `🌙 ${weatherBadge.textContent.trim()}`;
    } else {
      weatherEl.textContent = ""; // no weather place set: show nothing rather than a guess
    }
  }

  const endStr = (window.boardSettings && window.boardSettings.sleepEndTime || "07:00") || "07:00";
  if (wakeTextEl) {
    wakeTextEl.textContent = isPreview
      ? `Preview Mode • Night Clock Wakes at ${endStr}`
      : `Night Clock Active • Wakes at ${endStr}`;
  }

  overlay.style.display = "flex";
  isSleepScreenActive = true;

  // Single tap on the overlay wakes the screen; it dims again after 2 minutes untouched
  overlay.onclick = (e) => {
    if (e.target && e.target.id === "btn-sleep-manual-wake") return;
    deactivateAmbientSleepScreen();
    sleepScreenTemporaryWakeUntil = Date.now() + 60000;
    if (typeof showCalendarToast === "function") {
      showCalendarToast("☀️ Awake. The night clock comes back after 2 minutes untouched.");
    }
  };

  const btnWake = document.getElementById("btn-sleep-manual-wake");
  if (btnWake) {
    btnWake.onclick = (e) => {
      e.stopPropagation();
      deactivateAmbientSleepScreen();
      // Wake for 8 hours (essentially till next sleep cycle)
      sleepScreenTemporaryWakeUntil = Date.now() + 8 * 3600000;
      if (typeof showCalendarToast === "function") {
        showCalendarToast("☀️ Welcome back! Household board is awake.");
      }
    };
  }
}
window.activateAmbientSleepScreen = activateAmbientSleepScreen;

function deactivateAmbientSleepScreen() {
  const overlay = document.getElementById("ambient-sleep-overlay");
  if (overlay) overlay.style.display = "none";
  isSleepScreenActive = false;
}
window.deactivateAmbientSleepScreen = deactivateAmbientSleepScreen;

function checkScheduledSleepWindow() {
  if ((window.boardSettings && window.boardSettings.sleepScheduleEnabled) === false) {
    if (isSleepScreenActive) deactivateAmbientSleepScreen();
    return;
  }
  if (Date.now() < sleepScreenTemporaryWakeUntil) {
    return;
  }
  // Opened from a shared list link (js/lists.js): they came to add something, not to see the clock
  if (window.__sharedListOpenedAt && Date.now() - window.__sharedListOpenedAt < 30 * 60 * 1000) {
    if (isSleepScreenActive) deactivateAmbientSleepScreen();
    return;
  }

  const now = new Date();
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
  const startHHMM = (window.boardSettings && window.boardSettings.sleepStartTime || "22:00") || "22:00";
  const endHHMM = (window.boardSettings && window.boardSettings.sleepEndTime || "07:00") || "07:00";

  let isBedtime = false;
  if (startHHMM > endHHMM) {
    // Overnight window, e.g. 22:00 to 07:00
    isBedtime = (currentHHMM >= startHHMM || currentHHMM < endHHMM);
  } else {
    // Same day window, e.g. 13:00 to 15:00
    isBedtime = (currentHHMM >= startHHMM && currentHHMM < endHHMM);
  }

  if (isBedtime && !isSleepScreenActive) {
    if (Date.now() - lastScreenActivityAt < SLEEP_IDLE_MS) return; // someone's using it
    activateAmbientSleepScreen(false);
  } else if (!isBedtime && isSleepScreenActive) {
    deactivateAmbientSleepScreen();
    // Morning: back to the page it was on (Today at a glance doesn't open by itself)
    if (typeof showCalendarToast === "function") showCalendarToast("☀️ Good morning! Family board is awake.");
  } else if (isSleepScreenActive) {
    // Keep clock updated live while active
    const clockEl = document.getElementById("sleep-screen-clock");
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
window.checkScheduledSleepWindow = checkScheduledSleepWindow;

function initScheduledSleepWindow() {
  setInterval(checkScheduledSleepWindow, 30000);
  checkScheduledSleepWindow();
}
window.initScheduledSleepWindow = initScheduledSleepWindow;


// The board's settings just arrived or changed (here or on another device):
// check straight away, so a board with the night clock switched off doesn't
// show it at night until the next minute's check
document.addEventListener("harmonee:data", () => { try { checkScheduledSleepWindow(); } catch (e) {} });
