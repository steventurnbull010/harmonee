// ============================================================================
// harmonee — CORE APPLICATION LOGIC
// Family Life in Sync: Calendar, Routines, Meals, Lists & Rewards
// Real-time Firestore sync + Local Offline Fallback + Web Audio Chime + Confetti
// ============================================================================

// Firebase Modular SDK CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Preloaded Recipes Bank & Helper Imports
// [Preloaded recipes bank moved to js/meals.js]

// ============================================================================
// 1. INITIAL SEED DATASET
// [Extracted to js/seed-data.js: INITIAL_SEED_TASKS]
const INITIAL_SEED_TASKS = window.INITIAL_SEED_TASKS || [];
// ============================================================================
// BOARD DETECTION & MULTI-TENANCY
// Default board is 'turnbull', matching your active household tasks in 'turnbull_reset_tasks'
// Any other board 'foo' uses 'boards/foo/tasks' in Firestore.
// ============================================================================
function getBoardIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const b = params.get("board") || params.get("b");
  if (b) {
    const cleaned = b.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (cleaned) {
      localStorage.setItem("harmonee_active_board_id", cleaned);
      localStorage.setItem("chore_active_board_id", cleaned);
      return cleaned;
    }
  }

  // Check if visitor previously launched or visited a board
  const saved = localStorage.getItem("harmonee_active_board_id") || localStorage.getItem("chore_active_board_id");
  if (saved) return saved;

  // Turnbull is the safe primary family household board
  localStorage.setItem("harmonee_active_board_id", "turnbull");
  localStorage.setItem("chore_active_board_id", "turnbull");
  return "turnbull";
}

function isFirstTimeVisitor() {
  const params = new URLSearchParams(window.location.search);
  // Only trigger new visitor onboarding if explicitly requested via query parameter
  return params.get("new") === "true" || params.get("onboarding") === "true";
}

const currentBoardId = getBoardIdFromUrl();
const isDefaultTurnbullBoard = currentBoardId === "turnbull";
window.currentBoardId = currentBoardId;
window.isDefaultTurnbullBoard = isDefaultTurnbullBoard;

// Board Settings: Game Mode & Currency
// Mode: "points" (default) or "money"
// Currency: "£", "$", "€"
let boardSettings = window.boardSettings = {
  gameMode: "points",
  currency: "£",
  sleepScheduleEnabled: true,
  sleepStartTime: "22:00",
  sleepEndTime: "07:00"
};

const STORAGE_KEY_SETTINGS = isDefaultTurnbullBoard ? "harmonee_settings" : `harmonee_settings_${currentBoardId}`;
const STORAGE_KEY_LEDGER = isDefaultTurnbullBoard ? "harmonee_weekly_ledger" : `harmonee_weekly_ledger_${currentBoardId}`;

function getIsoWeekKey(d = new Date()) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekCommencingString(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);

  const dayOfMonth = monday.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[monday.getMonth()];

  function getOrdinal(n) {
    if (n >= 11 && n <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  return `Mon ${getOrdinal(dayOfMonth)} ${monthName}`;
}

function getWeekCommencingDateStr(d = new Date()) {
  const str = getWeekCommencingString(d);
  return str.replace(/^Mon\s+/, "");
}

function getWeekCommencingLabel(short = false, d = new Date()) {
  const str = getWeekCommencingDateStr(d);
  return short ? `WC ${str}` : `Week Commencing ${str}`;
}
window.getWeekCommencingDateStr = getWeekCommencingDateStr;
window.getWeekCommencingLabel = getWeekCommencingLabel;

function getDayNameFromDate(d) {
  if (!d) return getTodayDayName();
  try {
    const date = typeof d.toDate === "function" ? d.toDate() : new Date(d);
    if (isNaN(date.getTime())) return getTodayDayName();
    const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return map[date.getDay()];
  } catch (e) {
    return getTodayDayName();
  }
}

function getTodayDayName() {
  const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return map[new Date().getDay()];
}

function getDayOrderIndex(dayName) {
  return WEEK_DAYS_ORDER.indexOf(dayName);
}

function getTodayOrderIndex() {
  const d = new Date().getDay(); // 0 is Sun, 1 is Mon...
  return d === 0 ? 6 : d - 1;
}

function isFutureDayForDaily(dayName, dateStr = null) {
  const today = new Date();
  const todayDateStr = getLocalDateKey(today);

  // If exact date string is known (e.g. from calendar columns)
  if (dateStr) {
    return dateStr > todayDateStr;
  }

  // If day name is known (e.g. from Chores view or modals)
  if (dayName && dayName !== "Daily" && dayName !== "Anyday") {
    const targetIdx = getDayOrderIndex(dayName);
    const todayIdx = getTodayOrderIndex();
    if (targetIdx !== -1) {
      return targetIdx > todayIdx;
    }
  }

  return false;
}
window.isFutureDayForDaily = isFutureDayForDaily;

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

function getDailyTaskStatus(task, dayName) {
  if (task.completedDays && task.completedDays[dayName]) {
    const info = task.completedDays[dayName];
    const completedBy = typeof info === "object" ? info.completedBy : info;
    const completedAt = typeof info === "object" ? info.completedAt : null;
    const completedWeek = typeof info === "object" ? info.completedWeek : null;
    return {
      isDone: true,
      completedBy,
      completedAt,
      completedWeek
    };
  }
  // Fallback for daily task marked done previously without completedDays
  if (task.done && (!task.completedDays || Object.keys(task.completedDays).length === 0)) {
    const compDay = getDayNameFromDate(task.completedAt);
    if (compDay === dayName) {
      return {
        isDone: true,
        completedBy: task.completedBy,
        completedAt: task.completedAt,
        completedWeek: task.completedWeek
      };
    }
  }
  return {
    isDone: false,
    completedBy: null,
    completedAt: null,
    completedWeek: null
  };
}

function loadWeeklyLedger() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEDGER);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveWeeklyLedger(ledger) {
  try {
    localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(ledger));
  } catch (e) {
    console.warn("Failed to save ledger:", e);
  }
}

// Legacy one-time archival migration (safely disabled to protect active tasks)
async function archivePreviousWeekendCompletedTasks() {
  return;
}

