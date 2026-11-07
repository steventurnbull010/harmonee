// ============================================================================
// SKYLIGHT MEALS & RECIPES MODULE (js/meals.js)
// 4-Tier Matrix, Plan Drawer, Recipes Bank, Cooking Modal, Grocery List
// ============================================================================

import { 
  PRELOADED_RECIPES, 
  getAllFamilyRecipes, 
  getRecipesByMealType, 
  searchRecipes, 
  findRecipeByIdOrTitle, 
  toggleRecipeFavorite,
  addCustomRecipe
} from "../recipes-data.js?v=150";

let familyGroceryList = null;
window.familyGroceryList = familyGroceryList;
// Today at a glance (a classic script) shows the planned recipe's photo
window.findRecipeByIdOrTitle = findRecipeByIdOrTitle;

let mealsWeekOffset = 0;
window.mealsWeekOffset = mealsWeekOffset;



// ============================================================================
// 16. FAMILY MEALS & DINNER PLANNER (Step 3)
// ============================================================================

// The board's own people, used for the "Who's cooking?" buttons and labels
function getMealCookMembers() {
  return (window.familyMembers && window.familyMembers.length) ? window.familyMembers : ["Steven", "Sorcha", "Ava", "Dara"];
}
function getDefaultMealCook() {
  return getMealCookMembers()[0] || "Family";
}
// "Not sure yet": nobody has said who's cooking. Stored as the cook so the
// meal store (which fills in a default cook when it's empty) keeps it.
const MEAL_COOK_UNKNOWN = "Not sure yet";
const isUnknownCook = (n) => /^not sure( yet)?$/i.test(String(n || "").trim());

// "Steve & Ava" -> ["Steven", "Ava"], using the board's spelling of each name
function splitMealCooks(cookStr) {
  if (!cookStr) return [];
  return String(cookStr).split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean)
    .map(n => (n.toLowerCase() === "family" ? "Family" : isUnknownCook(n) ? MEAL_COOK_UNKNOWN : (window.normalizeFamilyMemberName || normalizeFamilyMemberName)(n)));
}

// The avatar picker used for "Who's cooking" in the Plan Meal panel and the
// recipe card: each person, Everyone, and Not sure yet
function renderCookPickerHtml(selected) {
  const tick = `<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
  return [...getMealCookMembers(), "Family", MEAL_COOK_UNKNOWN].map(name => {
    const fam = name === "Family", unknown = name === MEAL_COOK_UNKNOWN;
    const pal = (!fam && !unknown && typeof window.getMemberPalette === "function") ? window.getMemberPalette(name) : null;
    const color = fam ? "#f59e0b" : unknown ? "#94a3b8" : (pal ? pal.primary : "#0284c7");
    const on = selected.includes(name);
    return `<button type="button" class="chef-select-chip drawer-profile-pill ${on ? "active is-selected" : ""}" data-chef="${escapeHtml(name)}" aria-pressed="${on}" style="--profile-color: ${color};">
      <span class="drawer-profile-avatar">${fam ? "👪" : unknown ? "?" : escapeHtml(name.charAt(0).toUpperCase())}${tick}</span>
      <span class="drawer-profile-name">${fam ? "Everyone" : unknown ? "Not sure" : escapeHtml(name)}</span>
    </button>`;
  }).join("");
}
// Tapping a cook: Everyone and Not sure yet stand alone; people combine
function toggleCookSelection(list, chef) {
  if (chef === "Family" || chef === MEAL_COOK_UNKNOWN) return list.includes(chef) ? [getDefaultMealCook()] : [chef];
  let next = list.filter(c => c !== "Family" && c !== MEAL_COOK_UNKNOWN);
  if (next.includes(chef)) { if (next.length > 1) next = next.filter(c => c !== chef); }
  else next.push(chef);
  return next.length ? next : [chef];
}
function describeCooks(list) {
  if (list.includes(MEAL_COOK_UNKNOWN)) return "Not sure who's cooking yet.";
  const cooks = list.filter(c => c !== "Family");
  if (list.includes("Family") || !cooks.length) return "Everyone's cooking together.";
  return cooks.length === 1 ? `${cooks[0]} is cooking.` : `${cooks.slice(0, -1).join(", ")} & ${cooks[cooks.length - 1]} are cooking.`;
}
// The small cook label on a meal card, tinted with the first cook's colour
function renderMealCookTagHtml(cookStr, className) {
  const cooks = splitMealCooks(cookStr);
  if (cooks.length === 0) return "";
  if (cooks.includes(MEAL_COOK_UNKNOWN)) return `<span class="${className} is-unknown-cook">No cook yet</span>`;
  const first = cooks[0];
  const pal = (first !== "Family" && typeof window.getMemberPalette === "function") ? window.getMemberPalette(first) : null;
  const style = pal ? ` style="background: ${pal.lightBg}; color: ${pal.text}; border: 1px solid ${pal.border};"` : "";
  return `<span class="${className}"${style}>${escapeHtml(cooks.join(" & "))}</span>`;
}

// Meal cards on the grid: overlapping circle avatars like the event cards,
// plus a plain line of names ("Steven & Ava", "Everyone", "No cook yet")
function renderMealCardCooksHtml(cookStr) {
  const cooks = splitMealCooks(cookStr);
  if (!cooks.length) return { names: "", avatars: "" };
  const avatars = cooks.map(n => {
    if (n === MEAL_COOK_UNKNOWN) return `<span class="ev-block-avatar meal-cook-unknown" title="Not sure who's cooking yet">?</span>`;
    if (n === "Family") return `<span class="ev-block-avatar" style="background:#f59e0b" title="Everyone">👪</span>`;
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(n) : null;
    return `<span class="ev-block-avatar" style="background:${pal ? pal.primary : "#0284c7"}" title="${escapeHtml(n)}">${escapeHtml(n.charAt(0).toUpperCase())}</span>`;
  }).join("");
  const names = cooks.includes(MEAL_COOK_UNKNOWN) ? "No cook yet"
    : cooks.includes("Family") ? "Everyone"
    : cooks.length === 1 ? cooks[0] : `${cooks.slice(0, -1).join(", ")} & ${cooks[cooks.length - 1]}`;
  return { names, avatars: `<span class="ev-block-avatars">${avatars}</span>` };
}

