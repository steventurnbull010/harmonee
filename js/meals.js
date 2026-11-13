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
} from "../recipes-data.js?v=b6bad2dc";

let familyGroceryList = null;
window.familyGroceryList = familyGroceryList;
// Today at a glance (a classic script) shows the planned recipe's photo
window.findRecipeByIdOrTitle = findRecipeByIdOrTitle;

let mealsWeekOffset = 0;
window.mealsWeekOffset = mealsWeekOffset;
// The week starts today (yesterday's meals are done with). The arrows move it
// 7 days; swiping or dragging the week moves it a day or two (mealsDayNudge).
let mealsDayNudge = 0;



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
      <span class="drawer-profile-avatar${!fam && !unknown && memberFace(name).buddy ? " is-buddy" : ""}">${fam ? "👪" : unknown ? "?" : memberFace(name).html}${tick}</span>
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
    const f = memberFace(n);
    return `<span class="ev-block-avatar${f.cls}" style="background:${pal ? pal.primary : "#0284c7"};${f.style}" title="${escapeHtml(n)}">${f.html}</span>`;
  }).join("");
  const names = cooks.includes(MEAL_COOK_UNKNOWN) ? "No cook yet"
    : cooks.includes("Family") ? "Everyone"
    : cooks.length === 1 ? cooks[0] : `${cooks.slice(0, -1).join(", ")} & ${cooks[cooks.length - 1]}`;
  return { names, avatars: `<span class="ev-block-avatars">${avatars}</span>` };
}

window.mealCooksHtml = renderMealCardCooksHtml;

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
    const f = memberFace(normalized || name, initial);
    return `<div class="avatar-ring${f.cls}" style="background: ${col.bg}; border: 2px solid ${col.border};${f.style}" title="Chef: ${escapeHtml(name)}">${f.html}</div>`;
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
  let rewardVal = task ? taskReward(task, isMoney) : (isMoney ? 0.3 : 3);

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
      ? { [`completedDays.${todayDayName}`]: dinnerTask.completedDays[todayDayName], ...(todayDayName === (window.getTodayDayName || getTodayDayName)() ? { done: true, completedBy: cookName, completedWeek: activeWeekKey } : {}) }
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
let drawerShowAll = false;
let drawerHeroGlow = false;
// Family favourites: hearted recipe ids, saved with the board (boardSettings.favouriteRecipes)
function favouriteIds() { return ((window.boardSettings || {}).favouriteRecipes) || []; }
function isFavouriteRecipe(r) { return !!r && (favouriteIds().includes(String(r.id)) || !!r.isFavorite); }
function toggleFavouriteRecipe(id) {
  const ids = favouriteIds();
  const on = !ids.includes(String(id));
  const next = on ? [...ids, String(id)] : ids.filter(x => x !== String(id));
  if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ favouriteRecipes: next });
  if (on && typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
  return on;
}
window.isFavouriteRecipe = isFavouriteRecipe; // the recipe picker shows a short list until asked for all (reset when the drawer opens)

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
  // Seven days from today (plus whole weeks, plus any swipe)
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offsetWeeks * 7 + mealsDayNudge);

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

// The recipe a planned meal came from: by its recipe id, or a recipe with
// exactly its name (never a near match: "Pizza" mustn't borrow another
// pizza's photo)
function plannedRecipeFor(meal, all) {
  if (!meal) return null;
  const list = all || getAllFamilyRecipes();
  if (meal.recipeId) { const r = list.find(x => String(x.id) === String(meal.recipeId)); if (r) return r; }
  const t = String(meal.title || "").trim().toLowerCase();
  return t ? list.find(x => String(x.title || "").trim().toLowerCase() === t) || null : null;
}
// Its photo, sized for a card (TheMealDB serves /small and /medium copies)
function mealPhotoUrl(meal, all, size = "medium") {
  const r = plannedRecipeFor(meal, all);
  const src = String((r && (r.image || r.imageUrl)) || "");
  if (/^https:\/\/www\.themealdb\.com\/images\/[\w\/.-]+\.(jpg|png)$/i.test(src)) return `${src}/${size}`;
  // A full address: it goes into a CSS variable, where a relative path would
  // be read from the stylesheet's folder (css/images/... = not found)
  if (/^images\/[\w\/.-]+\.(jpg|jpeg|png|webp)$/i.test(src)) { try { return new URL(src, document.baseURI).href; } catch (e) { return src; } }
  if (window.RecipePhotos && window.RecipePhotos.isDataUrl(src)) return src;
  return "";
}
window.mealPhotoUrl = mealPhotoUrl;

