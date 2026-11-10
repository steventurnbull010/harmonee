// ============================================================================
// STAND-IN RECIPE PHOTOS (js/recipe-stock.js)
// A family recipe with no photo of its own shows a stand-in: a crumble gets
// "pudding" (a crumble with apples), a chilli gets "pot" (a stew in a pot),
// and so on. Picked from the recipe's name first, then its ingredients, then
// which meal it is; anything else gets "table" (a family table of food).
//
// The photos are in images/recipes/stock/ (free Unsplash photos; see
// CREDITS.md there). Nothing is saved: the stand-in is worked out each time,
// so a real photo of the dish always wins.
// ============================================================================
(function () {
  const DIR = "images/recipes/stock/";
  // In order: the first that matches wins (pasta bake is pasta, not baking)
  const KINDS = [
    ["pasta", /\b(pasta|spaghetti|penne|lasagne|lasagna|macaroni|mac and cheese|tagliatelle|fusilli|linguine|rigatoni|ravioli|tortellini|carbonara|gnocchi)\b/],
    ["pudding", /\b(crumble|cobbler|tart|tarts|pudding|puddings|dessert|desserts|trifle|cheesecake|sundae|ice cream|apple pie|banoffee|pavlova|mousse|custard)\b/],
    ["baking", /\b(cake|cakes|cupcakes?|muffins?|cookies?|biscuits?|flapjacks?|brownies?|blondies?|bread|loaf|scones?|buns?|traybake|banana bread|shortbread|rolls)\b/],
    ["pot", /\b(chilli|chili|stew|stews|casserole|curry|curries|soup|soups|hotpot|goulash|tagine|dal|daal|dhal|ragu|broth|bolognese|chowder|stroganoff|risotto|jambalaya|paella|braise|braised)\b/],
    ["fish", /\b(fish|salmon|cod|haddock|tuna|prawns?|shrimps?|mackerel|seafood|trout|sea bass|kedgeree|scampi)\b/],
    ["roast", /\b(roast|roasted|steak|chicken|beef|lamb|pork|sausages?|gammon|turkey|ham|burgers?|meatballs|chops?)\b/],
    ["salad", /\b(salad|salads|slaw|coleslaw|buddha bowl|grain bowl|poke)\b/],
    ["breakfast", /\b(pancakes?|porridge|oats|granola|waffles?|omelette|scrambled eggs|french toast|full english|breakfast)\b/]
  ];
  const words = (s) => String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ");
  const first = (text) => { for (const [kind, re] of KINDS) if (re.test(text)) return kind; return null; };

  function kindFor(r) {
    if (!r) return "table";
    const meal = String(r.mealType || r.category || "").toLowerCase();
    const byName = first(words(r.title));
    if (byName) return byName;
    if (meal === "breakfast") return "breakfast";
    const byIngredients = first(words((Array.isArray(r.ingredients) ? r.ingredients : []).join(" ")));
    // An ingredient alone says less than a name: "chicken stock" in a soup
    if (byIngredients && byIngredients !== "breakfast") return byIngredients;
    if (meal === "snack") return "baking";
    if (meal === "lunch") return "salad";
    return "table";
  }

  window.RecipeStock = { kindFor, photoFor: (r) => `${DIR}${kindFor(r)}.jpg` };
})();