function renderChefAvatarsHtml(cookStr) {
  if (!cookStr) return "";
  const chefs = cookStr.split(/&|,|\band\b|\+/i).map(s => s.trim()).filter(Boolean);
  if (chefs.length === 0) return "";

  const avatars = chefs.map(name => {
    const nameLower = name.toLowerCase();
    if (isUnknownCook(name)) {
      return `<div class="avatar-ring" style="background: #94a3b8; border: 2px solid #cbd5e1;" title="Not sure who's cooking yet">?</div>`;
    }
    if (nameLower === "family" || nameLower === "team" || nameLower === "team effort") {
      return `<div class="avatar-ring" style="background: linear-gradient(135deg, #f59e0b, #ec4899); border: 2px solid #fbbf24;" title="Team / Family">👥</div>`;
    }
    const normalized = (window.normalizeFamilyMemberName || normalizeFamilyMemberName)(name);
    const mIdx = (window.familyMembers || ["Steven", "Sorcha", "Ava", "Dara"]).findIndex(m => m.toLowerCase() === normalized.toLowerCase());
    const col = (window.getMemberColor || getMemberColor)(mIdx !== -1 ? mIdx : 0);
    const initial = name.charAt(0).toUpperCase();
    return `<div class="avatar-ring" style="background: ${col.bg}; border: 2px solid ${col.border};" title="Chef: ${escapeHtml(name)}">${escapeHtml(initial)}</div>`;
  }).join("");

  return `<div class="meal-chef-avatars-wrap" title="Chefs: ${escapeHtml(cookStr)}">${avatars}</div>`;
}
window.renderChefAvatarsHtml = renderChefAvatarsHtml;

