// ============================================================================
// CORE APPLICATION UTILITIES (js/utils.js)
// HTML escaping, Date keys, Color palettes, Toast notifications
// ============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return ""; // 0 shows as "0"
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

// An image address that's safe to put in src="": our own data: images or https links only
function safeImageUrl(url) {
  const u = String(url || "").trim();
  // https, a photo stored in the page itself, or one of harmonee's own (images/…)
  return /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);base64,|images\/[\w\-\/]+\.(jpe?g|png|webp)$)/i.test(u) ? u : "";
}
window.safeImageUrl = safeImageUrl;

function getLocalDateKey(date) {
  if (!date) date = new Date();
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
window.getLocalDateKey = getLocalDateKey;

function getIsoWeekKey(d = new Date()) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
window.getIsoWeekKey = getIsoWeekKey;

function getTodayDayName() {
  const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return map[new Date().getDay()];
}
window.getTodayDayName = getTodayDayName;

function normalizeFamilyMemberName(name) {
  if (!name) return "";
  const s = String(name).trim();
  if (s.toLowerCase() === "steve") return "Steven";
  const match = (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).find(m => m.toLowerCase() === s.toLowerCase());
  return match || s;
}
window.normalizeFamilyMemberName = normalizeFamilyMemberName;

function getMemberColor(idx) {
  const memberName = ((window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"])[idx]) ? familyMembers[idx] : null;
  const pal = getMemberPalette(memberName || idx);
  return {
    bg: pal.primary,
    border: pal.border,
    solid: pal.primary,
    pastel: pal.lightBg,
    text: pal.text
  };
}
window.getMemberColor = getMemberColor;

function showCalendarToast(message) {
  let toast = document.getElementById("calendar-drag-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "calendar-drag-toast";
    toast.className = "calendar-drag-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2500);
}
window.showCalendarToast = showCalendarToast;

// Determines if an event should be rendered on a specific calendar date/day
function isEventOnDate(e, targetDateStr, dayName, targetDate) {
  if (!e) return false;
  const repeat = (e.repeat || "none").toLowerCase();
  const eDateStr = e.date ? getLocalDateKey(e.date) : null;
  // One date of a repeating event moved somewhere else (js/calendar-drag.js)
  if (Array.isArray(e.skipDates) && targetDateStr && e.skipDates.includes(targetDateStr)) return false;

  // 1. One-off (Does not repeat) - strictly matches the specific date
  if (repeat === "none" || repeat === "one-off") {
    if (eDateStr) {
      return eDateStr === targetDateStr;
    }
    // Fallback for legacy events created before explicit date picker
    return e.day === dayName;
  }

  // 2. Daily
  if (repeat === "daily") {
    if (eDateStr && targetDateStr < eDateStr) return false;
    return true;
  }

  // 3. Weekdays
  if (repeat === "weekdays") {
    if (eDateStr && targetDateStr < eDateStr) return false;
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(dayName);
  }

  // 4. Weekly or Custom
  if (repeat === "weekly" || repeat === "custom") {
    if (eDateStr && targetDateStr < eDateStr) return false;
    return e.day === dayName;
  }

  // 5. Monthly
  if (repeat === "monthly") {
    if (eDateStr) {
      if (targetDateStr < eDateStr) return false;
      const parts = eDateStr.split("-").map(Number);
      if (!targetDate) return true;
      // The 29th–31st fall on the last day of shorter months
      const monthLen = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      return targetDate.getDate() === Math.min(parts[2], monthLen);
    }
    return e.day === dayName;
  }

  // 6. Annually
  if (repeat === "annually") {
    if (eDateStr) {
      if (targetDateStr < eDateStr) return false;
      const parts = eDateStr.split("-").map(Number);
      if (!targetDate) return true;
      if (targetDate.getMonth() !== parts[1] - 1) return false;
      // 29 February shows on the 28th in years without one
      const monthLen = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      return targetDate.getDate() === Math.min(parts[2], monthLen);
    }
    return e.day === dayName;
  }

  return e.day === dayName;
}
window.isEventOnDate = isEventOnDate;

// Universal Helper: Categorize task into routine slot (Morning, Afternoon, Evening) or standard Chore
function getTaskRoutineInfo(task) {
  if (!task) return { order: 3, label: "" };
  if (task.routineSlot === "morning") return { order: 1, label: "☀️ Morning" };
  if (task.routineSlot === "afternoon") return { order: 2, label: "⛅ Afternoon" };
  if (task.routineSlot === "evening") return { order: 4, label: "🌙 Evening" };
  if (task.routineSlot === "anytime") return { order: 5, label: "🕑 Anytime" };

  // No slot set: guess from whole words in the title or category that really
  // mean a time of day. Never parts of words: "Change the bedsheets" is any
  // time, not Evening, and "Ava Bedroom" isn't bedtime.
  const text = `${task.title || ""} ${task.category || task.taskType || ""}`;
  const slot = guessRoutineSlotFromText(text);
  if (slot === "morning") return { order: 1, label: "☀️ Morning" };
  if (slot === "afternoon") return { order: 2, label: "⛅ Afternoon" };
  if (slot === "evening") return { order: 4, label: "🌙 Evening" };
  return { order: 3, label: "" };
}
const ROUTINE_WORDS = {
  morning: /\b(morning|mornings|before school)\b|\(am\)/i,
  afternoon: /\b(afternoon|afternoons|after school)\b/i,
  evening: /\b(evening|evenings|night|nights|tonight|nighttime|bedtime|bed time|before bed|after dinner)\b|\(pm\)/i
};
function guessRoutineSlotFromText(text) {
  const s = String(text || "");
  return ["morning", "afternoon", "evening"].find(k => ROUTINE_WORDS[k].test(s)) || null;
}
window.getTaskRoutineInfo = getTaskRoutineInfo;

// Universal Chore Icon / Emoji Detector
function detectEmojiForChore(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("plant") || t.includes("water") || t.includes("flower") || t.includes("garden") || t.includes("lawn") || t.includes("mow") || t.includes("weed")) return "🪴";
  if (t.includes("dish") || t.includes("plate") || t.includes("cutlery") || t.includes("sink")) return "🍽️";
  if (t.includes("cat") || t.includes("litter") || t.includes("kitten") || t.includes("feline")) return "🐱";
  if (t.includes("dog") || t.includes("puppy") || t.includes("walk") || t.includes("pooch")) return "🐕";
  if (t.includes("bin") || t.includes("rubbish") || t.includes("trash") || t.includes("dump") || t.includes("refuse")) return "🗑️";
  if (t.includes("recyc")) return "♻️";
  if (t.includes("laundry") || t.includes("wash") || t.includes("clothes") || t.includes("uniform") || t.includes("iron") || t.includes("fold") || t.includes("dry")) return "🧺";
  if (t.includes("hoover") || t.includes("vacuum") || t.includes("sweep") || t.includes("mop") || t.includes("brush") || t.includes("floor") || t.includes("rug") || t.includes("carpet")) return "🧹";
  if (t.includes("sponge") || t.includes("wipe") || t.includes("scrub") || t.includes("surface") || t.includes("bleach") || t.includes("clean") || t.includes("wash up")) return "🧽";
  if (t.includes("dust")) return "🪶";
  if (t.includes("window") || t.includes("glass") || t.includes("mirror")) return "🪟";
  if (t.includes("bed") || t.includes("sheet") || t.includes("linen") || t.includes("duvet") || t.includes("pillow") || t.includes("airing cupboard")) return "🛏️";
  if (t.includes("bath") || t.includes("toilet") || t.includes("shower") || t.includes("loo")) return "🛁";
  if (t.includes("cook") || t.includes("dinner") || t.includes("lunch") || t.includes("breakfast") || t.includes("meal") || t.includes("bake")) return "🍳";
  if (t.includes("shop") || t.includes("grocer") || t.includes("market") || t.includes("store")) return "🛒";
  if (t.includes("diy") || t.includes("fix") || t.includes("repair") || t.includes("screw") || t.includes("build") || t.includes("shelf") || t.includes("paint") || t.includes("drill")) return "🔨";
  if (t.includes("tidy") || t.includes("sort") || t.includes("organis") || t.includes("purge") || t.includes("box") || t.includes("cupboard")) return "📦";
  if (t.includes("car") || t.includes("van") || t.includes("garage")) return "🚗";
  return null;
}
window.detectEmojiForChore = detectEmojiForChore;

// A chore's assignedTo can be one name ("Ava"), a comma list ("Ava, Dara"),
// an array (["Ava", "Dara"], which the Tasks panel saves for shared chores) or
// empty. Always go through this instead of treating it as a string.
// What the shared pool is called on screen. Tasks still store "Up for grabs"
// (so existing boards keep working); this is only the label people see.
// As a choice of person it's "Anyone"; the bigger jobs nobody has taken are
// "Big jobs" (the button and panel, js/grabs-panel.js), and the small daily
// ones are Quick grabs (js/quick-grabs.js).
const GRAB_LABEL = "Anyone";
window.GRAB_LABEL = GRAB_LABEL;
const BIG_JOBS_LABEL = "Big jobs";
window.BIG_JOBS_LABEL = BIG_JOBS_LABEL;
function displayMemberName(name) {
  return /^up for grabs$/i.test(String(name || "").trim()) ? GRAB_LABEL : name;
}
window.displayMemberName = displayMemberName;

// What a job is worth: the points its card shows and its panel sets
// (task.value, 0 to 10; 0 is a job worth no points, like Make your bed,
// from Steven 11 Nov). Older jobs may only have rewardValue; failing both,
// 1. On a pocket-money board 10 points are £1.00, as the cards show. Used
// for the cards, scores, the podium, rewards and the tick pop-up, so they
// all agree.
function taskPoints(task) {
  const has = task && task.value !== undefined && task.value !== null && task.value !== "";
  const v = Number(has ? task.value : NaN);
  if (v >= 0) return v;
  const r = Number(task && task.rewardValue);
  if (r > 0) return r;
  return 1;
}
function taskReward(task, isMoney = (window.boardSettings || {}).gameMode === "money") {
  const p = taskPoints(task);
  return isMoney ? Math.round(p * 10) / 100 : p;
}
window.taskPoints = taskPoints;
window.taskReward = taskReward;

// The one person picker, used wherever someone is chosen (an event's "Who's
// it for", a chore's "Who's doing it", who's cooking, who did it, handing out
// a job, a reward goal): an empty dashed circle with the person's initial
// that fills with their colour and a tick when picked, name underneath.
// Styles: css/tasks.css ("Who's doing it" picker). Put pills in a
// .drawer-profiles-pills-row. `value`, `label` and `initial` are escaped here;
// `attrs` is raw (build it with escapeHtml).
const PERSON_PILL_TICK = `<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
// face: raw HTML drawn instead of the initial (a buddy's drawing)
function personPillHtml({ label, initial, color, active = false, attrs = "", extraClass = "", ariaLabel = "", face = "" }) {
  return `<button type="button" class="drawer-profile-pill${extraClass ? ` ${extraClass}` : ""}${active ? " active" : ""}" ${attrs} aria-pressed="${active ? "true" : "false"}"${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ""} style="--profile-color: ${escapeHtml(color || "#64748b")};">
    <span class="drawer-profile-avatar${face ? " is-buddy" : ""}">${face || escapeHtml(initial || "")}${PERSON_PILL_TICK}</span>
    <span class="drawer-profile-name">${escapeHtml(label || "")}</span>
  </button>`;
}
window.personPillHtml = personPillHtml;

// A family member's pill: their initial and colour. opts.buddy: their buddy
// (the robot, the cat) instead of the initial, if they've picked one
function memberPillHtml(name, opts = {}) {
  const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#64748b" };
  const { buddy, ...rest } = opts;
  const B = buddy ? window.Buddies : null;
  const id = B && B.getMemberBuddy ? B.getMemberBuddy(name) : null;
  const face = id && B.svgFor ? B.svgFor(id) : "";
  return personPillHtml({ label: displayMemberName(name), initial: String(name || "?").charAt(0).toUpperCase(), color: pal.primary, face, ...rest });
}
window.memberPillHtml = memberPillHtml;

function getAssigneeNames(assignedTo) {
  if (!assignedTo) return [];
  const raw = Array.isArray(assignedTo) ? assignedTo : (typeof assignedTo === "string" ? assignedTo.split(",") : []);
  return raw.map(m => String(m).trim()).filter(Boolean);
}
window.getAssigneeNames = getAssigneeNames;

// "Ava", "Ava & Dara", "Ava, Dara & Sorcha", or the fallback when nobody's named
function formatAssigneeNames(assignedTo, fallback = "Anyone") {
  const names = getAssigneeNames(assignedTo);
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
window.formatAssigneeNames = formatAssigneeNames;

// Each board keeps its own saved copy of meals, events, lists, recipes and
// the sticky note on this device. Turnbull keeps the original key names so
// existing devices don't lose their saved copy; other boards get a suffix.
// (Same rule app.js uses for harmonee_settings / harmonee_tasks.)
function getStorageBoardId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const b = (params.get("board") || params.get("b") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (b) return b;
    return localStorage.getItem("harmonee_active_board_id") || localStorage.getItem("chore_active_board_id") || "turnbull";
  } catch (e) {
    return "turnbull";
  }
}
// The board a save should go to, or null when there's no real board yet (a
// new visitor before setup gets "turnbull" only as a stand-in): saving must
// then be skipped, never sent to the Turnbull board.
function getSaveBoardId() {
  if (window.__harmoneeNoBoard) return null;
  const id = window.currentBoardId;
  return (typeof id === "string" && id) ? id : null;
}
window.getSaveBoardId = getSaveBoardId;

function boardCacheKey(base) {
  const id = getStorageBoardId();
  return id === "turnbull" ? base : `${base}__${id}`;
}
window.boardCacheKey = boardCacheKey;


// Touch screen without a mouse (tablets, phones): typing means the
// on-screen keyboard, which can cover half the screen, so we don't open it
// unless someone taps a text box.
function isTouchScreen() {
  try { return window.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch (e) { return false; }
}
window.isTouchScreen = isTouchScreen;

// Press-and-hold on a tablet: Chrome opens its own page menu (Back, Reload,
// Share...) if a drag starts a moment too late, interrupting the drag. The app
// handles holds itself (drag chores, drag on the calendar), so that menu is
// switched off everywhere except text boxes and links, where it's useful.
document.addEventListener("contextmenu", (e) => {
  const t = e.target;
  if (t && t.closest && t.closest("input, textarea, select, [contenteditable='true'], a[href]")) return;
  e.preventDefault();
}, true);

// How an event is drawn on a given day (returns a copy; the saved event is
// never changed):
// - Birthdays with a year born show the age: "Ava's birthday · turns 10".
// - Events switched to All day are drawn in the all-day row. The panel saves
//   them with "All Day" as the length but keeps a start time, and the views
//   decide by start time, so all-day events used to appear at e.g. 10:30.
function eventForDay(e, dateObj) {
  if (!e || typeof e !== "object") return e;
  let out = e;
  const allDayByLength = /all\s*day/i.test(e.duration || "");
  const timeSaysAllDay = !e.time || /all\s*day/i.test(e.time);
  if (allDayByLength && !timeSaysAllDay) out = Object.assign({}, out, { time: "All Day" });
  if (e.birthday && e.bornYear && dateObj instanceof Date) {
    const age = dateObj.getFullYear() - Number(e.bornYear);
    if (age >= 1 && age <= 130) out = Object.assign({}, out, { title: `${e.title} · turns ${age}` });
  }
  return out;
}
window.eventForDay = eventForDay;

// The build shown at the bottom of Settings ("harmonee · build 3fa9c1e · 8 Nov 2026, 23:40")
(function showBuildInSettings() {
  const fill = () => {
    const el = document.getElementById("settings-build");
    const b = window.HARMONEE_BUILD;
    if (!el || !b) return;
    let when = "";
    const m = String(b.builtAt || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      when = `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${m[4]}:${m[5]}`;
    }
    el.textContent = `harmonee · build ${b.id}${when ? ` · ${when}` : ""}`;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
})();

// A dark pill along the bottom with an icon, a line or two, and one button:
//   showActionToast({ icon: "📅", title: "Event added", text: "Dentist · Tue 10 Nov, 4:30pm",
//                     action: { label: "Edit", onClick: () => … }, ms: 6000 })
// Long text is cut with "…" so it fits a phone. Same look as showCalendarToast.
function showActionToast({ icon = "", title = "", text = "", action = null, ms = 6000 } = {}) {
  let toast = document.getElementById("hm-action-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "hm-action-toast";
    toast.className = "hm-action-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  const hide = () => { toast.classList.remove("is-visible"); clearTimeout(toast._timer); };
  // One pill at a time: tuck away a plain toast that's in the same spot
  const plain = document.getElementById("calendar-drag-toast");
  if (plain) plain.classList.remove("is-visible");
  toast.innerHTML = `
    ${icon ? `<span class="hm-action-toast-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : ""}
    <span class="hm-action-toast-words">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
      ${text ? `<span>${escapeHtml(text)}</span>` : ""}
    </span>
    ${action && action.label ? `<button type="button" class="hm-action-toast-btn">${escapeHtml(action.label)}</button>` : ""}`;
  const btn = toast.querySelector(".hm-action-toast-btn");
  if (btn) btn.onclick = () => { hide(); if (typeof action.onClick === "function") action.onClick(); };
  // Restart the slide-in if one is already showing
  toast.classList.remove("is-visible"); void toast.offsetWidth; toast.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(hide, ms);
}
window.showActionToast = showActionToast;

// The favourite heart: one rounded, cartoony shape, the same size liked or
// not (the ♥ / ♡ characters came out at different sizes). Filled when on.
function heartIcon(on) {
  const d = "M12 20.6c-.3 0-.6-.1-.8-.3C8.4 18 3 13.9 3 8.9 3 6 5.3 3.8 8.1 3.8c1.6 0 3 .8 3.9 2 .9-1.2 2.3-2 3.9-2C18.7 3.8 21 6 21 8.9c0 5-5.4 9.1-8.2 11.4-.2.2-.5.3-.8.3z";
  return `<svg class="heart-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${on ? 1 : 2}" stroke-linejoin="round"/></svg>`;
}
window.heartIcon = heartIcon;