// Automatically wipe points and archive weekly totals on Sunday at midnight (start of new week)
async function checkWeeklySundayReset() {
  const currentWeek = getIsoWeekKey();
  const lastActiveWeek = localStorage.getItem(`last_active_week_${currentBoardId}`);

  // If a new week has started, snapshot the previous week's totals before clearing
  if (lastActiveWeek && lastActiveWeek !== currentWeek) {
    const isMoney = boardSettings.gameMode === "money";
    const currency = boardSettings.currency || "£";

    // Calculate last week's member totals from completed tasks
    const totals = {};
    familyMembers.forEach(m => totals[m] = 0);

    currentTasks.forEach(task => {
      if (task.done && task.completedBy) {
        const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
          ? task.rewardValue 
          : (isMoney ? 1.00 : 1);

        if (task.completedBy === "Team Effort") {
          familyMembers.forEach(m => totals[m] += rewardVal);
        } else if (Array.isArray(task.completedBy)) {
          task.completedBy.forEach(member => {
            if (totals[member] !== undefined) totals[member] += rewardVal;
          });
        } else if (typeof task.completedBy === "string") {
          const members = task.completedBy.split(",").map(s => s.trim());
          members.forEach(member => {
            if (totals[member] !== undefined) totals[member] += rewardVal;
          });
        }
      }
    });

    // Bank last week's points on the board so reward goals keep them after
    // the chores reset. Same scoring as the podium, including daily routines.
    // Bank every finished week the chores still hold ticks for, not just
    // this device's "last active" week: a phone last opened weeks ago would
    // otherwise bank an old, empty week and then clear this week's ticks.
    if (typeof window.computeMemberScores === "function" && typeof window.bankRewardWeek === "function") {
      const finishedWeeks = new Set([lastActiveWeek]);
      currentTasks.forEach(t => {
        if (t.completedWeek && t.completedWeek !== currentWeek) finishedWeeks.add(t.completedWeek);
        Object.values(t.completedDays || {}).forEach(rec => {
          if (rec && typeof rec === "object" && rec.completedWeek && rec.completedWeek !== currentWeek) finishedWeeks.add(rec.completedWeek);
        });
      });
      finishedWeeks.forEach(week => {
        const scored = window.computeMemberScores(week);
        const banked = {};
        Object.entries(scored).forEach(([m, d]) => { banked[m] = d.score; });
        window.bankRewardWeek(week, banked);
      });
    }

    const hasAnyPoints = Object.values(totals).some(val => val > 0);
    if (hasAnyPoints) {
      const ledger = loadWeeklyLedger();
      ledger.unshift({
        weekKey: lastActiveWeek,
        archivedAt: new Date().toISOString(),
        gameMode: boardSettings.gameMode,
        currency: boardSettings.currency || "£",
        totals
      });
      // Keep last 12 weeks of historical records
      saveWeeklyLedger(ledger.slice(0, 12));
    }

    // Option A: On Sunday midnight, archive all completed one-off chores
    // and reset daily routine chores for the clean new week
    if (db) {
      try {
        const batch = writeBatch(db);
        currentTasks.forEach(t => {
          const isRecurringDaily = t.day === "Daily" || t.taskType === "Daily Task" || t.repeat === "daily";
          const isWeekly = t.repeat === "weekly";
          const docRef = getTaskDocRef(t.id);
          if (isRecurringDaily) {
            batch.update(docRef, {
              done: false,
              completedBy: null,
              completedAt: null,
              completedWeek: null,
              completedDays: {}
            });
          } else if (isWeekly) {
            batch.update(docRef, {
              done: false,
              completedBy: null,
              completedAt: null,
              completedWeek: null
            });
          } else if (t.done) {
            batch.update(docRef, {
              archived: true,
              archivedAt: new Date().toISOString(),
              archivedWeek: lastActiveWeek
            });
          }
        });
        await batch.commit();
      } catch (err) {
        console.warn("Failed to reset/archive tasks on Firestore:", err);
      }
    }

    currentTasks = currentTasks
      .map(t => {
        const isRecurringDaily = t.day === "Daily" || t.taskType === "Daily Task" || t.repeat === "daily";
        const isWeekly = t.repeat === "weekly";
        if (isRecurringDaily) {
          return { ...t, done: false, completedBy: null, completedAt: null, completedWeek: null, completedDays: {} };
        } else if (isWeekly) {
          return { ...t, done: false, completedBy: null, completedAt: null, completedWeek: null };
        }
        return t;
      })
      .filter(t => {
        const isRecurringDaily = t.day === "Daily" || t.taskType === "Daily Task";
        return isRecurringDaily || !t.done;
      });

    saveLocalTasks(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  }

  localStorage.setItem(`last_active_week_${currentBoardId}`, currentWeek);
}

function loadLocalBoardSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS) || localStorage.getItem(isDefaultTurnbullBoard ? "chore_settings" : `chore_settings_${currentBoardId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        boardSettings = { ...boardSettings, ...parsed }; window.boardSettings = boardSettings;
      }
    }
  } catch (e) {
    console.warn("Failed to load board settings:", e);
  }
}

function saveLocalBoardSettings(settings) {
  boardSettings = { ...boardSettings, ...settings }; window.boardSettings = boardSettings;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(boardSettings));
  } catch (e) {
    console.warn("Failed to save board settings:", e);
  }
}

// Default seed list for fresh new boards
const STARTER_GENERIC_TASKS = [
  {
    id: "starter-01",
    title: "Empty & Fill Dishwasher",
    day: "Daily",
    taskType: "Daily Task",
    room: "Kitchen",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Empty clean dishes into cupboards and load sink plates/mugs into dishwasher.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 1
  },
  {
    id: "starter-02",
    title: "Feed Pets & Fresh Water",
    day: "Daily",
    taskType: "Daily Task",
    room: "Kitchen",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Refill food bowls and replace fresh water.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 2
  },
  {
    id: "starter-03",
    title: "Make Beds & Straighten Duvets",
    day: "Daily",
    taskType: "Daily Task",
    room: "Bedrooms",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Straighten sheets, shake pillows, and make beds.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 3
  },
  {
    id: "starter-04",
    title: "Take Bins Out for Collection",
    day: "Friday",
    taskType: "Standard",
    room: "Outside / Driveway",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Wheel recycling and general waste bins to the kerb.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 4
  },
  {
    id: "starter-05",
    title: "Living Room Floor Vacuum",
    day: "Saturday",
    taskType: "Standard",
    room: "Living Room",
    estimatedTime: "20 mins",
    isPriority: false,
    actionNote: "Vacuum rugs, under sofas, and hallway runner.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 5
  }
];

// Dynamic Family Members for active board
let familyMembers = isDefaultTurnbullBoard 
  ? ["Steven", "Sorcha", "Ava", "Dara"]
  : ["Mom", "Dad", "Kid 1", "Kid 2"];
window.familyMembers = familyMembers;

function normalizeFamilyMemberName(name) {
  if (!name) return "";
  const s = String(name).trim();
  if (s.toLowerCase() === "steve") return "Steven";
  const match = familyMembers.find(m => m.toLowerCase() === s.toLowerCase());
  return match || s;
}
window.normalizeFamilyMemberName = normalizeFamilyMemberName;

const STORAGE_KEY_TASKS = isDefaultTurnbullBoard ? "harmonee_tasks" : `harmonee_tasks_${currentBoardId}`;
const STORAGE_KEY_ROSTER = isDefaultTurnbullBoard ? "harmonee_roster" : `harmonee_roster_${currentBoardId}`;
const STORAGE_KEY_CONFIG = "harmonee_firebase_cfg";
const LEGACY_TURNBULL_PROJECT_ID = "ava-turnbull-official";

// Helper collection and document references for multi-tenancy.
// Every household (Turnbull included) lives under boards/{boardId}.
function getTasksCollectionRef() {
  if (!db) return null;
  return collection(db, "boards", currentBoardId, "tasks");
}

function getTaskDocRef(taskId) {
  if (!db) return null;
  return doc(db, "boards", currentBoardId, "tasks", taskId);
}

function getBoardDocRef() {
  if (!db) return null;
  return doc(db, "boards", currentBoardId);
}

// ============================================================================
// 1. SKYLIGHT OFFICIAL 20-COLOR PROFILE SYSTEM
// ============================================================================
// Exact 5x4 grid of profile colors as seen in Skylight Hardware & Mobile app
export const SKYLIGHT_PROFILE_COLORS = [
  // Row 1
  { id: "sky-blue", name: "Sky Blue", solid: "#2b8eea", pastel: "#dbeafe", border: "#93c5fd", text: "#1e3a8a", darkBg: "rgba(43, 142, 234, 0.22)" },
  { id: "coral-pink", name: "Coral Pink", solid: "#f27a6d", pastel: "#ffe4e1", border: "#fca5a5", text: "#7f1d1d", darkBg: "rgba(242, 122, 109, 0.22)" },
  { id: "warm-ochre", name: "Warm Ochre", solid: "#c88e28", pastel: "#fef3c7", border: "#fcd34d", text: "#78350f", darkBg: "rgba(200, 142, 40, 0.22)" },
  { id: "buttercup", name: "Buttercup", solid: "#f0c443", pastel: "#fef9c3", border: "#fde047", text: "#713f12", darkBg: "rgba(240, 196, 67, 0.22)" },
  { id: "seafoam", name: "Seafoam", solid: "#a8d7ce", pastel: "#e6f7f4", border: "#99f6e4", text: "#134e4a", darkBg: "rgba(168, 215, 206, 0.22)" },

  // Row 2
  { id: "vermillion", name: "Vermillion", solid: "#eb4d2b", pastel: "#ffe4de", border: "#fda4af", text: "#881337", darkBg: "rgba(235, 77, 43, 0.22)" },
  { id: "tangerine", name: "Tangerine", solid: "#f47d26", pastel: "#ffedd5", border: "#fdba74", text: "#7c2d12", darkBg: "rgba(244, 125, 38, 0.22)" },
  { id: "amber-orange", name: "Amber Orange", solid: "#f3a72e", pastel: "#fef3c7", border: "#fcd34d", text: "#78350f", darkBg: "rgba(243, 167, 46, 0.22)" },
  { id: "lemon-yellow", name: "Lemon Yellow", solid: "#e5d329", pastel: "#fef08a", border: "#facc15", text: "#713f12", darkBg: "rgba(229, 211, 41, 0.22)" },
  { id: "deep-teal", name: "Deep Teal", solid: "#1a7d7e", pastel: "#ccfbf1", border: "#5eead4", text: "#134e4a", darkBg: "rgba(26, 125, 126, 0.22)" },

  // Row 3
  { id: "emerald", name: "Emerald Green", solid: "#16a05d", pastel: "#d1fae5", border: "#6ee7b7", text: "#064e3b", darkBg: "rgba(22, 160, 93, 0.22)" },
  { id: "spring-green", name: "Spring Green", solid: "#20b86f", pastel: "#dcfce7", border: "#86efac", text: "#14532d", darkBg: "rgba(32, 184, 111, 0.22)" },
  { id: "ice-blue", name: "Ice Blue", solid: "#8ed6e6", pastel: "#e0f2fe", border: "#7dd3fc", text: "#0c4a6e", darkBg: "rgba(142, 214, 230, 0.22)" },
  { id: "cornflower", name: "Cornflower Blue", solid: "#60aee8", pastel: "#e0f2fe", border: "#93c5fd", text: "#1e3a8a", darkBg: "rgba(96, 174, 232, 0.22)" },
  { id: "denim", name: "Soft Denim", solid: "#3a6d8c", pastel: "#e2e8f0", border: "#94a3b8", text: "#0f172a", darkBg: "rgba(58, 109, 140, 0.22)" },

  // Row 4
  { id: "periwinkle", name: "Periwinkle", solid: "#8a8beb", pastel: "#ede9fe", border: "#c4b5fd", text: "#3b0764", darkBg: "rgba(138, 139, 235, 0.22)" },
  { id: "lavender", name: "Lavender", solid: "#a86ae8", pastel: "#f3e8ff", border: "#d8b4fe", text: "#581c87", darkBg: "rgba(168, 106, 232, 0.22)" },
  { id: "petal-pink", name: "Petal Pink", solid: "#e996b8", pastel: "#fce7f3", border: "#fbcfe8", text: "#831843", darkBg: "rgba(233, 150, 184, 0.22)" },
  { id: "slate-grey", name: "Slate Grey", solid: "#9ba5b0", pastel: "#f1f5f9", border: "#cbd5e1", text: "#334155", darkBg: "rgba(155, 165, 176, 0.22)" },
  { id: "charcoal", name: "Charcoal", solid: "#4b5563", pastel: "#e5e7eb", border: "#9ca3af", text: "#111827", darkBg: "rgba(75, 85, 99, 0.22)" }
];

// Default profile color assignments for Turnbull family
const DEFAULT_MEMBER_COLOR_MAP = {
  "steven": "warm-ochre",   // Honey Gold / Mustard
  "steve": "warm-ochre",
  "sorcha": "periwinkle",   // Soft Lavender / Periwinkle
  "ava": "coral-pink",      // Warm Coral / Terracotta
  "dara": "spring-green",   // Fresh Sage / Spring Green
  "family": "buttercup",
  "team effort": "buttercup"
};

// Board member color overrides (persisted to localStorage / Firestore settings)
let memberColorOverrides = {};
try {
  const savedColors = localStorage.getItem("chore_member_colors");
  if (savedColors) memberColorOverrides = JSON.parse(savedColors);
} catch (e) {}

function getSkylightColor(colorIdOrIdx) {
  if (typeof colorIdOrIdx === "string") {
    const found = SKYLIGHT_PROFILE_COLORS.find(c => c.id === colorIdOrIdx || c.solid.toLowerCase() === colorIdOrIdx.toLowerCase());
    if (found) return found;
  }
  const idx = typeof colorIdOrIdx === "number" ? Math.abs(colorIdOrIdx) : 0;
  return SKYLIGHT_PROFILE_COLORS[idx % SKYLIGHT_PROFILE_COLORS.length];
}

// Helper avatar palette: Returns dynamic member palette
function getMemberPalette(name) {
  if (!name) {
    const fColor = getSkylightColor("buttercup");
    return {
      primary: fColor.solid,
      lightBg: fColor.pastel,
      darkBg: fColor.darkBg,
      border: fColor.border,
      text: fColor.text,
      solid: fColor.solid
    };
  }

  const rawKey = String(name).trim().toLowerCase();
  
  // 1. Check direct override (by member name)
  let chosenId = memberColorOverrides[rawKey];

  // 2. Check boardSettings.memberColors
  if (!chosenId && boardSettings && boardSettings.memberColors && boardSettings.memberColors[rawKey]) {
    chosenId = boardSettings.memberColors[rawKey];
  }

  // 3. Check default map
  if (!chosenId) {
    for (const [k, v] of Object.entries(DEFAULT_MEMBER_COLOR_MAP)) {
      if (rawKey.includes(k)) {
        chosenId = v;
        break;
      }
    }
  }

  // 4. Fallback based on familyMembers array index
  if (!chosenId) {
    const idx = familyMembers.findIndex(m => m.toLowerCase() === rawKey);
    const fallbackIds = ["warm-ochre", "periwinkle", "coral-pink", "spring-green", "sky-blue", "tangerine", "deep-teal", "lavender", "petal-pink", "emerald", "cornflower", "lemon-yellow"];
    chosenId = fallbackIds[(idx >= 0 ? idx : 0) % fallbackIds.length];
  }

  const sc = getSkylightColor(chosenId);
  return {
    id: sc.id,
    name: sc.name,
    primary: sc.solid,
    solid: sc.solid,
    lightBg: sc.pastel,
    darkBg: sc.darkBg,
    border: sc.border,
    text: sc.text
  };
}
window.getMemberPalette = getMemberPalette;

function getMemberColor(idx) {
  const memberName = (familyMembers && familyMembers[idx]) ? familyMembers[idx] : null;
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

// ============================================================================
// 2. FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================
// Default live Firebase configuration
export const DEFAULT_FIREBASE_CONFIG = {
  projectId: "harmonee-app",
  appId: "1:344148325793:web:4e6f27fa8e15d5082087e0",
  storageBucket: "harmonee-app.firebasestorage.app",
  apiKey: "AIzaSyCOkZ_BlVEgW8K9paG_L-JLrgtTzfgRzNQ",
  authDomain: "harmonee-app.firebaseapp.com",
  messagingSenderId: "344148325793"
};

let db = null;

// Share Firestore handles with the classic-script domain modules in js/.
// Those files can't see this module's scope or its imports, so they read
// these as globals (window.db is kept in sync in initializeDataSource).
Object.assign(window, {
  db: null,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  writeBatch,
  runTransaction,
  getDoc,
  serverTimestamp,
  DEFAULT_FIREBASE_CONFIG,
  // app.js functions the js/ modules call (hoisted, so safe to share here)
  loadWeeklyMeals,
  getTaskDocRef,
  renderApp,
  showGamifiedCelebration,
  // Tasks page: untick a task, and the pop-up's Delete button
  handleUndoTask,
  openDeleteTaskModal
});

let firestoreUnsubscribe = null;
let firestoreBoardUnsubscribe = null;
let currentTasks = [];
window.currentTasks = currentTasks;
let currentActiveView = "calendar";
let currentCalendarView = window.currentCalendarView || "schedule";
try {
  const savedView = localStorage.getItem("chore_calendar_view");
  if (savedView && ["day", "schedule", "week", "month"].includes(savedView)) {
    currentCalendarView = savedView;
  }
} catch (e) {}
window.currentCalendarView = currentCalendarView;

// Calendar displays events only. Chores live on dedicated Chores board page.
let currentCalendarContentFilter = window.currentCalendarContentFilter || "events";
window.currentCalendarContentFilter = currentCalendarContentFilter;

// Hourly timeline zoom level for Schedule (3-Day) view
// 64px = default (~4-5 hours visible on screen), 40px = zoomed out (~7-8 hours visible on screen)
let scheduleHourHeight = window.scheduleHourHeight || 64;
try {
  const savedHeight = localStorage.getItem("chore_schedule_hour_height");
  if (savedHeight) {
    const parsedH = parseInt(savedHeight, 10);
    if (parsedH >= 38 && parsedH <= 110) scheduleHourHeight = parsedH;
  }
} catch (e) {}
window.scheduleHourHeight = scheduleHourHeight;

let calendarAnchorDate = window.calendarAnchorDate || new Date();
calendarAnchorDate.setHours(0, 0, 0, 0);
window.calendarAnchorDate = calendarAnchorDate;

let currentCalendarWeekOffset = window.currentCalendarWeekOffset || 0;
window.currentCalendarWeekOffset = currentCalendarWeekOffset;
let activeCategoryFilter = "ALL";
let activeAssigneeFilter = "ALL";
const WEEK_DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let taskToClaim = null;
let taskToAssign = null;
let assignModal = null;
let claimModal = null;
let configModal = null;
let taskModal = null;
let deleteModal = null;
let settingsModal = null;
let onboardingModal = null;
let aiModal = null;
// [Extracted to js/seed-data.js: DEFAULT_WEEKLY_MEALS]
const DEFAULT_WEEKLY_MEALS = window.DEFAULT_WEEKLY_MEALS || {};

const CHORE_EMOJI_LIST = [
  // Plants & Gardening
  "🪴", "🌿", "🌱", "🌸", "🌻", "🚜", "🌳", "🍃",
  // Cleaning & Sweeping
  "🧹", "🧽", "🧼", "🫧", "🪣", "🪶", "🪟", "🚿",
  // Bath & Hygiene
  "🛁", "🚽", "🧴", "🪥", "🪞", "🧺", "🛏️", "👔",
  // Kitchen & Dishes
  "🍽️", "🍳", "🥣", "🗑️", "♻️", "☕", "🧑‍🍳", "🍕",
  // Pets & Animals
  "🐱", "🐈", "🐕", "🐶", "🐾", "🐠", "🦜", "🐇",
  // DIY & Maintenance
  "🔨", "🔧", "🪛", "🧰", "💡", "🪜", "🖌️", "📦",
  // Household & Organization
  "🏠", "🛒", "🚗", "🚲", "⭐", "✨", "⏰", "📋"
];

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

let isManualChoreEmoji = false;

function setChoreEmoji(emoji) {
  const em = emoji || "🪴";
  const iconInput = document.getElementById("task-form-icon");
  const emojiDisplay = document.getElementById("task-emoji-display");
  const modalTrophy = document.getElementById("task-modal-icon");
  const paletteGrid = document.getElementById("task-emoji-palette-grid");

  if (iconInput) iconInput.value = em;
  if (emojiDisplay) emojiDisplay.textContent = em;
  if (modalTrophy) modalTrophy.textContent = em;

  if (paletteGrid && paletteGrid.querySelectorAll) {
    paletteGrid.querySelectorAll(".emoji-palette-item").forEach(item => {
      if (item.getAttribute("data-emoji") === em) item.classList.add("is-selected");
      else item.classList.remove("is-selected");
    });
  }
}

function initChoreEmojiPalette() {
  const paletteGrid = document.getElementById("task-emoji-palette-grid");
  const btnEmojiPicker = document.getElementById("btn-task-emoji-picker");
  const emojiPalette = document.getElementById("task-emoji-palette");
  const btnClosePalette = document.getElementById("btn-close-task-emoji-palette");
  const titleInput = document.getElementById("task-form-title");

  if (paletteGrid && (!paletteGrid.children || paletteGrid.children.length === 0)) {
    if (typeof paletteGrid.innerHTML === "string") {
      paletteGrid.innerHTML = CHORE_EMOJI_LIST.map(em => `
        <button type="button" class="emoji-palette-item" data-emoji="${em}" title="Select ${em}">
          ${em}
        </button>
      `).join("");
    }

    if (paletteGrid.querySelectorAll) {
      paletteGrid.querySelectorAll(".emoji-palette-item").forEach(item => {
        item.onclick = (e) => {
          e.preventDefault();
          const chosen = item.getAttribute("data-emoji");
          if (chosen) {
            isManualChoreEmoji = true;
            setChoreEmoji(chosen);
            if (emojiPalette) emojiPalette.style.display = "none";
          }
        };
      });
    }
  }

  if (btnEmojiPicker) {
    btnEmojiPicker.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!emojiPalette) return;
      const isOpen = emojiPalette.style.display !== "none";
      emojiPalette.style.display = isOpen ? "none" : "flex";
    };
  }

  if (btnClosePalette) {
    btnClosePalette.onclick = (e) => {
      e.preventDefault();
      if (emojiPalette) emojiPalette.style.display = "none";
    };
  }

  if (titleInput) {
    titleInput.oninput = () => {
      if (!isManualChoreEmoji) {
        const detected = detectEmojiForChore(titleInput.value);
        if (detected) setChoreEmoji(detected);
        else if (!titleInput.value.trim()) setChoreEmoji("🪴");
      }
    };
  }
}

let weeklyMeals = null;
let dateMealsStore = null;
let familyStickyNote = null;
let selectedStickyColor = "yellow";
let familyLists = window.familyLists || null;
window.familyLists = familyLists;
let activeListId = "groceries";
let familyGroceryList = null;

let isSleepScreenActive = false;
let sleepScreenTemporaryWakeUntil = 0;
let localWeatherForecast = null;

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

function getCurrentWeekDates(anchor = new Date()) {
  const d = new Date(anchor);
  const dow = d.getDay(); // 0 is Sun, 1 is Mon...
  const distToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + distToMon);
  monday.setHours(0, 0, 0, 0);

  const weekDates = {};
  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  weekDays.forEach((day, idx) => {
    const colD = new Date(monday);
    colD.setDate(monday.getDate() + idx);
    weekDates[day] = colD;
  });
  return weekDates;
}
window.getCurrentWeekDates = getCurrentWeekDates;

function loadDateMeals() {
  if (dateMealsStore && typeof dateMealsStore === "object") return dateMealsStore;
  try {
    const cached = localStorage.getItem(boardCacheKey("turnbull_meals_v4")) || localStorage.getItem(boardCacheKey("turnbull_meals_v3"));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        dateMealsStore = parsed;
        return dateMealsStore;
      }
    }
  } catch (e) {
    console.warn("Error reading meals cache", e);
  }

  dateMealsStore = {};

  // (A new device used to get a made-up "Spinach & Ricotta Tortelloni"
  // dinner for today, saved to the board. Removed: meals start empty and
  // load from the board.)

  return dateMealsStore;
}

function saveDateMeals(meals) {
  dateMealsStore = meals;
  try {
    localStorage.setItem(boardCacheKey("turnbull_meals_v4"), JSON.stringify(meals));
    localStorage.setItem(boardCacheKey("turnbull_meals_v3"), JSON.stringify(meals));
  } catch (e) {
    console.warn("Error saving meals cache", e);
  }
  if (db) {
    try {
      const boardDocRef = doc(db, "boards", currentBoardId);
      updateDoc(boardDocRef, {
        meals: meals,
        updatedAt: serverTimestamp()
      }).catch((err) => {
        // Fallback if doc doesn't exist yet
        setDoc(boardDocRef, { meals: meals, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      });
    } catch (e) {}
  }
}

function getMealForDate(date, slot = "dinner") {
  const store = loadDateMeals();
  if (!store || typeof store !== "object") return null;
  const key = getLocalDateKey(date);
  const entry = store[key];
  if (!entry || typeof entry !== "object") return null;

  if (slot) {
    if (entry[slot] && typeof entry[slot] === "object") return entry[slot];
    // Backwards-compatible fallback for dinner when single meal was stored
    if (slot === "dinner" && entry.title) {
      return {
        title: entry.title,
        emoji: entry.emoji || "🥘",
        cook: entry.cook || "Steve",
        notes: entry.notes || "",
        tags: entry.tags || "",
        hasRecipe: !!(entry.hasRecipe || entry.recipeId),
        recipeId: entry.recipeId || null,
        ingredients: entry.ingredients || null,
        instructions: entry.instructions || null,
        category: "dinner",
        date: key
      };
    }
    return null;
  }
  return entry;
}
window.getMealForDate = getMealForDate;

function setMealForDate(date, mealData, slot = "dinner") {
  const store = loadDateMeals();
  const key = getLocalDateKey(date);
  if (!store[key]) store[key] = {};

  if (!mealData || !mealData.title || mealData.title.trim().length === 0) {
    if (slot) {
      delete store[key][slot];
      if (slot === "dinner") {
        delete store[key].title;
        delete store[key].cook;
        delete store[key].notes;
        delete store[key].tags;
        delete store[key].hasRecipe;
        delete store[key].recipeId;
      }
    } else {
      delete store[key];
    }
    const hasRemaining = ["breakfast", "lunch", "dinner"].some(s => store[key] && store[key][s] && store[key][s].title);
    if (!hasRemaining && (!store[key] || !store[key].title)) {
      delete store[key];
    }
  } else {
    const formatted = {
      ...mealData,
      slot: slot || "dinner",
      category: slot || mealData.category || "dinner",
      date: key
    };
    if (slot) {
      store[key][slot] = formatted;
      if (slot === "dinner") {
        store[key].title = mealData.title;
        store[key].cook = mealData.cook || "Steve";
        store[key].notes = mealData.notes || "";
        store[key].tags = mealData.tags || "";
        store[key].hasRecipe = !!(mealData.hasRecipe || mealData.recipeId);
        store[key].recipeId = mealData.recipeId || null;
        store[key].date = key;
      }
    } else {
      store[key] = formatted;
    }
  }
  saveDateMeals(store);
}
window.setMealForDate = setMealForDate;

function loadWeeklyMeals() {
  const store = loadDateMeals();
  const currentWeekDates = getCurrentWeekDates();
  const res = {};
  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  weekDays.forEach(day => {
    const d = currentWeekDates[day];
    const key = getLocalDateKey(d);
    res[day] = store[key] || { title: "", cook: "", notes: "", tags: "", hasRecipe: false };
  });
  return res;
}

function saveWeeklyMeals(meals) {
  weeklyMeals = meals;
  if (!meals) return;
  const currentWeekDates = getCurrentWeekDates();
  Object.keys(meals).forEach(day => {
    const d = currentWeekDates[day];
    if (d) {
      setMealForDate(d, meals[day]);
    }
  });
}

// ============================================================================
// FAMILY CALENDAR EVENTS (Tutors, Driving Lessons, Family Gatherings)
// ============================================================================
// [Extracted to js/seed-data.js: DEFAULT_FAMILY_EVENTS]
const DEFAULT_FAMILY_EVENTS = window.DEFAULT_FAMILY_EVENTS || [];

var skylightNavInitialized = false;
let activeCalendarMemberFilter = window.activeCalendarMemberFilter || null;
let activeCalendarMemberFilters = window.activeCalendarMemberFilters || null;
window.activeCalendarMemberFilter = activeCalendarMemberFilter;
window.activeCalendarMemberFilters = activeCalendarMemberFilters;

function isMemberSelected(memberStr) {
  // If activeCalendarMemberFilters is null, "Select All" is active -> show everyone!
  if (activeCalendarMemberFilters === null) return true;
  // If activeCalendarMemberFilters is an empty array [], literally nobody is active -> hide all member events!
  if (activeCalendarMemberFilters.length === 0) return false;
  if (!memberStr) return true;

  if (Array.isArray(memberStr)) {
    return memberStr.some(m => isMemberSelected(m));
  }

  const str = String(memberStr).trim();
  const lower = str.toLowerCase();
  if (lower.includes("family") || lower.includes("everyone") || lower.includes("anyone") || lower.includes("whole family") || lower.includes("up for grabs")) {
    return true;
  }
  return activeCalendarMemberFilters.some(m => lower.includes(m.toLowerCase()));
}
window.isMemberSelected = isMemberSelected;
let familyEvents = null;
window.familyEvents = familyEvents;

function loadFamilyEvents() {
  try {
    const cached = localStorage.getItem(boardCacheKey("turnbull_family_events_v3"));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Error reading family events cache", e);
  }
  return isDefaultTurnbullBoard ? JSON.parse(JSON.stringify(DEFAULT_FAMILY_EVENTS)) : [];
}
window.loadFamilyEvents = loadFamilyEvents;
window.saveFamilyEvents = saveFamilyEvents;

function saveFamilyEvents(events) {
  familyEvents = events;
  window.familyEvents = events;
  try {
    localStorage.setItem(boardCacheKey("turnbull_family_events_v3"), JSON.stringify(events));
  } catch (e) {
    console.warn("Error saving family events cache", e);
  }
  if (db && typeof setDoc === "function") {
    try {
      setDoc(doc(db, "boards", currentBoardId), {
        events: events,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch (e) {}
  }
}

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

// Global Theme Switcher
function applyTheme(theme) {
  const isDark = theme === "dark";
  const menuThemeIcon = document.getElementById("menu-theme-icon");
  const menuThemeTitle = document.getElementById("menu-theme-title");
  const menuThemeSub = document.getElementById("menu-theme-sub");
  const sidebarSleepIcon = document.getElementById("sidebar-sleep-icon");
  const sidebarSleepLabel = document.getElementById("sidebar-sleep-label");
  const navItemSleep = document.getElementById("nav-item-sleep");

  if (isDark) {
    document.documentElement.classList.add("theme-dark");
    document.documentElement.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
    document.body.classList.remove("theme-light");
    if (menuThemeIcon) menuThemeIcon.textContent = "🌙";
    if (menuThemeTitle) menuThemeTitle.textContent = "Theme: Midnight Dark";
    if (menuThemeSub) menuThemeSub.textContent = "Switch to Pastel Light";
    if (sidebarSleepLabel) sidebarSleepLabel.textContent = "Light";
    if (navItemSleep) navItemSleep.setAttribute("title", "Switch to Light Mode");
    if (sidebarSleepIcon) {
      sidebarSleepIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
  } else {
    document.documentElement.classList.remove("theme-dark");
    document.documentElement.classList.add("theme-light");
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    if (menuThemeIcon) menuThemeIcon.textContent = "☀️";
    if (menuThemeTitle) menuThemeTitle.textContent = "Theme: Pastel Light";
    if (menuThemeSub) menuThemeSub.textContent = "Switch to Midnight Dark";
    if (sidebarSleepLabel) sidebarSleepLabel.textContent = "Dark";
    if (navItemSleep) navItemSleep.setAttribute("title", "Switch to Dark Mode");
    if (sidebarSleepIcon) {
      sidebarSleepIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  }

  // Update Settings modal theme option cards if present
  const optThemeLight = document.getElementById("opt-theme-light");
  const optThemeDark = document.getElementById("opt-theme-dark");
  if (optThemeLight && optThemeDark) {
    optThemeLight.classList.toggle("selected", !isDark);
    optThemeDark.classList.toggle("selected", isDark);
  }
}
window.applyTheme = applyTheme;

// [Extracted to js/audio.js: Web Audio Synthesizer & Confetti Burst]
// ============================================================================
// 5. APPLICATION INITIALIZATION & FIREBASE SETUP
// ============================================================================
function initApp() {
  // If first-time visitor on the base link without a board, show onboarding immediately
  // and do NOT load Turnbull family tasks or members into the background!
  if (isFirstTimeVisitor()) {
    familyMembers = [];
    currentTasks = [];
    document.body.classList.add("onboarding-active");
    setupEventListeners();
    setTimeout(() => {
      openOnboardingModal();
    }, 100);
    return;
  }

  loadLocalBoardSettings();
  setupEventListeners();
  loadFamilyStickyNote();
  loadFamilyLists();
  loadLocalTasks(); // Instant cache rendering so user never sees 0 tasks
  loadSavedFirebaseConfig();
  initializeDataSource();
  initScheduledSleepWindow();
}

// initApp kickoff moved to very bottom of script after all globals & functions are evaluated

function loadSavedFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG) || localStorage.getItem("chore_challenge_firebase_cfg");
    let cfg = null;
    if (raw) {
      cfg = JSON.parse(raw);
    }
    // Every household moved from the legacy project to harmonee-app on
    // 2026-11-06, so a saved legacy config is ignored.
    if (cfg && cfg.projectId === LEGACY_TURNBULL_PROJECT_ID) {
      cfg = null;
    }
    if (!cfg && DEFAULT_FIREBASE_CONFIG && DEFAULT_FIREBASE_CONFIG.apiKey) {
      cfg = DEFAULT_FIREBASE_CONFIG;
    }

    if (cfg && cfg.projectId && cfg.apiKey) {
      const apiKeyEl = document.getElementById("cfg-apiKey");
      const authDomainEl = document.getElementById("cfg-authDomain");
      const projectIdEl = document.getElementById("cfg-projectId");
      const storageBucketEl = document.getElementById("cfg-storageBucket");
      const messagingSenderIdEl = document.getElementById("cfg-messagingSenderId");
      const appIdEl = document.getElementById("cfg-appId");

      if (apiKeyEl) apiKeyEl.value = cfg.apiKey || "";
      if (authDomainEl) authDomainEl.value = cfg.authDomain || "";
      if (projectIdEl) projectIdEl.value = cfg.projectId || "";
      if (storageBucketEl) storageBucketEl.value = cfg.storageBucket || "";
      if (messagingSenderIdEl) messagingSenderIdEl.value = cfg.messagingSenderId || "";
      if (appIdEl) appIdEl.value = cfg.appId || "";
      return cfg;
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }
  return null;
}

async function initializeDataSource() {
  const cfg = loadSavedFirebaseConfig();
  const statusPill = document.getElementById("sync-status-pill");
  const statusDot = statusPill ? statusPill.querySelector(".status-dot") : null;
  const statusText = document.getElementById("sync-status-text");

  if (cfg && cfg.apiKey && cfg.projectId) {
    try {
      if (statusText) statusText.textContent = "Connecting...";
      const app = initializeApp(cfg);
      db = getFirestore(app);
      window.db = db;

      // Board data is only readable by devices that have joined the board
      // with its family code (see firestore.rules). initApp has already
      // rendered the local cache, so this waits behind cached data.
      await ensureBoardAccess(app);

      if (statusDot) {
        statusDot.classList.add("connected");
        statusDot.classList.remove("pulsing");
      }
      if (statusText) statusText.textContent = "Live Sync";

      listenToFirestoreTasks();
      return;
    } catch (err) {
      console.warn("Firebase init failed, falling back to local mode:", err);
      if (statusDot) statusDot.classList.remove("connected");
      if (statusText) statusText.textContent = "Offline Mode";
    }
  } else {
    if (statusDot) statusDot.classList.remove("connected");
    if (statusText) statusText.textContent = "Demo Mode";
  }

  // Load from LocalStorage or Seed Data
  loadLocalTasks();
}

// ============================================================================
// 5b. BOARD ACCESS: ANONYMOUS DEVICE SIGN-IN + FAMILY CODE
// ============================================================================
// Each device signs in anonymously (remembered by Firebase). To use a board
// it must have joined it once with the board's family code, which creates
// boards/{boardId}/devices/{uid}. A brand-new board is created together with
// its code and the creator's device in one batch.
const PENDING_NEW_BOARD_KEY = "harmonee_pending_new_board";
const FAMILY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

// New codes are three random everyday words, e.g. MINT-FROG-LAMP, stored as
// "MINTFROGLAMP". Boards made before Nov 2026 keep their 8-character codes
// (HX4P-9KTB), which still work everywhere.
function randomIndex(n) {
  // Unbiased: throw away the top slice of the range that doesn't divide by n
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

function generateFamilyCode() {
  const words = window.FAMILY_CODE_WORDS;
  if (Array.isArray(words) && words.length >= 500) {
    return [0, 1, 2].map(() => words[randomIndex(words.length)]).join("").toUpperCase();
  }
  // Word list didn't load: fall back to 8 random letters and numbers
  return Array.from({ length: 8 }, () => FAMILY_CODE_ALPHABET[randomIndex(FAMILY_CODE_ALPHABET.length)]).join("");
}

// "mint-frog lamp " -> "MINTFROGLAMP", "hx4p-9ktb " -> "HX4P9KTB"
function normalizeFamilyCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Split into groups of 4: MINT-FROG-LAMP or HX4P-9KTB
function formatFamilyCode(code) {
  const c = normalizeFamilyCode(code);
  return c.length === 8 || c.length === 12 ? c.match(/.{4}/g).join("-") : c;
}

function describeThisDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Device";
}

let boardDeviceUid = null;

async function tryJoinBoard(code) {
  const normalized = normalizeFamilyCode(code);
  if (normalized.length < 8) return false;
  try {
    await setDoc(doc(db, "boards", currentBoardId, "devices", boardDeviceUid), {
      code: normalized,
      label: describeThisDevice(),
      joinedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.warn("Join refused:", err && err.code);
    return false;
  }
}

async function createBoardWithAccess() {
  const code = generateFamilyCode();
  const batch = writeBatch(db);
  batch.set(doc(db, "boards", currentBoardId), {
    boardId: currentBoardId,
    members: familyMembers,
    settings: boardSettings,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, "boards", currentBoardId, "private", "access"), { code });
  batch.set(doc(db, "boards", currentBoardId, "devices", boardDeviceUid), {
    code,
    label: describeThisDevice(),
    joinedAt: serverTimestamp()
  });
  await batch.commit();
}

async function ensureBoardAccess(app) {
  const auth = getAuth(app);
  const cred = await signInAnonymously(auth); // returns the remembered device user if there is one
  boardDeviceUid = cred.user.uid;

  const deviceRef = doc(db, "boards", currentBoardId, "devices", boardDeviceUid);
  const deviceSnap = await getDoc(deviceRef);
  if (deviceSnap.exists()) return;

  // Join link: ?board=xyz&code=ABCD-EFGH (the code is removed from the URL afterwards)
  const params = new URLSearchParams(window.location.search);
  const linkCode = params.get("code") || params.get("join");
  if (linkCode) {
    params.delete("code");
    params.delete("join");
    const qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    if (await tryJoinBoard(linkCode)) return;
  }

  // Brand-new board from onboarding
  if (localStorage.getItem(PENDING_NEW_BOARD_KEY) === currentBoardId) {
    try {
      await createBoardWithAccess();
      localStorage.removeItem(PENDING_NEW_BOARD_KEY);
      return;
    } catch (err) {
      // The name is already taken by another household: fall through to joining
      console.warn("Could not create board:", err && err.code);
      localStorage.removeItem(PENDING_NEW_BOARD_KEY);
    }
  }

  // Ask for the family code until it's right
  await window.showJoinBoardScreen({
    familyName: isDefaultTurnbullBoard ? "Turnbull Family" : (boardSettings.familyName || ""),
    hadWrongLinkCode: !!linkCode,
    tryCode: tryJoinBoard
  });
}

// For the parent PIN (js/parent-pin.js): "forgot the PIN" accepts the
// family code instead. Members can read the code, so check it here.
async function checkFamilyCode(code) {
  const typed = normalizeFamilyCode(code);
  if (typed.length < 8) return false;
  try {
    const snap = await getDoc(doc(db, "boards", currentBoardId, "private", "access"));
    return snap.exists() && normalizeFamilyCode(snap.data().code) === typed;
  } catch (e) {
    return false;
  }
}
window.checkFamilyCode = checkFamilyCode;

// Save a few board settings now (this device and Firestore), e.g. the parent PIN
async function saveBoardSettingsNow(fields) {
  saveLocalBoardSettings({ ...boardSettings, ...fields });
  if (!db) return;
  try {
    const boardDocRef = getBoardDocRef();
    if (boardDocRef) await setDoc(boardDocRef, { settings: fields, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn("Failed to sync settings to Firestore:", err);
  }
}
window.saveBoardSettingsNow = saveBoardSettingsNow;
window.getCurrentBoardId = () => currentBoardId;

// Settings > Family access: read the code and joined devices (members only)
async function loadFamilyAccessInfo() {
  if (!db || !boardDeviceUid) return null;
  const [accessSnap, devicesSnap] = await Promise.all([
    getDoc(doc(db, "boards", currentBoardId, "private", "access")),
    getDocs(collection(db, "boards", currentBoardId, "devices"))
  ]);
  const devices = [];
  devicesSnap.forEach(d => devices.push({ id: d.id, ...d.data(), isThisDevice: d.id === boardDeviceUid }));
  devices.sort((a, b) => ((a.joinedAt && a.joinedAt.seconds) || 0) - ((b.joinedAt && b.joinedAt.seconds) || 0));
  const code = accessSnap.exists() ? accessSnap.data().code : null;
  const joinUrl = new URL(window.location.origin + window.location.pathname);
  joinUrl.searchParams.set("board", currentBoardId);
  if (code) joinUrl.searchParams.set("code", formatFamilyCode(code));
  return { code: code ? formatFamilyCode(code) : null, joinUrl: joinUrl.toString(), devices };
}

async function removeBoardDevice(uid) {
  await deleteDoc(doc(db, "boards", currentBoardId, "devices", uid));
}

window.loadFamilyAccessInfo = loadFamilyAccessInfo;
window.removeBoardDevice = removeBoardDevice;

// ============================================================================
// 6. FIRESTORE SYNC & SEEDING (MULTI-TENANCY)
// ============================================================================
function listenToFirestoreTasks() {
  if (!db) return;

  const colRef = getTasksCollectionRef();
  if (!colRef) return;

  if (firestoreUnsubscribe) {
    firestoreUnsubscribe();
  }

  // Also listen to board doc for custom member rosters
  listenToFirestoreBoard();

  firestoreUnsubscribe = onSnapshot(colRef, async (snapshot) => {
    if (snapshot.empty) {
      if (isDefaultTurnbullBoard) {
        console.log("Turnbull collection empty on first load. Seeding...");
        await seedFirestoreData();
        return;
      } else {
        // Custom board
        const params = new URLSearchParams(window.location.search);
        const template = params.get("template");
        if (template === "starter") {
          console.log("Seeding custom board with starter tasks...");
          await seedFirestoreData();
          return;
        } else {
          // Clean/empty canvas
          currentTasks = [];
          saveLocalCache([]);
          renderApp();
    renderSkylightTasksPage();
          return;
        }
      }
    }

    const tasks = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.archived) {
        tasks.push(normalizeTask({ id: docSnap.id, ...data }));
      }
    });

    currentTasks = tasks;
    saveLocalCache(tasks);
    await archivePreviousWeekendCompletedTasks();
    await checkWeeklySundayReset();
    renderApp();
    renderSkylightTasksPage();
  }, (err) => {
    console.error("Firestore listener error:", err);
    const syncStatusEl = document.getElementById("sync-status-text");
    if (syncStatusEl) syncStatusEl.textContent = "Sync Error (Using Cache)";
    loadLocalTasks();
  });
}

function listenToFirestoreBoard() {
  if (!db) return;
  const boardDocRef = doc(db, "boards", currentBoardId);
  if (!boardDocRef) return;

  if (firestoreBoardUnsubscribe) {
    firestoreBoardUnsubscribe();
  }

  firestoreBoardUnsubscribe = onSnapshot(boardDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      let shouldRender = false;
      if (Array.isArray(data.members) && data.members.length > 0) {
        familyMembers = data.members;
        saveLocalRoster(familyMembers);
        shouldRender = true;
      }
      if (data.settings) {
        boardSettings = { ...boardSettings, ...data.settings }; window.boardSettings = boardSettings;
        saveLocalBoardSettings(boardSettings);
        shouldRender = true;
      }
      if (Array.isArray(data.events)) {
        familyEvents = data.events;
        window.familyEvents = data.events;
        try { localStorage.setItem(boardCacheKey("turnbull_family_events_v3"), JSON.stringify(data.events)); } catch (e) {}
        shouldRender = true;
      }
      if (data.meals && typeof data.meals === "object") {
        dateMealsStore = data.meals;
        try {
          localStorage.setItem(boardCacheKey("turnbull_meals_v4"), JSON.stringify(data.meals));
          localStorage.setItem(boardCacheKey("turnbull_meals_v3"), JSON.stringify(data.meals));
        } catch (e) {}
        shouldRender = true;
      }
      if (Array.isArray(data.customRecipes)) {
        try {
          const safeRecipes = data.customRecipes.filter(r => r && typeof r === "object" && r.id);
          localStorage.setItem(boardCacheKey("turnbull_custom_recipes"), JSON.stringify(safeRecipes));
        } catch (e) {}
      }
      if (data.stickyNote !== undefined) {
        if (data.stickyNote && data.stickyNote.text && !data.stickyNote.deleted) {
          familyStickyNote = data.stickyNote;
          try { localStorage.setItem(boardCacheKey("turnbull_sticky_note"), JSON.stringify(data.stickyNote)); } catch (e) {}
        } else {
          familyStickyNote = null;
          try { localStorage.setItem(boardCacheKey("turnbull_sticky_note"), "none"); } catch (e) {}
        }
        renderFamilyStickyNote();
      }
      if (typeof window.applyBoardRewardData === "function") {
        window.applyBoardRewardData(data);
      }
      // Lists sync through js/lists.js (deleted-item record included, so
      // stale copies can't bring deleted items back)
      if (typeof window.applyBoardFamilyLists === "function") {
        window.applyBoardFamilyLists(data.familyLists, data.familyListsDeleted);
      }
      if (shouldRender) {
        renderApp();
    renderSkylightTasksPage();
      }
    } else {
      // First time initialization for this board doc in Firestore
      try {
        setDoc(boardDocRef, {
          boardId: currentBoardId,
          members: familyMembers,
          settings: boardSettings,
          events: loadFamilyEvents(),
          meals: loadDateMeals(),
          createdAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      } catch (e) {}
    }
  }, (err) => {
    console.warn("Board doc listener error:", err);
  });
}

async function seedFirestoreData() {
  if (!db) return;
  try {
    const batch = writeBatch(db);
    const tasksToSeed = isDefaultTurnbullBoard ? INITIAL_SEED_TASKS : STARTER_GENERIC_TASKS;

    tasksToSeed.forEach(task => {
      const docRef = getTaskDocRef(task.id);
      batch.set(docRef, {
        ...task,
        createdAt: serverTimestamp()
      });
    });

    if (!isDefaultTurnbullBoard) {
      const boardDocRef = getBoardDocRef();
      batch.set(boardDocRef, {
        boardId: currentBoardId,
        members: familyMembers,
        settings: boardSettings,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully seeded tasks for board '${currentBoardId}' in Firestore!`);
  } catch (err) {
    console.error("Error seeding Firestore:", err);
  }
}

// ============================================================================
// 7. LOCAL STORAGE FALLBACK (DEMO / INSTANT PERSISTENCE)
// ============================================================================
function normalizeTask(task) {
  if (!task.day) {
    if (task.category === "Friday Purge") task.day = "Friday";
    else if (task.category === "Saturday Reset") task.day = "Saturday";
    else if (task.category === "DIY Backlog") task.day = "Saturday";
    else task.day = "Anyday";
  }

  if (!task.taskType) {
    if (task.category === "DIY Backlog" || (task.title && task.title.toLowerCase().includes("diy"))) {
      task.taskType = "DIY Project";
    } else if (task.day === "Daily" || (task.title && (task.title.toLowerCase().includes("cat") || task.title.toLowerCase().includes("dishwasher") || task.title.toLowerCase().includes("bed")))) {
      task.taskType = "Daily Task";
    } else {
      task.taskType = "Standard";
    }
  }

  // Ensure Daily tasks have a proper completedDays and assignedDays map and preserve legacy completions
  const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
  if (isDaily) {
    if (!task.completedDays || typeof task.completedDays !== "object" || Array.isArray(task.completedDays)) {
      task.completedDays = {};
    }
    if (!task.assignedDays || typeof task.assignedDays !== "object" || Array.isArray(task.assignedDays)) {
      task.assignedDays = {};
    }

    // Normalize any plain string entries into structured objects
    Object.keys(task.completedDays).forEach(d => {
      const val = task.completedDays[d];
      if (typeof val === "string") {
        task.completedDays[d] = {
          completedBy: val,
          completedAt: new Date().toISOString(),
          completedWeek: getIsoWeekKey()
        };
      }
    });

    // If task was marked done on the root for the active week, ensure that day is recorded in completedDays
    const activeWeekKey = getIsoWeekKey();
    if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      const compDay = task.completedAt ? getDayNameFromDate(task.completedAt) : "Monday";
      if (!task.completedDays[compDay]) {
        task.completedDays[compDay] = {
          completedBy: task.completedBy,
          completedAt: task.completedAt || new Date().toISOString(),
          completedWeek: task.completedWeek || activeWeekKey
        };
      }
    }
  }

  return task;
}

function loadLocalRoster() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY_ROSTER) || localStorage.getItem(isDefaultTurnbullBoard ? "chore_roster" : `chore_roster_${currentBoardId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        familyMembers = parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load local roster:", e);
  }
}

function saveLocalRoster(roster) {
  try {
    localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(roster));
  } catch (e) {
    console.warn("Roster storage error:", e);
  }
}

function loadLocalTasks() {
  loadLocalRoster();
  try {
    const cached = localStorage.getItem(STORAGE_KEY_TASKS) || localStorage.getItem(isDefaultTurnbullBoard ? "chore_tasks" : `chore_tasks_${currentBoardId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      currentTasks = (Array.isArray(parsed) && parsed.length > 0)
        ? parsed.filter(t => !t.archived).map(normalizeTask)
        : [];

      if (isDefaultTurnbullBoard) {
        if (currentTasks.length === 0) {
          currentTasks = JSON.parse(JSON.stringify(INITIAL_SEED_TASKS)).map(normalizeTask);
        } else {
          // Check if daily tasks are missing from cache; if so, prepend them
          const hasDaily = currentTasks.some(t => t.id && t.id.startsWith("daily-"));
          if (!hasDaily) {
            const dailySeed = INITIAL_SEED_TASKS.filter(t => t.id && t.id.startsWith("daily-"));
            currentTasks = [...dailySeed, ...currentTasks];
          }
        }
      }
      saveLocalCache(currentTasks);
    } else {
      if (isDefaultTurnbullBoard) {
        currentTasks = JSON.parse(JSON.stringify(INITIAL_SEED_TASKS)).map(normalizeTask);
      } else {
        const params = new URLSearchParams(window.location.search);
        const template = params.get("template");
        if (template === "starter") {
          currentTasks = JSON.parse(JSON.stringify(STARTER_GENERIC_TASKS)).map(normalizeTask);
        } else {
          currentTasks = [];
        }
      }
      saveLocalCache(currentTasks);
    }
  } catch (e) {
    currentTasks = isDefaultTurnbullBoard 
      ? JSON.parse(JSON.stringify(INITIAL_SEED_TASKS)).map(normalizeTask) 
      : [];
    window.currentTasks = currentTasks;
  }
  renderApp();
}

function saveLocalCache(tasks) {
  currentTasks = tasks;
  window.currentTasks = tasks;
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Storage quota exceeded", e);
  }
}
window.saveLocalCache = saveLocalCache;

// ============================================================================
// 8. CARD ORDERING RULES & RENDERING
// Rule:
// - Incomplete tasks sit at the top.
// - Priority items (fire alarm) have a distinct red border/badge and remain at the very top of incomplete items.
// - Completed tasks sink to the bottom with strikethrough and reduced opacity.
// ============================================================================
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    // 1. Incomplete first, Completed second
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    // 2. Among incomplete: Priority items at very top
    if (!a.done) {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
    }
    // 3. Original order
    return (a.order || 0) - (b.order || 0);
  });
}

