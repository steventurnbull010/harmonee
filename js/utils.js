// ============================================================================
// CORE APPLICATION UTILITIES (js/utils.js)
// HTML escaping, Date keys, Color palettes, Toast notifications
// ============================================================================

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

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
      return targetDate ? targetDate.getDate() === parts[2] : true;
    }
    return e.day === dayName;
  }

  // 6. Annually
  if (repeat === "annually") {
    if (eDateStr) {
      if (targetDateStr < eDateStr) return false;
      const parts = eDateStr.split("-").map(Number);
      return targetDate ? (targetDate.getMonth() === (parts[1] - 1) && targetDate.getDate() === parts[2]) : true;
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

  const t = (task.title || "").toLowerCase();
  const cat = (task.category || task.taskType || "").toLowerCase();
  if (t.includes("(morning)") || t.includes("morning") || cat.includes("morning")) {
    return { order: 1, label: "☀️ Morning" };
  }
  if (t.includes("(afternoon)") || t.includes("afternoon") || cat.includes("afternoon")) {
    return { order: 2, label: "⛅ Afternoon" };
  }
  if (t.includes("(evening)") || t.includes("evening") || t.includes("dinner") || t.includes("bed") || t.includes("night") || cat.includes("evening")) {
    return { order: 4, label: "🌙 Evening" };
  }
  return { order: 3, label: "" };
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
