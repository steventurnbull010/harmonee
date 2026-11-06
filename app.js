// ============================================================================
// CHORE CHALLENGE — CORE APPLICATION LOGIC
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
  getDocs,
  writeBatch,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Preloaded Recipes Bank & Helper Imports
import { 
  PRELOADED_RECIPES, 
  getAllFamilyRecipes, 
  getRecipesByMealType, 
  searchRecipes, 
  findRecipeByIdOrTitle, 
  toggleRecipeFavorite,
  addCustomRecipe
} from "./recipes-data.js?v=147";

// ============================================================================
// 1. INITIAL SEED DATASET
// ============================================================================
const INITIAL_SEED_TASKS = [
  // Daily Routine Tasks
  {
    id: "daily-01",
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
    id: "daily-02",
    title: "Feed Cats & Fresh Water",
    day: "Daily",
    taskType: "Daily Task",
    room: "Kitchen",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Refill wet & dry cat food bowls and replace water fountain.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 2
  },
  {
    id: "daily-03",
    title: "Scoop & Empty Cat Litter Trays",
    day: "Daily",
    taskType: "Daily Task",
    room: "Utility / Downstairs",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Scoop litter trays, bag waste, and top up with fresh litter.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 3
  },
  {
    id: "daily-04",
    title: "Make Beds & Tidy Duvets",
    day: "Daily",
    taskType: "Daily Task",
    room: "Bedrooms",
    estimatedTime: "5 mins",
    isPriority: false,
    actionNote: "Straighten sheets, shake pillows, and make bedroom beds.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 4
  },

  // Friday Purge
  {
    id: "fp-01",
    title: "Replace Fire Alarm Battery",
    day: "Friday",
    taskType: "Standard",
    room: "Hallway",
    estimatedTime: "10 mins",
    isPriority: true,
    actionNote: "Priority safety item. Replace 9V battery in hallway smoke detector and test siren.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 5
  },
  {
    id: "fp-02",
    title: "Hardware & Supplies Run",
    day: "Friday",
    taskType: "Standard",
    room: "Shops",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Pick up 2 pairs yellow rubber gloves, Cif/Jif cream, scrubbers, soda crystals, heavy-duty black sacks, 9V battery.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 6
  },
  {
    id: "fp-03",
    title: "Move Flat-Pack Boxes Up to Bedrooms",
    day: "Friday",
    taskType: "Organization",
    room: "Hallway",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Shift flat-pack cartons out of hallway corridor and into Ava and Dara bedrooms.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 7
  },
  {
    id: "fp-04",
    title: "Ava Nail Station Pack-Away",
    category: "Friday Purge",
    room: "Living Room",
    estimatedTime: "10 mins",
    isPriority: false,
    actionNote: "Ava packs away UV lamp, polishes, and remover into a dedicated storage box.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 4
  },
  {
    id: "fp-05",
    title: "Clear Coffee Table & Cable Basket",
    category: "Friday Purge",
    room: "Living Room",
    estimatedTime: "15 mins",
    isPriority: false,
    actionNote: "Clear coffee table entirely; tuck white laundry basket of tangled electronics out of sight.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 5
  },
  {
    id: "fp-06",
    title: "Clear Office Desk & Floor Jackets",
    category: "Friday Purge",
    room: "Office",
    estimatedTime: "20 mins",
    isPriority: false,
    actionNote: "Clear mugs, mail, and wrappers. Bag up floor jackets and eBay coats into charity sacks.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 6
  },
  {
    id: "fp-07",
    title: "Downstairs Bedroom Rubbish & Broken Tech",
    category: "Friday Purge",
    room: "Spare Room",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Bin cardboard/packaging; bag old TV and 2 broken keyboards for tip run.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 7
  },
  {
    id: "fp-08",
    title: "Under-Stairs Coat & Shoe Cull",
    category: "Friday Purge",
    room: "Hallway",
    estimatedTime: "1.5 hrs",
    isPriority: false,
    actionNote: "Strict limit: 1 coat + 2 shoes per person. Move off-season gear to bags.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 8
  },
  {
    id: "fp-09",
    title: "Downstairs WC Odor & Radiator Reset",
    category: "Friday Purge",
    room: "Downstairs WC",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Move canvas off radiator. Treat basin/toilet drains with soda crystals and boiling water.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 9
  },
  {
    id: "fp-10",
    title: "Friday Tip & Charity Run",
    category: "Friday Purge",
    room: "Car / Civic Tip",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Load black sacks, dead tech, and donation bags straight into boot and drop at civic amenity.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 10
  },

  // Saturday Reset
  {
    id: "sr-11",
    title: "Front Door Frame & Hinges Toothbrush Scrub",
    category: "Saturday Reset",
    room: "Hallway",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Use Cif and old toothbrush on flag hinges and frame. Clean glass inside/out.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 11
  },
  {
    id: "sr-12",
    title: "Mow Front & Back Lawns",
    category: "Saturday Reset",
    room: "Garden",
    estimatedTime: "40 mins",
    isPriority: false,
    actionNote: "Mow lawns and edge pathways while weather holds.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 12
  },
  {
    id: "sr-13",
    title: "Car Wash & Interior Vacuum",
    category: "Saturday Reset",
    room: "Driveway",
    estimatedTime: "2 hrs",
    isPriority: false,
    actionNote: "Vacuum interior (boot & footwells), wipe console, exterior wash and dry.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 13
  },
  {
    id: "sr-14",
    title: "Kitchen Cupboards & Drawers Purge",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "2 hrs",
    isPriority: false,
    actionNote: "Marie Kondo cull of mismatched glasses, chipped mugs, and redundant kitchen gadgets.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 14
  },
  {
    id: "sr-15",
    title: "Kitchen High Ledge Clear-Out",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "1 hr",
    isPriority: false,
    actionNote: "Clear pots, pans, and appliances off shelf above fridge. Attic or store away.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 15
  },
  {
    id: "sr-16",
    title: "Live-Edge Wood Shelves Restyle",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Strip bare and apply negative space rule: matching canisters and everyday mugs only.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 16
  },
  {
    id: "sr-17",
    title: "Under-Sink Cabinet Reorganize",
    category: "Saturday Reset",
    room: "Kitchen",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Separate cat supplies from cleaning chemicals into distinct caddies.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 17
  },
  {
    id: "sr-18",
    title: "Office Windowsill Scrub & Blind Dust",
    category: "Saturday Reset",
    room: "Office",
    estimatedTime: "30 mins",
    isPriority: false,
    actionNote: "Deep clean windowsill with Cif/bleach; dust blind slats.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 18
  },
  {
    id: "sr-19",
    title: "Ground Floor Master Vacuum & Mop",
    category: "Saturday Reset",
    room: "All Downstairs",
    estimatedTime: "45 mins",
    isPriority: false,
    actionNote: "Vacuum all rugs/carpets; mop parquet and tiled areas for final weekend reset.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 19
  },

  // DIY Backlog
  {
    id: "diy-20",
    title: "Living Room Coving Installation",
    category: "DIY Backlog",
    room: "Living Room",
    estimatedTime: "1-2 days",
    isPriority: false,
    actionNote: "Measure perimeter, cut mitres, adhere and paint ceiling line.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 20
  },
  {
    id: "diy-21",
    title: "Ava Bedroom Full Renovation",
    category: "DIY Backlog",
    room: "Ava Bedroom",
    estimatedTime: "Multi-day",
    isPriority: false,
    actionNote: "Dismantle built-in wardrobe, patch subfloor/carpet, prep and paint walls, build 2 drawer sets.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 21
  },
  {
    id: "diy-22",
    title: "Attic Floorboarding",
    category: "DIY Backlog",
    room: "Attic",
    estimatedTime: "3-4 hrs",
    isPriority: false,
    actionNote: "Clear pathways and screw down loose tongue-and-groove boards over joists.",
    done: false,
    completedBy: null,
    completedAt: null,
    order: 22
  }
];

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
      localStorage.setItem("chore_active_board_id", cleaned);
      return cleaned;
    }
  }

  // Check if visitor previously launched or visited a board
  const saved = localStorage.getItem("chore_active_board_id");
  if (saved) return saved;

  // Turnbull is the safe primary family household board
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

// Board Settings: Game Mode & Currency
// Mode: "points" (default) or "money"
// Currency: "£", "$", "€"
let boardSettings = {
  gameMode: "points",
  currency: "£",
  sleepScheduleEnabled: true,
  sleepStartTime: "22:00",
  sleepEndTime: "07:00"
};

const STORAGE_KEY_SETTINGS = isDefaultTurnbullBoard ? "chore_settings" : `chore_settings_${currentBoardId}`;
const STORAGE_KEY_LEDGER = isDefaultTurnbullBoard ? "chore_weekly_ledger" : `chore_weekly_ledger_${currentBoardId}`;

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
  }

  localStorage.setItem(`last_active_week_${currentBoardId}`, currentWeek);
}

function loadLocalBoardSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        boardSettings = { ...boardSettings, ...parsed };
      }
    }
  } catch (e) {
    console.warn("Failed to load board settings:", e);
  }
}

function saveLocalBoardSettings(settings) {
  boardSettings = { ...boardSettings, ...settings };
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

function normalizeFamilyMemberName(name) {
  if (!name) return "";
  const s = String(name).trim();
  if (s.toLowerCase() === "steve") return "Steven";
  const match = familyMembers.find(m => m.toLowerCase() === s.toLowerCase());
  return match || s;
}
window.normalizeFamilyMemberName = normalizeFamilyMemberName;

const STORAGE_KEY_TASKS = isDefaultTurnbullBoard ? "chore_tasks" : `chore_tasks_${currentBoardId}`;
const STORAGE_KEY_ROSTER = isDefaultTurnbullBoard ? "chore_roster" : `chore_roster_${currentBoardId}`;
const STORAGE_KEY_CONFIG = "chore_challenge_firebase_cfg";

// Helper collection and document references for multi-tenancy
function getTasksCollectionRef() {
  if (!db) return null;
  return isDefaultTurnbullBoard 
    ? collection(db, "turnbull_reset_tasks") 
    : collection(db, "boards", currentBoardId, "tasks");
}

function getTaskDocRef(taskId) {
  if (!db) return null;
  return isDefaultTurnbullBoard 
    ? doc(db, "turnbull_reset_tasks", taskId) 
    : doc(db, "boards", currentBoardId, "tasks", taskId);
}

function getBoardDocRef() {
  if (!db) return null;
  return isDefaultTurnbullBoard
    ? null
    : doc(db, "boards", currentBoardId);
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
    const fallbackIds = ["warm-ochre", "periwinkle", "coral-pink", "spring-green", "sky-blue", "tangerine", "deep-teal"];
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
  projectId: "ava-turnbull-official",
  appId: "1:308604825341:web:1185f9e1f7139d180c9894",
  storageBucket: "ava-turnbull-official.firebasestorage.app",
  apiKey: "AIzaSyD8imvxL_Wdnzn5a4XHXW9p0D20p37olr4",
  authDomain: "ava-turnbull-official.firebaseapp.com",
  messagingSenderId: "308604825341"
};

let db = null;
let firestoreUnsubscribe = null;
let firestoreBoardUnsubscribe = null;
let currentTasks = [];
let currentActiveView = "calendar";
let currentCalendarView = "schedule";
try {
  const savedView = localStorage.getItem("chore_calendar_view");
  if (savedView && ["day", "schedule", "week", "month"].includes(savedView)) {
    currentCalendarView = savedView;
  }
} catch (e) {}

// Calendar displays events only. Chores live on dedicated Chores board page.
let currentCalendarContentFilter = "events";

// Hourly timeline zoom level for Schedule (3-Day) view
// 64px = default (~4-5 hours visible on screen), 40px = zoomed out (~7-8 hours visible on screen)
let scheduleHourHeight = 64;
try {
  const savedHeight = localStorage.getItem("chore_schedule_hour_height");
  if (savedHeight) {
    const parsedH = parseInt(savedHeight, 10);
    if (parsedH >= 38 && parsedH <= 110) scheduleHourHeight = parsedH;
  }
} catch (e) {}

let calendarAnchorDate = new Date();
calendarAnchorDate.setHours(0, 0, 0, 0);

let currentCalendarWeekOffset = 0;
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
const DEFAULT_WEEKLY_MEALS = {
  "Monday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Tuesday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Wednesday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Thursday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Friday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Saturday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false },
  "Sunday": { title: "", cook: "", notes: "", tags: "", hasRecipe: false }
};

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
let familyLists = null;
let activeListId = "groceries";
let familyGroceryList = null;
let isSleepScreenActive = false;
let sleepScreenTemporaryWakeUntil = 0;
let localWeatherForecast = null;
let isMagicEventScanningActive = false;
let lastMagicEventScanTimestamp = 0;
let currentScannedCalendarEvents = [];
let currentScannedFlyerDataUrl = "";
let currentScannedDocTitle = "";

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
    const cached = localStorage.getItem("turnbull_meals_v4") || localStorage.getItem("turnbull_meals_v3");
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

  // Only auto-seed if this device has NEVER been seeded before
  const hasSeeded = localStorage.getItem("turnbull_meals_has_seeded_v4");
  if (!hasSeeded) {
    localStorage.setItem("turnbull_meals_has_seeded_v4", "true");
    const todayKey = getLocalDateKey(new Date());
    dateMealsStore[todayKey] = {
      title: "Easy Peasy Spinach & Ricotta Tortelloni",
      cook: "Steve",
      notes: "with Creamy Basil Pesto Sauce, Peas & Broccoli",
      tags: "HelloFresh #47 • Veggie",
      hasRecipe: true,
      recipeId: "rec-spinach-tortelloni",
      date: todayKey,
      dinner: {
        title: "Easy Peasy Spinach & Ricotta Tortelloni",
        emoji: "🥟",
        cook: "Steve",
        notes: "with Creamy Basil Pesto Sauce, Peas & Broccoli",
        tags: "HelloFresh #47 • Veggie",
        hasRecipe: true,
        recipeId: "rec-spinach-tortelloni",
        category: "dinner",
        date: todayKey
      }
    };
    saveDateMeals(dateMealsStore);
  }

  return dateMealsStore;
}

function saveDateMeals(meals) {
  dateMealsStore = meals;
  try {
    localStorage.setItem("turnbull_meals_v4", JSON.stringify(meals));
    localStorage.setItem("turnbull_meals_v3", JSON.stringify(meals));
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
const DEFAULT_FAMILY_EVENTS = [
  {
    id: "evt_tutor_ava",
    title: "Maths After School",
    day: "Tuesday",
    time: "15:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "📚",
    description: "After school maths tutor.",
    location: "School"
  },
  {
    id: "evt_biology_ava",
    title: "Biology Tutor",
    day: "Tuesday",
    time: "19:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "🧬",
    description: "Weekly biology tutor session.",
    location: "Home"
  },
  {
    id: "evt_singing_ava",
    title: "Singing with Fiona",
    day: "Wednesday",
    time: "09:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Music",
    icon: "🎤",
    description: "Singing lesson with Fiona.",
    location: "Music Room"
  },
  {
    id: "evt_dionne_ava",
    title: "Dionne",
    day: "Wednesday",
    time: "19:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Activity",
    icon: "☕",
    description: "Dionne activity session.",
    location: "Community Center"
  },
  {
    id: "evt_business_dara",
    title: "Business Tutor",
    day: "Wednesday",
    time: "19:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Dara",
    category: "Tutor",
    icon: "📚",
    description: "Business studies tutor.",
    location: "Home / Online"
  },
  {
    id: "evt_maths_thu_ava",
    title: "Maths Tutor",
    day: "Thursday",
    time: "16:30",
    duration: "1 hour",
    repeat: "weekly",
    member: "Ava",
    category: "Tutor",
    icon: "📚",
    description: "Weekly maths tutor outside school.",
    location: "Outside school (Sarah's classroom)"
  },
  {
    id: "evt_driving_steve",
    title: "Driving Lesson",
    day: "Thursday",
    time: "17:00",
    duration: "1 hour",
    repeat: "weekly",
    member: "Steven",
    category: "Driving",
    icon: "🚗",
    description: "Instructor pick up at house, local test routes & maneuvers.",
    location: "Local test routes"
  },
  {
    id: "evt_rehearsals_ava",
    title: "Na Leanai Rehearsals",
    day: "Sunday",
    time: "14:00",
    duration: "2 hours",
    repeat: "weekly",
    member: "Ava",
    category: "Music",
    icon: "🎤",
    description: "Band rehearsal and practice.",
    location: "Rehearsal Studio"
  },
  {
    id: "evt_family_sunday",
    title: "Family Get-Together",
    day: "Sunday",
    time: "14:00",
    duration: "3 hours",
    repeat: "weekly",
    member: "Family",
    category: "Family",
    icon: "👨‍👩‍👧‍👦",
    description: "Sunday Roast with Grandparents and cousins.",
    location: "Sunday Roast with Grandparents"
  }
];

var skylightNavInitialized = false;
let activeCalendarMemberFilter = null;
let activeCalendarMemberFilters = null; // null means "Select All" / unconstrained. Empty array [] means literally nobody selected.
try {
  const savedMembers = localStorage.getItem("chore_calendar_member_filters");
  if (savedMembers) {
    const parsed = JSON.parse(savedMembers);
    if (Array.isArray(parsed)) {
      activeCalendarMemberFilters = parsed;
      activeCalendarMemberFilter = parsed.length === 1 ? parsed[0] : (parsed.length > 1 ? parsed.join(" / ") : null);
    }
  }
} catch (e) {}

function isMemberSelected(memberStr) {
  // If activeCalendarMemberFilters is null, "Select All" is active -> show everyone!
  if (activeCalendarMemberFilters === null) return true;
  // If activeCalendarMemberFilters is an empty array [], literally nobody is active -> hide all member events!
  if (activeCalendarMemberFilters.length === 0) return false;
  if (!memberStr) return true;
  const lower = memberStr.toLowerCase();
  if (lower.includes("family") || lower.includes("everyone") || lower.includes("anyone") || lower.includes("whole family") || lower.includes("up for grabs")) {
    return true;
  }
  return activeCalendarMemberFilters.some(m => lower.includes(m.toLowerCase()));
}
let familyEvents = null;

function loadFamilyEvents() {
  try {
    const cached = localStorage.getItem("turnbull_family_events_v3");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Error reading family events cache", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_FAMILY_EVENTS));
}

function saveFamilyEvents(events) {
  familyEvents = events;
  try {
    localStorage.setItem("turnbull_family_events_v3", JSON.stringify(events));
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

// ============================================================================
// 3. WEB AUDIO SYNTHESIZER (CELEBRATORY CHIME)
// ============================================================================
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Play a triumphant, shimmering 3-chord celebratory synth chime
  playCelebrationChime() {
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Musical notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Warm chime timbre
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        // Gentle envelope with shimmer
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.85);
      });
    } catch (err) {
      console.warn("Audio chime error:", err);
    }
  }

  // Play pleasant double coin ting when pocket money is earned
  playCoinChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [987.77, 1318.51].forEach((freq, i) => { // B5, E6
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        gain.gain.setValueAtTime(0.3, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.5);
      });
    } catch (e) {
      console.warn("Coin chime error:", e);
    }
  }

  // Soft click/pop for undo
  playUndoPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // ignore
    }
  }
}

const sfx = new SoundEffects();

// ============================================================================
// 4. CONFETTI BURST (CELEBRATION FLOW)
// ============================================================================
function triggerConfettiBurst() {
  if (typeof window.confetti === "function") {
    // 1st burst from center-left
    window.confetti({
      particleCount: 50,
      angle: 60,
      spread: 70,
      origin: { x: 0.1, y: 0.7 },
      colors: ["#38bdf8", "#0284c7", "#f59e0b", "#10b981", "#ec4899"]
    });

    // 2nd burst from center-right
    window.confetti({
      particleCount: 50,
      angle: 120,
      spread: 70,
      origin: { x: 0.9, y: 0.7 },
      colors: ["#38bdf8", "#0284c7", "#f59e0b", "#10b981", "#ec4899"]
    });

    // Golden fireworks burst in center
    setTimeout(() => {
      window.confetti({
        particleCount: 65,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#ffd700", "#38bdf8", "#f43f5e"]
      });
    }, 150);
  }
}

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
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    let cfg = null;
    if (raw) {
      cfg = JSON.parse(raw);
    } else if (DEFAULT_FIREBASE_CONFIG && DEFAULT_FIREBASE_CONFIG.apiKey) {
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
        boardSettings = { ...boardSettings, ...data.settings };
        saveLocalBoardSettings(boardSettings);
        shouldRender = true;
      }
      if (Array.isArray(data.events) && data.events.length > 0) {
        familyEvents = data.events;
        try { localStorage.setItem("turnbull_family_events_v3", JSON.stringify(data.events)); } catch (e) {}
        shouldRender = true;
      }
      if (data.meals && typeof data.meals === "object") {
        dateMealsStore = data.meals;
        try {
          localStorage.setItem("turnbull_meals_v4", JSON.stringify(data.meals));
          localStorage.setItem("turnbull_meals_v3", JSON.stringify(data.meals));
        } catch (e) {}
        shouldRender = true;
      }
      if (Array.isArray(data.customRecipes)) {
        try {
          const safeRecipes = data.customRecipes.filter(r => r && typeof r === "object" && r.id);
          localStorage.setItem("turnbull_custom_recipes", JSON.stringify(safeRecipes));
        } catch (e) {}
      }
      if (data.stickyNote !== undefined) {
        if (data.stickyNote && data.stickyNote.text && !data.stickyNote.deleted) {
          familyStickyNote = data.stickyNote;
          try { localStorage.setItem("turnbull_sticky_note", JSON.stringify(data.stickyNote)); } catch (e) {}
        } else {
          familyStickyNote = null;
          try { localStorage.setItem("turnbull_sticky_note", "none"); } catch (e) {}
        }
        renderFamilyStickyNote();
      }
      if (Array.isArray(data.familyLists)) {
        familyLists = data.familyLists;
        try { localStorage.setItem("turnbull_family_lists", JSON.stringify(data.familyLists)); } catch (e) {}
        if (currentActiveView === "lists") {
          renderListsView();
        }
      }
      if (shouldRender) {
        renderApp();
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
    const cached = localStorage.getItem(STORAGE_KEY_ROSTER);
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
    const cached = localStorage.getItem(STORAGE_KEY_TASKS);
    if (cached) {
      const parsed = JSON.parse(cached);
      currentTasks = parsed.filter(t => !t.archived).map(normalizeTask);

      if (isDefaultTurnbullBoard) {
        // Check if daily tasks are missing from cache; if so, prepend them
        const hasDaily = currentTasks.some(t => t.id && t.id.startsWith("daily-"));
        if (!hasDaily) {
          const dailySeed = INITIAL_SEED_TASKS.filter(t => t.id && t.id.startsWith("daily-"));
          currentTasks = [...dailySeed, ...currentTasks];
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
  }
  renderApp();
}

function saveLocalCache(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Storage quota exceeded", e);
  }
}

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
  select.innerHTML = `<option value="">⚡ Up for Grabs (Anyone)</option>`;

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
        if (t.assignedTo && t.assignedTo.toLowerCase() === filterLower) return true;
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
      if (t.assignedTo && t.assignedTo.toLowerCase() === filterLower) {
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
          <span>Up for Grabs — Bonus Tasks</span>
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
    const memberName = (highlightMember || task.assignedTo).toLowerCase();
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
  if (!isDone && (!task.assignedTo || task.assignedTo.toLowerCase() === "anyone")) {
    badgesHtml += `<span class="badge badge-up-for-grabs">⚡ Up for Grabs</span>`;
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
  } else if (task.assignedTo) {
    const memberIdx = familyMembers.indexOf(task.assignedTo);
    const color = getMemberColor(memberIdx !== -1 ? memberIdx : 0);
    const initial = task.assignedTo.charAt(0).toUpperCase();
    avatarRightHtml = `
      <button type="button" class="card-assignee-avatar-btn btn-open-assign" data-task-id="${task.id}" title="Assigned to ${escapeHtml(task.assignedTo)} — Tap to change" aria-label="Assigned to ${escapeHtml(task.assignedTo)}">
        <div class="avatar-ring" style="background: ${color.bg}; border: 2px solid ${color.border};">${escapeHtml(initial)}</div>
      </button>
    `;
  } else {
    avatarRightHtml = `
      <button type="button" class="card-assignee-avatar-btn unassigned btn-open-assign" data-task-id="${task.id}" title="Up for Grabs — Tap to assign" aria-label="Up for Grabs — Tap to assign">
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
      assigned = task.assignedDays[day] || "";
    } else if (task && task.assignedTo) {
      assigned = task.assignedTo;
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
    card.title = `Tap to assign ${day} (Currently: ${assignedPerson || "Up for Grabs"})`;

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
  const task = currentTasks.find(t => t.id === taskId);
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
    ? (task.assignedDays[targetDay] || "")
    : (task.assignedTo || "");
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

function closeTaskModal() {
  closeRosterMemberPopover();
  if (typeof taskModal.close === "function") {
    taskModal.close();
  } else {
    taskModal.removeAttribute("open");
  }
  syncModalScrollLock();
}

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
    const isUnassigned = !effectiveAssignee || effectiveAssignee.toLowerCase() === "anyone" || effectiveAssignee.toLowerCase() === "unassigned" || effectiveAssignee.toLowerCase() === "up for grabs";
    hintEl.textContent = isUnassigned
      ? "⚡ Up for Grabs! Tap who completed this chore to claim the points:"
      : `Assigned to ${escapeHtml(effectiveAssignee)}. Select who completed this chore:`;
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
    if (memberToUndo && Array.isArray(task.assignedTo) && task.assignedTo.length > 1) {
      const rec = currentCompletedDays[dayToRemove];
      if (rec) {
        let list = Array.isArray(rec.completedBy) ? [...rec.completedBy] : (typeof rec.completedBy === "string" ? rec.completedBy.split(",").map(s=>s.trim()) : []);
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
  const idx = currentTasks.findIndex(t => t.id === taskId);
  if (idx !== -1) {
    if (memberToUndo && Array.isArray(task.assignedTo) && task.assignedTo.length > 1) {
      let list = Array.isArray(currentTasks[idx].completedBy) ? [...currentTasks[idx].completedBy] : (typeof currentTasks[idx].completedBy === "string" ? currentTasks[idx].completedBy.split(",").map(s=>s.trim()) : []);
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
        openEditTaskModal(taskId);
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
    addTaskBtn.addEventListener("click", openCreateTaskModal);
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
      if (typeof resetConfirmModal.showModal === "function") resetConfirmModal.showModal();
      else resetConfirmModal.setAttribute("open", "");
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
      if (typeof resetConfirmModal.close === "function") resetConfirmModal.close();
      else resetConfirmModal.removeAttribute("open");

      if (db) {
        await seedFirestoreData();
      } else {
        currentTasks = JSON.parse(JSON.stringify(isDefaultTurnbullBoard ? INITIAL_SEED_TASKS : STARTER_GENERIC_TASKS));
        saveLocalCache(currentTasks);
        renderApp();
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

      const slug = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

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
          <button type="button" class="roster-color-trigger-btn" data-member="${escapeHtml(member)}" title="Change ${escapeHtml(member)}'s Profile Color" style="background: ${pal.primary}; border: 2px solid ${pal.border};">
            ${escapeHtml(initial)}
          </button>
          <div class="roster-member-names-wrap">
            <span class="roster-member-name">${escapeHtml(member)}</span>
            <span class="roster-member-color-name">${escapeHtml(pal.name || "Custom")}</span>
          </div>
        </div>
        <div class="roster-member-actions">
          <button type="button" class="btn-change-member-color" data-member="${escapeHtml(member)}" title="Change Color">
            Palette 🎨
          </button>
          <button type="button" class="btn-remove-member" data-member-index="${idx}" title="Remove ${escapeHtml(member)}">
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
          warning: `Are you sure you want to remove ${member} from this family board?`,
          confirmLabel: `Remove ${member}`,
          onConfirm: () => {
            familyMembers.splice(idx, 1);
            saveRosterAndSync();
            renderRosterModalList();
            renderApp();
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

    if (db && !isDefaultTurnbullBoard) {
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
      renderRosterModalList();
      if (rosterModal) {
        if (typeof rosterModal.showModal === "function") rosterModal.showModal();
        else rosterModal.setAttribute("open", "");
      }
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

  function openSettingsModal() {
    tempSelectedMode = boardSettings.gameMode || "points";
    tempSelectedCurrency = boardSettings.currency || "£";

    updateSettingsModalUI();

    if (settingsModal) {
      if (typeof settingsModal.showModal === "function") settingsModal.showModal();
      else settingsModal.setAttribute("open", "");
    }
  }
  window.openSettingsModal = openSettingsModal;

  function closeSettingsModal() {
    if (settingsModal) {
      if (typeof settingsModal.close === "function") settingsModal.close();
      else settingsModal.removeAttribute("open");
    }
  }

  function renderWeeklyHistoryList() {
    const container = document.getElementById("weekly-history-container");
    if (!container) return;

    const ledger = loadWeeklyLedger();
    if (ledger.length === 0) {
      container.innerHTML = `<div class="history-empty-note">No archived weeks yet. First weekly snapshot records this Sunday at midnight!</div>`;
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
          const val = isMoney ? `${currency}${score.toFixed(2)}` : `${score} pts`;
          return `<span class="history-member-pill">${escapeHtml(name)}: <span class="history-member-score">${val}</span></span>`;
        })
        .join("");

      card.innerHTML = `
        <div class="history-week-top">
          <span>Week: ${escapeHtml(entry.weekKey)}</span>
          <span>${new Date(entry.archivedAt).toLocaleDateString()}</span>
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
        aiPromptInput.focus();
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
        aiPromptInput.focus();
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
        }
      } else {
        currentTasks.push(...parsedAiTasks);
        saveLocalCache(currentTasks);
        renderApp();
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

// 15. SKYLIGHT TASKS PAGE (Multi-Column Profiles Board & Gestures)
// ============================================================================
let tasksSelectedDate = new Date();
tasksSelectedDate.setHours(0, 0, 0, 0);

// Column category filter state: { [memberLower]: 'all' | 'morning' | 'afternoon' | 'evening' | 'chores' }
let tasksColumnFilters = {};

// Active filter in Tasks Filter Dropdown (member visibility)
let tasksActiveMemberFilter = null; // null = all visible, or array of member names

function renderSkylightTasksPage() {
  const container = document.getElementById("tasks-columns-grid");
  if (!container) return;

  const clockEl = document.getElementById("tasks-live-clock");
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const famEl = document.getElementById("tasks-family-name");
  if (famEl) {
    famEl.textContent = isDefaultTurnbullBoard ? "Turnbull Family" : (boardSettings.familyName || "Our Family");
  }

  // Update date banner
  const dateSubBar = document.getElementById("tasks-date-sub-bar");
  if (dateSubBar) {
    const dNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dow = dNames[tasksSelectedDate.getDay()];
    const mon = mNames[tasksSelectedDate.getMonth()];
    const dt = tasksSelectedDate.getDate();
    const yr = tasksSelectedDate.getFullYear();
    const isToday = (new Date()).toDateString() === tasksSelectedDate.toDateString();
    dateSubBar.textContent = isToday ? `Today • ${dow}, ${dt} ${mon}` : `${dow}, ${dt} ${mon} ${yr}`;
  }

  const selectedDateStr = getLocalDateKey(tasksSelectedDate);
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekDays[tasksSelectedDate.getDay()];
  const isSelectedCurrentWeek = (getIsoWeekKey(tasksSelectedDate) === getIsoWeekKey(new Date()));

  // Active columns: Family Members + "Up for grabs"
  let columns = [...(familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];

  if (tasksActiveMemberFilter && Array.isArray(tasksActiveMemberFilter)) {
    columns = columns.filter(c => tasksActiveMemberFilter.includes(c));
  }

  let totalTasksAllBoard = 0;
  let completedTasksAllBoard = 0;

  let columnsHtml = "";

  columns.forEach(colMember => {
    const isGrabPool = colMember === "Up for grabs";
    const mLower = colMember.toLowerCase();
    const pal = isGrabPool 
      ? { primary: "#ef4444", lightBg: "#fef2f2", border: "#fca5a5", text: "#991b1b", solid: "#ef4444" }
      : getMemberPalette(colMember);

    // Filter tasks belonging to this profile for today
    let memberTasks = currentTasks.filter(task => {
      if (!task || typeof task !== "object") return false;
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const assigned = task.assignedTo || "Up for grabs";

      if (isGrabPool) {
        // Unassigned or assigned to Anyone / Up for grabs
        if (!isDaily && (assigned === "Up for grabs" || assigned === "Anyone" || assigned === "Family")) {
          return task.date ? task.date === selectedDateStr : (task.day === dayName || isSelectedCurrentWeek);
        }
        return false;
      }

      // Helper: check if task is assigned to this member (handles single string, comma-separated, or array)
      const isAssignedToThisMember = (assignedVal) => {
        if (!assignedVal) return false;
        if (Array.isArray(assignedVal)) {
          return assignedVal.some(v => String(v).trim().toLowerCase() === mLower);
        }
        if (typeof assignedVal === "string") {
          return assignedVal.split(",").map(v => v.trim().toLowerCase()).includes(mLower);
        }
        return false;
      };

      // Member column:
      if (isDaily) {
        if (task.assignedDays && task.assignedDays[dayName] !== undefined) {
          return isAssignedToThisMember(task.assignedDays[dayName]);
        }
        return isAssignedToThisMember(task.assignedTo);
      }

      if (isAssignedToThisMember(task.assignedTo)) {
        if (task.date) return task.date === selectedDateStr;
        if (task.repeat === "weekly") return task.day === dayName;
        return isSelectedCurrentWeek && task.day === dayName;
      }
      return false;
    });

    // Check completed count
    const totalCount = memberTasks.length;
    let completedCount = 0;

    memberTasks.forEach(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      if (isDaily) {
        if (task.completedDays && task.completedDays[dayName]) completedCount++;
      } else {
        if (task.done) completedCount++;
      }
    });

    totalTasksAllBoard += totalCount;
    completedTasksAllBoard += completedCount;

    // Filter pills (Morning, Afternoon, Evening, Chores)
    const activeFilter = tasksColumnFilters[mLower] || "all";

    // Group tasks
    const morningTasks = [];
    const afternoonTasks = [];
    const eveningTasks = [];
    const generalChores = [];

    memberTasks.forEach(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      const rInfo = getTaskRoutineInfo(task);
      if (isDaily || task.routineSlot) {
        const slot = task.routineSlot || (rInfo.label.includes("Morning") ? "morning" : (rInfo.label.includes("Afternoon") ? "afternoon" : "evening"));
        if (slot === "morning") morningTasks.push(task);
        else if (slot === "afternoon") afternoonTasks.push(task);
        else eveningTasks.push(task);
      } else {
        generalChores.push(task);
      }
    });

    // Routine filter pills HTML
    const hasMorning = morningTasks.length > 0;
    const hasAfternoon = afternoonTasks.length > 0;
    const hasEvening = eveningTasks.length > 0;
    const hasChores = generalChores.length > 0;

    let filterPillsHtml = "";
    if (hasMorning || hasAfternoon || hasEvening || hasChores) {
      filterPillsHtml = `
        <div class="tasks-col-routine-filters">
          ${hasMorning ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'morning' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="morning" title="Show Morning routines">
              <div class="circle-icon-wrap">🌤️</div>
              <span class="circle-label">Morning</span>
            </button>
          ` : ''}
          ${hasAfternoon ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'afternoon' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="afternoon" title="Show Afternoon routines">
              <div class="circle-icon-wrap">⛅</div>
              <span class="circle-label">Afternoon</span>
            </button>
          ` : ''}
          ${hasEvening ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'evening' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="evening" title="Show Evening routines">
              <div class="circle-icon-wrap">🌙</div>
              <span class="circle-label">Evening</span>
            </button>
          ` : ''}
          ${hasChores ? `
            <button type="button" class="routine-filter-circle-btn ${activeFilter === 'chores' ? 'active' : ''}" data-member="${escapeHtml(colMember)}" data-filter="chores" title="Show Chores">
              <div class="circle-icon-wrap">🧹</div>
              <span class="circle-label">Chores</span>
            </button>
          ` : ''}
        </div>
      `;
    }

    // Render task cards helper
    const renderCard = (t) => {
      const isDaily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      let isDone = false;
      if (isDaily) {
        const comp = t.completedDays && t.completedDays[dayName];
        if (comp) {
          if (Array.isArray(t.assignedTo) && t.assignedTo.length > 1) {
            const list = Array.isArray(comp.completedBy) ? comp.completedBy : (typeof comp.completedBy === "string" ? comp.completedBy.split(",").map(s=>s.trim().toLowerCase()) : []);
            isDone = list.includes(mLower);
          } else {
            isDone = true;
          }
        }
      } else {
        if (Array.isArray(t.assignedTo) && t.assignedTo.length > 1) {
          const list = Array.isArray(t.completedBy) ? t.completedBy : (typeof t.completedBy === "string" ? t.completedBy.split(",").map(s=>s.trim().toLowerCase()) : []);
          isDone = list.includes(mLower);
        } else {
          isDone = !!t.done;
        }
      }
      const tIcon = t.icon || detectEmojiForChore(t.title) || "🪆";
      const isMoney = boardSettings.gameMode === "money";
      const curr = boardSettings.currency || "£";
      const valText = isMoney ? `${curr}${((t.value || 10) / 10).toFixed(2)}` : `${t.value || 10} pts`;
      const timeSubtitle = t.time || (isDaily ? "Daily" : "Today");

      return `
        <div class="skylight-task-card ${isDone ? 'is-completed' : ''}" 
             style="background: ${isDone ? 'rgba(0,0,0,0.03)' : pal.lightBg}; border-color: ${pal.border};"
             data-task-id="${t.id}" data-day="${dayName}" data-date="${selectedDateStr}">
          <div class="skylight-task-card-main">
            <span class="skylight-task-card-icon">${escapeHtml(tIcon)}</span>
            <div class="skylight-task-card-text">
              <span class="skylight-task-card-title">${escapeHtml(t.title)}</span>
              <span class="skylight-task-card-sub">${escapeHtml(timeSubtitle)} • ${valText}</span>
            </div>
          </div>
          <button type="button" class="skylight-task-check-circle" 
                  data-task-id="${t.id}" data-day="${dayName}" data-member="${escapeHtml(colMember)}" data-completed="${isDone ? 'true' : 'false'}"
                  title="${isDone ? 'Undo task' : 'Mark as complete'}">
            ${isDone ? '✓' : ''}
          </button>
        </div>
      `;
    };

    // Build Column Sections
    let bodySectionsHtml = "";
    if (totalCount === 0) {
      const emptyIcons = ["⭐", "👏", "✨", "🪅"];
      const randIcon = emptyIcons[Math.abs(colMember.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % emptyIcons.length];
      bodySectionsHtml = `
        <div class="tasks-col-empty-card">
          <span class="tasks-col-empty-icon">${randIcon}</span>
          <span class="tasks-col-empty-label">Nothing to do today.</span>
        </div>
      `;
    } else {
      let sectionsToShow = [];
      if (activeFilter === "all" || activeFilter === "morning") {
        if (morningTasks.length > 0) sectionsToShow.push({ title: "Morning", list: morningTasks });
      }
      if (activeFilter === "all" || activeFilter === "afternoon") {
        if (afternoonTasks.length > 0) sectionsToShow.push({ title: "Afternoon", list: afternoonTasks });
      }
      if (activeFilter === "all" || activeFilter === "evening") {
        if (eveningTasks.length > 0) sectionsToShow.push({ title: "Evening", list: eveningTasks });
      }
      if (activeFilter === "all" || activeFilter === "chores") {
        if (generalChores.length > 0) sectionsToShow.push({ title: "Chores", list: generalChores });
      }

      bodySectionsHtml = sectionsToShow.map(sec => `
        <div class="tasks-section-group">
          <h4 class="tasks-section-heading">${sec.title}</h4>
          ${sec.list.map(renderCard).join("")}
        </div>
      `).join("");
    }

    const isAllDone = totalCount > 0 && completedCount === totalCount;
    const initialLetter = isGrabPool ? "⚡" : colMember.charAt(0).toUpperCase();

    columnsHtml += `
      <div class="skylight-tasks-col" style="background: ${pal.lightBg}22; border-color: ${pal.border};">
        <div class="tasks-col-header">
          <div class="tasks-col-top-row">
            <div class="tasks-col-profile-info">
              <div class="tasks-col-avatar" style="background: ${pal.primary};">${escapeHtml(initialLetter)}</div>
              <span class="tasks-col-name">${escapeHtml(colMember)}</span>
            </div>
            <span class="tasks-col-progress-tally ${isAllDone ? 'all-done' : ''}">
              ${isAllDone ? '✓' : ''} ${completedCount}/${totalCount}
            </span>
          </div>
          ${filterPillsHtml}
        </div>
        <div class="tasks-col-body">
          ${bodySectionsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = columnsHtml;

  // Wire filter pill buttons
  container.querySelectorAll(".routine-filter-circle-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const m = btn.getAttribute("data-member").toLowerCase();
      const f = btn.getAttribute("data-filter");
      tasksColumnFilters[m] = (tasksColumnFilters[m] === f) ? "all" : f;
      renderSkylightTasksPage();
    };
  });

  // Wire task card click -> opens quick card modal
  container.querySelectorAll(".skylight-task-card").forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest(".skylight-task-check-circle")) return;
      const tid = card.getAttribute("data-task-id");
      const dName = card.getAttribute("data-day");
      openSkylightTaskQuickModal(tid, dName);
    };
  });

  // Wire completion check circle click
  container.querySelectorAll(".skylight-task-check-circle").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tid = btn.getAttribute("data-task-id");
      const dName = btn.getAttribute("data-day");
      const mem = btn.getAttribute("data-member") || null;
      const isComp = btn.getAttribute("data-completed") === "true";
      if (isComp) {
        handleUndoTask(tid, dName, null, mem);
      } else {
        handleCompleteTaskWithCelebration(tid, dName, mem);
      }
    };
  });
}
window.renderSkylightTasksPage = renderSkylightTasksPage;