function renderApp() {
  updateLeaderboard();
  updateProgressAndTabs();
  renderTaskLists();
  renderWeekCalendar();
  if (currentActiveView === "rewards" && typeof renderPodiumRewards === "function") {
    renderPodiumRewards();
  }
  if (currentActiveView === "meals" && typeof renderMealsView === "function") {
    renderMealsView();
  }
  // First visit to this page on this device: show its intro (js/page-intro.js)
  if (typeof window.maybeShowPageIntro === "function") {
    setTimeout(() => window.maybeShowPageIntro(currentActiveView || "calendar"), 0);
  }
}

// Dynamic Leaderboard calculation and DOM rendering
// Supports single person, comma-separated multiple people (or array), or Team Effort (awards 1 pt to everyone).

// Universal Member Score Calculator (Used across Chores, Calendar, and Podium)
function calculateMemberScores() {
  const isMoney = boardSettings.gameMode === "money";
  const activeWeekKey = getIsoWeekKey();
  const scores = {};
  familyMembers.forEach(m => scores[m] = 0);

  function awardScore(completer, rewardVal) {
    if (!completer) return;
    if (completer === "Team Effort") {
      familyMembers.forEach(m => {
        if (scores[m] !== undefined) scores[m] += rewardVal;
      });
    } else if (Array.isArray(completer)) {
      completer.forEach(raw => {
        const m = normalizeFamilyMemberName(raw);
        if (scores[m] !== undefined) scores[m] += rewardVal;
      });
    } else if (typeof completer === "string") {
      completer.split(",").map(s => normalizeFamilyMemberName(s.trim())).forEach(m => {
        if (scores[m] !== undefined) scores[m] += rewardVal;
      });
    }
  }

  currentTasks.forEach(task => {
    const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
      ? task.rewardValue 
      : (isMoney ? 1.00 : (typeof task.points === "number" && task.points > 0 ? task.points : 1));

    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    if (isDaily && task.completedDays && Object.keys(task.completedDays).length > 0) {
      Object.entries(task.completedDays).forEach(([dayName, dayRecord]) => {
        if (!dayRecord) return;
        const completer = typeof dayRecord === "object" ? dayRecord.completedBy : dayRecord;
        const compWeek = typeof dayRecord === "object" ? dayRecord.completedWeek : null;
        if (completer && (!compWeek || compWeek === activeWeekKey)) {
          awardScore(completer, rewardVal);
        }
      });
    } else if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      awardScore(task.completedBy, rewardVal);
    }
  });

  return scores;
}

function updateLeaderboard() {
  const container = document.getElementById("leaderboard-container");
  if (!container) return;

  // Update header Game Mode pill label & menu chip
  const modeLabel = document.getElementById("game-mode-label");
  const modeIcon = document.getElementById("game-mode-icon");
  const menuModeLabel = document.getElementById("menu-game-mode-label");
  const menuModeIcon = document.getElementById("menu-game-mode-icon");

  const modeText = boardSettings.gameMode === "money" ? `Pocket Money (${boardSettings.currency})` : "Points Mode";
  const modeEmoji = boardSettings.gameMode === "money" ? "💰" : "🏆";

  if (modeLabel) modeLabel.textContent = modeText;
  if (modeIcon) modeIcon.textContent = modeEmoji;
  if (menuModeLabel) menuModeLabel.textContent = modeText;
  if (menuModeIcon) menuModeIcon.textContent = modeEmoji;

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const scores = calculateMemberScores();

  // Find leader(s)
  let maxScore = -1;
  familyMembers.forEach(m => {
    if (scores[m] > maxScore) {
      maxScore = scores[m];
    }
  });

  // Rebuild chips dynamically
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${Math.max(2, familyMembers.length)}, 1fr)`;

  familyMembers.forEach((name, idx) => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.setAttribute("data-member", name);
    if (activeAssigneeFilter === name) {
      chip.classList.add("active-member-filter");
    }
    if (maxScore > 0 && scores[name] === maxScore) {
      chip.classList.add("leader");
    }

    const color = getMemberColor(idx);
    const initial = name.charAt(0).toUpperCase();

    const scoreFormatted = isMoney 
      ? `${currency}${scores[name].toFixed(2)}` 
      : `${scores[name]} pts`;

    chip.innerHTML = `
      <div class="avatar-ring" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
      <div class="member-meta">
        <span class="name-with-crown">
          <span class="member-name">${escapeHtml(name)}</span>
          <span class="member-crown">${isMoney ? '💰' : '👑'}</span>
        </span>
        <span class="member-score"><span class="score-num" id="score-${escapeHtml(name)}">${scoreFormatted}</span></span>
      </div>
    `;

    chip.addEventListener("click", () => {
      if (activeAssigneeFilter === name) {
        activeAssigneeFilter = "ALL";
        chip.classList.remove("active-member-filter");
      } else {
        activeAssigneeFilter = name;
        document.querySelectorAll(".member-chip").forEach(c => c.classList.remove("active-member-filter"));
        chip.classList.add("active-member-filter");
      }
      renderTaskLists();
    });

    container.appendChild(chip);
  });

  updateTaskFormAssigneeOptions();
}

function updateTaskFormAssigneeOptions() {
  const select = document.getElementById("task-form-assignee");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">⚡ Grab it (anyone)</option>`;

  familyMembers.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (currentVal && familyMembers.includes(currentVal)) {
    select.value = currentVal;
  }
}

const TURNBULL_ROOMS = [
  { val: "Kitchen", label: "🍽️ Kitchen" },
  { val: "Living Room", label: "🛋️ Living Room" },
  { val: "Dining Room", label: "🪑 Dining Room" },
  { val: "Master Bedroom", label: "🛏️ Master Bedroom" },
  { val: "Ava Bedroom", label: "🛏️ Ava Bedroom" },
  { val: "Dara Bedroom", label: "🛏️ Dara Bedroom" },
  { val: "Kids / Guest Bedroom", label: "🛏️ Kids / Guest Bedroom" },
  { val: "Bathroom", label: "🚿 Bathroom / En-suite" },
  { val: "Downstairs WC", label: "🚽 Downstairs WC" },
  { val: "Hallway", label: "🚪 Hallway / Stairs / Landing" },
  { val: "Utility Room", label: "🧺 Utility / Laundry" },
  { val: "Home Office", label: "💼 Home Office / Study" },
  { val: "Garden", label: "🪴 Garden / Patio" },
  { val: "Car", label: "🚗 Car / Driveway" },
  { val: "Garage", label: "🔧 Garage / Shed" },
  { val: "Attic", label: "📦 Attic / Loft" },
  { val: "General House", label: "🏠 Whole House / General" }
];

const GENERIC_ROOMS = [
  { val: "Kitchen", label: "🍽️ Kitchen" },
  { val: "Living Room", label: "🛋️ Living Room" },
  { val: "Dining Room", label: "🪑 Dining Room" },
  { val: "Master Bedroom", label: "🛏️ Master Bedroom" },
  { val: "Bedroom 1", label: "🛏️ Bedroom 1" },
  { val: "Bedroom 2", label: "🛏️ Bedroom 2" },
  { val: "Bedroom 3", label: "🛏️ Bedroom 3" },
  { val: "Bedroom 4", label: "🛏️ Bedroom 4" },
  { val: "Kids / Guest Bedroom", label: "🛏️ Kids / Guest Bedroom" },
  { val: "Bathroom", label: "🚿 Bathroom / En-suite" },
  { val: "Downstairs WC", label: "🚽 Downstairs WC" },
  { val: "Hallway", label: "🚪 Hallway / Stairs / Landing" },
  { val: "Utility Room", label: "🧺 Utility / Laundry" },
  { val: "Home Office", label: "💼 Home Office / Study" },
  { val: "Garden", label: "🪴 Garden / Patio" },
  { val: "Car", label: "🚗 Car / Driveway" },
  { val: "Garage", label: "🔧 Garage / Shed" },
  { val: "Attic", label: "📦 Attic / Loft" },
  { val: "General House", label: "🏠 Whole House / General" }
];

function updateTaskFormRoomOptions() {
  const select = document.getElementById("task-form-room");
  if (!select) return;

  const currentVal = select.value;
  const roomList = isDefaultTurnbullBoard ? TURNBULL_ROOMS : GENERIC_ROOMS;

  select.innerHTML = roomList.map(r => 
    `<option value="${escapeHtml(r.val)}">${r.label}</option>`
  ).join("") + `<option value="__custom__">✏️ Custom Area...</option>`;

  if (currentVal) {
    select.value = currentVal;
  }
}

function updateProgressAndTabs() {
  const total = currentTasks.length;
  const completed = currentTasks.filter(t => {
    const isDaily = t.day === "Daily" || t.taskType === "Daily Task";
    if (isDaily) {
      return (t.completedDays && Object.keys(t.completedDays).length > 0) || t.done;
    }
    return t.done;
  }).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Week Commencing Label
  const weekCommencingEl = document.getElementById("progress-week-commencing");
  if (weekCommencingEl) {
    weekCommencingEl.textContent = `Week: ${getWeekCommencingString()}`;
  }

  // Progress Bar
  const summaryText = document.getElementById("progress-summary-text");
  const percentText = document.getElementById("progress-percent-text");
  const fillBar = document.getElementById("progress-fill-bar");

  if (summaryText) summaryText.textContent = `${completed} of ${total} tasks cleared`;
  if (percentText) percentText.textContent = `${percent}% Done`;
  if (fillBar) fillBar.style.width = `${percent}%`;

  // Granular Foldout: Individual Member Completed Tasks Breakdown
  const breakdownGrid = document.getElementById("progress-breakdown-grid");
  if (breakdownGrid) {
    const activeWeekKey = getIsoWeekKey();
    const memberCounts = {};
    familyMembers.forEach(m => { memberCounts[m] = 0; });

    function tallyMember(completer) {
      if (!completer) return;
      if (completer === "Team Effort") {
        familyMembers.forEach(m => memberCounts[m]++);
      } else if (Array.isArray(completer)) {
        completer.forEach(m => {
          if (memberCounts[m] !== undefined) memberCounts[m]++;
        });
      } else if (typeof completer === "string") {
        completer.split(",").map(s => s.trim()).forEach(m => {
          if (memberCounts[m] !== undefined) memberCounts[m]++;
        });
      }
    }

    currentTasks.forEach(task => {
      const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
      if (isDaily && task.completedDays && Object.keys(task.completedDays).length > 0) {
        Object.entries(task.completedDays).forEach(([dayName, dayRecord]) => {
          if (!dayRecord) return;
          const completer = typeof dayRecord === "object" ? dayRecord.completedBy : dayRecord;
          const compWeek = typeof dayRecord === "object" ? dayRecord.completedWeek : null;
          if (completer && (!compWeek || compWeek === activeWeekKey)) {
            tallyMember(completer);
          }
        });
      } else if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
        tallyMember(task.completedBy);
      }
    });

    const totalMemberCompleted = Object.values(memberCounts).reduce((a, b) => a + b, 0);

    breakdownGrid.innerHTML = familyMembers.map((name, idx) => {
      const count = memberCounts[name] || 0;
      const color = getMemberColor(idx);
      const initial = escapeHtml(name.charAt(0).toUpperCase());
      const memberPct = totalMemberCompleted > 0 ? Math.min(100, Math.round((count / totalMemberCompleted) * 100)) : 0;

      return `
        <div class="breakdown-member-card">
          <div class="breakdown-member-top">
            <div class="breakdown-member-name">
              <span class="avatar-ring-xs" style="background: ${color.bg}; border: 1.5px solid ${color.border};">${initial}</span>
              <span>${escapeHtml(name)}</span>
            </div>
            <span class="breakdown-member-count">${count} ${count === 1 ? 'task' : 'tasks'}</span>
          </div>
          <div class="breakdown-mini-track">
            <div class="breakdown-mini-fill" style="width: ${memberPct}%; background: ${color.border};"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Filter Tab Counts (7-Day Week + All + Daily)
  const countAll = currentTasks.length;
  const countDaily = currentTasks.filter(t => t.day === "Daily" || t.taskType === "Daily Task").length;

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayCounts = {};
  days.forEach((d, idx) => {
    // Each day includes tasks scheduled explicitly for that day, all everyday Daily tasks,
    // PLUS any incomplete tasks from earlier days that rollover into this day!
    dayCounts[d] = currentTasks.filter(t => {
      if (t.day === d) return true;
      if (t.day === "Daily" || t.taskType === "Daily Task") return true;
      if (!t.done) {
        const taskDayIdx = days.indexOf(t.day);
        if (taskDayIdx !== -1 && taskDayIdx < idx) return true;
      }
      return false;
    }).length;
  });

  const countAllEl = document.getElementById("count-all");
  const countDailyEl = document.getElementById("count-daily");
  if (countAllEl) countAllEl.textContent = countAll;
  if (countDailyEl) countDailyEl.textContent = countDaily;

  days.forEach(d => {
    const el = document.getElementById(`count-${d.toLowerCase()}`);
    if (el) el.textContent = dayCounts[d];
  });

  // Mark today's tab with indicator
  const todayIdx = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  document.querySelectorAll(".day-tab").forEach(tab => {
    if (parseInt(tab.getAttribute("data-day"), 10) === todayIdx) {
      tab.classList.add("today");
      tab.title = "Today";
    } else {
      tab.classList.remove("today");
    }
  });
}

// const WEEK_DAYS_ORDER moved to top of file

function renderTaskLists() {
  const activeListEl = document.getElementById("active-cards-list");
  const completedListEl = document.getElementById("completed-cards-list");
  const emptyStateEl = document.getElementById("empty-state-view");
  const activeSection = document.getElementById("active-tasks-section");
  const completedSection = document.getElementById("completed-tasks-section");

  // If in Skylight Tasks mode, delegate to renderSkylightTasksPage
  if (typeof renderSkylightTasksPage === "function") {
    renderSkylightTasksPage();
  }

  if (!activeListEl || !completedListEl) return;

  const selectedDayIdx = WEEK_DAYS_ORDER.indexOf(activeCategoryFilter);
  const targetDay = selectedDayIdx !== -1 ? activeCategoryFilter : getTodayDayName();

  // Map each task with day-specific completion and overdue/rollover metadata
  let preparedTasks = currentTasks.map(t => {
    const isDaily = t.day === "Daily" || t.taskType === "Daily Task";
    let isTaskDone = t.done;
    let completer = t.completedBy;

    if (isDaily) {
      const dailyStatus = getDailyTaskStatus(t, targetDay);
      isTaskDone = dailyStatus.isDone;
      completer = dailyStatus.completedBy;
    }

    let effectiveAssigned = t.assignedTo;
    if (isDaily && t.assignedDays && t.assignedDays[targetDay] !== undefined) {
      effectiveAssigned = t.assignedDays[targetDay] || null;
    }

    // Only non-daily tasks rollover as overdue from previous days
    const taskDayIdx = WEEK_DAYS_ORDER.indexOf(t.day);
    const isOverdue = !isDaily && !isTaskDone && selectedDayIdx !== -1 && taskDayIdx !== -1 && taskDayIdx < selectedDayIdx;

    return {
      ...t,
      assignedTo: effectiveAssigned,
      effectiveDone: isTaskDone,
      effectiveCompletedBy: completer,
      isOverdue,
      overdueFromDay: isOverdue ? t.day : null
    };
  });

  // Filter tasks based on active category / day / type filter
  let filtered = preparedTasks;
  if (activeCategoryFilter !== "ALL") {
    if (activeCategoryFilter === "Daily") {
      filtered = filtered.filter(t => t.day === "Daily" || t.taskType === "Daily Task");
    } else {
      // Matches specific day (Monday-Sunday) OR includes Daily routines OR Rolled-over overdue tasks from earlier days
      filtered = filtered.filter(t => t.day === activeCategoryFilter || t.day === "Daily" || t.isOverdue);
    }
  }

  // Filter tasks based on active assignee
  if (activeAssigneeFilter !== "ALL") {
    if (activeAssigneeFilter === "UNASSIGNED") {
      filtered = filtered.filter(t => !t.assignedTo);
    } else {
      const filterLower = activeAssigneeFilter.toLowerCase();
      filtered = filtered.filter(t => {
        if (getAssigneeNames(t.assignedTo).some(n => n.toLowerCase() === filterLower)) return true;
        if (t.effectiveCompletedBy) {
          if (Array.isArray(t.effectiveCompletedBy)) {
            if (t.effectiveCompletedBy.some(m => String(m).toLowerCase() === filterLower)) return true;
          } else if (typeof t.effectiveCompletedBy === "string") {
            const parts = t.effectiveCompletedBy.split(",").map(p => p.trim().toLowerCase());
            if (parts.includes(filterLower) || t.effectiveCompletedBy.toLowerCase() === "team effort") return true;
          }
        }
        if (!t.assignedTo && !t.effectiveDone) return true;
        return false;
      });
    }
  }

  const sorted = sortTasks(filtered);

  // Overdue tasks float right to the top of the active list
  const activeTasks = sorted.filter(t => !t.effectiveDone).sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0;
  });

  const completedTasks = sorted.filter(t => t.effectiveDone);

  // Update Section Badges
  document.getElementById("active-tasks-count").textContent = activeTasks.length;
  document.getElementById("completed-tasks-count").textContent = completedTasks.length;

  activeListEl.innerHTML = "";
  completedListEl.innerHTML = "";

  if (activeTasks.length === 0 && completedTasks.length === 0) {
    if (emptyStateEl) emptyStateEl.style.display = "block";
    if (activeSection) activeSection.style.display = "none";
    if (completedSection) completedSection.style.display = "none";
    return;
  } else {
    if (emptyStateEl) emptyStateEl.style.display = "none";
  }

  if (activeSection) activeSection.style.display = activeTasks.length > 0 ? "block" : "none";
  if (completedSection) completedSection.style.display = completedTasks.length > 0 ? "block" : "none";

  // When a specific family member is active (e.g. Ava), partition active tasks into:
  // 1. "Assigned to [Name]" (highlighted with their color accent)
  // 2. "Up for Grabs" (communal tasks anyone can grab)
  const isMemberFiltered = activeAssigneeFilter !== "ALL" && activeAssigneeFilter !== "UNASSIGNED";
  
  if (isMemberFiltered) {
    const filterLower = activeAssigneeFilter.toLowerCase();
    const assignedToMember = [];
    const upForGrabs = [];

    activeTasks.forEach(t => {
      if (getAssigneeNames(t.assignedTo).some(n => n.toLowerCase() === filterLower)) {
        assignedToMember.push(t);
      } else {
        upForGrabs.push(t);
      }
    });

    // 1. Render Assigned to Member Sub-group (if any)
    if (assignedToMember.length > 0) {
      const assignedHeader = document.createElement("div");
      assignedHeader.className = "assigned-subgroup-header";
      assignedHeader.innerHTML = `
        <span class="assigned-subgroup-title">
          <span>👤</span>
          <span>${escapeHtml(activeAssigneeFilter)}'s Chores</span>
        </span>
        <span class="assigned-subgroup-badge">${assignedToMember.length}</span>
      `;
      activeListEl.appendChild(assignedHeader);

      assignedToMember.forEach(task => {
        try {
          const el = createTaskCardElement(task, activeAssigneeFilter, targetDay);
          if (el) activeListEl.appendChild(el);
        } catch (e) {
          console.error("Error creating assigned card:", task, e);
        }
      });
    }

    // 2. Render Up For Grabs Sub-group (if any)
    if (upForGrabs.length > 0) {
      const grabsHeader = document.createElement("div");
      grabsHeader.className = "assigned-subgroup-header up-for-grabs-header";
      grabsHeader.innerHTML = `
        <span class="assigned-subgroup-title">
          <span>⚡</span>
          <span>Grab it — bonus tasks</span>
        </span>
        <span class="assigned-subgroup-badge">${upForGrabs.length} available</span>
      `;
      activeListEl.appendChild(grabsHeader);

      upForGrabs.forEach(task => {
        try {
          const el = createTaskCardElement(task, null, targetDay);
          if (el) activeListEl.appendChild(el);
        } catch (e) {
          console.error("Error creating up-for-grabs card:", task, e);
        }
      });
    }
  } else {
    // Normal feed for ALL
    activeTasks.forEach(task => {
      try {
        const el = createTaskCardElement(task, null, targetDay);
        if (el) activeListEl.appendChild(el);
      } catch (e) {
        console.error("Error creating active card:", task, e);
      }
    });
  }

  completedTasks.forEach(task => {
    try {
      const el = createTaskCardElement(task, null, targetDay);
      if (el) completedListEl.appendChild(el);
    } catch (e) {
      console.error("Error creating completed card:", task, e);
    }
  });
}

function getRewardTierClass(val) {
  const num = Number(val) || 1;
  if (num <= 1) return "tier-1"; // Mint Green (1 pt / £1.00)
  if (num <= 2) return "tier-2"; // Sky Blue (2 pts / £2.00)
  if (num <= 3) return "tier-3"; // Golden Amber (3 pts / £3.00)
  if (num <= 4) return "tier-4"; // Royal Purple (4 pts / £4.00)
  return "tier-5";               // Vivid Coral Rose (5+ pts / > £4.00)
}

function createTaskCardElement(task, highlightMember = null, targetDay = null) {
  const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
  const viewDay = targetDay || (WEEK_DAYS_ORDER.includes(activeCategoryFilter) ? activeCategoryFilter : getTodayDayName());

  let isDone = task.effectiveDone !== undefined ? task.effectiveDone : task.done;
  let completer = task.effectiveCompletedBy !== undefined ? task.effectiveCompletedBy : task.completedBy;

  if (isDaily && task.effectiveDone === undefined) {
    const dailyStatus = getDailyTaskStatus(task, viewDay);
    isDone = dailyStatus.isDone;
    completer = dailyStatus.completedBy;
  }

  const card = document.createElement("article");
  let assignedAccentClass = "";
  if (!isDone && (highlightMember || (task.assignedTo && activeAssigneeFilter === task.assignedTo))) {
    const memberName = String(highlightMember || getAssigneeNames(task.assignedTo)[0] || "").toLowerCase();
    assignedAccentClass = `assigned-accent assigned-${memberName}`;
  }

  card.className = `task-card ${task.isPriority && !isDone ? "priority-card" : ""} ${isDone ? "task-completed" : ""} ${task.isOverdue ? "is-overdue" : ""} ${assignedAccentClass}`;
  card.id = `card-${task.id}`;

  // Badges
  let badgesHtml = "";

  if (task.isOverdue) {
    badgesHtml += `<span class="badge badge-overdue">⚠️ ${escapeHtml(task.overdueFromDay)} — Overdue</span>`;
  }

  badgesHtml += `
    <span class="badge badge-room">📍 ${escapeHtml(task.room || 'House')}</span>
    <span class="badge badge-time">⏱️ ${escapeHtml(task.estimatedTime || '15 mins')}</span>
  `;

  // Day Badge
  if (task.day && task.day !== "Anyday") {
    badgesHtml += `<span class="badge badge-day">📅 ${escapeHtml(task.day)}</span>`;
  }

  // Weekly Repeat Badge
  if (task.repeat === "weekly") {
    badgesHtml += `<span class="badge badge-weekly">🔁 Weekly</span>`;
  }

  // Task Type Badge (e.g. DIY Project, Daily Task, Deep Clean)
  if (task.taskType === "DIY Project" || task.category === "DIY Backlog") {
    badgesHtml += `<span class="badge badge-diy">🔨 DIY Project</span>`;
  } else if (task.taskType === "Daily Task" || task.day === "Daily" || task.repeat === "daily") {
    badgesHtml += `<span class="badge badge-daily">🔄 Daily Routine</span>`;
    if (task.streak && task.streak >= 2) {
      badgesHtml += `<span class="chore-streak-badge ${task.streak >= 7 ? 'milestone' : ''}">🔥 ${task.streak}d streak</span>`;
    }
  } else if (task.taskType && task.taskType !== "Standard") {
    badgesHtml += `<span class="badge badge-type">🏷️ ${escapeHtml(task.taskType)}</span>`;
  }

  // Up for Grabs Badge for unassigned tasks
  if (!isDone && getAssigneeNames(task.assignedTo).every(n => n.toLowerCase() === "anyone")) {
    badgesHtml += `<span class="badge badge-up-for-grabs">⚡ Grab it</span>`;
  }

  // Reward Badge (Gamified Points / Money Pill positioned next to Avatar)
  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardVal = (typeof task.rewardValue === "number" && task.rewardValue > 0)
    ? task.rewardValue
    : (isMoney ? 1.00 : 1);

  const tierClass = getRewardTierClass(rewardVal);
  let rewardLabel = "";
  if (isMoney) {
    rewardLabel = `${currency}${rewardVal.toFixed(2)}`;
  } else {
    rewardLabel = `${rewardVal} ${rewardVal === 1 ? 'pt' : 'pts'}`;
  }

  const rewardBadgeHtml = `
    <span class="card-reward-badge ${tierClass}" title="Reward: ${rewardLabel}">
      ${escapeHtml(rewardLabel)}
    </span>
  `;

  // Top-Right Assignee / Completer Avatar Circle (or Unassigned Button)
  let avatarRightHtml = "";
  if (isDone) {
    // When completed, show the avatar of who actually completed the task!
    const displayCompleter = completer || task.assignedTo;
    if (displayCompleter === "Team Effort") {
      avatarRightHtml = `
        <div class="card-assignee-avatar-btn completed-avatar" title="Completed by Team Effort" aria-label="Completed by Team Effort">
          <div class="avatar-ring" style="background: linear-gradient(135deg, #f59e0b, #ec4899); border: 2px solid #fbbf24; font-size: 0.9rem;">👥</div>
        </div>
      `;
    } else if (displayCompleter) {
      const members = Array.isArray(displayCompleter)
        ? displayCompleter
        : displayCompleter.split(",").map(s => s.trim()).filter(Boolean);

      if (members.length === 1) {
        const memberName = members[0];
        const memberIdx = familyMembers.indexOf(memberName);
        const color = getMemberColor(memberIdx !== -1 ? memberIdx : 0);
        const initial = memberName.charAt(0).toUpperCase();
        avatarRightHtml = `
          <div class="card-assignee-avatar-btn completed-avatar" title="Completed by ${escapeHtml(memberName)}" aria-label="Completed by ${escapeHtml(memberName)}">
            <div class="avatar-ring" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
          </div>
        `;
      } else if (members.length > 1) {
        const avatarsStack = members.slice(0, 2).map(memberName => {
          const mIdx = familyMembers.indexOf(memberName);
          const col = getMemberColor(mIdx !== -1 ? mIdx : 0);
          return `<div class="avatar-ring" style="background: ${col.bg}; border: 2px solid ${col.border};">${escapeHtml(memberName.charAt(0).toUpperCase())}</div>`;
        }).join("");
        avatarRightHtml = `
          <div class="card-assignee-avatar-btn completed-avatar avatar-stack" title="Completed by ${escapeHtml(members.join(', '))}" aria-label="Completed by ${escapeHtml(members.join(', '))}">
            ${avatarsStack}
          </div>
        `;
      } else {
        avatarRightHtml = `
          <div class="card-assignee-avatar-btn completed-avatar" title="Completed" aria-label="Completed">
            <div class="avatar-ring" style="background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; color: #10b981;">✓</div>
          </div>
        `;
      }
    } else {
      avatarRightHtml = `
        <div class="card-assignee-avatar-btn completed-avatar" title="Completed" aria-label="Completed">
          <div class="avatar-ring" style="background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; color: #10b981;">✓</div>
        </div>
      `;
    }
  } else if (getAssigneeNames(task.assignedTo).length) {
    const firstAssignee = getAssigneeNames(task.assignedTo)[0];
    const memberIdx = familyMembers.indexOf(firstAssignee);
    const color = getMemberColor(memberIdx !== -1 ? memberIdx : 0);
    const initial = firstAssignee.charAt(0).toUpperCase();
    avatarRightHtml = `
      <button type="button" class="card-assignee-avatar-btn btn-open-assign" data-task-id="${task.id}" title="Assigned to ${escapeHtml(formatAssigneeNames(task.assignedTo))} — Tap to change" aria-label="Assigned to ${escapeHtml(formatAssigneeNames(task.assignedTo))}">
        <div class="avatar-ring" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
      </button>
    `;
  } else {
    avatarRightHtml = `
      <button type="button" class="card-assignee-avatar-btn unassigned btn-open-assign" data-task-id="${task.id}" title="Grab it — tap to assign" aria-label="Grab it — tap to assign">
        <div class="avatar-ring-unassigned">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </div>
      </button>
    `;
  }

  if (task.isPriority && !isDone) {
    badgesHtml = `<span class="badge badge-priority">🚨 HIGH PRIORITY</span>` + badgesHtml;
  }

  // Action Buttons
  let rightActionHtml = "";
  if (!isDone) {
    if (isDaily) {
      const targetIdx = getDayOrderIndex(viewDay);
      const todayIdx = getTodayOrderIndex();

      if (targetIdx > todayIdx) {
        // Future day: locked
        rightActionHtml = `
          <button class="btn-mark-done is-locked" disabled title="Daily routines can only be completed on ${viewDay}">
            <span class="btn-lock-icon">🔒</span>
            <span>Available ${viewDay.slice(0, 3)}</span>
          </button>
        `;
      } else if (targetIdx < todayIdx) {
        // Past day this week: catch-up
        rightActionHtml = `
          <button class="btn-mark-done btn-catchup" data-task-id="${task.id}" data-day="${viewDay}" id="btn-done-${task.id}" title="Catch up on missed daily task for ${viewDay}">
            <span>Mark Done (${viewDay.slice(0, 3)})</span>
            <span class="btn-icon">⚡</span>
          </button>
        `;
      } else {
        // Today
        rightActionHtml = `
          <button class="btn-mark-done" data-task-id="${task.id}" data-day="${viewDay}" id="btn-done-${task.id}">
            <span>Mark Done</span>
            <span class="btn-icon">⚡</span>
          </button>
        `;
      }
    } else {
      // Non-daily regular task
      rightActionHtml = `
        <button class="btn-mark-done" data-task-id="${task.id}" data-day="${viewDay}" id="btn-done-${task.id}">
          <span>Mark Done</span>
          <span class="btn-icon">⚡</span>
        </button>
      `;
    }
  } else {
    const claimer = escapeHtml(completer || "Family");
    rightActionHtml = `
      <span class="completed-badge-pill">✓ Done by ${claimer}</span>
      <button class="btn-undo" data-task-id="${task.id}" data-day="${viewDay}" id="btn-undo-${task.id}" title="Float back to active">
        <span>↩ Undo</span>
      </button>
    `;
  }

  const editDeleteHtml = `
    <div class="card-actions-left">
      <button class="btn-card-action btn-edit-task" data-task-id="${task.id}" id="btn-edit-${task.id}" title="Edit Task" aria-label="Edit Task">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
      </button>
      <button class="btn-card-action btn-delete-task" data-task-id="${task.id}" id="btn-delete-${task.id}" title="Delete Task" aria-label="Delete Task">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  card.innerHTML = `
    <div class="card-badges-row">
      <div class="card-badges-left">
        ${badgesHtml}
      </div>
      <div class="card-header-right">
        ${rewardBadgeHtml}
        ${avatarRightHtml}
      </div>
    </div>
    <div class="card-content">
      <h3 class="card-title">${(task.icon || detectEmojiForChore(task.title)) ? `<span class="chore-title-emoji">${escapeHtml(task.icon || detectEmojiForChore(task.title))}</span> ` : ""}${escapeHtml(task.title)}</h3>
      <p class="card-note">${escapeHtml(task.actionNote)}</p>
    </div>
    <div class="card-actions-row">
      ${editDeleteHtml}
      <div class="card-actions-right">
        ${rightActionHtml}
      </div>
    </div>
  `;

  return card;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 9. TASK CLAIMING, CELEBRATION & UNDO FLOW (MULTI-SELECT SUPPORT)
// ============================================================================
let selectedClaimMembers = new Set();
let taskToDelete = null;

// ----------------------------------------------------------------------------
// EDIT & CREATE TASK MODAL
// ----------------------------------------------------------------------------
const WEEK_DAYS_7 = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT_LABELS = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN"
};

let currentRosterAssignments = {};
let activePopoverDay = null;

function getRosterDayCardInnerHtml(day, assignedPerson, isTarget) {
  let initial = "⚡";
  let nameLabel = "Anyone";
  let colorBg = "rgba(245, 158, 11, 0.12)";
  let colorBorder = "#f59e0b";
  let colorText = "#d97706";

  if (assignedPerson && typeof assignedPerson !== "string") assignedPerson = getAssigneeNames(assignedPerson).join(", ");
  if (assignedPerson && assignedPerson.toLowerCase() !== "anyone") {
    nameLabel = assignedPerson;
    initial = assignedPerson.charAt(0).toUpperCase();
    const pLower = assignedPerson.toLowerCase();
    if (pLower.includes("steven") || pLower.includes("steve")) {
      colorBg = "rgba(59, 130, 246, 0.15)";
      colorBorder = "#3b82f6";
      colorText = "#1d4ed8";
    } else if (pLower.includes("sorcha")) {
      colorBg = "rgba(124, 58, 237, 0.15)";
      colorBorder = "#8b5cf6";
      colorText = "#6d28d9";
    } else if (pLower.includes("ava")) {
      colorBg = "rgba(236, 72, 153, 0.15)";
      colorBorder = "#ec4899";
      colorText = "#db2777";
    } else if (pLower.includes("dara")) {
      colorBg = "rgba(16, 185, 129, 0.15)";
      colorBorder = "#10b981";
      colorText = "#059669";
    } else {
      colorBg = "rgba(100, 116, 139, 0.15)";
      colorBorder = "#64748b";
      colorText = "#334155";
    }
  }

  const shortName = DAY_SHORT_LABELS[day] || day.slice(0, 3).toUpperCase();
  const starHtml = isTarget ? `<span class="daily-roster-target-star" title="Editing this day">★</span>` : "";

  return `
    <div class="daily-roster-day-header">
      <span class="daily-roster-day-name">${shortName}</span>
      ${starHtml}
    </div>
    <div class="roster-avatar-circle" style="background: ${colorBg}; border: 1.5px solid ${colorBorder}; color: ${colorText};">
      ${escapeHtml(initial)}
    </div>
    <span class="roster-member-name" title="${escapeHtml(nameLabel)}">${escapeHtml(nameLabel)}</span>
  `;
}

function renderDailyRosterInputs(task, activeTargetDay = null) {
  const rosterGrid = document.getElementById("task-form-daily-roster-grid");
  if (!rosterGrid) return;
  rosterGrid.innerHTML = "";

  currentRosterAssignments = {};
  WEEK_DAYS_7.forEach(day => {
    let assigned = "";
    if (task && task.assignedDays && task.assignedDays[day] !== undefined) {
      assigned = getAssigneeNames(task.assignedDays[day]).join(", ");
    } else if (task && task.assignedTo) {
      assigned = getAssigneeNames(task.assignedTo).join(", ");
    }
    currentRosterAssignments[day] = assigned;
  });

  WEEK_DAYS_7.forEach(day => {
    const isTarget = activeTargetDay === day;
    const assignedPerson = currentRosterAssignments[day] || "";

    const card = document.createElement("div");
    card.className = `daily-roster-day-card ${isTarget ? "is-active-day" : ""}`;
    card.setAttribute("data-day", day);
    card.setAttribute("data-assignee", assignedPerson);
    card.id = `roster-card-${day}`;
    card.title = `Tap to assign ${day} (Currently: ${assignedPerson || "Grab it"})`;

    card.innerHTML = getRosterDayCardInnerHtml(day, assignedPerson, isTarget);

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      openRosterMemberPopover(day, card);
    });

    rosterGrid.appendChild(card);
  });
}

