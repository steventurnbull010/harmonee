// ============================================================================
// AISLES (js/aisles.js)
// Sorts shopping list items into supermarket sections, in the order a typical
// UK shop is walked, for Shop mode (js/shop-mode.js):
//
//   Aisles.aisleFor("2 tins chopped tomatoes")  -> "cupboard"
//   Aisles.AISLES                               -> [{ key, label, icon }, ...]
//
// Matching is by keyword at the start of a word ("banana" matches "bananas",
// "Bananas x6"), and longer phrases win over shorter ones, so "peanut butter"
// is Food cupboard (not Dairy), "ice cream" is Frozen (not Dairy), "chicken
// stock" is Food cupboard (not Meat), "frozen peas" is Frozen (not Veg).
// Anything not recognised goes under Other.
// ============================================================================
(function () {
  const AISLES = [
    { key: "fruitveg",  label: "Fruit & veg",        icon: "🍎" },
    { key: "bakery",    label: "Bakery",             icon: "🥖" },
    { key: "meat",      label: "Meat, fish & deli",  icon: "🥩" },
    { key: "dairy",     label: "Dairy & eggs",       icon: "🧀" },
    { key: "cupboard",  label: "Food cupboard",      icon: "🥫" },
    { key: "snacks",    label: "Snacks & treats",    icon: "🍫" },
    { key: "frozen",    label: "Frozen",             icon: "🧊" },
    { key: "drinks",    label: "Drinks",             icon: "🥤" },
    { key: "toiletries",label: "Toiletries & baby",  icon: "🧴" },
    { key: "household", label: "Household & pets",   icon: "🧻" },
    { key: "other",     label: "Other",              icon: "📦" }
  ];

  const WORDS = {
    fruitveg: [
      "apple", "banana", "orange", "satsuma", "clementine", "mandarin", "tangerine", "lemon", "lime", "grape", "pear", "peach", "nectarine", "plum", "apricot", "cherry", "cherries", "strawberr", "raspberr", "blueberr", "blackberr", "berries", "melon", "watermelon", "pineapple", "mango", "kiwi", "pomegranate", "avocado", "fig", "date", "rhubarb",
      "potato", "sweet potato", "carrot", "parsnip", "swede", "turnip", "onion", "red onion", "spring onion", "shallot", "garlic", "ginger", "leek", "celery", "celeriac", "broccoli", "cauliflower", "cabbage", "red cabbage", "kale", "spinach", "lettuce", "rocket", "salad", "salad leaves", "cucumber", "tomato", "cherry tomato", "pepper", "red pepper", "green pepper", "yellow pepper", "chilli", "chili", "courgette", "zucchini", "aubergine", "eggplant", "squash", "butternut", "pumpkin", "mushroom", "peas", "mangetout", "sugar snap", "green beans", "runner beans", "sweetcorn", "corn on the cob", "beetroot", "radish", "asparagus", "brussels", "pak choi", "bok choy", "fennel", "artichoke", "okra",
      "herbs", "basil", "coriander", "parsley", "mint", "rosemary", "thyme", "dill", "chives", "sage", "fresh herbs", "bean sprouts", "beansprouts", "coleslaw"
    ],
    bakery: [
      "bread", "loaf", "loaves", "rolls", "bread rolls", "baguette", "ciabatta", "focaccia", "sourdough", "bagel", "croissant", "pain au chocolat", "crumpet", "muffin", "english muffin", "pitta", "pita", "naan", "wrap", "tortilla", "flatbread", "brioche", "teacake", "scone", "hot cross bun", "buns", "burger buns", "hot dog rolls", "cake", "doughnut", "donut", "danish", "pancakes", "waffles"
    ],
    meat: [
      "chicken", "chicken breast", "chicken thigh", "chicken wings", "whole chicken", "turkey", "beef", "steak", "mince", "minced beef", "beef mince", "lamb", "lamb chops", "pork", "pork chops", "bacon", "gammon", "ham", "sausage", "chorizo", "salami", "pepperoni", "prosciutto", "pastrami", "meatballs", "burgers", "duck", "venison", "black pudding", "pate",
      "fish", "salmon", "cod", "haddock", "tuna steak", "sea bass", "mackerel", "trout", "prawn", "shrimp", "scallop", "mussels", "crab", "smoked salmon", "kippers", "seafood",
      "tofu", "quorn", "halloumi"
    ],
    dairy: [
      "milk", "semi skimmed", "skimmed", "whole milk", "oat milk", "almond milk", "soya milk", "soy milk", "butter", "spread", "margarine", "flora", "cheese", "cheddar", "mozzarella", "parmesan", "feta", "brie", "camembert", "stilton", "cream cheese", "philadelphia", "cottage cheese", "ricotta", "mascarpone", "goats cheese", "babybel", "cheese strings",
      "yoghurt", "yogurt", "fromage frais", "petits filous", "frube", "greek yoghurt", "cream", "double cream", "single cream", "sour cream", "creme fraiche", "custard", "egg", "eggs", "rice pudding", "trifle", "hummus", "houmous", "fresh pasta", "fresh soup", "dips"
    ],
    cupboard: [
      "pasta", "spaghetti", "penne", "fusilli", "lasagne sheets", "noodles", "rice", "basmati", "risotto", "couscous", "quinoa", "bulgur", "lentils", "chickpeas", "baked beans", "beans", "kidney beans", "black beans", "butter beans", "tinned", "tins", "tin of", "chopped tomatoes", "tinned tomatoes", "passata", "tomato puree", "tomato paste", "tomato sauce", "ketchup", "mayonnaise", "mayo", "mustard", "brown sauce", "bbq sauce", "salad cream", "vinegar", "soy sauce", "worcestershire", "pesto", "curry paste", "curry sauce", "pasta sauce", "stir fry sauce", "gravy", "stock", "stock cubes", "chicken stock", "beef stock", "vegetable stock", "oxo", "bisto",
      "oil", "olive oil", "vegetable oil", "sunflower oil", "coconut milk", "flour", "plain flour", "self raising", "sugar", "icing sugar", "brown sugar", "baking powder", "bicarbonate", "yeast", "vanilla", "cocoa", "chocolate chips", "sprinkles", "food colouring",
      "salt", "pepper grinder", "black pepper", "spice", "spices", "paprika", "cumin", "turmeric", "cinnamon", "nutmeg", "oregano", "mixed herbs", "chilli flakes", "garam masala", "curry powder",
      "cereal", "cornflakes", "cheerios", "weetabix", "shreddies", "rice krispies", "coco pops", "granola", "muesli", "porridge", "oats", "honey", "jam", "marmalade", "peanut butter", "nutella", "marmite", "syrup", "golden syrup", "maple syrup",
      "tuna", "sardines", "soup", "tinned soup", "spaghetti hoops", "custard powder", "jelly", "dried fruit", "raisins", "sultanas", "nuts", "almonds", "cashews", "peanuts", "seeds", "crackers", "oatcakes", "rice cakes", "breadcrumbs", "pot noodle"
    ],
    snacks: [
      "crisps", "pringles", "chocolate", "chocolate bar", "biscuits", "digestives", "hobnobs", "cookies", "sweets", "haribo", "popcorn", "cereal bars", "snack bars", "flapjack", "kitkat", "dairy milk", "mini rolls", "cake bars", "treats", "nachos", "tortilla chips", "dip"
    ],
    frozen: [
      "frozen", "ice cream", "ice lollies", "lollies", "ice", "fish fingers", "chips", "oven chips", "frozen peas", "frozen veg", "frozen berries", "frozen pizza", "pizza", "chicken nuggets", "nuggets", "potato waffles", "hash browns", "yorkshire puddings", "garlic bread", "sorbet"
    ],
    drinks: [
      "juice", "orange juice", "apple juice", "squash", "cordial", "water", "sparkling water", "fizzy", "cola", "coke", "pepsi", "lemonade", "tonic", "lucozade", "ribena", "smoothie", "tea", "tea bags", "coffee", "instant coffee", "coffee pods", "hot chocolate", "beer", "lager", "cider", "wine", "prosecco", "gin", "vodka", "whisky", "rum", "spirits"
    ],
    toiletries: [
      "shampoo", "conditioner", "shower gel", "body wash", "soap", "hand wash", "handwash", "toothpaste", "toothbrush", "mouthwash", "floss", "deodorant", "razor", "shaving", "moisturiser", "sun cream", "suncream", "sunscreen", "plasters", "paracetamol", "ibuprofen", "calpol", "medicine", "vitamins", "tampons", "sanitary", "pads", "cotton wool", "cotton buds", "tissues", "lip balm", "hair gel", "hairspray", "makeup", "nail varnish",
      "nappies", "nappy", "wipes", "baby wipes", "baby food", "formula", "baby milk", "baby"
    ],
    household: [
      "toilet roll", "toilet paper", "loo roll", "kitchen roll", "kitchen towel", "washing up liquid", "fairy liquid", "dishwasher tablets", "dishwasher salt", "rinse aid", "washing powder", "washing liquid", "laundry", "detergent", "fabric softener", "softener", "bleach", "cleaner", "cleaning", "spray", "anti bacterial", "antibacterial", "disinfectant", "sponges", "scourer", "cloths", "bin bags", "bin liners", "foil", "tin foil", "cling film", "clingfilm", "baking paper", "greaseproof", "freezer bags", "sandwich bags", "batteries", "light bulb", "lightbulb", "candles", "matches", "air freshener", "polish", "rubber gloves", "dusters",
      "cat food", "dog food", "cat litter", "litter", "pet food", "dog treats", "cat treats", "bird seed", "fish food"
    ]
  };

  // Every keyword with its aisle, longest first so phrases beat single words
  const RULES = [];
  Object.entries(WORDS).forEach(([key, words]) => words.forEach(w => RULES.push({ key, w })));
  RULES.sort((a, b) => b.w.length - a.w.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  RULES.forEach(r => { r.re = new RegExp(`(^|[^a-z])${esc(r.w)}`, "i"); });

  const cache = new Map();
  function aisleFor(text) {
    const t = String(text || "").toLowerCase().replace(/[’']/g, "").trim();
    if (!t) return "other";
    if (cache.has(t)) return cache.get(t);
    const hit = RULES.find(r => r.re.test(t));
    const key = hit ? hit.key : "other";
    cache.set(t, key);
    return key;
  }

  // Lists that get aisle groups: the Groceries list, or any shopping-type list
  const isGroceryList = (list) => !!list && (list.id === "groceries" || list.emoji === "🛒" || /grocer|shopping|food shop/i.test(list.title || ""));

  window.Aisles = { AISLES, aisleFor, isGroceryList };
})();