// "+ Colcannon · 🍮 Apple crumble": a meal's other dishes, under its name
function mealMoreDishesHtml(meal, className) {
  const more = window.MealDishes ? window.MealDishes.dishesOf(meal).slice(1) : [];
  if (!more.length) return "";
  return `<span class="${className}">${more.map(d => d.course === "pudding" ? `<span class="meal-more-pud">🍮 ${escapeHtml(d.title)}</span>` : `<span>+ ${escapeHtml(d.title)}</span>`).join(`<span aria-hidden="true"> · </span>`)}</span>`;
}
window.mealMoreDishesHtml = mealMoreDishesHtml;

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

  const recipesAll = getAllFamilyRecipes();

  // =========================================================================
  // 1. DESKTOP / TABLET: 3-Tier Skylight Grid Matrix
  // =========================================================================
  let matrixHtml = `<div class="matrix-corner-cell"></div>`;

  weekDates.forEach((colDate, colIdx) => {
    const dateStr = (window.getLocalDateKey || getLocalDateKey)(colDate);
    const isToday = dateStr === todayStr;
    const dayName = dayShortNames[colDate.getDay()];
    const dateNum = colDate.getDate();
    // The month by the first day, and again where a new month starts
    const month = colIdx === 0 || dateNum === 1 ? monthShortNames[colDate.getMonth()] : "";

    matrixHtml += `
      <div class="matrix-day-header-cell ${isToday ? 'is-today-col' : ''}${dateNum === 1 && colIdx ? ' is-month-start' : ''}">
        <span class="matrix-day-label">${dayName}</span>
        <span class="matrix-date-row"><span class="matrix-date-number ${isToday ? 'is-today-badge' : ''}">${dateNum}</span>${month ? `<span class="matrix-month">${month}</span>` : ""}</span>
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
        const photo = mealPhotoUrl(meal, recipesAll);
        matrixHtml += `
          <div class="matrix-meal-cell" data-date="${dateStr}" data-slot="${cat.key}">
            <div class="meal-block-card meal-cat-${cat.key} meal-card-v2${photo ? " has-photo" : ""}" role="button" tabindex="0" title="${escapeHtml(meal.title)}"${photo ? ` style="--meal-photo: url('${escapeHtml(photo)}')"` : ""}>
              <span class="ev-block-title meal-card-title"><span class="ev-block-icon" aria-hidden="true">${escapeHtml(emoji)}</span>${escapeHtml(meal.title)}</span>
              ${mealMoreDishesHtml(meal, "meal-card-more")}
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
  wireMealsSwipe();
  wireMealMoveDrag(matrixContainer, ".meal-card-v2");
  fitMealCards(matrixContainer);
  watchMealCardFit(matrixContainer);

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
        <div class="meals-mobile-day-card ${isToday ? 'is-today-card' : ''}" id="mobile-meal-day-${dateStr}" data-day="${dateStr}" data-day-short="${dayShort}" data-day-num="${dateNum}" data-planned="${categories.map(cat => { const m = (window.getMealForDate || getMealForDate)(colDate, cat.key); return m && m.title && m.title.trim() ? 1 : 0; }).join("")}">
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
          const photo = mealPhotoUrl(meal, recipesAll, "small");

          feedHtml += `
            <div class="mobile-slot-card mobile-slot-card-${cat.key}" role="button" tabindex="0" data-date="${dateStr}" data-slot="${cat.key}" title="Tap to view meal details: ${escapeHtml(meal.title)}">
              <div class="mobile-meal-main">
                ${photo ? `<span class="mobile-meal-photo" style="background-image: url('${escapeHtml(photo)}')" aria-hidden="true"></span>` : `<span class="mobile-meal-emoji">${escapeHtml(emoji)}</span>`}
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

    const shownDay = mealsPhoneShownDay;
    mobileCardsContainer.innerHTML = feedHtml;
    wireMealMoveDrag(mobileCardsContainer, ".mobile-slot-card");
    renderMealDayTabs(mobileCardsContainer, shownDay, todayStr);

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

  // "A few ideas" above the week, to drag onto a free slot (js/meal-ideas.js)
  if (window.MealIdeas) window.MealIdeas.render(weekDates.map(d => (window.getLocalDateKey || getLocalDateKey)(d)), recipesAll);
  // Phones: the week as one scrolling list, dinner first (js/meals-phone.js)
  if (window.MealsPhone) window.MealsPhone.render(weekDates.map(d => (window.getLocalDateKey || getLocalDateKey)(d)), recipesAll);
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  const start = mealsWeekOffset * 7 + mealsDayNudge;
  if (diff >= start && diff < start + 7) return; // already showing
  mealsDayNudge = 0;
  mealsWeekOffset = Math.floor(diff / 7);
  window.mealsWeekOffset = mealsWeekOffset;
}

// prefill (e.g. from voice): { title, cooks: [names] }. A recipe with that name
// shows in the list to tap; otherwise "New meal" opens with the name typed in.
function openPlanMealDrawer(dateStr, slot = "dinner", prefill = null) {
  currentPlanningDateStr = dateStr || (window.getLocalDateKey || getLocalDateKey)(new Date());
  currentPlanningSlot = slot || "dinner";
  currentDrawerCategory = currentPlanningSlot;
  drawerShowAll = false;
  drawerHeroGlow = true;

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

  // Category filter. Not while searching: a pudding saved as a snack (or
  // pancakes saved as breakfast) is still found when you're planning dinner.
  if (currentDrawerCategory && currentDrawerCategory !== "all" && !query) {
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
      // A recipe saved without a title or with odd ingredients mustn't break search
      const titleMatch = String(r.title || "").toLowerCase().includes(qLower);
      const subMatch = String(r.subtitle || "").toLowerCase().includes(qLower);
      const ingMatch = Array.isArray(r.ingredients) && r.ingredients.some(i => String(i || "").toLowerCase().includes(qLower));
      return titleMatch || subMatch || ingMatch;
    });
  }

  // Nothing searched or filtered yet: a short list, not all 200
  const browsing = !query && (!currentDrawerTag || currentDrawerTag === "all");
  const slotWord = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" }[currentDrawerCategory] || "meal";
  let visible = recipes, footer = "";
  renderDrawerMagicHero();
  const strips = document.getElementById("drawer-recipe-strips");
  if (strips) { strips.hidden = true; strips.innerHTML = ""; }
  if (browsing && !drawerShowAll && recipes.length > 8) {
    const favs = recipes.filter(isFavouriteRecipe);
    // All the family's own recipes, whatever meal they're saved under (a
    // crumble saved as a snack shows when planning dinner), this meal's first
    const isMeal = (r) => [r.mealType, r.category].some(v => String(v || "").toLowerCase() === String(currentDrawerCategory || "").toLowerCase());
    // (by id: each getAllFamilyRecipes() call gives fresh copies of your own)
    const favIds = new Set(favs.map(r => String(r.id)));
    const own = getAllFamilyRecipes().filter(r => !favIds.has(String(r.id)) && !String(r.id || "").startsWith("mealdb-"))
      .sort((a, b) => Number(isMeal(b)) - Number(isMeal(a)));
    const ownIds = new Set(own.map(r => String(r.id)));
    const fits = (r) => !window.MealGenie || !window.MealGenie.fitsEveryone || window.MealGenie.fitsEveryone(r);
    const builtIn = recipes.filter(r => !favIds.has(String(r.id)) && !ownIds.has(String(r.id)));
    const pool = builtIn.filter(fits).length >= 6 ? builtIn.filter(fits) : builtIn;
    // Six ideas spread across the whole list (it's grouped by kind), a different six each day
    const day = Math.floor(Date.now() / 86400000);
    const step = Math.max(1, Math.floor(pool.length / 6));
    const start = pool.length ? (day * 7) % pool.length : 0;
    const ideas = [];
    for (let i = 0; ideas.length < Math.min(6, pool.length) && i < pool.length * 2; i++) {
      const r = pool[(start + i * step + Math.floor(i / 6)) % pool.length];
      if (!ideas.includes(r)) ideas.push(r);
    }
    const tasteful = window.MealGenie && window.MealGenie.peopleWithTastes && window.MealGenie.peopleWithTastes().length;
    // Rows of photos to tap (your own and favourites first), not lists of text
    const strip = (title, list, note = "") => list.length
      ? `<p class="drawer-recipes-heading">${title}${note ? ` <span class="drawer-strip-note">${note}</span>` : ""}</p><div class="drawer-photo-strip">${list.map(recipeTileHtml).join("")}</div>`
      : "";
    const stripsHtml = strip("Your recipes", own)
      + strip("❤️ Family favourites", favs)
      + strip(`A few ${slotWord} ideas`, ideas, tasteful && pool !== builtIn ? "Picked to suit everyone" : "");
    // Above the search when it can be (the list under it then just offers the rest)
    if (strips) { strips.innerHTML = stripsHtml; strips.hidden = !stripsHtml; wireDrawerRecipeRows(strips); }
    container.innerHTML = (strips ? "" : stripsHtml)
      + `<button type="button" class="drawer-recipes-more" data-drawer-show-all>Browse all ${recipes.length} ${slotWord} recipes</button>`;
    wireDrawerRecipeRows(container);
    return;
  }
  if (!drawerShowAll && recipes.length > 30) {
    visible = recipes.slice(0, 30);
    footer = `<button type="button" class="drawer-recipes-more" data-drawer-show-all>Show ${recipes.length - 30} more</button>`;
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

  container.innerHTML = visible.map(recipeRowHtml).join("") + footer;
  wireDrawerRecipeRows(container);
}

// Magic Mealtime, front and centre in the drawer (above the search)
function renderDrawerMagicHero() {
  const pane = document.getElementById("pane-from-recipes");
  if (!pane) return;
  let hero = document.getElementById("drawer-magic-hero");
  if (!hero) {
    hero = document.createElement("div");
    hero.id = "drawer-magic-hero";
    // A slim row under the recipe photos, above the search
    pane.insertBefore(hero, pane.querySelector(".drawer-search-filter-row") || pane.firstChild);
    hero.addEventListener("click", (e) => {
      if (!window.MealGenie) return;
      if (e.target.closest("[data-drawer-tastes]")) { window.MealGenie.openTastes(); return; }
      if (e.target.closest("[data-drawer-genie]")) window.MealGenie.open(currentPlanningSlot, { date: currentPlanningDateStr });
    });
  }
  const slotWord = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" }[currentPlanningSlot] || "meal";
  const names = window.MealGenie && window.MealGenie.peopleWithTastes ? window.MealGenie.peopleWithTastes() : [];
  const who = names.length === 0 ? "Answer a few quick questions, get three ideas."
    : names.length <= 2 ? `Knows what ${names.join(" and ")} eat${names.length === 1 ? "s" : ""}.`
    : `Knows what ${names.slice(0, 2).join(", ")} +${names.length - 2} eat.`;
  // One slim row (it was a big purple card above everything)
  hero.innerHTML = `<div class="magic-slim">
      <button type="button" class="magic-slim-main" data-drawer-genie title="${escapeHtml(who)}">
        <span class="magic-slim-wand" aria-hidden="true">🪄</span>
        <span class="magic-slim-words"><strong>Not sure?</strong> Find me a ${escapeHtml(slotWord)}</span>
      </button>
      <button type="button" class="magic-slim-tastes" data-drawer-tastes>Who eats what</button>
    </div>`;
  // A gentle glow each time the drawer opens (not on every search keystroke)
  if (drawerHeroGlow) { drawerHeroGlow = false; hero.classList.remove("is-glowing"); void hero.offsetWidth; hero.classList.add("is-glowing"); }
}
document.addEventListener("harmonee:tastes-changed", () => {
  if (document.getElementById("drawer-recipes-list")) renderDrawerRecipeList();
});

function wireDrawerRecipeRows(container) {
  container.querySelectorAll("[data-fav]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const on = toggleFavouriteRecipe(btn.getAttribute("data-fav"));
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.innerHTML = window.heartIcon(on);
      if (on) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
      // Move it into (or out of) Family favourites after the little pop
      setTimeout(renderDrawerRecipeList, on ? 450 : 0);
    };
  });
  container.querySelectorAll(".drawer-recipe-card").forEach(card => {
    card.onclick = () => {
      const rId = card.getAttribute("data-recipe-id");
      const recipe = findRecipeByIdOrTitle(rId);
      if (recipe) {
        openCookingRecipeModal(recipe, currentPlanningDateStr, currentPlanningSlot);
      }
    };
  });
  const more = container.querySelector("[data-drawer-show-all]");
  if (more) more.onclick = () => { drawerShowAll = true; renderDrawerRecipeList(); };
}

// A photo tile for Plan Meal's rows of photos (same tap as a recipe row)
function recipeTileHtml(recipe) {
  const src = String(recipe.image || recipe.imageUrl || "");
  const photo = /^https:\/\/www\.themealdb\.com\/images\/[\w\/.-]+\.(jpg|png)$/i.test(src) ? `${src}/small`
    : /^images\/[\w\/.-]+\.(jpg|jpeg|png|webp)$/i.test(src) || (window.RecipePhotos && window.RecipePhotos.isDataUrl(src)) ? src : "";
  return `<button type="button" class="drawer-recipe-card drawer-recipe-tile" data-recipe-id="${escapeHtml(String(recipe.id))}" title="${escapeHtml(recipe.title)}">
      <span class="drawer-tile-photo"${photo ? ` style="background-image: url('${escapeHtml(photo)}')"` : ""} aria-hidden="true">${photo ? "" : escapeHtml(recipe.emoji || "🍽️")}</span>
      <span class="drawer-tile-title">${escapeHtml(recipe.title)}</span>
    </button>`;
}

function recipeRowHtml(recipe) {
  const categoryBadgeMap = { breakfast: "badge-b", lunch: "badge-l", dinner: "badge-d", snack: "badge-s", pudding: "badge-s" };
  {
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
    const emoji = recipe.emoji || (mealType === 'breakfast' ? '🥞' : mealType === 'lunch' ? '🥪' : mealType === 'dinner' ? '🥘' : mealType === 'pudding' ? '🍮' : '🍫');
    const imgUrl = safeImageUrl(recipe.image || recipe.imageUrl);
    const badgeContent = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" alt="">`
      : escapeHtml(emoji);

    return `
      <div class="drawer-recipe-card" data-recipe-id="${recipe.id}" title="Tap to view recipe details and plan">
        <span class="recipe-row-badge ${badgeClass}">${badgeContent}</span>
        <div class="recipe-row-info">
          <div class="recipe-row-title">${escapeHtml(recipe.title)}</div>
          <div class="recipe-row-time">${timeDisplay ? `⏱️ ${timeDisplay} • ` : ""}${escapeHtml(recipe.subtitle || "")}</div>
        </div>
        <button type="button" class="recipe-row-fav${isFavouriteRecipe(recipe) ? " is-on" : ""}" data-fav="${escapeHtml(String(recipe.id))}" aria-pressed="${isFavouriteRecipe(recipe)}" aria-label="Family favourite">${window.heartIcon(isFavouriteRecipe(recipe))}</button>
        <div class="recipe-row-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;
  }
}

// Open Meal Details Popover (Matching Photo 1)
// Tap a planned meal: its own screen, photo first (js/meal-screen.js)
function openMealDetailsPopover(meal, dateStr, slot = "dinner") {
  if (window.MealScreen) window.MealScreen.open(meal, dateStr, slot, 0);
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
  if (window.MealScreen) window.MealScreen.close();
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
  // Each recipe opens at the top (it kept the last one's scroll)
  modal.querySelectorAll(".cooking-modal-content, .cooking-modal-body").forEach(el => { el.scrollTop = 0; });

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
    btnAddToPlan.onclick = async () => {
      if (!currentCookingRecipe) return;

      const curDateInput = document.getElementById("cooking-plan-date-input");
      const curSlotSelect = document.getElementById("cooking-plan-slot-select");
      const selectedDate = (curDateInput && curDateInput.value) || targetDate;
      const selectedSlot = (curSlotSelect && curSlotSelect.value) || targetCategory || "dinner";
      const selectedChefs = (cookingModalChefs && cookingModalChefs.length > 0) ? cookingModalChefs : [getDefaultMealCook()];

      // Confirmation dialog if overwriting an existing planned meal
      const existing = (window.getMealForDate || getMealForDate)(selectedDate, selectedSlot);
      if (existing && existing.title && existing.title.trim().length > 0) {
        const dishes = window.MealDishes ? window.MealDishes.dishesOf(existing) : [existing];
        const already = dishes.some(d => (d.recipeId != null && String(d.recipeId) === String(currentCookingRecipe.id)) || d.title.trim().toLowerCase() === currentCookingRecipe.title.trim().toLowerCase());
        if (!already) {
          const slotCap = selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1);
          const [y, m, d] = selectedDate.split("-").map(Number);
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const dayName = !isNaN(y) ? dayNames[new Date(y, m - 1, d).getDay()] : selectedDate;
          const planned = window.MealDishes ? window.MealDishes.summary(existing) : existing.title;
          // Another dish for that meal (a side, a pudding), or instead of it
          const canAdd = !!window.MealDishes && dishes.length < window.MealDishes.MAX_DISHES;
          const choice = window.Sheet && window.Sheet.choose
            ? await window.Sheet.choose({ icon: "🍽️", title: `${dayName}'s ${selectedSlot}`, text: `“${planned}” is planned.`, options: [
                ...(canAdd ? [{ key: "add", icon: "➕", label: `Add to ${selectedSlot}`, sub: `${currentCookingRecipe.title} as well` }] : []),
                { key: "replace", icon: "🔁", label: "Replace it", sub: `Just ${currentCookingRecipe.title}` }
              ], cancel: "Keep it as it is" })
            : (confirm(`There is already a meal planned for ${dayName} ${slotCap}:\n"${existing.title}"\n\nDo you want to replace it with "${currentCookingRecipe.title}"?`) ? "replace" : null);
          if (!choice) return;
          if (choice === "add") {
            addDishToMeal(currentCookingRecipe, selectedDate, selectedSlot);
            closeCookingRecipeModal();
            closePlanMealDrawer();
            return;
          }
        } else if (dishes.length > 1) {
          // Already one of its dishes: nothing to change
          closeCookingRecipeModal();
          closePlanMealDrawer();
          if (typeof showCalendarToast === "function") (window.showCalendarToast || showCalendarToast)(`${currentCookingRecipe.title} is already planned`);
          return;
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
        course: window.MealDishes && window.MealDishes.isPudding(currentCookingRecipe) ? "pudding" : "main",
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
      if (typeof window.celebrateFirst === "function") window.celebrateFirst("meal");
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
          <div class="cooking-step-text">${(() => { const text = String(step).replace(/^\s*(?:step\s*)?\d{1,2}\s*[.):-]?\s+(?=\S)/i, ""); return window.CookTimers ? window.CookTimers.stepHtml(text, { dish: recipe.title, step: idx + 1 }) : escapeHtml(text); })()}</div>
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
    } else if (recipe.source === "house" && recipe.sourceName) {
      creditEl.textContent = `Recipe: ${recipe.sourceName}`;
      creditEl.hidden = false;
    } else if (recipe.source === "family") {
      // The family's own (js/family-recipes.js): change it from here
      creditEl.innerHTML = `Recipe: Family recipe · <button type="button" class="cooking-credit-edit" data-edit-family-recipe="${escapeHtml(recipe.id)}">✏️ Edit</button>`;
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
  // Opening focuses something inside and scrolled the card down to it: start
  // on the close button, at the top
  if (btnClose) { try { btnClose.focus({ preventScroll: true }); } catch (e) {} }
  const toTop = () => modal.querySelectorAll(".cooking-modal-content, .cooking-modal-body").forEach(el => { el.scrollTop = 0; });
  toTop();
  requestAnimationFrame(toTop);
}
window.openCookingRecipeModal = openCookingRecipeModal;
window.renderDrawerRecipeList = () => renderDrawerRecipeList();
// For the Recipes panel on the Meals page (js/recipes-panel.js)
window.RecipeRows = {
  all: () => getAllFamilyRecipes(),
  find: (id) => findRecipeByIdOrTitle(id),
  rowHtml: (r) => recipeRowHtml(r),
  isFav: (r) => isFavouriteRecipe(r),
  toggleFav: (id) => toggleFavouriteRecipe(id),
  // Its card, set to plan it for today at its own meal (a snack: dinner)
  open: (r) => {
    const meal = String(r.mealType || r.category || "").toLowerCase();
    openCookingRecipeModal(r, (window.getLocalDateKey || getLocalDateKey)(new Date()), ["breakfast", "lunch", "dinner"].includes(meal) ? meal : "dinner");
  }
};