function openRosterMemberPopover(day, anchorEl) {
  activePopoverDay = day;
  const popover = document.getElementById("roster-member-popover");
  const dayTitle = document.getElementById("popover-day-name");
  const membersRow = document.getElementById("popover-members-row");
  if (!popover || !membersRow) return;

  if (dayTitle) dayTitle.textContent = day;

  const currentAssigned = currentRosterAssignments[day] || "";
  let buttonsHtml = `
    <button type="button" class="popover-member-btn ${!currentAssigned ? 'is-selected' : ''}" data-member="">
      <span class="popover-avatar-circle" style="border: 2px dashed #f59e0b; background: rgba(245, 158, 11, 0.12); color: #d97706;">⚡</span>
      <span class="popover-member-label">Anyone</span>
    </button>
  `;

  familyMembers.forEach((m, idx) => {
    const isSel = currentAssigned.toLowerCase() === m.toLowerCase();
    const col = getMemberColor(idx);
    buttonsHtml += `
      <button type="button" class="popover-member-btn ${isSel ? 'is-selected' : ''}" data-member="${escapeHtml(m)}">
        <span class="popover-avatar-circle" style="border: 2px solid ${col.border}; background: ${col.bg}; color: var(--text-primary);">${escapeHtml(m.charAt(0).toUpperCase())}</span>
        <span class="popover-member-label">${escapeHtml(m)}</span>
      </button>
    `;
  });

  membersRow.innerHTML = buttonsHtml;

  membersRow.querySelectorAll(".popover-member-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const chosenMember = btn.getAttribute("data-member");
      setRosterDayAssignee(day, chosenMember);
      closeRosterMemberPopover();
    });
  });

  popover.style.display = "flex";

  // Measure actual rendered dimensions of popover
  const popoverRect = popover.getBoundingClientRect();
  const popoverWidth = popoverRect.width || popover.offsetWidth || 340;
  const popoverHeight = popoverRect.height || popover.offsetHeight || 110;

  // Position relative to modal-content
  const anchorRect = anchorEl.getBoundingClientRect();
  const modalEl = document.querySelector("#task-modal .modal-content") || taskModal;
  const modalRect = modalEl.getBoundingClientRect();

  // Center horizontally over the tapped day card
  const anchorCenter = (anchorRect.left - modalRect.left) + (anchorRect.width / 2);
  let left = anchorCenter - (popoverWidth / 2);

  // Keep popover safely inside the modal boundaries with a 12px margin
  const maxLeft = modalRect.width - popoverWidth - 12;
  const minLeft = 12;

  if (left > maxLeft) left = maxLeft;
  if (left < minLeft) left = minLeft;

  // Position vertically: below day card if it fits, else above
  let top = (anchorRect.bottom - modalRect.top) + 8;
  if (top + popoverHeight > modalRect.height - 16) {
    top = (anchorRect.top - modalRect.top) - popoverHeight - 8;
  }
  if (top < 10) top = 10;

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function closeRosterMemberPopover() {
  const popover = document.getElementById("roster-member-popover");
  if (popover) popover.style.display = "none";
  activePopoverDay = null;
}

function setRosterDayAssignee(day, memberName) {
  const applyAllCheckbox = document.getElementById("task-form-apply-all-days");
  const isApplyAll = applyAllCheckbox ? applyAllCheckbox.checked : false;

  if (isApplyAll) {
    WEEK_DAYS_7.forEach(d => {
      currentRosterAssignments[d] = memberName;
      const card = document.getElementById(`roster-card-${d}`);
      if (card) {
        const isTarget = document.getElementById("task-form-target-day")?.value === d;
        card.setAttribute("data-assignee", memberName);
        card.innerHTML = getRosterDayCardInnerHtml(d, memberName, isTarget);
      }
    });
  } else {
    currentRosterAssignments[day] = memberName;
    const card = document.getElementById(`roster-card-${day}`);
    if (card) {
      const isTarget = document.getElementById("task-form-target-day")?.value === day;
      card.setAttribute("data-assignee", memberName);
      card.innerHTML = getRosterDayCardInnerHtml(day, memberName, isTarget);
    }
  }

  const targetDay = document.getElementById("task-form-target-day")?.value;
  if (targetDay === day || isApplyAll) {
    const mainAssignee = document.getElementById("task-form-assignee");
    if (mainAssignee) mainAssignee.value = memberName;
  }
}

function updatePriorityToggleUI(isPriority) {
  const btn = document.getElementById("btn-priority-toggle");
  const icon = document.getElementById("priority-pill-icon");
  const text = document.getElementById("priority-pill-text");
  const hint = document.getElementById("priority-hint-text");
  const checkbox = document.getElementById("task-form-priority");

  const active = !!isPriority;
  if (checkbox) checkbox.checked = active;

  if (btn) {
    if (active) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      if (icon) icon.textContent = "🚨";
      if (text) text.textContent = "HIGH PRIORITY";
      if (hint) hint.textContent = "⚡ Pinned with urgent alert";
    } else {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
      if (icon) icon.textContent = "⚪";
      if (text) text.textContent = "Normal";
      if (hint) hint.textContent = "Tap to pin to top";
    }
  }
}

function updateRewardPresetChipsUI(currentVal) {
  const chipsContainer = document.getElementById("reward-preset-chips");
  if (!chipsContainer) return;
  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";

  const presets = isMoney ? [0.5, 1, 2, 3] : [1, 2, 3, 5];
  chipsContainer.innerHTML = presets.map(val => {
    const label = isMoney ? `${currency}${val.toFixed(val % 1 === 0 ? 0 : 2)}` : `+${val} pt${val > 1 ? "s" : ""}`;
    const isSelected = Math.abs(currentVal - val) < 0.01;
    return `<button type="button" class="reward-chip ${isSelected ? 'is-selected' : ''}" data-val="${val}">${label}</button>`;
  }).join("");

  chipsContainer.querySelectorAll(".reward-chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const val = parseFloat(chip.getAttribute("data-val"));
      const input = document.getElementById("task-form-reward");
      if (input && !isNaN(val)) {
        input.value = isMoney ? val.toFixed(2) : String(val);
        updateRewardPresetChipsUI(val);
      }
    });
  });
}

function openEditTaskModal(taskId, targetDay = null, targetDate = null) {
  const task = (window.currentTasks || currentTasks).find(t => t.id === taskId);
  if (!task) return;

  closeRosterMemberPopover();

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardLabel = document.getElementById("task-form-reward-label");
  if (rewardLabel) {
    rewardLabel.textContent = isMoney ? `Pocket Money (${currency})` : `Reward Points`;
  }

  initChoreEmojiPalette();
  const choreIcon = task.icon || detectEmojiForChore(task.title) || "🪴";
  isManualChoreEmoji = !!task.icon;
  setChoreEmoji(choreIcon);

  const emojiPalette = document.getElementById("task-emoji-palette");
  if (emojiPalette) emojiPalette.style.display = "none";

  document.getElementById("task-modal-icon").textContent = choreIcon;
  document.getElementById("task-modal-title").textContent = targetDay ? `Edit Chore (${targetDay})` : "Edit Task";
  document.getElementById("btn-save-task").textContent = "Save Changes";

  document.getElementById("task-form-id").value = task.id;
  const targetDayInput = document.getElementById("task-form-target-day");
  if (targetDayInput) targetDayInput.value = targetDay || "";

  document.getElementById("task-form-title").value = task.title || "";
  const initialDay = task.day || targetDay || "Sunday";
  document.getElementById("task-form-day").value = initialDay;
  document.getElementById("task-form-type").value = task.taskType || "Standard";

  const repeatOptWeekly = document.getElementById("task-repeat-opt-weekly");
  const repeatOptFortnightly = document.getElementById("task-repeat-opt-fortnightly");
  if (repeatOptWeekly) {
    repeatOptWeekly.textContent = (initialDay && initialDay !== "Daily" && initialDay !== "Anyday") ? `Weekly on ${initialDay}` : "Weekly";
  }
  if (repeatOptFortnightly) {
    repeatOptFortnightly.textContent = (initialDay && initialDay !== "Daily" && initialDay !== "Anyday") ? `Fortnightly on ${initialDay}` : "Fortnightly";
  }

  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const isWeekly = task.repeat === "weekly" || (!task.repeat && WEEK_DAYS_ORDER.includes(task.day));
  const initialRepeat = isDaily ? "daily" : (task.repeat || (isWeekly ? "weekly" : "none"));
  const repeatSelect = document.getElementById("task-form-repeat");
  if (repeatSelect) repeatSelect.value = initialRepeat;

  updateTaskFormRoomOptions();
  const roomSelect = document.getElementById("task-form-room");
  const roomCustom = document.getElementById("task-form-room-custom");
  const renameHint = document.getElementById("room-rename-hint");
  const currentRoom = task.room || "Kitchen";
  if (roomSelect) {
    let matched = false;
    for (const opt of roomSelect.options) {
      if (opt.value !== "__custom__" && opt.value.toLowerCase() === currentRoom.toLowerCase()) {
        roomSelect.value = opt.value;
        matched = true;
        break;
      }
    }
    if (matched) {
      if (roomCustom) {
        roomCustom.style.display = "none";
        roomCustom.value = "";
      }
      if (renameHint) {
        renameHint.style.display = (!isDefaultTurnbullBoard && roomSelect.value.startsWith("Bedroom ")) ? "block" : "none";
      }
    } else {
      roomSelect.value = "__custom__";
      if (roomCustom) {
        roomCustom.style.display = "block";
        roomCustom.value = currentRoom;
      }
      if (renameHint) renameHint.style.display = "none";
    }
  }

  document.getElementById("task-form-time").value = task.estimatedTime || "";

  const assigneeGroup = document.getElementById("task-form-assignee-group");
  const rosterBox = document.getElementById("task-form-daily-roster-box");
  const applyAllCheckbox = document.getElementById("task-form-apply-all-days");
  const moreDetails = document.getElementById("task-form-more-details");

  if (moreDetails) moreDetails.open = false; // Zero-scroll default

  if (isDaily) {
    if (rosterBox) rosterBox.style.display = "block";
    if (assigneeGroup) assigneeGroup.style.display = "none";
    if (applyAllCheckbox) applyAllCheckbox.checked = !targetDay;
    renderDailyRosterInputs(task, targetDay);
  } else {
    if (rosterBox) rosterBox.style.display = "none";
    if (assigneeGroup) assigneeGroup.style.display = "block";
  }

  // Resolve effective assignee for targetDay (or default)
  const effectiveAssignee = (isDaily && targetDay && task.assignedDays && task.assignedDays[targetDay] !== undefined)
    ? getAssigneeNames(task.assignedDays[targetDay]).join(", ")
    : getAssigneeNames(task.assignedTo).join(", ");
  document.getElementById("task-form-assignee").value = effectiveAssignee;

  const curReward = (typeof task.rewardValue === "number" && task.rewardValue >= 0)
    ? task.rewardValue
    : (typeof task.points === "number" && task.points >= 0 ? task.points : (isMoney ? 1.00 : 1));
  const rewardInput = document.getElementById("task-form-reward");
  if (rewardInput) rewardInput.value = isMoney ? curReward.toFixed(2) : String(curReward);
  updateRewardPresetChipsUI(curReward);

  document.getElementById("task-form-note").value = task.actionNote || "";
  updatePriorityToggleUI(!!task.isPriority);

  // Mark as Done / Undo Button inside Edit Modal
  const doneBtn = document.getElementById("btn-task-modal-mark-done");
  const doneBtnText = document.getElementById("btn-task-modal-mark-done-text");
  const doneBtnIcon = document.getElementById("btn-task-modal-mark-done-icon");
  if (doneBtn) {
    doneBtn.style.display = "inline-flex";
    const dayForStatus = targetDay || (task.day === "Daily" ? getTodayDayName() : (task.day || getTodayDayName()));
    const isDoneOnDay = isDaily
      ? !!(task.completedDays && task.completedDays[dayForStatus])
      : (isWeekly
          ? (task.completedWeeks && targetDate ? !!task.completedWeeks[getIsoWeekKey(new Date(targetDate))] : !!task.done)
          : !!task.done);
    const isFutureForChore = (isDaily || isWeekly) && isFutureDayForDaily(dayForStatus, targetDate);

    const rewardText = isMoney ? `${currency}${curReward.toFixed(2)}` : `+${curReward} pt${curReward > 1 ? "s" : ""}`;

    if (isDoneOnDay) {
      doneBtn.className = "btn-modal-mark-done is-completed";
      doneBtn.disabled = false;
      if (doneBtnIcon) doneBtnIcon.textContent = "✓";
      if (doneBtnText) doneBtnText.textContent = `Done on ${dayForStatus} (Tap to Undo)`;
      doneBtn.title = "Tap to undo this chore";
      doneBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTaskModal();
        handleUndoTask(task.id, dayForStatus, targetDate);
      };
    } else if (isFutureForChore) {
      doneBtn.className = "btn-modal-mark-done is-future-disabled";
      doneBtn.disabled = true;
      if (doneBtnIcon) doneBtnIcon.textContent = "⏰";
      if (doneBtnText) doneBtnText.textContent = `Available on ${dayForStatus}`;
      doneBtn.title = "Chores can only be completed on their scheduled day";
      doneBtn.onclick = (e) => {
        e.preventDefault();
      };
    } else {
      doneBtn.className = "btn-modal-mark-done";
      doneBtn.disabled = false;
      if (doneBtnIcon) doneBtnIcon.textContent = "⚡";
      if (doneBtnText) doneBtnText.textContent = `Mark Done (${rewardText})`;
      doneBtn.title = `Mark this chore done on ${dayForStatus}`;
      doneBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTaskModal();
        openClaimModal(task.id, dayForStatus, targetDate);
      };
    }
  }

  if (typeof taskModal.showModal === "function") {
    taskModal.showModal();
  } else {
    taskModal.setAttribute("open", "");
  }
  syncModalScrollLock();
}
window.openEditTaskModal = openEditTaskModal;

function openCreateTaskModal(targetDay = null) {
  closeRosterMemberPopover();

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardLabel = document.getElementById("task-form-reward-label");
  if (rewardLabel) {
    rewardLabel.textContent = isMoney ? `Pocket Money (${currency})` : `Reward Points`;
  }

  initChoreEmojiPalette();
  isManualChoreEmoji = false;
  setChoreEmoji("🪴");

  const emojiPalette = document.getElementById("task-emoji-palette");
  if (emojiPalette) emojiPalette.style.display = "none";

  document.getElementById("task-modal-icon").textContent = "🪴";
  document.getElementById("task-modal-title").textContent = targetDay ? `Add Chore (${targetDay})` : "Add New Task";
  document.getElementById("btn-save-task").textContent = "Add Task";

  const doneBtn = document.getElementById("btn-task-modal-mark-done");
  if (doneBtn) doneBtn.style.display = "none";

  let defaultDay = targetDay || "Sunday";
  let defaultType = (targetDay === "Daily") ? "Daily Task" : "Standard";
  let defaultRepeat = (targetDay === "Daily") ? "daily" : (targetDay ? "weekly" : "weekly");
  if (!targetDay) {
    if (activeCategoryFilter === "Daily") {
      defaultDay = "Daily";
      defaultType = "Daily Task";
      defaultRepeat = "daily";
    } else if (activeCategoryFilter === "Friday" || activeCategoryFilter === "Saturday" || activeCategoryFilter === "Sunday") {
      defaultDay = activeCategoryFilter;
      defaultRepeat = "weekly";
    } else if (activeCategoryFilter === "DIY Project") {
      defaultDay = "Saturday";
      defaultType = "DIY Project";
      defaultRepeat = "none";
    }
  }

  document.getElementById("task-form-id").value = "";
  const targetDayInput = document.getElementById("task-form-target-day");
  if (targetDayInput) targetDayInput.value = targetDay || "";

  document.getElementById("task-form-title").value = "";
  document.getElementById("task-form-day").value = defaultDay;
  document.getElementById("task-form-type").value = defaultType;

  const repeatOptWeekly = document.getElementById("task-repeat-opt-weekly");
  const repeatOptFortnightly = document.getElementById("task-repeat-opt-fortnightly");
  if (repeatOptWeekly) {
    repeatOptWeekly.textContent = (defaultDay && defaultDay !== "Daily" && defaultDay !== "Anyday") ? `Weekly on ${defaultDay}` : "Weekly";
  }
  if (repeatOptFortnightly) {
    repeatOptFortnightly.textContent = (defaultDay && defaultDay !== "Daily" && defaultDay !== "Anyday") ? `Fortnightly on ${defaultDay}` : "Fortnightly";
  }

  const repeatSelect = document.getElementById("task-form-repeat");
  if (repeatSelect) repeatSelect.value = defaultRepeat;

  updateTaskFormRoomOptions();
  const roomSelect = document.getElementById("task-form-room");
  const roomCustom = document.getElementById("task-form-room-custom");
  const renameHint = document.getElementById("room-rename-hint");
  if (roomSelect) roomSelect.value = "Kitchen";
  if (roomCustom) {
    roomCustom.style.display = "none";
    roomCustom.value = "";
  }
  if (renameHint) renameHint.style.display = "none";

  document.getElementById("task-form-time").value = "15 mins";
  document.getElementById("task-form-assignee").value = "";

  const isDaily = defaultRepeat === "daily" || defaultDay === "Daily" || defaultType === "Daily Task";
  const assigneeGroup = document.getElementById("task-form-assignee-group");
  const rosterBox = document.getElementById("task-form-daily-roster-box");
  const applyAllCheckbox = document.getElementById("task-form-apply-all-days");
  const moreDetails = document.getElementById("task-form-more-details");

  if (moreDetails) moreDetails.open = false;

  if (isDaily) {
    if (rosterBox) rosterBox.style.display = "block";
    if (assigneeGroup) assigneeGroup.style.display = "none";
    if (applyAllCheckbox) applyAllCheckbox.checked = true;
    renderDailyRosterInputs(null, targetDay);
  } else {
    if (rosterBox) rosterBox.style.display = "none";
    if (assigneeGroup) assigneeGroup.style.display = "block";
  }

  const defaultReward = isMoney ? 1.00 : 1;
  const rewardInput = document.getElementById("task-form-reward");
  if (rewardInput) rewardInput.value = isMoney ? "1.00" : "1";
  updateRewardPresetChipsUI(defaultReward);

  document.getElementById("task-form-note").value = "";
  updatePriorityToggleUI(false);

  if (typeof taskModal.showModal === "function") {
    taskModal.showModal();
  } else {
    taskModal.setAttribute("open", "");
  }
  syncModalScrollLock();
}
window.openCreateTaskModal = openCreateTaskModal;

function closeTaskModal() {
  closeRosterMemberPopover();
  if (typeof taskModal.close === "function") {
    taskModal.close();
  } else {
    taskModal.removeAttribute("open");
  }
  syncModalScrollLock();
}
window.closeTaskModal = closeTaskModal;

async function handleSaveTaskForm(e) {
  e.preventDefault();
  closeRosterMemberPopover();

  const id = document.getElementById("task-form-id").value;
  const title = document.getElementById("task-form-title").value.trim();
  const day = document.getElementById("task-form-day").value;
  const repeat = document.getElementById("task-form-repeat")?.value || "weekly";
  const icon = document.getElementById("task-form-icon")?.value || detectEmojiForChore(title) || "🪴";
  const taskType = document.getElementById("task-form-type").value;
  const isDaily = repeat === "daily" || day === "Daily" || taskType === "Daily Task";
  const targetDay = document.getElementById("task-form-target-day")?.value || null;
  const applyAllCheckbox = document.getElementById("task-form-apply-all-days");
  const applyAll = applyAllCheckbox ? applyAllCheckbox.checked : false;

  const roomSelect = document.getElementById("task-form-room");
  const roomCustom = document.getElementById("task-form-room-custom");
  let room = "House";
  if (roomSelect) {
    if (roomSelect.value === "__custom__" && roomCustom) {
      room = roomCustom.value.trim() || "House";
    } else {
      room = roomSelect.value || "House";
    }
  }

  const estimatedTime = document.getElementById("task-form-time").value.trim() || "15 mins";
  const mainAssignee = document.getElementById("task-form-assignee").value || null;
  const actionNote = document.getElementById("task-form-note").value.trim();
  const isPriority = document.getElementById("task-form-priority").checked;
  const rewardInput = document.getElementById("task-form-reward");
  const rawReward = rewardInput ? parseFloat(rewardInput.value) : NaN;
  const rewardValue = (!isNaN(rawReward) && rawReward >= 0) ? rawReward : (boardSettings.gameMode === "money" ? 1.00 : 1);

  if (!title) return;

  // Category fallback for backwards compatibility
  let category = "Saturday Reset";
  if (day === "Friday") category = "Friday Purge";
  else if (taskType === "DIY Project") category = "DIY Backlog";

  // Build Day-by-Day assignments if daily task
  let assignedDays = null;
  let finalAssignedTo = mainAssignee;

  if (isDaily) {
    assignedDays = {};
    WEEK_DAYS_7.forEach(d => {
      const card = document.getElementById(`roster-card-${d}`);
      const val = card ? card.getAttribute("data-assignee") : (currentRosterAssignments[d] || null);
      assignedDays[d] = val || null;
    });

    if (applyAll) {
      finalAssignedTo = mainAssignee;
      assignedDays = {
        Monday: mainAssignee,
        Tuesday: mainAssignee,
        Wednesday: mainAssignee,
        Thursday: mainAssignee,
        Friday: mainAssignee,
        Saturday: mainAssignee,
        Sunday: mainAssignee
      };
    } else {
      const existingTask = currentTasks.find(t => t.id === id);
      finalAssignedTo = existingTask?.assignedTo || mainAssignee || null;
    }
  }

  if (id) {
    // EDIT EXISTING TASK
    const taskIndex = currentTasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const updatedTask = {
      ...currentTasks[taskIndex],
      title,
      icon,
      repeat,
      day,
      taskType,
      category,
      room,
      estimatedTime,
      assignedTo: finalAssignedTo,
      assignedDays: assignedDays,
      rewardValue,
      actionNote,
      isPriority
    };

    closeTaskModal();

    if (db) {
      try {
        const docRef = getTaskDocRef(id);
        const updatePayload = {
          title,
          icon,
          repeat,
          day,
          taskType,
          category,
          room,
          estimatedTime,
          assignedTo: finalAssignedTo,
          rewardValue,
          actionNote,
          isPriority
        };
        if (assignedDays !== null) {
          updatePayload.assignedDays = assignedDays;
        }
        await updateDoc(docRef, updatePayload);
        return;
      } catch (err) {
        console.warn("Failed to update task in Firestore, updating locally:", err);
      }
    }

    // Local fallback
    currentTasks[taskIndex] = updatedTask;
    saveLocalCache(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  } else {
    // CREATE NEW TASK
    const newId = "task-" + Date.now();
    const newTask = {
      id: newId,
      title,
      icon,
      repeat,
      day,
      taskType,
      category,
      room,
      estimatedTime,
      assignedTo: finalAssignedTo,
      assignedDays: assignedDays,
      rewardValue,
      actionNote,
      isPriority,
      done: false,
      completedBy: null,
      completedAt: null,
      completedWeeks: {},
      order: currentTasks.length + 1
    };

    closeTaskModal();

    if (db) {
      try {
        const docRef = getTaskDocRef(newId);
        await setDoc(docRef, {
          ...newTask,
          createdAt: serverTimestamp()
        });
        return;
      } catch (err) {
        console.warn("Failed to create task in Firestore, saving locally:", err);
      }
    }

    currentTasks.push(newTask);
    saveLocalCache(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  }
}

// ----------------------------------------------------------------------------
// DELETE TASK MODAL
// ----------------------------------------------------------------------------
// UNIVERSAL DELETE CONFIRMATION MODAL
// ----------------------------------------------------------------------------
let pendingDeleteAction = null;

function showDeleteConfirmation({
  icon = "🗑️",
  title = "Delete Item?",
  itemTitle = "",
  warning = "This action cannot be undone.",
  confirmLabel = "Delete",
  onConfirm = null
}) {
  pendingDeleteAction = onConfirm;

  const iconEl = document.getElementById("delete-modal-icon");
  const titleEl = document.getElementById("delete-modal-title");
  const itemTitleEl = document.getElementById("delete-modal-task-title");
  const warningEl = document.getElementById("delete-modal-warning");
  const confirmBtn = document.getElementById("btn-confirm-delete");

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (itemTitleEl) itemTitleEl.textContent = itemTitle ? `"${itemTitle}"` : "";
  if (warningEl) warningEl.textContent = warning;
  if (confirmBtn) confirmBtn.textContent = confirmLabel;

  if (deleteModal) {
    if (typeof deleteModal.showModal === "function") deleteModal.showModal();
    else deleteModal.setAttribute("open", "");
  }
}
window.showDeleteConfirmation = showDeleteConfirmation;

function openDeleteTaskModal(taskId) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  showDeleteConfirmation({
    icon: "🗑️",
    title: "Delete Task?",
    itemTitle: task.title,
    warning: "This will remove the task permanently from your challenge board.",
    confirmLabel: "Delete Task",
    onConfirm: async () => {
      if (db) {
        try {
          const docRef = getTaskDocRef(taskId);
          await deleteDoc(docRef);
          return;
        } catch (err) {
          console.warn("Failed to delete task from Firestore, deleting locally:", err);
        }
      }

      // Local fallback
      currentTasks = currentTasks.filter(t => t.id !== taskId);
      saveLocalCache(currentTasks);
      renderApp();
    renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
    }
  });
}

function closeDeleteModal() {
  taskToDelete = null;
  pendingDeleteAction = null;
  if (deleteModal) {
    if (typeof deleteModal.close === "function") {
      deleteModal.close();
    } else {
      deleteModal.removeAttribute("open");
    }
  }
}

async function handleConfirmDelete() {
  const action = pendingDeleteAction;
  pendingDeleteAction = null;
  closeDeleteModal();

  if (typeof action === "function") {
    await action();
  }
}

// ----------------------------------------------------------------------------
// QUICK ASSIGN TASK MODAL
// ----------------------------------------------------------------------------
function openAssignModal(taskId) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  taskToAssign = task;
  const titleEl = document.getElementById("assign-modal-task-title");
  if (titleEl) titleEl.textContent = task.title;

  const grid = document.getElementById("assign-modal-member-grid");
  if (grid) {
    grid.innerHTML = "";
    familyMembers.forEach((member, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "member-claim-btn";
      const isCurrent = task.assignedTo === member;
      if (isCurrent) btn.classList.add("selected");

      const color = getMemberColor(idx);
      const initial = member.charAt(0).toUpperCase();

      btn.innerHTML = `
        <div class="claim-avatar" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
        <div class="claim-info">
          <span class="claim-name">${escapeHtml(member)}</span>
          <span class="claim-reward">${isCurrent ? 'Currently Assigned' : 'Assign to ' + escapeHtml(member)}</span>
        </div>
      `;

      btn.addEventListener("click", () => {
        handleSetAssignee(member);
      });

      grid.appendChild(btn);
    });
  }

  if (assignModal) {
    if (typeof assignModal.showModal === "function") assignModal.showModal();
    else assignModal.setAttribute("open", "");
  }
}

