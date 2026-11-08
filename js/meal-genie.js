// ============================================================================
// MAGIC MEALTIME (js/meal-genie.js; it began as "Meal Genie")
// "Not sure what to cook?" A few quick taps (which meal, what you're in the
// mood for, which flavours, how much effort), then three suggestions from
// the family's recipes and the built-in library, each with "Plan for <day>"
// (planned straight away on the next free day) and "Recipe" (the full card,
// where any day can be picked). No AI and no internet needed.
// Matching: Veggie is strict (never meat or fish); the rest are preferences,
// so it always finds something. Family recipes and favourites score higher;
// meals already planned this week score lower.
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const STEPS = {
    meal: { q: "Which meal?", opts: [
      { key: "breakfast", icon: "🥞", label: "Breakfast" },
      { key: "lunch", icon: "🥪", label: "Lunch" },
      { key: "dinner", icon: "🍝", label: "Dinner" }] },
    mood: { q: "In the mood for…", opts: [
      { key: "veggie", icon: "🥬", label: "Veggie" },
      { key: "meat", icon: "🥩", label: "Meat" },
      { key: "fish", icon: "🐟", label: "Fish" },
      { key: "light", icon: "🥗", label: "Light & healthy" },
      { key: "any", icon: "🤷", label: "Anything" }] },
    flavour: { q: "What flavours?", opts: [
      { key: "comfort", icon: "🇬🇧", label: "Comfort classics" },
      { key: "med", icon: "🇮🇹", label: "Italian & Mediterranean" },
      { key: "spicy", icon: "🌶️", label: "Indian & spicy" },
      { key: "asian", icon: "🥢", label: "Asian" },
      { key: "any", icon: "🌍", label: "Surprise me" }] },
    effort: { q: "How much effort?", opts: [
      { key: "quick", icon: "⚡", label: "Quick & easy" },
      { key: "cook", icon: "🍲", label: "Happy to cook" },
      { key: "any", icon: "👌", label: "Either" }] }
  };
  const FLAVOURS = {
    comfort: ["british", "irish", "united states", "american", "france", "french", "canadian"],
    med: ["italian", "greek", "spanish", "france", "french", "moroccan", "portuguese"],
    spicy: ["india", "indian", "jamaican", "mexican", "thai", "moroccan", "egyptian", "syrian", "malaysian"],
    asian: ["chinese", "japanese", "vietnamese", "thai", "korean", "malaysian", "filipino"]
  };
  const MEAT = /\b(beef|lamb|pork|bacon|sausages?|mince|ham|turkey|chorizo|steak|veal|duck|pancetta|prosciutto|salami|black pudding|goat meat|venison|gammon|lardons|pepperoni|gelatine?|lard|mutton)\b/i;
  const CHICKEN = /\bchicken\b/i;
  // Light & healthy: soups, salads, stir-fries, grills and veg; not cream, pastry or fried
  const LIGHT = /\b(soup|salad|stir[- ]?fry|grilled|steamed|broth|gazpacho|bowl|wrap|lentils?|dal|dhal|quinoa|vegetables?|veg|courgette|spinach|chickpeas?|beans|tofu|fish|salmon|prawns?|chicken breast)\b/i;
  const HEAVY = /\b(double cream|cream|butter|cheese|cheddar|pastry|puff|suet|deep[- ]?fr|fried|bacon|sausages?|mayonnaise|chips|batter|pie)\b/gi;
  const SPICY = /\b(spicy|curry|chilli|chili|masala|tikka|jalfrezi|korma|dal|dhal|vindaloo|harissa|jerk|sriracha|cajun|madras|biryani)\b/i;
  const FISH = /\b(fish|salmon|cod|tuna|prawns?|shrimp|haddock|mackerel|anchov(y|ies)|sardines?|crab|mussels?|squid|tilapia|trout|seafood)\b/i;

  // Foods someone won't eat, grouped, and how to spot each in a recipe's title and ingredients
  const FISH_ONLY = /\b(fish|salmon|cod|tuna|haddock|mackerel|anchov(y|ies)|sardines?|tilapia|trout|hake|pollock|sea ?bass|plaice|pilchards?|kippers?|monkfish|bream|swordfish|snapper)\b/i;
  const SHELLFISH = /\b(prawns?|shrimps?|crab|lobster|mussels?|clams?|scallops?|squid|calamari|octopus|cockles?)\b/i;
  const FOOD_GROUPS = [
    { title: "Meat & fish", foods: [
      { key: "chicken", icon: "🍗", label: "Chicken", re: /\b(chicken|poussin)\b/i },
      { key: "turkey", icon: "🦃", label: "Turkey", re: /\bturkey\b/i },
      { key: "beef", icon: "🥩", label: "Beef & steak", re: /\b(beef|steak|brisket|sirloin|veal)\b/i },
      { key: "mince", icon: "🍔", label: "Mince & burgers", re: /\b(mince|minced|meatballs?|burgers?|bolognese)\b/i },
      { key: "pork", icon: "🐖", label: "Pork", re: /\b(pork|gammon)\b/i },
      { key: "bacon", icon: "🥓", label: "Ham & bacon", re: /\b(ham|bacon|pancetta|prosciutto|lardons|serrano)\b/i },
      { key: "sausages", icon: "🌭", label: "Sausages & chorizo", re: /\b(sausages?|chorizo|hot dogs?|salami|pepperoni)\b/i },
      { key: "lamb", icon: "🍖", label: "Lamb", re: /\b(lamb|mutton)\b/i },
      { key: "fish", icon: "🐟", label: "Fish", re: FISH_ONLY },
      { key: "shellfish", icon: "🦐", label: "Prawns & shellfish", re: SHELLFISH }
    ] },
    { title: "Vegetables", foods: [
      { key: "onions", icon: "🧅", label: "Onions", re: /\b(onions?|shallots?)\b/i },
      { key: "garlic", icon: "🧄", label: "Garlic", re: /\bgarlic\b/i },
      { key: "tomatoes", icon: "🍅", label: "Tomatoes", re: /\b(tomato(es)?|passata|tomato pur[eé]e)\b/i },
      { key: "mushrooms", icon: "🍄", label: "Mushrooms", re: /\bmushrooms?\b/i },
      { key: "peppers", icon: "🫑", label: "Peppers", re: /\b((red|green|yellow|orange|bell|sweet|romano) peppers?|peppers|capsicums?|pimentos?)\b/i },
      { key: "broccoli", icon: "🥦", label: "Broccoli", re: /\b(broccoli|tenderstem)\b/i },
      { key: "cauliflower", icon: "🥬", label: "Cauliflower", re: /\bcauliflower\b/i },
      { key: "carrots", icon: "🥕", label: "Carrots", re: /\bcarrots?\b/i },
      { key: "peas", icon: "🫛", label: "Peas", re: /\b(peas|petits pois|mangetout|sugar snap)\b/i },
      { key: "sweetcorn", icon: "🌽", label: "Sweetcorn", re: /\b(sweetcorn|sweet corn|corn kernels|corn on the cob)\b/i },
      { key: "spinach", icon: "🥬", label: "Spinach & greens", re: /\b(spinach|kale|chard|cavolo nero|rocket|watercress)\b/i },
      { key: "courgette", icon: "🥒", label: "Courgette", re: /\b(courgettes?|zucchini)\b/i },
      { key: "aubergine", icon: "🍆", label: "Aubergine", re: /\b(aubergines?|eggplants?)\b/i },
      { key: "cabbage", icon: "🥬", label: "Cabbage & sprouts", re: /\b(cabbage|sprouts|pak choi|bok choy)\b/i },
      { key: "celery", icon: "🥬", label: "Celery", re: /\bcelery\b/i },
      { key: "beans", icon: "🫘", label: "Beans & lentils", re: /\b(beans|lentils|chickpeas|dal|dhal|edamame)\b/i },
      { key: "olives", icon: "🫒", label: "Olives", re: /\bolives\b/i },
      { key: "avocado", icon: "🥑", label: "Avocado", re: /\b(avocados?|guacamole)\b/i },
      { key: "sweetpotato", icon: "🍠", label: "Sweet potato & squash", re: /\b(sweet potato(es)?|squash|pumpkin)\b/i }
    ] },
    { title: "Dairy & eggs", foods: [
      { key: "cheese", icon: "🧀", label: "Cheese", re: /\b(cheese|cheddar|parmesan|mozzarella|feta|halloumi|gruy[eè]re|brie|ricotta|mascarpone|paneer|gorgonzola|stilton|pecorino)\b/i },
      { key: "milk", icon: "🥛", label: "Milk & cream", re: /\b(milk|cream|cr[eè]me fra[iî]che|buttermilk|custard)\b/i, strip: /\b(coconut|almond|oat|soy|soya|rice) (milk|cream)\b/gi },
      { key: "yoghurt", icon: "🥣", label: "Yoghurt", re: /\b(yogh?o?urt|skyr)\b/i },
      { key: "eggs", icon: "🥚", label: "Eggs", re: /\b(eggs?|egg yolks?|mayonnaise|mayo)\b/i }
    ] },
    { title: "Pasta, rice & bread", foods: [
      { key: "pasta", icon: "🍝", label: "Pasta", re: /\b(pasta|spaghetti|penne|linguine|fettuc+ine|macaroni|lasagn[ea]|rigatoni|fusilli|tagliatelle|orzo|gnocchi|ravioli|tortell[io]ni)\b/i },
      { key: "rice", icon: "🍚", label: "Rice", re: /\b(rice|risotto|paella|biryani|pilau|pilaf)\b/i },
      { key: "noodles", icon: "🍜", label: "Noodles", re: /\bnoodles?\b/i },
      { key: "potatoes", icon: "🥔", label: "Potatoes", re: /\b(potato(es)?|chips|mash|fries)\b/i },
      { key: "bread", icon: "🍞", label: "Bread & wraps", re: /\b(bread|baguette|toast|buns?|pitta|pita|wraps?|tortillas?|naan|ciabatta|focaccia|breadcrumbs)\b/i },
      { key: "couscous", icon: "🥣", label: "Couscous & quinoa", re: /\b(couscous|quinoa|bulgur|freekeh)\b/i }
    ] },
    { title: "Other", foods: [
      { key: "spicy", icon: "🌶️", label: "Spicy food", re: null },
      { key: "nuts", icon: "🥜", label: "Nuts", re: /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|pine ?nuts|satay)\b/i, strip: /\b(peanut|ground ?nut|nut) oil\b/gi },
      { key: "coconut", icon: "🥥", label: "Coconut", re: /\bcoconut\b/i },
      { key: "coriander", icon: "🌿", label: "Coriander", re: /\b(coriander|cilantro)\b/i },
      { key: "ginger", icon: "🫚", label: "Ginger", re: /\bginger\b/i },
      { key: "driedfruit", icon: "🍇", label: "Raisins & dried fruit", re: /\b(raisins|sultanas|currants|dried fruit|prunes|dried apricots|dates)\b/i },
      { key: "fruitinsavoury", icon: "🍍", label: "Fruit in savoury food", re: /\b(pineapple|mango|apples?|apricots?|cranberr(y|ies)|pomegranate)\b/i, strip: /\b(apple )?cider vinegar\b|\bpomegranate molasses\b/gi }
    ] }
  ];
  const FOODS = FOOD_GROUPS.flatMap(g => g.foods);
  // Things they've typed in themselves are kept as "custom:<word>" and matched as a whole word (plurals too)
  const isCustom = (k) => String(k).startsWith("custom:");
  const customWord = (k) => String(k).slice(7);
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function customRe(word) {
    const w = escRe(word.trim().toLowerCase()).replace(/\s+/g, "\\s+");
    const stem = w.replace(/(es|s)$/, "");
    return new RegExp(`\\b(${w}|${stem}|${stem}s|${stem}es)\\b`, "i");
  }
  // Older saves used "mince" etc. (still here); ones that changed meaning map across
  const LEGACY = { };
  const HOT = /\b(chill?i(es)?|chilli flakes|hot ?sauce|cayenne|jalape[nñ]o|tabasco|gochujang|sambal|scotch bonnet|habanero|piri[- ]?piri|peri[- ]?peri|hot pepper|red pepper flakes)/i;
  const foodHit = (f, text) => {
    if (f.key === "spicy") return SPICY.test(text) || HOT.test(text);
    return f.re.test(f.strip ? text.replace(f.strip, "") : text);
  };
  // Does this recipe contain something on the list? (keys from FOODS, or custom words)
  function hasFood(key, text) {
    if (isCustom(key)) return customRe(customWord(key)).test(text);
    const f = FOODS.find(x => x.key === key);
    return !!f && foodHit(f, text);
  }
  const prefsAll = () => (((window.boardSettings || {}).foodPrefs) || {});
  const prefsOf = (name) => { const p = prefsAll()[name] || {}; return { likes: p.likes || [], dislikes: p.dislikes || [], diet: p.diet || "" }; };
  // Diets (not fussiness: a choice). "" = eats everything
  const DIETS = [
    { key: "", label: "Eats everything" },
    { key: "pescatarian", label: "Pescatarian" },
    { key: "vegetarian", label: "Vegetarian" },
    { key: "vegan", label: "Vegan" }
  ];
  const dietLabel = (k) => (DIETS.find(d => d.key === k) || DIETS[0]).label;
  function savePrefs(name, prefs) {
    const all = { ...prefsAll(), [name]: prefs };
    if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ foodPrefs: all });
    document.dispatchEvent(new CustomEvent("harmonee:tastes-changed"));
  }
  const people = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
  const foodLabel = (k) => isCustom(k) ? customWord(k) : (FOODS.find(f => f.key === k) || { label: k }).label.toLowerCase();

  let state = null;
 // { step, answers, seen: Set, results: [] }

  // ---- Matching --------------------------------------------------------------------
  function cuisineOf(r) { return String(r.subtitle || r.cuisine || "").split("·")[0].trim().toLowerCase(); }
  // (fish sauce and the like don't make a dish "fish")
  // Everything in it (for Veggie, which is strict: chicken stock still counts)
  function rawText(r) { return [r.title, ...(r.ingredients || [])].join(" "); }
  // The main thing (for preferences): stock and sauces aren't the dish
  function ingredientsText(r) {
    return rawText(r)
      .replace(/\b(fish|oyster|anchovy) sauce\b/gi, "sauce")
      .replace(/\b(chicken|beef|lamb|fish|vegetable|pork) (stock|broth|bouillon|stock cubes?|gravy granules)\b/gi, "stock");
  }
  function isVeggie(r) {
    const t = rawText(r).replace(/\bvegetable (stock|broth)\b/gi, "stock");
    const seafood = FISH.test(t) || FISH_ONLY.test(t) || SHELLFISH.test(t);
    return !MEAT.test(t) && !CHICKEN.test(t) && !seafood;
  }
  const ANIMAL = /\b(milk|cream|butter|ghee|cheese|cheddar|parmesan|mozzarella|feta|halloumi|gruy[eè]re|brie|ricotta|mascarpone|paneer|yogh?o?urt|eggs?|egg yolks?|honey|mayonnaise|mayo|cr[eè]me fra[iî]che|buttermilk|custard|gelatine?)\b/i;
  function isVegan(r) {
    if (!isVeggie(r)) return false;
    const t = rawText(r)
      .replace(/\b(coconut|almond|oat|soy|soya|rice|vegan|plant[- ]based) (milk|cream|butter|cheese|yogh?o?urt|mayo|mayonnaise)\b/gi, "")
      .replace(/\b(peanut|nut|almond|cocoa|shea) butter\b/gi, "").replace(/\bbutter ?beans\b/gi, "");
    return (r.tags || []).includes("vegan") || /\bvegan\b/i.test(r.title || "") || !ANIMAL.test(t);
  }
  function isPescatarian(r) { const t = rawText(r); return !MEAT.test(t) && !CHICKEN.test(t); }
  function suitsDiet(r, diet) {
    if (diet === "vegan") return isVegan(r);
    if (diet === "vegetarian") return isVeggie(r);
    if (diet === "pescatarian") return isPescatarian(r);
    return true;
  }
  // Can this person eat it? (their diet, and nothing on their won't-eat list)
  function suitsPerson(r, name) {
    const p = prefsOf(name);
    if (!suitsDiet(r, p.diet)) return false;
    const text = rawText(r);
    return !p.dislikes.some(k => hasFood(k, text));
  }
  function isQuick(r) { return (r.ingredients || []).length <= 9 && (r.instructions || []).length <= 6; }
  function plannedThisWeek() {
    const titles = new Set();
    const get = window.getMealForDate;
    if (typeof get !== "function") return titles;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = -3; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      ["breakfast", "lunch", "dinner"].forEach(slot => { const m = get(d, slot); if (m && m.title) titles.add(m.title.trim().toLowerCase()); });
    }
    return titles;
  }

  function rank() {
    const a = state.answers;
    const all = typeof window.getAllFamilyRecipes === "function" ? window.getAllFamilyRecipes() : [];
    const planned = plannedThisWeek();
    const slot = a.meal || "dinner";
    const scored = all.map((r, i) => {
      const type = String(r.mealType || r.category || "dinner").toLowerCase();
      const text = ingredientsText(r);
      let score = 0;
      if (type === slot) score += 6;
      else if (slot === "lunch" && type === "dinner") score += 2; // light dinners work for lunch
      else if (slot === "dinner" && type === "lunch") score += 1;
      else score -= 10;
      if (a.mood === "veggie" && !isVeggie(r)) return null; // strict
      if (a.mood === "veggie") score += 3;
      if (a.mood === "meat") score += (MEAT.test(text) || CHICKEN.test(text)) ? 6 : -5; // chicken counts as meat
      if (a.mood === "light") {
        score += LIGHT.test(r.title) ? 4 : LIGHT.test(text) ? 1 : 0;
        score -= Math.min(4, (text.match(HEAVY) || []).length);
      }
      if (a.mood === "fish") score += FISH.test(text) ? 6 : -5;
      if (a.flavour && a.flavour !== "any") {
        if ((FLAVOURS[a.flavour] || []).includes(cuisineOf(r))) score += 4;
        if (a.flavour === "spicy" && SPICY.test(text)) score += 3;
      }
      if (a.effort === "quick") score += isQuick(r) ? 2 : -1;
      if (a.effort === "cook") score += isQuick(r) ? 0 : 1;
      if (!String(r.id || "").startsWith("mealdb-")) score += 1.5; // the family's own
      if (r.isFavorite || (typeof window.isFavouriteRecipe === "function" && window.isFavouriteRecipe(r))) score += 2;
      if (planned.has(String(r.title || "").trim().toLowerCase())) score -= 4;
      // Whoever's eating tonight: their diets, and nothing on their won't-eat lists
      if ((a.eating || []).some(name => !suitsPerson(r, name))) return null;
      // A little shuffle so "Show me others" and repeat visits vary
      score += ((i * 7919 + state.shuffle * 104729) % 97) / 97;
      return { r, score };
    }).filter(Boolean);
    scored.sort((x, y) => y.score - x.score);
    // Only the right kind of meal (no roast dinners for breakfast)
    return scored.filter(x => x.score > -4).map(x => x.r).filter(r => r.title);
  }

  // The next day (from today) with nothing planned for this meal
  function nextFreeDay(slot) {
    if (state && state.date && slot === state.dateSlot) return state.date; // the day they tapped
    const get = window.getMealForDate;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const m = typeof get === "function" ? get(d, slot) : null;
      if (!m || !m.title) return d;
    }
    return today;
  }
  const keyOf = (d) => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(d) : d.toISOString().slice(0, 10));
  function dayLabel(d) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    return diff === 0 ? "tonight" : diff === 1 ? "tomorrow" : `${DAYS[d.getDay()]} ${d.getDate()}`;
  }

  // ---- The sheet -------------------------------------------------------------------
  let dlg = null;
  function getDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "meal-genie";
    dlg.className = "hm-sheet meal-genie";
    dlg.setAttribute("aria-labelledby", "genie-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("click", onClick);
    // Search the won't-eat list as they type; offer to add it if it's not there
    dlg.addEventListener("input", (e) => {
      if (e.target.id !== "genie-food-search") return;
      const q = e.target.value.trim().toLowerCase();
      dlg.querySelectorAll(".genie-check").forEach(c => { c.hidden = !!q && !c.getAttribute("data-search").includes(q); });
      dlg.querySelectorAll("[data-group]").forEach(g => { g.hidden = !g.querySelector(".genie-check:not([hidden])"); });
      const add = dlg.querySelector(".genie-add");
      const found = !!dlg.querySelector(".genie-check:not([hidden])");
      const ok = q.length >= 2 && q.length <= 30 && /^[a-z][a-z '\-]*$/i.test(q) && !found;
      add.hidden = !ok;
      if (ok) { add.setAttribute("data-word", q); add.textContent = `＋ Add "${q}" to the list`; }
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.target.id !== "genie-food-search" || e.key !== "Enter") return;
      e.preventDefault();
      const add = dlg.querySelector(".genie-add");
      if (add && !add.hidden) add.click(); else e.target.blur();
    });
    return dlg;
  }
  function close() { if (window.Sheet) window.Sheet.close(dlg); else dlg.close(); }

  const ORDER = ["meal", "who", "mood", "flavour", "effort"];
  function stepsFor() { return state.answers.meal === "breakfast" ? ["meal"] : ORDER; }

  function draw() {
    const steps = stepsFor();
    const head = `<div class="genie-head">
      <span class="genie-mark" aria-hidden="true">🪄</span>
      <div><h2 class="genie-title" id="genie-title">Magic Mealtime</h2><p class="genie-sub">Not sure what to cook? I'll find you something.</p></div>
      <button type="button" class="genie-x" data-genie="close" aria-label="Close">✕</button>
    </div>`;
    const dots = `<ol class="genie-dots" aria-label="Question ${Math.min(state.step + 1, steps.length)} of ${steps.length}">${steps.map((_, i) => `<li class="${i === state.step ? "is-now" : i < state.step ? "is-done" : ""}"></li>`).join("")}</ol>`;
    // One person: their diet, then a searchable checklist of what they won't eat
    if (state.editing) {
      const name = state.editing;
      const p = state.draft;
      // Search by label and by what it matches ("kale" finds Spinach & greens)
      const words = (f) => f && f.re ? f.re.source.toLowerCase().replace(/\\b|\\s|[()?^$\\]/g, " ").replace(/[|]/g, " ") : "";
      const row = (key, icon, label) => { const on = p.dislikes.includes(key); const f = FOODS.find(x => x.key === key); return `<button type="button" class="genie-check${on ? " is-on" : ""}" role="checkbox" aria-checked="${on}" data-genie="food" data-food="${esc(key)}" data-search="${esc((label + " " + words(f)).toLowerCase())}"><span class="genie-box" aria-hidden="true"></span><span class="genie-check-icon" aria-hidden="true">${icon}</span><span class="genie-check-label">${esc(label)}</span></button>`; };
      const customs = p.dislikes.filter(isCustom);
      dlg.innerHTML = `<div class="genie-card">${head}
        <p class="genie-q">${esc(name)}</p>
        <p class="genie-label">Diet</p>
        <div class="genie-diets" role="radiogroup" aria-label="${esc(name)}'s diet">${DIETS.map(d => `<button type="button" class="genie-diet${p.diet === d.key ? " is-on" : ""}" role="radio" aria-checked="${p.diet === d.key}" data-genie="diet" data-diet="${d.key}">${esc(d.label)}</button>`).join("")}</div>
        <p class="genie-label">Won't eat</p>
        <p class="genie-hint">Tick anything ${esc(name)} won't eat. I'll leave out dishes that have it.</p>
        <div class="genie-search"><span aria-hidden="true">🔍</span><input type="search" id="genie-food-search" placeholder="Search or add a food" autocomplete="off" enterkeyhint="done" aria-label="Search or add a food"></div>
        <button type="button" class="genie-add" data-genie="add-food" hidden></button>
        <div class="genie-checklist">
          ${customs.length ? `<section class="genie-group" data-group><p class="genie-group-title">Added by you</p><div class="genie-checks">${customs.map(k => row(k, "✏️", customWord(k))).join("")}</div></section>` : ""}
          ${FOOD_GROUPS.map(g => `<section class="genie-group" data-group><p class="genie-group-title">${esc(g.title)}</p><div class="genie-checks">${g.foods.map(f => row(f.key, f.icon, f.label)).join("")}</div></section>`).join("")}
        </div>
        <p class="genie-allergy">Not for allergies: always check the recipe yourself.</p>
        <div class="genie-foot is-sticky"><button type="button" class="genie-back" data-genie="edit-cancel">‹ Back</button><button type="button" class="genie-plan" data-genie="edit-save">Save</button></div>
      </div>`;
      if (state.focusSearch) { state.focusSearch = false; setTimeout(() => { const i = dlg.querySelector("#genie-food-search"); if (i) i.focus(); }, 0); }
      return;
    }
    const tastes = state.mode === "tastes";
    if (tastes || (state.step < steps.length && steps[state.step] === "who")) {
      const chosen = tastes ? [] : (state.answers.eating || []);
      // "pasta, rice +4": short enough for one line on a phone
      const few = (keys) => keys.length <= 2 ? keys.map(foodLabel).join(", ") : `${foodLabel(keys[0])} +${keys.length - 1} more`;
      const line = (name) => {
        const p = prefsOf(name);
        const bits = [];
        if (p.diet) bits.push(dietLabel(p.diet));
        if (p.dislikes.length) bits.push(`won't eat ${few(p.dislikes)}`);
        if (!bits.length) return `<small>Eats everything</small>`;
        const text = bits.join(" · ");
        return `<small>${esc(text.charAt(0).toUpperCase() + text.slice(1))}</small>`;
      };
      dlg.innerHTML = `<div class="genie-card">${head}${tastes ? "" : dots}
        <p class="genie-q">${tastes ? "Who eats what" : "Who's eating tonight?"}</p>
        <p class="genie-hint">${tastes ? "Each person's diet and what they won't eat. Meal ideas suit everyone." : "I'll only suggest dishes that suit everyone ticked."}</p>
        <ul class="genie-people">${people().map(n => `<li class="genie-person${chosen.includes(n) ? " is-on" : ""}">
          ${tastes
            ? `<button type="button" class="genie-person-pick" data-genie="edit" data-name="${esc(n)}"><span class="genie-person-words"><strong>${esc(n)}</strong>${line(n)}</span></button>`
            : `<button type="button" class="genie-person-pick" data-genie="who-pick" data-name="${esc(n)}" aria-pressed="${chosen.includes(n)}"><span class="genie-person-check" aria-hidden="true">${chosen.includes(n) ? "✓" : ""}</span><span class="genie-person-words"><strong>${esc(n)}</strong>${line(n)}</span></button>`}
          <button type="button" class="genie-person-edit" data-genie="edit" data-name="${esc(n)}" aria-label="What ${esc(n)} eats">✏️</button>
        </li>`).join("")}</ul>
        <div class="genie-foot is-sticky">${tastes
          ? `<span></span><button type="button" class="genie-plan" data-genie="close">Done</button>`
          : `<button type="button" class="genie-back" data-genie="back">‹ Back</button><button type="button" class="genie-plan" data-genie="who-next"${chosen.length ? "" : " disabled"}>Next</button>`}</div>
      </div>`;
      return;
    }
    if (state.step < steps.length) {
      const key = steps[state.step];
      const st = STEPS[key];
      dlg.innerHTML = `<div class="genie-card">${head}
        <ol class="genie-dots" aria-label="Question ${state.step + 1} of ${steps.length}">${steps.map((_, i) => `<li class="${i === state.step ? "is-now" : i < state.step ? "is-done" : ""}"></li>`).join("")}</ol>
        <p class="genie-q">${esc(st.q)}</p>
        <div class="genie-opts${st.opts.length > 3 ? " is-many" : ""}">${st.opts.map(o => `<button type="button" class="genie-opt${state.answers[key] === o.key ? " is-on" : ""}" data-genie="pick" data-key="${key}" data-val="${o.key}"><span class="genie-opt-icon" aria-hidden="true">${o.icon}</span><span>${esc(o.label)}</span></button>`).join("")}</div>
        ${state.step > 0 ? `<button type="button" class="genie-back" data-genie="back">‹ Back</button>` : ""}
      </div>`;
      return;
    }
    // Results
    const picky = (state.answers.eating || []).filter(n => { const p = prefsOf(n); return p.diet || p.dislikes.length; });
    const suits = picky.length === 0 ? "" : picky.length === 1 ? picky[0] : picky.length === 2 ? `${picky[0]} and ${picky[1]}` : "everyone eating";
    const list = state.results.slice(state.page * 3, state.page * 3 + 3);
    const slot = state.answers.meal || "dinner";
    const free = nextFreeDay(slot);
    dlg.innerHTML = `<div class="genie-card">${head}
      <p class="genie-q">${list.length ? "How about one of these?" : picky.length ? "Nothing suits everyone eating." : "I couldn't find anything for that. Try different answers?"}</p>
      ${list.length && suits ? `<p class="genie-safe">✓ Suits ${esc(suits)}</p>` : ""}
      ${!list.length && picky.length ? `<p class="genie-sub">Try different answers, or take something off a won't-eat list.</p><button type="button" class="genie-more" data-genie="to-who">‹ Change who's eating</button>` : ""}
      <ul class="genie-results">${list.map(r => `<li class="genie-result">
        ${r.image ? `<img class="genie-photo" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="genie-photo is-emoji" aria-hidden="true">${esc(r.emoji || "🍽️")}</span>`}
        <div class="genie-result-body">
          <strong class="genie-result-title">${esc(r.title)}</strong>
          ${r.subtitle ? `<span class="genie-result-sub">${esc(r.subtitle)}</span>` : ""}
          <div class="genie-result-actions">
            <button type="button" class="genie-plan" data-genie="plan" data-id="${esc(r.id)}">📅 Plan for ${esc(dayLabel(free))}</button>
            <button type="button" class="genie-recipe" data-genie="recipe" data-id="${esc(r.id)}">📖 Recipe</button>
          </div>
        </div>
      </li>`).join("")}</ul>
      <div class="genie-foot">
        ${state.results.length > 3 ? `<button type="button" class="genie-more" data-genie="more">🔄 Show me others</button>` : ""}
        <button type="button" class="genie-back" data-genie="restart">↺ Start again</button>
      </div>
    </div>`;
  }

  function onClick(e) {
    if (e.target === dlg) { close(); return; }
    const b = e.target.closest("[data-genie]");
    if (!b) return;
    const act = b.getAttribute("data-genie");
    if (act === "close") { close(); return; }
    if (act === "back") { state.step = Math.max(0, state.step - 1); draw(); return; }
    if (act === "who-pick") {
      const n = b.getAttribute("data-name");
      const list = state.answers.eating || [];
      state.answers.eating = list.includes(n) ? list.filter(x => x !== n) : [...list, n];
      draw();
      return;
    }
    if (act === "who-next") { if ((state.answers.eating || []).length) { state.step++; draw(); } return; }
    if (act === "to-who") { state.step = stepsFor().indexOf("who"); state.page = 0; draw(); return; }
    if (act === "edit") { state.editing = b.getAttribute("data-name"); const p = prefsOf(state.editing); state.draft = { likes: [...p.likes], dislikes: [...p.dislikes], diet: p.diet }; draw(); return; }
    if (act === "diet") {
      state.draft.diet = b.getAttribute("data-diet");
      dlg.querySelectorAll(".genie-diet").forEach(d => { const on = d === b; d.classList.toggle("is-on", on); d.setAttribute("aria-checked", String(on)); });
      return;
    }
    if (act === "food") {
      // Tick in place (no redraw, so the list and search stay where they are)
      const k = b.getAttribute("data-food");
      const list = state.draft.dislikes;
      const on = !list.includes(k);
      state.draft.dislikes = on ? [...list, k] : list.filter(x => x !== k);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      return;
    }
    if (act === "add-food") {
      const word = (b.getAttribute("data-word") || "").trim().toLowerCase();
      if (word) {
        const key = `custom:${word}`;
        if (!state.draft.dislikes.includes(key)) state.draft.dislikes = [...state.draft.dislikes, key];
        draw();
      }
      return;
    }
    if (act === "edit-cancel") { state.editing = null; draw(); return; }
    if (act === "edit-save") {
      savePrefs(state.editing, { likes: state.draft.likes, dislikes: state.draft.dislikes, diet: state.draft.diet || "" });
      state.editing = null;
      draw();
      return;
    }
    if (act === "restart") { start(state.answers.meal); return; }
    if (act === "pick") {
      state.answers[b.getAttribute("data-key")] = b.getAttribute("data-val");
      state.step++;
      if (state.step >= stepsFor().length) { state.results = rank(); state.page = 0; }
      if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
      draw();
      return;
    }
    if (act === "more") {
      state.page++;
      if (state.page * 3 >= state.results.length) { state.shuffle++; state.results = rank(); state.page = 0; }
      draw();
      return;
    }
    const recipe = state.results.find(r => String(r.id) === b.getAttribute("data-id"));
    if (!recipe) return;
    const slot = state.answers.meal || "dinner";
    if (act === "plan") {
      const day = nextFreeDay(slot);
      const fromDrawer = !!(state.date && slot === state.dateSlot);
      close();
      setTimeout(() => {
        if (fromDrawer && typeof window.closePlanMealDrawer === "function") window.closePlanMealDrawer();
        if (typeof window.planRecipeOn === "function") window.planRecipeOn(recipe, keyOf(day), slot);
        if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🪄 ${recipe.title} planned for ${dayLabel(day)}!`);
      }, 250);
      return;
    }
    if (act === "recipe") {
      close();
      setTimeout(() => { if (typeof window.openCookingRecipeModal === "function") window.openCookingRecipeModal(recipe, keyOf(nextFreeDay(slot)), slot); }, 250);
    }
  }

  // Opens with a guess at the meal from the time of day (still asked)
  // From the plan-a-meal drawer it knows the day: open(slot, { date: "2026-11-09" })
  function start(meal, opts) {
    const h = new Date().getHours();
    const guess = (typeof meal === "string" && meal) || (h < 10 ? "breakfast" : h < 14 ? "lunch" : "dinner");
    const date = opts && opts.date ? new Date(`${opts.date}T00:00:00`) : null;
    state = { step: date && !isNaN(date) ? 1 : 0, answers: { meal: guess, eating: people() }, page: 0, results: [], shuffle: Math.floor(Date.now() / 60000) % 1000, date: date && !isNaN(date) ? date : null, dateSlot: guess };
    getDialog();
    draw();
    if (!dlg.open) dlg.showModal();
  }

  // Family tastes on their own (from the plan-a-meal drawer)
  function openTastes() {
    state = { step: 0, answers: { meal: "dinner" }, page: 0, results: [], shuffle: 0, mode: "tastes" };
    getDialog();
    draw();
    if (!dlg.open) dlg.showModal();
  }
  // Does a recipe avoid every family member's won't-eats?
  function fitsEveryone(r) { return people().every(n => suitsPerson(r, n)); }
  // "Ava, Dara" — people with tastes saved, for a friendly line elsewhere
  const peopleWithTastes = () => people().filter(n => { const p = prefsOf(n); return p.diet || p.dislikes.length; });

  window.MealGenie = { open: start, openTastes, fitsEveryone, peopleWithTastes, foods: () => FOODS.map(f => f.key), hasFood: (k, r) => hasFood(k, rawText(r)) };
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-open-genie]")) start();
  });
})();
