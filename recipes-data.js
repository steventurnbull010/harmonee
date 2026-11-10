// ============================================================================
// RECIPES BANK (recipes-data.js)
// Built-in recipes come from TheMealDB (recipes-themealdb.js); families' own
// recipes are kept on the device. Helpers for listing, searching and saving.
// ============================================================================

import { MEALDB_RECIPES } from "./recipes-themealdb.js?v=cd54086a";

// House recipes the family has given us, for every board (the AI-written
// starters that used to be here were removed). Everything else comes from
// TheMealDB (recipes-themealdb.js). Photos live in images/recipes/.
export const PRELOADED_RECIPES = [
  {
    id: "house-banana-protein-muffins",
    title: "High-Protein Banana & Greek Yogurt Muffins",
    subtitle: "Moist and fluffy · about 7–14g protein each",
    emoji: "🧁",
    // Photo: "Homemade Muffins" (Unsplash), CC0, via Wikimedia Commons; cropped
    image: "images/recipes/banana-protein-muffins.jpg",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["breakfast", "snack", "baking", "high protein", "vegetarian"],
    source: "house",
    sourceName: "Family favourite",
    prepTime: "10",
    cookTime: "20",
    servings: 12,
    ingredients: [
      "1 ripe banana, mashed",
      "50ml maple syrup",
      "250g 0% fat Greek yogurt",
      "3 large eggs",
      "1 tsp vanilla extract",
      "150g self-raising flour",
      "85g ground almonds",
      "1 tsp baking powder",
      "1 tsp ground cinnamon",
      "Flaked nuts or a scoop of protein powder (optional)"
    ],
    instructions: [
      "Preheat your oven to 180°C / 160°C fan / gas mark 4, and line a muffin tin with silicone cases.",
      "Mix the wet ingredients: in a large bowl, mash the banana. Stir in the maple syrup, Greek yogurt, eggs and vanilla until smooth.",
      "Mix the dry ingredients: in a separate bowl, mix the self-raising flour, ground almonds, baking powder and cinnamon.",
      "Fold together: gently fold the dry mixture into the wet until just combined. Don't overmix.",
      "Bake: spoon the batter evenly into the cases and top with flaked nuts. Bake for 15 to 20 minutes, until golden and a toothpick in the middle comes out clean."
    ]
  }
];

// Helper: get all recipes (custom user-added + preloaded)
export function getAllFamilyRecipes() {
  let custom = [];
  try {
    // The family's own recipes, shared on the board (js/family-recipes.js)
    if (typeof window !== "undefined" && window.FamilyRecipes) custom = window.FamilyRecipes.list();
    else if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("turnbull_custom_recipes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          custom = parsed.filter(r => r && typeof r === "object" && r.id);
        }
      }
    }
  } catch (e) {
    console.warn("Could not load custom recipes from localStorage:", e);
  }
  // A family recipe with no photo of its own shows a stand-in (js/recipe-stock.js).
  // Copies, so the stand-in is never saved with the recipe.
  if (typeof window !== "undefined" && window.RecipeStock) {
    custom = custom.map(r => {
      if (!r || r.image || r.imageUrl) return r;
      // A photo of the dish (js/recipe-photos.js), once this device has it
      const own = r.photo && window.RecipePhotos ? window.RecipePhotos.url(r) : "";
      return own ? { ...r, image: own } : { ...r, image: window.RecipeStock.photoFor(r), stockImage: true };
    });
  }
  // Real recipes from TheMealDB, after the starter set (see recipes-themealdb.js)
  const all = [...custom, ...PRELOADED_RECIPES, ...MEALDB_RECIPES];

  try {
    if (typeof localStorage !== "undefined") {
      const favs = JSON.parse(localStorage.getItem("turnbull_recipe_favorites") || "{}");
      all.forEach(r => {
        if (r && r.id && favs && favs[r.id] !== undefined) r.isFavorite = favs[r.id];
      });
    }
  } catch (e) {}

  return all;
}

// Helper: add or update custom recipe (with 50-recipe cap and storage guardrails)
export function addCustomRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return [];
  let custom = [];
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("turnbull_custom_recipes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          custom = parsed.filter(r => r && typeof r === "object" && r.id);
        }
      }
    }
  } catch (e) {}

  // Guardrail: Cap at 50 most recent custom recipes
  custom = [recipe, ...custom.filter(r => r && r.id !== recipe.id)].slice(0, 50);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("turnbull_custom_recipes", JSON.stringify(custom));
    }
  } catch (e) {
    console.warn("Storage quota warning when saving custom recipe, pruning oldest photos to shield quota", e);
    try {
      // If browser localStorage quota is threatened, prune heavy image strings from older recipes
      custom = custom.map((r, idx) => idx < 10 ? r : { ...r, image: "", imageUrl: "" });
      localStorage.setItem("turnbull_custom_recipes", JSON.stringify(custom));
    } catch (e2) {}
  }
  return custom;
}

// Helper: get recipes filtered by meal type ('breakfast', 'lunch', 'dinner', 'snack')
export function getRecipesByMealType(mealType) {
  const all = getAllFamilyRecipes();
  if (!mealType || mealType === "all") return all;
  const mt = mealType.toLowerCase();
  return all.filter(r => (r.mealType && r.mealType.toLowerCase() === mt) || (r.category && r.category.toLowerCase() === mt));
}

// Helper: search recipes by text query and optional tag
export function searchRecipes(query, tag = null) {
  const all = getAllFamilyRecipes();
  const q = (query || "").trim().toLowerCase();
  return all.filter(r => {
    const matchesTag = !tag || tag === "all" || (r.tags && r.tags.includes(tag)) || r.mealType === tag || r.category === tag;
    if (!matchesTag) return false;
    if (!q) return true;
    const titleMatch = r.title.toLowerCase().includes(q);
    const subMatch = (r.subtitle || "").toLowerCase().includes(q);
    const ingMatch = r.ingredients && r.ingredients.some(ing => ing.toLowerCase().includes(q));
    return titleMatch || subMatch || ingMatch;
  });
}

// Helper: find recipe by id or title
export function findRecipeByIdOrTitle(query) {
  if (!query) return null;
  const qLower = String(query).toLowerCase().trim();
  const all = getAllFamilyRecipes();
  return all.find(r => r.id === query || r.title.toLowerCase() === qLower || r.title.toLowerCase().includes(qLower) || qLower.includes(r.title.toLowerCase())) || null;
}

// Helper: toggle recipe favorite
export function toggleRecipeFavorite(recipeId) {
  try {
    if (typeof localStorage === "undefined") return false;
    const favs = JSON.parse(localStorage.getItem("turnbull_recipe_favorites") || "{}");
    const current = favs[recipeId] !== undefined ? favs[recipeId] : (findRecipeByIdOrTitle(recipeId)?.isFavorite || false);
    favs[recipeId] = !current;
    localStorage.setItem("turnbull_recipe_favorites", JSON.stringify(favs));
    return favs[recipeId];
  } catch (e) {
    return false;
  }
}