// --- Task Completion with Sound & Full Celebration Trigger ---
function handleCompleteTaskWithCelebration(taskId, targetDay, memberCompleter = null) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  const completer = memberCompleter || (Array.isArray(task.assignedTo) ? task.assignedTo[0] : (task.assignedTo || "Family"));

  if (isDaily) {
    if (!task.completedDays) task.completedDays = {};
    const existing = task.completedDays[targetDay];
    if (Array.isArray(task.assignedTo) && task.assignedTo.length > 1) {
      let currentList = [];
      if (existing) {
        currentList = Array.isArray(existing.completedBy) ? [...existing.completedBy] : (typeof existing.completedBy === "string" ? existing.completedBy.split(",").map(s=>s.trim()) : []);
      }
      if (!currentList.includes(completer)) currentList.push(completer);
      task.completedDays[targetDay] = {
        completedBy: currentList,
        completedAt: new Date().toISOString()
      };
    } else {
      task.completedDays[targetDay] = {
        completedBy: completer,
        completedAt: new Date().toISOString()
      };
    }
  } else {
    if (Array.isArray(task.assignedTo) && task.assignedTo.length > 1) {
      let currentList = Array.isArray(task.completedBy) ? [...task.completedBy] : (typeof task.completedBy === "string" ? task.completedBy.split(",").map(s=>s.trim()) : []);
      if (!currentList.includes(completer)) currentList.push(completer);
      task.completedBy = currentList;
      task.done = task.assignedTo.every(m => currentList.includes(m));
      task.completedAt = new Date().toISOString();
    } else {
      task.done = true;
      task.completedBy = completer;
      task.completedAt = new Date().toISOString();
    }
  }

  saveLocalCache(currentTasks);
  if (db) {
    try {
      const docRef = getTaskDocRef(taskId);
      updateDoc(docRef, {
        done: task.done,
        completedBy: task.completedBy,
        completedAt: task.completedAt,
        completedDays: task.completedDays || {}
      });
    } catch (err) {}
  }

  // Play crisp completion chime
  if (typeof sfx !== "undefined" && sfx && sfx.playTaskDone) sfx.playTaskDone();

  renderSkylightTasksPage();

  // Check if ALL tasks for today are now completed!
  checkAllTasksCompletedCelebration();
}
window.handleCompleteTaskWithCelebration = handleCompleteTaskWithCelebration;

function checkAllTasksCompletedCelebration() {
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekDays[tasksSelectedDate.getDay()];
  const selectedDateStr = getLocalDateKey(tasksSelectedDate);

  let total = 0;
  let done = 0;

  currentTasks.forEach(task => {
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    let forToday = false;
    if (isDaily) forToday = true;
    else if (task.date) forToday = (task.date === selectedDateStr);
    else if (task.day === dayName) forToday = true;

    if (forToday) {
      total++;
      if (isDaily) {
        if (task.completedDays && task.completedDays[dayName]) done++;
      } else {
        if (task.done) done++;
      }
    }
  });

  if (total > 0 && done === total) {
    // Trigger celebration overlay!
    showSkylightCelebration();
  }
}

function showSkylightCelebration() {
  const overlay = document.getElementById("skylight-celebration-overlay");
  if (overlay) overlay.style.display = "flex";

  if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  const dismissBtn = document.getElementById("btn-celebration-dismiss");
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      if (overlay) overlay.style.display = "none";
    };
  }
}
window.showSkylightCelebration = showSkylightCelebration;

// ============================================================================
// 16. SKYLIGHT TASK QUICK ACTION MODAL (Card Click)
// ============================================================================
let currentQuickTaskId = null;
let currentQuickTaskDay = null;

function openSkylightTaskQuickModal(taskId, targetDay) {
  const task = currentTasks.find(t => t.id === taskId);
  if (!task) return;

  currentQuickTaskId = taskId;
  currentQuickTaskDay = targetDay;

  const overlay = document.getElementById("skylight-task-quick-modal");
  if (!overlay) return;

  document.getElementById("quick-card-title").textContent = task.title;
  const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
  document.getElementById("quick-card-datetime").textContent = isDaily ? `${targetDay} Routine • ${task.time || 'Anytime'}` : `${task.day || targetDay} Chore • ${task.time || 'Today'}`;

  const assigneeEl = document.getElementById("quick-card-assignee");
  if (assigneeEl) {
    if (Array.isArray(task.assignedTo)) {
      const avatars = task.assignedTo.map(m => {
        const pal = getMemberPalette(m);
        return `<span class="skylight-avatar avatar-mini" style="background: ${pal.primary}; color: #fff;">${m.charAt(0).toUpperCase()}</span>`;
      }).join("");
      assigneeEl.innerHTML = `
        <div style="display: flex; gap: 4px; align-items: center;">${avatars}</div>
        <span style="font-weight: 500;">${escapeHtml(task.assignedTo.join(", "))}</span>
      `;
    } else {
      const assigned = task.assignedTo || "Up for grabs";
      const pal = (assigned === "Up for grabs" || assigned === "Anyone") ? { primary: "#ef4444" } : getMemberPalette(assigned);
      assigneeEl.innerHTML = `
        <span class="skylight-avatar avatar-mini" style="background: ${pal.primary}; color: #fff;">${assigned.charAt(0).toUpperCase()}</span>
        <span style="font-weight: 500;">${escapeHtml(assigned)}</span>
      `;
    }
  }

  const isMoney = boardSettings.gameMode === "money";
  const curr = boardSettings.currency || "£";
  document.getElementById("quick-card-reward").textContent = isMoney ? `${curr}${((task.value || 10) / 10).toFixed(2)}` : `${task.value || 10} pts`;

  const compBtn = document.getElementById("btn-quick-card-complete");
  const isDone = isDaily ? !!(task.completedDays && task.completedDays[targetDay]) : !!task.done;
  compBtn.textContent = isDone ? "Mark as Incomplete" : "Mark as Complete";
  compBtn.onclick = () => {
    overlay.style.display = "none";
    if (isDone) {
      handleUndoTask(taskId, targetDay);
    } else {
      handleCompleteTaskWithCelebration(taskId, targetDay);
    }
  };

  overlay.style.display = "flex";

  // Wire close
  document.getElementById("btn-quick-card-close").onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };

  // Wire Edit -> opens right drawer prefilled
  document.getElementById("btn-quick-card-edit").onclick = () => {
    overlay.style.display = "none";
    openSkylightTaskDrawer(taskId);
  };

  // Wire Delete
  document.getElementById("btn-quick-card-delete").onclick = () => {
    overlay.style.display = "none";
    openDeleteTaskModal(taskId);
  };
}
window.openSkylightTaskQuickModal = openSkylightTaskQuickModal;

// ============================================================================
// 17. SKYLIGHT RIGHT-SIDE SLIDE-IN DRAWER (Add / Edit Task)
// ============================================================================
let drawerCurrentType = "chore";
let drawerSelectedProfiles = ["Steven"];
let drawerSelectedDate = new Date();
let drawerRoutineFreq = 1;
let drawerRoutineFreqUnit = "day";
let drawerRoutineSlot = "morning";
let drawerRewardValue = 10;
let drawerSelectedEmoji = "🪴";

function openSkylightTaskDrawer(taskId = null) {
  const overlay = document.getElementById("skylight-task-drawer-overlay");
  if (!overlay) return;

  const headingEl = document.getElementById("task-drawer-heading");
  const submitBtn = document.getElementById("btn-drawer-submit");
  const idInput = document.getElementById("drawer-task-id");
  const titleInput = document.getElementById("drawer-task-title");

  if (taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    headingEl.textContent = "Edit Task";
    submitBtn.textContent = "Save";
    idInput.value = task.id;
    titleInput.value = task.title || "";
    drawerSelectedEmoji = task.icon || "🪴";
    if (Array.isArray(task.assignedTo)) {
      drawerSelectedProfiles = [...task.assignedTo];
    } else if (task.assignedTo && typeof task.assignedTo === "string") {
      drawerSelectedProfiles = task.assignedTo.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      drawerSelectedProfiles = ["Up for grabs"];
    }
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    drawerCurrentType = (isDaily || task.routineSlot) ? "routine" : "chore";
    drawerRewardValue = task.value || 10;
    drawerRoutineSlot = task.routineSlot || "morning";
  } else {
    headingEl.textContent = "Add Task";
    submitBtn.textContent = "Add";
    idInput.value = "";
    titleInput.value = "";
    drawerSelectedEmoji = "🪴";
    drawerSelectedProfiles = [(familyMembers && familyMembers[0]) || "Steven"];
    drawerCurrentType = "chore";
    drawerRewardValue = 1;
    drawerRoutineSlot = "morning";
  }

  // Sync Emoji preview
  document.getElementById("drawer-emoji-preview").textContent = drawerSelectedEmoji;
  document.getElementById("drawer-emoji-grid").style.display = "none";

  // Sync Profiles pills
  renderDrawerProfilesRow();

  // Sync Frequency UI
  const freqNum = document.getElementById("drawer-routine-freq-num");
  if (freqNum) freqNum.textContent = drawerRoutineFreq;
  ["day", "week"].forEach(u => {
    const b = document.getElementById(`btn-routine-unit-${u}`);
    if (b) b.classList.toggle("active", u === drawerRoutineFreqUnit);
  });

  // Sync Routine slot UI
  ["morning", "afternoon", "evening"].forEach(s => {
    const b = document.getElementById(`btn-routine-slot-${s}`);
    if (b) b.classList.toggle("active", s === drawerRoutineSlot);
  });

  // Sync Type Switcher
  syncDrawerTypeUI();

  // Sync Reward text
  syncDrawerRewardUI();

  // Date label
  document.getElementById("drawer-chore-date-label").textContent = drawerSelectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  overlay.style.display = "flex";

  // Back button closes
  document.getElementById("btn-task-drawer-back").onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };
}
window.openSkylightTaskDrawer = openSkylightTaskDrawer;

function renderDrawerProfilesRow() {
  const row = document.getElementById("drawer-profiles-row");
  if (!row) return;

  const profiles = [...(familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];
  row.innerHTML = profiles.map(p => {
    const isGrab = p === "Up for grabs";
    const pal = isGrab ? { primary: "#ef4444" } : getMemberPalette(p);
    const initial = isGrab ? "⚡" : p.charAt(0).toUpperCase();
    const isActive = drawerSelectedProfiles.some(sp => sp.toLowerCase() === p.toLowerCase());
    return `
      <button type="button" class="drawer-profile-pill ${isActive ? 'active' : ''}" data-profile="${escapeHtml(p)}">
        <span class="drawer-profile-avatar" style="background: ${pal.primary};">${escapeHtml(initial)}</span>
        <span class="drawer-profile-name">${escapeHtml(p)}</span>
      </button>
    `;
  }).join("");

  row.querySelectorAll(".drawer-profile-pill").forEach(btn => {
    btn.onclick = () => {
      const p = btn.getAttribute("data-profile");
      if (p === "Up for grabs") {
        drawerSelectedProfiles = ["Up for grabs"];
      } else {
        drawerSelectedProfiles = drawerSelectedProfiles.filter(sp => sp !== "Up for grabs");
        const idx = drawerSelectedProfiles.findIndex(sp => sp.toLowerCase() === p.toLowerCase());
        if (idx !== -1) {
          // Deselect profile, but leave at least this one if it's the only one
          if (drawerSelectedProfiles.length > 1) {
            drawerSelectedProfiles.splice(idx, 1);
          }
        } else {
          drawerSelectedProfiles.push(p);
        }
      }
      renderDrawerProfilesRow();
    };
  });
}

function syncDrawerTypeUI() {
  const btnChore = document.getElementById("btn-drawer-type-chore");
  const btnRoutine = document.getElementById("btn-drawer-type-routine");
  const choreFields = document.getElementById("drawer-chore-fields");
  const routineFields = document.getElementById("drawer-routine-fields");

  if (btnChore) btnChore.classList.toggle("active", drawerCurrentType === "chore");
  if (btnRoutine) btnRoutine.classList.toggle("active", drawerCurrentType === "routine");
  if (choreFields) choreFields.style.display = drawerCurrentType === "chore" ? "block" : "none";
  if (routineFields) routineFields.style.display = drawerCurrentType === "routine" ? "block" : "none";
}

function syncDrawerRewardUI() {
  const isMoney = boardSettings.gameMode === "money";
  const curr = boardSettings.currency || "£";
  document.getElementById("drawer-reward-mode-text").textContent = isMoney ? `Pocket Money (${curr})` : `Reward Points`;
  document.getElementById("drawer-reward-display").textContent = isMoney ? `${curr}${(drawerRewardValue / 10).toFixed(2)}` : `${drawerRewardValue} pts`;
}

// Wire drawer interactions (steppers, accordion, date picker trigger, submit)
function initSkylightTaskDrawerEvents() {
  const btnChore = document.getElementById("btn-drawer-type-chore");
  const btnRoutine = document.getElementById("btn-drawer-type-routine");
  if (btnChore) btnChore.onclick = () => { drawerCurrentType = "chore"; syncDrawerTypeUI(); };
  if (btnRoutine) btnRoutine.onclick = () => { drawerCurrentType = "routine"; syncDrawerTypeUI(); };

  // Emoji accordion
  const emojiTrigger = document.getElementById("drawer-emoji-trigger");
  const emojiGrid = document.getElementById("drawer-emoji-grid");
  if (emojiTrigger && emojiGrid) {
    emojiGrid.innerHTML = EVENT_EMOJI_LIST.map(em => `<button type="button" class="drawer-emoji-item" data-emoji="${em}">${em}</button>`).join("");
    emojiTrigger.onclick = () => {
      emojiGrid.style.display = (emojiGrid.style.display === "none") ? "grid" : "none";
    };
    emojiGrid.querySelectorAll(".drawer-emoji-item").forEach(btn => {
      btn.onclick = () => {
        drawerSelectedEmoji = btn.getAttribute("data-emoji");
        document.getElementById("drawer-emoji-preview").textContent = drawerSelectedEmoji;
        emojiGrid.style.display = "none";
      };
    });
  }

  // Routine stepper
  const btnFreqDown = document.getElementById("btn-routine-freq-down");
  const btnFreqUp = document.getElementById("btn-routine-freq-up");
  const freqNum = document.getElementById("drawer-routine-freq-num");
  if (btnFreqDown && btnFreqUp && freqNum) {
    btnFreqDown.onclick = () => {
      drawerRoutineFreq = Math.max(1, drawerRoutineFreq - 1);
      freqNum.textContent = drawerRoutineFreq;
    };
    btnFreqUp.onclick = () => {
      drawerRoutineFreq = Math.min(14, drawerRoutineFreq + 1);
      freqNum.textContent = drawerRoutineFreq;
    };
  }

  // Routine unit segments (Day, Week)
  ["day", "week"].forEach(unit => {
    const btn = document.getElementById(`btn-routine-unit-${unit}`);
    if (btn) {
      btn.onclick = () => {
        drawerRoutineFreqUnit = unit;
        ["day", "week"].forEach(u => {
          const b = document.getElementById(`btn-routine-unit-${u}`);
          if (b) b.classList.toggle("active", u === unit);
        });
      };
    }
  });

  // Routine slot segments (Morning, Afternoon, Evening)
  ["morning", "afternoon", "evening"].forEach(slot => {
    const btn = document.getElementById(`btn-routine-slot-${slot}`);
    if (btn) {
      btn.onclick = () => {
        drawerRoutineSlot = slot;
        ["morning", "afternoon", "evening"].forEach(s => {
          const b = document.getElementById(`btn-routine-slot-${s}`);
          if (b) b.classList.toggle("active", s === slot);
        });
      };
    }
  });

  // Reward points stepper (1 to 10 points)
  const btnMinus = document.getElementById("btn-drawer-reward-minus");
  const btnPlus = document.getElementById("btn-drawer-reward-plus");
  if (btnMinus && btnPlus) {
    btnMinus.onclick = () => {
      drawerRewardValue = Math.max(1, drawerRewardValue - 1);
      syncDrawerRewardUI();
    };
    btnPlus.onclick = () => {
      drawerRewardValue = Math.min(10, drawerRewardValue + 1);
      syncDrawerRewardUI();
    };
  }

  // Date picker trigger on Date row
  const choreDateLabel = document.getElementById("drawer-chore-date-label");
  if (choreDateLabel) {
    choreDateLabel.style.cursor = "pointer";
    choreDateLabel.onclick = () => { openSkylightDatePickerModal(); };
  }

  // Form submit
  const form = document.getElementById("skylight-task-drawer-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById("drawer-task-id").value;
      const title = document.getElementById("drawer-task-title").value.trim();
      if (!title) return;

      const isRoutine = (drawerCurrentType === "routine");
      const dName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][drawerSelectedDate.getDay()];
      const dStr = getLocalDateKey(drawerSelectedDate);

      let effectiveAssigned = null;
      if (drawerSelectedProfiles.length === 1 && drawerSelectedProfiles[0] === "Up for grabs") {
        effectiveAssigned = null;
      } else if (drawerSelectedProfiles.length === 1) {
        effectiveAssigned = drawerSelectedProfiles[0];
      } else if (drawerSelectedProfiles.length > 1) {
        effectiveAssigned = drawerSelectedProfiles; // Array of member names
      }

      const taskData = {
        title,
        icon: drawerSelectedEmoji,
        assignedTo: effectiveAssigned,
        taskType: isRoutine ? "Daily Task" : "Standard",
        day: isRoutine ? "Daily" : dName,
        date: isRoutine ? null : dStr,
        repeat: isRoutine ? "daily" : "none",
        routineSlot: isRoutine ? drawerRoutineSlot : null,
        value: drawerRewardValue,
        order: isRoutine ? (drawerRoutineSlot === 'morning' ? 1 : (drawerRoutineSlot === 'afternoon' ? 2 : 4)) : 3
      };

      if (id) {
        // Edit existing
        const idx = currentTasks.findIndex(t => t.id === id);
        if (idx !== -1) {
          currentTasks[idx] = { ...currentTasks[idx], ...taskData };
          saveLocalCache(currentTasks);
          if (db) {
            try {
              const docRef = getTaskDocRef(id);
              await updateDoc(docRef, taskData);
            } catch (err) {}
          }
        }
      } else {
        // Create new
        const newId = `task-${Date.now()}`;
        const newTask = {
          id: newId,
          ...taskData,
          done: false,
          completedBy: null,
          completedAt: null
        };
        currentTasks.push(newTask);
        saveLocalCache(currentTasks);
        if (db) {
          try {
            const docRef = getTaskDocRef(newId);
            await setDoc(docRef, newTask);
          } catch (err) {}
        }
      }

      document.getElementById("skylight-task-drawer-overlay").style.display = "none";
      if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
      renderSkylightTasksPage();
    };
  }

  // Tasks Day Navigation
  const btnTasksPrev = document.getElementById("btn-tasks-prev-day");
  const btnTasksToday = document.getElementById("btn-tasks-today");
  const btnTasksNext = document.getElementById("btn-tasks-next-day");
  if (btnTasksPrev) {
    btnTasksPrev.onclick = () => {
      tasksSelectedDate.setDate(tasksSelectedDate.getDate() - 1);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }
  if (btnTasksToday) {
    btnTasksToday.onclick = () => {
      tasksSelectedDate = new Date();
      tasksSelectedDate.setHours(0, 0, 0, 0);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }
  if (btnTasksNext) {
    btnTasksNext.onclick = () => {
      tasksSelectedDate.setDate(tasksSelectedDate.getDate() + 1);
      renderSkylightTasksPage();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    };
  }

  // Tasks Filter Dropdown
  const btnTasksFilter = document.getElementById("btn-tasks-filter-dropdown");
  const tasksFilterMenu = document.getElementById("tasks-filter-dropdown-menu");
  if (btnTasksFilter && tasksFilterMenu) {
    btnTasksFilter.onclick = (e) => {
      e.stopPropagation();
      const isOpen = tasksFilterMenu.style.display === "block";
      tasksFilterMenu.style.display = isOpen ? "none" : "block";
      btnTasksFilter.setAttribute("aria-expanded", isOpen ? "false" : "true");
      btnTasksFilter.classList.toggle("is-open", !isOpen);
      if (!isOpen) {
        renderTasksFilterMenu();
        if (typeof alignDropdownOnScreen === "function") {
          alignDropdownOnScreen(tasksFilterMenu, btnTasksFilter);
        }
      }
    };
  }

  // Floating + FAB on Tasks page -> opens drawer
  const btnTasksFab = document.getElementById("btn-floating-add-task");
  if (btnTasksFab) {
    btnTasksFab.onclick = () => {
      openSkylightTaskDrawer();
    };
  }

  // Swipe navigation on Tasks Board (smooth touch gesture)
  const tasksGrid = document.getElementById("tasks-columns-grid");
  if (tasksGrid && !tasksGrid.hasAttribute("data-gestures-wired")) {
    tasksGrid.setAttribute("data-gestures-wired", "true");
    let tStartX = 0;
    let tStartY = 0;
    let tDiffX = 0;
    let isTracking = false;

    tasksGrid.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest("button, .skylight-task-card, .routine-filter-circle-btn")) return;
      tStartX = e.touches[0].clientX;
      tStartY = e.touches[0].clientY;
      tDiffX = 0;
      isTracking = true;
    }, { passive: true });

    tasksGrid.addEventListener("touchmove", (e) => {
      if (!isTracking || e.touches.length !== 1) return;
      tDiffX = e.touches[0].clientX - tStartX;
    }, { passive: true });

    tasksGrid.addEventListener("touchend", () => {
      if (!isTracking) return;
      isTracking = false;
      if (Math.abs(tDiffX) > 60) {
        if (tDiffX < 0) {
          // Swiped left -> next day
          tasksSelectedDate.setDate(tasksSelectedDate.getDate() + 1);
        } else {
          // Swiped right -> previous day
          tasksSelectedDate.setDate(tasksSelectedDate.getDate() - 1);
        }
        renderSkylightTasksPage();
        if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      }
    });
  }
}