function getTonightDinnerChoreInfo() {
  const activeWeekKey = (window.getIsoWeekKey || getIsoWeekKey)();
  const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = dayNamesFull[new Date().getDay()] || "Tuesday";

  // 1. Task specifically matching today
  let task = (window.currentTasks || []).find(t => 
    t.title && /dinner|meal/i.test(t.title) &&
    (t.day === todayDayName || t.completedDay === todayDayName)
  );

  // 2. Daily dinner task
  if (!task) {
    task = (window.currentTasks || []).find(t => 
      t.title && /dinner|meal/i.test(t.title) &&
      (t.day === "Daily" || t.taskType === "Daily Task")
    );
  }

  // 3. Fallback to uncompleted dinner task
  if (!task) {
    task = (window.currentTasks || []).find(t => t.title && /dinner|meal/i.test(t.title) && !t.done);
  }

  // 4. Any dinner task
  if (!task) {
    task = (window.currentTasks || []).find(t => t.title && /dinner|meal/i.test(t.title));
  }

  let isDone = false;
  let completer = "";
  const isMoney = (window.boardSettings && window.boardSettings.gameMode) === "money";
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
        completer = (window.normalizeFamilyMemberName || normalizeFamilyMemberName)(typeof rec === "object" && rec !== null ? rec.completedBy : rec);
      }
    } else if (!isDaily && task.done && (!task.completedWeek || task.completedWeek === activeWeekKey)) {
      if (!task.completedDay || task.completedDay === todayDayName) {
        isDone = true;
        completer = (window.normalizeFamilyMemberName || normalizeFamilyMemberName)(task.completedBy);
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
      (window.showCalendarToast || showCalendarToast)(`Tonight's dinner has already been made by ${info.completer}!`);
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

  const currentMeals = (window.weeklyMeals || null) || (window.loadWeeklyMeals || loadWeeklyMeals)();
  const tonightMeal = (currentMeals && currentMeals[todayDayName]) || {};
  const rawCook = (tonightMeal.cook && !isUnknownCook(tonightMeal.cook)) ? tonightMeal.cook : "Steven";
  const cookName = (window.normalizeFamilyMemberName || normalizeFamilyMemberName)(rawCook.split(/&|,|\band\b|\+/i)[0].trim()) || "Steven";

  const isDaily = dinnerTask.day === "Daily" || dinnerTask.taskType === "Daily Task";
  const timestamp = new Date().toISOString();

  if (isDaily) {
    if (!dinnerTask.completedDays) dinnerTask.completedDays = {};
    dinnerTask.completedDays[todayDayName] = {
      completedBy: cookName,
      completedWeek: activeWeekKey,
      completedAt: timestamp
    };
    if (todayDayName === (window.getTodayDayName || getTodayDayName)()) {
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
    const docRef = (window.getTaskDocRef || getTaskDocRef)(dinnerTask.id);
    const updatePayload = isDaily 
      ? { completedDays: dinnerTask.completedDays, ...(todayDayName === (window.getTodayDayName || getTodayDayName)() ? { done: true, completedBy: cookName, completedWeek: activeWeekKey } : {}) }
      : { done: true, completedBy: cookName, completedDay: todayDayName, completedWeek: activeWeekKey, completedAt: serverTimestamp() };
    updateDoc(docRef, updatePayload).catch(console.error);
  }
  (window.saveLocalCache || saveLocalCache)((window.currentTasks || []));
  (window.renderApp || renderApp)();

  // Close cooking/popover modals if open
  closeCookingRecipeModal();
  closeMealDetailsPopover();

  // Audio & Confetti burst
  if (typeof triggerConfettiBurst === "function") triggerConfettiBurst();
  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  // Gamified celebration popup
  if (typeof showGamifiedCelebration === "function") {
    (window.showGamifiedCelebration || showGamifiedCelebration)({
      claimValue: cookName,
      rewardVal: rewardVal,
      isMoney: (window.boardSettings && window.boardSettings.gameMode) === "money",
      currency: (window.boardSettings && window.boardSettings.currency) || "£",
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

let currentPlanningDateStr = null;
let currentPlanningSlot = "dinner";
let currentDrawerTab = "recipes"; // 'recipes' | 'new-entry'
let currentDrawerCategory = "dinner"; // 'breakfast' | 'lunch' | 'dinner' | 'snack'
let currentDrawerTag = "all";

// Grocery List Storage & Helpers
// The grocery list IS the "Groceries" list on the Lists page (js/lists.js),
// so there's one list, synced to every device, wherever you add to it.
function loadFamilyGroceryList() {
  if (typeof window.getGroceriesList !== "function") return familyGroceryList || [];
  familyGroceryList = window.getGroceriesList().items;
  window.familyGroceryList = familyGroceryList;
  return familyGroceryList;
}

// Kept for any older caller: saveFamilyLists works out what changed and
// sends only that, so it can't overwrite another device's changes.
function saveFamilyGroceryList(items) {
  familyGroceryList = items;
  window.familyGroceryList = items;
  if (typeof window.getGroceriesList === "function" && typeof window.saveFamilyLists === "function") {
    window.getGroceriesList().items = items;
    window.saveFamilyLists(window.loadFamilyLists());
  }
  updateGroceryBadgeCount();
}

window.updateGroceryBadgeCount = (...args) => updateGroceryBadgeCount(...args);
function updateGroceryBadgeCount() {
  const badge = document.getElementById("grocery-list-count-badge");
  if (!badge) return;
  const list = loadFamilyGroceryList();
  const unbought = list.filter(i => !i.checked).length;
  badge.textContent = unbought;
}

// Adds a recipe's ingredients to the Groceries list using the shared rules in
// js/grocery.js (amounts add up, bought items come back fresh, salt / pepper /
// oil / water left out unless asked for). sourceKey stops the same planned
// meal being added twice. Returns { added, combined, skipped, already }.
// includeBasics: null uses the device setting (salt, pepper, oil, water)
function addIngredientsToGroceryList(ingredients, sourceTitle = "", sourceKey = "", includeBasics = null) {
  const empty = { added: 0, combined: 0, skipped: [], already: 0 };
  if (!ingredients || !ingredients.length || !window.Grocery) return empty;
  if (typeof window.mutateFamilyLists !== "function") return empty;
  // One synced change: the board re-runs it on its latest Groceries list, so
  // ticks or adds from another device at the same moment are kept. A meal
  // already on the list is skipped, so running it twice is harmless.
  const res = window.mutateFamilyLists({
    type: "groceryAddLines", lines: ingredients.slice(),
    title: sourceTitle, sourceKey: sourceKey || sourceTitle, includeBasics: includeBasics === null ? window.Grocery.includeBasics() : !!includeBasics
  }) || empty;
  updateGroceryBadgeCount();
  return res;
}

// One toast for any "add to list" action
function showGroceryAddToast(res, title) {
  const msg = window.Grocery ? window.Grocery.summary(res, title) : `Added ingredients for ${title}`;
  if (typeof showCalendarToast === "function") (window.showCalendarToast || showCalendarToast)(`🛒 ${msg}`);
}

// Ingredients for a planned meal: saved with it, or from its recipe
function getPlannedMealIngredients(meal) {
  if (!meal) return [];
  if (Array.isArray(meal.ingredients) && meal.ingredients.length) return meal.ingredients;
  const recipe = (meal.recipeId || meal.title) ? findRecipeByIdOrTitle(meal.recipeId || meal.title) : null;
  return recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
}

// "Add this week's meals": every planned breakfast, lunch and dinner in the
// week the Meals page is showing. Each meal and day goes on once, however
// many times this is pressed.
function addWeekMealsToGroceryList() {
  const dates = getMealsWeekDates(window.mealsWeekOffset || 0);
  const total = { added: 0, combined: 0, skipped: [], already: 0, meals: 0 };
  dates.forEach(d => {
    const dateKey = (window.getLocalDateKey || getLocalDateKey)(d);
    ["breakfast", "lunch", "dinner"].forEach(slot => {
      const meal = (window.getMealForDate || getMealForDate)(d, slot);
      if (!meal || !meal.title) return;
      const ings = getPlannedMealIngredients(meal);
      if (!ings.length) return;
      const r = addIngredientsToGroceryList(ings, meal.title, `${meal.title}|${dateKey}|${slot}`);
      total.meals++;
      total.added += r.added; total.combined += r.combined; total.already += r.already;
      r.skipped.forEach(n => { if (!total.skipped.includes(n)) total.skipped.push(n); });
    });
  });
  return total;
}
window.addWeekMealsToGroceryList = addWeekMealsToGroceryList;
window.getPlannedMealIngredients = getPlannedMealIngredients;
window.showGroceryAddToast = showGroceryAddToast;

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

// The meal coming up next, for the + Plan Meal button: breakfast before
// 10am, lunch until 2pm, dinner until 8pm, then tomorrow's breakfast.
function getNextMealToPlan(now) {
  const date = new Date(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10 * 60) return { date, slot: "breakfast" };
  if (minutes < 14 * 60) return { date, slot: "lunch" };
  if (minutes < 20 * 60) return { date, slot: "dinner" };
  date.setDate(date.getDate() + 1);
  return { date, slot: "breakfast" };
}
window.getNextMealToPlan = getNextMealToPlan;

function renderMealsView() {
  const matrixContainer = document.getElementById("skylight-meals-matrix");
  if (!matrixContainer) return;

  const mobileCardsContainer = document.getElementById("meals-mobile-cards-feed");

  updateGroceryBadgeCount();

  const familyTitleEl = document.querySelector(".skylight-meals-family-name");
  if (familyTitleEl) {
    const familyName = window.isDefaultTurnbullBoard ? "Turnbull Family" : ((window.boardSettings || {}).familyName || "Our Family");
    familyTitleEl.textContent = familyName;
  }

  const weekDates = getMealsWeekDates(mealsWeekOffset);
  const today = new Date();
  const todayStr = (window.getLocalDateKey || getLocalDateKey)(today);

  // Update header time/weather
  const mealsClockEl = document.getElementById("meals-live-clock");
  if (mealsClockEl) {
    mealsClockEl.textContent = today.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
    const dateStr = (window.getLocalDateKey || getLocalDateKey)(colDate);
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
      const dateStr = (window.getLocalDateKey || getLocalDateKey)(colDate);
      const meal = (window.getMealForDate || getMealForDate)(colDate, cat.key);
      const hasMeal = !!(meal && meal.title && meal.title.trim().length > 0);

      if (hasMeal) {
        const emoji = meal.emoji || cat.emoji;
        matrixHtml += `
          <div class="matrix-meal-cell" data-date="${dateStr}" data-slot="${cat.key}">
            <div class="meal-block-card meal-cat-${cat.key} meal-card-v2" role="button" tabindex="0" title="${escapeHtml(meal.title)}">
              <span class="ev-block-title meal-card-title"><span class="ev-block-icon" aria-hidden="true">${emoji}</span>${escapeHtml(meal.title)}</span>
              ${(() => { const c = renderMealCardCooksHtml(meal.cook); return c.names ? `<span class="ev-block-time meal-card-cooks">${escapeHtml(c.names)}</span><div class="ev-block-people">${c.avatars}</div>` : ""; })()}
            </div>
          </div>
        `;
      } else {
        matrixHtml += `
          <div class="matrix-meal-cell" data-date="${dateStr}" data-slot="${cat.key}">
            <div class="meal-empty-slot meal-empty-${cat.key}" role="button" tabindex="0" title="Tap to plan ${cat.label} for this day" aria-label="Plan ${cat.label}">
              <span aria-hidden="true">+</span>
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
      const meal = (window.getMealForDate || getMealForDate)(dateStr, slot);
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
      const dateStr = (window.getLocalDateKey || getLocalDateKey)(colDate);
      const isToday = dateStr === todayStr;
      const dayShort = dayShortNames[colDate.getDay()];
      const dayFull = dayFullNames[colDate.getDay()];
      const monthShort = monthShortNames[colDate.getMonth()];
      const dateNum = colDate.getDate();

      // Count planned meals for this day
      let plannedCount = 0;
      categories.forEach(cat => {
        const m = (window.getMealForDate || getMealForDate)(colDate, cat.key);
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
        const meal = (window.getMealForDate || getMealForDate)(colDate, cat.key);
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
          const cookName = splitMealCooks(meal.cook).join(" & ");
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
                    ${cookName ? `<span class="mobile-meal-cook-pill">👨‍🍳 ${escapeHtml(cookName)}</span>` : ""}
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
        const meal = (window.getMealForDate || getMealForDate)(dateStr, slot);
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

let drawerSelectedChefs = [];

// "Who's cooking?" buttons: one per board member, plus Family
function renderDrawerChefChips() {
  const wrap = document.getElementById("drawer-chef-chips-select");
  if (!wrap) return;
  wrap.innerHTML = renderCookPickerHtml(drawerSelectedChefs);
  wrap.querySelectorAll(".chef-select-chip").forEach(chip => {
    chip.setAttribute("data-wired", "true");
    chip.onclick = () => onDrawerChefChipClick(chip.getAttribute("data-chef"));
  });
}

function onDrawerChefChipClick(chef) {
  drawerSelectedChefs = toggleCookSelection(drawerSelectedChefs, chef);
  updateDrawerChefsUI();
}

function updateDrawerChefsUI() {
  document.querySelectorAll("#drawer-chef-chips-select .chef-select-chip").forEach(c => {
    const chef = c.getAttribute("data-chef");
    const on = drawerSelectedChefs.includes(chef);
    c.classList.toggle("is-selected", on);
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", String(on));
  });
  const summary = document.getElementById("drawer-chef-summary");
  if (summary) summary.textContent = describeCooks(drawerSelectedChefs);
  const cookInput = document.getElementById("drawer-cook-input");
  if (cookInput) {
    cookInput.value = drawerSelectedChefs.length > 0 ? drawerSelectedChefs.join(" & ") : getDefaultMealCook();
  }
}

// Open Slide-out "Plan Meal" Drawer (Matching Photo 2)
// Header line ("Tuesday, Nov 10 • Dinner") and date box follow the date and
// meal being planned
function updatePlanDrawerTarget() {
  const targetLabelEl = document.getElementById("drawer-target-slot-label");
  const [y, m, d] = currentPlanningDateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (targetLabelEl) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const slotCapitalized = currentPlanningSlot.charAt(0).toUpperCase() + currentPlanningSlot.slice(1);
    targetLabelEl.textContent = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()} • ${slotCapitalized}`;
  }
  const dateInput = document.getElementById("plan-meal-date-input");
  if (dateInput && dateInput.value !== currentPlanningDateStr) dateInput.value = currentPlanningDateStr;
  // New Entry's Meal Category matches the meal being planned
  document.querySelectorAll("input[name='custom-meal-category']").forEach(radio => {
    radio.checked = radio.value === currentPlanningSlot;
  });
  const customTitle = document.getElementById("custom-meal-title");
  if (customTitle) customTitle.placeholder = `What's for ${currentPlanningSlot}?`;
}

// After planning a meal, show the week it's in (e.g. next Tuesday's)
function showMealsWeekFor(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y) return;
  const target = new Date(y, m - 1, d);
  const mondayOf = (dt) => { const x = new Date(dt); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  mealsWeekOffset = Math.round((mondayOf(target) - mondayOf(new Date())) / (7 * 86400000));
  window.mealsWeekOffset = mealsWeekOffset;
}

// prefill (e.g. from voice): { title, cooks: [names] }. A recipe with that name
// shows in the list to tap; otherwise "New meal" opens with the name typed in.
function openPlanMealDrawer(dateStr, slot = "dinner", prefill = null) {
  currentPlanningDateStr = dateStr || (window.getLocalDateKey || getLocalDateKey)(new Date());
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
  const existingMeal = (window.getMealForDate || getMealForDate)(currentPlanningDateStr, currentPlanningSlot);
  if (existingMeal && existingMeal.cook) {
    drawerSelectedChefs = splitMealCooks(existingMeal.cook);
  } else {
    drawerSelectedChefs = [getDefaultMealCook()];
  }
  renderDrawerChefChips();
  updateDrawerChefsUI();

  // "Thursday, Nov 5 • Dinner" line and the date picker
  updatePlanDrawerTarget();
  const dateInput = document.getElementById("plan-meal-date-input");
  if (dateInput && !dateInput.hasAttribute("data-wired")) {
    dateInput.setAttribute("data-wired", "true");
    dateInput.addEventListener("change", () => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
        currentPlanningDateStr = dateInput.value;
        updatePlanDrawerTarget();
      } else {
        dateInput.value = currentPlanningDateStr; // cleared: put the date back
      }
    });
  }

  // Highlight corresponding category bubble (B, L, D, or S)
  updateDrawerCategoryBubblesUI();

  // Set radio in custom form; choosing a different one there switches the
  // whole panel (bubbles, header, recipe list) to that meal
  const customCatRadios = document.querySelectorAll("input[name='custom-meal-category']");
  customCatRadios.forEach(radio => {
    radio.checked = radio.value === currentPlanningSlot;
    if (!radio.hasAttribute("data-wired")) {
      radio.setAttribute("data-wired", "true");
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        currentPlanningSlot = radio.value;
        currentDrawerCategory = radio.value;
        updateDrawerCategoryBubblesUI();
        updatePlanDrawerTarget();
        renderDrawerRecipeList();
      });
    }
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

  // Voice: the chef(s) and the meal's name
  const searchInput = document.getElementById("recipe-search-input");
  if (searchInput && prefill) searchInput.value = "";
  if (prefill && Array.isArray(prefill.cooks) && prefill.cooks.length) {
    drawerSelectedChefs = [...prefill.cooks];
    renderDrawerChefChips();
    updateDrawerChefsUI();
  }
  if (prefill && prefill.title) {
    const want = prefill.title.toLowerCase();
    const words = want.split(/\s+/).filter(w => w.length > 2);
    const hits = getAllFamilyRecipes().filter(r => {
      const t = String(r.title || "").toLowerCase();
      return t.includes(want) || want.includes(t) || (words.length && words.every(w => t.includes(w)));
    });
    if (hits.length && searchInput) {
      searchInput.value = hits.some(r => String(r.title).toLowerCase().includes(want)) ? prefill.title : hits[0].title;
    } else {
      if (tabNewEntry) tabNewEntry.click();
      if (customTitleInput) customTitleInput.value = prefill.title;
    }
  }

  // Render recipes list
  renderDrawerRecipeList();

  // Open drawer, at the top
  drawer.style.display = "flex";
  if (typeof window.scrollPanelToTop === "function") window.scrollPanelToTop(drawer);
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
    const knownMin = recipe.totalMinutes || (prepMin + cookMin) || 0;
    // Recipes with no time given (TheMealDB's) show none rather than a guess
    let timeDisplay = "";
    if (!knownMin) {
      timeDisplay = "";
    } else if (cookMin === 0) {
      timeDisplay = `${formatMinutesToDuration(prepMin || knownMin)} prep`;
    } else {
      timeDisplay = formatMinutesToDuration(knownMin);
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
          <div class="recipe-row-time">${timeDisplay ? `⏱️ ${timeDisplay} • ` : ""}${escapeHtml(recipe.subtitle || "")}</div>
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
  // Only real recipe details: a meal typed in by hand has no made-up
  // ingredients or method (its notes are shown instead)
  const fullIngredients = ((recipe && recipe.ingredients) || meal.ingredients || []).filter(Boolean);
  const fullInstructions = ((recipe && recipe.instructions) || meal.instructions || []).filter(Boolean);
  const mealNotes = (meal.notes || "").trim();

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

  // Ingredients (with dashes), or the meal's own notes, or nothing at all
  const ingredientsSection = document.getElementById("popover-ingredients-section");
  const ingredientsHeading = ingredientsSection ? ingredientsSection.querySelector(".popover-ingredients-heading") : null;
  if (ingredientsListEl) {
    if (fullIngredients.length) {
      ingredientsListEl.innerHTML = fullIngredients.map(ing => {
        const text = ing.startsWith("-") ? ing : `- ${ing}`;
        return `<li>${escapeHtml(text)}</li>`;
      }).join("");
      if (ingredientsHeading) ingredientsHeading.textContent = "Ingredients:";
    } else if (mealNotes) {
      ingredientsListEl.innerHTML = mealNotes.split("\n").filter(l => l.trim()).map(l => `<li>${escapeHtml(l.trim())}</li>`).join("");
      if (ingredientsHeading) ingredientsHeading.textContent = "Notes:";
    }
  }
  if (ingredientsSection) ingredientsSection.style.display = (fullIngredients.length || mealNotes) ? "" : "none";

  // Method: only for meals with a real recipe
  const instructionsSection = document.getElementById("popover-instructions-section");
  if (instructionsEl) {
    instructionsEl.innerHTML = fullInstructions.map((step, idx) => {
      return `<p style="margin: 0 0 8px 0;"><strong>Step ${idx + 1}:</strong> ${escapeHtml(step)}</p>`;
    }).join("");
  }
  if (instructionsSection) instructionsSection.style.display = fullInstructions.length ? "" : "none";

  // Add to List needs real ingredients; Open Recipe needs a real recipe
  if (btnAddGrocery) btnAddGrocery.style.display = fullIngredients.length ? "" : "none";
  if (btnOpenRecipe) btnOpenRecipe.style.display = recipe ? "" : "none";
  const pillsRow = btnAddGrocery ? btnAddGrocery.parentElement : null;
  if (pillsRow) pillsRow.style.display = (fullIngredients.length || recipe) ? "" : "none";

  // Reset Add to List button state
  if (btnAddGrocery) {
    btnAddGrocery.classList.remove("is-added");
    btnAddGrocery.innerHTML = `<span class="btn-pill-icon">🛒</span> <span class="btn-pill-label">Add to List</span>`;
    btnAddGrocery.onclick = () => {
      const res = addIngredientsToGroceryList(fullIngredients, meal.title, `${meal.title}|${dateStr}|${slot}`);
      btnAddGrocery.classList.add("is-added");
      btnAddGrocery.innerHTML = `<span class="btn-pill-icon">✓</span> <span class="btn-pill-label">On the list</span>`;
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      showGroceryAddToast(res, meal.title);
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
      (window.setMealForDate || setMealForDate)(dateStr, null, slot);
      closeMealDetailsPopover();
      if (window.MealGroceries) window.MealGroceries.afterRemove({ dateStr, slot, meal });
      renderMealsView();
      (window.renderWeekCalendar || renderWeekCalendar)();
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      if (typeof showCalendarToast === "function") {
        (window.showCalendarToast || showCalendarToast)(`Removed ${meal.title} from schedule`);
      }
    };
  }

  if (btnClose) btnClose.onclick = closeMealDetailsPopover;

  if (typeof popover.showModal === "function") popover.showModal();
  else popover.setAttribute("open", "true");
}
window.openMealDetailsPopover = openMealDetailsPopover;

function openPlanMealModalForDate(dateStr, slot = "dinner") {
  const meal = (window.getMealForDate || getMealForDate)(dateStr, slot);
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
let cookingModalChefs = [];

function updateCookingModalChefsUI() {
  const container = document.getElementById("cooking-chef-chips");
  if (!container) return;
  cookingModalChefs = cookingModalChefs.map(n => splitMealCooks(n)[0] || n);
  // Same avatar picker as the Plan Meal panel
  container.innerHTML = renderCookPickerHtml(cookingModalChefs);
  container.querySelectorAll(".chef-select-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cookingModalChefs = toggleCookSelection(cookingModalChefs, chip.getAttribute("data-chef"));
      updateCookingModalChefsUI();
    };
  });
  const summary = document.getElementById("cooking-chef-summary");
  if (summary) summary.textContent = `· ${describeCooks(cookingModalChefs).replace(/\.$/, "")}`;
}

// Breakfast / Lunch / Dinner pills on the recipe card set the (hidden) select
function updateCookingSlotPills(slot) {
  const select = document.getElementById("cooking-plan-slot-select");
  if (select && slot) select.value = slot;
  const current = select ? select.value : slot;
  document.querySelectorAll("#cooking-plan-slot-pills .meal-pill").forEach(b => {
    const on = b.getAttribute("data-category") === current;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
    b.onclick = () => updateCookingSlotPills(b.getAttribute("data-category"));
  });
}

// Open Interactive Cooking Mode Modal with Planning Flow
function openCookingRecipeModal(recipeOrMeal, targetDateStr = null, targetSlot = null) {
  const modal = document.getElementById("cooking-recipe-modal");
  if (!modal) return;

  const recipe = findRecipeByIdOrTitle(recipeOrMeal.id || recipeOrMeal.recipeId || recipeOrMeal.title) || recipeOrMeal;
  currentCookingRecipe = recipe;

  const targetDate = targetDateStr || currentPlanningDateStr || (window.getLocalDateKey || getLocalDateKey)(new Date());
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
  updateCookingSlotPills(targetCategory.toLowerCase());

  // Badge: what kind of recipe it is (it always said "Dinner Recipe")
  const badgeEl = document.getElementById("cooking-badge");
  if (badgeEl) {
    const kind = String(recipe.mealType || recipe.category || targetCategory || "dinner").toLowerCase();
    badgeEl.textContent = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} recipe`;
    badgeEl.setAttribute("data-kind", kind);
  }

  // Pre-fill Chefs in planning footer
  const existingMeal = (window.getMealForDate || getMealForDate)(targetDate, targetCategory);
  if (existingMeal && existingMeal.cook) {
    cookingModalChefs = splitMealCooks(existingMeal.cook);
  } else if (drawerSelectedChefs && drawerSelectedChefs.length > 0) {
    cookingModalChefs = [...drawerSelectedChefs];
  } else {
    cookingModalChefs = [getDefaultMealCook()];
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
      const selectedChefs = (cookingModalChefs && cookingModalChefs.length > 0) ? cookingModalChefs : [getDefaultMealCook()];

      // Confirmation dialog if overwriting an existing planned meal
      const existing = (window.getMealForDate || getMealForDate)(selectedDate, selectedSlot);
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
      (window.setMealForDate || setMealForDate)(selectedDate, {
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
        (window.showCalendarToast || showCalendarToast)(`📅 Planned "${currentCookingRecipe.title}" for ${slotCap}!`);
      }

      showMealsWeekFor(selectedDate);
      renderMealsView();
      (window.renderWeekCalendar || renderWeekCalendar)();
      // Shopping list: take off what the replaced meal needed, add what this one needs
      if (window.MealGroceries) window.MealGroceries.afterPlan({ dateStr: selectedDate, slot: selectedSlot, before: existing, meal: (window.getMealForDate || getMealForDate)(selectedDate, selectedSlot) });
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
    const totalMin = recipe.totalMinutes || (prepMin + cookMin) || 0;

    // Only what the recipe actually says: no made-up times or calories
    let timePills = "";
    if (!totalMin) {
      timePills = "";
    } else if (cookMin === 0) {
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
      ${recipe.servings ? `<span class="cooking-pill">👥 ${recipe.servings} Servings</span>` : ""}
      ${recipe.calories ? `<span class="cooking-pill">🔥 ${escapeHtml(recipe.calories)}</span>` : ""}
    `;
    metaPillsEl.style.display = metaPillsEl.textContent.trim() ? "" : "none";
  }

  // Only what's saved: no made-up ingredients or steps
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  if (checklistEl) {
    checklistEl.innerHTML = ingredients.length ? "" : `<li class="cooking-empty-note">No ingredients saved for this meal.</li>`;
    if (ingredients.length) checklistEl.innerHTML = ingredients.map((ing, idx) => {
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

  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];

  if (stepsListEl) {
    stepsListEl.innerHTML = instructions.length ? "" : `<p class="cooking-empty-note">No method saved for this meal.</p>`;
    if (instructions.length) stepsListEl.innerHTML = instructions.map((step, idx) => {
      return `
        <div class="cooking-step-row">
          <span class="cooking-step-badge">${idx + 1}</span>
          <div class="cooking-step-text">${escapeHtml(step)}</div>
        </div>
      `;
    }).join("");
  }

  // Where the recipe comes from
  const creditEl = document.getElementById("cooking-credit");
  if (creditEl) {
    if (recipe.source === "TheMealDB") {
      const original = recipe.sourceUrl && recipe.sourceUrl !== recipe.mealdbUrl
        ? ` · <a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">Original recipe on ${escapeHtml(recipe.sourceName)}</a>` : "";
      creditEl.innerHTML = `Recipe from <a href="${escapeHtml(recipe.mealdbUrl)}" target="_blank" rel="noopener noreferrer">TheMealDB</a>${original}`;
      creditEl.hidden = false;
    } else {
      creditEl.hidden = true;
      creditEl.textContent = "";
    }
  }

  if (btnAddGrocery) btnAddGrocery.style.display = ingredients.length ? "" : "none";
  if (btnAddGrocery) {
    // Fresh for each recipe (it used to keep saying "Added" on the next one)
    btnAddGrocery.textContent = "＋ Add to grocery list";
    btnAddGrocery.classList.remove("is-added");
    btnAddGrocery.onclick = () => {
      // Keyed to the card's date and meal, like a planned meal, so adding from
      // here and from the plan doesn't double up
      const cardDate = (document.getElementById("cooking-plan-date-input") || {}).value || "";
      const cardSlot = (document.getElementById("cooking-plan-slot-select") || {}).value || "";
      const res = addIngredientsToGroceryList(ingredients, recipe.title, `${recipe.title}|${cardDate}|${cardSlot}`);
      btnAddGrocery.textContent = "✓ On the list";
      btnAddGrocery.classList.add("is-added");
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      showGroceryAddToast(res, recipe.title);
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
    const list = loadFamilyGroceryList();
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
            <label for="chk-${item.id}" class="grocery-item-text">${escapeHtml(window.Grocery ? window.Grocery.displayText(item) : item.text)}${(window.Grocery && window.Grocery.sourcesLabel(item)) ? `<span class="list-row-for">${escapeHtml(window.Grocery.sourcesLabel(item))}</span>` : ""}</label>
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
          const target = loadFamilyGroceryList().find(i => i.id === id);
          if (target) {
            window.mutateFamilyLists({ type: "toggleItem", listId: "groceries", itemId: id, checked: chk.checked });
            renderItems();
          }
        };
      }
      const delBtn = row.querySelector(".btn-grocery-item-del");
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          window.mutateFamilyLists({ type: "deleteItems", listId: "groceries", itemIds: [id] });
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
    window.mutateFamilyLists({ type: "addItems", listId: "groceries", items: [{
      id: "g-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      text: val,
      checked: false,
      source: "Manual",
      addedAt: new Date().toISOString()
    }] });
    quickInput.value = "";
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    renderItems();
  };

  if (btnAdd) btnAdd.onclick = handleAddItem;

  // Add every planned meal in the week the Meals page is showing
  const btnWeek = document.getElementById("btn-grocery-add-week");
  if (btnWeek) btnWeek.onclick = () => {
    const t = addWeekMealsToGroceryList();
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    const msg = !t.meals ? "No planned meals with ingredients this week"
      : window.Grocery.summary(t, `${t.meals} meal${t.meals === 1 ? "" : "s"}`);
    if (typeof showCalendarToast === "function") (window.showCalendarToast || showCalendarToast)(`🛒 ${msg}`);
    renderItems();
  };
  // Salt, pepper, oil and water: left out of recipes unless switched on here
  const basicsToggle = document.getElementById("grocery-include-basics");
  if (basicsToggle && window.Grocery) {
    basicsToggle.checked = window.Grocery.includeBasics();
    basicsToggle.onchange = () => window.Grocery.setIncludeBasics(basicsToggle.checked);
  }
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
      // Only what is ticked on this screen now
      const ticked = loadFamilyGroceryList().filter(i => i.checked).map(i => i.id);
      if (ticked.length) window.mutateFamilyLists({ type: "deleteItems", listId: "groceries", itemIds: ticked });
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
      const next = getNextMealToPlan(new Date());
      openPlanMealDrawer(getLocalDateKey(next.date), next.slot);
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

      // Ignore clicks inside the drawer, or in a pop-up opened from it (the
      // date picker, the recipe card)
      if (drawer.contains(e.target)) return;
      // (it may have just closed, or redrawn the button you tapped, by the
      // time this runs: a picker day redraws the month, Select closes it)
      if (!document.contains(e.target)) return;
      if (e.target.closest && e.target.closest("dialog, .skylight-task-quick-overlay")) return;

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
        updatePlanDrawerTarget();
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

  renderDrawerChefChips();
  document.querySelectorAll("#drawer-chef-chips-select .chef-select-chip").forEach(chip => {
    if (!chip.hasAttribute("data-wired")) {
      chip.setAttribute("data-wired", "true");
      chip.onclick = () => onDrawerChefChipClick(chip.getAttribute("data-chef"));
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
      const cook = (cookInput && cookInput.value.trim()) || (drawerSelectedChefs.length > 0 ? drawerSelectedChefs.join(" & ") : getDefaultMealCook());
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

      // Shopping list: a typed meal that matches a recipe gets its ingredients too
      if (window.MealGroceries) {
        const plannedOn = currentPlanningDateStr;
        setTimeout(() => window.MealGroceries.afterPlan({ dateStr: plannedOn, slot: category, before: existingMeal, meal: getMealForDate(plannedOn, category) }), 300);
      }

      showMealsWeekFor(currentPlanningDateStr);
      renderMealsView();
      renderWeekCalendar();
      closePlanMealDrawer();
    };
  }

  // Wire Add Recipe from Photo (Camera & Gallery Import using Gemini AI)
  if (typeof wirePhotoRecipeImportListeners === "function") wirePhotoRecipeImportListeners();
}
window.wireMealsEventListeners = wireMealsHeaderAndDrawerListeners;

// Exports to window
window.renderChefAvatarsHtml = renderChefAvatarsHtml;
window.getTonightDinnerChoreInfo = getTonightDinnerChoreInfo;
window.completeDinnerChoreForSteve = completeDinnerChoreForSteve;
window.loadFamilyGroceryList = loadFamilyGroceryList;
window.saveFamilyGroceryList = saveFamilyGroceryList;
window.addIngredientsToGroceryList = addIngredientsToGroceryList;
window.getMealsWeekDates = getMealsWeekDates;
window.renderMealsView = renderMealsView;
window.openPlanMealDrawer = openPlanMealDrawer;
window.closePlanMealDrawer = closePlanMealDrawer;
window.openMealDetailsPopover = openMealDetailsPopover;
window.openPlanMealModalForDate = openPlanMealModalForDate;
window.closeMealDetailsPopover = closeMealDetailsPopover;
window.openCookingRecipeModal = openCookingRecipeModal;
window.closeCookingRecipeModal = closeCookingRecipeModal;
window.openGroceryListModal = openGroceryListModal;