// Another dish for a meal already planned (a side, a pudding): it joins the
// meal (js/meal-dishes.js), then the ingredients question for just that dish
function addDishToMeal(recipe, dateStr, slot = "dinner") {
  const get = window.getMealForDate || getMealForDate;
  const before = get(dateStr, slot);
  if (!before || !window.MealDishes) return;
  const next = window.MealDishes.withDish(before, recipe);
  if (next === before) {
    if (typeof showCalendarToast === "function") (window.showCalendarToast || showCalendarToast)(window.MealDishes.dishesOf(before).length >= window.MealDishes.MAX_DISHES ? "That's as many dishes as one meal can hold" : `${recipe.title} is already planned`);
    return;
  }
  (window.setMealForDate || setMealForDate)(dateStr, next, slot);
  if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  if (typeof showCalendarToast === "function") (window.showCalendarToast || showCalendarToast)(`➕ ${recipe.title} added to ${slot}`);
  showMealsWeekFor(dateStr);
  renderMealsView();
  if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  const after = get(dateStr, slot);
  const added = window.MealDishes.dishesOf(after).find(d => (d.recipeId != null && String(d.recipeId) === String(recipe.id)) || d.title === recipe.title);
  // The meal screen, if it's open, shows the new dish
  if (window.MealScreen && window.MealScreen.isOpenFor(dateStr, slot)) window.MealScreen.open(after, dateStr, slot, added ? added.index : 0);
  if (window.MealGroceries && added) window.MealGroceries.afterPlan({ dateStr, slot, before, meal: after, added });
}
window.addDishToMeal = addDishToMeal;