function renderTasksFilterMenu() {
  const menu = document.getElementById("tasks-filter-dropdown-menu");
  if (!menu) return;

  const profiles = [...(familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]), "Up for grabs"];
  const isAllActive = (tasksActiveMemberFilter === null || tasksActiveMemberFilter.length === profiles.length);

  let html = `
    <div class="skylight-filter-list">
      <!-- Select All Row -->
      <div class="skylight-filter-row ${isAllActive ? 'is-active' : ''}" data-task-filter="ALL" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-icon-select-all" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span class="skylight-filter-member-name">Select All</span>
        </div>
        <div class="skylight-filter-member-right">
          <div class="skylight-filter-toggle ${isAllActive ? 'is-on' : ''}" aria-label="Select All Toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
  `;

  profiles.forEach(p => {
    const isGrab = p === "Up for grabs";
    const pal = isGrab ? { primary: "#ef4444", name: "Up for grabs" } : getMemberPalette(p);
    const isMemberActive = isAllActive || (tasksActiveMemberFilter && tasksActiveMemberFilter.includes(p));

    html += `
      <div class="skylight-filter-row ${isMemberActive ? 'is-active' : ''}" data-task-filter="${escapeHtml(p)}" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-color-dot" style="background: ${pal.primary};" title="${escapeHtml(pal.name)}"></span>
          <span class="skylight-filter-member-name">${escapeHtml(p)}</span>
        </div>
        <div class="skylight-filter-member-right">
          <div class="skylight-filter-toggle ${isMemberActive ? 'is-on' : ''}" aria-label="${escapeHtml(p)} toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    </div>
  `;

  menu.innerHTML = html;

  // Click handler on menu rows
  menu.querySelectorAll(".skylight-filter-row").forEach(row => {
    row.onclick = (e) => {
      e.stopPropagation();
      const filterKey = row.getAttribute("data-task-filter");
      if (filterKey === "ALL") {
        const nextChecked = !isAllActive;
        tasksActiveMemberFilter = nextChecked ? null : [];
      } else {
        const currentList = (tasksActiveMemberFilter === null) ? [...profiles] : [...tasksActiveMemberFilter];
        const idx = currentList.indexOf(filterKey);
        if (idx !== -1) {
          currentList.splice(idx, 1);
        } else {
          currentList.push(filterKey);
        }
        tasksActiveMemberFilter = (currentList.length === profiles.length) ? null : currentList;
      }
      renderTasksFilterMenu();
      renderSkylightTasksPage();
    };
  });
}


// ============================================================================
// 18. SKYLIGHT MINI CALENDAR DATE PICKER MODAL
// ============================================================================
let pickerCurrentMonth = new Date();

function openSkylightDatePickerModal() {
  const modal = document.getElementById("skylight-datepicker-modal");
  if (!modal) return;
  pickerCurrentMonth = new Date(drawerSelectedDate);
  renderDatePickerCalendar();
  modal.style.display = "flex";

  document.getElementById("btn-datepicker-dismiss").onclick = () => { modal.style.display = "none"; };
  document.getElementById("btn-datepicker-select").onclick = () => {
    document.getElementById("drawer-chore-date-label").textContent = drawerSelectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    modal.style.display = "none";
  };
}

function renderDatePickerCalendar() {
  const yr = pickerCurrentMonth.getFullYear();
  const mo = pickerCurrentMonth.getMonth();
  const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("datepicker-month-name").textContent = `${mNames[mo]} ${yr}`;
  document.getElementById("datepicker-selected-label").textContent = drawerSelectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  const firstDay = new Date(yr, mo, 1).getDay(); // 0 is Sun
  const lastDate = new Date(yr, mo + 1, 0).getDate();
  const grid = document.getElementById("datepicker-days-grid");
  if (!grid) return;

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += `<span class="datepicker-day-cell is-other-month"></span>`;
  }
  for (let d = 1; d <= lastDate; d++) {
    const isSel = (drawerSelectedDate.getFullYear() === yr && drawerSelectedDate.getMonth() === mo && drawerSelectedDate.getDate() === d);
    html += `<button type="button" class="datepicker-day-cell ${isSel ? 'is-selected' : ''}" data-day="${d}">${d}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".datepicker-day-cell[data-day]").forEach(btn => {
    btn.onclick = () => {
      const d = parseInt(btn.getAttribute("data-day"), 10);
      drawerSelectedDate = new Date(yr, mo, d);
      drawerSelectedDate.setHours(0, 0, 0, 0);
      renderDatePickerCalendar();
    };
  });

  document.getElementById("btn-datepicker-prev").onclick = () => {
    pickerCurrentMonth.setMonth(pickerCurrentMonth.getMonth() - 1);
    renderDatePickerCalendar();
  };
  document.getElementById("btn-datepicker-next").onclick = () => {
    pickerCurrentMonth.setMonth(pickerCurrentMonth.getMonth() + 1);
    renderDatePickerCalendar();
  };
}


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
    renderWeekCalendar();
    renderFamilyStickyNote();
    window.scrollTo({ top: 0, behavior: "instant" });
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
  }
}
window.switchSkylightView = switchSkylightView;

// ============================================================================
// ============================================================================
// REAL-TIME LOCAL WEATHER PROVIDER & 5-DAY FORECAST MODAL (Open-Meteo)
// ============================================================================

const weatherMap = {
  0: { icon: "☀️", text: "Clear Sky" },
  1: { icon: "🌤️", text: "Mainly Clear" },
  2: { icon: "⛅", text: "Partly Cloudy" },
  3: { icon: "☁️", text: "Overcast" },
  45: { icon: "🌫️", text: "Foggy" },
  48: { icon: "🌫️", text: "Depositing Rime Fog" },
  51: { icon: "🌦️", text: "Light Drizzle" },
  53: { icon: "🌦️", text: "Drizzle" },
  55: { icon: "🌧️", text: "Heavy Drizzle" },
  56: { icon: "🌨️", text: "Freezing Drizzle" },
  57: { icon: "🌨️", text: "Dense Freezing Drizzle" },
  61: { icon: "🌧️", text: "Slight Rain" },
  63: { icon: "🌧️", text: "Rain" },
  65: { icon: "🌧️", text: "Heavy Rain" },
  66: { icon: "🌨️", text: "Freezing Rain" },
  67: { icon: "🌨️", text: "Heavy Freezing Rain" },
  71: { icon: "🌨️", text: "Light Snow" },
  73: { icon: "🌨️", text: "Snow" },
  75: { icon: "❄️", text: "Heavy Snow" },
  77: { icon: "❄️", text: "Snow Grains" },
  80: { icon: "🌧️", text: "Slight Showers" },
  81: { icon: "🌧️", text: "Showers" },
  82: { icon: "⛈️", text: "Violent Showers" },
  85: { icon: "🌨️", text: "Snow Showers" },
  86: { icon: "❄️", text: "Heavy Snow Showers" },
  95: { icon: "⛈️", text: "Thunderstorm" },
  96: { icon: "⛈️", text: "Thunderstorm with Hail" },
  99: { icon: "⛈️", text: "Severe Thunderstorm" }
};

async function initLocalWeather() {
  const badge = document.getElementById("calendar-weather-badge");
  const mealsWeatherEl = document.getElementById("meals-header-time-weather");

  const applyWeather = (temp, code, isDay, city) => {
    const info = weatherMap[code] || { icon: isDay ? "🌤️" : "☁️", text: "Cloudy" };
    let icon = info.icon;
    if (code === 0 && !isDay) icon = "🌙";
    const rounded = Math.round(temp);
    if (badge) {
      badge.innerHTML = `${icon} ${rounded}°`;
      badge.title = `${info.text} • ${city ? city + ' • ' : ''}${rounded}°C. Click for 5-Day Forecast.`;
    }
    if (mealsWeatherEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      mealsWeatherEl.textContent = `${timeStr} • ${icon} ${rounded}°`;
      mealsWeatherEl.title = `Click for 5-Day Forecast`;
    }
  };

  // 1. Instant cache restore (avoids 18° placeholder)
  try {
    const cached = localStorage.getItem("turnbull_weather_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
        applyWeather(parsed.temp, parsed.code, parsed.isDay, parsed.city);
      }
    }
    const cachedForecast = localStorage.getItem("turnbull_weather_forecast");
    if (cachedForecast) {
      localWeatherForecast = JSON.parse(cachedForecast);
    }
  } catch (e) {}

  // 2. Open-Meteo Weather Fetcher with 5-Day Daily Forecast
  async function fetchWeatherForCoords(lat, lon, city = "") {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.current_weather) {
        const cw = data.current_weather;
        applyWeather(cw.temperature, cw.weathercode, cw.is_day, city);
        localWeatherForecast = {
          city: city || (isDefaultTurnbullBoard ? "Belfast, UK" : "Local Area"),
          current: cw,
          daily: data.daily || null,
          timestamp: Date.now()
        };
        localStorage.setItem("turnbull_weather_cache", JSON.stringify({
          temp: cw.temperature,
          code: cw.weathercode,
          isDay: cw.is_day,
          city,
          timestamp: Date.now()
        }));
        localStorage.setItem("turnbull_weather_forecast", JSON.stringify(localWeatherForecast));

        // Re-render week calendar if currently in week view so live day weather icons appear
        if (currentCalendarView === "week" && typeof renderWeekCalendar === "function") {
          renderWeekCalendar();
        }
      }
    } catch (err) {
      console.warn("Weather API fetch error:", err);
    }
  }

  // 3. IP Geolocation Fallback
  async function fetchIpLocation() {
    try {
      const res = await fetch("https://ipwho.is/");
      if (!res.ok) throw new Error("ipwho failed");
      const data = await res.json();
      if (data && data.success && data.latitude && data.longitude) {
        await fetchWeatherForCoords(data.latitude, data.longitude, data.city || data.region || "Local Area");
        return;
      }
    } catch (e) {}

    // Fallback UK coordinates (Belfast / Northern Ireland)
    await fetchWeatherForCoords(54.5968, -5.9254, "Belfast, UK");
  }

  const triggerDetection = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude, "Local Area"),
        () => fetchIpLocation(),
        { timeout: 5000, maximumAge: 600000 }
      );
    } else {
      fetchIpLocation();
    }
  };

  if (badge) {
    badge.onclick = (e) => {
      e.stopPropagation();
      openWeatherForecastModal();
    };
  }
  if (mealsWeatherEl) {
    mealsWeatherEl.style.cursor = "pointer";
    mealsWeatherEl.onclick = (e) => {
      e.stopPropagation();
      openWeatherForecastModal();
    };
  }

  triggerDetection();
}
window.initLocalWeather = initLocalWeather;

function getForecastForDate(dateOrDateStr) {
  if (!localWeatherForecast) {
    try {
      const cached = localStorage.getItem("turnbull_weather_forecast");
      if (cached) localWeatherForecast = JSON.parse(cached);
    } catch (e) {}
  }
  const wf = localWeatherForecast;
  if (!wf || !wf.daily || !Array.isArray(wf.daily.time)) return null;

  const targetKey = typeof dateOrDateStr === "string" ? dateOrDateStr : getLocalDateKey(dateOrDateStr);
  const idx = wf.daily.time.indexOf(targetKey);
  if (idx === -1) return null;

  const code = wf.daily.weathercode ? wf.daily.weathercode[idx] : 0;
  const info = weatherMap[code] || { icon: "🌤️", text: "Partly Cloudy" };
  const max = (wf.daily.temperature_2m_max && wf.daily.temperature_2m_max[idx] !== undefined)
    ? Math.round(wf.daily.temperature_2m_max[idx]) : null;
  const min = (wf.daily.temperature_2m_min && wf.daily.temperature_2m_min[idx] !== undefined)
    ? Math.round(wf.daily.temperature_2m_min[idx]) : null;
  const rain = (wf.daily.precipitation_probability_max && wf.daily.precipitation_probability_max[idx] !== undefined)
    ? wf.daily.precipitation_probability_max[idx] : 0;

  return {
    icon: info.icon,
    condition: info.text,
    maxTemp: max,
    minTemp: min,
    rainProb: rain
  };
}
window.getForecastForDate = getForecastForDate;

function openWeatherForecastModal() {
  const modal = document.getElementById("weather-forecast-modal");
  if (!modal) return;

  const locEl = document.getElementById("weather-modal-location");
  const heroIcon = document.getElementById("weather-modal-hero-icon");
  const heroTemp = document.getElementById("weather-hero-temp");
  const heroCond = document.getElementById("weather-hero-condition");
  const heroRange = document.getElementById("weather-hero-range");
  const heroRain = document.getElementById("weather-hero-rain");
  const heroUpdated = document.getElementById("weather-hero-updated");
  const listEl = document.getElementById("weather-forecast-list");

  if (!localWeatherForecast) {
    try {
      const cached = localStorage.getItem("turnbull_weather_forecast");
      if (cached) localWeatherForecast = JSON.parse(cached);
    } catch (e) {}
  }

  const wf = localWeatherForecast;
  const defaultCity = isDefaultTurnbullBoard ? "Belfast, UK" : "Local Area";
  if (locEl) locEl.textContent = `📍 ${wf && wf.city ? wf.city : defaultCity}`;

  if (wf && wf.current) {
    const code = wf.current.weathercode;
    const info = weatherMap[code] || { icon: "🌤️", text: "Partly Cloudy" };
    if (heroIcon) heroIcon.textContent = info.icon;
    if (heroTemp) heroTemp.textContent = `${Math.round(wf.current.temperature)}°`;
    if (heroCond) heroCond.textContent = info.text;
  }

  if (heroUpdated && wf && wf.timestamp) {
    const minsAgo = Math.max(0, Math.round((Date.now() - wf.timestamp) / 60000));
    heroUpdated.textContent = minsAgo === 0 ? "Updated Just Now" : `Updated ${minsAgo}m ago`;
  }

  if (wf && wf.daily && Array.isArray(wf.daily.time) && wf.daily.time.length > 0) {
    const todayMax = Math.round(wf.daily.temperature_2m_max[0]);
    const todayMin = Math.round(wf.daily.temperature_2m_min[0]);
    const todayRain = wf.daily.precipitation_probability_max ? wf.daily.precipitation_probability_max[0] : 0;
    if (heroRange) heroRange.textContent = `High: ${todayMax}° • Low: ${todayMin}°`;
    if (heroRain) heroRain.textContent = `💧 ${todayRain || 0}% Rain`;

    if (listEl) {
      listEl.innerHTML = "";
      const daysCount = Math.min(5, wf.daily.time.length);
      for (let i = 0; i < daysCount; i++) {
        const dateStr = wf.daily.time[i];
        const dObj = new Date(dateStr + "T12:00:00");
        const dayLabel = i === 0 ? "Today" : dObj.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
        const code = wf.daily.weathercode[i];
        const info = weatherMap[code] || { icon: "🌤️", text: "Mainly Clear" };
        const max = Math.round(wf.daily.temperature_2m_max[i]);
        const min = Math.round(wf.daily.temperature_2m_min[i]);
        const rainProb = wf.daily.precipitation_probability_max ? wf.daily.precipitation_probability_max[i] : 0;

        const row = document.createElement("div");
        row.className = "weather-day-row";
        row.innerHTML = `
          <div class="weather-day-name">${dayLabel}</div>
          <div class="weather-day-condition-wrap">
            <span class="weather-day-icon">${info.icon}</span>
            <span class="weather-day-desc">${info.text}</span>
          </div>
          <div class="weather-day-metrics">
            <span class="weather-day-rain">💧 ${rainProb}%</span>
            <div class="weather-day-temp-bar">
              <span class="weather-temp-min">${min}°</span>
              <span>/</span>
              <span class="weather-temp-max">${max}°</span>
            </div>
          </div>
        `;
        listEl.appendChild(row);
      }
    }
  } else {
    if (listEl) {
      listEl.innerHTML = `<div class="weather-day-row" style="justify-content: center; color: var(--text-secondary); padding: 14px;">Fetching 5-day forecast, tap refresh below...</div>`;
    }
  }

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  const btnClose = document.getElementById("btn-close-weather-modal");
  const btnDone = document.getElementById("btn-done-weather");
  const btnRefresh = document.getElementById("btn-refresh-weather");
  if (btnClose) btnClose.onclick = closeModal;
  if (btnDone) btnDone.onclick = closeModal;
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.innerHTML = "<span>🔄 Refreshing...</span>";
      if (typeof initLocalWeather === "function") await initLocalWeather();
      btnRefresh.innerHTML = "<span>🔄 Refresh Weather</span>";
      openWeatherForecastModal();
      if (typeof showCalendarToast === "function") showCalendarToast("☀️ Weather forecast refreshed!");
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
}
window.openWeatherForecastModal = openWeatherForecastModal;

function toggleSleepTheme() {
  let activeTheme = localStorage.getItem("chore_theme") || "light";
  activeTheme = activeTheme === "dark" ? "light" : "dark";
  localStorage.setItem("chore_theme", activeTheme);
  applyTheme(activeTheme);
  if (typeof sfx !== "undefined" && sfx && sfx.playUndoPop) sfx.playUndoPop();

  const sleepIcon = document.getElementById("sidebar-sleep-icon");
  if (sleepIcon) {
    sleepIcon.innerHTML = activeTheme === "dark"
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}
window.toggleSleepTheme = toggleSleepTheme;

// ============================================================================
// SCHEDULED SLEEP WINDOW & AMBIENT NIGHT CLOCK (Lights-Out Overnight)
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
      weatherEl.textContent = "🌙 Clear Sky";
    }
  }

  const endStr = boardSettings.sleepEndTime || "07:00";
  if (wakeTextEl) {
    wakeTextEl.textContent = isPreview
      ? `Preview Mode • Night Clock Wakes at ${endStr}`
      : `Night Clock Active • Wakes at ${endStr}`;
  }

  overlay.style.display = "flex";
  isSleepScreenActive = true;

  // Single tap on the overlay wakes the screen for 60 seconds
  overlay.onclick = (e) => {
    if (e.target && e.target.id === "btn-sleep-manual-wake") return;
    deactivateAmbientSleepScreen();
    sleepScreenTemporaryWakeUntil = Date.now() + 60000;
    if (typeof showCalendarToast === "function") {
      showCalendarToast("☀️ Display awakened for 60 seconds");
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
  if (boardSettings.sleepScheduleEnabled === false) {
    if (isSleepScreenActive) deactivateAmbientSleepScreen();
    return;
  }
  if (Date.now() < sleepScreenTemporaryWakeUntil) {
    return;
  }

  const now = new Date();
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
  const startHHMM = boardSettings.sleepStartTime || "22:00";
  const endHHMM = boardSettings.sleepEndTime || "07:00";

  let isBedtime = false;
  if (startHHMM > endHHMM) {
    // Overnight window, e.g. 22:00 to 07:00
    isBedtime = (currentHHMM >= startHHMM || currentHHMM < endHHMM);
  } else {
    // Same day window, e.g. 13:00 to 15:00
    isBedtime = (currentHHMM >= startHHMM && currentHHMM < endHHMM);
  }

  if (isBedtime && !isSleepScreenActive) {
    activateAmbientSleepScreen(false);
  } else if (!isBedtime && isSleepScreenActive) {
    deactivateAmbientSleepScreen();
    if (typeof showCalendarToast === "function") {
      showCalendarToast("☀️ Good morning! Family board is awake.");
    }
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
    btnCalendarAddTask.addEventListener("click", () => openCreateTaskModal());
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
      const weekDaysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const currentWeekDay = weekDaysList[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || "Tuesday";
      openCreateTaskModal(currentWeekDay);
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
      const eventCard = e.target.closest(".skylight-card[data-event-id], .calendar-event-card");
      if (eventCard) {
        e.stopPropagation();
        const eventId = eventCard.getAttribute("data-event-id");
        const evt = (familyEvents || []).find(x => x.id === eventId);
        if (evt) openEventModal(evt);
        return;
      }

      // 5. Chore task card click
      const choreCard = e.target.closest(".skylight-card[data-task-id], .calendar-card");
      if (choreCard) {
        const taskId = choreCard.getAttribute("data-task-id");
        const targetDay = choreCard.getAttribute("data-day");
        const targetDate = choreCard.getAttribute("data-date");
        openEditTaskModal(taskId, targetDay, targetDate);
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

// ============================================================================
// 14. CALENDAR VIEW (Skylight 7-Day Timeline Grid & Family Events)
// ============================================================================
const EVENT_EMOJI_LIST = [
  // Education & Learning
  "📚", "💼", "🎓", "🔬", "📝", "💻", "🧠", "🎨",
  // Lessons & Activities
  "🚗", "🎹", "🎸", "🎤", "🥋", "🏊", "💃", "⚽",
  // Sports & Recreation
  "🏀", "🎾", "🚲", "🏃", "🏋️", "🏐", "🎯", "🧗",
  // Family & Social
  "👨‍👩‍👧‍👦", "🎂", "🍽️", "☕", "🍕", "🎬", "🍿", "🎉",
  // Appointments & Health
  "🏥", "🩺", "🦷", "💇", "🐕", "🐱", "🛒", "✈️",
  // General & Priorities
  "📅", "⏰", "⭐", "✨", "🔔", "📌", "🏆", "🌟"
];

function detectEmojiForTitle(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("business") || t.includes("finance") || t.includes("econ")) return "💼";
  if (t.includes("math") || t.includes("algebra") || t.includes("calc")) return "📚";
  if (t.includes("english") || t.includes("read") || t.includes("essay") || t.includes("tutor") || t.includes("study") || t.includes("school") || t.includes("biology") || t.includes("chemistry") || t.includes("physics") || t.includes("science")) return "📚";
  if (t.includes("driv") || t.includes("car")) return "🚗";
  if (t.includes("music") || t.includes("piano") || t.includes("keyboard")) return "🎹";
  if (t.includes("guitar")) return "🎸";
  if (t.includes("sing") || t.includes("choir")) return "🎤";
  if (t.includes("swim")) return "🏊";
  if (t.includes("football") || t.includes("soccer")) return "⚽";
  if (t.includes("basket")) return "🏀";
  if (t.includes("tennis")) return "🎾";
  if (t.includes("karate") || t.includes("judo") || t.includes("martial") || t.includes("taekwondo")) return "🥋";
  if (t.includes("gym") || t.includes("fit") || t.includes("workout")) return "🏋️";
  if (t.includes("dance") || t.includes("ballet")) return "💃";
  if (t.includes("bike") || t.includes("cycl")) return "🚲";
  if (t.includes("run") || t.includes("track")) return "🏃";
  if (t.includes("art") || t.includes("draw") || t.includes("paint")) return "🎨";
  if (t.includes("code") || t.includes("comput") || t.includes("tech") || t.includes("programm")) return "💻";
  if (t.includes("doctor") || t.includes("gp") || t.includes("hospital") || t.includes("clinic")) return "🏥";
  if (t.includes("dentist") || t.includes("teeth") || t.includes("ortho")) return "🦷";
  if (t.includes("hair") || t.includes("barber")) return "💇";
  if (t.includes("family") || t.includes("cousin") || t.includes("grand") || t.includes("roast")) return "👨‍👩‍👧‍👦";
  if (t.includes("birth") || t.includes("party")) return "🎂";
  if (t.includes("dinner") || t.includes("lunch") || t.includes("restaur") || t.includes("meal")) return "🍽️";
  if (t.includes("cinema") || t.includes("movie") || t.includes("film")) return "🎬";
  if (t.includes("shop") || t.includes("grocer")) return "🛒";
  if (t.includes("dog") || t.includes("cat") || t.includes("vet")) return "🐕";
  if (t.includes("trip") || t.includes("flight") || t.includes("holiday") || t.includes("airport")) return "✈️";
  return null;
}

function openEventModal(evt = null, defaultDay = null, defaultDate = null) {
  const modal = document.getElementById("event-modal");
  const form = document.getElementById("form-event");
  const modalTitle = document.getElementById("event-modal-title");
  const idInput = document.getElementById("event-id-input");
  const titleInput = document.getElementById("event-title-input");
  const dateInput = document.getElementById("event-date-input");
  const daySelect = document.getElementById("event-day-select");
  const selectedDayBadge = document.getElementById("event-selected-day-badge");
  const timeInput = document.getElementById("event-time-input");
  const timeDisplayText = document.getElementById("time-display-text");
  const time12hHint = document.getElementById("time-12h-hint");
  const durationSelect = document.getElementById("event-duration-select");
  const repeatSelect = document.getElementById("event-repeat-select");
  const repeatOptWeekly = document.getElementById("repeat-opt-weekly");
  const repeatOptMonthly = document.getElementById("repeat-opt-monthly");
  const repeatOptAnnually = document.getElementById("repeat-opt-annually");
  const memberInput = document.getElementById("event-member-input");
  const descInput = document.getElementById("event-description-input");
  const locationInput = document.getElementById("event-location-input");
  const iconInput = document.getElementById("event-icon-input");
  const categoryInput = document.getElementById("event-category-input");
  const btnDelete = document.getElementById("btn-delete-event");
  const emojiDisplay = document.getElementById("event-emoji-display");
  const modalTrophy = document.getElementById("event-modal-trophy");
  const btnEmojiPicker = document.getElementById("btn-event-emoji-picker");
  const emojiPalette = document.getElementById("event-emoji-palette");
  const btnClosePalette = document.getElementById("btn-close-emoji-palette");
  const emojiPaletteGrid = document.getElementById("emoji-palette-grid");

  if (!modal) return;

  const weekDaysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  let currentHour = "16";
  let currentMinute = "30";
  let currentDay = "Tuesday";
  let currentDateKey = getLocalDateKey(new Date());

  // 1. Event Date & Day Helper
  const setDate = (target) => {
    let dObj;
    if (target instanceof Date) {
      dObj = new Date(target);
    } else if (typeof target === "string" && /^\d{4}-\d{2}-\d{2}$/.test(target)) {
      const [y, m, d] = target.split("-").map(Number);
      dObj = new Date(y, m - 1, d);
    } else {
      dObj = new Date();
    }
    if (isNaN(dObj.getTime())) dObj = new Date();
    dObj.setHours(0, 0, 0, 0);

    currentDateKey = getLocalDateKey(dObj);
    const dayOfWeekIdx = dObj.getDay() === 0 ? 6 : dObj.getDay() - 1;
    const dayName = weekDaysList[dayOfWeekIdx] || "Tuesday";
    currentDay = dayName;

    if (dateInput) dateInput.value = currentDateKey;
    if (daySelect) daySelect.value = dayName;

    // Format badge: e.g. "Tuesday, 15 Dec 2026"
    const formattedBadge = dObj.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    if (selectedDayBadge) selectedDayBadge.textContent = formattedBadge;

    if (repeatOptWeekly) repeatOptWeekly.textContent = `Weekly on ${dayName}`;
    if (repeatOptMonthly) repeatOptMonthly.textContent = `Monthly on the ${getOrdinal(dObj.getDate())}`;
    if (repeatOptAnnually) {
      const monthDayStr = dObj.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      repeatOptAnnually.textContent = `Annually on ${monthDayStr}`;
    }
  };

  // Wire Date Input change
  if (dateInput) {
    dateInput.onchange = (e) => {
      if (e.target.value) setDate(e.target.value);
    };
  }

  // Wire Quick Date Pills
  document.querySelectorAll(".quick-date-pill").forEach(pill => {
    pill.onclick = (e) => {
      e.preventDefault();
      const offset = pill.getAttribute("data-offset");
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (offset === "0") {
        setDate(d);
      } else if (offset === "1") {
        d.setDate(d.getDate() + 1);
        setDate(d);
      } else if (offset === "weekend") {
        const curDay = d.getDay(); // 0 is Sun, 6 is Sat
        const daysUntilSat = (6 - curDay + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilSat);
        setDate(d);
      } else if (offset === "7") {
        d.setDate(d.getDate() + 7);
        setDate(d);
      } else if (offset === "30") {
        d.setMonth(d.getMonth() + 1);
        setDate(d);
      }
    };
  });

  // Determine initial date
  let initialDateToSet = null;
  if (evt) {
    if (evt.date) {
      initialDateToSet = evt.date;
    } else if (evt.day) {
      const today = new Date();
      const curIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const targetIdx = weekDaysList.indexOf(evt.day);
      const diff = targetIdx >= 0 ? (targetIdx - curIdx) : 0;
      const d = new Date(today);
      d.setDate(d.getDate() + diff);
      initialDateToSet = getLocalDateKey(d);
    }
  } else if (defaultDate) {
    initialDateToSet = defaultDate;
  } else if (calendarAnchorDate && (currentCalendarView === "day" || currentCalendarView === "schedule")) {
    initialDateToSet = getLocalDateKey(calendarAnchorDate);
  } else if (defaultDay) {
    const today = new Date();
    const curIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const targetIdx = weekDaysList.indexOf(defaultDay);
    const diff = targetIdx >= 0 ? (targetIdx - curIdx) : 0;
    const d = new Date(today);
    d.setDate(d.getDate() + diff);
    initialDateToSet = getLocalDateKey(d);
  } else {
    initialDateToSet = getLocalDateKey(new Date());
  }

  setDate(initialDateToSet);

  // 2. 24h Time Carousel Helper
  const parseTimeString = (str) => {
    if (!str || str.toLowerCase() === "all day") {
      return { hour: "09", minute: "00" };
    }
    const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return { hour: "16", minute: "30" };
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toLowerCase() : null;

    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;

    const validMins = [0, 15, 30, 45];
    const nearestMin = validMins.reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev);

    return {
      hour: String(Math.min(23, Math.max(0, h))).padStart(2, "0"),
      minute: String(nearestMin).padStart(2, "0")
    };
  };

  const setTime = (hourStr, minStr) => {
    currentHour = String(hourStr).padStart(2, "0");
    currentMinute = String(minStr).padStart(2, "0");
    const time24 = `${currentHour}:${currentMinute}`;

    const hNum = parseInt(currentHour, 10);
    const ampm = hNum >= 12 ? "PM" : "AM";
    const h12 = hNum % 12 || 12;
    const display12 = `${h12}:${currentMinute} ${ampm}`;

    if (timeDisplayText) timeDisplayText.textContent = time24;
    if (time12hHint) time12hHint.textContent = `(${display12})`;
    if (timeInput) timeInput.value = time24;

    document.querySelectorAll(".hour-chip").forEach(chip => {
      const h = chip.getAttribute("data-hour");
      if (h === currentHour) {
        chip.classList.add("is-selected");
        chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        chip.classList.remove("is-selected");
      }
    });

    document.querySelectorAll(".minute-chip").forEach(chip => {
      const m = chip.getAttribute("data-minute");
      if (m === currentMinute) {
        chip.classList.add("is-selected");
      } else {
        chip.classList.remove("is-selected");
      }
    });
  };

  // Wire Hour Chips
  document.querySelectorAll(".hour-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const h = chip.getAttribute("data-hour");
      if (h) setTime(h, currentMinute);
    };
  });

  // Wire Minute Chips
  document.querySelectorAll(".minute-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const m = chip.getAttribute("data-minute");
      if (m) setTime(currentHour, m);
    };
  });

  // Wire Hour Prev/Next Carousel Arrows
  const btnHourPrev = document.getElementById("btn-hour-prev");
  const btnHourNext = document.getElementById("btn-hour-next");
  if (btnHourPrev) {
    btnHourPrev.onclick = (e) => {
      e.preventDefault();
      let h = parseInt(currentHour, 10) - 1;
      if (h < 0) h = 23;
      setTime(String(h).padStart(2, "0"), currentMinute);
    };
  }
  if (btnHourNext) {
    btnHourNext.onclick = (e) => {
      e.preventDefault();
      let h = parseInt(currentHour, 10) + 1;
      if (h > 23) h = 0;
      setTime(String(h).padStart(2, "0"), currentMinute);
    };
  }

  // 3. Multi-Member Selection
  let selectedEventMembers = (Array.isArray(activeCalendarMemberFilters) && activeCalendarMemberFilters.length > 0) ? [...activeCalendarMemberFilters] : ["Ava"];

  const updateMemberChipsUI = () => {
    document.querySelectorAll(".event-member-chip").forEach(chip => {
      const m = chip.getAttribute("data-member");
      if (selectedEventMembers.includes(m)) {
        chip.classList.add("is-selected");
      } else {
        chip.classList.remove("is-selected");
      }
    });
    if (memberInput) memberInput.value = selectedEventMembers.join(" & ") || "Family";
  };

  // 4. Emoji Selector & Auto-Detection Helper
  let isManualEmoji = false;
  const setEmoji = (emoji) => {
    const em = emoji || "📅";
    if (iconInput) iconInput.value = em;
    if (emojiDisplay) emojiDisplay.textContent = em;
    if (modalTrophy) modalTrophy.textContent = em;

    if (emojiPaletteGrid) {
      emojiPaletteGrid.querySelectorAll(".emoji-palette-item").forEach(item => {
        if (item.getAttribute("data-emoji") === em) item.classList.add("is-selected");
        else item.classList.remove("is-selected");
      });
    }
  };

  // Populate emoji palette grid once if empty
  if (emojiPaletteGrid && emojiPaletteGrid.children.length === 0) {
    emojiPaletteGrid.innerHTML = EVENT_EMOJI_LIST.map(em => `
      <button type="button" class="emoji-palette-item" data-emoji="${em}" title="Select ${em}">
        ${em}
      </button>
    `).join("");

    emojiPaletteGrid.querySelectorAll(".emoji-palette-item").forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const chosen = item.getAttribute("data-emoji");
        if (chosen) {
          isManualEmoji = true;
          setEmoji(chosen);
          if (emojiPalette) emojiPalette.style.display = "none";
        }
      };
    });
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

  if (emojiPalette) {
    emojiPalette.style.display = "none";
  }

  if (titleInput) {
    titleInput.oninput = () => {
      if (!isManualEmoji) {
        const detected = detectEmojiForTitle(titleInput.value);
        if (detected) setEmoji(detected);
        else if (!titleInput.value.trim()) setEmoji("📅");
      }
    };
  }

  // Populate data when editing vs creating
  if (evt) {
    if (modalTitle) modalTitle.textContent = "Edit Calendar Event";
    if (idInput) idInput.value = evt.id || "";
    if (titleInput) titleInput.value = evt.title || "";
    if (durationSelect) durationSelect.value = evt.duration || "1 hour";
    if (repeatSelect) repeatSelect.value = evt.repeat || "none";
    if (descInput) descInput.value = evt.description || "";
    if (locationInput) locationInput.value = evt.location || "";
    if (categoryInput) categoryInput.value = evt.category || "Other";

    isManualEmoji = true;
    setEmoji(evt.icon || "📅");

    const parsed = parseTimeString(evt.time || "16:30");
    setTime(parsed.hour, parsed.minute);
    
    const curMem = evt.member || "Ava";
    selectedEventMembers = curMem.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    if (selectedEventMembers.length === 0) selectedEventMembers = ["Ava"];
    updateMemberChipsUI();
    if (btnDelete) btnDelete.style.display = "inline-block";
  } else {
    if (modalTitle) modalTitle.textContent = "Add Calendar Event";
    if (idInput) idInput.value = "";
    if (titleInput) titleInput.value = "";
    if (durationSelect) durationSelect.value = "1 hour";
    if (repeatSelect) repeatSelect.value = "none"; // Defaults to One-Off
    if (descInput) descInput.value = "";
    if (locationInput) locationInput.value = "";
    if (categoryInput) categoryInput.value = "Other";

    isManualEmoji = false;
    setEmoji("📅");

    setTime("16", "30"); // Defaults to 16:30 (4:30 PM)

    selectedEventMembers = ["Ava"];
    updateMemberChipsUI();
    if (btnDelete) btnDelete.style.display = "none";
  }

  // Wire preset suggestion chips
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const pTitle = chip.getAttribute("data-title");
      const pIcon = chip.getAttribute("data-icon") || "📅";
      const pCat = chip.getAttribute("data-category") || "Other";
      const pTime = chip.getAttribute("data-time") || "16:30";
      const pDuration = chip.getAttribute("data-duration") || "1 hour";
      const pFor = chip.getAttribute("data-for");

      if (titleInput) titleInput.value = pTitle;
      isManualEmoji = true;
      setEmoji(pIcon);
      if (categoryInput) categoryInput.value = pCat;
      if (durationSelect) durationSelect.value = pDuration;
      if (repeatSelect) repeatSelect.value = "none"; // Defaults to One-Off

      const parsed = parseTimeString(pTime);
      setTime(parsed.hour, parsed.minute);

      if (pFor) {
        if (pFor === "Family") selectedEventMembers = ["Family"];
        else selectedEventMembers = [pFor];
        updateMemberChipsUI();
      }
    };
  });

  // Wire member chips (Multi-select)
  document.querySelectorAll(".event-member-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const m = chip.getAttribute("data-member");
      if (m === "Family") {
        selectedEventMembers = ["Family"];
      } else {
        selectedEventMembers = selectedEventMembers.filter(x => x !== "Family");
        if (selectedEventMembers.includes(m)) {
          selectedEventMembers = selectedEventMembers.filter(x => x !== m);
        } else {
          selectedEventMembers.push(m);
        }
        if (selectedEventMembers.length === 0) {
          selectedEventMembers = [m];
        }
      }
      updateMemberChipsUI();
    };
  });

  const closeEventModal = () => {
    if (modal) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  const btnClose = document.getElementById("btn-close-event-modal");
  const btnCancel = document.getElementById("btn-cancel-event-modal");
  if (btnClose) btnClose.onclick = closeEventModal;
  if (btnCancel) btnCancel.onclick = closeEventModal;

  if (btnDelete) {
    btnDelete.onclick = (e) => {
      e.preventDefault();
      const eventId = idInput.value;
      if (!eventId) return;

      if (!familyEvents) familyEvents = loadFamilyEvents();
      const evtToDelete = familyEvents.find(x => x.id === eventId);
      const evtTitle = evtToDelete ? evtToDelete.title : (titleInput ? titleInput.value : "Calendar Event");
      const evtTime = evtToDelete ? `${evtToDelete.day} at ${evtToDelete.time}` : "";

      showDeleteConfirmation({
        icon: "🗓️",
        title: "Delete Calendar Event?",
        itemTitle: evtTitle,
        warning: evtTime ? `This will permanently remove this event (${evtTime}) from your calendar schedule.` : "This will permanently remove this event from your calendar schedule.",
        confirmLabel: "Delete Event",
        onConfirm: () => {
          familyEvents = familyEvents.filter(x => x.id !== eventId);
          saveFamilyEvents(familyEvents);
          renderWeekCalendar();
          closeEventModal();
          if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
        }
      });
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const eventId = idInput.value || `evt_${Date.now()}`;
      const title = titleInput.value.trim();
      if (!title) return;

      const date = (dateInput && dateInput.value) ? dateInput.value : currentDateKey;
      const day = (daySelect && daySelect.value) ? daySelect.value : currentDay;
      const time = (timeInput && timeInput.value.trim()) ? timeInput.value.trim() : `${currentHour}:${currentMinute}`;
      const duration = durationSelect ? durationSelect.value : "1 hour";
      const repeat = repeatSelect ? repeatSelect.value : "none";
      const member = memberInput.value || "Family";
      const description = descInput ? descInput.value.trim() : "";
      const location = locationInput.value.trim();
      const icon = iconInput.value || "📅";
      const category = categoryInput.value || "Other";

      if (!familyEvents) familyEvents = loadFamilyEvents();
      const existingIdx = familyEvents.findIndex(x => x.id === eventId);
      const newEvt = {
        id: eventId,
        title,
        date,
        day,
        time,
        duration,
        repeat,
        member,
        description,
        location,
        icon,
        category
      };

      if (existingIdx >= 0) {
        familyEvents[existingIdx] = newEvt;
      } else {
        familyEvents.push(newEvt);
      }

      saveFamilyEvents(familyEvents);
      renderWeekCalendar();
      closeEventModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    };
  }

  if (!modal.open) {
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "true");
  }
}
window.openEventModal = openEventModal;

// ============================================================================
// SKYLIGHT CALENDAR MULTI-VIEW ENGINE (Day, Schedule 3-Day, Week, Month)
// ============================================================================

function formatCalendarRange(view, anchorDate, startDate, dayCount) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (view === "day") {
    const d = anchorDate || new Date();
    return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
  }
  if (view === "schedule") {
    const start = startDate || new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]}`;
    } else {
      return `${start.getDate()} ${monthNames[start.getMonth()]} – ${end.getDate()} ${monthNames[end.getMonth()]}`;
    }
  }
  if (view === "week") {
    const start = startDate || new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]}`;
    } else {
      return `${start.getDate()} ${monthNames[start.getMonth()]} – ${end.getDate()} ${monthNames[end.getMonth()]}`;
    }
  }
  if (view === "month") {
    const d = anchorDate || new Date();
    return `${fullMonthNames[d.getMonth()]} ${d.getFullYear()}`;
  }
  return "";
}

function setCalendarView(view, targetDate = null) {
  if (!["day", "schedule", "week", "month"].includes(view)) view = "week";
  currentCalendarView = view;
  if (targetDate) {
    calendarAnchorDate = new Date(targetDate);
    calendarAnchorDate.setHours(0, 0, 0, 0);
  } else if (view === "schedule") {
    // Schedule view strictly shows Today, Tomorrow, and Next Day by default
    calendarAnchorDate = new Date();
    calendarAnchorDate.setHours(0, 0, 0, 0);
  } else if (view === "day" && !calendarAnchorDate) {
    calendarAnchorDate = new Date();
    calendarAnchorDate.setHours(0, 0, 0, 0);
  }
  try {
    localStorage.setItem("chore_calendar_view", view);
  } catch (e) {}
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.setCalendarView = setCalendarView;

function setCalendarContentFilter(filter) {
  if (!["all", "events", "chores"].includes(filter)) filter = "all";
  currentCalendarContentFilter = filter;
  try {
    localStorage.setItem("chore_calendar_content_filter", filter);
  } catch (e) {}
  syncCalendarContentFilterUI();
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.setCalendarContentFilter = setCalendarContentFilter;

function syncCalendarContentFilterUI() {
  document.querySelectorAll(".calendar-filter-btn").forEach(btn => {
    const f = btn.getAttribute("data-filter");
    const isActive = f === currentCalendarContentFilter;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
window.syncCalendarContentFilterUI = syncCalendarContentFilterUI;

function navigateCalendar(dir, stepDays = null) {
  if (currentCalendarView === "day") {
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + dir);
  } else if (currentCalendarView === "schedule") {
    // When dragging/swiping day-by-day, stepDays is 1. When clicking arrows, stepDays is 3.
    const steps = (typeof stepDays === "number") ? stepDays : 3;
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + (dir * steps));
  } else if (currentCalendarView === "week") {
    calendarAnchorDate.setDate(calendarAnchorDate.getDate() + (dir * 7));
  } else if (currentCalendarView === "month") {
    calendarAnchorDate.setMonth(calendarAnchorDate.getMonth() + dir);
  }
  renderWeekCalendar();
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
}
window.navigateCalendar = navigateCalendar;

function renderCalendarMonthView(gridContainer, anchorDate, today, familyEvents, currentTasks, dinnerThemes, activeMemberFilter) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  const firstDayDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const weekShortLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const weekdaysHtml = weekShortLabels.map(s => `<div class="month-weekday-label">${s}</div>`).join("");

  let cellsHtml = "";
  let dayCounter = 1;
  let nextMonthDay = 1;
  const totalCells = (firstDayDow + totalDays) > 35 ? 42 : 35;

  for (let cellIdx = 0; cellIdx < totalCells; cellIdx++) {
    let cellDate;
    let isOtherMonth = false;
    let dayNum;

    if (cellIdx < firstDayDow) {
      dayNum = prevMonthLastDay - firstDayDow + cellIdx + 1;
      cellDate = new Date(year, month - 1, dayNum);
      isOtherMonth = true;
    } else if (dayCounter <= totalDays) {
      dayNum = dayCounter++;
      cellDate = new Date(year, month, dayNum);
    } else {
      dayNum = nextMonthDay++;
      cellDate = new Date(year, month + 1, dayNum);
      isOtherMonth = true;
    }

    const isToday = today.toDateString() === cellDate.toDateString();
    const dayDowIdx = cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1;
    const dayName = weekDayNames[dayDowIdx];
    const dateStr = getLocalDateKey(cellDate);

    let dayEvents = (familyEvents || []).filter(e => isEventOnDate(e, dateStr, dayName, cellDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }

    const activeWeekKey = getIsoWeekKey(new Date());
    const todayDateStr = getLocalDateKey(new Date());
    const cellWeekKey = getIsoWeekKey(cellDate);
    const isCellCurrentWeek = (cellWeekKey === activeWeekKey);
    const isCellFutureDate = (dateStr > todayDateStr);

    let dayTasks = currentTasks.filter(task => {
      const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
      if (isDaily) return true;
      const isWeekly = task.repeat === "weekly";
      if (isWeekly) return task.day === dayName;
      if (task.done) {
        if (task.completedAt) {
          return getLocalDateKey(task.completedAt) === dateStr;
        }
        return isCellCurrentWeek && task.completedDay === dayName;
      }
      if (isCellCurrentWeek) {
        return task.day === dayName;
      }
      return task.date ? task.date === dateStr : false;
    });
    if (activeCalendarMemberFilters !== null) {
      dayTasks = dayTasks.filter(task => {
        const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
        let assigned = "Anyone";
        if (isCellCurrentWeek && isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
          assigned = task.assignedDays[dayName] || "Anyone";
        } else {
          assigned = isDaily ? "Anyone" : (task.assignedTo || "Anyone");
        }
        return isMemberSelected(assigned);
      });
    }

    const totalChores = dayTasks.length;
    const completedChores = isCellFutureDate ? 0 : dayTasks.filter(t => {
      const isDaily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      if (isDaily) {
        if (t.completedDays && t.completedDays[dayName]) {
          const rec = t.completedDays[dayName];
          const compDateStr = (typeof rec === "object" && rec !== null && rec.completedAt) ? getLocalDateKey(rec.completedAt) : null;
          if (compDateStr) return compDateStr === dateStr;
          return isCellCurrentWeek;
        }
        return false;
      }
      const isWeekly = t.repeat === "weekly";
      if (isWeekly) {
        if (t.completedWeeks && t.completedWeeks[cellWeekKey]) return true;
        if (t.done && t.completedAt && getIsoWeekKey(new Date(t.completedAt)) === cellWeekKey) return true;
        return false;
      }
      return !!t.done && (t.completedAt ? getLocalDateKey(t.completedAt) === dateStr : isCellCurrentWeek);
    }).length;

    const cellMeal = getMealForDate(cellDate);
    const dinnerSnippet = (cellMeal && cellMeal.title && !isOtherMonth)
      ? `<div class="month-cell-dinner" data-date-str="${dateStr}" title="Planned Dinner: ${escapeHtml(cellMeal.title)} — Tap to view recipe">
           <span class="month-dinner-icon">${escapeHtml(cellMeal.emoji || '🍽️')}</span>
           <span class="month-dinner-title">${escapeHtml(cellMeal.title)}</span>
         </div>`
      : "";

    // In Month View: only scheduled events are rendered as chips.
    // Chores are cleanly summarized at the bottom as a count badge (e.g. ✓ 5/5).
    const cellItems = [];

    // 1. Scheduled Events (Tutors, lessons, rehearsals, activities)
    dayEvents.forEach(evt => {
      const mList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
      const pal = getMemberPalette(mList[0] || "family");
      cellItems.push({
        type: "event",
        icon: evt.icon || "📅",
        title: evt.title,
        sub: evt.time || "All Day",
        pal: pal
      });
    });

    const maxItems = 2;
    const visibleItems = cellItems.slice(0, maxItems);
    const extraCount = cellItems.length - maxItems;

    const itemChipsHtml = visibleItems.map(item => {
      return `
        <div class="month-mini-event" 
             style="background: ${item.pal.lightBg}; color: ${item.pal.text}; border-left-color: ${item.pal.primary};" 
             title="${escapeHtml(item.title)} (${escapeHtml(item.sub)})">
          <span class="mini-icon">${escapeHtml(item.icon)}</span>
          <span class="mini-title">${escapeHtml(item.title)}</span>
        </div>
      `;
    }).join("") + (extraCount > 0 ? `<div class="month-mini-event month-more-badge" style="color: var(--text-muted); font-size: 0.65rem;">+${extraCount} more</div>` : "");

    const choresBadge = totalChores > 0
      ? `<div class="month-cell-chores ${completedChores === totalChores ? 'all-done' : ''}">${completedChores === totalChores ? '✓' : '🧹'} ${completedChores}/${totalChores}</div>`
      : "";

    let monthContentHtml = "";
    if (currentCalendarContentFilter === "events") {
      monthContentHtml = `<div class="month-cell-events">${itemChipsHtml}</div>`;
    } else if (currentCalendarContentFilter === "chores") {
      monthContentHtml = choresBadge ? `<div class="month-cell-events is-chores-only">${choresBadge}</div>` : "";
    } else {
      monthContentHtml = `<div class="month-cell-events">${itemChipsHtml}</div>${choresBadge}`;
    }

    cellsHtml += `
      <div class="calendar-month-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}" 
           data-date-str="${dateStr}"
           title="Tap to open ${dayName}, ${dayNum} in Day View">
        <div class="month-cell-header">
          <span class="month-cell-date">${dayNum}</span>
        </div>
        ${dinnerSnippet}
        ${monthContentHtml}
      </div>
    `;
  }

  gridContainer.className = "calendar-week-grid view-month";
  gridContainer.innerHTML = `
    <div class="calendar-month-container">
      <div class="calendar-month-weekdays">${weekdaysHtml}</div>
      <div class="calendar-month-grid">${cellsHtml}</div>
    </div>
  `;

  gridContainer.querySelectorAll(".month-cell-dinner").forEach(din => {
    din.onclick = (e) => {
      e.stopPropagation();
      const dStr = din.getAttribute("data-date-str");
      if (typeof openPlanMealModalForDate === "function") {
        openPlanMealModalForDate(dStr);
      }
    };
  });

  gridContainer.querySelectorAll(".calendar-month-cell").forEach(cell => {
    cell.onclick = () => {
      const dStr = cell.getAttribute("data-date-str");
      if (dStr) {
        const [y, m, d] = dStr.split("-").map(Number);
        const cellDate = new Date(y, m - 1, d);
        cellDate.setHours(0, 0, 0, 0);
        setCalendarView("day", cellDate);
      }
    };
  });
}

function renderWeekCalendar() {
  const gridContainer = document.getElementById("calendar-week-grid");
  if (!gridContainer) return;

  const viewContainer = document.querySelector(".calendar-view-container");
  if (viewContainer) {
    viewContainer.classList.toggle("view-week-active", currentCalendarView === "week");
  }

  // 1. Live Clock & Header
  const clockEl = document.getElementById("calendar-live-clock");
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const famTitleEl = document.getElementById("calendar-family-name");
  if (famTitleEl) {
    famTitleEl.textContent = isDefaultTurnbullBoard ? "Turnbull Family" : (boardSettings.familyName || "Our Family");
  }

  // 1b. Render Family Sticky Note / Message of the Day
  renderFamilyStickyNote();
  const btnEditSticky = document.getElementById("btn-edit-sticky");
  if (btnEditSticky && (!btnEditSticky.hasAttribute || !btnEditSticky.hasAttribute("data-wired"))) {
    if (typeof btnEditSticky.setAttribute === "function") btnEditSticky.setAttribute("data-wired", "true");
    btnEditSticky.onclick = (e) => {
      e.stopPropagation();
      openStickyNoteModal();
    };
  }
  const stickyCard = document.getElementById("family-sticky-card");
  if (stickyCard && (!stickyCard.hasAttribute || !stickyCard.hasAttribute("data-wired"))) {
    if (typeof stickyCard.setAttribute === "function") stickyCard.setAttribute("data-wired", "true");
    stickyCard.onclick = () => {
      openStickyNoteModal();
    };
  }
  const btnAddNote = document.getElementById("btn-calendar-add-note");
  if (btnAddNote && (!btnAddNote.hasAttribute || !btnAddNote.hasAttribute("data-wired"))) {
    if (typeof btnAddNote.setAttribute === "function") btnAddNote.setAttribute("data-wired", "true");
    btnAddNote.onclick = (e) => {
      e.stopPropagation();
      openStickyNoteModal();
    };
  }

  // 2. View Dropdown label & active checks (Header shows "View")
  const currentViewLabel = document.getElementById("current-view-label");
  if (currentViewLabel) {
    currentViewLabel.textContent = "View";
  }

  const viewDropdownMenu = document.getElementById("view-dropdown-menu");
  if (viewDropdownMenu) {
    viewDropdownMenu.querySelectorAll(".dropdown-menu-item").forEach(item => {
      const v = item.getAttribute("data-view");
      const isActive = v === currentCalendarView;
      item.classList.toggle("active", isActive);
      const checkEl = item.querySelector(".dropdown-item-check");
      if (checkEl) checkEl.textContent = isActive ? "✓" : "";
    });
  }

  // 3. Consolidated Filter Dropdown label & active checks (Members only)
  const currentFilterLabel = document.getElementById("current-filter-label");
  const filterActiveDot = document.getElementById("filter-active-dot");
  if (currentFilterLabel && filterActiveDot) {
    if (activeCalendarMemberFilters !== null) {
      if (activeCalendarMemberFilters.length === 0) {
        currentFilterLabel.textContent = "Filter (0)";
      } else {
        currentFilterLabel.textContent = `Filter (${activeCalendarMemberFilters.length})`;
      }
      filterActiveDot.style.display = "inline-block";
    } else {
      currentFilterLabel.textContent = "Filter";
      filterActiveDot.style.display = "none";
    }
  }

  // Content filter menu item active states
  const filterDropdownMenu = document.getElementById("filter-dropdown-menu");
  if (filterDropdownMenu) {
    filterDropdownMenu.querySelectorAll("[data-content-filter]").forEach(item => {
      const f = item.getAttribute("data-content-filter");
      const isActive = f === currentCalendarContentFilter;
      item.classList.toggle("active", isActive);
      const checkEl = item.querySelector(".dropdown-item-check");
      if (checkEl) checkEl.textContent = isActive ? "✓" : "";
    });
  }

  // Dynamic Family Members in Filter Dropdown (Skylight Pill + Toggle Switches)
  const filterMembersList = document.getElementById("filter-members-list");
  if (filterMembersList) {
    // Select All is active if activeCalendarMemberFilters is null OR contains all family members
    const selectAllActive = (activeCalendarMemberFilters === null) || 
      (Array.isArray(activeCalendarMemberFilters) && familyMembers.every(m => activeCalendarMemberFilters.includes(m)));

    // Row 1: Select All with icon and toggle switch
    let membersHtml = `
      <div class="skylight-filter-row ${selectAllActive ? 'is-active' : ''}" data-member-filter="ALL" role="button" tabindex="0">
        <div class="skylight-filter-member-left">
          <span class="skylight-filter-icon-select-all" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span class="skylight-filter-member-name">Select All</span>
        </div>
        <div class="skylight-filter-member-right">
          <div class="skylight-filter-toggle ${selectAllActive ? 'is-on' : ''}" aria-label="Select All Toggle">
            <span class="skylight-toggle-thumb"></span>
          </div>
        </div>
      </div>
    `;

    // Row 2+: Each Family Member Profile with their designated Skylight color dot, name, and toggle switch (pencils removed)
    familyMembers.forEach((member) => {
      const pal = getMemberPalette(member);
      // Member is active if Select All is active OR member is explicitly in activeCalendarMemberFilters
      const isMemberActive = (activeCalendarMemberFilters === null) 
        ? true 
        : activeCalendarMemberFilters.includes(member);

      membersHtml += `
        <div class="skylight-filter-row ${isMemberActive ? 'is-active' : ''}" data-member-filter="${escapeHtml(member)}" role="button" tabindex="0">
          <div class="skylight-filter-member-left">
            <span class="skylight-filter-color-dot" style="background: ${pal.primary};" title="${escapeHtml(pal.name)}"></span>
            <span class="skylight-filter-member-name">${escapeHtml(member)}</span>
          </div>
          <div class="skylight-filter-member-right">
            <div class="skylight-filter-toggle ${isMemberActive ? 'is-on' : ''}" aria-label="${escapeHtml(member)} toggle">
              <span class="skylight-toggle-thumb"></span>
            </div>
          </div>
        </div>
      `;
    });

    filterMembersList.innerHTML = membersHtml;
  }

  // 4. Compute Dates & Recurrence
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const currentMeals = weeklyMeals || (typeof loadWeeklyMeals === "function" ? loadWeeklyMeals() : DEFAULT_WEEKLY_MEALS);
  const dinnerThemes = {};
  weekDays.forEach(day => {
    const m = currentMeals && currentMeals[day];
    dinnerThemes[day] = {
      isPlanned: !!(m && m.title && m.title.trim().length > 0),
      title: (m && m.title && m.title.trim().length > 0) ? m.title.trim() : "+ Plan Dinner"
    };
  });

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";

  // Auto-align completed non-daily chores to the day they were completed
  currentTasks.forEach(task => {
    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    if (!isDaily && task.done && task.completedAt) {
      try {
        const compDate = new Date(task.completedAt);
        const compDayIdx = compDate.getDay();
        const compDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][compDayIdx];
        if (compDayName && task.day !== compDayName) {
          task.day = compDayName;
          task.completedDay = compDayName;
        }
      } catch (e) {}
    }
  });

  // Navigation tooltips
  const prevBtn = document.getElementById("btn-calendar-prev-week");
  const nextBtn = document.getElementById("btn-calendar-next-week");
  if (prevBtn && nextBtn) {
    if (currentCalendarView === "day") {
      prevBtn.title = "Previous Day";
      nextBtn.title = "Next Day";
    } else if (currentCalendarView === "schedule") {
      prevBtn.title = "Previous 3 Days";
      nextBtn.title = "Next 3 Days";
    } else if (currentCalendarView === "month") {
      prevBtn.title = "Previous Month";
      nextBtn.title = "Next Month";
    } else {
      prevBtn.title = "Previous Week";
      nextBtn.title = "Next Week";
    }
  }

  // Handle Month View
  if (currentCalendarView === "month") {
    if (!familyEvents) familyEvents = loadFamilyEvents();
    renderCalendarMonthView(gridContainer, calendarAnchorDate, today, familyEvents, currentTasks, dinnerThemes, activeCalendarMemberFilter);
    return;
  }

  if (!familyEvents) familyEvents = loadFamilyEvents();

  // Helper: Routine label for chores
  function getTaskRoutineInfo(task) {
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

  // Helper: Event minutes for sorting
  function getEventMinutes(evt) {
    const t = (evt.time || "").trim().toLowerCase();
    if (!t || t === "all day") return 0;
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return 720;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3] ? m[3].toLowerCase() : null;
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return h * 60 + min;
  }

  // Helper: Task completion status
  const getTaskCompletionOnDay = (task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate) => {
    if (isColFutureDate) {
      return { isCompleted: false, completerName: null };
    }
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    if (isDaily) {
      if (!task.completedDays || !task.completedDays[dayName]) {
        return { isCompleted: false, completerName: null };
      }
      const rec = task.completedDays[dayName];
      const compDateStr = (typeof rec === "object" && rec !== null && rec.completedAt)
        ? getLocalDateKey(rec.completedAt)
        : null;
      if (compDateStr) {
        if (compDateStr === colDateStr) {
          const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
          return { isCompleted: true, completerName: by };
        }
        return { isCompleted: false, completerName: null };
      }
      if (isColCurrentWeek) {
        const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
        return { isCompleted: true, completerName: by };
      }
      return { isCompleted: false, completerName: null };
    }

    const isWeekly = task.repeat === "weekly";
    const colWeekKey = getIsoWeekKey(colDate);
    if (isWeekly) {
      if (task.completedWeeks && task.completedWeeks[colWeekKey]) {
        const rec = task.completedWeeks[colWeekKey];
        const by = typeof rec === "object" && rec !== null ? (rec.completedBy || "Family") : String(rec);
        return { isCompleted: true, completerName: by };
      }
      if (task.done && task.completedAt && getIsoWeekKey(new Date(task.completedAt)) === colWeekKey) {
        return { isCompleted: true, completerName: task.completedBy || "Family" };
      }
      return { isCompleted: false, completerName: null };
    }

    if (!task.done) return { isCompleted: false, completerName: null };
    if (task.completedAt) {
      if (getLocalDateKey(task.completedAt) === colDateStr) {
        return { isCompleted: true, completerName: task.completedBy || "Family" };
      }
      return { isCompleted: false, completerName: null };
    }
    if (isColCurrentWeek && task.completedDay === dayName) {
      return { isCompleted: true, completerName: task.completedBy || "Family" };
    }
    return { isCompleted: false, completerName: null };
  };

  // Helper: Render Skylight Event Card (Title top, time underneath, avatar right)
  const renderSkylightEventCard = (evt) => {
    const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    let inlineStyleAttr = "";

    if (membersList.length >= 2) {
      const pal1 = getMemberPalette(membersList[0]);
      const pal2 = getMemberPalette(membersList[1]);
      inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
    } else {
      const pal = getMemberPalette(membersList[0] || "Family");
      inlineStyleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
    }

    const memberAvatarsHtml = membersList.map(m => {
      const pal = getMemberPalette(m);
      const isMini = membersList.length > 1;
      return `<span class="skylight-avatar ${isMini ? 'avatar-mini' : ''}" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
    }).join("");

    let repeatBadgeHtml = "";
    if (evt.repeat && evt.repeat !== "none") {
      repeatBadgeHtml = ` <span title="Repeats: ${escapeHtml(evt.repeat)}">🔁</span>`;
    }

    const durationText = evt.duration ? ` (${escapeHtml(evt.duration)})` : "";
    const timeSubtitle = evt.time ? `${escapeHtml(evt.time)}${durationText}` : "All day";

    return `
      <div class="skylight-card" ${inlineStyleAttr} data-event-id="${evt.id}" title="Tap to view/edit ${escapeHtml(evt.title)}">
        <div class="skylight-card-main">
          <div class="skylight-card-title-row">
            <span class="skylight-card-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}${repeatBadgeHtml}</span>
          </div>
          <span class="skylight-card-sub">${timeSubtitle}</span>
        </div>
        <div class="skylight-card-avatar-wrap">
          ${memberAvatarsHtml}
        </div>
      </div>
    `;
  };

  // Helper: Render Skylight Chore Card (Title top, time/points underneath, avatar right)
  const renderSkylightChoreCard = (task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate) => {
    const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
    const isWeekly = task.repeat === "weekly";
    const { isCompleted, completerName: rawCompleter } = getTaskCompletionOnDay(task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate);
    const completerName = rawCompleter ? normalizeFamilyMemberName(rawCompleter) : null;

    let assigned = "Anyone";
    if (isColCurrentWeek) {
      if (isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
        assigned = task.assignedDays[dayName] || "Anyone";
      } else {
        assigned = task.assignedTo || "Anyone";
      }
    } else {
      assigned = isDaily ? "Anyone" : (task.assignedTo || "Anyone");
    }

    const effectivePerson = (isCompleted && completerName) ? completerName : assigned;
    const isUnassigned = !effectivePerson || effectivePerson.toLowerCase() === "anyone" || effectivePerson.toLowerCase() === "unassigned" || effectivePerson.toLowerCase() === "up for grabs";
    let inlineStyleAttr = "";

    const taskMembers = (effectivePerson || "").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
    if (taskMembers.length >= 2 && !isUnassigned) {
      const pal1 = getMemberPalette(taskMembers[0]);
      const pal2 = getMemberPalette(taskMembers[1]);
      inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
    } else if (!isUnassigned) {
      const pal = getMemberPalette(effectivePerson);
      inlineStyleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
    } else {
      inlineStyleAttr = `style="background: var(--bg-surface, #f8fafc); border-color: var(--card-border, #e2e8f0); color: var(--text-secondary, #64748b);"`;
    }

    const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
      ? task.rewardValue 
      : (isMoney ? 1.00 : (task.points || 1));
    const rewardText = isMoney ? `${currency}${rewardVal.toFixed(2)}` : `+${rewardVal} pt${rewardVal > 1 ? "s" : ""}`;

    const isFutureLocked = (isDaily || isWeekly) && isColFutureDate;

    const checkTitleText = isCompleted
      ? `Completed by ${escapeHtml(completerName || 'Family')} (Click to undo)`
      : (isFutureLocked
          ? `⏰ Chores can only be completed on their scheduled day (${dayName})`
          : `Click to complete and claim ${rewardText}`);

    const isPriority = task.isPriority && !isCompleted;
    const priorityBadgeHtml = isPriority ? `<span style="color: #ef4444; font-weight: 800; font-size: 0.72rem; margin-right: 2px;" title="High Priority">🚨</span>` : "";

    const choreIcon = task.icon || detectEmojiForChore(task.title);
    const choreIconHtml = choreIcon ? `<span class="chore-icon">${escapeHtml(choreIcon)}</span> ` : "";

    const repeatBadgeHtml = isWeekly ? ` <span title="Repeats Weekly on ${escapeHtml(task.day)}">🔁</span>` : "";
    const streakBadgeHtml = (task.streak && task.streak >= 2)
      ? ` <span class="chore-streak-badge ${task.streak >= 7 ? 'milestone' : ''}" title="${task.streak}-Day Streak!">🔥 ${task.streak}d</span>`
      : "";

    const routineInfo = getTaskRoutineInfo(task);
    const choreSubText = isCompleted
      ? `✓ ${escapeHtml(completerName || assigned)} • ${rewardText}`
      : `${routineInfo.label ? routineInfo.label + ' • ' : ''}${rewardText}`;

    // Avatars on right
    let choreAvatarsHtml = "";
    if (isCompleted && completerName) {
      const pal = getMemberPalette(completerName);
      choreAvatarsHtml = `<span class="skylight-avatar" style="background: ${pal.primary};" title="Completed by ${escapeHtml(completerName)}">${escapeHtml(completerName.charAt(0).toUpperCase())}</span>`;
    } else if (isUnassigned) {
      choreAvatarsHtml = `<span class="skylight-avatar avatar-unassigned" title="Up for Grabs">⚡</span>`;
    } else if (taskMembers.length > 1) {
      choreAvatarsHtml = taskMembers.map(m => {
        const pal = getMemberPalette(m);
        return `<span class="skylight-avatar avatar-mini" style="background: ${pal.primary};" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
      }).join("");
    } else {
      const pal = getMemberPalette(effectivePerson);
      choreAvatarsHtml = `<span class="skylight-avatar" style="background: ${pal.primary};" title="${escapeHtml(effectivePerson)}">${escapeHtml(effectivePerson.charAt(0).toUpperCase())}</span>`;
    }

    return `
      <div class="skylight-card ${pastelClass} ${isCompleted ? 'is-done' : ''} ${isPriority ? 'is-priority-chore' : ''}" 
           ${splitStyleAttr}
           data-task-id="${task.id}" data-day="${dayName}" data-date="${colDateStr}">
        <div class="skylight-card-main">
          <div class="skylight-card-title-row">
            <button type="button" class="skylight-chore-check ${isCompleted ? 'is-checked' : ''} ${isFutureLocked ? 'is-future-locked' : ''}" 
                    data-task-id="${task.id}" data-day="${dayName}" data-date="${colDateStr}" data-completed="${isCompleted ? 'true' : 'false'}"
                    data-future-locked="${isFutureLocked ? 'true' : 'false'}"
                    ${isFutureLocked ? 'disabled' : ''}
                    title="${escapeHtml(checkTitleText)}">
              ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>' : (isFutureLocked ? '<span style="font-size: 9px;">🔒</span>' : '')}
            </button>
            ${priorityBadgeHtml}
            <span class="skylight-card-title">${choreIconHtml}${escapeHtml(task.title)}${repeatBadgeHtml}${streakBadgeHtml}</span>
          </div>
          <span class="skylight-card-sub">${escapeHtml(choreSubText)}</span>
        </div>
        <div class="skylight-card-avatar-wrap">
          ${choreAvatarsHtml}
        </div>
      </div>
    `;
  };

  // =========================================================================
  // VIEW MODE: WEEK (Skylight 8-Container 4x2 Grid)
  // Starts on Monday of current anchor week, 8th container is clean "Next Week" card
  // =========================================================================
  if (currentCalendarView === "week") {
    let boxesHtml = "";
    const anchor = new Date(calendarAnchorDate);
    anchor.setHours(0, 0, 0, 0);

    // Monday of the anchor's week
    const weekStart = new Date(anchor);
    const dayOfWeek = weekStart.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    weekStart.setDate(weekStart.getDate() + diffToMonday);

    // Containers 0 to 6 (Monday through Sunday)
    for (let i = 0; i < 7; i++) {
      const colDate = new Date(weekStart);
      colDate.setDate(weekStart.getDate() + i);
      const colDayIdx = colDate.getDay() === 0 ? 6 : colDate.getDay() - 1;
      const dayName = weekDays[colDayIdx];
      const shortName = weekShort[colDayIdx];
      const dayDateNum = colDate.getDate();
      const isToday = today.toDateString() === colDate.toDateString();
      const colDateStr = getLocalDateKey(colDate);
      const activeWeekKey = getIsoWeekKey(new Date());
      const todayDateStr = getLocalDateKey(new Date());
      const colWeekKey = getIsoWeekKey(colDate);
      const isColCurrentWeek = (colWeekKey === activeWeekKey);
      const isColFutureDate = (colDateStr > todayDateStr);

      // Day tasks
      let dayTasks = currentTasks.filter(task => {
        if (!task || typeof task !== "object") return false;
        const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
        if (isDaily) return true;
        if (task.repeat === "weekly") return task.day === dayName;
        if (task.done) {
          if (task.completedAt) return getLocalDateKey(task.completedAt) === colDateStr;
          return isColCurrentWeek && task.completedDay === dayName;
        }
        if (task.date) return task.date === colDateStr;
        return isColCurrentWeek && task.day === dayName;
      });

      // Day events
      let dayEvents = (familyEvents || []).filter(e => e && typeof e === "object" && isEventOnDate(e, colDateStr, dayName, colDate));

      // Active member filter (supports multi-member e.g. Steven / Dara / Ava)
      if (activeCalendarMemberFilters !== null) {
        dayEvents = dayEvents.filter(e => isMemberSelected(e.member));

        dayTasks = dayTasks.filter(task => {
          const isDaily = task.repeat === "daily" || task.day === "Daily" || task.taskType === "Daily Task";
          const { isCompleted, completerName } = getTaskCompletionOnDay(task, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate);
          if (isCompleted && completerName && isMemberSelected(completerName)) return true;
          let dayAssigned = task.assignedTo || "Anyone";
          if (isDaily && task.assignedDays && task.assignedDays[dayName] !== undefined) {
            dayAssigned = task.assignedDays[dayName] || "Anyone";
          }
          return isMemberSelected(dayAssigned);
        });
      }

      // Sort events chronologically
      dayEvents.sort((a, b) => getEventMinutes(a) - getEventMinutes(b));

      // Sort chores: pending first, completed last
      dayTasks.sort((a, b) => {
        const doneA = getTaskCompletionOnDay(a, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate).isCompleted ? 1 : 0;
        const doneB = getTaskCompletionOnDay(b, colDate, colDateStr, dayName, isColCurrentWeek, isColFutureDate).isCompleted ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        return getTaskRoutineInfo(a).order - getTaskRoutineInfo(b).order;
      });

      // Cards HTML (Events only on Calendar; Chores on dedicated Chores board)
      let dayCards = [];
      dayEvents.forEach(evt => dayCards.push(renderSkylightEventCard(evt)));

      // Subtitle count
      const evtCount = dayEvents.length;
      let countSubtitle = evtCount === 1 ? "1 event" : (evtCount > 1 ? `${evtCount} events` : "No events");

      const colMeal = getMealForDate(colDate);
      const mealHtml = (colMeal && colMeal.title)
        ? `<div class="skylight-box-meal is-planned" data-date="${colDateStr}" data-day="${dayName}" title="Dinner: ${escapeHtml(colMeal.title)} — Tap to view recipe">
            <span class="box-meal-icon">${escapeHtml(colMeal.emoji || '🍽️')}</span>
            <span class="box-meal-title">${escapeHtml(colMeal.title)}</span>
          </div>`
        : "";

      // Real-time day weather forecast from Open-Meteo
      const dayWeather = getForecastForDate(colDateStr);
      const weatherIconHtml = dayWeather
        ? `<span class="day-weather-icon" title="${escapeHtml(dayWeather.condition)}${dayWeather.maxTemp !== null ? ` • High ${dayWeather.maxTemp}° / Low ${dayWeather.minTemp}°` : ''}${dayWeather.rainProb ? ` • ${dayWeather.rainProb}% rain` : ''}" style="cursor: pointer;" onclick="openWeatherForecastModal()">${dayWeather.icon}</span>`
        : "";

      boxesHtml += `
        <div class="skylight-day-box ${isToday ? 'is-today-box' : ''}" data-date="${colDateStr}" data-day="${dayName}">
          <div class="skylight-day-box-header">
            <div class="day-box-header-row">
              <div class="day-box-title-wrap">
                <span class="day-name-label">${shortName}</span>
                <span class="day-num-label ${isToday ? 'today-badge-circle' : ''}">${dayDateNum}</span>
              </div>
              <div class="day-box-header-actions">
                ${weatherIconHtml}
                <button type="button" class="btn-discreet-add-event" data-date="${colDateStr}" data-day="${dayName}">+ Add Event</button>
              </div>
            </div>
            <div class="day-count-subtitle">${countSubtitle}</div>
          </div>
          <div class="skylight-day-box-body">
            ${mealHtml}
            ${dayCards.join("")}
          </div>
        </div>
      `;
    }

    // Container 7: Next Week Panel (Matching Skylight with clean Date Range header, no cramped cards)
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(weekStart.getDate() + 7);
    const nextWeekEnd = new Date(weekStart);
    nextWeekEnd.setDate(weekStart.getDate() + 13);

    const nwStartDayIdx = nextWeekStart.getDay() === 0 ? 6 : nextWeekStart.getDay() - 1;
    const nwStartDayName = weekDays[nwStartDayIdx];
    const nwStartDateStr = getLocalDateKey(nextWeekStart);

    const nwMonthStart = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][nextWeekStart.getMonth()];
    const nwMonthEnd = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][nextWeekEnd.getMonth()];
    const nextWeekRangeLabel = (nextWeekStart.getMonth() === nextWeekEnd.getMonth())
      ? `${nwMonthStart} ${nextWeekStart.getDate()} - ${nextWeekEnd.getDate()}`
      : `${nwMonthStart} ${nextWeekStart.getDate()} - ${nwMonthEnd} ${nextWeekEnd.getDate()}`;

    // Count how many events are scheduled for next week
    let nwEventsCount = 0;
    for (let d = 0; d < 7; d++) {
      const nwDate = new Date(nextWeekStart);
      nwDate.setDate(nextWeekStart.getDate() + d);
      const nwDayIdx = nwDate.getDay() === 0 ? 6 : nwDate.getDay() - 1;
      const nwDayName = weekDays[nwDayIdx];
      const nwDateStr = getLocalDateKey(nwDate);
      let dayEvts = (familyEvents || []).filter(e => e && typeof e === "object" && isEventOnDate(e, nwDateStr, nwDayName, nwDate));
      if (activeCalendarMemberFilters !== null) {
        dayEvts = dayEvts.filter(e => isMemberSelected(e.member));
      }
      nwEventsCount += dayEvts.length;
    }

    boxesHtml += `
      <div class="skylight-day-box skylight-next-week-box" data-date="${nwStartDateStr}" data-day="${nwStartDayName}">
        <div class="skylight-day-box-header">
          <div class="day-box-header-row">
            <span class="day-name-label" style="font-family: inherit; font-size: 1.15rem; font-weight: 500;">Next Week</span>
          </div>
          <div class="day-count-subtitle" style="font-size: 0.82rem; color: var(--text-secondary);">${nextWeekRangeLabel}</div>
        </div>
        <div class="skylight-day-box-body next-week-skylight-body" style="cursor: pointer;" title="Tap to view next week" onclick="navigateCalendar(1)">
          ${nwEventsCount > 0 ? `<div class="next-week-summary-pill">${nwEventsCount} ${nwEventsCount === 1 ? 'event' : 'events'} scheduled &rsaquo;</div>` : ''}
        </div>
      </div>
    `;

    gridContainer.className = "calendar-week-grid view-week";
    gridContainer.innerHTML = boxesHtml;
    return;
  }

  // =========================================================================
  // VIEW MODE: DAY (Skylight Split-Screen View: Mini Month on Left, Events on Right)
  // =========================================================================
  if (currentCalendarView === "day") {
    const currentDayDate = new Date(calendarAnchorDate);
    currentDayDate.setHours(0, 0, 0, 0);
    const dayDowIdx = currentDayDate.getDay() === 0 ? 6 : currentDayDate.getDay() - 1;
    const dayName = weekDays[dayDowIdx];
    const colDateStr = getLocalDateKey(currentDayDate);

    const isToday = today.toDateString() === currentDayDate.toDateString();
    const isYesterday = (new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)).toDateString() === currentDayDate.toDateString();
    const isTomorrow = (new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)).toDateString() === currentDayDate.toDateString();

    let dayTitleHeading = dayName;
    if (isToday) dayTitleHeading = "Today";
    else if (isYesterday) dayTitleHeading = "Yesterday";
    else if (isTomorrow) dayTitleHeading = "Tomorrow";

    // 1. Build Left Side: Interactive Mini Month Calendar
    const year = currentDayDate.getFullYear();
    const month = currentDayDate.getMonth();
    const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthYearTitle = `${monthNamesFull[month]} ${year}`;

    const monthFirstDay = new Date(year, month, 1);
    const monthLastDay = new Date(year, month + 1, 0);
    const totalDaysInMonth = monthLastDay.getDate();

    // Sunday-first order to match Skylight hardware exactly: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    const miniWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const firstDowSun0 = monthFirstDay.getDay(); // 0 is Sunday
    const prevMonthLastDayNum = new Date(year, month, 0).getDate();

    let miniCellsHtml = "";
    const totalMiniCells = (firstDowSun0 + totalDaysInMonth) > 35 ? 42 : 35;
    let dayCountNum = 1;
    let nextMonthDayNum = 1;

    for (let cIdx = 0; cIdx < totalMiniCells; cIdx++) {
      let cellDate;
      let isOtherMonth = false;
      let dNum;

      if (cIdx < firstDowSun0) {
        dNum = prevMonthLastDayNum - firstDowSun0 + cIdx + 1;
        cellDate = new Date(year, month - 1, dNum);
        isOtherMonth = true;
      } else if (dayCountNum <= totalDaysInMonth) {
        dNum = dayCountNum++;
        cellDate = new Date(year, month, dNum);
      } else {
        dNum = nextMonthDayNum++;
        cellDate = new Date(year, month + 1, dNum);
        isOtherMonth = true;
      }

      const isSelectedDay = currentDayDate.toDateString() === cellDate.toDateString();
      const isActualToday = today.toDateString() === cellDate.toDateString();
      const cDateStr = getLocalDateKey(cellDate);

      // Check if this date has events
      const hasEvents = (familyEvents || []).some(e => isEventOnDate(e, cDateStr, weekDays[cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1], cellDate));

      miniCellsHtml += `
        <button type="button" class="mini-calendar-cell ${isOtherMonth ? 'is-other-month' : ''} ${isSelectedDay ? 'is-selected-day' : ''} ${isActualToday ? 'is-actual-today' : ''} ${hasEvents ? 'has-events' : ''}" 
                data-date-str="${cDateStr}" title="${cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}">
          <span class="mini-day-number">${dNum}</span>
          ${hasEvents ? '<span class="mini-event-dot"></span>' : ''}
        </button>
      `;
    }

    // 2. Build Right Side: Day's Full Events List (Ordered All-day first, then chronologically)
    let dayEvents = (familyEvents || []).filter(e => isEventOnDate(e, colDateStr, dayName, currentDayDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }

    // Sort: All Day first, then by time
    dayEvents.sort((a, b) => {
      const aIsAllDay = !a.time || a.time.trim().toLowerCase() === "all day";
      const bIsAllDay = !b.time || b.time.trim().toLowerCase() === "all day";
      if (aIsAllDay && !bIsAllDay) return -1;
      if (!aIsAllDay && bIsAllDay) return 1;
      return getEventMinutes(a) - getEventMinutes(b);
    });

    let eventRowsHtml = "";
    if (dayEvents.length === 0) {
      eventRowsHtml = `
        <div class="skylight-day-empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">No events scheduled for ${dayTitleHeading}</div>
          <div class="empty-sub">Tap the ＋ button at bottom-right or Magic Import above to add an event.</div>
        </div>
      `;
    } else {
      dayEvents.forEach(evt => {
        const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
        let styleAttr = "";
        let borderAccent = "";

        if (membersList.length >= 2) {
          const pal1 = getMemberPalette(membersList[0]);
          const pal2 = getMemberPalette(membersList[1]);
          styleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border-color: ${pal1.border}; color: ${pal1.text};"`;
          borderAccent = pal1.primary;
        } else {
          const pal = getMemberPalette(membersList[0] || "Family");
          styleAttr = `style="background: ${pal.lightBg}; border-color: ${pal.border}; color: ${pal.text};"`;
          borderAccent = pal.primary;
        }

        const memberAvatarsHtml = membersList.map(m => {
          const pal = getMemberPalette(m);
          return `<span class="skylight-day-avatar" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
        }).join("");

        const durationText = evt.duration ? ` (${escapeHtml(evt.duration)})` : "";
        const timeSubtitle = evt.time ? `${escapeHtml(evt.time)}${durationText}` : "All day";

        let repeatBadge = "";
        if (evt.repeat && evt.repeat !== "none") {
          repeatBadge = ` <span title="Repeats: ${escapeHtml(evt.repeat)}">🔁</span>`;
        }

        eventRowsHtml += `
          <div class="skylight-day-event-banner" ${styleAttr} data-event-id="${evt.id}" role="button" tabindex="0" title="Tap to view/edit ${escapeHtml(evt.title)}">
            <div class="day-event-left-info">
              <span class="day-event-banner-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}${repeatBadge}</span>
              <span class="day-event-banner-time">${timeSubtitle}</span>
            </div>
            <div class="day-event-right-avatars">
              ${memberAvatarsHtml}
            </div>
          </div>
        `;
      });
    }

    // Optional Dinner banner for the day
    const dayMeal = getMealForDate(currentDayDate);
    let mealBannerHtml = "";
    if (dayMeal && dayMeal.title) {
      mealBannerHtml = `
        <div class="skylight-day-dinner-banner" data-date="${colDateStr}" data-day="${dayName}" title="Dinner: ${escapeHtml(dayMeal.title)} — Tap to view recipe">
          <span class="day-dinner-icon">${escapeHtml(dayMeal.emoji || '🍽️')}</span>
          <div class="day-dinner-text">
            <span class="day-dinner-label">Tonight's Dinner</span>
            <span class="day-dinner-title">${escapeHtml(dayMeal.title)}</span>
          </div>
        </div>
      `;
    }

    gridContainer.className = "calendar-week-grid view-skylight-day";
    gridContainer.innerHTML = `
      <div class="skylight-split-day-container">
        <!-- Left Column: Mini Month Calendar Grid -->
        <div class="skylight-split-day-left">
          <div class="mini-month-header">
            <h3 class="mini-month-title">${monthYearTitle}</h3>
          </div>
          <div class="mini-month-weekdays-row">
            ${miniWeekdays.map(d => `<span class="mini-weekday-col">${d}</span>`).join("")}
          </div>
          <div class="mini-month-days-grid">
            ${miniCellsHtml}
          </div>
        </div>

        <!-- Right Column: Heading and Full Event Bars -->
        <div class="skylight-split-day-right">
          <div class="skylight-day-heading-row">
            <h2 class="skylight-day-heading">${dayTitleHeading}</h2>
            <div class="skylight-day-date-sub">${dayName}, ${currentDayDate.getDate()} ${monthNamesFull[month]}</div>
          </div>
          ${mealBannerHtml}
          <div class="skylight-day-events-scroll-list">
            ${eventRowsHtml}
          </div>
        </div>
      </div>
    `;

    // Wire clicks on mini-calendar dates to jump to that date instantly
    gridContainer.querySelectorAll(".mini-calendar-cell").forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const dStr = cell.getAttribute("data-date-str");
        if (dStr) {
          const [y, m, d] = dStr.split("-").map(Number);
          const targetD = new Date(y, m - 1, d);
          targetD.setHours(0, 0, 0, 0);
          setCalendarView("day", targetD);
        }
      };
    });

    // Wire dinner click
    const dinBanner = gridContainer.querySelector(".skylight-day-dinner-banner");
    if (dinBanner) {
      dinBanner.onclick = (e) => {
        e.stopPropagation();
        const dStr = dinBanner.getAttribute("data-date");
        if (typeof openPlanMealModalForDate === "function") {
          openPlanMealModalForDate(dStr);
        }
      };
    }

    return;
  }

  // =========================================================================
  // VIEW MODES: SCHEDULE (3-Day) (Continuous Skylight Time-Grid Layout)
  // =========================================================================
  let startDate = new Date(calendarAnchorDate);
  startDate.setHours(0, 0, 0, 0);
  let dayCount = 3;

  // Hourly timeline: 6 AM to 11 PM (6:00 to 23:00) covering early morning drop-offs & late activities
  const startHour = 6;
  const endHour = 23;
  const totalHours = endHour - startHour; // 17 hours
  const hourHeight = scheduleHourHeight; // dynamic pixels per hour (pinch/zoom controllable)
  const topPadding = 14; // padding so 6 AM text label is never cut off
  const totalGridHeight = (totalHours * hourHeight) + topPadding + 14; // full comfortable height

  const now = new Date();
  const currentHourDecimal = now.getHours() + (now.getMinutes() / 60);
  const nowTopPx = topPadding + ((currentHourDecimal - startHour) * hourHeight);
  const showNowLine = currentHourDecimal >= startHour && currentHourDecimal <= endHour;

  // Build Time Gutter labels
  let timeLabelsHtml = "";
  for (let h = startHour; h <= endHour; h++) {
    const period = h >= 12 ? "pm" : "am";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    timeLabelsHtml += `
      <div class="skylight-time-slot-label" style="top: ${topPadding + ((h - startHour) * hourHeight)}px;">
        <span>${displayH} ${period}</span>
      </div>
    `;
  }

  // Pre-calculate day columns data
  const columnsData = [];
  for (let i = 0; i < dayCount; i++) {
    const colDate = new Date(startDate);
    colDate.setDate(startDate.getDate() + i);
    const colDayIdx = colDate.getDay() === 0 ? 6 : colDate.getDay() - 1;
    const dayName = weekDays[colDayIdx];
    const shortName = weekShort[colDayIdx];
    const dayDateNum = colDate.getDate();
    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][colDate.getMonth()];
    const isToday = today.toDateString() === colDate.toDateString();
    const colDateStr = getLocalDateKey(colDate);

    let dayEvents = familyEvents.filter(e => isEventOnDate(e, colDateStr, dayName, colDate));
    if (activeCalendarMemberFilters !== null) {
      dayEvents = dayEvents.filter(e => isMemberSelected(e.member));
    }
    dayEvents.sort((a, b) => getEventMinutes(a) - getEventMinutes(b));

    const allDayEvents = [];
    const timedEvents = [];
    dayEvents.forEach(evt => {
      const t = (evt.time || "").trim().toLowerCase();
      if (!t || t === "all day") {
        allDayEvents.push(evt);
      } else {
        timedEvents.push(evt);
      }
    });

    const colMeal = getMealForDate(colDate);

    columnsData.push({
      colDate,
      colDateStr,
      dayName,
      shortName,
      dayDateNum,
      monthShort,
      isToday,
      allDayEvents,
      timedEvents,
      colMeal
    });
  }

  // Generate HTML for Skylight continuous layout with dividing lines
  let colHeadersHtml = "";
  let allDayBannersHtml = "";
  let dayColumnsHtml = "";

  const chevronLeftSvg = '<svg class="icon-chevron-wide" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  const chevronRightSvg = '<svg class="icon-chevron-wide" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  columnsData.forEach((col, idx) => {
    // Header
    const prevArrow = (idx === 0) ? `<button type="button" class="col-nav-arrow col-nav-prev" title="Previous" aria-label="Previous">${chevronLeftSvg}</button>` : '';
    const nextArrow = (idx === dayCount - 1) ? `<button type="button" class="col-nav-arrow col-nav-next" title="Next" aria-label="Next">${chevronRightSvg}</button>` : '';

    colHeadersHtml += `
      <div class="skylight-grid-day-header ${col.isToday ? 'is-today-header' : ''}" data-date="${col.colDateStr}">
        <div class="day-header-main-row">
          ${prevArrow}
          <span class="grid-header-dayname">${col.shortName}</span>
          <span class="grid-header-daynum ${col.isToday ? 'today-badge-circle' : ''}">${col.dayDateNum}</span>
          <span class="grid-header-month">${col.monthShort}</span>
        </div>
        ${nextArrow ? `<div class="day-header-nav-right">${nextArrow}</div>` : ''}
      </div>
    `;

    // Top All-day / Dinner banner slot
    let bannerItemsHtml = "";
    if (col.colMeal && col.colMeal.title) {
      bannerItemsHtml += `
        <div class="skylight-box-meal is-planned" data-date="${col.colDateStr}" data-day="${col.dayName}" title="Dinner: ${escapeHtml(col.colMeal.title)} — Tap to view recipe">
          <span class="box-meal-icon">${escapeHtml(col.colMeal.emoji || '🍽️')}</span>
          <span class="box-meal-title">${escapeHtml(col.colMeal.title)}</span>
        </div>
      `;
    }
    col.allDayEvents.forEach(evt => {
      bannerItemsHtml += renderSkylightEventCard(evt);
    });

    allDayBannersHtml += `
      <div class="skylight-allday-col ${col.isToday ? 'is-today-col' : ''}">
        ${bannerItemsHtml}
      </div>
    `;

    // Timed Events in the hourly track
    let timedBlocksHtml = "";
    col.timedEvents.forEach(evt => {
      const minutes = getEventMinutes(evt);
      const startMinFromGutter = minutes - (startHour * 60);
      const topPx = topPadding + Math.max(0, (startMinFromGutter / 60) * hourHeight);

      // Duration: parse duration or default 60 mins
      let durMinutes = 60;
      if (evt.duration) {
        const dm = evt.duration.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hr|min|m)/i);
        if (dm) {
          const val = parseFloat(dm[1]);
          if (/min|m/i.test(evt.duration) && !/h/i.test(evt.duration)) {
            durMinutes = val;
          } else {
            durMinutes = val * 60;
          }
        }
      }
      const heightPx = Math.max(38, Math.min((durMinutes / 60) * hourHeight, totalGridHeight - topPx));

      // Member color palette
      const membersList = (evt.member || "Family").split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
      let inlineStyleAttr = "";
      if (membersList.length >= 2) {
        const pal1 = getMemberPalette(membersList[0]);
        const pal2 = getMemberPalette(membersList[1]);
        inlineStyleAttr = `style="background: linear-gradient(135deg, ${pal1.lightBg} 0%, ${pal1.lightBg} 48%, ${pal2.lightBg} 52%, ${pal2.lightBg} 100%); border: 1.5px solid ${pal1.border}; color: ${pal1.text}; top: ${topPx}px; height: ${heightPx}px;"`;
      } else {
        const pal = getMemberPalette(membersList[0] || "Family");
        inlineStyleAttr = `style="background: ${pal.lightBg}; border: 1.5px solid ${pal.border}; color: ${pal.text}; top: ${topPx}px; height: ${heightPx}px;"`;
      }

      const memberAvatarsHtml = membersList.map(m => {
        const pal = getMemberPalette(m);
        const isMini = membersList.length > 1;
        return `<span class="skylight-avatar ${isMini ? 'avatar-mini' : ''}" style="background: ${pal.primary}; color: #ffffff;" title="${escapeHtml(m)}">${escapeHtml(m.charAt(0).toUpperCase())}</span>`;
      }).join("");

      timedBlocksHtml += `
        <div class="skylight-timed-event-block skylight-card" ${inlineStyleAttr} data-event-id="${evt.id}" title="Tap to view/edit ${escapeHtml(evt.title)}">
          <div class="skylight-card-main">
            <div class="skylight-card-title-row">
              <span class="skylight-card-title">${escapeHtml(evt.icon || "📅")} ${escapeHtml(evt.title)}</span>
            </div>
            <span class="skylight-card-sub">${escapeHtml(evt.time || "")}${evt.duration ? ` (${escapeHtml(evt.duration)})` : ""}</span>
          </div>
          <div class="skylight-card-avatar-wrap">
            ${memberAvatarsHtml}
          </div>
        </div>
      `;
    });

    // Current time indicator line if today
    let todayLineHtml = "";
    if (col.isToday && showNowLine) {
      todayLineHtml = `
        <div class="skylight-current-time-line" style="top: ${nowTopPx}px;">
          <span class="current-time-dot"></span>
        </div>
      `;
    }

    // Horizontal hour grid lines inside column
    let hourLinesHtml = "";
    for (let h = 0; h < totalHours; h++) {
      hourLinesHtml += `<div class="skylight-hour-grid-line" style="top: ${topPadding + (h * hourHeight)}px;"></div>`;
    }

    dayColumnsHtml += `
      <div class="skylight-time-col ${col.isToday ? 'is-today-col' : ''}" data-date="${col.colDateStr}" data-day="${col.dayName}">
        ${hourLinesHtml}
        ${todayLineHtml}
        ${timedBlocksHtml}
      </div>
    `;
  });

  gridContainer.className = `skylight-trad-calendar-grid days-${dayCount}`;
  gridContainer.innerHTML = `
    <div class="skylight-schedule-scroll-container" id="skylight-schedule-scroll-container">
      <div class="skylight-schedule-scroll-inner">
        <!-- Fixed Header Row with Day Names & Dates -->
        <div class="skylight-trad-header-row">
          <div class="skylight-gutter-corner"></div>
          <div class="skylight-days-header-track">
            ${colHeadersHtml}
          </div>
        </div>

        <!-- All-Day Banners / Dinners Row -->
        <div class="skylight-trad-allday-row">
          <div class="skylight-gutter-allday-label">all-day</div>
          <div class="skylight-allday-track">
            ${allDayBannersHtml}
          </div>
        </div>

        <!-- Scrollable Hourly Time Grid -->
        <div class="skylight-trad-body-row" id="skylight-trad-body-scroll">
          <!-- Left Time Gutter with 12pm, 1pm, 2pm... -->
          <div class="skylight-trad-time-gutter" style="height: ${totalGridHeight}px;">
            ${timeLabelsHtml}
          </div>

          <!-- Day Columns with vertical dividing lines -->
          <div class="skylight-trad-columns-track" style="height: ${totalGridHeight}px;">
            ${dayColumnsHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  // Auto-scroll into near current hour on load
  const bodyScroll = document.getElementById("skylight-trad-body-scroll");
  if (bodyScroll && showNowLine) {
    bodyScroll.scrollTop = Math.max(0, nowTopPx - 100);
  }

  // Wire day column navigation arrows (shifts by 1 day for smooth browsing)
  gridContainer.querySelectorAll(".col-nav-prev").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      navigateCalendar(-1, 1);
    };
  });
  gridContainer.querySelectorAll(".col-nav-next").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      navigateCalendar(1, 1);
    };
  });

  // ========================================================================
  // SKYLIGHT SMOOTH HORIZONTAL SWIPE, DRAG & PINCH-TO-ZOOM
  // ========================================================================
  const attachSkylightCalendarGestures = () => {
    const wrap = gridContainer.querySelector(".skylight-schedule-scroll-inner, .skylight-trad-grid-wrap");
    const bodyScrollEl = document.getElementById("skylight-trad-body-scroll");
    if (!wrap) return;

    // --- 1. Pinch-to-Zoom Time Scale (Zoom between ~4 hours and ~8 hours visible) ---
    let initialPinchDistance = null;
    let initialHourHeight = scheduleHourHeight;

    const getPinchDistance = (touches) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // --- 2. Smooth 1:1 Horizontal Drag / Swipe Navigation ---
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let isHorizontalGesture = false;
    let isVerticalGesture = false;
    let isTracking = false;
    let isPinching = false;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Pinch zoom detected
        isPinching = true;
        isTracking = false;
        isHorizontalGesture = false;
        initialPinchDistance = getPinchDistance(e.touches);
        initialHourHeight = scheduleHourHeight;
        wrap.style.transform = "";
        return;
      }

      if (e.touches.length !== 1) return;
      isPinching = false;

      // Don't intercept button or card clicks
      if (e.target.closest("button, .skylight-card, .skylight-box-meal")) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      deltaX = 0;
      isHorizontalGesture = false;
      isVerticalGesture = false;
      isTracking = true;
    };

    const onTouchMove = (e) => {
      // Handle Pinch Zoom
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getPinchDistance(e.touches);
        if (initialPinchDistance > 0) {
          const scale = dist / initialPinchDistance;
          // Clamp hourHeight between 38px (zoomed out: ~7-8 hrs visible) and 90px (zoomed in: ~3.5-4 hrs visible)
          const newHeight = Math.round(Math.max(38, Math.min(90, initialHourHeight * scale)));
          if (Math.abs(newHeight - scheduleHourHeight) >= 2) {
            scheduleHourHeight = newHeight;
            try { localStorage.setItem("chore_schedule_hour_height", String(scheduleHourHeight)); } catch (err) {}
            renderWeekCalendar();
          }
        }
        return;
      }

      if (!isTracking || e.touches.length !== 1 || isVerticalGesture) return;
      const t = e.touches[0];
      const diffX = t.clientX - startX;
      const diffY = t.clientY - startY;

      if (!isHorizontalGesture && !isVerticalGesture) {
        if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
          if (Math.abs(diffX) > Math.abs(diffY) * 1.1) {
            isHorizontalGesture = true;
          } else {
            isVerticalGesture = true;
            isTracking = false;
            return;
          }
        }
      }

      if (isHorizontalGesture) {
        // Prevent accidental vertical jump while dragging horizontally
        if (e.cancelable) e.preventDefault();
        deltaX = diffX;
        wrap.style.transform = `translateX(${deltaX}px)`;
        wrap.style.transition = "none";
      }
    };

    const onTouchEnd = (e) => {
      if (isPinching) {
        if (e.touches.length < 2) isPinching = false;
        return;
      }

      if (!isTracking) return;
      isTracking = false;

      if (isHorizontalGesture) {
        const threshold = 65; // pixels to trigger day shift
        if (Math.abs(deltaX) > threshold) {
          const shiftDirection = deltaX < 0 ? 1 : -1;
          const exitX = shiftDirection === 1 ? -window.innerWidth * 0.4 : window.innerWidth * 0.4;
          wrap.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.25, 1)";
          wrap.style.transform = `translateX(${exitX}px)`;
          setTimeout(() => {
            navigateCalendar(shiftDirection, 1);
          }, 180);
          return;
        }
      }

      // Snap back if threshold not met
      wrap.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
      wrap.style.transform = "translateX(0px)";
      setTimeout(() => {
        if (wrap) wrap.style.transform = "";
      }, 230);
    };

    wrap.addEventListener("touchstart", onTouchStart, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd, { passive: true });
    wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // --- 3. Desktop / Trackpad Wheel Zoom (Ctrl/Cmd + wheel) ---
    if (bodyScrollEl) {
      bodyScrollEl.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.94 : 1.06;
          const newH = Math.round(Math.max(38, Math.min(90, scheduleHourHeight * factor)));
          if (newH !== scheduleHourHeight) {
            scheduleHourHeight = newH;
            try { localStorage.setItem("chore_schedule_hour_height", String(scheduleHourHeight)); } catch (err) {}
            renderWeekCalendar();
          }
        }
      }, { passive: false });
    }

    // --- 4. Desktop Mouse Drag Support ---
    let mouseStartX = 0;
    let isMouseDown = false;
    let mouseDeltaX = 0;

    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, .skylight-card, .skylight-box-meal, input, select")) return;
      isMouseDown = true;
      mouseStartX = e.clientX;
      mouseDeltaX = 0;
      wrap.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      mouseDeltaX = e.clientX - mouseStartX;
      if (Math.abs(mouseDeltaX) > 8) {
        wrap.style.transform = `translateX(${mouseDeltaX}px)`;
        wrap.style.transition = "none";
      }
    });

    window.addEventListener("mouseup", () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      wrap.style.cursor = "";

      if (Math.abs(mouseDeltaX) > 65) {
        const shiftDir = mouseDeltaX < 0 ? 1 : -1;
        const exitX = shiftDir === 1 ? -window.innerWidth * 0.4 : window.innerWidth * 0.4;
        wrap.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.25, 1)";
        wrap.style.transform = `translateX(${exitX}px)`;
        setTimeout(() => {
          navigateCalendar(shiftDir, 1);
        }, 180);
      } else {
        wrap.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
        wrap.style.transform = "translateX(0px)";
        setTimeout(() => {
          if (wrap) wrap.style.transform = "";
        }, 230);
      }
    });
  };

  attachSkylightCalendarGestures();

  // ========================================================================
  // DRAG & DROP FOR CHORES (Moving chores between days)
  // ========================================================================
  const dayCols = gridContainer.querySelectorAll(".calendar-day-col");

  // Helper: Move chore to a new day
  const moveChoreToDay = async (taskId, targetDay) => {
    if (!taskId || !targetDay) return;
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.day === "Daily" || task.taskType === "Daily Task") {
      showCalendarToast("Daily chores repeat every day and cannot be moved");
      return;
    }

    if (task.day === targetDay && (!task.done || task.completedDay === targetDay)) {
      return;
    }

    task.day = targetDay;
    if (task.done) {
      task.completedDay = targetDay;
    }

    saveLocalCache(currentTasks);
    if (db) {
      try {
        const docRef = getTaskDocRef(taskId);
        await updateDoc(docRef, {
          day: targetDay,
          ...(task.done ? { completedDay: targetDay } : {})
        });
      } catch (err) {
        console.warn("Firestore update failed, saved locally:", err);
      }
    }

    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    renderWeekCalendar();
    renderApp();
    showCalendarToast(`Moved "${task.title}" to ${targetDay}`);
  };

  // 1. Desktop HTML5 Drag and Drop
  gridContainer.querySelectorAll(".calendar-card.is-draggable").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      const taskId = card.getAttribute("data-task-id");
      e.dataTransfer.setData("text/plain", taskId);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("is-dragging");
      gridContainer.classList.add("is-drag-active");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      gridContainer.classList.remove("is-drag-active");
      dayCols.forEach(col => col.classList.remove("drag-over"));
    });
  });

  dayCols.forEach(col => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!col.classList.contains("drag-over")) {
        dayCols.forEach(c => c.classList.remove("drag-over"));
        col.classList.add("drag-over");
      }
    });

    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove("drag-over");
      }
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      gridContainer.classList.remove("is-drag-active");
      const taskId = e.dataTransfer.getData("text/plain");
      const targetDay = col.getAttribute("data-day");
      if (taskId && targetDay) {
        moveChoreToDay(taskId, targetDay);
      }
    });
  });

  // 2. Touch Drag & Drop for Touchscreens & Tablets
  let touchDragItem = null;
  let touchDragGhost = null;
  let touchTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isTouchDragging = false;

  gridContainer.querySelectorAll(".calendar-card.is-draggable").forEach(card => {
    card.addEventListener("touchstart", (e) => {
      // Don't drag if clicking directly on the check button
      if (e.target.closest(".calendar-card-check")) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDragItem = card;
      isTouchDragging = false;

      // Long-press threshold (180ms) so immediate taps still work
      touchTimer = setTimeout(() => {
        isTouchDragging = true;
        card.classList.add("is-dragging");
        gridContainer.classList.add("is-drag-active");

        // Create floating ghost
        touchDragGhost = card.cloneNode(true);
        touchDragGhost.classList.add("touch-drag-ghost");
        touchDragGhost.style.width = `${card.offsetWidth}px`;
        touchDragGhost.style.left = `${touch.clientX - card.offsetWidth / 2}px`;
        touchDragGhost.style.top = `${touch.clientY - 24}px`;
        document.body.appendChild(touchDragGhost);

        if (navigator.vibrate) navigator.vibrate(25);
      }, 180);
    }, { passive: true });

    card.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
      if (!isTouchDragging && dist > 10) {
        clearTimeout(touchTimer);
        return;
      }

      if (isTouchDragging) {
        e.preventDefault(); // Prevent page scroll while dragging card
        if (touchDragGhost) {
          touchDragGhost.style.left = `${touch.clientX - touchDragGhost.offsetWidth / 2}px`;
          touchDragGhost.style.top = `${touch.clientY - 24}px`;
        }

        // Highlight column under touch point
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const colUnder = elUnder ? elUnder.closest(".calendar-day-col") : null;
        dayCols.forEach(c => {
          if (c === colUnder) c.classList.add("drag-over");
          else c.classList.remove("drag-over");
        });
      }
    }, { passive: false });

    card.addEventListener("touchend", (e) => {
      clearTimeout(touchTimer);
      if (isTouchDragging && touchDragItem) {
        const touch = e.changedTouches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const colUnder = elUnder ? elUnder.closest(".calendar-day-col") : null;
        const targetDay = colUnder ? colUnder.getAttribute("data-day") : null;
        const taskId = touchDragItem.getAttribute("data-task-id");

        if (touchDragGhost && touchDragGhost.parentNode) {
          touchDragGhost.parentNode.removeChild(touchDragGhost);
        }
        touchDragGhost = null;
        touchDragItem.classList.remove("is-dragging");
        gridContainer.classList.remove("is-drag-active");
        dayCols.forEach(c => c.classList.remove("drag-over"));

        if (taskId && targetDay) {
          moveChoreToDay(taskId, targetDay);
        }
      }
      isTouchDragging = false;
      touchDragItem = null;
    });

    card.addEventListener("touchcancel", () => {
      clearTimeout(touchTimer);
      if (touchDragGhost && touchDragGhost.parentNode) {
        touchDragGhost.parentNode.removeChild(touchDragGhost);
      }
      touchDragGhost = null;
      if (touchDragItem) touchDragItem.classList.remove("is-dragging");
      gridContainer.classList.remove("is-drag-active");
      dayCols.forEach(c => c.classList.remove("drag-over"));
      isTouchDragging = false;
      touchDragItem = null;
    });
  });
}