function closeAssignModal() {
  taskToAssign = null;
  if (assignModal) {
    if (typeof assignModal.close === "function") assignModal.close();
    else assignModal.removeAttribute("open");
  }
}

async function handleSetAssignee(memberName) {
  if (!taskToAssign) return;
  const taskId = taskToAssign.id;
  const newAssignee = memberName || null;
  closeAssignModal();

  if (db) {
    try {
      const docRef = getTaskDocRef(taskId);
      await updateDoc(docRef, {
        assignedTo: newAssignee
      });
      return;
    } catch (err) {
      console.warn("Failed to update assignee in Firestore, saving locally:", err);
    }
  }

  const idx = currentTasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    currentTasks[idx].assignedTo = newAssignee;
    saveLocalCache(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  }
}

function renderClaimModalMembers() {
  const grid = document.getElementById("modal-member-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardVal = (taskToClaim && typeof taskToClaim.rewardValue === "number" && taskToClaim.rewardValue > 0)
    ? taskToClaim.rewardValue
    : (isMoney ? 1.00 : 1);
  const rewardLabel = isMoney
    ? `+${currency}${rewardVal.toFixed(2)}`
    : `+${rewardVal} ${rewardVal === 1 ? 'Point' : 'Points'}`;

  // Dynamically update the modal hint text to match this task's actual reward value
  const hintEl = document.getElementById("claim-modal-hint");
  if (hintEl) {
    const eachSuffix = isMoney ? `+${currency}${rewardVal.toFixed(2)} each` : `+${rewardVal} ${rewardVal === 1 ? 'pt' : 'pts'} each`;
    hintEl.textContent = `Select one, multiple people, or Team Effort (${eachSuffix})`;
  }

  familyMembers.forEach((member, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "member-claim-btn toggle-member-btn";
    btn.setAttribute("data-claim-member", member);
    btn.id = `claim-${member.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    const color = getMemberColor(idx);
    const initial = member.charAt(0).toUpperCase();

    btn.innerHTML = `
      <div class="claim-avatar" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
      <div class="claim-info">
        <span class="claim-name">${escapeHtml(member)}</span>
        <span class="claim-reward">${rewardLabel}</span>
      </div>
      <span class="claim-checkbox" aria-hidden="true"></span>
    `;

    btn.addEventListener("click", () => {
      toggleClaimMember(btn);
    });

    grid.appendChild(btn);
  });

  // Team Effort button
  const teamBtn = document.createElement("button");
  teamBtn.type = "button";
  teamBtn.className = "member-claim-btn team-claim-btn";
  teamBtn.setAttribute("data-claim-member", "Team Effort");
  teamBtn.id = "claim-team";

  const teamRewardLabel = isMoney
    ? `All Members (+${currency}${rewardVal.toFixed(2)} Each)`
    : `All Members (+${rewardVal} ${rewardVal === 1 ? 'Pt' : 'Pts'} Each)`;

  teamBtn.innerHTML = `
    <div class="claim-avatar" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); border: 2px solid #fbbf24;">🤝</div>
    <div class="claim-info">
      <span class="claim-name">Team Effort</span>
      <span class="claim-reward">${teamRewardLabel}</span>
    </div>
    <span class="claim-checkbox" aria-hidden="true"></span>
  `;

  teamBtn.addEventListener("click", () => {
    toggleClaimMember(teamBtn);
  });

  grid.appendChild(teamBtn);
}

let claimTargetDay = null;
let claimTargetDate = null;

function openClaimModal(taskId, targetDay = null, targetDate = null) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const isWeekly = task.repeat === "weekly";
  const effectiveDay = targetDay || (WEEK_DAYS_ORDER.includes(activeCategoryFilter) ? activeCategoryFilter : getTodayDayName());

  // Prevent completing daily and weekly tasks for future days
  if ((isDaily || isWeekly) && isFutureDayForDaily(effectiveDay, targetDate)) {
    if (typeof showCalendarToast === "function") {
      showCalendarToast(`⏰ "${task.title}" is scheduled for ${effectiveDay} and cannot be completed in advance!`);
    } else {
      alert(`Chores cannot be completed in advance.`);
    }
    return;
  }

  taskToClaim = task;
  claimTargetDay = effectiveDay;
  claimTargetDate = targetDate || null;
  selectedClaimMembers.clear();

  const displayTitle = isDaily && claimTargetDay !== getTodayDayName()
    ? `${task.title} (${claimTargetDay})`
    : task.title;
  document.getElementById("modal-task-name").textContent = displayTitle;

  const hintEl = document.getElementById("claim-modal-hint");
  if (hintEl) {
    const effectiveAssignee = (isDaily && claimTargetDay && task.assignedDays && task.assignedDays[claimTargetDay] !== undefined)
      ? task.assignedDays[claimTargetDay]
      : task.assignedTo;
    const named = getAssigneeNames(effectiveAssignee).filter(n => !["anyone", "unassigned", "up for grabs"].includes(n.toLowerCase()));
    hintEl.textContent = !named.length
      ? "⚡ Grab it! Tap who completed this chore to claim the points:"
      : `Assigned to ${formatAssigneeNames(named)}. Select who completed this chore:`;
  }

  // Re-render members dynamically
  renderClaimModalMembers();
  updateConfirmButton();
  
  if (typeof claimModal.showModal === "function") {
    claimModal.showModal();
  } else {
    claimModal.setAttribute("open", "");
  }
}

function toggleClaimMember(btn) {
  const member = btn.getAttribute("data-claim-member");
  const memberButtons = document.querySelectorAll(".member-claim-btn");

  if (member === "Team Effort") {
    if (selectedClaimMembers.has("Team Effort")) {
      selectedClaimMembers.clear();
      btn.classList.remove("selected");
    } else {
      selectedClaimMembers.clear();
      memberButtons.forEach(b => b.classList.remove("selected"));
      selectedClaimMembers.add("Team Effort");
      btn.classList.add("selected");
    }
  } else {
    if (selectedClaimMembers.has("Team Effort")) {
      selectedClaimMembers.delete("Team Effort");
      const teamBtn = document.getElementById("claim-team");
      if (teamBtn) teamBtn.classList.remove("selected");
    }

    if (selectedClaimMembers.has(member)) {
      selectedClaimMembers.delete(member);
      btn.classList.remove("selected");
    } else {
      selectedClaimMembers.add(member);
      btn.classList.add("selected");
    }
  }

  updateConfirmButton();
}

function updateConfirmButton() {
  const confirmBtn = document.getElementById("btn-confirm-claim");
  if (!confirmBtn) return;
  const textSpan = confirmBtn.querySelector(".btn-confirm-text") || confirmBtn;

  const count = selectedClaimMembers.size;
  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardVal = (taskToClaim && typeof taskToClaim.rewardValue === "number" && taskToClaim.rewardValue > 0)
    ? taskToClaim.rewardValue
    : (isMoney ? 1.00 : 1);

  const rewardLabel = isMoney ? `${currency}${rewardVal.toFixed(2)}` : `${rewardVal} pt${rewardVal === 1 ? '' : 's'}`;

  if (count === 0) {
    confirmBtn.disabled = true;
    textSpan.textContent = "Select Member(s)";
  } else if (selectedClaimMembers.has("Team Effort")) {
    confirmBtn.disabled = false;
    textSpan.textContent = `Confirm Team Effort (+${rewardLabel} to everyone)`;
  } else if (count === 1) {
    const [name] = selectedClaimMembers;
    confirmBtn.disabled = false;
    textSpan.textContent = `Done by ${name} (+${rewardLabel})`;
  } else {
    const names = Array.from(selectedClaimMembers).join(" & ");
    confirmBtn.disabled = false;
    textSpan.textContent = `Done by ${names} (+${rewardLabel} each)`;
  }
}

function closeClaimModal() {
  taskToClaim = null;
  claimTargetDay = null;
  claimTargetDate = null;
  selectedClaimMembers.clear();
  if (typeof claimModal.close === "function") {
    claimModal.close();
  } else {
    claimModal.removeAttribute("open");
  }
}

function showGamifiedCelebration({ claimValue, rewardVal, isMoney, currency, taskTitle }) {
  const container = document.getElementById("celebration-toast-anchor");
  if (!container) return;

  container.innerHTML = "";

  const tierClass = getRewardTierClass(rewardVal);
  const rewardLabel = isMoney 
    ? `${currency}${rewardVal.toFixed(2)}` 
    : `${rewardVal} ${rewardVal === 1 ? 'Point' : 'Points'}`;

  let avatarHtml = "";
  let headlineHtml = "";

  if (claimValue === "Team Effort") {
    avatarHtml = `
      <div class="celebration-avatar-ring" style="background: linear-gradient(135deg, #f59e0b, #ec4899); border-color: #fbbf24;">🤝</div>
      <span class="celebration-avatar-badge">${isMoney ? '💰' : '🏆'}</span>
    `;
    headlineHtml = `Family Team Effort! 🎉`;
  } else {
    const members = claimValue.split(",").map(s => s.trim()).filter(Boolean);
    if (members.length === 1) {
      const memberName = members[0];
      const memberIdx = familyMembers.indexOf(memberName);
      const col = getMemberColor(memberIdx !== -1 ? memberIdx : 0);
      const initial = memberName.charAt(0).toUpperCase();

      avatarHtml = `
        <div class="celebration-avatar-ring" style="background: ${col.bg}; border-color: ${col.border};">${escapeHtml(initial)}</div>
        <span class="celebration-avatar-badge">${isMoney ? '💰' : '🏆'}</span>
      `;
      headlineHtml = `${escapeHtml(memberName)} Crushed It! 🎉`;
    } else {
      const memberNames = members.join(" & ");
      avatarHtml = `
        <div class="celebration-avatar-ring" style="background: linear-gradient(135deg, #38bdf8, #a855f7); border-color: #c084fc;">👥</div>
        <span class="celebration-avatar-badge">${isMoney ? '💰' : '🏆'}</span>
      `;
      headlineHtml = `${escapeHtml(memberNames)} Crushed It! 🎉`;
    }
  }

  // Soft backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "celebration-backdrop";

  const card = document.createElement("div");
  card.className = `celebration-card ${tierClass}`;
  card.id = "active-celebration-toast";
  card.setAttribute("role", "alert");

  card.innerHTML = `
    <button type="button" class="celebration-dismiss-btn" title="Dismiss" aria-label="Dismiss">×</button>
    
    <div class="celebration-top-row">
      <span class="celebration-pill-tag tag-celebrate">⚡ CHORE SMASHED! ⚡</span>
    </div>

    <div class="celebration-avatar-wrap">
      ${avatarHtml}
    </div>

    <div class="celebration-headline">
      ${headlineHtml}
    </div>

    <div class="celebration-big-reward">
      <span class="card-reward-badge ${tierClass}">+${escapeHtml(rewardLabel)}</span>
    </div>

    <div class="celebration-task-title">
      ${escapeHtml(taskTitle || 'Chore')}
    </div>
  `;

  let dismissTimer = null;
  function dismiss() {
    if (dismissTimer) clearTimeout(dismissTimer);
    card.classList.add("is-dismissing");
    backdrop.classList.add("is-dismissing");
    setTimeout(() => {
      container.innerHTML = "";
    }, 320);
  }

  // Dismiss when clicking outside (on backdrop) or close button
  backdrop.addEventListener("click", dismiss);
  card.addEventListener("click", (e) => {
    e.stopPropagation(); // Clicking on card does NOT dismiss it
  });

  const dismissBtn = card.querySelector(".celebration-dismiss-btn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
    });
  }

  container.appendChild(backdrop);
  container.appendChild(card);

  // Stays on screen for 8 seconds before auto-dismissing
  dismissTimer = setTimeout(dismiss, 8000);
}

async function handleConfirmClaim() {
  if (!taskToClaim || selectedClaimMembers.size === 0) return;

  const task = taskToClaim;
  const taskId = task.id;
  let claimValue = "";

  if (selectedClaimMembers.has("Team Effort")) {
    claimValue = "Team Effort";
  } else {
    claimValue = Array.from(selectedClaimMembers).join(", ");
  }

  const targetDay = claimTargetDay || (WEEK_DAYS_ORDER.includes(activeCategoryFilter) ? activeCategoryFilter : getTodayDayName());
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const isWeekly = task.repeat === "weekly";

  if ((isDaily || isWeekly) && isFutureDayForDaily(targetDay, claimTargetDate)) {
    closeClaimModal();
    if (typeof showCalendarToast === "function") {
      showCalendarToast(`⏰ Chores cannot be marked done in advance!`);
    }
    return;
  }

  closeClaimModal();

  // Play celebration effects immediately on claiming device
  if (boardSettings.gameMode === "money") {
    sfx.playCoinChime();
  } else {
    sfx.playCelebrationChime();
  }
  triggerConfettiBurst();

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const rewardVal = (typeof task.rewardValue === "number" && task.rewardValue > 0)
    ? task.rewardValue
    : (isMoney ? 1.00 : 1);

  // Gamified celebration announcement toast
  showGamifiedCelebration({
    claimValue,
    rewardVal,
    isMoney,
    currency,
    taskTitle: task.title
  });

  const timestamp = new Date().toISOString();
  const currentWeekKey = getIsoWeekKey();

  if (isDaily) {
    const currentCompletedDays = { ...(task.completedDays || {}) };
    currentCompletedDays[targetDay] = {
      completedBy: claimValue,
      completedAt: timestamp,
      completedWeek: currentWeekKey
    };

    const isToday = targetDay === getTodayDayName();
    const todayKey = getLocalDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterdayDate);

    let streak = Number(task.streak) || 0;
    if (isToday) {
      if (task.lastStreakDate === yesterdayKey) {
        streak += 1;
      } else if (task.lastStreakDate === todayKey) {
        streak = Math.max(1, streak);
      } else {
        streak = 1;
      }
      task.streak = streak;
      task.lastStreakDate = todayKey;
    }

    const updatePayload = {
      completedDays: currentCompletedDays
    };
    if (isToday) {
      updatePayload.done = true;
      updatePayload.completedBy = claimValue;
      updatePayload.completedAt = serverTimestamp();
      updatePayload.completedWeek = currentWeekKey;
      updatePayload.streak = streak;
      updatePayload.lastStreakDate = todayKey;

      if (streak === 7) {
        if (typeof sfx !== "undefined" && sfx && sfx.playTrophyChime) sfx.playTrophyChime();
        if (typeof showCalendarToast === "function") {
          showCalendarToast(`🏆 7-Day Streak Milestone! +5 Bonus Points for ${claimValue}! 🔥`);
        }
      }
    }

    // Optimistically update local task state immediately for zero-latency UI response
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx].completedDays = currentCompletedDays;
      if (isToday) {
        currentTasks[idx].done = true;
        currentTasks[idx].completedBy = claimValue;
        currentTasks[idx].completedAt = timestamp;
        currentTasks[idx].completedWeek = currentWeekKey;
        currentTasks[idx].streak = streak;
        currentTasks[idx].lastStreakDate = todayKey;
      }
      saveLocalCache(currentTasks);
      renderApp();
    renderSkylightTasksPage();
    }

    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, updatePayload);
      } catch (err) {
        console.warn("Failed to update Firestore, saved locally:", err);
      }
    }
    return;
  }

  if (isWeekly) {
    const targetWeekKey = claimTargetDate ? getIsoWeekKey(new Date(claimTargetDate)) : currentWeekKey;
    const currentCompletedWeeks = { ...(task.completedWeeks || {}) };
    currentCompletedWeeks[targetWeekKey] = {
      completedBy: claimValue,
      completedAt: timestamp,
      date: claimTargetDate || getLocalDateKey(new Date())
    };

    const isCurrentWeek = (targetWeekKey === currentWeekKey);
    const updatePayload = {
      completedWeeks: currentCompletedWeeks
    };
    if (isCurrentWeek) {
      updatePayload.done = true;
      updatePayload.completedBy = claimValue;
      updatePayload.completedAt = serverTimestamp();
      updatePayload.completedWeek = currentWeekKey;
      updatePayload.completedDay = targetDay;
    }

    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx].completedWeeks = currentCompletedWeeks;
      if (isCurrentWeek) {
        currentTasks[idx].done = true;
        currentTasks[idx].completedBy = claimValue;
        currentTasks[idx].completedAt = timestamp;
        currentTasks[idx].completedWeek = currentWeekKey;
        currentTasks[idx].completedDay = targetDay;
      }
      saveLocalCache(currentTasks);
      renderApp();
    renderSkylightTasksPage();
    }

    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, updatePayload);
      } catch (err) {
        console.warn("Failed to update weekly chore on Firestore:", err);
      }
    }
    return;
  }

  // Non-daily task: optimistically update locally first
  const idx = currentTasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    const completedDay = targetDay || getTodayDayName();
    currentTasks[idx].done = true;
    currentTasks[idx].completedBy = claimValue;
    currentTasks[idx].completedAt = timestamp;
    currentTasks[idx].completedWeek = currentWeekKey;
    currentTasks[idx].completedDay = completedDay;
    currentTasks[idx].day = completedDay; // Move to the day it was completed!
    saveLocalCache(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  }

  if (db) {
    try {
      const completedDay = targetDay || getTodayDayName();
      const docRef = getTaskDocRef(taskId);
      await updateDoc(docRef, {
        done: true,
        completedBy: claimValue,
        completedAt: serverTimestamp(),
        completedWeek: currentWeekKey,
        completedDay: completedDay,
        day: completedDay
      });
    } catch (err) {
      console.warn("Failed to update Firestore, saved locally:", err);
    }
  }
}

async function handleUndoTask(taskId, targetDay = null, targetDate = null, memberToUndo = null) {
  sfx.playUndoPop();

  const task = currentTasks.find(t => t.id === taskId);
  const isDaily = task && (task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task");
  const isWeekly = task && task.repeat === "weekly";
  const dayToRemove = targetDay || (WEEK_DAYS_ORDER.includes(activeCategoryFilter) ? activeCategoryFilter : getTodayDayName());

  if (isDaily && task) {
    const currentCompletedDays = { ...(task.completedDays || {}) };
    const assignedList = getAssignedMembersList(task.assignedTo);
    const isMultiAssign = assignedList.length > 1;
    if (memberToUndo && isMultiAssign) {
      const rec = currentCompletedDays[dayToRemove];
      if (rec) {
        let list = Array.isArray(rec.completedBy) ? [...rec.completedBy] : (typeof rec.completedBy === "string" ? rec.completedBy.split(",").map(s => s.trim()) : []);
        list = list.filter(m => m.toLowerCase() !== memberToUndo.toLowerCase());
        if (list.length > 0) {
          currentCompletedDays[dayToRemove] = { ...rec, completedBy: list };
        } else {
          delete currentCompletedDays[dayToRemove];
        }
      }
    } else {
      delete currentCompletedDays[dayToRemove];
    }
    const isToday = dayToRemove === getTodayDayName();

    const updatePayload = {
      completedDays: currentCompletedDays
    };
    if (isToday) {
      const undoStreak = Math.max(0, (Number(task.streak) || 1) - 1);
      updatePayload.done = false;
      updatePayload.completedBy = null;
      updatePayload.completedAt = null;
      updatePayload.streak = undoStreak;
      updatePayload.lastStreakDate = null;
      task.streak = undoStreak;
      task.lastStreakDate = null;
    }

    // Optimistically update local task state immediately
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx].completedDays = currentCompletedDays;
      if (isToday) {
        currentTasks[idx].done = false;
        currentTasks[idx].completedBy = null;
        currentTasks[idx].completedAt = null;
      }
      saveLocalCache(currentTasks);
      renderApp();
    renderSkylightTasksPage();
    }

    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, updatePayload);
      } catch (err) {
        console.warn("Failed to undo in Firestore, saving locally:", err);
      }
    }
    return;
  }

  if (isWeekly && task) {
    const targetWeekKey = targetDate ? getIsoWeekKey(new Date(targetDate)) : getIsoWeekKey();
    const currentCompletedWeeks = { ...(task.completedWeeks || {}) };
    delete currentCompletedWeeks[targetWeekKey];
    const isCurrentWeek = (targetWeekKey === getIsoWeekKey());

    const updatePayload = {
      completedWeeks: currentCompletedWeeks
    };
    if (isCurrentWeek) {
      updatePayload.done = false;
      updatePayload.completedBy = null;
      updatePayload.completedAt = null;
      updatePayload.completedWeek = null;
    }

    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx].completedWeeks = currentCompletedWeeks;
      if (isCurrentWeek) {
        currentTasks[idx].done = false;
        currentTasks[idx].completedBy = null;
        currentTasks[idx].completedAt = null;
        currentTasks[idx].completedWeek = null;
      }
      saveLocalCache(currentTasks);
      renderApp();
    renderSkylightTasksPage();
    }

    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, updatePayload);
      } catch (err) {
        console.warn("Failed to undo weekly chore on Firestore:", err);
      }
    }
    return;
  }

  // Non-daily undo: optimistically update locally first
  const assignedList = getAssignedMembersList(task ? task.assignedTo : null);
  const isMultiAssign = assignedList.length > 1;
  const idx = currentTasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    if (memberToUndo && isMultiAssign) {
      let list = Array.isArray(currentTasks[idx].completedBy) ? [...currentTasks[idx].completedBy] : (typeof currentTasks[idx].completedBy === "string" ? currentTasks[idx].completedBy.split(",").map(s => s.trim()) : []);
      list = list.filter(m => m.toLowerCase() !== memberToUndo.toLowerCase());
      currentTasks[idx].completedBy = list.length > 0 ? list : null;
      currentTasks[idx].done = false;
    } else {
      currentTasks[idx].done = false;
      currentTasks[idx].completedBy = null;
      currentTasks[idx].completedAt = null;
    }
    saveLocalCache(currentTasks);
    renderApp();
    renderSkylightTasksPage();
  }

  if (db) {
    try {
      const docRef = getTaskDocRef(taskId);
      await updateDoc(docRef, {
        done: false,
        completedBy: null,
        completedAt: null
      });
    } catch (err) {
      console.warn("Failed to undo in Firestore, saving locally:", err);
    }
  }
}

// ============================================================================
// MODAL SCROLL LOCK & SCROLL BLEED PREVENTION
// ============================================================================
function syncModalScrollLock() {
  if (typeof document === "undefined") return;
  const dialogs = document.querySelectorAll("dialog");
  let anyOpen = false;
  dialogs.forEach(d => {
    if (d.open || d.hasAttribute("open") || (d.style && d.style.display !== "none" && d.style.display !== "")) {
      anyOpen = true;
    }
  });

  if (anyOpen) {
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
  } else {
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
  }
}
window.syncModalScrollLock = syncModalScrollLock;

// ============================================================================
// 10. EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  assignModal = document.getElementById("assign-modal");
  claimModal = document.getElementById("claim-modal");
  configModal = document.getElementById("config-modal");
  taskModal = document.getElementById("task-modal");
  deleteModal = document.getElementById("delete-modal");
  settingsModal = document.getElementById("settings-modal");
  onboardingModal = document.getElementById("onboarding-modal");
  aiModal = document.getElementById("ai-modal");

  // Set up dialog scroll-bleed and background lock observers
  if (typeof MutationObserver !== "undefined") {
    const dialogObserver = new MutationObserver(() => {
      syncModalScrollLock();
    });
    document.querySelectorAll("dialog").forEach(dialog => {
      dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open", "style", "class"] });
      dialog.addEventListener("close", syncModalScrollLock);
      dialog.addEventListener("cancel", syncModalScrollLock);
    });
  }

  // Prevent wheel and touch gestures on modal backdrop from scrolling background app
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("wheel", (e) => {
      const openDialog = document.querySelector("dialog[open], dialog[open='true']");
      if (!openDialog) return;
      if (e.target === openDialog || (e.target.classList && e.target.classList.contains("modal-backdrop-blur")) || !openDialog.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
      const openDialog = document.querySelector("dialog[open], dialog[open='true']");
      if (!openDialog) return;
      if (e.target === openDialog || (e.target.classList && e.target.classList.contains("modal-backdrop-blur")) || !openDialog.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  // Category / Day / Type tabs filter
  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeCategoryFilter = tab.getAttribute("data-filter") || tab.getAttribute("data-category") || "ALL";
      renderTaskLists();
    });
  });

  // Task Feed Delegation (Mark Done, Undo, Edit, Delete, Assign)
  const taskFeed = document.getElementById("task-feed-container");
  if (taskFeed) {
    taskFeed.addEventListener("click", (e) => {
      const assignBtn = e.target.closest(".btn-open-assign");
      if (assignBtn) {
        const taskId = assignBtn.getAttribute("data-task-id");
        openAssignModal(taskId);
        return;
      }

      const markDoneBtn = e.target.closest(".btn-mark-done");
      if (markDoneBtn) {
        if (markDoneBtn.classList.contains("is-locked") || markDoneBtn.disabled) return;
        const taskId = markDoneBtn.getAttribute("data-task-id");
        const targetDay = markDoneBtn.getAttribute("data-day");
        openClaimModal(taskId, targetDay);
        return;
      }

      const undoBtn = e.target.closest(".btn-undo");
      if (undoBtn) {
        const taskId = undoBtn.getAttribute("data-task-id");
        const targetDay = undoBtn.getAttribute("data-day");
        handleUndoTask(taskId, targetDay);
        return;
      }

      const editBtn = e.target.closest(".btn-edit-task");
      if (editBtn) {
        const taskId = editBtn.getAttribute("data-task-id");
        if (typeof window.openSkylightTaskDrawer === "function") window.openSkylightTaskDrawer(taskId);
        return;
      }

      const deleteBtn = e.target.closest(".btn-delete-task");
      if (deleteBtn) {
        const taskId = deleteBtn.getAttribute("data-task-id");
        openDeleteTaskModal(taskId);
        return;
      }
    });
  }

  // Add Task Button (Header)
  const addTaskBtn = document.getElementById("btn-add-task");
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", () => window.openSkylightTaskDrawer && window.openSkylightTaskDrawer());
  }

  // Progress Breakdown Foldout Toggle
  const foldoutBtn = document.getElementById("btn-progress-foldout");
  const foldoutEl = document.getElementById("progress-breakdown-foldout");
  if (foldoutBtn && foldoutEl) {
    foldoutBtn.addEventListener("click", () => {
      const isExpanded = foldoutBtn.classList.toggle("expanded");
      foldoutBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      foldoutEl.style.display = isExpanded ? "block" : "none";
    });
  }

  // Edit / Add Task Form Submit & Cancel
  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    taskForm.addEventListener("submit", handleSaveTaskForm);
  }

  // Initialize Chore Emoji Palette
  initChoreEmojiPalette();

  // Dynamic Daily & Weekly Roster interactions
  const taskDaySelect = document.getElementById("task-form-day");
  const taskTypeSelect = document.getElementById("task-form-type");
  const taskRepeatSelect = document.getElementById("task-form-repeat");
  const taskAssigneeGroup = document.getElementById("task-form-assignee-group");
  const taskApplyAllCheckbox = document.getElementById("task-form-apply-all-days");
  const taskRosterBox = document.getElementById("task-form-daily-roster-box");

  const syncDailyRosterVisibility = () => {
    if (!taskDaySelect || !taskTypeSelect || !taskRosterBox) return;
    const isDaily = (taskRepeatSelect && taskRepeatSelect.value === "daily") || taskDaySelect.value === "Daily" || taskTypeSelect.value === "Daily Task";
    taskRosterBox.style.display = isDaily ? "block" : "none";
    if (taskAssigneeGroup) {
      taskAssigneeGroup.style.display = isDaily ? "none" : "block";
    }
    if (isDaily) {
      const rosterGrid = document.getElementById("task-form-daily-roster-grid");
      if (rosterGrid && (!rosterGrid.children || rosterGrid.children.length === 0)) {
        const currentId = document.getElementById("task-form-id")?.value;
        const task = currentTasks.find(t => t.id === currentId);
        renderDailyRosterInputs(task, document.getElementById("task-form-target-day")?.value);
      }
    }
  };

  const onTaskDayChange = () => {
    const val = taskDaySelect ? taskDaySelect.value : "Sunday";
    const repeatOptWeekly = document.getElementById("task-repeat-opt-weekly");
    const repeatOptFortnightly = document.getElementById("task-repeat-opt-fortnightly");
    if (repeatOptWeekly) {
      repeatOptWeekly.textContent = (val && val !== "Daily" && val !== "Anyday") ? `Weekly on ${val}` : "Weekly";
    }
    if (repeatOptFortnightly) {
      repeatOptFortnightly.textContent = (val && val !== "Daily" && val !== "Anyday") ? `Fortnightly on ${val}` : "Fortnightly";
    }
    if (val === "Daily") {
      if (taskRepeatSelect) taskRepeatSelect.value = "daily";
    } else if (taskRepeatSelect && taskRepeatSelect.value === "daily") {
      taskRepeatSelect.value = "weekly";
    }
    syncDailyRosterVisibility();
  };

  const onTaskRepeatChange = () => {
    if (!taskRepeatSelect) return;
    if (taskRepeatSelect.value === "daily") {
      if (taskDaySelect) taskDaySelect.value = "Daily";
    } else if (taskDaySelect && taskDaySelect.value === "Daily") {
      taskDaySelect.value = document.getElementById("task-form-target-day")?.value || "Sunday";
    }
    syncDailyRosterVisibility();
  };

  if (taskDaySelect) taskDaySelect.addEventListener("change", onTaskDayChange);
  if (taskTypeSelect) taskTypeSelect.addEventListener("change", syncDailyRosterVisibility);
  if (taskRepeatSelect) taskRepeatSelect.addEventListener("change", onTaskRepeatChange);

  if (taskApplyAllCheckbox) {
    taskApplyAllCheckbox.addEventListener("change", () => {
      if (taskApplyAllCheckbox.checked) {
        const targetDay = document.getElementById("task-form-target-day")?.value || "Monday";
        const chosen = currentRosterAssignments[targetDay] || "";
        WEEK_DAYS_7.forEach(d => {
          setRosterDayAssignee(d, chosen);
        });
      }
    });
  }

  // Stepper buttons & Priority Toggle for Task Modal
  const btnRewardMinus = document.getElementById("btn-reward-minus");
  const btnRewardPlus = document.getElementById("btn-reward-plus");
  const rewardInput = document.getElementById("task-form-reward");

  if (btnRewardMinus && rewardInput) {
    btnRewardMinus.addEventListener("click", (e) => {
      e.preventDefault();
      const isMoney = boardSettings.gameMode === "money";
      const step = isMoney ? 0.5 : 1;
      let cur = parseFloat(rewardInput.value) || 0;
      let next = Math.max(0, cur - step);
      rewardInput.value = isMoney ? next.toFixed(2) : String(next);
      updateRewardPresetChipsUI(next);
    });
  }

  if (btnRewardPlus && rewardInput) {
    btnRewardPlus.addEventListener("click", (e) => {
      e.preventDefault();
      const isMoney = boardSettings.gameMode === "money";
      const step = isMoney ? 0.5 : 1;
      let cur = parseFloat(rewardInput.value) || 0;
      let next = cur + step;
      rewardInput.value = isMoney ? next.toFixed(2) : String(next);
      updateRewardPresetChipsUI(next);
    });
  }

  if (rewardInput) {
    rewardInput.addEventListener("input", () => {
      const val = parseFloat(rewardInput.value) || 0;
      updateRewardPresetChipsUI(val);
    });
  }

  const btnPriorityToggle = document.getElementById("btn-priority-toggle");
  if (btnPriorityToggle) {
    btnPriorityToggle.addEventListener("click", (e) => {
      e.preventDefault();
      const checkbox = document.getElementById("task-form-priority");
      const nextActive = !checkbox.checked;
      updatePriorityToggleUI(nextActive);
    });
  }

  // Close member popover on outside click
  document.addEventListener("click", (e) => {
    const popover = document.getElementById("roster-member-popover");
    if (popover && popover.style.display !== "none") {
      if (!popover.contains(e.target) && !e.target.closest(".daily-roster-day-card")) {
        closeRosterMemberPopover();
      }
    }
  });

  const btnClosePopover = document.getElementById("btn-close-roster-popover");
  if (btnClosePopover) {
    btnClosePopover.addEventListener("click", closeRosterMemberPopover);
  }

  // Room / Area Dropdown toggle custom text input & rename helper
  const roomSelect = document.getElementById("task-form-room");
  const roomCustom = document.getElementById("task-form-room-custom");
  const renameHint = document.getElementById("room-rename-hint");
  if (roomSelect) {
    roomSelect.addEventListener("change", () => {
      if (roomSelect.value === "__custom__") {
        if (roomCustom) {
          roomCustom.style.display = "block";
          roomCustom.focus();
        }
        if (renameHint) renameHint.style.display = "none";
      } else {
        if (roomCustom) roomCustom.style.display = "none";
        if (renameHint) {
          renameHint.style.display = (!isDefaultTurnbullBoard && roomSelect.value.startsWith("Bedroom ")) ? "block" : "none";
        }
      }
    });
  }

  if (renameHint && roomSelect && roomCustom) {
    renameHint.addEventListener("click", () => {
      const bedName = roomSelect.value;
      roomSelect.value = "__custom__";
      roomCustom.style.display = "block";
      roomCustom.value = `${bedName} — `;
      roomCustom.focus();
      renameHint.style.display = "none";
    });
  }

  const cancelTaskFormBtn = document.getElementById("btn-cancel-task-form");
  if (cancelTaskFormBtn) {
    cancelTaskFormBtn.addEventListener("click", closeTaskModal);
  }

  const closeTaskModalBtn = document.getElementById("btn-close-task-modal");
  if (closeTaskModalBtn) {
    closeTaskModalBtn.addEventListener("click", closeTaskModal);
  }

  // Delete Confirmation Buttons
  const confirmDeleteBtn = document.getElementById("btn-confirm-delete");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
  }

  const cancelDeleteBtn = document.getElementById("btn-cancel-delete");
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  }

  // Claim Modal Member Toggle Buttons
  const claimButtons = document.querySelectorAll(".member-claim-btn");
  claimButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      toggleClaimMember(btn);
    });
  });

  // Modal Confirm Claim Button
  const confirmClaimBtn = document.getElementById("btn-confirm-claim");
  if (confirmClaimBtn) {
    confirmClaimBtn.addEventListener("click", () => {
      handleConfirmClaim();
    });
  }

  // Modal Cancel
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  if (btnCancelModal) {
    btnCancelModal.addEventListener("click", closeClaimModal);
  }

  // Close modals on backdrop click
  if (claimModal) {
    claimModal.addEventListener("click", (e) => {
      if (e.target === claimModal) closeClaimModal();
    });
  }

  if (configModal) {
    configModal.addEventListener("click", (e) => {
      if (e.target === configModal) {
        if (typeof configModal.close === "function") configModal.close();
        else configModal.removeAttribute("open");
      }
    });
  }

  if (taskModal) {
    taskModal.addEventListener("click", (e) => {
      if (e.target === taskModal) closeTaskModal();
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) closeDeleteModal();
    });
  }

  // Assign Modal Buttons
  const btnCloseAssignModal = document.getElementById("btn-close-assign-modal");
  if (btnCloseAssignModal) {
    btnCloseAssignModal.addEventListener("click", closeAssignModal);
  }

  const btnUnassignTask = document.getElementById("btn-unassign-task");
  if (btnUnassignTask) {
    btnUnassignTask.addEventListener("click", () => {
      handleSetAssignee(null);
    });
  }

  if (assignModal) {
    assignModal.addEventListener("click", (e) => {
      if (e.target === assignModal) closeAssignModal();
    });
  }

  // Firebase Config Modal Controls
  const btnConfigToggle = document.getElementById("btn-config-toggle");
  if (btnConfigToggle && configModal) {
    btnConfigToggle.addEventListener("click", () => {
      if (typeof configModal.showModal === "function") {
        configModal.showModal();
      } else {
        configModal.setAttribute("open", "");
      }
    });
  }

  const syncStatusPill = document.getElementById("sync-status-pill");
  if (syncStatusPill && configModal) {
    syncStatusPill.addEventListener("click", () => {
      if (typeof configModal.showModal === "function") {
        configModal.showModal();
      } else {
        configModal.setAttribute("open", "");
      }
    });
  }

  const btnCancelConfig = document.getElementById("btn-cancel-config");
  if (btnCancelConfig && configModal) {
    btnCancelConfig.addEventListener("click", () => {
      if (typeof configModal.close === "function") {
        configModal.close();
      } else {
        configModal.removeAttribute("open");
      }
    });
  }

  // Config Form Submit
  const configForm = document.getElementById("firebase-config-form");
  if (configForm) {
    configForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const cfg = {
        apiKey: document.getElementById("cfg-apiKey")?.value?.trim() || "",
        authDomain: document.getElementById("cfg-authDomain")?.value?.trim() || "",
        projectId: document.getElementById("cfg-projectId")?.value?.trim() || "",
        storageBucket: document.getElementById("cfg-storageBucket")?.value?.trim() || "",
        messagingSenderId: document.getElementById("cfg-messagingSenderId")?.value?.trim() || "",
        appId: document.getElementById("cfg-appId")?.value?.trim() || ""
      };

      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
      if (configModal) {
        if (typeof configModal.close === "function") configModal.close();
        else configModal.removeAttribute("open");
      }
      initializeDataSource();
    });
  }

  // Reset / Re-seed Modal Handlers
  const resetConfirmModal = document.getElementById("reset-confirm-modal");
  const btnTriggerReset = document.getElementById("btn-trigger-reset-modal");
  const btnCancelResetConfirm = document.getElementById("btn-cancel-reset-confirm");
  const btnConfirmFactoryReset = document.getElementById("btn-confirm-factory-reset");

  if (btnTriggerReset && resetConfirmModal) {
    btnTriggerReset.addEventListener("click", () => {
      // Close settings modal first, open warning dialog
      if (settingsModal) {
        if (typeof settingsModal.close === "function") settingsModal.close();
        else settingsModal.removeAttribute("open");
      }
      const typed = document.getElementById("reset-confirm-input");
      if (typed) typed.value = "";
      if (btnConfirmFactoryReset) btnConfirmFactoryReset.disabled = true;
      if (typeof resetConfirmModal.showModal === "function") resetConfirmModal.showModal();
      else resetConfirmModal.setAttribute("open", "");
      if (typed) setTimeout(() => typed.focus(), 200);
    });
  }

  // The reset button only wakes up once RESET has been typed
  const resetTypedInput = document.getElementById("reset-confirm-input");
  if (resetTypedInput && btnConfirmFactoryReset) {
    resetTypedInput.addEventListener("input", () => {
      btnConfirmFactoryReset.disabled = resetTypedInput.value.trim().toUpperCase() !== "RESET";
    });
  }

  if (btnCancelResetConfirm && resetConfirmModal) {
    btnCancelResetConfirm.addEventListener("click", () => {
      if (typeof resetConfirmModal.close === "function") resetConfirmModal.close();
      else resetConfirmModal.removeAttribute("open");
    });
  }

  if (btnConfirmFactoryReset && resetConfirmModal) {
    btnConfirmFactoryReset.addEventListener("click", async () => {
      const typedNow = document.getElementById("reset-confirm-input");
      if (!typedNow || typedNow.value.trim().toUpperCase() !== "RESET") return;
      if (typeof resetConfirmModal.close === "function") resetConfirmModal.close();
      else resetConfirmModal.removeAttribute("open");

      if (db) {
        await seedFirestoreData();
      } else {
        currentTasks = JSON.parse(JSON.stringify(isDefaultTurnbullBoard ? INITIAL_SEED_TASKS : STARTER_GENERIC_TASKS));
        saveLocalCache(currentTasks);
        renderApp();
    renderSkylightTasksPage();
      }
    });
  }

  // ==========================================================================
  // SHARE MODAL & NEW BOARD CREATION
  // ==========================================================================
  const shareModal = document.getElementById("share-modal");
  const btnOpenShareBoard = document.getElementById("btn-open-share-board");
  const btnCloseShareModal = document.getElementById("btn-close-share-modal");
  const currentBoardShareUrlInput = document.getElementById("current-board-share-url");
  const btnCopyCurrentLink = document.getElementById("btn-copy-current-link");
  const copyBtnText = document.getElementById("copy-btn-text");
  const createBoardForm = document.getElementById("create-board-form");

  if (btnOpenShareBoard && shareModal) {
    btnOpenShareBoard.addEventListener("click", () => {
      // Set current board share link
      const url = new URL(window.location.href);
      if (isDefaultTurnbullBoard) {
        url.search = "";
      } else {
        url.search = `?board=${encodeURIComponent(currentBoardId)}`;
      }
      if (currentBoardShareUrlInput) {
        currentBoardShareUrlInput.value = url.toString();
      }

      if (typeof shareModal.showModal === "function") {
        shareModal.showModal();
      } else {
        shareModal.setAttribute("open", "");
      }
    });
  }

  if (btnCloseShareModal && shareModal) {
    btnCloseShareModal.addEventListener("click", () => {
      if (typeof shareModal.close === "function") {
        shareModal.close();
      } else {
        shareModal.removeAttribute("open");
      }
    });
  }

  if (shareModal) {
    shareModal.addEventListener("click", (e) => {
      if (e.target === shareModal) {
        if (typeof shareModal.close === "function") shareModal.close();
        else shareModal.removeAttribute("open");
      }
    });
  }

  if (btnCopyCurrentLink && currentBoardShareUrlInput) {
    btnCopyCurrentLink.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentBoardShareUrlInput.value);
        if (copyBtnText) copyBtnText.textContent = "Copied! ✓";
        btnCopyCurrentLink.style.borderColor = "var(--color-success)";
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = "Copy Link";
          btnCopyCurrentLink.style.borderColor = "";
        }, 2200);
      } catch (err) {
        currentBoardShareUrlInput.select();
        document.execCommand("copy");
        if (copyBtnText) copyBtnText.textContent = "Copied! ✓";
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = "Copy Link";
        }, 2200);
      }
    });
  }

  if (createBoardForm) {
    createBoardForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const boardNameInput = document.getElementById("new-board-name");
      const templateSelect = document.getElementById("new-board-template");

      const rawName = boardNameInput ? boardNameInput.value.trim() : "";
      if (!rawName) return;

      const baseSlug = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const slug = `${baseSlug}-${Array.from({ length: 4 }, () => FAMILY_CODE_ALPHABET[randomIndex(FAMILY_CODE_ALPHABET.length)]).join("").toLowerCase()}`;
      // Tells ensureBoardAccess to create the board (with a family code) on arrival
      localStorage.setItem(PENDING_NEW_BOARD_KEY, slug);

      const template = templateSelect ? templateSelect.value : "empty";
      const targetUrl = new URL(window.location.href);
      targetUrl.search = `?board=${encodeURIComponent(slug)}&template=${encodeURIComponent(template)}`;

      window.location.href = targetUrl.toString();
    });
  }

  // ==========================================================================
  // FAMILY ROSTER MANAGEMENT MODAL
  // ==========================================================================
  const rosterModal = document.getElementById("roster-modal");
  const btnRosterToggle = document.getElementById("btn-roster-toggle");
  const btnCloseRosterModal = document.getElementById("btn-close-roster-modal");
  const btnSaveRoster = document.getElementById("btn-save-roster");
  const addMemberForm = document.getElementById("add-member-form");
  const newMemberNameInput = document.getElementById("new-member-name");

  function renderRosterModalList() {
    const listEl = document.getElementById("roster-members-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    familyMembers.forEach((member, idx) => {
      const row = document.createElement("div");
      row.className = "roster-member-row";

      const pal = getMemberPalette(member);
      const initial = member.charAt(0).toUpperCase();

      row.innerHTML = `
        <div class="roster-member-info">
          <button type="button" class="roster-color-trigger-btn" data-member="${escapeHtml(member)}" title="Change ${escapeHtml(member)}'s colour" aria-label="Change ${escapeHtml(member)}'s colour" style="--profile-color: ${pal.primary};">
            ${escapeHtml(initial)}
          </button>
          <div class="roster-member-names-wrap">
            <span class="roster-member-name">${escapeHtml(member)}</span>
            <span class="roster-member-color-name">${escapeHtml(pal.name || "Custom")}</span>
          </div>
        </div>
        <div class="roster-member-actions">
          <button type="button" class="btn-change-member-color" data-member="${escapeHtml(member)}" title="Change colour">
            🎨 Colour
          </button>
          <button type="button" class="btn-remove-member" data-member-index="${idx}" title="Remove ${escapeHtml(member)}" aria-label="Remove ${escapeHtml(member)}">
            ✕
          </button>
        </div>
        <!-- Collapsible inline color picker for this member -->
        <div class="roster-inline-color-picker" id="inline-picker-${idx}" style="display: none;">
          <div class="skylight-color-picker-grid">
            ${SKYLIGHT_PROFILE_COLORS.map(c => `
              <button type="button" class="skylight-color-swatch ${c.id === pal.id ? 'is-selected' : ''}" 
                      data-color-id="${c.id}" data-member="${escapeHtml(member)}"
                      style="background: ${c.solid};" title="${escapeHtml(c.name)}"></button>
            `).join("")}
          </div>
        </div>
      `;

      // Wire inline palette toggle
      const btnToggleColor = row.querySelector(".btn-change-member-color");
      const btnAvatarTrigger = row.querySelector(".roster-color-trigger-btn");
      const pickerWrap = row.querySelector(`#inline-picker-${idx}`);

      const togglePicker = () => {
        const isHidden = pickerWrap.style.display === "none";
        listEl.querySelectorAll(".roster-inline-color-picker").forEach(p => p.style.display = "none");
        pickerWrap.style.display = isHidden ? "block" : "none";
      };

      if (btnToggleColor) btnToggleColor.onclick = togglePicker;
      if (btnAvatarTrigger) btnAvatarTrigger.onclick = togglePicker;

      // Wire swatch selection
      pickerWrap.querySelectorAll(".skylight-color-swatch").forEach(swatch => {
        swatch.onclick = (e) => {
          e.stopPropagation();
          const colorId = swatch.getAttribute("data-color-id");
          const mKey = member.toLowerCase();
          memberColorOverrides[mKey] = colorId;
          if (!boardSettings.memberColors) boardSettings.memberColors = {};
          boardSettings.memberColors[mKey] = colorId;
          try {
            localStorage.setItem("chore_member_colors", JSON.stringify(memberColorOverrides));
          } catch (err) {}
          saveLocalBoardSettings(boardSettings);
          saveRosterAndSync();
          renderRosterModalList();
          renderApp();
    renderSkylightTasksPage();
        };
      });

      const removeBtn = row.querySelector(".btn-remove-member");
      removeBtn.addEventListener("click", () => {
        if (familyMembers.length <= 1) {
          alert("A board must have at least 1 member.");
          return;
        }
        showDeleteConfirmation({
          icon: "👤",
          title: "Remove Family Member?",
          itemTitle: member,
          warning: `${member}'s chores won't show on the board any more, but their points history is kept. Adding ${member} back with the same name brings everything back.`,
          confirmLabel: `Remove ${member}`,
          onConfirm: () => {
            familyMembers.splice(idx, 1);
            saveRosterAndSync();
            renderRosterModalList();
            renderApp();
    renderSkylightTasksPage();
            if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
          }
        });
      });

      listEl.appendChild(row);
    });

    // Populate the new member color picker
    const newMemberGrid = document.getElementById("new-member-color-grid");
    const hiddenColorInput = document.getElementById("new-member-selected-color");
    if (newMemberGrid && hiddenColorInput) {
      // Start on a colour nobody has yet, so a bigger family doesn't end up
      // with several people in the same colour by default.
      const usedIds = new Set(familyMembers.map(m => getMemberPalette(m).id));
      if (usedIds.has(hiddenColorInput.value)) {
        const order = ["sky-blue", "tangerine", "deep-teal", "lavender", "petal-pink", "emerald", "cornflower", "vermillion", "lemon-yellow", "denim", "ice-blue", "amber-orange"];
        const free = order.find(id => !usedIds.has(id)) || SKYLIGHT_PROFILE_COLORS.map(c => c.id).find(id => !usedIds.has(id));
        if (free) hiddenColorInput.value = free;
      }
      newMemberGrid.innerHTML = SKYLIGHT_PROFILE_COLORS.map(c => `
        <button type="button" class="skylight-color-swatch ${c.id === hiddenColorInput.value ? 'is-selected' : ''}" 
                data-color-id="${c.id}" style="background: ${c.solid};" title="${escapeHtml(c.name)}"></button>
      `).join("");

      newMemberGrid.querySelectorAll(".skylight-color-swatch").forEach(swatch => {
        swatch.onclick = (e) => {
          e.preventDefault();
          const cId = swatch.getAttribute("data-color-id");
          hiddenColorInput.value = cId;
          newMemberGrid.querySelectorAll(".skylight-color-swatch").forEach(s => s.classList.remove("is-selected"));
          swatch.classList.add("is-selected");
        };
      });
    }
  }

  async function saveRosterAndSync() {
    saveLocalRoster(familyMembers);
    if (!boardSettings.memberColors) boardSettings.memberColors = {};
    Object.assign(boardSettings.memberColors, memberColorOverrides);
    saveLocalBoardSettings(boardSettings);

    if (db) {
      try {
        const boardDocRef = getBoardDocRef();
        if (boardDocRef) {
          await setDoc(boardDocRef, {
            boardId: currentBoardId,
            members: familyMembers,
            settings: boardSettings,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.warn("Failed to sync roster to Firestore:", err);
      }
    }
  }

  // ==========================================================================
  // HAMBURGER MENU DROPDOWN CONTROLS
  // ==========================================================================
  const btnHamburger = document.getElementById("btn-hamburger-menu");
  const menuDropdown = document.getElementById("menu-dropdown");
  const menuItemShare = document.getElementById("menu-item-share");
  const menuItemRoster = document.getElementById("menu-item-roster");
  const menuItemSettings = document.getElementById("menu-item-settings");
  const menuItemTheme = document.getElementById("menu-item-theme");
  const menuThemeIcon = document.getElementById("menu-theme-icon");
  const menuThemeTitle = document.getElementById("menu-theme-title");
  const menuThemeSub = document.getElementById("menu-theme-sub");

  let activeTheme = localStorage.getItem("chore_theme") || "light";
  applyTheme(activeTheme);

  if (menuItemTheme) {
    menuItemTheme.addEventListener("click", () => {
      closeHamburgerMenu();
      activeTheme = activeTheme === "dark" ? "light" : "dark";
      localStorage.setItem("chore_theme", activeTheme);
      applyTheme(activeTheme);
      sfx.playUndoPop();
    });
  }

  function closeHamburgerMenu() {
    if (menuDropdown) {
      menuDropdown.classList.remove("active");
    }
    if (btnHamburger) {
      btnHamburger.setAttribute("aria-expanded", "false");
    }
  }

  function toggleHamburgerMenu(e) {
    e.stopPropagation();
    if (!menuDropdown) return;
    const isOpen = menuDropdown.classList.toggle("active");
    if (btnHamburger) {
      btnHamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  if (btnHamburger) {
    btnHamburger.addEventListener("click", toggleHamburgerMenu);
  }

  // Close menu on outside click
  document.addEventListener("click", (e) => {
    if (menuDropdown && menuDropdown.classList.contains("active")) {
      if (!menuDropdown.contains(e.target) && e.target !== btnHamburger) {
        closeHamburgerMenu();
      }
    }
  });

  if (menuItemShare) {
    menuItemShare.addEventListener("click", () => {
      closeHamburgerMenu();
      const url = new URL(window.location.href);
      if (isDefaultTurnbullBoard) {
        url.search = "";
      } else {
        url.search = `?board=${encodeURIComponent(currentBoardId)}`;
      }
      if (currentBoardShareUrlInput) {
        currentBoardShareUrlInput.value = url.toString();
      }

      if (shareModal) {
        if (typeof shareModal.showModal === "function") shareModal.showModal();
        else shareModal.setAttribute("open", "");
      }
    });
  }

  if (menuItemRoster) {
    menuItemRoster.addEventListener("click", () => {
      closeHamburgerMenu();
      openSettingsModal("profiles");
    });
  }

  if (menuItemSettings) {
    menuItemSettings.addEventListener("click", () => {
      closeHamburgerMenu();
      openSettingsModal();
    });
  }

  if (btnCloseRosterModal && rosterModal) {
    btnCloseRosterModal.addEventListener("click", () => {
      if (typeof rosterModal.close === "function") rosterModal.close();
      else rosterModal.removeAttribute("open");
    });
  }

  if (btnSaveRoster && rosterModal) {
    btnSaveRoster.addEventListener("click", () => {
      if (typeof rosterModal.close === "function") rosterModal.close();
      else rosterModal.removeAttribute("open");
    });
  }

  if (rosterModal) {
    rosterModal.addEventListener("click", (e) => {
      if (e.target === rosterModal) {
        if (typeof rosterModal.close === "function") rosterModal.close();
        else rosterModal.removeAttribute("open");
      }
    });
  }

  if (addMemberForm && newMemberNameInput) {
    addMemberForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = newMemberNameInput.value.trim();
      if (!name) return;

      if (familyMembers.includes(name)) {
        alert("This member is already on the board!");
        return;
      }

      const colorInput = document.getElementById("new-member-selected-color");
      const chosenColor = colorInput ? colorInput.value : "sky-blue";
      memberColorOverrides[name.toLowerCase()] = chosenColor;
      if (!boardSettings.memberColors) boardSettings.memberColors = {};
      boardSettings.memberColors[name.toLowerCase()] = chosenColor;

      familyMembers.push(name);
      newMemberNameInput.value = "";
      saveRosterAndSync();
      renderRosterModalList();
      renderApp();
    renderSkylightTasksPage();
    });
  }

  // ==========================================================================
  // SETTINGS & GAME MODE (POINTS VS POCKET MONEY)
  // ==========================================================================
  const btnToggleGameMode = document.getElementById("btn-toggle-game-mode");
  const btnCloseSettingsModal = document.getElementById("btn-close-settings-modal");
  const btnCancelSettings = document.getElementById("btn-cancel-settings");
  const settingsForm = document.getElementById("settings-form");
  const optModePoints = document.getElementById("opt-mode-points");
  const optModeMoney = document.getElementById("opt-mode-money");
  const currencySelectGroup = document.getElementById("currency-select-group");
  const currencyBtns = document.querySelectorAll(".currency-btn");

  let tempSelectedMode = boardSettings.gameMode || "points";
  let tempSelectedCurrency = boardSettings.currency || "£";

  // Settings is one side panel split into sections (Profiles, Display,
  // Rewards, Access, Sleep, Reset) with a jump-to menu at the top.
  // openSettingsModal("profiles") opens it at that section.
  function scrollSettingsToSection(key, smooth = true) {
    const sec = document.getElementById(`settings-sec-${key}`);
    if (sec) sec.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    highlightSettingsNav(key);
  }

  function highlightSettingsNav(key) {
    document.querySelectorAll("#settings-section-nav .settings-nav-chip").forEach(chip => {
      chip.classList.toggle("is-active", chip.getAttribute("data-section") === key);
    });
  }

  function wireSettingsSectionNav() {
    const nav = document.getElementById("settings-section-nav");
    if (!nav || nav.hasAttribute("data-wired")) return;
    nav.setAttribute("data-wired", "true");
    nav.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-section]");
      if (chip) scrollSettingsToSection(chip.getAttribute("data-section"));
    });
    // Light up the section you've scrolled to
    const scroller = settingsModal && settingsModal.querySelector(".modal-content");
    if (scroller) {
      scroller.addEventListener("scroll", () => {
        const navBottom = nav.getBoundingClientRect().bottom;
        let current = "profiles";
        document.querySelectorAll("#settings-modal .settings-section").forEach(sec => {
          if (sec.getBoundingClientRect().top - navBottom < 40) current = sec.id.replace("settings-sec-", "");
        });
        highlightSettingsNav(current);
      }, { passive: true });
    }
  }

  async function openSettingsModal(section = null) {
    // A parent PIN, if one is set, guards Settings
    if (window.ParentPin && !(await window.ParentPin.require("Settings"))) return;
    tempSelectedMode = boardSettings.gameMode || "points";
    tempSelectedCurrency = boardSettings.currency || "£";

    updateSettingsModalUI();
    renderFamilyAccessSection();
    if (window.ParentPin) { window.ParentPin.renderSettingsBox(); window.ParentPin.renderOffer(); }
    if (window.syncTodayScreenSetting) window.syncTodayScreenSetting();
    renderRosterModalList();
    wireSettingsSectionNav();

    if (settingsModal) {
      if (typeof settingsModal.showModal === "function") settingsModal.showModal();
      else settingsModal.setAttribute("open", "");
      const scroller = settingsModal.querySelector(".modal-content");
      if (scroller) scroller.scrollTop = 0;
      highlightSettingsNav("profiles");
      if (typeof section === "string" && section) {
        setTimeout(() => scrollSettingsToSection(section), 340);
      }
    }
  }
  window.openSettingsModal = openSettingsModal;

  async function renderFamilyAccessSection() {
    const box = document.getElementById("family-access-content");
    if (!box) return;
    if (!db) {
      box.innerHTML = `<p class="settings-box-desc">Family access is available once the board is connected.</p>`;
      return;
    }
    box.innerHTML = `<p class="settings-box-desc">Loading…</p>`;
    let info;
    try {
      info = await loadFamilyAccessInfo();
    } catch (err) {
      console.warn("Could not load family access:", err);
      box.innerHTML = `<p class="settings-box-desc">Couldn't load family access right now.</p>`;
      return;
    }
    if (!info || !info.code) {
      box.innerHTML = `<p class="settings-box-desc">No family code is set for this board yet.</p>`;
      return;
    }

    const devicesHtml = info.devices.map(d => {
      const joined = d.joinedAt && d.joinedAt.seconds
        ? new Date(d.joinedAt.seconds * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" })
        : "";
      return `
        <li>
          <span>${escapeHtml(d.label || "Device")}${d.isThisDevice ? " <strong>(this device)</strong>" : ""}${joined ? ` · joined ${escapeHtml(joined)}` : ""}</span>
          ${d.isThisDevice ? "" : `<button type="button" class="family-access-small-btn" data-remove-device="${escapeHtml(d.id)}">Remove</button>`}
        </li>`;
    }).join("");

    box.innerHTML = `
      <div class="family-access-row">
        <span class="family-access-code" aria-label="Family code">${escapeHtml(info.code)}</span>
        <button type="button" class="family-access-small-btn" id="btn-copy-join-link">Copy join link</button>
      </div>
      <p class="settings-box-desc" style="margin-top: 12px;">Joined devices (${info.devices.length})</p>
      <ul class="family-access-devices">${devicesHtml}</ul>
    `;

    const copyBtn = document.getElementById("btn-copy-join-link");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(info.joinUrl);
          copyBtn.textContent = "Copied ✓";
        } catch (e) {
          window.prompt("Copy this join link:", info.joinUrl);
        }
        setTimeout(() => { copyBtn.textContent = "Copy join link"; }, 2000);
      };
    }
    box.querySelectorAll("[data-remove-device]").forEach(btn => {
      btn.onclick = async () => {
        if (!window.confirm("Remove this device? It will need the family code to get back in.")) return;
        btn.disabled = true;
        try {
          await removeBoardDevice(btn.getAttribute("data-remove-device"));
        } catch (err) {
          console.warn("Could not remove device:", err);
        }
        renderFamilyAccessSection();
      };
    });
  }

  function closeSettingsModal() {
    if (settingsModal) {
      if (typeof settingsModal.close === "function") settingsModal.close();
      else settingsModal.removeAttribute("open");
    }
  }

  function renderWeeklyHistoryList() {
    const container = document.getElementById("weekly-history-container");
    if (!container) return;

    // Weeks banked on the board (rewardWeeks, shared by every device) first,
    // plus any older weeks this device recorded locally before that existed.
    const banked = window.rewardWeeks || {};
    const isMoneyNow = boardSettings.gameMode === "money";
    const bankedEntries = Object.entries(banked).map(([weekKey, totals]) => ({
      weekKey,
      archivedAt: null,
      gameMode: isMoneyNow ? "money" : "points",
      currency: boardSettings.currency || "£",
      totals: totals || {}
    }));
    const ledger = bankedEntries
      .concat(loadWeeklyLedger().filter(e => !banked[e.weekKey]))
      .sort((a, b) => String(b.weekKey).localeCompare(String(a.weekKey)))
      .slice(0, 12);
    if (ledger.length === 0) {
      container.innerHTML = `<div class="history-empty-note">No finished weeks yet. Each week's points are saved here on Sunday at midnight.</div>`;
      return;
    }

    container.innerHTML = "";
    ledger.forEach(entry => {
      const card = document.createElement("div");
      card.className = "history-week-card";

      const isMoney = entry.gameMode === "money";
      const currency = entry.currency || "£";

      const pillsHtml = Object.entries(entry.totals)
        .map(([name, score]) => {
          const num = Number(score) || 0;
          const val = isMoney ? `${currency}${num.toFixed(2)}` : `${num} pts`;
          return `<span class="history-member-pill">${escapeHtml(name)}: <span class="history-member-score">${val}</span></span>`;
        })
        .join("");

      card.innerHTML = `
        <div class="history-week-top">
          <span>Week: ${escapeHtml(entry.weekKey)}</span>
          <span>${entry.archivedAt ? new Date(entry.archivedAt).toLocaleDateString() : "Saved on the board"}</span>
        </div>
        <div class="history-week-payouts">
          ${pillsHtml}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function updateSettingsModalUI() {
    renderWeeklyHistoryList();

    if (optModePoints && optModeMoney) {
      if (tempSelectedMode === "money") {
        optModeMoney.classList.add("selected");
        optModePoints.classList.remove("selected");
        if (currencySelectGroup) currencySelectGroup.style.display = "block";
      } else {
        optModePoints.classList.add("selected");
        optModeMoney.classList.remove("selected");
        if (currencySelectGroup) currencySelectGroup.style.display = "none";
      }
    }

    currencyBtns.forEach(btn => {
      if (btn.getAttribute("data-currency") === tempSelectedCurrency) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });

    const sleepEnabledEl = document.getElementById("settings-sleep-enabled");
    const sleepStartEl = document.getElementById("settings-sleep-start");
    const sleepEndEl = document.getElementById("settings-sleep-end");
    if (sleepEnabledEl) sleepEnabledEl.checked = boardSettings.sleepScheduleEnabled !== false;
    if (sleepStartEl) sleepStartEl.value = boardSettings.sleepStartTime || "22:00";
    if (sleepEndEl) sleepEndEl.value = boardSettings.sleepEndTime || "07:00";

    // Theme selector inside settings
    const activeTheme = localStorage.getItem("chore_theme") || "light";
    const optThemeLight = document.getElementById("opt-theme-light");
    const optThemeDark = document.getElementById("opt-theme-dark");
    if (optThemeLight && optThemeDark) {
      optThemeLight.classList.toggle("selected", activeTheme === "light");
      optThemeDark.classList.toggle("selected", activeTheme === "dark");
    }
  }

  // Wire Theme Selector Cards in Settings
  const optThemeLight = document.getElementById("opt-theme-light");
  const optThemeDark = document.getElementById("opt-theme-dark");
  if (optThemeLight) {
    optThemeLight.addEventListener("click", () => {
      localStorage.setItem("chore_theme", "light");
      applyTheme("light");
      if (typeof sfx !== "undefined" && sfx && sfx.playUndoPop) sfx.playUndoPop();
      updateSettingsModalUI();
    });
  }
  if (optThemeDark) {
    optThemeDark.addEventListener("click", () => {
      localStorage.setItem("chore_theme", "dark");
      applyTheme("dark");
      if (typeof sfx !== "undefined" && sfx && sfx.playUndoPop) sfx.playUndoPop();
      updateSettingsModalUI();
    });
  }

  if (btnToggleGameMode) {
    btnToggleGameMode.addEventListener("click", openSettingsModal);
  }

  const menuModeChip = document.getElementById("menu-mode-chip");
  if (menuModeChip) {
    menuModeChip.addEventListener("click", () => {
      closeHamburgerMenu();
      openSettingsModal();
    });
  }

  const menuSyncStatusChip = document.getElementById("menu-sync-status-chip");
  if (menuSyncStatusChip && configModal) {
    menuSyncStatusChip.addEventListener("click", () => {
      closeHamburgerMenu();
      if (typeof configModal.showModal === "function") {
        configModal.showModal();
      } else {
        configModal.setAttribute("open", "");
      }
    });
  }

  if (btnCloseSettingsModal) {
    btnCloseSettingsModal.addEventListener("click", closeSettingsModal);
  }

  if (btnCancelSettings) {
    btnCancelSettings.addEventListener("click", closeSettingsModal);
  }

  if (optModePoints) {
    optModePoints.addEventListener("click", () => {
      tempSelectedMode = "points";
      updateSettingsModalUI();
    });
  }

  if (optModeMoney) {
    optModeMoney.addEventListener("click", () => {
      tempSelectedMode = "money";
      updateSettingsModalUI();
    });
  }

  currencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const c = btn.getAttribute("data-currency");
      if (c) {
        tempSelectedCurrency = c;
        updateSettingsModalUI();
      }
    });
  });

  const btnPreviewSleep = document.getElementById("btn-preview-sleep-screen");
  if (btnPreviewSleep) {
    btnPreviewSleep.onclick = () => {
      closeSettingsModal();
      activateAmbientSleepScreen(true);
    };
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sleepEnabledEl = document.getElementById("settings-sleep-enabled");
      const sleepStartEl = document.getElementById("settings-sleep-start");
      const sleepEndEl = document.getElementById("settings-sleep-end");
      boardSettings.gameMode = tempSelectedMode;
      boardSettings.currency = tempSelectedCurrency;
      if (sleepEnabledEl) boardSettings.sleepScheduleEnabled = sleepEnabledEl.checked;
      if (sleepStartEl && sleepStartEl.value) boardSettings.sleepStartTime = sleepStartEl.value;
      if (sleepEndEl && sleepEndEl.value) boardSettings.sleepEndTime = sleepEndEl.value;
      saveLocalBoardSettings(boardSettings);
      closeSettingsModal();

      if (db) {
        try {
          const boardDocRef = getBoardDocRef();
          if (boardDocRef) {
            await setDoc(boardDocRef, {
              settings: boardSettings,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.warn("Failed to sync settings to Firestore:", err);
        }
      }

      checkScheduledSleepWindow();
      renderApp();
    renderSkylightTasksPage();
    });
  }

  // ==========================================================================
  // ONBOARDING WIZARD MODAL (FIRST-TIME VISITORS)
  // ==========================================================================
  const onboardingForm = document.getElementById("onboarding-form");
  const onbOptPoints = document.getElementById("onboarding-opt-points");
  const onbOptMoney = document.getElementById("onboarding-opt-money");
  const onbCurrencyGroup = document.getElementById("onboarding-currency-group");
  let onbSelectedMode = "points";
  let onbSelectedCurrency = "£";

  if (onbOptPoints) {
    onbOptPoints.addEventListener("click", () => {
      onbSelectedMode = "points";
      onbOptPoints.classList.add("selected");
      if (onbOptMoney) onbOptMoney.classList.remove("selected");
      if (onbCurrencyGroup) onbCurrencyGroup.style.display = "none";
    });
  }

  if (onbOptMoney) {
    onbOptMoney.addEventListener("click", () => {
      onbSelectedMode = "money";
      onbOptMoney.classList.add("selected");
      if (onbOptPoints) onbOptPoints.classList.remove("selected");
      if (onbCurrencyGroup) onbCurrencyGroup.style.display = "block";
    });
  }

  const onbCurrencyBtns = onbCurrencyGroup ? onbCurrencyGroup.querySelectorAll(".currency-btn") : [];
  onbCurrencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      onbCurrencyBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      onbSelectedCurrency = btn.getAttribute("data-currency") || "£";
    });
  });

  if (onboardingForm) {
    onboardingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const familyNameInput = document.getElementById("onboarding-family-name");
      const membersInput = document.getElementById("onboarding-members");
      const templateSelect = document.getElementById("onboarding-template");

      const familyName = familyNameInput ? familyNameInput.value.trim() : "";
      const rawMembers = membersInput ? membersInput.value.trim() : "";
      if (!familyName || !rawMembers) return;

      const membersList = rawMembers
        .split(",")
        .map(m => m.trim())
        .filter(m => m.length > 0);

      if (membersList.length === 0) {
        alert("Please enter at least one family member.");
        return;
      }

      // Generate random slug + 4-char suffix for privacy
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const cleanSlug = familyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const newBoardId = `${cleanSlug}-${randomSuffix}`;
      const template = templateSelect ? templateSelect.value : "starter";

      // Save initial settings & roster for this board in local storage
      localStorage.setItem("chore_active_board_id", newBoardId);
      localStorage.setItem("harmonee_active_board_id", newBoardId);
      // Tells ensureBoardAccess to create the board (with a family code) on arrival
      localStorage.setItem(PENDING_NEW_BOARD_KEY, newBoardId);
      localStorage.setItem(`chore_roster_${newBoardId}`, JSON.stringify(membersList));
      localStorage.setItem(`chore_settings_${newBoardId}`, JSON.stringify({
        gameMode: onbSelectedMode,
        currency: onbSelectedCurrency
      }));

      // Redirect immediately to clean board URL
      const targetUrl = new URL(window.location.href);
      targetUrl.search = `?board=${encodeURIComponent(newBoardId)}&template=${encodeURIComponent(template)}`;
      window.location.href = targetUrl.toString();
    });
  }

  // ==========================================================================
  // MAGIC AI CHORE CREATOR CONTROLS & SPEECH RECOGNITION
  // ==========================================================================
  const btnOpenAiModal = document.getElementById("btn-open-ai-modal");
  const btnCloseAiModal = document.getElementById("btn-close-ai-modal");
  const aiPromptInput = document.getElementById("ai-prompt-input");
  const btnVoiceDictate = document.getElementById("btn-voice-dictate");
  const micLabel = document.getElementById("mic-label");
  const btnGenerateAi = document.getElementById("btn-generate-ai-tasks");
  const aiLoadingState = document.getElementById("ai-loading-state");
  const aiResultsPreview = document.getElementById("ai-results-preview");
  const aiTasksList = document.getElementById("ai-tasks-list");
  const aiTasksCount = document.getElementById("ai-tasks-count");
  const btnConfirmAddAiTasks = document.getElementById("btn-confirm-add-ai-tasks");
  const btnDiscardAi = document.getElementById("btn-discard-ai");
  const examplePills = document.querySelectorAll(".btn-example-pill");

  let parsedAiTasks = [];
  let speechRecognition = null;
  let isRecording = false;

  function openAiModal() {
    parsedAiTasks = [];
    if (aiResultsPreview) aiResultsPreview.style.display = "none";
    if (aiLoadingState) aiLoadingState.style.display = "none";
    if (aiPromptInput) aiPromptInput.value = "";

    if (aiModal) {
      if (typeof aiModal.showModal === "function") aiModal.showModal();
      else aiModal.setAttribute("open", "");
    }
  }

  function closeAiModal() {
    stopVoiceRecognition();
    if (aiModal) {
      if (typeof aiModal.close === "function") aiModal.close();
      else aiModal.removeAttribute("open");
    }
  }

  if (btnOpenAiModal) {
    btnOpenAiModal.addEventListener("click", openAiModal);
  }

  if (btnCloseAiModal) {
    btnCloseAiModal.addEventListener("click", closeAiModal);
  }

  examplePills.forEach(pill => {
    pill.addEventListener("click", () => {
      const text = pill.getAttribute("data-example");
      if (text && aiPromptInput) {
        aiPromptInput.value = text;
        if (!(window.isTouchScreen && window.isTouchScreen())) aiPromptInput.focus();
      }
    });
  });

  // Web Speech API Integration (Free real-time voice dictation)
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (btnVoiceDictate) btnVoiceDictate.style.display = "none";
      return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = "en-GB";

    speechRecognition.onstart = () => {
      isRecording = true;
      if (btnVoiceDictate) btnVoiceDictate.classList.add("recording");
      if (micLabel) micLabel.textContent = "Listening...";
    };

    speechRecognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + " ";
      }
      if (aiPromptInput) {
        aiPromptInput.value = transcript.trim();
      }
    };

    speechRecognition.onerror = (err) => {
      console.warn("Speech recognition error:", err);
      stopVoiceRecognition();
    };

    speechRecognition.onend = () => {
      stopVoiceRecognition();
    };
  }

  function stopVoiceRecognition() {
    isRecording = false;
    if (speechRecognition) {
      try { speechRecognition.stop(); } catch (e) {}
    }
    if (btnVoiceDictate) btnVoiceDictate.classList.remove("recording");
    if (micLabel) micLabel.textContent = "Dictate";
  }

  function toggleVoiceRecognition() {
    if (!speechRecognition) initSpeechRecognition();
    if (!speechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isRecording) {
      stopVoiceRecognition();
    } else {
      try {
        speechRecognition.start();
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }
  }

  if (btnVoiceDictate) {
    btnVoiceDictate.addEventListener("click", toggleVoiceRecognition);
  }

  // Direct structured JSON detection for lists pasted from Gemini, ChatGPT, or Claude
  function parseDirectStructuredJson(text) {
    const isMoney = boardSettings.gameMode === "money";
    const defaultReward = isMoney ? 1.00 : 1;
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) return null;

    try {
      const rawArray = JSON.parse(jsonMatch[0]);
      if (Array.isArray(rawArray) && rawArray.length > 0) {
        return rawArray.map((t, idx) => {
          let day = "Anyday";
          let taskType = "Standard";
          if (t.bucket === "diy" || (t.category && t.category.toLowerCase().includes("diy"))) {
            taskType = "DIY Project";
            day = "Saturday";
          } else if (t.bucket === "weekend" || (t.category && t.category.toLowerCase().includes("weekend"))) {
            day = "Saturday";
          } else if (t.day) {
            day = t.day;
          }

          let defVal = defaultReward;
          if (typeof t.rewardValue === "number") {
            defVal = t.rewardValue;
          } else if (t.bucket === "diy") {
            defVal = isMoney ? 5.00 : 5;
          } else if (t.bucket === "weekend") {
            defVal = isMoney ? 2.00 : 2;
          }

          return {
            id: t.id || `task-${Date.now()}-${idx}`,
            title: (t.title || "Chore").trim(),
            assignedTo: familyMembers.includes(t.assignedTo) ? t.assignedTo : null,
            day: day,
            taskType: t.taskType || taskType,
            room: t.room || "House",
            estimatedTime: t.time || t.estimatedTime || "15 mins",
            rewardValue: defVal,
            actionNote: t.note || t.actionNote || "Created via Magic AI assistant.",
            isPriority: !!(t.priority || t.isPriority),
            done: false,
            completedBy: null,
            completedAt: null
          };
        });
      }
    } catch (e) {
      console.warn("Direct JSON parsing failed:", e);
    }
    return null;
  }

  // Robust Conversational AI Parsing
  function parseChoresWithHeuristics(promptText) {
    const directTasks = parseDirectStructuredJson(promptText);
    if (directTasks && directTasks.length > 0) return directTasks;

    const isMoney = boardSettings.gameMode === "money";
    const defaultReward = isMoney ? 1.00 : 1;
    const tasks = [];

    // 0. Extract explicit description/note clauses if the user dictated details:
    // e.g. "...and in the description we need to have things like..."
    let extractedActionNote = "";
    let cleanedPrompt = promptText;
    const descMatch = promptText.match(/\s+(?:and\s+)?(?:in\s+)?(?:the\s+)?(?:description|note|details?)\s+(?:we\s+need\s+to\s+have\s+(?:things\s+like\s+)?|(?:of\s+(?:that|this)\s+task\s+)?(?:needs\s+to\s+include|is|to\s+include|should\s+be|includes))\s*(.+)$/i);
    if (descMatch) {
      extractedActionNote = descMatch[1].trim();
      cleanedPrompt = promptText.substring(0, descMatch.index).trim();
    }

    // Pre-process common conversational numbering:
    // "the first one is...", "second one is...", "the third task is...", "and then another..."
    let normalized = cleanedPrompt
      .replace(/\b(?:and\s+)?(?:the\s+)?first\s+(?:one\s+is|task\s+is|chore\s+is|is)\b/gi, " [SPLIT] ")
      .replace(/\b(?:and\s+)?(?:the\s+)?second\s+(?:one\s+is|task\s+is|chore\s+is|is)\b/gi, " [SPLIT] ")
      .replace(/\b(?:and\s+)?(?:the\s+)?third\s+(?:one\s+is|task\s+is|chore\s+is|is)\b/gi, " [SPLIT] ")
      .replace(/\b(?:and\s+)?(?:the\s+)?fourth\s+(?:one\s+is|task\s+is|chore\s+is|is)\b/gi, " [SPLIT] ")
      .replace(/\b(?:and\s+then\s+another|and\s+then|and\s+also|and\s+another|plus|also)\b/gi, " [SPLIT] ");

    let segments;
    if (normalized.includes("[SPLIT]")) {
      segments = normalized.split("[SPLIT]").map(s => s.trim()).filter(s => s.length > 2);
    } else {
      segments = normalized.split(/(?:,|\n|;|\. )/gi).map(s => s.trim()).filter(s => s.length > 2);
    }

    // Drop opening meta sentences like "ok now we need to create two new tasks"
    if (segments.length > 1 && /^(?:ok|okay|now|we\s+need|i\s+need|create|add).*tasks?$/i.test(segments[0].trim())) {
      segments.shift();
    }

    segments.forEach((seg, idx) => {
      let title = seg;
      let assignedTo = null;
      let day = "Anyday";
      let taskType = "Standard";
      let rewardValue = defaultReward;
      let room = "House";
      let estimatedTime = "15 mins";

      // 1. Assignee detection
      for (const member of familyMembers) {
        const regex = new RegExp(`\\b${member}\\b`, "i");
        if (regex.test(title)) {
          assignedTo = member;
          title = title.replace(regex, "").trim();
          break;
        }
      }

      // 2. Schedule / Routine frequency & Day
      if (/\b(?:daily|every\s*day|morning|afternoon|evening|night)\b/i.test(seg)) {
        day = "Daily";
        taskType = "Daily Task";
      } else if (/\bweekly\b/i.test(seg)) {
        day = "Saturday";
        taskType = "Standard";
      } else if (/\bmonday|mon\b/i.test(seg)) {
        day = "Monday";
      } else if (/\btuesday|tue\b/i.test(seg)) {
        day = "Tuesday";
      } else if (/\bwednesday|wed\b/i.test(seg)) {
        day = "Wednesday";
      } else if (/\bthursday|thu\b/i.test(seg)) {
        day = "Thursday";
      } else if (/\bfriday|fri\b/i.test(seg)) {
        day = "Friday";
      } else if (/\bsaturday|sat\b/i.test(seg)) {
        day = "Saturday";
      } else if (/\bsunday|sun\b/i.test(seg)) {
        day = "Sunday";
      }

      // 3. Monetary rewards
      const moneyMatch = seg.match(/[£$€]\s*([0-9]+(?:\.[0-9]{1,2})?)/i) 
        || seg.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:pounds?|quid|dollars?|euros?)/i);
      if (moneyMatch) {
        rewardValue = parseFloat(moneyMatch[1]);
        title = title.replace(moneyMatch[0], "").trim();
      } else {
        const pointsMatch = seg.match(/([0-9]+)\s*pts?/i);
        if (pointsMatch) {
          rewardValue = parseInt(pointsMatch[1], 10);
          title = title.replace(pointsMatch[0], "").trim();
        }
      }

      // 4. Infer room
      if (/car|driveway|garage/i.test(seg)) room = "Car / Garage";
      else if (/kitchen|dishwasher|sink|plates/i.test(seg)) room = "Kitchen";
      else if (/living\s*room|sofa|rug/i.test(seg)) room = "Living Room";
      else if (/bed|bedroom|duvet/i.test(seg)) room = "Bedrooms";
      else if (/garden|fence|lawn|outside/i.test(seg)) room = "Garden";
      else if (/cat|litter|utility|dog|pet/i.test(seg)) room = "Utility";
      else if (/bathroom|toilet|shower/i.test(seg)) room = "Bathroom";

      // 5. Aggressive conversational preamble & postamble cleaning
      title = title
        // Strip trailing sentence qualifiers e.g. "and they're both daily tasks", "both are daily chores", etc.
        .replace(/\s+(?:and\s+)?(?:they'?re|they\s+are|both|all|these\s+are)\s+(?:both\s+)?(?:daily\s+tasks?|daily\s+chores?|tasks?|chores?).*$/i, "")
        .replace(/\s+(?:and\s+)?(?:make\s+sure\s+)?they'?re\s+(?:both\s+)?.*$/i, "")
        .replace(/^(?:ok|okay|now|right|hey|please)?\s*(?:create|add|make|let'?s\s+add|we\s+need|i\s+need|need)\s+(?:to\s+)?(?:create|add|have|make)?\s*(?:a\s+|an\s+|two\s+|three\s+)?(?:weekly\s+task|daily\s+task|new\s+task|task|chore|tasks|chores)\s*(?:and\s+that\s+task\s+is|that\s+is|which\s+is|called|named|is|of|for|to)?\s*/i, "")
        .replace(/^(?:and\s+)?(?:the\s+)?(?:first|second|third|fourth|next|another)\s+(?:one\s+is|task\s+is|chore\s+is|is)\s*/i, "")
        .replace(/^(?:task\s+(?:one|two|three|\d+)\s+is)\s*/i, "")
        .replace(/^(?:called|named|titled)\s+/i, "")
        .replace(/\b(?:that\s+will\s+be|will\s+be|that\s+is|worth)\b/gi, "")
        .replace(/\s+\band\s*$/i, "")
        .replace(/^(?:and\s+then|then|someone|and|for|to|of)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();

      if (title.length > 2) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
        const finalNote = extractedActionNote 
          ? (extractedActionNote.charAt(0).toUpperCase() + extractedActionNote.slice(1))
          : "Created via Magic AI assistant.";

        tasks.push({
          id: `task-${Date.now()}-${idx}`,
          title,
          assignedTo,
          day,
          taskType,
          room,
          estimatedTime,
          rewardValue,
          actionNote: finalNote,
          isPriority: false,
          done: false,
          completedBy: null,
          completedAt: null
        });
      }
    });

    return tasks;
  }

  // Real LLM parsing using Gemini Flash with fast heuristic fallback
  async function parseChoresWithGeminiAI(promptText) {
    const isMoney = boardSettings.gameMode === "money";
    const defaultReward = isMoney ? 1.00 : 1;

    // 0. Instant Direct JSON Detection:
    const directTasks = parseDirectStructuredJson(promptText);
    if (directTasks && directTasks.length > 0) return directTasks;

    const membersList = familyMembers.join(", ");
    const apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;

    const systemPrompt = `You are an expert chore parsing assistant for a family chore app.
Extract all distinct household tasks mentioned in the user's message.
Return ONLY valid JSON (an array of objects) with NO Markdown code blocks, no backticks, and no extra commentary.

Each object MUST have these exact properties:
- "title": Clean, short chore title (e.g. "Feed Cats (Morning)", "Empty Dishwasher", "Hoover Living Room"). DO NOT include conversational phrases like "we need to", "create a task for", "the first one is".
- "assignedTo": Family member name if specified in the text (${membersList}), or null if unassigned.
- "day": One of ["Daily", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Anyday"]. If user mentions "every day" or "daily", use "Daily".
- "room": General area (e.g. "Kitchen", "Living Room", "Utility", "Garden", "Bedrooms", "Bathroom", "House").
- "rewardValue": Number (e.g. 1, 1.5, 2). If not mentioned, use ${defaultReward}.
- "estimatedTime": Estimated time string (e.g. "10 mins", "15 mins").

Example output format:
[{"title":"Feed Cats (Morning)","assignedTo":null,"day":"Daily","room":"Utility","rewardValue":1,"estimatedTime":"5 mins"}]`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: `User request: "${promptText}"` }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          const parsed = JSON.parse(rawJsonText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((t, idx) => ({
              id: `task-${Date.now()}-${idx}`,
              title: (t.title || "Chore").trim(),
              assignedTo: familyMembers.includes(t.assignedTo) ? t.assignedTo : null,
              day: t.day || "Anyday",
              taskType: t.day === "Daily" ? "Daily Task" : "Standard",
              room: t.room || "House",
              estimatedTime: t.estimatedTime || "15 mins",
              rewardValue: typeof t.rewardValue === "number" ? t.rewardValue : defaultReward,
              actionNote: `Created via Magic AI assistant.`,
              isPriority: false,
              done: false,
              completedBy: null,
              completedAt: null
            }));
          }
        }
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to local heuristics:", err);
    }

    // Fallback to local regex heuristics if offline or network error
    return parseChoresWithHeuristics(promptText);
  }

  // Generate button handler
  if (btnGenerateAi) {
    btnGenerateAi.addEventListener("click", async () => {
      const rawPrompt = aiPromptInput ? aiPromptInput.value.trim() : "";
      if (!rawPrompt) {
        alert("Please speak or type some chores first.");
        return;
      }

      stopVoiceRecognition();
      if (aiLoadingState) aiLoadingState.style.display = "flex";
      if (aiResultsPreview) aiResultsPreview.style.display = "none";

      try {
        parsedAiTasks = await parseChoresWithGeminiAI(rawPrompt);
      } catch (e) {
        parsedAiTasks = parseChoresWithHeuristics(rawPrompt);
      }

      if (aiLoadingState) aiLoadingState.style.display = "none";

      if (parsedAiTasks.length === 0) {
        alert("Could not identify specific chores. Try phrasing like: 'Ava empty dishwasher for £1, Steve mow lawn on Saturday'");
        return;
      }

      renderAiPreviewList();
    });
  }

  function renderAiPreviewList() {
    if (!aiTasksList) return;
    aiTasksList.innerHTML = "";

    const isMoney = boardSettings.gameMode === "money";
    const currency = boardSettings.currency || "£";

    parsedAiTasks.forEach((task, index) => {
      const item = document.createElement("div");
      item.className = "ai-task-item";

      const memberOptions = [`<option value="">👤 Unassigned</option>`]
        .concat(familyMembers.map(m => `<option value="${escapeHtml(m)}" ${task.assignedTo === m ? 'selected' : ''}>👤 ${escapeHtml(m)}</option>`))
        .join("");

      const dayOptions = [
        { val: "Anyday", label: "📅 Anyday" },
        { val: "Daily", label: "🔄 Daily" },
        { val: "Monday", label: "Mon" },
        { val: "Tuesday", label: "Tue" },
        { val: "Wednesday", label: "Wed" },
        { val: "Thursday", label: "Thu" },
        { val: "Friday", label: "Fri" },
        { val: "Saturday", label: "Sat" },
        { val: "Sunday", label: "Sun" }
      ].map(d => `<option value="${d.val}" ${task.day === d.val ? 'selected' : ''}>${d.label}</option>`).join("");

      item.innerHTML = `
        <div class="ai-task-top-row">
          <input type="text" class="ai-task-title-input" value="${escapeHtml(task.title)}" data-index="${index}" placeholder="Chore description...">
          <button type="button" class="btn-remove-ai-task" data-index="${index}" title="Remove this chore">✕</button>
        </div>

        <div class="ai-task-edit-row">
          <select class="ai-mini-select ai-assignee-select" data-index="${index}">
            ${memberOptions}
          </select>

          <select class="ai-mini-select ai-day-select" data-index="${index}">
            ${dayOptions}
          </select>

          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="font-size: 0.8rem;">${isMoney ? '💰 ' + currency : '🏆 pts:'}</span>
            <input type="number" step="0.25" min="0" class="ai-mini-input ai-mini-input-reward" value="${task.rewardValue}" data-index="${index}">
          </div>

          <input type="text" class="ai-mini-input" style="width: 90px;" value="${escapeHtml(task.room)}" placeholder="Room" data-index="${index}" title="Room / Area">
        </div>
      `;

      // Live 2-way binding for quick inline edits
      const titleInput = item.querySelector(".ai-task-title-input");
      titleInput.addEventListener("input", (e) => {
        parsedAiTasks[index].title = e.target.value.trim();
      });

      const assigneeSelect = item.querySelector(".ai-assignee-select");
      assigneeSelect.addEventListener("change", (e) => {
        parsedAiTasks[index].assignedTo = e.target.value || null;
      });

      const daySelect = item.querySelector(".ai-day-select");
      daySelect.addEventListener("change", (e) => {
        parsedAiTasks[index].day = e.target.value;
        if (e.target.value === "Daily") parsedAiTasks[index].taskType = "Daily Task";
      });

      const rewardInput = item.querySelector(".ai-mini-input-reward");
      rewardInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          parsedAiTasks[index].rewardValue = val;
        }
      });

      const roomInput = item.querySelectorAll(".ai-mini-input")[1];
      if (roomInput) {
        roomInput.addEventListener("input", (e) => {
          parsedAiTasks[index].room = e.target.value.trim() || "House";
        });
      }

      const removeBtn = item.querySelector(".btn-remove-ai-task");
      removeBtn.addEventListener("click", () => {
        parsedAiTasks.splice(index, 1);
        if (parsedAiTasks.length === 0) {
          if (aiResultsPreview) aiResultsPreview.style.display = "none";
        } else {
          renderAiPreviewList();
        }
      });

      aiTasksList.appendChild(item);
    });

    if (aiTasksCount) aiTasksCount.textContent = parsedAiTasks.length;
    if (aiResultsPreview) aiResultsPreview.style.display = "flex";
  }

  if (btnDiscardAi) {
    btnDiscardAi.addEventListener("click", () => {
      parsedAiTasks = [];
      if (aiTasksList) aiTasksList.innerHTML = "";
      if (aiTasksCount) aiTasksCount.textContent = "0";
      if (aiResultsPreview) {
        aiResultsPreview.style.setProperty("display", "none", "important");
      }
      if (aiPromptInput) {
        aiPromptInput.value = "";
        if (!(window.isTouchScreen && window.isTouchScreen())) aiPromptInput.focus();
      }
    });
  }

  // Add all parsed AI chores to active board & Firestore
  if (btnConfirmAddAiTasks) {
    btnConfirmAddAiTasks.addEventListener("click", async () => {
      if (parsedAiTasks.length === 0) return;

      closeAiModal();

      if (db) {
        try {
          const batch = writeBatch(db);
          parsedAiTasks.forEach(task => {
            const docRef = getTaskDocRef(task.id);
            batch.set(docRef, {
              ...task,
              order: currentTasks.length + 1,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        } catch (err) {
          console.warn("Failed to commit batch to Firestore, saving locally:", err);
          currentTasks.push(...parsedAiTasks);
          saveLocalCache(currentTasks);
          renderApp();
    renderSkylightTasksPage();
        }
      } else {
        currentTasks.push(...parsedAiTasks);
        saveLocalCache(currentTasks);
        renderApp();
    renderSkylightTasksPage();
      }

      sfx.playCelebrationChime();
      triggerConfettiBurst();
    });
  }

  // Skylight navigation is initialized by bootstrapApplication()
}

function openOnboardingModal() {
  if (onboardingModal) {
    if (typeof onboardingModal.showModal === "function") onboardingModal.showModal();
    else onboardingModal.setAttribute("open", "");
  }
}

// ============================================================================
// 12. SKYLIGHT 15" CALENDAR MAX & MULTI-VIEW NAVIGATION
// ============================================================================



// ============================================================================
// 15. SKYLIGHT TASKS PAGE & DRAWER (Extracted to js/tasks.js)
// ============================================================================


function switchSkylightView(viewName) {
  currentActiveView = viewName;

  const navItems = document.querySelectorAll(".skylight-nav-item[data-view]");
  navItems.forEach(item => {
    if (item.getAttribute("data-view") === viewName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  const viewChores = document.getElementById("view-chores");
  const viewCalendar = document.getElementById("view-calendar");
  const viewMeals = document.getElementById("view-meals");
  const viewRewards = document.getElementById("view-rewards");
  const viewLists = document.getElementById("view-lists");

  if (viewName === "calendar") {
    if (viewChores) viewChores.style.setProperty("display", "none", "important");
    if (viewMeals) viewMeals.style.setProperty("display", "none", "important");
    if (viewRewards) viewRewards.style.setProperty("display", "none", "important");
    if (viewLists) viewLists.style.setProperty("display", "none", "important");
    if (viewCalendar) {
      viewCalendar.style.setProperty("display", "block", "important");
      viewCalendar.classList.add("active-page");
    }
    window.__calScroll = null; // opening the calendar: start an hour before now
    renderWeekCalendar();
    renderFamilyStickyNote();
    window.scrollTo({ top: 0, behavior: "instant" });
    { const mv = document.querySelector(".skylight-main-viewport"); if (mv) mv.scrollTop = 0; }
  } else if (viewName === "meals") {
    if (viewChores) viewChores.style.setProperty("display", "none", "important");
    if (viewCalendar) viewCalendar.style.setProperty("display", "none", "important");
    if (viewRewards) viewRewards.style.setProperty("display", "none", "important");
    if (viewLists) viewLists.style.setProperty("display", "none", "important");
    if (viewMeals) {
      viewMeals.style.setProperty("display", "block", "important");
      viewMeals.classList.add("active-page");
    }
    renderMealsView();
    window.scrollTo({ top: 0, behavior: "instant" });
    { const mv = document.querySelector(".skylight-main-viewport"); if (mv) mv.scrollTop = 0; }
  } else if (viewName === "lists") {
    if (viewChores) viewChores.style.setProperty("display", "none", "important");
    if (viewCalendar) viewCalendar.style.setProperty("display", "none", "important");
    if (viewMeals) viewMeals.style.setProperty("display", "none", "important");
    if (viewRewards) viewRewards.style.setProperty("display", "none", "important");
    if (viewLists) {
      viewLists.style.setProperty("display", "block", "important");
      viewLists.classList.add("active-page");
    }
    renderListsView();
    window.scrollTo({ top: 0, behavior: "instant" });
    { const mv = document.querySelector(".skylight-main-viewport"); if (mv) mv.scrollTop = 0; }
  } else if (viewName === "rewards") {
    if (viewChores) viewChores.style.setProperty("display", "none", "important");
    if (viewCalendar) viewCalendar.style.setProperty("display", "none", "important");
    if (viewMeals) viewMeals.style.setProperty("display", "none", "important");
    if (viewLists) viewLists.style.setProperty("display", "none", "important");
    if (viewRewards) {
      viewRewards.style.setProperty("display", "block", "important");
      viewRewards.classList.add("active-page");
    }
    renderPodiumRewards();
    window.scrollTo({ top: 0, behavior: "instant" });
    { const mv = document.querySelector(".skylight-main-viewport"); if (mv) mv.scrollTop = 0; }
  } else {
    // Default Tasks view (Skylight Profiles Multi-Column Board)
    if (viewCalendar) viewCalendar.style.setProperty("display", "none", "important");
    if (viewMeals) viewMeals.style.setProperty("display", "none", "important");
    if (viewRewards) viewRewards.style.setProperty("display", "none", "important");
    if (viewLists) viewLists.style.setProperty("display", "none", "important");
    if (viewChores) {
      viewChores.style.setProperty("display", "block", "important");
      viewChores.classList.add("active-page");
    }
    renderSkylightTasksPage();
    window.scrollTo({ top: 0, behavior: "instant" });
    { const mv = document.querySelector(".skylight-main-viewport"); if (mv) mv.scrollTop = 0; }
  }
  // First visit to this page on this device: show its intro (js/page-intro.js)
  const introPage = ["calendar", "meals", "lists", "rewards"].includes(viewName) ? viewName : "chores";
  if (typeof window.maybeShowPageIntro === "function") setTimeout(() => window.maybeShowPageIntro(introPage), 0);
}
window.switchSkylightView = switchSkylightView;

// [Extracted to js/weather-sleep.js: Real-Time Weather & Sleep Window Overlay]

function initSkylightNavigation() {
  if (skylightNavInitialized) return;
  skylightNavInitialized = true;
  const sidebar = document.getElementById("skylight-sidebar");
  const navItemCalendar = document.getElementById("nav-item-calendar");
  const navItemChores = document.getElementById("nav-item-chores");
  const navItemMeals = document.getElementById("nav-item-meals");
  const navItemRewards = document.getElementById("nav-item-rewards");
  const navItemSleep = document.getElementById("nav-item-sleep");
  const navItemSettings = document.getElementById("nav-item-settings");
  const brandMark = document.getElementById("sidebar-brand-mark");
  const btnMealsBackChores = document.getElementById("btn-meals-back-chores");
  const btnCalendarAddTask = document.getElementById("btn-calendar-add-task");
  const btnFloatingAddCalendar = document.getElementById("btn-floating-add-calendar");
  const btnPrevWeek = document.getElementById("btn-calendar-prev-week");
  const btnNextWeek = document.getElementById("btn-calendar-next-week");
  const btnTodayWeek = document.getElementById("btn-calendar-today");
  const weekGrid = document.getElementById("calendar-week-grid");

  // Delegated click handler on the entire sidebar (bulletproof on touch & desktop)
  if (sidebar) {
    const handleSidebarClick = (e) => {
      const btn = e.target.closest(".skylight-nav-item");
      if (!btn) return;
      const view = btn.getAttribute("data-view");
      if (view) {
        switchSkylightView(view);
        if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
        return;
      }
      if (btn.id === "nav-item-sleep") {
        toggleSleepTheme();
        return;
      }
      if (btn.id === "nav-item-settings") {
        if (typeof openSettingsModal === "function") openSettingsModal();
        return;
      }
    };
    sidebar.addEventListener("click", handleSidebarClick);
  }

  if (navItemCalendar) {
    navItemCalendar.addEventListener("click", () => switchSkylightView("calendar"));
  }
  if (navItemChores) {
    navItemChores.addEventListener("click", () => switchSkylightView("chores"));
  }
  if (navItemMeals) {
    navItemMeals.addEventListener("click", () => switchSkylightView("meals"));
  }
  if (navItemRewards) {
    navItemRewards.addEventListener("click", () => switchSkylightView("rewards"));
  }
  if (brandMark) {
    brandMark.addEventListener("click", () => switchSkylightView("calendar"));
  }
  if (btnMealsBackChores) {
    btnMealsBackChores.addEventListener("click", () => switchSkylightView("chores"));
  }

  // Sleep / Dark Mode Toggle
  if (navItemSleep) {
    navItemSleep.addEventListener("click", () => toggleSleepTheme());
  }

  // Settings Modal from Left Menu
  if (navItemSettings) {
    navItemSettings.addEventListener("click", () => {
      if (typeof openSettingsModal === "function") openSettingsModal();
    });
  }

  // Add Event & Task Buttons in Calendar
  const btnCalendarAddEvent = document.getElementById("btn-calendar-add-event");
  const handleCalendarAddEvent = () => {
    let targetDateStr = null;
    let targetDay = "Tuesday";
    const weekDaysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    if (calendarAnchorDate) {
      targetDateStr = getLocalDateKey(calendarAnchorDate);
      const dayIdx = calendarAnchorDate.getDay() === 0 ? 6 : calendarAnchorDate.getDay() - 1;
      targetDay = weekDaysList[dayIdx] || "Tuesday";
    } else {
      const now = new Date();
      targetDateStr = getLocalDateKey(now);
      const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
      targetDay = weekDaysList[dayIdx] || "Tuesday";
    }
    openEventModal(null, targetDay, targetDateStr);
  };

  if (btnCalendarAddEvent) {
    btnCalendarAddEvent.addEventListener("click", handleCalendarAddEvent);
  }
  const btnCalendarMagicScan = document.getElementById("btn-calendar-magic-scan");
  if (btnCalendarMagicScan) {
    btnCalendarMagicScan.onclick = (e) => {
      e.preventDefault();
      if (typeof openCalendarMagicSourceModal === "function") openCalendarMagicSourceModal();
    };
  }
  if (btnCalendarAddTask) {
    btnCalendarAddTask.addEventListener("click", () => window.openSkylightTaskDrawer && window.openSkylightTaskDrawer());
  }
  const fabContainer = document.getElementById("calendar-fab-container");
  const fabBackdrop = document.getElementById("calendar-fab-backdrop");
  const fabBtnAddEvent = document.getElementById("fab-action-add-event");
  const fabBtnAddChore = document.getElementById("fab-action-add-chore");

  const closeFabSpeedDial = () => {
    if (fabContainer) fabContainer.classList.remove("is-open");
    if (fabBackdrop) fabBackdrop.classList.remove("is-active");
    document.body.classList.remove("has-fab-open");
    if (btnFloatingAddCalendar) btnFloatingAddCalendar.setAttribute("aria-expanded", "false");
  };

  const openFabSpeedDial = () => {
    if (fabContainer) fabContainer.classList.add("is-open");
    if (fabBackdrop) fabBackdrop.classList.add("is-active");
    document.body.classList.add("has-fab-open");
    if (btnFloatingAddCalendar) btnFloatingAddCalendar.setAttribute("aria-expanded", "true");
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  };

  const toggleFabSpeedDial = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!fabContainer) return;
    if (fabContainer.classList.contains("is-open")) {
      closeFabSpeedDial();
    } else {
      openFabSpeedDial();
    }
  };

  if (btnFloatingAddCalendar) {
    btnFloatingAddCalendar.onclick = toggleFabSpeedDial;
  }

  if (fabBackdrop) {
    fabBackdrop.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFabSpeedDial();
    };
  }

  const fabBtnMagicImport = document.getElementById("fab-action-magic-import");
  if (fabBtnMagicImport) {
    fabBtnMagicImport.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFabSpeedDial();
      if (typeof openCalendarMagicSourceModal === "function") openCalendarMagicSourceModal();
    };
  }

  if (fabBtnAddEvent) {
    fabBtnAddEvent.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFabSpeedDial();
      handleCalendarAddEvent();
    };
  }

  if (fabBtnAddChore) {
    fabBtnAddChore.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFabSpeedDial();
      if (typeof window.openSkylightTaskDrawer === "function") window.openSkylightTaskDrawer();
    };
  }

  const fabBtnAddNote = document.getElementById("fab-action-add-note");
  if (fabBtnAddNote) {
    fabBtnAddNote.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFabSpeedDial();
      openStickyNoteModal();
    };
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFabSpeedDial();
  });

  // Helper to ensure dropdown menus never clip outside the viewport
  function alignDropdownOnScreen(menuEl, buttonEl) {
    if (!menuEl || !buttonEl) return;
    // Default to right-aligned with the button for header dropdowns
    menuEl.style.right = "0";
    menuEl.style.left = "auto";
    if (typeof menuEl.getBoundingClientRect !== "function") return;
    const rect = menuEl.getBoundingClientRect();
    const vw = (typeof window !== "undefined" && window.innerWidth) || 400;

    // Check if right edge overflows viewport
    if (rect.right > vw - 12) {
      const overflow = rect.right - (vw - 12);
      menuEl.style.right = `${Math.round(overflow)}px`;
    }
    // Check if left edge overflows viewport
    const updatedRect = menuEl.getBoundingClientRect();
    if (updatedRect.left < 10) {
      menuEl.style.left = "10px";
      menuEl.style.right = "auto";
    }
  }

  // Skylight Calendar View Dropdown Wiring
  const btnViewDropdown = document.getElementById("btn-view-dropdown");
  const viewDropdownMenu = document.getElementById("view-dropdown-menu");
  if (btnViewDropdown && viewDropdownMenu) {
    btnViewDropdown.onclick = (e) => {
      e.stopPropagation();
      const isOpen = viewDropdownMenu.style.display === "block";
      viewDropdownMenu.style.display = isOpen ? "none" : "block";
      btnViewDropdown.setAttribute("aria-expanded", isOpen ? "false" : "true");
      if (!isOpen) {
        alignDropdownOnScreen(viewDropdownMenu, btnViewDropdown);
      }
      const fMenu = document.getElementById("filter-dropdown-menu");
      if (fMenu) fMenu.style.display = "none";
    };

    viewDropdownMenu.onclick = (e) => {
      const item = e.target.closest(".dropdown-menu-item");
      if (!item) return;
      e.stopPropagation();
      const targetView = item.getAttribute("data-view");
      if (targetView) {
        viewDropdownMenu.style.display = "none";
        btnViewDropdown.setAttribute("aria-expanded", "false");
        if (targetView === "day" || targetView === "schedule") {
          setCalendarView(targetView, new Date());
        } else {
          setCalendarView(targetView);
        }
      }
    };
  }

  // Skylight Consolidated Filter Dropdown Wiring
  const btnFilterDropdown = document.getElementById("btn-filter-dropdown");
  const filterDropdownMenu = document.getElementById("filter-dropdown-menu");
  if (btnFilterDropdown && filterDropdownMenu) {
    btnFilterDropdown.onclick = (e) => {
      e.stopPropagation();
      const isOpen = filterDropdownMenu.style.display === "block";
      filterDropdownMenu.style.display = isOpen ? "none" : "block";
      btnFilterDropdown.setAttribute("aria-expanded", isOpen ? "false" : "true");
      btnFilterDropdown.classList.toggle("is-open", !isOpen);
      if (!isOpen) {
        alignDropdownOnScreen(filterDropdownMenu, btnFilterDropdown);
      }
      if (viewDropdownMenu) viewDropdownMenu.style.display = "none";
    };

    filterDropdownMenu.onclick = (e) => {
      // Done button: close filter dropdown
      if (e.target.closest("#btn-filter-done")) {
        e.stopPropagation();
        filterDropdownMenu.style.display = "none";
        btnFilterDropdown.setAttribute("aria-expanded", "false");
        btnFilterDropdown.classList.remove("is-open");
        return;
      }

      // Reset button: reset all filters to All & Everyone
      if (e.target.closest("#btn-filter-reset")) {
        e.stopPropagation();
        activeCalendarMemberFilters = null;
        activeCalendarMemberFilter = null;
        try {
          localStorage.removeItem("chore_calendar_member_filters");
        } catch (err) {}
        setCalendarContentFilter("all");
        return;
      }

      const item = e.target.closest(".dropdown-menu-item, .skylight-filter-row");
      if (!item) return;
      e.stopPropagation();
      // Keep dropdown open so the user can easily toggle profiles smoothly

      const contentFilter = item.getAttribute("data-content-filter");
      if (contentFilter) {
        setCalendarContentFilter(contentFilter);
        return;
      }

      const memberFilter = item.getAttribute("data-member-filter");
      if (memberFilter) {
        if (memberFilter === "ALL") {
          // If Select All was active (or all members were selected), tapping it turns all off ([])
          // If it was inactive, tapping it turns all on (null)
          const allCurrentlyActive = (activeCalendarMemberFilters === null) || 
            (Array.isArray(activeCalendarMemberFilters) && familyMembers.every(m => activeCalendarMemberFilters.includes(m)));
          
          if (allCurrentlyActive) {
            activeCalendarMemberFilters = []; // Turn all off
          } else {
            activeCalendarMemberFilters = null; // Turn all on (Select All)
          }
        } else {
          // Individual member toggled:
          // 1. If currently in "Select All" mode (null), expand to all members first
          let currentList = (activeCalendarMemberFilters === null) 
            ? [...familyMembers] 
            : [...activeCalendarMemberFilters];
          
          const idx = currentList.indexOf(memberFilter);
          if (idx > -1) {
            // Member was active -> turn just this member off!
            currentList.splice(idx, 1);
          } else {
            // Member was inactive -> turn this member on!
            currentList.push(memberFilter);
          }

          // If now all members are selected, normalize to null (Select All)
          if (familyMembers.every(m => currentList.includes(m))) {
            activeCalendarMemberFilters = null;
          } else {
            activeCalendarMemberFilters = currentList;
          }
        }

        activeCalendarMemberFilter = (activeCalendarMemberFilters && activeCalendarMemberFilters.length === 1)
          ? activeCalendarMemberFilters[0]
          : (activeCalendarMemberFilters && activeCalendarMemberFilters.length > 1 ? activeCalendarMemberFilters.join(" / ") : null);
        try {
          if (activeCalendarMemberFilters === null) {
            localStorage.removeItem("chore_calendar_member_filters");
          } else {
            localStorage.setItem("chore_calendar_member_filters", JSON.stringify(activeCalendarMemberFilters));
          }
        } catch (err) {}
        renderWeekCalendar();
      }
    };
  }

  // Global click outside to close dropdowns
  document.addEventListener("click", (e) => {
    if (viewDropdownMenu && !e.target.closest("#view-dropdown-wrap")) {
      viewDropdownMenu.style.display = "none";
      if (btnViewDropdown) btnViewDropdown.setAttribute("aria-expanded", "false");
    }
    if (filterDropdownMenu && !e.target.closest("#filter-dropdown-wrap")) {
      filterDropdownMenu.style.display = "none";
      if (btnFilterDropdown) btnFilterDropdown.setAttribute("aria-expanded", "false");
    }
    const tasksFilterDropdownMenu = document.getElementById("tasks-filter-dropdown-menu");
    const btnTasksFilterDropdown = document.getElementById("btn-tasks-filter-dropdown");
    if (tasksFilterDropdownMenu && !e.target.closest("#tasks-filter-dropdown-wrap")) {
      tasksFilterDropdownMenu.style.display = "none";
      if (btnTasksFilterDropdown) {
        btnTasksFilterDropdown.setAttribute("aria-expanded", "false");
        btnTasksFilterDropdown.classList.remove("is-open");
      }
    }
  });

  // Calendar Navigation (Day, Schedule, Week, Month)
  if (btnPrevWeek) {
    btnPrevWeek.addEventListener("click", () => {
      navigateCalendar(-1);
    });
  }
  if (btnNextWeek) {
    btnNextWeek.addEventListener("click", () => {
      navigateCalendar(1);
    });
  }
  if (btnTodayWeek) {
    btnTodayWeek.addEventListener("click", () => {
      calendarAnchorDate = new Date();
      calendarAnchorDate.setHours(0, 0, 0, 0);
      currentCalendarWeekOffset = 0;
      renderWeekCalendar();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    });
  }

  const btnCalendarAddNote = document.getElementById("btn-calendar-add-note");
  if (btnCalendarAddNote) {
    btnCalendarAddNote.addEventListener("click", (e) => {
      e.stopPropagation();
      openStickyNoteModal();
    });
  }

  // Delegated clicks inside calendar week grid (checkmarks, cards, discreet add, meals)
  if (weekGrid) {
    weekGrid.addEventListener("click", (e) => {
      // 1. Discreet Add Event Button in Day Box Header
      const addBtn = e.target.closest(".btn-discreet-add-event");
      if (addBtn) {
        e.stopPropagation();
        const dStr = addBtn.getAttribute("data-date");
        const dName = addBtn.getAttribute("data-day");
        openEventModal(null, dName, dStr);
        return;
      }

      // 2. Meal Strip click
      const mealStrip = e.target.closest(".skylight-box-meal, .calendar-day-meal-strip");
      if (mealStrip) {
        e.stopPropagation();
        const dStr = mealStrip.getAttribute("data-date");
        const dName = mealStrip.getAttribute("data-day") || "Tuesday";
        if (typeof openPlanMealModalForDate === "function") {
          openPlanMealModalForDate(dStr, dName);
        } else {
          switchSkylightView("meals");
        }
        return;
      }

      // 3. Chore checkmark toggle
      const checkBtn = e.target.closest(".skylight-chore-check, .calendar-card-check");
      if (checkBtn) {
        e.stopPropagation();
        if (checkBtn.getAttribute("data-future-locked") === "true") {
          showCalendarToast("⏰ Daily chores can only be completed on or after their scheduled day");
          return;
        }
        const taskId = checkBtn.getAttribute("data-task-id");
        const targetDay = checkBtn.getAttribute("data-day");
        const targetDate = checkBtn.getAttribute("data-date");
        const isCompleted = checkBtn.getAttribute("data-completed") === "true";
        if (isCompleted) {
          handleUndoTask(taskId, targetDay);
        } else {
          openClaimModal(taskId, targetDay, targetDate);
        }
        return;
      }

      // 4. Event card click
      const eventCard = e.target.closest(".skylight-card[data-event-id], .calendar-event-card, .skylight-day-event-banner[data-event-id]");
      if (eventCard) {
        e.stopPropagation();
        const eventId = eventCard.getAttribute("data-event-id");
        const evt = (familyEvents || []).find(x => x.id === eventId) || (window.familyEvents || []).find(x => x.id === eventId);
        // A small pop-up first, like tapping a task; Edit in it opens the panel
        const onDate = (eventCard.closest("[data-date]") || {}).getAttribute ? eventCard.closest("[data-date]").getAttribute("data-date") : null;
        if (evt && typeof window.openEventQuickView === "function") window.openEventQuickView(evt, onDate);
        else if (evt) openEventModal(evt);
        return;
      }

      // 5. Chore task card click
      const choreCard = e.target.closest(".skylight-card[data-task-id], .calendar-card");
      if (choreCard) {
        const taskId = choreCard.getAttribute("data-task-id");
        const targetDay = choreCard.getAttribute("data-day");
        // Same quick card as the Tasks page (Complete / Edit / Delete), for
        // whoever is doing it that day; Edit opens the Tasks side panel.
        const task = (currentTasks || []).find(t => t.id === taskId);
        if (task && typeof window.openSkylightTaskQuickModal === "function") {
          const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
          const dayValue = (isDaily && typeof window.getEffectiveAssignee === "function")
            ? window.getEffectiveAssignee(task, targetDay, getIsoWeekKey(new Date()))
            : task.assignedTo;
          const who = getAssigneeNames(dayValue);
          const colMember = who.length === 0 || who.every(n => /^(up for grabs|anyone)$/i.test(n)) ? "Up for grabs" : (who.length === 1 ? who[0] : null);
          window.openSkylightTaskQuickModal(taskId, targetDay || task.day, colMember);
        }
      }
    });
  }

  // Clock tick every 30s
  setInterval(() => {
    const clockEl = document.getElementById("calendar-live-clock");
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }, 30000);

  // Initialize Real-time Local Weather
  initLocalWeather();

  // Wire Magic Calendar AI Flyer & Schedule Scanner
  if (typeof wireCalendarMagicImportListeners === "function") {
    wireCalendarMagicImportListeners();
  }

  // Set Calendar as Default View
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get("view");
  if (requestedView === "chores") {
    switchSkylightView("chores");
  } else if (requestedView === "meals") {
    switchSkylightView("meals");
  } else if (requestedView === "rewards") {
    switchSkylightView("rewards");
  } else {
    switchSkylightView("calendar");
  }
}

// initSkylightNavigation handled by unified bootstrapApplication at bottom

// [Extracted to js/calendar.js: Family Calendar Multi-View Engine, Timeline & Event CRUD]
// ============================================================================
// 15. REWARDS PODIUM VIEW
// [Extracted to js/rewards.js: Rewards Podium View & Allowance Breakdown]


// [Extracted to js/meals.js: Skylight 4-Tier Meals & Recipes Module]
// ============================================================================
// [Extracted to js/sticky-note.js: Family Sticky Note / Message of the Day]

// [Extracted to js/lists.js: Dedicated Family Lists Hub]
// [Extracted to js/meals.js: wireMealsHeaderAndDrawerListeners, isDrawerDirty, handleAttemptCloseDrawer]
// [Extracted to js/magic-scanner.js: Recipe Vision & Calendar AI Scanner]


// ============================================================================


// ============================================================================
// UNIFIED APPLICATION BOOTSTRAP (Guaranteed after all variables and functions are evaluated)
// ============================================================================
function bootstrapApplication() {
  initApp();
  initSkylightNavigation();
  if (typeof initSkylightTaskDrawerEvents === "function") {
    initSkylightTaskDrawerEvents();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapApplication);
} else {
  bootstrapApplication();
}