// Plan a recipe straight onto a day (Meal Genie): the same meal the recipe
// card's "Add to plan" saves, then the ingredients question slides up
window.getAllFamilyRecipes = getAllFamilyRecipes;
// { add: true }: add it to the meal already planned there, as another dish
window.planRecipeOn = function (recipe, dateStr, slot = "dinner", opts = {}) {
  if (!recipe || !dateStr) return;
  const before = (window.getMealForDate || getMealForDate)(dateStr, slot);
  if (opts.add && before && before.title && window.MealDishes) {
    addDishToMeal(recipe, dateStr, slot);
    return;
  }
  (window.setMealForDate || setMealForDate)(dateStr, {
    title: recipe.title,
    recipeId: recipe.id,
    emoji: recipe.emoji || "🍽️",
    cook: "",
    notes: recipe.subtitle || "",
    tags: (recipe.tags || []).join(" • "),
    category: slot,
    course: window.MealDishes && window.MealDishes.isPudding(recipe) ? "pudding" : "main",
    hasRecipe: true,
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || []
  }, slot);
  if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  showMealsWeekFor(dateStr);
  renderMealsView();
  if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  if (typeof window.celebrateFirst === "function") window.celebrateFirst("meal");
  if (window.MealGroceries) window.MealGroceries.afterPlan({ dateStr, slot, before, meal: (window.getMealForDate || getMealForDate)(dateStr, slot) });
};