// ============================================================================
// 15. REWARDS PODIUM VIEW
// ============================================================================
function renderPodiumRewards() {
  const stage = document.getElementById("podium-stage");
  const grid = document.getElementById("rewards-members-grid");
  const modeBadge = document.getElementById("rewards-mode-badge");
  const weekLabel = document.getElementById("rewards-week-label");
  if (!stage || !grid) return;

  const isMoney = boardSettings.gameMode === "money";
  const currency = boardSettings.currency || "£";
  const activeWeekKey = getIsoWeekKey();

  if (modeBadge) modeBadge.textContent = isMoney ? `Pocket Money (${currency})` : "Points Mode";
  if (weekLabel) weekLabel.textContent = `${getWeekCommencingLabel(false)} • Live Household Standings`;

  const memberData = {};
  familyMembers.forEach(m => {
    memberData[m] = { score: 0, tasks: [] };
  });

  function awardMemberTask(completer, rewardVal, taskTitle) {
    if (!completer) return;
    if (completer === "Team Effort") {
      familyMembers.forEach(m => {
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    } else if (Array.isArray(completer)) {
      completer.forEach(raw => {
        const m = normalizeFamilyMemberName(raw);
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    } else if (typeof completer === "string") {
      completer.split(",").map(s => normalizeFamilyMemberName(s.trim())).forEach(m => {
        if (memberData[m]) {
          memberData[m].score += rewardVal;
          memberData[m].tasks.push(taskTitle);
        }
      });
    }
  }

  currentTasks.forEach(task => {
    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    const rewardVal = typeof task.rewardValue === "number" && task.rewardValue > 0 
      ? task.rewardValue 
      : (isMoney ? 1.00 : (task.points || 1));

    if (isDaily && task.completedDays && Object.keys(task.completedDays).length > 0) {
      Object.entries(task.completedDays).forEach(([dayName, dayRecord]) => {
        if (!dayRecord) return;
        const completer = typeof dayRecord === "object" ? dayRecord.completedBy : dayRecord;
        const compWeek = typeof dayRecord === "object" ? dayRecord.completedWeek : null;
        if (completer && (!compWeek || compWeek === activeWeekKey)) {
          awardMemberTask(completer, rewardVal, `${task.title} (${dayName})`);
        }
      });
    } else if (task.done && task.completedBy && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      awardMemberTask(task.completedBy, rewardVal, task.title);
    }
  });

  const sortedMembers = familyMembers.map((name, idx) => ({
    name,
    color: getMemberColor(idx),
    score: memberData[name] ? memberData[name].score : 0,
    tasks: memberData[name] ? memberData[name].tasks : []
  })).sort((a, b) => b.score - a.score);

  const formatScore = (val) => isMoney ? `${currency}${val.toFixed(2)}` : `${val} pt${val === 1 ? "" : "s"}`;

  const maxScore = sortedMembers.length > 0 ? Math.max(...sortedMembers.map(m => m.score)) : 0;
  const minBarHeight = 65; // base pillar height so 0 pts has a visible, clean platform
  const maxBarHeight = 210; // tallest pillar height

  stage.innerHTML = sortedMembers.map((m, rankIdx) => {
    const isLeader = maxScore > 0 && m.score === maxScore;
    const nameLower = m.name.toLowerCase();

    let pastelClass = "pillar-pastel-default";
    if (isLeader) {
      pastelClass = "pillar-pastel-leader";
    } else if (nameLower.includes("sorcha")) {
      pastelClass = "pillar-pastel-purple";
    } else if (nameLower.includes("ava")) {
      pastelClass = "pillar-pastel-lavender";
    } else if (nameLower.includes("dara")) {
      pastelClass = "pillar-pastel-mint";
    } else if (nameLower.includes("steven")) {
      pastelClass = "pillar-pastel-sky";
    } else {
      const fallbackPastels = [
        "pillar-pastel-sky", 
        "pillar-pastel-purple", 
        "pillar-pastel-lavender", 
        "pillar-pastel-mint"
      ];
      pastelClass = fallbackPastels[rankIdx % fallbackPastels.length];
    }

    let pillarHeight = minBarHeight;
    if (maxScore > 0) {
      pillarHeight = Math.round(minBarHeight + (m.score / maxScore) * (maxBarHeight - minBarHeight));
    }

    const crownHtml = isLeader ? `<span class="podium-crown">👑</span>` : "";

    return `
      <div class="podium-col ${pastelClass} ${isLeader ? "is-leader" : ""}" data-member="${escapeHtml(m.name)}">
        <div class="podium-avatar-wrap">
          ${crownHtml}
          <div class="podium-avatar" style="background: ${m.color.bg}; border: 2.5px solid ${m.color.border};">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
        </div>
        <div class="podium-name">${escapeHtml(m.name)}</div>
        <div class="podium-pillar" style="height: ${pillarHeight}px;">
          <span class="podium-bar-score">${formatScore(m.score)}</span>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = sortedMembers.map((m, rankIdx) => {
    const rankBadge = rankIdx === 0 ? "👑 Leader" : (rankIdx === 1 ? "🥈 2nd" : (rankIdx === 2 ? "🥉 3rd" : `#${rankIdx + 1}`));
    const tasksCount = m.tasks.length;
    const taskListHtml = tasksCount > 0
      ? `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 0.82rem; line-height: 1.5;">${m.tasks.map(t => `<li style="margin-bottom: 2px;">✓ ${escapeHtml(t)}</li>`).join("")}</ul>`
      : `<span class="rewards-empty-note">No completed chores recorded this week yet.</span>`;

    return `
      <div class="rewards-member-card">
        <div class="rewards-card-top">
          <div class="rewards-card-person">
            <div class="rewards-card-avatar" style="background: ${m.color.bg}; border: 2px solid ${m.color.border};">
              ${escapeHtml(m.name.charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="rewards-card-name">${escapeHtml(m.name)} <span style="font-size: 0.75rem; font-weight: 700; opacity: 0.8;">(${rankBadge})</span></div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${tasksCount} chore${tasksCount === 1 ? "" : "s"} completed</div>
            </div>
          </div>
          <div class="rewards-card-score">${formatScore(m.score)}</div>
        </div>
        <div class="rewards-card-tasklist">
          <strong style="font-size: 0.82rem; color: var(--text-heading);">This Week Completed Chores:</strong>
          ${taskListHtml}
        </div>
      </div>
    `;
  }).join("");

  const confettiBtn = document.getElementById("btn-podium-confetti");
  if (confettiBtn && !confettiBtn.hasAttribute("data-wired")) {
    confettiBtn.setAttribute("data-wired", "true");
    confettiBtn.addEventListener("click", () => {
      if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    });
  }

  // Render Household Habit Streaks Showcase
  const streaksGrid = document.getElementById("rewards-streaks-grid");
  if (streaksGrid) {
    const streakTasks = currentTasks
      .filter(t => (t.streak && t.streak >= 2) || (t.repeat === "daily" || t.day === "Daily"))
      .sort((a, b) => (b.streak || 0) - (a.streak || 0));

    if (streakTasks.length === 0 || !streakTasks.some(t => t.streak && t.streak >= 1)) {
      streaksGrid.innerHTML = `
        <div class="streak-card-item" style="grid-column: 1 / -1; justify-content: center; text-align: center; color: var(--text-secondary); font-size: 0.88rem; padding: 18px;">
          <span>🔥 Complete daily routines consecutively (e.g. Feed cats, Empty Dishwasher) to build family habit streaks!</span>
        </div>
      `;
    } else {
      streaksGrid.innerHTML = streakTasks.slice(0, 6).map(t => {
        const streakCount = t.streak || 1;
        const assignedName = t.assignedTo || "Anyone";
        const initial = assignedName.charAt(0).toUpperCase();
        return `
          <div class="streak-card-item">
            <div class="streak-item-left">
              <div class="streak-member-avatar">${escapeHtml(initial)}</div>
              <div>
                <div class="streak-item-title">${escapeHtml(t.title)}</div>
                <div class="streak-item-sub">${escapeHtml(assignedName)} • Daily Routine</div>
              </div>
            </div>
            <div class="streak-count-badge ${streakCount >= 7 ? 'milestone' : ''}">
              <span>🔥</span>
              <span>${streakCount}d</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}
window.renderPodiumRewards = renderPodiumRewards;


// ============================================================================
// 16. FAMILY MEALS & DINNER PLANNER (Step 3)
// ============================================================================

function renderChefAvatarsHtml(cookStr) {
  if (!cookStr) return "";
  const chefs = cookStr.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  if (chefs.length === 0) return "";

  const avatars = chefs.map(name => {
    const nameLower = name.toLowerCase();
    if (nameLower === "family" || nameLower === "team" || nameLower === "team effort") {
      return `<div class="avatar-ring" style="background: linear-gradient(135deg, #f59e0b, #ec4899); border: 2px solid #fbbf24;" title="Team / Family">👥</div>`;
    }
    const normalized = normalizeFamilyMemberName(name);
    const mIdx = familyMembers.findIndex(m => m.toLowerCase() === normalized.toLowerCase());
    const col = getMemberColor(mIdx !== -1 ? mIdx : 0);
    const initial = name.charAt(0).toUpperCase();
    return `<div class="avatar-ring" style="background: ${col.bg}; border: 2px solid ${col.border};" title="Chef: ${escapeHtml(name)}">${escapeHtml(initial)}</div>`;
  }).join("");

  return `<div class="meal-chef-avatars-wrap" title="Chefs: ${escapeHtml(cookStr)}">${avatars}</div>`;
}
window.renderChefAvatarsHtml = renderChefAvatarsHtml;

function getTonightDinnerChoreInfo() {
  const activeWeekKey = getIsoWeekKey();
  const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = dayNamesFull[new Date().getDay()] || "Tuesday";

  // 1. Task specifically matching today
  let task = currentTasks.find(t => 
    t.title && /dinner|meal/i.test(t.title) &&
    (t.day === todayDayName || t.completedDay === todayDayName)
  );

  // 2. Daily dinner task
  if (!task) {
    task = currentTasks.find(t => 
      t.title && /dinner|meal/i.test(t.title) &&
      (t.day === "Daily" || t.taskType === "Daily Task")
    );
  }

  // 3. Fallback to uncompleted dinner task
  if (!task) {
    task = currentTasks.find(t => t.title && /dinner|meal/i.test(t.title) && !t.done);
  }

  // 4. Any dinner task
  if (!task) {
    task = currentTasks.find(t => t.title && /dinner|meal/i.test(t.title));
  }

  let isDone = false;
  let completer = "";
  const isMoney = boardSettings.gameMode === "money";
  let rewardVal = (task && typeof task.rewardValue === "number" && task.rewardValue > 0)
    ? task.rewardValue
    : (isMoney ? 1.00 : (task && typeof task.points === "number" && task.points > 0 ? task.points : 3));

  if (task) {
    const isDaily = task.day === "Daily" || task.taskType === "Daily Task";
    if (isDaily && task.completedDays && task.completedDays[todayDayName]) {
      const rec = task.completedDays[todayDayName];
      const compWeek = typeof rec === "object" && rec !== null ? rec.completedWeek : null;
      if (!compWeek || compWeek === activeWeekKey) {
        isDone = true;
        completer = normalizeFamilyMemberName(typeof rec === "object" && rec !== null ? rec.completedBy : rec);
      }
    } else if (!isDaily && task.done && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      if (!task.completedDay || task.completedDay === todayDayName) {
        isDone = true;
        completer = normalizeFamilyMemberName(task.completedBy);
      }
    }
  }

  return { task, isDone, completer, rewardVal, todayDayName, activeWeekKey };
}
window.getTonightDinnerChoreInfo = getTonightDinnerChoreInfo;

function completeDinnerChoreForSteve() {
  const info = getTonightDinnerChoreInfo();
  if (info.isDone) {
    if (typeof showCalendarToast === "function") {
      showCalendarToast(`Tonight's dinner has already been made by ${info.completer}!`);
    }
    return;
  }

  const activeWeekKey = info.activeWeekKey;
  const todayDayName = info.todayDayName;
  const dinnerTask = info.task;
  const rewardVal = info.rewardVal;

  if (!dinnerTask) {
    console.warn("No dinner task found to complete");
    return;
  }

  const currentMeals = weeklyMeals || loadWeeklyMeals();
  const tonightMeal = (currentMeals && currentMeals[todayDayName]) || {};
  const rawCook = tonightMeal.cook || "Steven";
  const cookName = normalizeFamilyMemberName(rawCook.split(/&|,|\band\b|\+/i)[0].trim()) || "Steven";

  const isDaily = dinnerTask.day === "Daily" || dinnerTask.taskType === "Daily Task";
  const timestamp = new Date().toISOString();

  if (isDaily) {
    if (!dinnerTask.completedDays) dinnerTask.completedDays = {};
    dinnerTask.completedDays[todayDayName] = {
      completedBy: cookName,
      completedWeek: activeWeekKey,
      completedAt: timestamp
    };
    if (todayDayName === getTodayDayName()) {
      dinnerTask.done = true;
      dinnerTask.completedBy = cookName;
      dinnerTask.completedAt = timestamp;
      dinnerTask.completedWeek = activeWeekKey;
    }
  } else {
    dinnerTask.done = true;
    dinnerTask.completedBy = cookName;
    dinnerTask.completedDay = todayDayName;
    dinnerTask.day = todayDayName;
    dinnerTask.completedWeek = activeWeekKey;
    dinnerTask.completedAt = timestamp;
  }

  if (db) {
    const docRef = getTaskDocRef(dinnerTask.id);
    const updatePayload = isDaily 
      ? { completedDays: dinnerTask.completedDays, ...(todayDayName === getTodayDayName() ? { done: true, completedBy: cookName, completedWeek: activeWeekKey } : {}) }
      : { done: true, completedBy: cookName, completedDay: todayDayName, completedWeek: activeWeekKey, completedAt: serverTimestamp() };
    updateDoc(docRef, updatePayload).catch(console.error);
  }
  saveLocalCache(currentTasks);
  renderApp();

  // Close cooking/popover modals if open
  closeCookingRecipeModal();
  closeMealDetailsPopover();

  // Audio & Confetti burst
  if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  // Gamified celebration popup
  if (typeof showGamifiedCelebration === "function") {
    showGamifiedCelebration({
      claimValue: cookName,
      rewardVal: rewardVal,
      isMoney: boardSettings.gameMode === "money",
      currency: boardSettings.currency || "£",
      taskTitle: `Make the Family Dinner (${tonightMeal.title || "Tonight's Special"})`
    });
  }
}
window.completeDinnerChoreForSteve = completeDinnerChoreForSteve;

// ============================================================================
// SKYLIGHT 4-TIER MEALS & RECIPE PLANNER IMPLEMENTATION
// 7-Day Matrix x 4 Tiers (Breakfast, Lunch, Dinner, Snack)
// Slide-Over "Plan Meal" Drawer + Meal Details Popover (Photos 1 & 2)
// Family Grocery List Sync + Interactive Kitchen Cooking Mode
// ============================================================================

let mealsWeekOffset = 0;
let currentPlanningDateStr = null;
let currentPlanningSlot = "dinner";
let currentDrawerTab = "recipes"; // 'recipes' | 'new-entry'
let currentDrawerCategory = "dinner"; // 'breakfast' | 'lunch' | 'dinner' | 'snack'
let currentDrawerTag = "all";

// Grocery List Storage & Helpers
function loadFamilyGroceryList() {
  if (familyGroceryList) return familyGroceryList;
  try {
    const raw = localStorage.getItem("turnbull_grocery_list_v2");
    if (raw) {
      familyGroceryList = JSON.parse(raw);
      return familyGroceryList;
    }
  } catch(e) {}

  familyGroceryList = [
    { id: "g-1", text: "Spinach & Ricotta Tortelloni (500g)", checked: false, source: "Easy Peasy Tortelloni" },
    { id: "g-2", text: "Green Basil Pesto (190g)", checked: false, source: "Easy Peasy Tortelloni" },
    { id: "g-3", text: "Crème Fraîche (150g)", checked: false, source: "Easy Peasy Tortelloni" },
    { id: "g-4", text: "Frozen Garden Peas (150g)", checked: true, source: "Easy Peasy Tortelloni" },
    { id: "g-5", text: "Italian Sausage (1/2 lb)", checked: false, source: "Skillet Lasagna" },
    { id: "g-6", text: "Fresh Mozzarella (250g)", checked: false, source: "Skillet Lasagna" }
  ];
  saveFamilyGroceryList(familyGroceryList);
  return familyGroceryList;
}

function saveFamilyGroceryList(items) {
  familyGroceryList = items;
  try {
    localStorage.setItem("turnbull_grocery_list_v2", JSON.stringify(items));
    if (familyLists && Array.isArray(familyLists)) {
      const groc = familyLists.find(l => l.id === "groceries");
      if (groc) {
        groc.items = items;
        localStorage.setItem("turnbull_family_lists", JSON.stringify(familyLists));
      }
    }
  } catch(e) {}
  if (db && typeof setDoc === "function") {
    try {
      const payload = {
        groceryList: items,
        updatedAt: serverTimestamp()
      };
      if (familyLists && Array.isArray(familyLists)) {
        payload.familyLists = familyLists;
      }
      setDoc(doc(db, "boards", currentBoardId), payload, { merge: true }).catch(() => {});
    } catch(e) {}
  }
  updateGroceryBadgeCount();
}

function updateGroceryBadgeCount() {
  const badge = document.getElementById("grocery-list-count-badge");
  if (!badge) return;
  const list = familyGroceryList || loadFamilyGroceryList();
  const unbought = list.filter(i => !i.checked).length;
  badge.textContent = unbought;
}

function addIngredientsToGroceryList(ingredients, sourceTitle = "") {
  if (!ingredients || !ingredients.length) return 0;
  const list = familyGroceryList || loadFamilyGroceryList();
  let addedCount = 0;
  ingredients.forEach(item => {
    const cleanText = item.replace(/^-\s*/, '').trim();
    if (!cleanText) return;
    const exists = list.some(g => g.text.toLowerCase() === cleanText.toLowerCase());
    if (!exists) {
      list.push({
        id: "g-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        text: cleanText,
        checked: false,
        source: sourceTitle || "Recipe",
        addedAt: new Date().toISOString()
      });
      addedCount++;
    }
  });
  saveFamilyGroceryList(list);
  return addedCount;
}

// Returns array of 7 dates for the week (starting on Monday: Mon to Sun)
function getMealsWeekDates(offsetWeeks = 0) {
  const now = new Date();
  const base = new Date(now);
  base.setDate(base.getDate() + (offsetWeeks * 7));
  const dow = base.getDay(); // 0 is Sun, 1 is Mon...
  const distToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + distToMon);
  monday.setHours(0, 0, 0, 0);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function renderMealsView() {
  const matrixContainer = document.getElementById("skylight-meals-matrix");
  if (!matrixContainer) return;

  const mobileCardsContainer = document.getElementById("meals-mobile-cards-feed");

  updateGroceryBadgeCount();

  const weekDates = getMealsWeekDates(mealsWeekOffset);
  const today = new Date();
  const todayStr = getLocalDateKey(today);

  // Update header time/weather
  const timeWeatherEl = document.getElementById("meals-header-time-weather");
  if (timeWeatherEl) {
    const timeStr = today.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const cachedWeather = localStorage.getItem("turnbull_weather_cache");
    let weatherStr = "";
    if (cachedWeather) {
      try {
        const parsed = JSON.parse(cachedWeather);
        const wInfo = weatherMap[parsed.code] || { icon: "🌤️" };
        weatherStr = ` • ${wInfo.icon} ${Math.round(parsed.temp)}°`;
      } catch (e) {}
    }
    timeWeatherEl.textContent = `${timeStr}${weatherStr}`;
  }

  const dayShortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayFullNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // 3 Core Family Categories: Breakfast, Lunch, Dinner (Snack removed per family meal planning UX)
  const categories = [
    { key: "breakfast", label: "Breakfast", emoji: "🥞", themeClass: "cat-theme-breakfast" },
    { key: "lunch", label: "Lunch", emoji: "🥪", themeClass: "cat-theme-lunch" },
    { key: "dinner", label: "Dinner", emoji: "🥘", themeClass: "cat-theme-dinner" }
  ];

  // =========================================================================
  // 1. DESKTOP / TABLET: 3-Tier Skylight Grid Matrix
  // =========================================================================
  let matrixHtml = `<div class="matrix-corner-cell"></div>`;

  weekDates.forEach((colDate) => {
    const dateStr = getLocalDateKey(colDate);
    const isToday = dateStr === todayStr;
    const dayName = dayShortNames[colDate.getDay()];
    const dateNum = colDate.getDate();

    matrixHtml += `
      <div class="matrix-day-header-cell ${isToday ? 'is-today-col' : ''}">
        <span class="matrix-day-label">${dayName}</span>
        <span class="matrix-date-number ${isToday ? 'is-today-badge' : ''}">${dateNum}</span>
      </div>
    `;
  });

  categories.forEach(cat => {
    // Left row label with vertical text
    matrixHtml += `
      <div class="matrix-cat-label-cell ${cat.themeClass}">
        <span class="cat-label-text">${cat.label}</span>
      </div>
    `;

    // 7 day cells for this category
    weekDates.forEach(colDate => {
      const dateStr = getLocalDateKey(colDate);
      const meal = getMealForDate(colDate, cat.key);
      const hasMeal = !!(meal && meal.title && meal.title.trim().length > 0);

      if (hasMeal) {
        const emoji = meal.emoji || cat.emoji;
        const cookName = meal.cook || "Steve";
        matrixHtml += `
          <div class="matrix-meal-cell" data-date="${dateStr}" data-slot="${cat.key}">
            <div class="meal-block-card meal-cat-${cat.key}" role="button" tabindex="0" title="Tap to view meal details: ${escapeHtml(meal.title)}">
              <div class="meal-block-title-row">
                <span class="meal-block-emoji">${emoji}</span>
                <span class="meal-block-title">${escapeHtml(meal.title)}</span>
              </div>
              <div class="meal-block-meta-row">
                <span class="meal-block-cook-tag">${escapeHtml(cookName)}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        matrixHtml += `
          <div class="matrix-meal-cell" data-date="${dateStr}" data-slot="${cat.key}">
            <div class="meal-empty-slot" role="button" tabindex="0" title="Tap to plan ${cat.label} for this day">
              <span>+ Plan</span>
            </div>
          </div>
        `;
      }
    });
  });

  matrixContainer.innerHTML = matrixHtml;

  // Wire matrix cell click handlers
  matrixContainer.querySelectorAll(".matrix-meal-cell").forEach(cell => {
    cell.onclick = (e) => {
      e.stopPropagation();
      const dateStr = cell.getAttribute("data-date");
      const slot = cell.getAttribute("data-slot") || "dinner";
      const meal = getMealForDate(dateStr, slot);
      if (meal && meal.title) {
        openMealDetailsPopover(meal, dateStr, slot);
      } else {
        openPlanMealDrawer(dateStr, slot);
      }
    };
  });

  // =========================================================================
  // 2. MOBILE FEED: Vertical Daily Cards Feed (Zero Horizontal Scrolling)
  // =========================================================================
  if (mobileCardsContainer) {
    let feedHtml = "";

    weekDates.forEach((colDate) => {
      const dateStr = getLocalDateKey(colDate);
      const isToday = dateStr === todayStr;
      const dayShort = dayShortNames[colDate.getDay()];
      const dayFull = dayFullNames[colDate.getDay()];
      const monthShort = monthShortNames[colDate.getMonth()];
      const dateNum = colDate.getDate();

      // Count planned meals for this day
      let plannedCount = 0;
      categories.forEach(cat => {
        const m = getMealForDate(colDate, cat.key);
        if (m && m.title && m.title.trim().length > 0) plannedCount++;
      });

      // Vertical Day Card
      feedHtml += `
        <div class="meals-mobile-day-card ${isToday ? 'is-today-card' : ''}" id="mobile-meal-day-${dateStr}">
          <div class="mobile-day-card-header">
            <div class="mobile-day-title-wrap">
              <span class="mobile-day-weekday">${dayFull}</span>
              <span class="mobile-day-date">${dateNum} ${monthShort}</span>
              ${isToday ? '<span class="mobile-today-chip">Today</span>' : ''}
            </div>
            <div class="mobile-day-meta-badge">
              ${plannedCount > 0 
                ? `<span class="mobile-day-count-pill">${plannedCount} of 3 planned</span>` 
                : `<span class="mobile-day-empty-pill">No meals planned</span>`}
            </div>
          </div>

          <div class="mobile-day-slots-list">
      `;

      // Render 3 meal slots for this day: Breakfast, Lunch, Dinner
      categories.forEach(cat => {
        const meal = getMealForDate(colDate, cat.key);
        const hasMeal = !!(meal && meal.title && meal.title.trim().length > 0);
        const isDinner = cat.key === "dinner";

        feedHtml += `
          <div class="mobile-meal-slot-row slot-${cat.key} ${isDinner ? 'is-dinner-slot' : ''}">
            <div class="mobile-slot-type-label">
              <span class="mobile-slot-icon">${cat.emoji}</span>
              <span class="mobile-slot-name">${cat.label}</span>
              ${isDinner ? '<span class="mobile-featured-star" title="Family Dinner">⭐</span>' : ''}
            </div>
        `;

        if (hasMeal) {
          const emoji = meal.emoji || cat.emoji;
          const cookName = meal.cook || "Steve";
          const recipe = typeof findRecipeByIdOrTitle === "function" ? findRecipeByIdOrTitle(meal.recipeId || meal.title) : null;
          const cookMin = recipe ? (parseInt(recipe.cookTime, 10) || 0) : 0;
          const prepMin = recipe ? (parseInt(recipe.prepTime, 10) || 0) : 0;
          const totalMin = recipe ? (recipe.totalMinutes || (prepMin + cookMin) || cookMin || prepMin || 0) : 0;
          const timeText = totalMin > 0 ? (typeof formatMinutesToDuration === "function" ? formatMinutesToDuration(totalMin) : `${totalMin}m`) : "";

          feedHtml += `
            <div class="mobile-slot-card mobile-slot-card-${cat.key}" role="button" tabindex="0" data-date="${dateStr}" data-slot="${cat.key}" title="Tap to view meal details: ${escapeHtml(meal.title)}">
              <div class="mobile-meal-main">
                <span class="mobile-meal-emoji">${emoji}</span>
                <div class="mobile-meal-info">
                  <div class="mobile-meal-title">${escapeHtml(meal.title)}</div>
                  <div class="mobile-meal-sub">
                    <span class="mobile-meal-cook-pill">👨‍🍳 ${escapeHtml(cookName)}</span>
                    ${timeText ? `<span class="mobile-meal-time-pill">⏱️ ${timeText}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="mobile-meal-chevron" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </div>
          `;
        } else {
          feedHtml += `
            <button type="button" class="mobile-slot-empty-btn slot-empty-${cat.key}" data-date="${dateStr}" data-slot="${cat.key}" title="Plan ${cat.label} for ${dayShort} ${dateNum}">
              <span class="mobile-empty-plus">＋</span>
              <span>Add ${cat.label}</span>
            </button>
          `;
        }

        feedHtml += `</div>`; // end mobile-meal-slot-row
      });

      feedHtml += `
          </div>
        </div>
      `;
    });

    mobileCardsContainer.innerHTML = feedHtml;

    // Wire mobile slot card clicks (open details)
    mobileCardsContainer.querySelectorAll(".mobile-slot-card").forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const dateStr = card.getAttribute("data-date");
        const slot = card.getAttribute("data-slot") || "dinner";
        const meal = getMealForDate(dateStr, slot);
        if (meal && meal.title) {
          openMealDetailsPopover(meal, dateStr, slot);
        } else {
          openPlanMealDrawer(dateStr, slot);
        }
      };
    });

    // Wire mobile empty slot button clicks (open plan drawer)
    mobileCardsContainer.querySelectorAll(".mobile-slot-empty-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const dateStr = btn.getAttribute("data-date");
        const slot = btn.getAttribute("data-slot") || "dinner";
        openPlanMealDrawer(dateStr, slot);
      };
    });
  }

  wireMealsHeaderAndDrawerListeners();
}
window.renderMealsView = renderMealsView;

let drawerSelectedChefs = ["Steve"];

function updateDrawerChefsUI() {
  document.querySelectorAll("#drawer-chef-chips-select .chef-select-chip").forEach(c => {
    const chef = c.getAttribute("data-chef");
    c.classList.toggle("is-selected", drawerSelectedChefs.includes(chef));
  });
  const cookInput = document.getElementById("drawer-cook-input");
  if (cookInput) {
    cookInput.value = drawerSelectedChefs.length > 0 ? drawerSelectedChefs.join(" & ") : "Steve";
  }
}

// Open Slide-out "Plan Meal" Drawer (Matching Photo 2)
function openPlanMealDrawer(dateStr, slot = "dinner") {
  currentPlanningDateStr = dateStr || getLocalDateKey(new Date());
  currentPlanningSlot = slot || "dinner";
  currentDrawerCategory = currentPlanningSlot;

  const drawer = document.getElementById("plan-meal-drawer");
  if (!drawer) return;

  // Clear previous custom entry inputs
  const customTitleInput = document.getElementById("custom-meal-title");
  const customNotesInput = document.getElementById("custom-meal-notes");
  if (customTitleInput) customTitleInput.value = "";
  if (customNotesInput) customNotesInput.value = "";

  // Initialize selected chefs (Item 4)
  const existingMeal = getMealForDate(currentPlanningDateStr, currentPlanningSlot);
  if (existingMeal && existingMeal.cook) {
    drawerSelectedChefs = existingMeal.cook.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  } else {
    drawerSelectedChefs = ["Steve"];
  }
  updateDrawerChefsUI();

  // Update target slot label in drawer header: e.g. "Thursday, Nov 5 • Dinner"
  const targetLabelEl = document.getElementById("drawer-target-slot-label");
  if (targetLabelEl) {
    const [y, m, d] = currentPlanningDateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const slotCapitalized = currentPlanningSlot.charAt(0).toUpperCase() + currentPlanningSlot.slice(1);
    targetLabelEl.textContent = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()} • ${slotCapitalized}`;
  }

  // Highlight corresponding category bubble (B, L, D, or S)
  updateDrawerCategoryBubblesUI();

  // Set radio in custom form
  const customCatRadios = document.querySelectorAll("input[name='custom-meal-category']");
  customCatRadios.forEach(radio => {
    radio.checked = radio.value === currentPlanningSlot;
  });

  // Reset tabs to "From Recipes" by default when opening drawer
  const tabFromRecipes = document.getElementById("tab-from-recipes");
  const tabNewEntry = document.getElementById("tab-new-entry");
  const paneFromRecipes = document.getElementById("pane-from-recipes");
  const paneNewEntry = document.getElementById("pane-new-entry");
  if (tabFromRecipes && tabNewEntry) {
    tabFromRecipes.classList.add("active");
    tabNewEntry.classList.remove("active");
  }
  if (paneFromRecipes) paneFromRecipes.style.display = "flex";
  if (paneNewEntry) paneNewEntry.style.display = "none";

  // Render recipes list
  renderDrawerRecipeList();

  // Open drawer
  drawer.style.display = "flex";
}
window.openPlanMealDrawer = openPlanMealDrawer;

function closePlanMealDrawer() {
  const drawer = document.getElementById("plan-meal-drawer");
  if (drawer) drawer.style.display = "none";
}
window.closePlanMealDrawer = closePlanMealDrawer;

function updateDrawerCategoryBubblesUI() {
  document.querySelectorAll(".cat-bubble").forEach(bubble => {
    const cat = bubble.getAttribute("data-category");
    if (cat === currentDrawerCategory) {
      bubble.classList.add("active");
    } else {
      bubble.classList.remove("active");
    }
  });
}

// Human-readable duration formatter: e.g. "25 mins", "1 hour", "1 hour 20 mins", "6 hours 10 mins"
function formatMinutesToDuration(val) {
  if (!val && val !== 0) return "15 mins";
  let min = 0;
  if (typeof val === "number") {
    min = val;
  } else if (typeof val === "string") {
    min = parseInt(val, 10);
    if (isNaN(min)) return val;
  }
  if (min <= 0) return "0 mins";
  if (min < 60) return `${min} mins`;

  const hours = Math.floor(min / 60);
  const remainingMins = min % 60;
  const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;

  if (remainingMins === 0) {
    return hourLabel;
  }
  return `${hourLabel} ${remainingMins} mins`;
}

function renderDrawerRecipeList() {
  const container = document.getElementById("drawer-recipes-list");
  if (!container) return;

  const searchInput = document.getElementById("recipe-search-input");
  const query = searchInput ? searchInput.value.trim() : "";

  // Filter recipes by category and search query
  let recipes = getAllFamilyRecipes();

  // Category filter
  if (currentDrawerCategory && currentDrawerCategory !== "all") {
    recipes = recipes.filter(r => (r.mealType && r.mealType.toLowerCase() === currentDrawerCategory.toLowerCase()) || (r.category && r.category.toLowerCase() === currentDrawerCategory.toLowerCase()));
  }

  // Dietary tag filter (matching 'kid-fav' or 'kids-fave')
  if (currentDrawerTag && currentDrawerTag !== "all") {
    recipes = recipes.filter(r => {
      if (!r.tags) return false;
      if (currentDrawerTag === "kid-fav" || currentDrawerTag === "kids-fave") {
        return r.tags.includes("kid-fav") || r.tags.includes("kids-fave");
      }
      return r.tags.includes(currentDrawerTag);
    });
  }

  // Search query filter
  if (query) {
    const qLower = query.toLowerCase();
    recipes = recipes.filter(r => {
      const titleMatch = r.title.toLowerCase().includes(qLower);
      const subMatch = (r.subtitle || "").toLowerCase().includes(qLower);
      const ingMatch = r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(qLower));
      return titleMatch || subMatch || ingMatch;
    });
  }

  if (recipes.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px 10px; color: var(--text-muted);">
        <p style="font-size: 1.5rem; margin: 0 0 6px 0;">🔍</p>
        <p style="font-weight: 700; margin: 0 0 4px 0;">No recipes found</p>
        <p style="font-size: 0.82rem; margin: 0;">Try a different search term or filter</p>
      </div>
    `;
    return;
  }

  const categoryBadgeMap = {
    breakfast: "badge-b",
    lunch: "badge-l",
    dinner: "badge-d",
    snack: "badge-s"
  };

  container.innerHTML = recipes.map(recipe => {
    const mealType = recipe.mealType || recipe.category || "dinner";
    const badgeClass = categoryBadgeMap[mealType] || "badge-d";
    // Smart total & prep time display with hours formatting for >= 60 mins
    const cookMin = parseInt(recipe.cookTime, 10) || 0;
    const prepMin = parseInt(recipe.prepTime, 10) || 0;
    const totalMin = recipe.totalMinutes || (prepMin + cookMin) || cookMin || prepMin || 15;
    let timeDisplay = "";
    if (cookMin === 0) {
      timeDisplay = `${formatMinutesToDuration(prepMin || totalMin)} prep`;
    } else {
      timeDisplay = formatMinutesToDuration(totalMin);
    }
    const emoji = recipe.emoji || (mealType === 'breakfast' ? '🥞' : mealType === 'lunch' ? '🥪' : mealType === 'dinner' ? '🥘' : '🍫');
    const badgeContent = (recipe.image || recipe.imageUrl)
      ? `<img src="${recipe.image || recipe.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" alt="">`
      : emoji;

    return `
      <div class="drawer-recipe-card" data-recipe-id="${recipe.id}" title="Tap to view recipe details and plan">
        <span class="recipe-row-badge ${badgeClass}">${badgeContent}</span>
        <div class="recipe-row-info">
          <div class="recipe-row-title">${escapeHtml(recipe.title)}</div>
          <div class="recipe-row-time">⏱️ ${timeDisplay} • ${escapeHtml(recipe.subtitle || "Household Favorite")}</div>
        </div>
        <div class="recipe-row-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;
  }).join("");

  // Wire clicking recipe row to open full recipe card with planning flow
  container.querySelectorAll(".drawer-recipe-card").forEach(card => {
    card.onclick = () => {
      const rId = card.getAttribute("data-recipe-id");
      const recipe = findRecipeByIdOrTitle(rId);
      if (recipe) {
        openCookingRecipeModal(recipe, currentPlanningDateStr, currentPlanningSlot);
      }
    };
  });
}

// Open Meal Details Popover (Matching Photo 1)
function openMealDetailsPopover(meal, dateStr, slot = "dinner") {
  const popover = document.getElementById("meal-details-modal");
  if (!popover) return;

  const titleEl = document.getElementById("meal-popover-title");
  const dateTextEl = document.getElementById("popover-meal-date-text");
  const catCircleEl = document.getElementById("popover-cat-circle");
  const catNameEl = document.getElementById("popover-cat-name");
  const ingredientsListEl = document.getElementById("popover-ingredients-list");
  const instructionsEl = document.getElementById("popover-instructions-content");
  const btnAddGrocery = document.getElementById("btn-popover-add-to-grocery");
  const btnOpenRecipe = document.getElementById("btn-popover-open-recipe");
  const btnEditMeal = document.getElementById("btn-popover-edit-meal");
  const btnDeleteMeal = document.getElementById("btn-popover-delete-meal");
  const btnClose = document.getElementById("btn-popover-close");

  const recipe = findRecipeByIdOrTitle(meal.recipeId || meal.title);
  const fullIngredients = (recipe && recipe.ingredients) || meal.ingredients || [
    "Fresh ingredients for " + meal.title,
    "Olive oil, salt & pepper",
    "Seasoning to taste"
  ];
  const fullInstructions = (recipe && recipe.instructions) || meal.instructions || [
    "Prepare ingredients as directed.",
    "Cook over medium heat until golden and thoroughly heated.",
    "Serve hot with family sides and enjoy!"
  ];

  if (titleEl) titleEl.textContent = meal.title;

  // Format Date: e.g. Thursday, November 5
  if (dateTextEl && dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    dateTextEl.textContent = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
  }

  // Format Category Pill: Item 6 clean category badge without letter circle
  const slotName = slot.charAt(0).toUpperCase() + slot.slice(1);
  if (catCircleEl) {
    catCircleEl.style.display = "none";
  }
  if (catNameEl) {
    catNameEl.textContent = slotName;
    catNameEl.className = `popover-cat-name cat-theme-pill cat-theme-${slot.toLowerCase()}`;
  }

  // Render Ingredients with dashes matching Photo 1: "- 1 Tbsp olive oil"
  if (ingredientsListEl) {
    ingredientsListEl.innerHTML = fullIngredients.map(ing => {
      const text = ing.startsWith("-") ? ing : `- ${ing}`;
      return `<li>${escapeHtml(text)}</li>`;
    }).join("");
  }

  // Render Instructions
  if (instructionsEl) {
    instructionsEl.innerHTML = fullInstructions.map((step, idx) => {
      return `<p style="margin: 0 0 8px 0;"><strong>Step ${idx + 1}:</strong> ${escapeHtml(step)}</p>`;
    }).join("");
  }

  // Reset Add to List button state
  if (btnAddGrocery) {
    btnAddGrocery.classList.remove("is-added");
    btnAddGrocery.innerHTML = `<span class="btn-pill-icon">🛒</span> <span class="btn-pill-label">Add to List</span>`;
    btnAddGrocery.onclick = () => {
      const added = addIngredientsToGroceryList(fullIngredients, meal.title);
      btnAddGrocery.classList.add("is-added");
      btnAddGrocery.innerHTML = `<span class="btn-pill-icon">✓</span> <span class="btn-pill-label">Added to List!</span>`;
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      if (typeof showCalendarToast === "function") {
        showCalendarToast(`🛒 Added ingredients for ${meal.title} to Grocery List!`);
      }
    };
  }

  // Open Full Recipe Cooking Mode
  if (btnOpenRecipe) {
    btnOpenRecipe.onclick = () => {
      closeMealDetailsPopover();
      openCookingRecipeModal(recipe || meal, dateStr, slot);
    };
  }

  // Edit action
  if (btnEditMeal) {
    btnEditMeal.onclick = () => {
      closeMealDetailsPopover();
      openPlanMealDrawer(dateStr, slot);
    };
  }

  // Delete action
  if (btnDeleteMeal) {
    btnDeleteMeal.onclick = () => {
      setMealForDate(dateStr, null, slot);
      closeMealDetailsPopover();
      renderMealsView();
      renderWeekCalendar();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      if (typeof showCalendarToast === "function") {
        showCalendarToast(`Removed ${meal.title} from schedule`);
      }
    };
  }

  if (btnClose) btnClose.onclick = closeMealDetailsPopover;

  if (typeof popover.showModal === "function") popover.showModal();
  else popover.setAttribute("open", "true");
}
window.openMealDetailsPopover = openMealDetailsPopover;

function openPlanMealModalForDate(dateStr, slot = "dinner") {
  const meal = getMealForDate(dateStr, slot);
  if (meal && meal.title) {
    openMealDetailsPopover(meal, dateStr, slot);
  } else {
    openPlanMealDrawer(dateStr, slot);
  }
}
window.openPlanMealModalForDate = openPlanMealModalForDate;

function closeMealDetailsPopover() {
  const popover = document.getElementById("meal-details-modal");
  if (popover && popover.open) {
    if (typeof popover.close === "function") popover.close();
    else popover.removeAttribute("open");
  }
}
window.closeMealDetailsPopover = closeMealDetailsPopover;

let currentCookingRecipe = null;
let cookingModalChefs = ["Steve"];

function updateCookingModalChefsUI() {
  const container = document.getElementById("cooking-chef-chips");
  if (!container) return;

  container.querySelectorAll(".cooking-chef-chip").forEach(chip => {
    const chefName = chip.getAttribute("data-chef");
    if (cookingModalChefs.includes(chefName)) {
      chip.classList.add("is-selected");
    } else {
      chip.classList.remove("is-selected");
    }

    if (!chip.hasAttribute("data-wired")) {
      chip.setAttribute("data-wired", "true");
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chef = chip.getAttribute("data-chef");
        if (cookingModalChefs.includes(chef)) {
          if (cookingModalChefs.length > 1) {
            cookingModalChefs = cookingModalChefs.filter(c => c !== chef);
          }
        } else {
          cookingModalChefs.push(chef);
        }
        updateCookingModalChefsUI();
      };
    }
  });
}

// Open Interactive Cooking Mode Modal with Planning Flow
function openCookingRecipeModal(recipeOrMeal, targetDateStr = null, targetSlot = null) {
  const modal = document.getElementById("cooking-recipe-modal");
  if (!modal) return;

  const recipe = findRecipeByIdOrTitle(recipeOrMeal.id || recipeOrMeal.recipeId || recipeOrMeal.title) || recipeOrMeal;
  currentCookingRecipe = recipe;

  const targetDate = targetDateStr || currentPlanningDateStr || getLocalDateKey(new Date());
  const targetCategory = targetSlot || currentPlanningSlot || recipe.mealType || recipe.category || "dinner";

  // Pre-fill Date input in planning footer
  const dateInput = document.getElementById("cooking-plan-date-input");
  if (dateInput) {
    dateInput.value = targetDate;
  }

  // Pre-fill Slot select in planning footer
  const slotSelect = document.getElementById("cooking-plan-slot-select");
  if (slotSelect) {
    slotSelect.value = targetCategory.toLowerCase();
  }

  // Pre-fill Chefs in planning footer
  const existingMeal = getMealForDate(targetDate, targetCategory);
  if (existingMeal && existingMeal.cook) {
    cookingModalChefs = existingMeal.cook.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  } else if (drawerSelectedChefs && drawerSelectedChefs.length > 0) {
    cookingModalChefs = [...drawerSelectedChefs];
  } else {
    cookingModalChefs = ["Steve"];
  }
  updateCookingModalChefsUI();

  // Wire "Add to Meal Plan" button in modal footer
  const btnAddToPlan = document.getElementById("btn-cooking-add-to-plan");
  if (btnAddToPlan) {
    btnAddToPlan.onclick = () => {
      if (!currentCookingRecipe) return;

      const curDateInput = document.getElementById("cooking-plan-date-input");
      const curSlotSelect = document.getElementById("cooking-plan-slot-select");
      const selectedDate = (curDateInput && curDateInput.value) || targetDate;
      const selectedSlot = (curSlotSelect && curSlotSelect.value) || targetCategory || "dinner";
      const selectedChefs = (cookingModalChefs && cookingModalChefs.length > 0) ? cookingModalChefs : ["Steve"];

      // Confirmation dialog if overwriting an existing planned meal
      const existing = getMealForDate(selectedDate, selectedSlot);
      if (existing && existing.title && existing.title.trim().length > 0) {
        if (existing.title.trim().toLowerCase() !== currentCookingRecipe.title.trim().toLowerCase()) {
          const slotCap = selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1);
          const [y, m, d] = selectedDate.split("-").map(Number);
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const dayName = !isNaN(y) ? dayNames[new Date(y, m - 1, d).getDay()] : selectedDate;
          const ok = confirm(`There is already a meal planned for ${dayName} ${slotCap}:\n"${existing.title}"\n\nDo you want to replace it with "${currentCookingRecipe.title}"?`);
          if (!ok) return;
        }
      }

      // Save to plan
      setMealForDate(selectedDate, {
        title: currentCookingRecipe.title,
        recipeId: currentCookingRecipe.id,
        emoji: currentCookingRecipe.emoji || "🍽️",
        cook: selectedChefs.join(" & "),
        notes: currentCookingRecipe.subtitle || "",
        tags: (currentCookingRecipe.tags || []).join(" • "),
        category: selectedSlot,
        hasRecipe: true,
        ingredients: currentCookingRecipe.ingredients || [],
        instructions: currentCookingRecipe.instructions || []
      }, selectedSlot);

      // Close modal & drawer
      closeCookingRecipeModal();
      closePlanMealDrawer();

      // Audio feedback & toast
      if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
      if (typeof showCalendarToast === "function") {
        const slotCap = selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1);
        showCalendarToast(`📅 Planned "${currentCookingRecipe.title}" for ${slotCap}!`);
      }

      renderMealsView();
      renderWeekCalendar();
    };
  }

  const heroEl = document.getElementById("cooking-modal-hero");
  const titleEl = document.getElementById("cooking-modal-title");
  const subEl = document.getElementById("cooking-modal-subtitle");
  const metaPillsEl = document.getElementById("cooking-meta-pills");
  const checklistEl = document.getElementById("cooking-checklist");
  const stepsListEl = document.getElementById("cooking-steps-list");
  const btnClose = document.getElementById("btn-close-cooking-modal");
  const btnCloseFooter = document.getElementById("btn-cooking-close-footer");
  const btnAddGrocery = document.getElementById("btn-cooking-add-grocery");

  const heroImgSrc = recipe.image || recipe.imageUrl;
  if (heroEl) {
    if (heroImgSrc) {
      heroEl.style.backgroundImage = `url('${heroImgSrc}')`;
    } else {
      heroEl.style.backgroundImage = `linear-gradient(135deg, #0284c7, #6366f1)`;
    }
  }
  if (titleEl) titleEl.textContent = recipe.title || "Family Recipe";
  if (subEl) subEl.textContent = recipe.subtitle || "Delicious family meal";

  if (metaPillsEl) {
    const cookMin = parseInt(recipe.cookTime, 10) || 0;
    const prepMin = parseInt(recipe.prepTime, 10) || 0;
    const totalMin = recipe.totalMinutes || (prepMin + cookMin) || 15;

    let timePills = "";
    if (cookMin === 0) {
      timePills = `
        <span class="cooking-pill">⏱️ ${formatMinutesToDuration(prepMin || totalMin)} prep</span>
        <span class="cooking-pill">🥗 No cooking</span>
      `;
    } else {
      timePills = `
        <span class="cooking-pill">⏱️ ${formatMinutesToDuration(totalMin)} total</span>
        <span class="cooking-pill">🔪 Prep: ${formatMinutesToDuration(prepMin || 10)}</span>
        <span class="cooking-pill">🍳 Cook: ${formatMinutesToDuration(cookMin || 15)}</span>
      `;
    }

    metaPillsEl.innerHTML = `
      ${timePills}
      <span class="cooking-pill">👥 ${recipe.servings || 4} Servings</span>
      <span class="cooking-pill">🔥 ${recipe.calories || "520 kcal"}</span>
    `;
  }

  const ingredients = recipe.ingredients || [
    "Fresh ingredients for " + recipe.title,
    "Olive oil, salt & pepper",
    "Seasoning to taste"
  ];

  if (checklistEl) {
    checklistEl.innerHTML = ingredients.map((ing, idx) => {
      const clean = ing.replace(/^-\s*/, '').trim();
      return `
        <li class="cooking-check-item" data-idx="${idx}">
          <input type="checkbox" id="ing-chk-${idx}">
          <label for="ing-chk-${idx}">${escapeHtml(clean)}</label>
        </li>
      `;
    }).join("");

    checklistEl.querySelectorAll(".cooking-check-item").forEach(item => {
      const chk = item.querySelector("input[type='checkbox']");
      if (chk) {
        chk.onchange = () => {
          if (chk.checked) item.classList.add("is-checked");
          else item.classList.remove("is-checked");
        };
      }
    });
  }

  const instructions = recipe.instructions || [
    "Prepare ingredients on your cutting board.",
    "Cook gently until fragrant, simmering to let flavors meld.",
    "Serve piping hot to the family!"
  ];

  if (stepsListEl) {
    stepsListEl.innerHTML = instructions.map((step, idx) => {
      return `
        <div class="cooking-step-row">
          <span class="cooking-step-badge">${idx + 1}</span>
          <div class="cooking-step-text">${escapeHtml(step)}</div>
        </div>
      `;
    }).join("");
  }

  if (btnAddGrocery) {
    btnAddGrocery.onclick = () => {
      addIngredientsToGroceryList(ingredients, recipe.title);
      btnAddGrocery.textContent = "✓ Added to Grocery List!";
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      if (typeof showCalendarToast === "function") {
        showCalendarToast(`🛒 Added ingredients for ${recipe.title} to Grocery List!`);
      }
    };
  }

  if (btnClose) btnClose.onclick = closeCookingRecipeModal;
  if (btnCloseFooter) btnCloseFooter.onclick = closeCookingRecipeModal;

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
}
window.openCookingRecipeModal = openCookingRecipeModal;

function closeCookingRecipeModal() {
  const modal = document.getElementById("cooking-recipe-modal");
  if (modal && modal.open) {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }
}
window.closeCookingRecipeModal = closeCookingRecipeModal;

// Open Family Grocery Shopping List Modal
function openGroceryListModal() {
  const modal = document.getElementById("grocery-list-modal");
  if (!modal) return;

  const itemsListEl = document.getElementById("grocery-items-list");
  const quickInput = document.getElementById("grocery-quick-input");
  const btnAdd = document.getElementById("btn-grocery-add-item");
  const btnClearCompleted = document.getElementById("btn-clear-completed-grocery");
  const btnClose = document.getElementById("btn-close-grocery-modal");
  const btnCloseFooter = document.getElementById("btn-close-grocery-footer");

  const renderItems = () => {
    const list = familyGroceryList || loadFamilyGroceryList();
    if (!itemsListEl) return;

    if (list.length === 0) {
      itemsListEl.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--text-muted);">
          <p style="font-size: 1.6rem; margin: 0 0 6px 0;">🛒</p>
          <p style="font-weight: 700; margin: 0;">Grocery list is empty!</p>
          <p style="font-size: 0.82rem; margin: 4px 0 0 0;">Add ingredients from recipes or type items above</p>
        </div>
      `;
      return;
    }

    itemsListEl.innerHTML = list.map(item => {
      return `
        <li class="grocery-item-row ${item.checked ? 'is-bought' : ''}" data-id="${item.id}">
          <div class="grocery-item-left">
            <input type="checkbox" id="chk-${item.id}" ${item.checked ? 'checked' : ''}>
            <label for="chk-${item.id}" class="grocery-item-text">${escapeHtml(item.text)}</label>
          </div>
          <button type="button" class="btn-grocery-item-del" data-id="${item.id}" title="Remove item">✕</button>
        </li>
      `;
    }).join("");

    // Wire checkbox clicks
    itemsListEl.querySelectorAll(".grocery-item-row").forEach(row => {
      const id = row.getAttribute("data-id");
      const chk = row.querySelector("input[type='checkbox']");
      if (chk) {
        chk.onchange = () => {
          const l = familyGroceryList || loadFamilyGroceryList();
          const target = l.find(i => i.id === id);
          if (target) {
            target.checked = chk.checked;
            saveFamilyGroceryList(l);
            renderItems();
          }
        };
      }
      const delBtn = row.querySelector(".btn-grocery-item-del");
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          const l = (familyGroceryList || loadFamilyGroceryList()).filter(i => i.id !== id);
          saveFamilyGroceryList(l);
          renderItems();
        };
      }
    });

    const checkedCount = list.filter(i => i.checked).length;
    if (btnClearCompleted) {
      btnClearCompleted.textContent = checkedCount > 0 ? `Clear Checked Items (${checkedCount})` : "Clear Checked Items";
      btnClearCompleted.style.opacity = checkedCount > 0 ? "1" : "0.6";
      btnClearCompleted.disabled = checkedCount === 0;
    }

    updateGroceryBadgeCount();
  };

  const handleAddItem = () => {
    if (!quickInput) return;
    const val = quickInput.value.trim();
    if (!val) return;
    const list = familyGroceryList || loadFamilyGroceryList();
    list.unshift({
      id: "g-" + Date.now(),
      text: val,
      checked: false,
      source: "Manual",
      addedAt: new Date().toISOString()
    });
    saveFamilyGroceryList(list);
    quickInput.value = "";
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    renderItems();
  };

  if (btnAdd) btnAdd.onclick = handleAddItem;
  if (quickInput) {
    quickInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddItem();
      }
    };
  }

  if (btnClearCompleted) {
    btnClearCompleted.onclick = () => {
      const list = (familyGroceryList || loadFamilyGroceryList()).filter(i => !i.checked);
      saveFamilyGroceryList(list);
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      renderItems();
    };
  }

  const closeModal = () => {
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCloseFooter) btnCloseFooter.onclick = closeModal;

  renderItems();

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
}
window.openGroceryListModal = openGroceryListModal;

// ============================================================================
// SPRINT 2: FAMILY STICKY NOTE / MESSAGE OF THE DAY
// ============================================================================

function loadFamilyStickyNote() {
  if (familyStickyNote !== null && familyStickyNote !== undefined) return familyStickyNote;
  try {
    const raw = localStorage.getItem("turnbull_sticky_note");
    if (raw === "none" || raw === "null" || !raw) {
      familyStickyNote = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.text && !parsed.deleted) {
      familyStickyNote = parsed;
      return familyStickyNote;
    }
  } catch(e) {}
  familyStickyNote = null;
  return null;
}

function saveFamilyStickyNote(note) {
  if (note && note.text && !note.deleted) {
    familyStickyNote = note;
    try {
      localStorage.setItem("turnbull_sticky_note", JSON.stringify(note));
    } catch(e) {}
  } else {
    familyStickyNote = null;
    try {
      localStorage.setItem("turnbull_sticky_note", "none");
    } catch(e) {}
  }
  if (db && typeof setDoc === "function") {
    try {
      const boardDocRef = doc(db, "boards", currentBoardId);
      setDoc(boardDocRef, {
        stickyNote: familyStickyNote || null,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch(e) {}
  }
}

function renderFamilyStickyNote() {
  const container = document.getElementById("family-sticky-container");
  const card = document.getElementById("family-sticky-card");
  const textEl = document.getElementById("sticky-message-text");
  const authorEl = document.getElementById("sticky-author-badge");
  const timeEl = document.getElementById("sticky-time-badge");
  if (!container || !card || !textEl) return;

  const note = (familyStickyNote !== undefined && familyStickyNote !== null) ? familyStickyNote : loadFamilyStickyNote();
  if (!note || !note.text || !note.text.trim() || note.deleted) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  card.className = `family-sticky-card color-${note.color || 'yellow'}`;
  textEl.textContent = note.text;
  textEl.style.fontStyle = "normal";
  textEl.style.opacity = "1";
  if (authorEl) authorEl.textContent = note.author ? `From ${note.author}` : "Family Note";
  if (timeEl) {
    timeEl.textContent = "Today";
  }
}
window.renderFamilyStickyNote = renderFamilyStickyNote;

function openStickyNoteModal() {
  const modal = document.getElementById("sticky-note-modal");
  if (!modal) return;
  const input = document.getElementById("sticky-input-text");
  const authorSelect = document.getElementById("sticky-input-author");
  const note = (familyStickyNote !== undefined && familyStickyNote !== null) ? familyStickyNote : loadFamilyStickyNote();

  if (input) input.value = (note && note.text && !note.deleted) ? note.text : "";
  if (authorSelect) authorSelect.value = (note && note.author) ? note.author : "Family";
  selectedStickyColor = (note && note.color) ? note.color : "yellow";

  const pills = document.querySelectorAll(".sticky-color-pill");
  pills.forEach(pill => {
    pill.classList.toggle("selected", pill.getAttribute("data-color") === selectedStickyColor);
    pill.onclick = () => {
      selectedStickyColor = pill.getAttribute("data-color");
      pills.forEach(p => p.classList.toggle("selected", p === pill));
    };
  });

  const btnClose = document.getElementById("btn-close-sticky-modal");
  const btnCancel = document.getElementById("btn-cancel-sticky");
  const btnSave = document.getElementById("btn-save-sticky");
  const btnClear = document.getElementById("btn-clear-sticky");

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (btnClear) {
    btnClear.textContent = "Delete Note";
    btnClear.style.display = (note && note.text && !note.deleted) ? "inline-flex" : "none";
    btnClear.onclick = () => {
      saveFamilyStickyNote(null);
      renderFamilyStickyNote();
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
      if (typeof showCalendarToast === "function") showCalendarToast("🗑️ Deleted note from the board.");
    };
  }
  if (btnSave) {
    btnSave.onclick = () => {
      const text = input ? input.value.trim() : "";
      if (!text) {
        saveFamilyStickyNote(null);
      } else {
        const author = authorSelect ? authorSelect.value : "Family";
        saveFamilyStickyNote({
          text: text,
          author: author,
          color: selectedStickyColor || "yellow",
          updatedAt: new Date().toISOString()
        });
      }
      renderFamilyStickyNote();
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (typeof showCalendarToast === "function") showCalendarToast("📌 Pinned message to the family board!");
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
  if (input) input.focus();
}
window.openStickyNoteModal = openStickyNoteModal;

// ============================================================================
// SPRINT 2: DEDICATED FAMILY LISTS HUB
// ============================================================================

function loadFamilyLists() {
  if (familyLists && Array.isArray(familyLists) && familyLists.length > 0) return familyLists;
  try {
    const raw = localStorage.getItem("turnbull_family_lists");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        familyLists = parsed;
        return familyLists;
      }
    }
  } catch(e) {}

  const existingGroceries = familyGroceryList || loadFamilyGroceryList() || [];

  familyLists = [
    {
      id: "groceries",
      title: "Family Groceries",
      emoji: "🛒",
      isDefault: true,
      items: existingGroceries.length > 0 ? existingGroceries : [
        { id: "g-1", text: "Fresh Mozzarella (250g)", checked: false },
        { id: "g-2", text: "Green Basil Pesto (190g)", checked: false },
        { id: "g-3", text: "Crème Fraîche (150g)", checked: false },
        { id: "g-4", text: "Frozen Garden Peas", checked: true }
      ]
    },
    {
      id: "todo",
      title: "Weekend To-Do & Errands",
      emoji: "📋",
      items: [
        { id: "td-1", text: "Book annual car service & MOT", checked: false },
        { id: "td-2", text: "Pick up dry cleaning", checked: false },
        { id: "td-3", text: "Wash dog & cat bedding", checked: true }
      ]
    },
    {
      id: "packing",
      title: "Holiday & Travel Packing",
      emoji: "🧳",
      items: [
        { id: "pk-1", text: "Passports, EHIC cards & boarding passes", checked: false },
        { id: "pk-2", text: "Phone chargers & European travel adapters", checked: false },
        { id: "pk-3", text: "Sunscreen SPF 50 & insect repellent", checked: false },
        { id: "pk-4", text: "Toothbrushes & travel toiletries", checked: true }
      ]
    }
  ];
  saveFamilyLists(familyLists);
  return familyLists;
}

function saveFamilyLists(lists) {
  familyLists = lists;
  try {
    localStorage.setItem("turnbull_family_lists", JSON.stringify(lists));
    const groc = lists.find(l => l.id === "groceries");
    if (groc) {
      familyGroceryList = groc.items;
      localStorage.setItem("turnbull_grocery_list_v2", JSON.stringify(groc.items));
      updateGroceryBadgeCount();
    }
  } catch(e) {}

  if (db && typeof setDoc === "function") {
    try {
      const boardDocRef = doc(db, "boards", currentBoardId);
      setDoc(boardDocRef, {
        familyLists: lists,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch(e) {}
  }
}

function renderListsView() {
  const lists = familyLists || loadFamilyLists();
  const selectorBar = document.getElementById("lists-selector-bar");
  const activeTitle = document.getElementById("active-list-title");
  const activeEmoji = document.getElementById("active-list-emoji");
  const activeProgressFill = document.getElementById("active-list-progress-fill");
  const activeProgressText = document.getElementById("active-list-progress-text");
  const btnDelete = document.getElementById("btn-lists-delete-list");
  const btnClearChecked = document.getElementById("btn-lists-clear-checked");
  const itemsUl = document.getElementById("list-items-ul");

  if (!lists || lists.length === 0) return;

  let currentList = lists.find(l => l.id === activeListId);
  if (!currentList) {
    currentList = lists[0];
    activeListId = currentList.id;
  }

  // 1. Render Selector Tabs
  if (selectorBar) {
    selectorBar.innerHTML = lists.map(list => {
      const remaining = list.items ? list.items.filter(i => !i.checked).length : 0;
      const isActive = list.id === activeListId;
      return `
        <button type="button" class="list-tab-pill ${isActive ? 'active' : ''}" data-list-id="${list.id}">
          <span>${list.emoji || '📋'}</span>
          <span>${escapeHtml(list.title)}</span>
          <span class="tab-count-badge">${remaining}</span>
        </button>
      `;
    }).join("");

    selectorBar.querySelectorAll(".list-tab-pill").forEach(pill => {
      pill.onclick = () => {
        const id = pill.getAttribute("data-list-id");
        activeListId = id;
        if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
        renderListsView();
      };
    });
  }

  // 2. Render Active List Header & Progress
  if (activeTitle) activeTitle.textContent = currentList.title;
  if (activeEmoji) activeEmoji.textContent = currentList.emoji || "📋";

  const totalItems = currentList.items ? currentList.items.length : 0;
  const completedItems = currentList.items ? currentList.items.filter(i => i.checked).length : 0;
  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (activeProgressFill) activeProgressFill.style.width = `${percent}%`;
  if (activeProgressText) {
    activeProgressText.textContent = totalItems === 0 
      ? "No items yet" 
      : `${completedItems} of ${totalItems} done (${percent}%)`;
  }

  if (btnDelete) {
    btnDelete.style.display = currentList.isDefault ? "none" : "inline-block";
    btnDelete.onclick = () => handleDeleteList(currentList.id, currentList.title);
  }

  if (btnClearChecked) {
    btnClearChecked.disabled = completedItems === 0;
    btnClearChecked.style.opacity = completedItems === 0 ? "0.5" : "1";
    btnClearChecked.textContent = completedItems > 0 ? `Clear Completed (${completedItems})` : "Clear Completed";
    btnClearChecked.onclick = () => handleClearCompletedListItems(currentList.id);
  }

  // 3. Render List Items
  if (itemsUl) {
    if (totalItems === 0) {
      itemsUl.innerHTML = `
        <li style="text-align: center; padding: 40px 10px; color: var(--text-muted); list-style: none;">
          <p style="font-size: 2rem; margin: 0 0 8px 0;">${currentList.emoji || '📋'}</p>
          <p style="font-weight: 700; font-size: 1.05rem; margin: 0; color: var(--text-primary);">This list is empty!</p>
          <p style="font-size: 0.85rem; margin: 4px 0 0 0;">Type an item above to add it to ${escapeHtml(currentList.title)}</p>
        </li>
      `;
    } else {
      itemsUl.innerHTML = currentList.items.map(item => {
        return `
          <li class="list-item-row ${item.checked ? 'is-checked' : ''}" data-item-id="${item.id}">
            <div class="list-item-left">
              <input type="checkbox" class="list-item-checkbox" id="chk-li-${item.id}" ${item.checked ? 'checked' : ''}>
              <label for="chk-li-${item.id}" class="list-item-text">${escapeHtml(item.text)}</label>
            </div>
            <button type="button" class="btn-list-item-del" data-item-id="${item.id}" title="Remove item">✕</button>
          </li>
        `;
      }).join("");

      itemsUl.querySelectorAll(".list-item-row").forEach(row => {
        const itemId = row.getAttribute("data-item-id");
        const chk = row.querySelector(".list-item-checkbox");
        if (chk) {
          chk.onchange = () => {
            handleToggleListItem(currentList.id, itemId, chk.checked);
          };
        }
        const delBtn = row.querySelector(".btn-list-item-del");
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            handleDeleteListItem(currentList.id, itemId);
          };
        }
      });
    }
  }

  // 4. Wire Quick Add input
  const quickInput = document.getElementById("list-quick-add-input");
  const btnAdd = document.getElementById("btn-list-add-item");
  if (btnAdd && !btnAdd.hasAttribute("data-wired")) {
    btnAdd.setAttribute("data-wired", "true");
    btnAdd.onclick = () => {
      if (!quickInput) return;
      const text = quickInput.value.trim();
      if (!text) return;
      handleAddItemToList(activeListId, text);
      quickInput.value = "";
      quickInput.focus();
    };
  }
  if (quickInput && !quickInput.hasAttribute("data-wired")) {
    quickInput.setAttribute("data-wired", "true");
    quickInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = quickInput.value.trim();
        if (!text) return;
        handleAddItemToList(activeListId, text);
        quickInput.value = "";
      }
    };
  }

  // 5. Wire Create New List Button
  const btnNewList = document.getElementById("btn-create-new-list");
  if (btnNewList && !btnNewList.hasAttribute("data-wired")) {
    btnNewList.setAttribute("data-wired", "true");
    btnNewList.onclick = () => openCreateListModal();
  }
}
window.renderListsView = renderListsView;

function handleAddItemToList(listId, text) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  if (!list.items) list.items = [];

  list.items.unshift({
    id: "item-" + Date.now(),
    text: text,
    checked: false,
    addedAt: new Date().toISOString()
  });

  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

function handleToggleListItem(listId, itemId, checked) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  item.checked = checked;
  saveFamilyLists(lists);
  if (checked && typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) {
    sfx.playCelebrationChime();
  } else if (typeof sfx !== "undefined" && sfx && sfx.playClick) {
    sfx.playClick();
  }
  renderListsView();
}

function handleDeleteListItem(listId, itemId) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
  renderListsView();
}

function handleClearCompletedListItems(listId) {
  const lists = familyLists || loadFamilyLists();
  const list = lists.find(l => l.id === listId);
  if (!list || !list.items) return;
  list.items = list.items.filter(i => !i.checked);
  saveFamilyLists(lists);
  if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  renderListsView();
}

let selectedNewListEmoji = "📋";

function openCreateListModal() {
  const modal = document.getElementById("create-list-modal");
  if (!modal) return;
  const input = document.getElementById("new-list-title-input");
  if (input) input.value = "";
  selectedNewListEmoji = "📋";

  const emojis = document.querySelectorAll(".emoji-picker-btn");
  emojis.forEach(btn => {
    btn.classList.toggle("selected", btn.getAttribute("data-emoji") === "📋");
    btn.onclick = () => {
      selectedNewListEmoji = btn.getAttribute("data-emoji");
      emojis.forEach(b => b.classList.toggle("selected", b === btn));
    };
  });

  const btnClose = document.getElementById("btn-close-create-list");
  const btnCancel = document.getElementById("btn-cancel-create-list");
  const btnSave = document.getElementById("btn-save-new-list");

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (btnSave) {
    btnSave.onclick = () => {
      const title = input ? input.value.trim() : "";
      if (!title) {
        alert("Please enter a title for your list.");
        return;
      }
      const lists = familyLists || loadFamilyLists();
      const newListId = "list-" + Date.now();
      lists.push({
        id: newListId,
        title: title,
        emoji: selectedNewListEmoji || "📋",
        items: []
      });
      saveFamilyLists(lists);
      activeListId = newListId;
      closeModal();
      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (typeof showCalendarToast === "function") {
        showCalendarToast(`Created list: ${selectedNewListEmoji} ${title}!`);
      }
      renderListsView();
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
  if (input) input.focus();
}
window.openCreateListModal = openCreateListModal;

function handleDeleteList(listId, title) {
  if (confirm(`Are you sure you want to delete "${title}"?`)) {
    const lists = (familyLists || loadFamilyLists()).filter(l => l.id !== listId);
    activeListId = lists.length > 0 ? lists[0].id : "groceries";
    saveFamilyLists(lists);
    if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
    if (typeof showCalendarToast === "function") {
      showCalendarToast(`Deleted list: ${title}`);
    }
    renderListsView();
  }
}
window.handleDeleteList = handleDeleteList;

// Wire Meals Header, Drawer Tabs & Controls
function wireMealsHeaderAndDrawerListeners() {
  const btnPrevWeek = document.getElementById("btn-meals-prev-week");
  const btnNextWeek = document.getElementById("btn-meals-next-week");
  const btnToday = document.getElementById("btn-meals-today");
  const btnOpenGrocery = document.getElementById("btn-open-grocery-list");
  const btnPlanDinner = document.getElementById("btn-meals-plan-dinner");
  const btnCloseDrawer = document.getElementById("btn-close-plan-drawer");

  if (btnPrevWeek && !btnPrevWeek.hasAttribute("data-wired")) {
    btnPrevWeek.setAttribute("data-wired", "true");
    btnPrevWeek.onclick = () => {
      mealsWeekOffset--;
      renderMealsView();
    };
  }

  if (btnNextWeek && !btnNextWeek.hasAttribute("data-wired")) {
    btnNextWeek.setAttribute("data-wired", "true");
    btnNextWeek.onclick = () => {
      mealsWeekOffset++;
      renderMealsView();
    };
  }

  if (btnToday && !btnToday.hasAttribute("data-wired")) {
    btnToday.setAttribute("data-wired", "true");
    btnToday.onclick = () => {
      mealsWeekOffset = 0;
      renderMealsView();
    };
  }

  if (btnOpenGrocery && !btnOpenGrocery.hasAttribute("data-wired")) {
    btnOpenGrocery.setAttribute("data-wired", "true");
    btnOpenGrocery.onclick = () => openGroceryListModal();
  }

  if (btnPlanDinner && !btnPlanDinner.hasAttribute("data-wired")) {
    btnPlanDinner.setAttribute("data-wired", "true");
    btnPlanDinner.onclick = () => {
      openPlanMealDrawer(getLocalDateKey(new Date()), "dinner");
    };
  }

  // Drawer dirty check & outside-click confirmation (Item 5)
  function isDrawerDirty() {
    const titleInput = document.getElementById("custom-meal-title");
    const notesInput = document.getElementById("custom-meal-notes");
    const hasTitle = titleInput && titleInput.value.trim().length > 0;
    const hasNotes = notesInput && notesInput.value.trim().length > 0;
    return hasTitle || hasNotes;
  }

  function handleAttemptCloseDrawer() {
    if (isDrawerDirty()) {
      if (confirm("You have unsaved meal details. Discard and close?")) {
        const titleInput = document.getElementById("custom-meal-title");
        const notesInput = document.getElementById("custom-meal-notes");
        if (titleInput) titleInput.value = "";
        if (notesInput) notesInput.value = "";
        closePlanMealDrawer();
      }
    } else {
      closePlanMealDrawer();
    }
  }

  if (btnCloseDrawer && !btnCloseDrawer.hasAttribute("data-wired")) {
    btnCloseDrawer.setAttribute("data-wired", "true");
    btnCloseDrawer.onclick = () => handleAttemptCloseDrawer();
  }

  // Outside click on document closes drawer with dirty check (Item 5)
  if (!window._drawerOutsideClickWired) {
    window._drawerOutsideClickWired = true;
    document.addEventListener("click", (e) => {
      const drawer = document.getElementById("plan-meal-drawer");
      if (!drawer || drawer.style.display === "none") return;

      // Ignore clicks inside the drawer
      if (drawer.contains(e.target)) return;

      // Ignore trigger buttons that open or switch the drawer
      if (e.target.closest("#btn-meals-plan-dinner") || e.target.closest(".matrix-meal-cell") || e.target.closest("#btn-popover-edit-meal")) {
        return;
      }

      handleAttemptCloseDrawer();
    });
  }

  // Segmented toggle: [From Recipes] vs [New Entry]
  const tabFromRecipes = document.getElementById("tab-from-recipes");
  const tabNewEntry = document.getElementById("tab-new-entry");
  const paneFromRecipes = document.getElementById("pane-from-recipes");
  const paneNewEntry = document.getElementById("pane-new-entry");

  if (tabFromRecipes && tabNewEntry && !tabFromRecipes.hasAttribute("data-wired")) {
    tabFromRecipes.setAttribute("data-wired", "true");
    tabNewEntry.setAttribute("data-wired", "true");

    tabFromRecipes.onclick = () => {
      tabFromRecipes.classList.add("active");
      tabNewEntry.classList.remove("active");
      if (paneFromRecipes) paneFromRecipes.style.display = "flex";
      if (paneNewEntry) paneNewEntry.style.display = "none";
    };

    tabNewEntry.onclick = () => {
      tabNewEntry.classList.add("active");
      tabFromRecipes.classList.remove("active");
      if (paneFromRecipes) paneFromRecipes.style.display = "none";
      if (paneNewEntry) paneNewEntry.style.display = "flex";
    };
  }

  // Category Bubbles: Breakfast, Lunch, Dinner, Snack
  document.querySelectorAll(".cat-bubble").forEach(bubble => {
    if (!bubble.hasAttribute("data-wired")) {
      bubble.setAttribute("data-wired", "true");
      bubble.onclick = () => {
        currentDrawerCategory = bubble.getAttribute("data-category") || "dinner";
        currentPlanningSlot = currentDrawerCategory;
        updateDrawerCategoryBubblesUI();
        renderDrawerRecipeList();
      };
    }
  });

  // Search input & clear button in drawer
  const searchInput = document.getElementById("recipe-search-input");
  const btnClearSearch = document.getElementById("btn-clear-recipe-search");

  if (searchInput && !searchInput.hasAttribute("data-wired")) {
    searchInput.setAttribute("data-wired", "true");
    searchInput.oninput = () => {
      if (btnClearSearch) {
        btnClearSearch.style.display = searchInput.value ? "inline-block" : "none";
      }
      renderDrawerRecipeList();
    };
  }

  if (btnClearSearch && !btnClearSearch.hasAttribute("data-wired")) {
    btnClearSearch.setAttribute("data-wired", "true");
    btnClearSearch.onclick = () => {
      if (searchInput) searchInput.value = "";
      btnClearSearch.style.display = "none";
      renderDrawerRecipeList();
    };
  }

  // Vertical Overlay Filter Dropdown (Items 8 & 9: Discreet grey text with down chevron, Kids Fave)
  const btnRecipeFilterDropdown = document.getElementById("btn-recipe-filter-dropdown");
  const recipeFilterMenu = document.getElementById("recipe-filter-menu");
  const currentRecipeFilterLabel = document.getElementById("current-recipe-filter-label");

  if (btnRecipeFilterDropdown && recipeFilterMenu && !btnRecipeFilterDropdown.hasAttribute("data-wired")) {
    btnRecipeFilterDropdown.setAttribute("data-wired", "true");
    btnRecipeFilterDropdown.onclick = (e) => {
      e.stopPropagation();
      const isVisible = recipeFilterMenu.style.display === "flex";
      recipeFilterMenu.style.display = isVisible ? "none" : "flex";
      btnRecipeFilterDropdown.setAttribute("aria-expanded", !isVisible ? "true" : "false");
    };

    recipeFilterMenu.querySelectorAll(".drawer-filter-opt").forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const tag = opt.getAttribute("data-tag") || "all";
        currentDrawerTag = tag;

        // Update active class & checkmark
        recipeFilterMenu.querySelectorAll(".drawer-filter-opt").forEach(o => {
          const isAct = o.getAttribute("data-tag") === tag;
          o.classList.toggle("active", isAct);
          const chk = o.querySelector(".opt-check");
          if (chk) chk.textContent = isAct ? "✓" : "";
        });

        // Update dropdown label text (Item 9: Kids Fave)
        const tagLabels = {
          all: "Filter: All",
          veggie: "Filter: Veggie",
          quick: "Filter: Quick",
          "kid-fav": "Filter: Kids Fave",
          pasta: "Filter: Pasta",
          meat: "Filter: Hearty"
        };
        if (currentRecipeFilterLabel) {
          currentRecipeFilterLabel.textContent = tagLabels[tag] || "Filter";
        }

        recipeFilterMenu.style.display = "none";
        btnRecipeFilterDropdown.setAttribute("aria-expanded", "false");
        renderDrawerRecipeList();
      };
    });

    document.addEventListener("click", (e) => {
      if (recipeFilterMenu && recipeFilterMenu.style.display === "flex") {
        if (!recipeFilterMenu.contains(e.target) && e.target !== btnRecipeFilterDropdown) {
          recipeFilterMenu.style.display = "none";
          btnRecipeFilterDropdown.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  // Drawer chef selection chips for custom meal (Item 4: Multi-person team effort)
  updateDrawerChefsUI();

  document.querySelectorAll("#drawer-chef-chips-select .chef-select-chip").forEach(chip => {
    if (!chip.hasAttribute("data-wired")) {
      chip.setAttribute("data-wired", "true");
      chip.onclick = () => {
        const chef = chip.getAttribute("data-chef");
        if (chef === "Family") {
          if (drawerSelectedChefs.includes("Family")) {
            drawerSelectedChefs = ["Steve"];
          } else {
            drawerSelectedChefs = ["Family"];
          }
        } else {
          drawerSelectedChefs = drawerSelectedChefs.filter(c => c !== "Family");
          if (drawerSelectedChefs.includes(chef)) {
            if (drawerSelectedChefs.length > 1) {
              drawerSelectedChefs = drawerSelectedChefs.filter(c => c !== chef);
            }
          } else {
            drawerSelectedChefs.push(chef);
          }
        }
        updateDrawerChefsUI();
      };
    }
  });

  // Custom meal form submission in drawer (Item 7: Overwrite protection)
  const customForm = document.getElementById("form-custom-meal");
  if (customForm && !customForm.hasAttribute("data-wired")) {
    customForm.setAttribute("data-wired", "true");
    customForm.onsubmit = (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("custom-meal-title");
      const title = titleInput ? titleInput.value.trim() : "";
      if (!title) return;

      const checkedRadio = document.querySelector("input[name='custom-meal-category']:checked");
      const category = checkedRadio ? checkedRadio.value : currentPlanningSlot;
      const cookInput = document.getElementById("drawer-cook-input");
      const cook = (cookInput && cookInput.value.trim()) || (drawerSelectedChefs.length > 0 ? drawerSelectedChefs.join(" & ") : "Steve");
      const notesInput = document.getElementById("custom-meal-notes");
      const notes = notesInput ? notesInput.value.trim() : "";

      // Item 7: Check if meal already exists and confirm overwrite
      const existingMeal = getMealForDate(currentPlanningDateStr, category);
      if (existingMeal && existingMeal.title && existingMeal.title.trim().length > 0) {
        if (existingMeal.title.trim().toLowerCase() !== title.toLowerCase()) {
          const slotCap = category.charAt(0).toUpperCase() + category.slice(1);
          const ok = confirm(`There is already a meal planned for ${slotCap}:\n"${existingMeal.title}"\n\nDo you want to overwrite it with "${title}"?`);
          if (!ok) return;
        }
      }

      const emojiMap = {
        breakfast: "🥞",
        lunch: "🥪",
        dinner: "🥘",
        snack: "🍫"
      };

      setMealForDate(currentPlanningDateStr, {
        title: title,
        emoji: emojiMap[category] || "🍽️",
        cook: cook,
        notes: notes,
        tags: notes,
        category: category,
        hasRecipe: false
      }, category);

      if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
      if (typeof showCalendarToast === "function") {
        const slotCap = category.charAt(0).toUpperCase() + category.slice(1);
        showCalendarToast(`Saved custom meal: ${title} (${slotCap})!`);
      }

      if (titleInput) titleInput.value = "";
      if (notesInput) notesInput.value = "";

      renderMealsView();
      renderWeekCalendar();
      closePlanMealDrawer();
    };
  }

  // Wire Add Recipe from Photo (Camera & Gallery Import using Gemini AI)
  wirePhotoRecipeImportListeners();
}
window.wireMealsEventListeners = wireMealsHeaderAndDrawerListeners;

// ============================================================================
// ADD RECIPE FROM PHOTO (Gemini 1.5 Flash Multimodal Vision Extraction)
// ============================================================================
let currentScannedRecipeData = null;

// Guardrail constants: Daily Allowance & Anti-Spam Debounce
const MAX_DAILY_PHOTO_SCANS = 15;
const PHOTO_SCAN_COOLDOWN_MS = 4000;
let isPhotoScanningActive = false;
let lastPhotoScanTimestamp = 0;

// Helper: Track & check daily recipe photo scanning quota
function getDailyPhotoScanQuota() {
  try {
    const todayKey = (typeof getLocalDateKey === "function") 
      ? getLocalDateKey(new Date()) 
      : new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem("turnbull_photo_scan_quota");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === todayKey) {
        return { count: parsed.count || 0, date: todayKey };
      }
    }
    return { count: 0, date: todayKey };
  } catch (e) {
    return { count: 0, date: "today" };
  }
}

function incrementDailyPhotoScanQuota() {
  try {
    const quota = getDailyPhotoScanQuota();
    quota.count += 1;
    localStorage.setItem("turnbull_photo_scan_quota", JSON.stringify(quota));
    return quota.count;
  } catch (e) {
    return 1;
  }
}

// Ultra-compact storage compression for Firestore 1MB doc shield & localStorage quota (~20-25KB)
function compressImageForStorage(dataUrl, maxDimension = 480, quality = 0.65) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith("data:image")) return resolve(dataUrl || "");
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// Helper: compress image using HTML5 Canvas to keep latency low (<2s) and memory lightweight
function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = dataUrl.split(",")[1];
        resolve({ dataUrl, base64Data, mimeType: "image/jpeg" });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Call Gemini 1.5 Flash multimodal vision API to extract recipe structure
async function parseRecipeFromPhoto(base64Data, mimeType = "image/jpeg") {
  const apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;
  const prompt = `You are an expert culinary assistant and OCR recipe parser for a family cookbook app.
Analyze this photo of a cookbook page, recipe card, food packaging, magazine clipping, or handwritten note.
Extract the recipe into clean, structured JSON.

Return ONLY a single valid JSON object with NO markdown formatting, no code fences, no backticks, and no extra commentary.

The JSON object MUST contain:
- "title": Clean, appetizing dish name (e.g. "Grandma's Apple Pie", "Classic Spaghetti Bolognese", "Creamy Tomato Basil Soup")
- "subtitle": Short description or highlight of key flavors/texture (e.g. "Fluffy cinnamon spiced filling with golden flaky butter crust")
- "category": One of ["dinner", "lunch", "breakfast", "snack"]. Default to "dinner" if ambiguous.
- "prepTime": Estimated preparation time (e.g. "15 mins", "20 mins", or "5 mins" if ready-to-eat)
- "cookTime": Estimated cooking time (e.g. "30 mins", "1 hour 15 mins", or "0 mins" / "5 mins" if no cooking required)
- "servings": Number of servings as an integer (e.g. 4)
- "ingredients": Array of ingredient strings with quantities and units where available (e.g. ["500g minced beef", "1 medium onion (diced)", "2 tbsp olive oil"])
- "instructions": Array of step-by-step cooking instruction strings (e.g. ["Preheat oven to 180°C.", "Sauté chopped onions in olive oil until golden.", "Simmer sauce on low heat for 25 minutes."])
- "tags": Array of relevant tags from ["kid-fav", "quick", "veggie", "pasta", "meat", "healthy", "comfort-food"]
- "emoji": One suitable food emoji for this dish (e.g. "🥧", "🍝", "🍗", "🥗", "🥘")

If text is partially obscured or missing details, use your culinary expertise to infer sensible, delicious defaults.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error("No extraction response received from Gemini AI");
  return JSON.parse(rawJson);
}

// Modal Show/Hide Helpers
function openPhotoScanningModal(initialDataUrl = "") {
  const modal = document.getElementById("photo-recipe-scanning-modal");
  if (!modal) return;
  const imgEl = document.getElementById("photo-scan-img-preview");
  if (imgEl) imgEl.src = initialDataUrl || "";
  const titleEl = document.getElementById("photo-scan-title");
  const subEl = document.getElementById("photo-scan-status-text");
  if (titleEl) titleEl.textContent = "Scanning Recipe...";
  if (subEl) subEl.textContent = "Gemini AI is reading ingredients & instructions";

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closePhotoScanningModal() {
  const modal = document.getElementById("photo-recipe-scanning-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function openPhotoReviewModal(recipe) {
  const modal = document.getElementById("photo-recipe-review-modal");
  if (!modal) return;

  const heroImg = document.getElementById("photo-review-hero-img");
  const titleInput = document.getElementById("review-recipe-title");
  const subInput = document.getElementById("review-recipe-subtitle");
  const catSelect = document.getElementById("review-recipe-category");
  const prepInput = document.getElementById("review-recipe-prep");
  const cookInput = document.getElementById("review-recipe-cook");
  const servingsInput = document.getElementById("review-recipe-servings");
  const ingTextarea = document.getElementById("review-recipe-ingredients");
  const instTextarea = document.getElementById("review-recipe-instructions");

  if (heroImg) heroImg.src = recipe.image || recipe.imageUrl || "";
  if (titleInput) titleInput.value = recipe.title || "";
  if (subInput) subInput.value = recipe.subtitle || "";
  if (catSelect) catSelect.value = (recipe.category || recipe.mealType || "dinner").toLowerCase();
  if (prepInput) prepInput.value = recipe.prepTime || "15 mins";
  if (cookInput) cookInput.value = recipe.cookTime || "30 mins";
  if (servingsInput) servingsInput.value = recipe.servings || 4;
  if (ingTextarea) ingTextarea.value = (recipe.ingredients || []).join("\n");
  if (instTextarea) instTextarea.value = (recipe.instructions || []).join("\n");

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closePhotoReviewModal() {
  const modal = document.getElementById("photo-recipe-review-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

// Handle Photo File Selected (from either Camera or Gallery)
async function handleRecipePhotoUpload(file) {
  if (!file) return;

  // Guardrail 1: In-Flight Lock
  if (isPhotoScanningActive) {
    alert("A recipe photo scan is currently running. Please wait for it to finish!");
    return;
  }

  // Guardrail 2: Anti-Spam Cooldown
  const now = Date.now();
  if (now - lastPhotoScanTimestamp < PHOTO_SCAN_COOLDOWN_MS) {
    alert("Please wait a few seconds before scanning another recipe photo.");
    return;
  }

  // Guardrail 3: Daily Scan Allowance Cap (15 scans/day)
  const quota = getDailyPhotoScanQuota();
  if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
    alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
    return;
  }

  // Guardrail 4: File Validation (image type and max 20MB)
  if (!file.type || !file.type.startsWith("image/")) {
    alert("Please select a valid image file (JPEG, PNG, HEIC, or WebP).");
    return;
  }
  const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert("The selected photo is larger than 20MB. Please choose a standard camera photo or screenshot.");
    return;
  }

  isPhotoScanningActive = true;
  openPhotoScanningModal();

  try {
    const { dataUrl, base64Data, mimeType } = await compressImageFile(file, 1280, 0.82);
    const imgEl = document.getElementById("photo-scan-img-preview");
    if (imgEl) imgEl.src = dataUrl;

    const parsed = await parseRecipeFromPhoto(base64Data, mimeType);

    currentScannedRecipeData = {
      id: `custom-${Date.now()}`,
      title: (parsed.title || "Scanned Recipe").trim(),
      subtitle: (parsed.subtitle || "").trim(),
      category: (parsed.category || currentPlanningSlot || "dinner").toLowerCase(),
      mealType: (parsed.category || currentPlanningSlot || "dinner").toLowerCase(),
      prepTime: parsed.prepTime || "15 mins",
      cookTime: parsed.cookTime || "30 mins",
      servings: parseInt(parsed.servings, 10) || 4,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["custom"],
      emoji: parsed.emoji || "🥘",
      image: dataUrl,
      imageUrl: dataUrl,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // Increment consumed scan count upon successful extraction
    incrementDailyPhotoScanQuota();

    closePhotoScanningModal();
    openPhotoReviewModal(currentScannedRecipeData);

    if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  } catch (err) {
    console.error("Photo recipe extraction error:", err);
    closePhotoScanningModal();
    alert("Could not read recipe details from that photo. Please make sure the photo clearly shows recipe ingredients or steps, and try again!");
  } finally {
    isPhotoScanningActive = false;
    lastPhotoScanTimestamp = Date.now();
  }
}

// Save Recipe from Review Modal
async function saveReviewedPhotoRecipe(andPlan = false) {
  if (!currentScannedRecipeData) return;

  const titleInput = document.getElementById("review-recipe-title");
  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) {
    alert("Please enter a title for this recipe before saving!");
    if (titleInput) titleInput.focus();
    return;
  }

  const subInput = document.getElementById("review-recipe-subtitle");
  const catSelect = document.getElementById("review-recipe-category");
  const prepInput = document.getElementById("review-recipe-prep");
  const cookInput = document.getElementById("review-recipe-cook");
  const servingsInput = document.getElementById("review-recipe-servings");
  const ingTextarea = document.getElementById("review-recipe-ingredients");
  const instTextarea = document.getElementById("review-recipe-instructions");

  const rawIngredients = ingTextarea ? ingTextarea.value.split("\n") : [];
  const cleanedIngredients = rawIngredients
    .map(s => s.trim().replace(/^[-*•\d+\.]\s*/, "").trim())
    .filter(Boolean);

  const rawInstructions = instTextarea ? instTextarea.value.split("\n") : [];
  const cleanedInstructions = rawInstructions
    .map(s => s.trim().replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);

  const prepStr = (prepInput && prepInput.value.trim()) || "15 mins";
  const cookStr = (cookInput && cookInput.value.trim()) || "30 mins";
  const cat = (catSelect && catSelect.value) || "dinner";

  // Compress photo down to ultra-compact storage thumbnail (~20-25KB)
  const storageImg = await compressImageForStorage(currentScannedRecipeData.imageUrl, 480, 0.65);

  const updated = {
    ...currentScannedRecipeData,
    title: title,
    subtitle: (subInput && subInput.value.trim()) || "",
    category: cat,
    mealType: cat,
    prepTime: prepStr,
    cookTime: cookStr,
    servings: (servingsInput && parseInt(servingsInput.value, 10)) || 4,
    ingredients: cleanedIngredients.length > 0 ? cleanedIngredients : ["Ingredients as directed in recipe"],
    instructions: cleanedInstructions.length > 0 ? cleanedInstructions : ["Cook and serve according to recipe steps."],
    totalMinutes: (parseInt(prepStr, 10) || 0) + (parseInt(cookStr, 10) || 0),
    image: storageImg,
    imageUrl: storageImg
  };

  // 1. Add to local custom recipes storage (capped at 50)
  addCustomRecipe(updated);

  // 2. Sync to Firestore boards/turnbull with 1MB Document Shield
  if (db) {
    try {
      const boardDocRef = doc(db, "boards", currentBoardId);
      const raw = localStorage.getItem("turnbull_custom_recipes");
      let list = [];
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed.filter(r => r && typeof r === "object" && r.id);
        }
      } catch (e) {}
      if (!list.length) list = [updated];
      // Cap at 50
      list = list.slice(0, 50);

      // Firestore 1MB document shield: if total payload exceeds 600KB, prune image data from older entries
      if (JSON.stringify(list).length > 600000) {
        list = list.map((r, idx) => {
          if (idx < 15) return r; // keep photos for 15 most recent
          return { ...r, image: "", imageUrl: "" };
        });
      }

      updateDoc(boardDocRef, {
        customRecipes: list,
        updatedAt: serverTimestamp()
      }).catch(() => {
        setDoc(boardDocRef, { customRecipes: list, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      });
    } catch (e) {}
  }

  closePhotoReviewModal();
  renderDrawerRecipeList();

  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
  if (typeof showCalendarToast === "function") {
    const remainingScans = Math.max(0, MAX_DAILY_PHOTO_SCANS - getDailyPhotoScanQuota().count);
    const badge = remainingScans <= 3 ? ` (${remainingScans} scans left today)` : "";
    showCalendarToast(`Saved "${updated.title}" to family recipes!${badge}`);
  }

  // 3. If "Save & Add to Plan" was clicked, open the cooking recipe modal pre-filled
  if (andPlan) {
    openCookingRecipeModal(updated, currentPlanningDateStr, cat);
  }
}

// Wire Event Listeners for Add from Photo
function wirePhotoRecipeImportListeners() {
  const btnTrigger = document.getElementById("btn-trigger-add-from-photo");
  const photoMenu = document.getElementById("photo-import-menu");
  const optCamera = document.getElementById("opt-photo-camera");
  const optGallery = document.getElementById("opt-photo-gallery");
  const cameraInput = document.getElementById("recipe-camera-input");
  const galleryInput = document.getElementById("recipe-gallery-input");
  const newEntryPhotoCard = document.getElementById("btn-new-entry-photo-card");

  if (btnTrigger && photoMenu && !btnTrigger.hasAttribute("data-wired")) {
    btnTrigger.setAttribute("data-wired", "true");
    btnTrigger.onclick = (e) => {
      e.stopPropagation();
      const quota = getDailyPhotoScanQuota();
      if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
        alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
        return;
      }
      const isVisible = photoMenu.style.display === "flex";
      photoMenu.style.display = isVisible ? "none" : "flex";
      btnTrigger.setAttribute("aria-expanded", !isVisible ? "true" : "false");
    };

    document.addEventListener("click", (e) => {
      if (photoMenu.style.display === "flex") {
        if (!photoMenu.contains(e.target) && e.target !== btnTrigger) {
          photoMenu.style.display = "none";
          btnTrigger.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  if (optCamera && cameraInput && !optCamera.hasAttribute("data-wired")) {
    optCamera.setAttribute("data-wired", "true");
    optCamera.onclick = (e) => {
      e.stopPropagation();
      if (photoMenu) photoMenu.style.display = "none";
      if (btnTrigger) btnTrigger.setAttribute("aria-expanded", "false");
      cameraInput.click();
    };
  }

  if (optGallery && galleryInput && !optGallery.hasAttribute("data-wired")) {
    optGallery.setAttribute("data-wired", "true");
    optGallery.onclick = (e) => {
      e.stopPropagation();
      if (photoMenu) photoMenu.style.display = "none";
      if (btnTrigger) btnTrigger.setAttribute("aria-expanded", "false");
      galleryInput.click();
    };
  }

  if (cameraInput && !cameraInput.hasAttribute("data-wired")) {
    cameraInput.setAttribute("data-wired", "true");
    cameraInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleRecipePhotoUpload(file);
        cameraInput.value = "";
      }
    };
  }

  if (galleryInput && !galleryInput.hasAttribute("data-wired")) {
    galleryInput.setAttribute("data-wired", "true");
    galleryInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleRecipePhotoUpload(file);
        galleryInput.value = "";
      }
    };
  }

  if (newEntryPhotoCard && !newEntryPhotoCard.hasAttribute("data-wired")) {
    newEntryPhotoCard.setAttribute("data-wired", "true");
    newEntryPhotoCard.onclick = (e) => {
      e.stopPropagation();
      const quota = getDailyPhotoScanQuota();
      if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
        alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
        return;
      }
      if (galleryInput) galleryInput.click();
    };
  }

  // Scanning Modal Cancel
  const btnCancelScan = document.getElementById("btn-cancel-photo-scan");
  if (btnCancelScan && !btnCancelScan.hasAttribute("data-wired")) {
    btnCancelScan.setAttribute("data-wired", "true");
    btnCancelScan.onclick = () => closePhotoScanningModal();
  }

  // Review Modal Buttons
  const btnCloseReview = document.getElementById("btn-close-photo-review");
  const btnCancelReview = document.getElementById("btn-cancel-photo-review");
  const btnSaveRecipe = document.getElementById("btn-save-photo-recipe");
  const btnSaveAndPlan = document.getElementById("btn-save-and-plan-recipe");

  if (btnCloseReview && !btnCloseReview.hasAttribute("data-wired")) {
    btnCloseReview.setAttribute("data-wired", "true");
    btnCloseReview.onclick = () => closePhotoReviewModal();
  }
  if (btnCancelReview && !btnCancelReview.hasAttribute("data-wired")) {
    btnCancelReview.setAttribute("data-wired", "true");
    btnCancelReview.onclick = () => closePhotoReviewModal();
  }
  if (btnSaveRecipe && !btnSaveRecipe.hasAttribute("data-wired")) {
    btnSaveRecipe.setAttribute("data-wired", "true");
    btnSaveRecipe.onclick = () => saveReviewedPhotoRecipe(false);
  }
  if (btnSaveAndPlan && !btnSaveAndPlan.hasAttribute("data-wired")) {
    btnSaveAndPlan.setAttribute("data-wired", "true");
    btnSaveAndPlan.onclick = () => saveReviewedPhotoRecipe(true);
  }
}

// ============================================================================
// SPRINT 3: MAGIC CALENDAR EVENT IMPORT (AI Flyer, Timetable & Schedule Scanner)
// ============================================================================

function openCalendarMagicSourceModal() {
  const modal = document.getElementById("calendar-source-picker-modal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}
window.openCalendarMagicSourceModal = openCalendarMagicSourceModal;

function closeCalendarMagicSourceModal() {
  const modal = document.getElementById("calendar-source-picker-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}
window.closeCalendarMagicSourceModal = closeCalendarMagicSourceModal;

function openCalendarMagicScanningModal(dataUrl = "") {
  const modal = document.getElementById("calendar-magic-scanning-modal");
  if (!modal) return;
  const imgEl = document.getElementById("magic-scan-img-preview");
  if (imgEl) imgEl.src = dataUrl || "";
  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closeCalendarMagicScanningModal() {
  const modal = document.getElementById("calendar-magic-scanning-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function openCalendarMagicReviewModal(events, flyerDataUrl = "", docTitle = "") {
  const modal = document.getElementById("calendar-magic-review-modal");
  if (!modal) return;

  currentScannedCalendarEvents = (events || []).map((evt, idx) => ({
    id: `scan_${Date.now()}_${idx}`,
    title: (evt.title || "Calendar Event").trim(),
    date: evt.date || getLocalDateKey(new Date()),
    day: evt.day || getDayNameFromDateStr(evt.date),
    time: evt.time || "09:00",
    duration: evt.duration || "1 hour",
    member: evt.member || "Family",
    location: evt.location || "",
    category: evt.category || "Other",
    icon: evt.icon || detectEmojiForTitle(evt.title) || "📅",
    notes: evt.notes || "",
    selected: true
  }));

  currentScannedFlyerDataUrl = flyerDataUrl || "";
  currentScannedDocTitle = docTitle || "Paper Schedule / Flyer";

  const docTitleEl = document.getElementById("magic-review-doc-title");
  if (docTitleEl) docTitleEl.textContent = currentScannedDocTitle;

  const flyerThumb = document.getElementById("magic-review-flyer-thumb");
  if (flyerThumb) flyerThumb.src = currentScannedFlyerDataUrl;

  const flyerFull = document.getElementById("magic-flyer-full-img");
  if (flyerFull) flyerFull.src = currentScannedFlyerDataUrl;

  const flyerExpanded = document.getElementById("magic-flyer-expanded-preview");
  if (flyerExpanded) flyerExpanded.style.display = "none";

  renderMagicEventsReviewList();

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closeCalendarMagicReviewModal() {
  const modal = document.getElementById("calendar-magic-review-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function getDayNameFromDateStr(dateStr) {
  if (!dateStr) return "Monday";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return days[d.getDay()] || "Monday";
    }
  } catch (e) {}
  return "Monday";
}

function renderMagicEventsReviewList() {
  const listEl = document.getElementById("magic-events-review-list");
  if (!listEl) return;

  const countBadge = document.getElementById("magic-review-count-badge");
  const subtitleEl = document.getElementById("magic-review-subtitle");
  const confirmBtn = document.getElementById("btn-confirm-magic-import");

  const totalCount = currentScannedCalendarEvents.length;
  const selectedCount = currentScannedCalendarEvents.filter(e => e.selected).length;

  if (countBadge) countBadge.textContent = `Found ${totalCount} event${totalCount === 1 ? "" : "s"}`;
  if (subtitleEl) subtitleEl.textContent = `Found ${totalCount} event${totalCount === 1 ? "" : "s"}. Review or adjust details before adding to your calendar.`;
  if (confirmBtn) {
    confirmBtn.innerHTML = `<span>🪄 Import ${selectedCount} Event${selectedCount === 1 ? "" : "s"} to Calendar</span>`;
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.style.opacity = selectedCount === 0 ? "0.5" : "1";
    confirmBtn.style.cursor = selectedCount === 0 ? "not-allowed" : "pointer";
  }

  if (totalCount === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
        <p style="font-size: 1.1rem; margin-bottom: 8px;">No events in this review list.</p>
        <p style="font-size: 0.85rem;">Tap below to add an event manually or scan another flyer.</p>
      </div>
    `;
    return;
  }

  const members = ["Ava", "Dara", "Steve", "Sorcha", "Family"];

  listEl.innerHTML = currentScannedCalendarEvents.map((evt, idx) => {
    const isUnselected = !evt.selected;
    const dayName = getDayNameFromDateStr(evt.date);
    return `
      <div class="magic-event-card ${isUnselected ? "is-unselected" : ""}" data-idx="${idx}">
        <div class="magic-card-top-row">
          <input type="checkbox" class="magic-event-select-box" data-idx="${idx}" ${evt.selected ? "checked" : ""} title="Include this event">
          <button type="button" class="magic-event-emoji-btn" data-idx="${idx}" title="Change emoji">${evt.icon || "📅"}</button>
          <input type="text" class="magic-event-title-input" data-idx="${idx}" value="${escapeHtml(evt.title)}" placeholder="Event title..." required>
          <button type="button" class="btn-magic-card-delete" data-idx="${idx}" title="Remove this event">✕</button>
        </div>

        <div class="magic-card-meta-row">
          <input type="date" class="magic-event-date-input" data-idx="${idx}" value="${evt.date || ""}" title="Event Date">
          <span style="font-size: 0.8rem; font-weight: 700; color: #7e22ce; padding: 2px 6px; background: rgba(147, 51, 234, 0.08); border-radius: 6px;">${dayName.slice(0, 3)}</span>
          <input type="time" class="magic-event-time-input" data-idx="${idx}" value="${evt.time || "09:00"}" title="Start Time">
          <select class="magic-event-duration-select" data-idx="${idx}" title="Duration">
            <option value="30 mins" ${evt.duration === "30 mins" ? "selected" : ""}>30 mins</option>
            <option value="45 mins" ${evt.duration === "45 mins" ? "selected" : ""}>45 mins</option>
            <option value="1 hour" ${evt.duration === "1 hour" || !evt.duration ? "selected" : ""}>1 hour</option>
            <option value="1.5 hours" ${evt.duration === "1.5 hours" ? "selected" : ""}>1.5 hours</option>
            <option value="2 hours" ${evt.duration === "2 hours" ? "selected" : ""}>2 hours</option>
            <option value="All Day" ${evt.duration === "All Day" ? "selected" : ""}>All Day</option>
          </select>
          <select class="magic-event-category-select" data-idx="${idx}" title="Category">
            <option value="Sports" ${evt.category === "Sports" ? "selected" : ""}>⚽ Sports</option>
            <option value="School" ${evt.category === "School" ? "selected" : ""}>📚 School</option>
            <option value="Music" ${evt.category === "Music" ? "selected" : ""}>🎵 Music</option>
            <option value="Social" ${evt.category === "Social" ? "selected" : ""}>🎉 Social</option>
            <option value="Health" ${evt.category === "Health" ? "selected" : ""}>🏥 Health</option>
            <option value="Other" ${evt.category === "Other" || !evt.category ? "selected" : ""}>📅 Other</option>
          </select>
        </div>

        <div class="magic-card-members-row">
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">Assign to:</span>
          ${members.map(m => `
            <button type="button" class="magic-member-pill ${evt.member === m ? "is-active" : ""}" data-idx="${idx}" data-member="${m}">
              ${m}
            </button>
          `).join("")}
        </div>

        <div class="magic-card-extra-row">
          <input type="text" class="magic-event-location-input" data-idx="${idx}" value="${escapeHtml(evt.location || "")}" placeholder="📍 Location / venue (e.g. Sports Hall, Pitch 2)...">
          <input type="text" class="magic-event-notes-input" data-idx="${idx}" value="${escapeHtml(evt.notes || "")}" placeholder="📝 Notes / kit reminders...">
        </div>
      </div>
    `;
  }).join("");

  // Wire card inputs
  listEl.querySelectorAll(".magic-event-select-box").forEach(box => {
    box.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].selected = e.target.checked;
        const card = listEl.querySelector(`.magic-event-card[data-idx="${idx}"]`);
        if (card) {
          if (e.target.checked) card.classList.remove("is-unselected");
          else card.classList.add("is-unselected");
        }
        const selCount = currentScannedCalendarEvents.filter(x => x.selected).length;
        if (confirmBtn) {
          confirmBtn.innerHTML = `<span>🪄 Import ${selCount} Event${selCount === 1 ? "" : "s"} to Calendar</span>`;
          confirmBtn.disabled = selCount === 0;
          confirmBtn.style.opacity = selCount === 0 ? "0.5" : "1";
          confirmBtn.style.cursor = selCount === 0 ? "not-allowed" : "pointer";
        }
      }
    };
  });

  listEl.querySelectorAll(".magic-event-title-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].title = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-date-input").forEach(input => {
    input.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].date = e.target.value;
        currentScannedCalendarEvents[idx].day = getDayNameFromDateStr(e.target.value);
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-time-input").forEach(input => {
    input.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].time = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-duration-select").forEach(sel => {
    sel.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].duration = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-category-select").forEach(sel => {
    sel.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].category = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-member-pill").forEach(pill => {
    pill.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(pill.getAttribute("data-idx"), 10);
      const member = pill.getAttribute("data-member");
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].member = member;
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-location-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].location = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-notes-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].notes = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".btn-magic-card-delete").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (!isNaN(idx)) {
        currentScannedCalendarEvents.splice(idx, 1);
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-emoji-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      const emojis = ["📅", "⚽", "🥋", "🏊", "🎤", "📚", "🏥", "🎂", "🏆", "🎨", "🎭", "🍕", "🚗", "✈️"];
      const current = currentScannedCalendarEvents[idx]?.icon || "📅";
      const nextIdx = (emojis.indexOf(current) + 1) % emojis.length;
      const nextEmoji = emojis[nextIdx];
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].icon = nextEmoji;
        btn.textContent = nextEmoji;
      }
    };
  });
}

function addNewManualReviewEvent() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrow);
  const tomorrowDay = getDayNameFromDateStr(tomorrowKey);

  currentScannedCalendarEvents.push({
    id: `manual_${Date.now()}`,
    title: "",
    date: tomorrowKey,
    day: tomorrowDay,
    time: "16:30",
    duration: "1 hour",
    member: "Ava",
    location: "",
    category: "Other",
    icon: "📅",
    notes: "",
    selected: true
  });

  renderMagicEventsReviewList();

  setTimeout(() => {
    const listEl = document.getElementById("magic-events-review-list");
    if (listEl) {
      const inputs = listEl.querySelectorAll(".magic-event-title-input");
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }
  }, 50);
}

async function handleCalendarPhotoUpload(file) {
  if (!file) return;

  if (isMagicEventScanningActive) {
    alert("A calendar schedule scan is currently in progress. Please wait for it to finish!");
    return;
  }

  const now = Date.now();
  if (now - lastMagicEventScanTimestamp < 2500) {
    alert("Please wait a moment before scanning another flyer.");
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Please select a valid image file (JPEG, PNG, HEIC, or WebP).");
    return;
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    alert("The selected image is larger than 20MB. Please use a standard camera photo or screenshot.");
    return;
  }

  isMagicEventScanningActive = true;
  closeCalendarMagicSourceModal();

  try {
    const { dataUrl, base64Data, mimeType } = await compressImageFile(file, 1400, 0.85);
    openCalendarMagicScanningModal(dataUrl);

    const result = await parseCalendarEventsFromPhoto(base64Data, mimeType);

    closeCalendarMagicScanningModal();

    if (!result || !Array.isArray(result.events) || result.events.length === 0) {
      alert("We couldn't detect any specific dates or event times in that photo. Please make sure the photo is sharp, well-lit, and shows the schedule details clearly!");
      return;
    }

    openCalendarMagicReviewModal(result.events, dataUrl, result.documentTitle || "Paper Schedule");
    if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  } catch (err) {
    console.error("Calendar schedule photo extraction error:", err);
    closeCalendarMagicScanningModal();
    alert("Could not read schedule details from that photo. Please try again with a clear photo in good light!");
  } finally {
    isMagicEventScanningActive = false;
    lastMagicEventScanTimestamp = Date.now();
  }
}

async function parseCalendarEventsFromPhoto(base64Data, mimeType = "image/jpeg") {
  const apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;
  const todayIso = getLocalDateKey(new Date());
  const curYear = new Date().getFullYear();

  const prompt = `You are an expert OCR and schedule parser for a family calendar app (The Turnbull Family: Steve, Sorcha, Ava, Dara).
Current reference date today is: ${todayIso}. The current year is ${curYear}.

Analyze this photo of a school newsletter, extracurricular club timetable, sports match schedule/fixtures, birthday party invitation, appointment card, or calendar handout.
Extract ALL distinct events and activities mentioned in the document into structured JSON.

Return ONLY a single valid JSON object with NO markdown formatting, no code fences, no backticks, and no extra commentary.

The JSON object MUST have the following structure:
{
  "documentTitle": "Brief title of flyer or schedule (e.g., 'Spring Football Fixtures', 'St. Peters Term Dates', 'Swim Club')",
  "events": [
    {
      "title": "Clear concise event title (e.g., 'Ava Swimming Gala', 'Dara Football vs St Peters', 'Parents Evening', 'Karate Grading')",
      "date": "YYYY-MM-DD",
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "time": "HH:MM (24-hour format, e.g. '09:30', '15:15', '18:00'. If all-day or time unspecified, use '09:00')",
      "duration": "1 hour" (or '30 mins', '45 mins', '1.5 hours', '2 hours', 'All Day'),
      "member": "Ava" | "Dara" | "Steve" | "Sorcha" | "Family",
      "location": "Location or venue if mentioned (e.g. 'Sports Hall', 'Pitch 3'), otherwise empty string",
      "category": "Sports" | "School" | "Social" | "Music" | "Health" | "Other",
      "icon": "One relevant emoji (e.g. ⚽, 🥋, 🏊, 🎤, 📚, 🏥, 🎂, 🏆, 🎨, 🎭, 📅)",
      "notes": "Short note of kit/equipment, reminders or notes mentioned, otherwise empty string"
    }
  ]
}

Important Instructions:
1. Date parsing: If only day and month are listed (e.g. 'Saturday 14 Nov', '14th November'), resolve to the full 'YYYY-MM-DD' using current year ${curYear} (or ${curYear + 1} if that date has already passed).
2. Turnbull Family member matching:
   - 'Ava': girls' sports, ballet, singing, choir, dance, secondary school activities for Ava.
   - 'Dara': boys' sports, football, rugby, karate, primary/prep school activities for Dara.
   - 'Steve' / 'Sorcha': parents meetings, adult medical/social appointments.
   - 'Family': whole family events, school holidays, term start/end dates, joint social gatherings.
3. If no specific events or dates can be found, return { "documentTitle": "", "events": [] }.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error("No schedule extraction response received from Gemini AI");
  let cleanJson = rawJson.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return JSON.parse(cleanJson);
}

function confirmAndImportMagicEvents() {
  const selected = currentScannedCalendarEvents.filter(x => x.selected);
  if (selected.length === 0) {
    alert("Please select at least one event to import!");
    return;
  }

  const newEvents = selected.map(item => ({
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: (item.title || "Calendar Event").trim(),
    date: item.date || getLocalDateKey(new Date()),
    day: item.day || getDayNameFromDateStr(item.date),
    time: item.time || "09:00",
    duration: item.duration || "1 hour",
    repeat: "none",
    member: item.member || "Family",
    description: [item.location ? `📍 ${item.location}` : "", item.notes ? `📝 ${item.notes}` : ""].filter(Boolean).join(" • "),
    location: item.location || "",
    icon: item.icon || detectEmojiForTitle(item.title) || "📅",
    category: item.category || "Other"
  }));

  if (!familyEvents) familyEvents = loadFamilyEvents();
  familyEvents = familyEvents.concat(newEvents);
  saveFamilyEvents(familyEvents);

  if (typeof renderWeekCalendar === "function") renderWeekCalendar();

  closeCalendarMagicReviewModal();

  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  if (typeof confetti === "function") {
    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }

  if (typeof showCalendarToast === "function") {
    showCalendarToast(`✨ Imported ${newEvents.length} event${newEvents.length === 1 ? "" : "s"} to Turnbull Calendar!`);
  }
}

function wireCalendarMagicImportListeners() {
  const btnHeaderScan = document.getElementById("btn-calendar-magic-scan");
  const fabBtnMagicImport = document.getElementById("fab-action-magic-import");
  const btnEventModalScan = document.getElementById("btn-event-magic-scan");

  const btnCloseSource = document.getElementById("btn-close-magic-source");
  const btnCameraSource = document.getElementById("btn-magic-source-camera");
  const btnGallerySource = document.getElementById("btn-magic-source-gallery");

  const cameraInput = document.getElementById("calendar-camera-input");
  const galleryInput = document.getElementById("calendar-gallery-input");

  const btnCancelScan = document.getElementById("btn-cancel-magic-scan");

  const btnCloseReview = document.getElementById("btn-close-magic-review");
  const btnCancelReview = document.getElementById("btn-cancel-magic-review");
  const btnToggleFlyer = document.getElementById("btn-toggle-flyer-preview");
  const btnSelectAll = document.getElementById("btn-magic-select-all");
  const btnAddAnother = document.getElementById("btn-magic-add-another");
  const btnConfirmImport = document.getElementById("btn-confirm-magic-import");

  if (btnHeaderScan && !btnHeaderScan.hasAttribute("data-wired")) {
    btnHeaderScan.setAttribute("data-wired", "true");
    btnHeaderScan.onclick = (e) => {
      e.preventDefault();
      openCalendarMagicSourceModal();
    };
  }

  if (fabBtnMagicImport && !fabBtnMagicImport.hasAttribute("data-wired")) {
    fabBtnMagicImport.setAttribute("data-wired", "true");
    fabBtnMagicImport.onclick = (e) => {
      e.preventDefault();
      const fabContainer = document.getElementById("calendar-fab-container");
      const fabBackdrop = document.getElementById("calendar-fab-backdrop");
      if (fabContainer) fabContainer.classList.remove("is-open");
      if (fabBackdrop) fabBackdrop.classList.remove("is-active");
      document.body.classList.remove("has-fab-open");
      openCalendarMagicSourceModal();
    };
  }

  if (btnEventModalScan && !btnEventModalScan.hasAttribute("data-wired")) {
    btnEventModalScan.setAttribute("data-wired", "true");
    btnEventModalScan.onclick = (e) => {
      e.preventDefault();
      const eventModal = document.getElementById("event-modal");
      if (eventModal) {
        if (typeof eventModal.close === "function") eventModal.close();
        else eventModal.removeAttribute("open");
      }
      openCalendarMagicSourceModal();
    };
  }

  if (btnCloseSource && !btnCloseSource.hasAttribute("data-wired")) {
    btnCloseSource.setAttribute("data-wired", "true");
    btnCloseSource.onclick = () => closeCalendarMagicSourceModal();
  }

  if (btnCameraSource && cameraInput && !btnCameraSource.hasAttribute("data-wired")) {
    btnCameraSource.setAttribute("data-wired", "true");
    btnCameraSource.onclick = (e) => {
      e.preventDefault();
      closeCalendarMagicSourceModal();
      cameraInput.click();
    };
  }

  if (btnGallerySource && galleryInput && !btnGallerySource.hasAttribute("data-wired")) {
    btnGallerySource.setAttribute("data-wired", "true");
    btnGallerySource.onclick = (e) => {
      e.preventDefault();
      closeCalendarMagicSourceModal();
      galleryInput.click();
    };
  }

  if (cameraInput && !cameraInput.hasAttribute("data-wired")) {
    cameraInput.setAttribute("data-wired", "true");
    cameraInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleCalendarPhotoUpload(file);
        cameraInput.value = "";
      }
    };
  }

  if (galleryInput && !galleryInput.hasAttribute("data-wired")) {
    galleryInput.setAttribute("data-wired", "true");
    galleryInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleCalendarPhotoUpload(file);
        galleryInput.value = "";
      }
    };
  }

  if (btnCancelScan && !btnCancelScan.hasAttribute("data-wired")) {
    btnCancelScan.setAttribute("data-wired", "true");
    btnCancelScan.onclick = () => {
      isMagicEventScanningActive = false;
      closeCalendarMagicScanningModal();
    };
  }

  if (btnCloseReview && !btnCloseReview.hasAttribute("data-wired")) {
    btnCloseReview.setAttribute("data-wired", "true");
    btnCloseReview.onclick = () => closeCalendarMagicReviewModal();
  }

  if (btnCancelReview && !btnCancelReview.hasAttribute("data-wired")) {
    btnCancelReview.setAttribute("data-wired", "true");
    btnCancelReview.onclick = () => closeCalendarMagicReviewModal();
  }

  if (btnToggleFlyer && !btnToggleFlyer.hasAttribute("data-wired")) {
    btnToggleFlyer.setAttribute("data-wired", "true");
    btnToggleFlyer.onclick = (e) => {
      e.preventDefault();
      const preview = document.getElementById("magic-flyer-expanded-preview");
      if (preview) {
        const isHidden = preview.style.display === "none";
        preview.style.display = isHidden ? "block" : "none";
        btnToggleFlyer.innerHTML = isHidden ? "<span>🔼 Hide Photo</span>" : "<span>🔍 View Original Photo</span>";
      }
    };
  }

  if (btnSelectAll && !btnSelectAll.hasAttribute("data-wired")) {
    btnSelectAll.setAttribute("data-wired", "true");
    btnSelectAll.onclick = (e) => {
      e.preventDefault();
      const allSelected = currentScannedCalendarEvents.every(x => x.selected);
      currentScannedCalendarEvents.forEach(x => { x.selected = !allSelected; });
      btnSelectAll.textContent = allSelected ? "Select All" : "Deselect All";
      renderMagicEventsReviewList();
    };
  }

  if (btnAddAnother && !btnAddAnother.hasAttribute("data-wired")) {
    btnAddAnother.setAttribute("data-wired", "true");
    btnAddAnother.onclick = (e) => {
      e.preventDefault();
      addNewManualReviewEvent();
    };
  }

  if (btnConfirmImport && !btnConfirmImport.hasAttribute("data-wired")) {
    btnConfirmImport.setAttribute("data-wired", "true");
    btnConfirmImport.onclick = (e) => {
      e.preventDefault();
      confirmAndImportMagicEvents();
    };
  }
}
window.wireCalendarMagicImportListeners = wireCalendarMagicImportListeners;



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
