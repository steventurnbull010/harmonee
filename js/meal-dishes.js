// ============================================================================
// SEVERAL DISHES IN ONE MEAL (js/meal-dishes.js)
// A planned meal can have more than one recipe: a main, something on the side
// and a pudding, say. The first dish stays where a meal has always kept it
// (title, recipeId, emoji, ingredients, instructions), so everything that only
// knows about one dish (calendar, Today, voice, the shopping list) still reads
// it. The others go in meal.extras, each one { recipeId, title, emoji, course,
// ingredients, instructions }. Puddings always come last; a pudding is only
// the main dish when it's the only one.
//
//   MealDishes.dishesOf(meal)          -> [main, ...extras], each { ..., index }
//   MealDishes.withDish(meal, recipe)  -> the meal with that recipe added
//   MealDishes.withoutDish(meal, i)    -> the meal without dish i (null if none left)
//   MealDishes.summary(meal)           -> "Sausages + 2 more"
//   MealDishes.isPudding(recipe)
// ============================================================================
(function (root) {
  const MAX_DISHES = 6;
  const DISH_FIELDS = ["recipeId", "title", "emoji", "course", "ingredients", "instructions"];

  function isPudding(r) {
    if (!r) return false;
    if (r.course) return r.course === "pudding";
    const kind = String(r.mealType || r.category || "").toLowerCase();
    if (["snack", "dessert", "pudding"].includes(kind)) return true;
    const tags = Array.isArray(r.tags) ? r.tags.join(" ") : String(r.tags || "");
    return /\b(dessert|pudding)s?\b/i.test(tags);
  }

  // A recipe (or a dish) as a dish: only what's saved, nothing made up
  function dishFrom(r) {
    const d = {
      recipeId: r.recipeId != null ? r.recipeId : (r.id != null ? r.id : null),
      title: String(r.title || "").trim(),
      emoji: r.emoji || (isPudding(r) ? "🍮" : "🍽️"),
      course: isPudding(r) ? "pudding" : "main",
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean) : [],
      instructions: Array.isArray(r.instructions) ? r.instructions.filter(Boolean) : []
    };
    return d;
  }

  const same = (a, b) => (a.recipeId != null && b.recipeId != null && String(a.recipeId) === String(b.recipeId))
    || String(a.title || "").trim().toLowerCase() === String(b.title || "").trim().toLowerCase();

  function dishesOf(meal) {
    if (!meal || !String(meal.title || "").trim()) return [];
    const main = dishFrom(meal);
    const extras = (Array.isArray(meal.extras) ? meal.extras : []).filter(e => e && String(e.title || "").trim()).map(dishFrom);
    return [main, ...extras].map((d, index) => ({ ...d, index }));
  }

  // Puddings last, then the first dish is the main one
  function fromDishes(meal, dishes) {
    if (!dishes.length) return null;
    const sorted = [...dishes.filter(d => d.course !== "pudding"), ...dishes.filter(d => d.course === "pudding")];
    const [main, ...rest] = sorted;
    const out = { ...meal };
    DISH_FIELDS.forEach(k => { out[k] = main[k]; });
    out.hasRecipe = !!(main.recipeId != null || (main.instructions && main.instructions.length));
    if (rest.length) out.extras = rest.map(d => { const e = {}; DISH_FIELDS.forEach(k => { e[k] = d[k]; }); return e; });
    else delete out.extras;
    // The main dish's own subtitle and tags would be wrong for a new main
    if (main.recipeId !== meal.recipeId || main.title !== meal.title) { out.notes = ""; out.tags = ""; }
    return out;
  }

  function withDish(meal, recipe) {
    const dish = dishFrom(recipe);
    if (!dish.title) return meal;
    const dishes = dishesOf(meal);
    if (!dishes.length) return fromDishes({}, [dish]);
    if (dishes.some(d => same(d, dish)) || dishes.length >= MAX_DISHES) return meal;
    return fromDishes(meal, [...dishes, dish]);
  }

  function withoutDish(meal, index) {
    return fromDishes(meal, dishesOf(meal).filter(d => d.index !== index));
  }

  function summary(meal) {
    const n = dishesOf(meal).length;
    return n > 1 ? `${meal.title} + ${n - 1} more` : String((meal && meal.title) || "");
  }

  root.MealDishes = { dishesOf, withDish, withoutDish, summary, isPudding, MAX_DISHES };
})(typeof window !== "undefined" ? window : globalThis);