// Tapping outside the recipe card (on the dimmed page) closes it
document.addEventListener("click", (e) => {
  const modal = document.getElementById("cooking-recipe-modal");
  if (modal && modal.open && e.target === modal) closeCookingRecipeModal();
});

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
      window.mealsWeekOffset = mealsWeekOffset; // read by "Add this week's meals"
      renderMealsView();
    };
  }

  if (btnNextWeek && !btnNextWeek.hasAttribute("data-wired")) {
    btnNextWeek.setAttribute("data-wired", "true");
    btnNextWeek.onclick = () => {
      mealsWeekOffset++;
      window.mealsWeekOffset = mealsWeekOffset; // read by "Add this week's meals"
      renderMealsView();
    };
  }

  if (btnToday && !btnToday.hasAttribute("data-wired")) {
    btnToday.setAttribute("data-wired", "true");
    btnToday.onclick = () => {
      mealsWeekOffset = 0;
      mealsDayNudge = 0;
      window.mealsWeekOffset = mealsWeekOffset; // read by "Add this week's meals"
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

  async function handleAttemptCloseDrawer() {
    if (isDrawerDirty()) {
      const discard = window.Sheet
        ? await window.Sheet.confirm({ icon: "📝", title: "Discard this meal?", text: "You've started filling it in, but it isn't saved yet.", yes: "Discard", no: "Keep editing", danger: true })
        : confirm("You have unsaved meal details. Discard and close?");
      if (discard) {
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
      if (e.target.closest && e.target.closest("dialog, .skylight-task-quick-overlay, #cook-timers")) return;

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
    customForm.onsubmit = async (e) => {
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
          const ok = window.Sheet
            ? await window.Sheet.confirm({ icon: "🍽️", title: `Replace this ${category}?`, text: `“${existingMeal.title}” is planned. Swap it for “${title}”?`, yes: "Replace it", no: "Keep it" })
            : confirm(`There is already a meal planned for ${slotCap}:\n"${existingMeal.title}"\n\nDo you want to overwrite it with "${title}"?`);
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

      if (typeof window.celebrateFirst === "function") window.celebrateFirst("meal");
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


// ============================================================================
// MEAL CARDS THAT DON'T FIT
// On shorter screens (a tablet with the browser's bars showing) a long title
// pushed the cook's name under the avatars. After drawing, any card that
// overflows drops the name line (the avatars still show who's cooking); if
// it still doesn't fit, the title is cut to two lines. Re-checked on resize.
// ============================================================================
function fitMealCards(root) {
  if (!root) return;
  root.querySelectorAll(".meal-card-v2").forEach(card => {
    card.classList.remove("is-tight", "is-tighter");
    if (!card.clientHeight) return;
    if (card.scrollHeight > card.clientHeight + 1) card.classList.add("is-tight");
    if (card.scrollHeight > card.clientHeight + 1) card.classList.add("is-tighter");
  });
}
window.fitMealCards = fitMealCards;
// Re-check whenever the grid changes size (shown, rotated, browser bars)
function watchMealCardFit(root) {
  if (!root || typeof ResizeObserver !== "function" || root._fitWatched) return;
  root._fitWatched = true;
  let fitTimer = 0;
  new ResizeObserver(entries => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => entries.forEach(e => fitMealCards(e.target)), 100);
  }).observe(root);
}


// ============================================================================
// PHONES: ONE DAY AT A TIME (like Tasks' person tabs)
// A row of day tabs (Mon 2 ... Sun 8, with a dot for each meal planned) over
// full-width day cards that snap as you swipe. Opens on today. The tabs use
// the Tasks tab styles (css/tasks.css) plus css/meals.css.
// ============================================================================
var mealsPhoneShownDay = null;
var mealsDayTabScrollUntil = 0;
function mealsDayFromScroll(feed) {
  const cards = [...feed.querySelectorAll(".meals-mobile-day-card, .meals-week-edge")];
  if (!cards.length || !feed.clientWidth) return null;
  // The card whose left edge is nearest the feed's left edge
  const left = feed.getBoundingClientRect().left;
  let best = cards[0], bestD = Infinity;
  cards.forEach(c => { const d = Math.abs(c.getBoundingClientRect().left - left); if (d < bestD) { bestD = d; best = c; } });
  return best.getAttribute("data-day");
}
function markMealDayTab(day) {
  document.querySelectorAll("#meals-day-tabs .tasks-person-tab").forEach(t => {
    const on = t.getAttribute("data-day-tab") === day;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
}
// Drag a planned meal: onto another slot (it swaps with a meal already there),
// or onto "Take off the plan", which appears at the bottom while dragging.
// That only takes it off the plan; the recipe stays in Recipes.
// Grid: press and drag (mouse) or press, hold and drag (touch). Phone: the
// day card's meal, press, hold and drag.
const MEAL_SLOT_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
function mealSlotLabel(dateStr, slot) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${MEAL_SLOT_NAMES[slot] || slot}, ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} ${d}`;
}
function moveMealTo(from, to) {
  const get = window.getMealForDate || getMealForDate;
  const set = window.setMealForDate || setMealForDate;
  const moving = get(from.date, from.slot);
  if (!moving || !moving.title) return;
  const there = get(to.date, to.slot);
  const hadThere = !!(there && there.title);
  set(to.date, { ...moving, category: to.slot }, to.slot);
  set(from.date, hadThere ? { ...there, category: from.slot } : null, from.slot);
  renderMealsView();
  if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  const undo = () => {
    set(from.date, moving, from.slot);
    set(to.date, hadThere ? there : null, to.slot);
    renderMealsView();
    if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  };
  if (typeof window.showActionToast === "function") {
    window.showActionToast({ icon: moving.emoji || "🍽️", title: hadThere ? "Swapped" : "Moved", text: `${moving.title} → ${mealSlotLabel(to.date, to.slot)}`, action: { label: "Undo", onClick: undo }, ms: 6000 });
  }
}
function takeMealOffPlan(from) {
  const get = window.getMealForDate || getMealForDate;
  const set = window.setMealForDate || setMealForDate;
  const meal = get(from.date, from.slot);
  if (!meal || !meal.title) return;
  set(from.date, null, from.slot);
  renderMealsView();
  if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
  if (typeof window.showActionToast === "function") {
    window.showActionToast({ icon: meal.emoji || "🍽️", title: "Taken off the plan", text: `${meal.title} is still in your recipes`, action: { label: "Undo", onClick: () => { set(from.date, meal, from.slot); renderMealsView(); if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar(); } }, ms: 6000 });
  }
}
function wireMealMoveDrag(root, itemSelector) {
  if (!root || !window.ItemDrag) return;
  window.ItemDrag.attach(root, {
    itemSelector,
    start(item) {
      const holder = item.closest("[data-date][data-slot]");
      if (!holder) return null;
      const from = { date: holder.getAttribute("data-date"), slot: holder.getAttribute("data-slot") || "dinner" };
      const t = (window.getLocalDateKey || getLocalDateKey)(new Date());
      const zones = [...document.querySelectorAll('#skylight-meals-matrix .matrix-meal-cell[data-date], #meals-mobile-cards-feed .mobile-slot-card[data-date], #meals-mobile-cards-feed .mobile-slot-empty-btn[data-date]')]
        .filter(z => z.offsetParent && z !== holder && (z.getAttribute("data-date") || "") >= t && !(z.getAttribute("data-date") === from.date && z.getAttribute("data-slot") === from.slot));
      const off = document.createElement("div");
      off.className = "meal-off-plan-zone";
      off.innerHTML = `<span aria-hidden="true">↩</span> Take off the plan`;
      document.body.appendChild(off);
      return { zones: [...zones, off], origin: holder, data: { from, off } };
    },
    label(ctx, zone) {
      if (zone === ctx.data.off) return "Take it off the plan";
      const filled = (window.getMealForDate || getMealForDate)(zone.getAttribute("data-date"), zone.getAttribute("data-slot"));
      return `${filled && filled.title ? "Swap with " : ""}${mealSlotLabel(zone.getAttribute("data-date"), zone.getAttribute("data-slot"))}`;
    },
    drop(ctx, zone) {
      if (zone === ctx.data.off) { takeMealOffPlan(ctx.data.from); return; }
      moveMealTo(ctx.data.from, { date: zone.getAttribute("data-date"), slot: zone.getAttribute("data-slot") || "dinner" });
    },
    end(ctx) { if (ctx.data && ctx.data.off) ctx.data.off.remove(); },
    scroller: () => document.scrollingElement
  });
}

// Swipe or drag the week grid: move it a few days (whole weeks go into the offset)
function shiftMealsDays(n) {
  if (!n) return;
  mealsDayNudge += n;
  while (mealsDayNudge >= 7) { mealsDayNudge -= 7; mealsWeekOffset++; }
  while (mealsDayNudge <= -7) { mealsDayNudge += 7; mealsWeekOffset--; }
  window.mealsWeekOffset = mealsWeekOffset;
  renderMealsView();
}
window.shiftMealsDays = shiftMealsDays;
// Jump to a week (0 = from today): the phone's "Next 7 days" and "Back to today"
window.setMealsWeek = (n) => { mealsWeekOffset = n; mealsDayNudge = 0; window.mealsWeekOffset = n; renderMealsView(); };
window.moveMealTo = (from, to) => moveMealTo(from, to);
window.takeMealOffPlan = (from) => takeMealOffPlan(from);

// Tablets and computers: drag or swipe the grid sideways. The days follow the
// finger (or mouse); letting go moves the week by as many days as it was
// dragged (at least one). Up and down still scrolls.
function wireMealsSwipe() {
  const wrap = document.getElementById("skylight-meals-matrix-wrapper");
  const grid = document.getElementById("skylight-meals-matrix");
  if (!wrap || !grid || wrap._swipeWired) return;
  wrap._swipeWired = true;
  let st = null, swallowUntil = 0;
  const colWidth = () => { const c = grid.querySelector(".matrix-day-header-cell"); return c ? c.getBoundingClientRect().width : 120; };
  wrap.addEventListener("click", (e) => { if (Date.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (window.ItemDrag && window.ItemDrag.isDragging())) return;
    // With a mouse, pressing on a meal picks the meal up (wireMealMoveDrag)
    if (e.pointerType === "mouse" && e.target.closest && e.target.closest(".meal-card-v2")) return;
    st = { x: e.clientX, y: e.clientY, id: e.pointerId, moving: false };
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!st || e.pointerId !== st.id) return;
    if (window.ItemDrag && window.ItemDrag.isDragging()) { st = null; grid.classList.remove("is-swiping"); grid.style.removeProperty("--swipe-x"); return; }
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.moving) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        st.moving = true;
        try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
        grid.classList.add("is-swiping");
      } else if (Math.abs(dy) > 12) { st = null; return; } else return;
    }
    grid.style.setProperty("--swipe-x", `${dx}px`);
  });
  const end = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    if (!s.moving) return;
    const dx = e.clientX - s.x;
    grid.classList.remove("is-swiping");
    grid.style.removeProperty("--swipe-x");
    swallowUntil = Date.now() + 350;
    let days = -Math.round(dx / colWidth());
    if (!days && Math.abs(dx) > 40) days = dx < 0 ? 1 : -1;
    if (e.type === "pointercancel") days = 0;
    shiftMealsDays(days);
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
}

var mealsLandOn = null; // "first" / "last": after moving a week, land on Monday / Sunday
function changeMealsWeek(dir) {
  mealsWeekOffset += dir;
  window.mealsWeekOffset = mealsWeekOffset;
  mealsPhoneShownDay = null;
  mealsLandOn = dir > 0 ? "first" : "last";
  renderMealsView();
}
const MEALS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function mealsWeekLabel(firstKey, lastKey) {
  const [y1, m1, d1] = firstKey.split("-").map(Number);
  const [y2, m2, d2] = lastKey.split("-").map(Number);
  const range = m1 === m2 ? `${d1} – ${d2} ${MEALS_MONTHS[m2 - 1]}` : `${d1} ${MEALS_MONTHS[m1 - 1]} – ${d2} ${MEALS_MONTHS[m2 - 1]}`;
  const which = mealsDayNudge !== 0 ? "" : mealsWeekOffset === 0 ? "This week" : mealsWeekOffset === 1 ? "Next week" : mealsWeekOffset === -1 ? "Last week" : "";
  return which ? `<strong>${which}</strong> · ${range}` : `<strong>${range}</strong>`;
}

function renderMealDayTabs(feed, showDay, todayStr) {
  // Swipe past Sunday into next week (or back past Monday): an edge card at
  // each end, which moves the week when it's swiped onto
  feed.insertAdjacentHTML("afterbegin", `<div class="meals-week-edge" data-edge="-1" aria-hidden="true"><span>‹</span>Last week</div>`);
  feed.insertAdjacentHTML("beforeend", `<div class="meals-week-edge" data-edge="1" aria-hidden="true">Next week<span>›</span></div>`);
  let weekBar = document.getElementById("meals-week-bar");
  if (!weekBar) {
    weekBar = document.createElement("div");
    weekBar.id = "meals-week-bar";
    weekBar.className = "meals-week-bar";
    feed.parentNode.insertBefore(weekBar, feed);
    weekBar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-week]");
      if (b) changeMealsWeek(parseInt(b.getAttribute("data-week"), 10));
    });
  }
  let bar = document.getElementById("meals-day-tabs");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "meals-day-tabs";
    bar.className = "tasks-person-tabs meals-day-tabs";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Day");
    feed.parentNode.insertBefore(bar, feed);
    bar.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-day-tab]");
      if (!tab) return;
      const card = [...feed.querySelectorAll(".meals-mobile-day-card")].find(c => c.getAttribute("data-day") === tab.getAttribute("data-day-tab"));
      if (!card) return;
      mealsPhoneShownDay = tab.getAttribute("data-day-tab");
      mealsDayTabScrollUntil = Date.now() + 700;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      feed.scrollTo({ left: card.offsetLeft - feed.offsetLeft, behavior: reduce ? "auto" : "smooth" });
      markMealDayTab(mealsPhoneShownDay);
    });
    // Drawn while Meals was hidden (no width yet): line up on the right day
    // once it shows, or after a rotate
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => {
        if (!feed.clientWidth) return;
        const card = [...feed.querySelectorAll(".meals-mobile-day-card")].find(c => c.getAttribute("data-day") === mealsPhoneShownDay);
        if (card) { mealsDayTabScrollUntil = Date.now() + 200; feed.scrollLeft = card.offsetLeft - feed.offsetLeft; }
      }).observe(feed);
    }
    let tick = 0;
    feed.addEventListener("scroll", () => {
      if (tick) return;
      tick = setTimeout(() => {
        tick = 0;
        if (Date.now() < mealsDayTabScrollUntil || !feed.clientWidth) return;
        const shown = mealsDayFromScroll(feed);
        const edge = feed.querySelector(`.meals-week-edge[data-edge]`) && [...feed.querySelectorAll(".meals-week-edge")].find(e => Math.abs(e.getBoundingClientRect().left - feed.getBoundingClientRect().left) < 8);
        if (edge) {
          // Settled on "Next week" / "Last week": move there
          clearTimeout(feed._edgeTimer);
          feed._edgeTimer = setTimeout(() => {
            const still = [...feed.querySelectorAll(".meals-week-edge")].find(e => Math.abs(e.getBoundingClientRect().left - feed.getBoundingClientRect().left) < 8);
            if (still) changeMealsWeek(parseInt(still.getAttribute("data-edge"), 10));
          }, 180);
          return;
        }
        mealsPhoneShownDay = shown;
        markMealDayTab(mealsPhoneShownDay);
      }, 60);
    }, { passive: true });
  }
  const cards = [...feed.querySelectorAll(".meals-mobile-day-card")];
  if (cards.length) {
    weekBar.innerHTML = `<button type="button" class="meals-week-btn" data-week="-1" aria-label="Last week">‹</button>
      <span class="meals-week-label">${mealsWeekLabel(cards[0].getAttribute("data-day"), cards[cards.length - 1].getAttribute("data-day"))}</span>
      <button type="button" class="meals-week-btn" data-week="1" aria-label="Next week">›</button>`;
  }
  const slotNames = ["breakfast", "lunch", "dinner"];
  bar.innerHTML = cards.map(card => {
    const day = card.getAttribute("data-day");
    const planned = (card.getAttribute("data-planned") || "000").split("");
    const n = planned.filter(x => x === "1").length;
    return `<button type="button" class="tasks-person-tab meals-day-tab${day === todayStr ? " is-today" : ""}" role="tab" data-day-tab="${day}" aria-label="${card.getAttribute("data-day-short")} ${card.getAttribute("data-day-num")}, ${n} of 3 planned">
      <span class="meals-day-tab-name">${card.getAttribute("data-day-short")}</span>
      <span class="meals-day-tab-num">${card.getAttribute("data-day-num")}</span>
      <span class="meals-day-tab-dots" aria-hidden="true">${planned.map((p, i) => `<i class="dot-${slotNames[i]}${p === "1" ? " is-on" : ""}"></i>`).join("")}</span>
    </button>`;
  }).join("");
  // Same day as before a redraw; the first time, today
  const land = mealsLandOn; mealsLandOn = null;
  const target = (land === "first" ? cards[0] : land === "last" ? cards[cards.length - 1] : null)
    || cards.find(c => c.getAttribute("data-day") === showDay)
    || cards.find(c => c.getAttribute("data-day") === todayStr) || cards[0];
  if (target && feed.clientWidth) feed.scrollLeft = target.offsetLeft - feed.offsetLeft;
  mealsPhoneShownDay = target ? target.getAttribute("data-day") : null;
  markMealDayTab(mealsPhoneShownDay);
}
