// ============================================================================
// PRELOADED FAMILY RECIPES BANK (42 High-Quality Household Favorites)
// Covering Breakfast, Lunch, Dinner, and Snack — Aligned with Skylight implementation
// ============================================================================

export const PRELOADED_RECIPES = [
  // --------------------------------------------------------------------------
  // BREAKFAST FAVORITES (B)
  // --------------------------------------------------------------------------
  {
    id: "rec-blueberry-pancakes",
    title: "Blueberry Pancakes",
    subtitle: "Fluffy Golden Pancakes with Warm Maple Syrup & Fresh Berries",
    emoji: "🥞",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "10 mins",
    totalMinutes: 15,
    servings: 4,
    calories: "380 kcal",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "kid-fav", "breakfast"],
    source: "Family Kitchen",
    isFavorite: true,
    ingredients: [
      "1 1/2 cups all-purpose flour",
      "3 1/2 tsp baking powder",
      "1 tsp fine sea salt",
      "1 tbsp caster sugar",
      "1 1/4 cups whole milk",
      "1 large egg",
      "3 tbsp unsalted butter (melted)",
      "1 cup fresh blueberries",
      "Pure Canadian maple syrup (for serving)"
    ],
    instructions: [
      "In a large bowl, sift together the flour, baking powder, salt, and sugar.",
      "In a separate jug, whisk together the milk, egg, and melted butter until blended.",
      "Make a well in the dry ingredients and pour in the milk mixture. Whisk gently until just combined (a few small lumps are fine).",
      "Heat a large non-stick frying pan or griddle over medium heat and lightly butter.",
      "Pour 1/4 cup of batter for each pancake. Scatter 6–8 blueberries onto each surface.",
      "Cook for 2–3 minutes until bubbles burst on top, then flip and cook 1–2 minutes until golden brown.",
      "Serve warm stacked high with butter and warm maple syrup."
    ]
  },
  {
    id: "rec-waffles",
    title: "Waffles",
    subtitle: "Crispy Belgian Style Waffles with Whipped Cream & Berries",
    emoji: "🧇",
    image: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "12 mins",
    totalMinutes: 22,
    servings: 4,
    calories: "410 kcal",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["kid-fav", "breakfast"],
    source: "Family Kitchen",
    isFavorite: true,
    ingredients: [
      "2 cups all-purpose flour",
      "2 tbsp caster sugar",
      "1 tbsp baking powder",
      "1/2 tsp salt",
      "2 large eggs (whites and yolks separated)",
      "1 3/4 cups warm milk",
      "1/2 cup unsalted butter (melted and cooled)",
      "1 tsp vanilla extract",
      "Fresh strawberries & whipped cream"
    ],
    instructions: [
      "Preheat waffle maker according to manufacturer instructions.",
      "Whisk flour, sugar, baking powder, and salt in a bowl.",
      "In another bowl, whisk egg yolks, milk, melted butter, and vanilla.",
      "In a clean bowl, beat egg whites with an electric whisk until stiff peaks form.",
      "Stir wet yolk mixture into the dry ingredients. Gently fold in beaten egg whites with a spatula until airy.",
      "Ladle batter into hot waffle iron and cook until deep golden and crisp (approx 4–5 minutes).",
      "Serve immediately with fresh strawberries, cream, or maple syrup."
    ]
  },
  {
    id: "rec-buttermilk-pie",
    title: "Buttermilk Pie",
    subtitle: "Traditional Custard-Style Sweet Southern Breakfast Treat",
    emoji: "🥧",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "45 mins",
    totalMinutes: 55,
    servings: 8,
    calories: "320 kcal",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["breakfast", "baking"],
    source: "Southern Heritage",
    isFavorite: false,
    ingredients: [
      "1 unbaked 9-inch pie crust",
      "1 1/2 cups granulated sugar",
      "3 tbsp all-purpose flour",
      "3 large eggs (beaten)",
      "1/2 cup unsalted butter (melted)",
      "1 cup fresh buttermilk",
      "1 tsp pure vanilla extract",
      "1 tbsp fresh lemon juice & 1 tsp lemon zest",
      "1/4 tsp ground nutmeg"
    ],
    instructions: [
      "Preheat oven to 175°C (350°F). Roll out pie crust into a 9-inch pie dish and crimp edges.",
      "In a large mixing bowl, whisk together sugar and flour.",
      "Add beaten eggs, melted butter, buttermilk, vanilla extract, lemon juice, and lemon zest. Whisk until silky smooth.",
      "Pour custard filling into prepared pie crust. Lightly dust top with freshly grated nutmeg.",
      "Bake for 45–50 minutes until the centre is just set and top is lightly browned.",
      "Allow to cool to room temperature before slicing for breakfast or brunch."
    ]
  },
  {
    id: "rec-avocado-toast",
    title: "Avocado & Poached Egg Toast",
    subtitle: "Crispy Sourdough with Chilli Flakes, Feta & Fresh Lime",
    emoji: "🥑",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "5 mins",
    totalMinutes: 10,
    servings: 2,
    calories: "340 kcal",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["veggie", "quick", "breakfast"],
    source: "Café Favorite",
    isFavorite: true,
    ingredients: [
      "2 thick slices artisan sourdough bread",
      "2 ripe Hass avocados",
      "2 fresh free-range eggs",
      "1 tbsp white wine vinegar (for poaching)",
      "30g crumbled feta cheese",
      "1/2 tsp crushed red chilli flakes",
      "1 tbsp extra virgin olive oil",
      "Juice of 1/2 lime & sea salt flakes"
    ],
    instructions: [
      "Toast sourdough slices until crunchy and golden brown.",
      "Scoop avocado into a bowl. Mash roughly with lime juice, sea salt, and a splash of olive oil.",
      "Bring a small pot of water with 1 tbsp vinegar to a gentle simmer. Swirl water into a whirlpool and drop in eggs one at a time. Poach for 3 minutes for runny yolks.",
      "Spread avocado thickly over toasted sourdough.",
      "Top each slice with a drained poached egg, crumbled feta, and pinch of chilli flakes."
    ]
  },
  {
    id: "rec-overnight-oats",
    title: "Overnight Berry Chia Oats",
    subtitle: "Creamy Rolled Oats with Greek Yogurt, Chia Seeds & Honey",
    emoji: "🥣",
    image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "0 mins",
    totalMinutes: 5,
    servings: 2,
    calories: "310 kcal",
    category: "breakfast",
    mealType: "breakfast",
    tags: ["quick", "veggie", "breakfast"],
    source: "Quick Prep",
    isFavorite: false,
    ingredients: [
      "1 cup rolled jumbo oats",
      "1 cup unsweetened almond or oat milk",
      "1/2 cup Greek yogurt",
      "1 tbsp black chia seeds",
      "2 tbsp pure runny honey or maple syrup",
      "1/2 tsp ground cinnamon",
      "1/2 cup mixed fresh raspberries and blueberries"
    ],
    instructions: [
      "In a glass mason jar or container, combine rolled oats, chia seeds, and cinnamon.",
      "Pour in milk, Greek yogurt, and honey. Stir well with a spoon until combined.",
      "Cover with lid and refrigerate overnight (or at least 4 hours).",
      "In the morning, give it a quick stir and top generously with fresh raspberries and blueberries."
    ]
  },

  // --------------------------------------------------------------------------
  // LUNCH FAVORITES (L)
  // --------------------------------------------------------------------------
  {
    id: "rec-sandwich",
    title: "Sandwich",
    subtitle: "Artisan Deli Sourdough with Smoked Turkey, Aged Cheddar & Dijon",
    emoji: "🥪",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "0 mins",
    totalMinutes: 5,
    servings: 2,
    calories: "440 kcal",
    category: "lunch",
    mealType: "lunch",
    tags: ["quick", "kid-fav", "lunch"],
    source: "Deli Special",
    isFavorite: true,
    ingredients: [
      "4 slices fresh sourdough or seed bread",
      "150g smoked turkey breast or carved ham",
      "60g aged mature cheddar cheese (sliced)",
      "1 ripe tomato (thinly sliced)",
      "1 cup crisp romaine lettuce leaves",
      "2 tbsp real mayonnaise",
      "1 tsp wholegrain Dijon mustard",
      "Handful of kettle crisps (to serve)"
    ],
    instructions: [
      "Lightly spread mayonnaise on two bread slices and wholegrain Dijon on the other two.",
      "Layer cheddar slices, followed by sliced smoked turkey.",
      "Add tomato slices, a pinch of salt and cracked pepper, and crisp romaine leaves.",
      "Close sandwiches, slice diagonally with a serrated knife, and serve with crispy potato crisps."
    ]
  },
  {
    id: "rec-wraps",
    title: "Wraps",
    subtitle: "Crispy Chicken & Honey Mustard Salad Tortilla Wraps",
    emoji: "🌯",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "10 mins",
    totalMinutes: 20,
    servings: 4,
    calories: "460 kcal",
    category: "lunch",
    mealType: "lunch",
    tags: ["quick", "kid-fav", "lunch"],
    source: "Family Lunch",
    isFavorite: true,
    ingredients: [
      "4 large soft flour tortillas",
      "300g crispy cooked chicken tenders or grilled strips",
      "2 cups shredded iceberg or romaine lettuce",
      "1 cup grated mild cheddar or Monterey Jack",
      "1 cup sweetcorn (drained)",
      "3 tbsp honey mustard dressing",
      "1 ripe avocado (diced)"
    ],
    instructions: [
      "Warm tortillas in a dry pan for 15 seconds to make pliable.",
      "Spread honey mustard dressing down the centre of each tortilla.",
      "Top with warm chicken strips, shredded lettuce, diced avocado, sweetcorn, and grated cheese.",
      "Fold in both sides tightly and roll up from bottom to top.",
      "Slice in half diagonally and pack for lunch or serve fresh."
    ]
  },
  {
    id: "rec-leftovers",
    title: "Leftovers",
    subtitle: "Heated Family Dinner Special with Crusty Bread & Salad",
    emoji: "🍲",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
    prepTime: "2 mins",
    cookTime: "5 mins",
    totalMinutes: 7,
    servings: 2,
    calories: "420 kcal",
    category: "lunch",
    mealType: "lunch",
    tags: ["quick", "lunch"],
    source: "Zero Waste",
    isFavorite: false,
    ingredients: [
      "Portion of yesterday's dinner (curry, stew, pasta, or roast)",
      "2 slices warm crusty sourdough or baguette with butter",
      "Simple side green salad with balsamic glaze"
    ],
    instructions: [
      "Transfer dinner leftovers into a microwave-safe bowl or warm gently in a small skillet.",
      "Cover and reheat until piping hot throughout.",
      "Serve accompanied by warm buttered bread and fresh crunchy greens."
    ]
  },
  {
    id: "rec-caesar-salad",
    title: "Classic Chicken Caesar Salad",
    subtitle: "Crisp Cos Lettuce, Shaved Parmesan, Garlic Croutons & Creamy Dressing",
    emoji: "🥗",
    image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "8 mins",
    totalMinutes: 18,
    servings: 2,
    calories: "430 kcal",
    category: "lunch",
    mealType: "lunch",
    tags: ["quick", "lunch"],
    source: "Bistro Classic",
    isFavorite: false,
    ingredients: [
      "2 large chicken breasts (pan-fried with garlic herb butter)",
      "2 heads romaine lettuce (washed and chopped)",
      "1 cup sourdough garlic croutons",
      "40g shaved Parmigiano-Reggiano",
      "4 tbsp creamy Caesar dressing",
      "Juice of 1/2 lemon & cracked black pepper"
    ],
    instructions: [
      "Slice pan-fried chicken into thick juicy strips.",
      "Toss chopped romaine lettuce with Caesar dressing and half the shaved parmesan.",
      "Divide between bowls and top with hot chicken strips, crunchy croutons, and remaining parmesan shavings."
    ]
  },

  // --------------------------------------------------------------------------
  // DINNER FAVORITES (D) — Matching Skylight Photo & Family Classics
  // --------------------------------------------------------------------------
  {
    id: "rec-skillet-lasagna",
    title: "Skillet Lasagna",
    subtitle: "One-Pan Italian Sausage, Ricotta & Mozzarella Lasagna",
    emoji: "🥘",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "25 mins",
    totalMinutes: 35,
    servings: 4,
    calories: "590 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["pasta", "meat", "dinner", "kid-fav"],
    source: "Skylight Signature",
    isFavorite: true,
    ingredients: [
      "1 Tbsp olive oil",
      "1/2 lb. Italian Sausage",
      "2 cloves garlic (minced)",
      "24 oz. pasta sauce (marinara)",
      "1 cup water",
      "1/2 tsp Italian seasoning",
      "9 lasagna noodles (broken into 2-inch pieces)",
      "1 cup ricotta cheese",
      "1/4 cup Grated Parmesan",
      "1/4 tsp salt",
      "1/4 tsp freshly cracked black pepper",
      "1 cup shredded mozzarella"
    ],
    instructions: [
      "Heat olive oil in a deep 12-inch non-stick skillet over medium-high heat. Brown Italian sausage, breaking it up with a wooden spoon until cooked through (approx 5 mins).",
      "Stir in minced garlic and cook for 1 minute until fragrant.",
      "Pour in pasta sauce, water, and Italian seasoning. Stir well.",
      "Submerge the broken lasagna noodles into the sauce, pushing them down so they are completely covered.",
      "Bring sauce to a simmer, reduce heat to low, cover with lid, and cook for 15–18 minutes until noodles are tender, stirring occasionally to prevent sticking.",
      "Season with salt and freshly cracked black pepper.",
      "Dollop spoonfuls of ricotta cheese over the noodles, then sprinkle generously with grated parmesan and shredded mozzarella.",
      "Cover for 3 minutes until cheese is completely melted and bubbling. Let rest 5 minutes before serving."
    ]
  },
  {
    id: "rec-cowboy-casserole",
    title: "Cowboy Casserole",
    subtitle: "Hearty Ground Beef, Sweetcorn & Black Beans under Crispy Tater Tots",
    emoji: "🤠",
    image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80",
    prepTime: "15 mins",
    cookTime: "30 mins",
    totalMinutes: 45,
    servings: 6,
    calories: "560 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["meat", "dinner", "kid-fav"],
    source: "Skylight Special",
    isFavorite: true,
    ingredients: [
      "500g lean ground beef (mince)",
      "1 medium yellow onion (diced)",
      "2 cloves garlic (minced)",
      "1 can (400g) sweetcorn (drained)",
      "1 can (400g) black beans (rinsed)",
      "1 can (400g) chopped tomatoes",
      "1 tbsp taco or chilli seasoning",
      "150g mature cheddar cheese (shredded)",
      "500g frozen potato tater tots"
    ],
    instructions: [
      "Preheat oven to 200°C (400°F).",
      "Brown ground beef and diced onion in a large skillet over medium-high heat until cooked through. Drain any excess fat.",
      "Stir in minced garlic, taco seasoning, sweetcorn, black beans, and chopped tomatoes. Simmer for 5 minutes.",
      "Transfer mixture to an ovenproof casserole baking dish. Stir in half of the cheddar cheese.",
      "Arrange frozen tater tots in neat rows across the top, covering the entire casserole.",
      "Bake uncovered for 25 minutes until tater tots are golden and ultra crispy.",
      "Scatter remaining cheddar over the tots and bake 5 more minutes until melted. Serve piping hot."
    ]
  },
  {
    id: "rec-pulled-pork",
    title: "Slow Cooker Pulled Pork",
    subtitle: "Tender Smoky BBQ Pork Shoulder with Brioche Buns & Crisp Slaw",
    emoji: "🍖",
    image: "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "360 mins",
    totalMinutes: 370,
    servings: 6,
    calories: "620 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["meat", "dinner", "kid-fav"],
    source: "Skylight Slow Cooker",
    isFavorite: true,
    ingredients: [
      "1.5kg boneless pork shoulder / collar",
      "2 tbsp brown sugar",
      "1 tbsp smoked paprika",
      "1 tsp garlic powder & 1 tsp onion powder",
      "1/2 tsp cumin & 1 tsp fine salt",
      "1 cup smoky BBQ sauce",
      "1/3 cup apple cider vinegar",
      "6 soft brioche burger buns",
      "Creamy apple cider coleslaw (for serving)"
    ],
    instructions: [
      "Rub pork shoulder on all sides with brown sugar, paprika, garlic powder, onion powder, cumin, and salt.",
      "Place into slow cooker. Pour apple cider vinegar and half the BBQ sauce around the pork.",
      "Cover and cook on LOW for 8 hours (or HIGH for 5 hours) until fork-tender and falling apart.",
      "Transfer pork to a carving board and shred using two forks, discarding excess fat.",
      "Toss shredded pork with remaining warm BBQ sauce and juices from the slow cooker.",
      "Heap into toasted brioche buns and top with cool crunchy coleslaw."
    ]
  },
  {
    id: "rec-black-bean-burritos",
    title: "Black Bean Burritos",
    subtitle: "Cheesy Stuffed Burritos with Cilantro Lime Rice & Salsa",
    emoji: "🌯",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "15 mins",
    totalMinutes: 25,
    servings: 4,
    calories: "510 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["veggie", "quick", "dinner", "kid-fav"],
    source: "Skylight Special",
    isFavorite: true,
    ingredients: [
      "4 large flour tortillas",
      "2 cans (400g each) black beans (rinsed and drained)",
      "1 tsp ground cumin & 1 tsp smoked paprika",
      "2 cups cooked long grain rice (tossed with lime juice and chopped cilantro)",
      "150g shredded Monterey Jack or cheddar cheese",
      "1 cup fresh chunky tomato salsa",
      "100g sour cream"
    ],
    instructions: [
      "Heat a saucepan over medium heat with 1 tsp oil. Add black beans, cumin, paprika, and 3 tbsp water. Simmer and lightly mash with a fork for 5 minutes.",
      "Warm tortillas in a dry pan or microwave until soft.",
      "Layer each tortilla with cilantro lime rice, seasoned black beans, salsa, and shredded cheese.",
      "Fold in ends and roll tightly into burritos.",
      "Optional: Toast rolled burritos seam-side down in a dry hot skillet for 2 minutes each side until golden and crispy.",
      "Serve with sour cream and guacamole."
    ]
  },
  {
    id: "rec-homemade-pizza",
    title: "Homemade Pizza",
    subtitle: "Stone-Baked Crust with San Marzano Sauce & Mozzarella",
    emoji: "🍕",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80",
    prepTime: "20 mins",
    cookTime: "12 mins",
    totalMinutes: 32,
    servings: 4,
    calories: "640 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["kid-fav", "dinner", "veggie"],
    source: "Friday Night Tradition",
    isFavorite: true,
    ingredients: [
      "500g fresh pizza dough (or sourdough bases)",
      "200g San Marzano pizza sauce or crushed plum tomatoes",
      "250g fresh mozzarella (torn and patted dry)",
      "Handful fresh basil leaves",
      "2 tbsp extra virgin olive oil",
      "Choice toppings: pepperoni, mushrooms, sweetcorn, ham"
    ],
    instructions: [
      "Preheat oven to its absolute hottest setting (240°C–260°C) with pizza stone or heavy baking sheet inside.",
      "Stretch dough gently on a lightly floured board into two 12-inch rounds.",
      "Spread thin layer of pizza sauce leaving a 1/2-inch border for crust.",
      "Top with torn fresh mozzarella and desired family toppings.",
      "Bake for 10–12 minutes until crust is blistered and cheese is browned and bubbly.",
      "Drizzle with olive oil, scatter fresh basil leaves, and slice with a pizza wheel."
    ]
  },
  {
    id: "rec-spaghetti",
    title: "Spaghetti",
    subtitle: "Spaghetti Bolognese with Rich Slow-Cooked Beef & Herb Ragù",
    emoji: "🍝",
    image: "https://images.unsplash.com/photo-1621996346565-e3adc644d9fa?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "25 mins",
    totalMinutes: 35,
    servings: 4,
    calories: "580 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["pasta", "meat", "dinner", "kid-fav"],
    source: "Family Favorite",
    isFavorite: true,
    ingredients: [
      "400g bronze-die spaghetti",
      "450g lean minced beef",
      "1 large onion & 2 cloves garlic (finely chopped)",
      "1 carrot & 1 celery stick (finely grated)",
      "2 cans (400g each) chopped Italian tomatoes",
      "2 tbsp tomato purée",
      "1 tsp dried oregano & fresh basil",
      "50g freshly grated Parmigiano-Reggiano"
    ],
    instructions: [
      "Sauté onion, garlic, grated carrot, and celery in 1 tbsp olive oil for 6 minutes until soft.",
      "Add minced beef and brown thoroughly, breaking into small pieces.",
      "Stir in tomato purée, canned tomatoes, and oregano. Simmer gently for 20 minutes.",
      "Boil spaghetti in salted water until al dente (approx 9–10 mins). Drain, reserving 3 tbsp pasta water.",
      "Toss drained spaghetti directly into the ragù. Serve topped with parmesan and fresh basil."
    ]
  },
  {
    id: "rec-spinach-tortelloni",
    title: "Easy Peasy Spinach & Ricotta Tortelloni",
    subtitle: "with Creamy Basil Pesto Sauce, Garden Peas & Broccoli",
    emoji: "🥟",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "10 mins",
    totalMinutes: 15,
    servings: 4,
    calories: "520 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["veggie", "quick", "pasta", "kid-fav", "dinner"],
    source: "HelloFresh #47",
    isFavorite: true,
    ingredients: [
      "500g fresh spinach & ricotta tortelloni",
      "190g green basil pesto",
      "150g crème fraîche (or double cream)",
      "150g frozen garden peas",
      "150g tenderstem broccoli or sliced mushrooms",
      "40g grated parmesan / Italian hard cheese",
      "1 tbsp olive oil",
      "Salt & freshly cracked black pepper"
    ],
    instructions: [
      "Bring a large saucepan of water to a rolling boil with 1 tsp salt.",
      "Heat olive oil in a wide frying pan over medium heat. Sauté broccoli or mushrooms for 4–5 minutes until tender.",
      "Cook tortelloni in the boiling water for 3–4 minutes until they float.",
      "Add frozen peas, basil pesto, and crème fraîche to the veg pan. Stir gently over low heat until creamy.",
      "Drain pasta (reserve 2 tbsp pasta water). Gently fold tortelloni into the sauce.",
      "Serve hot in shallow bowls topped with grated parmesan and freshly cracked pepper."
    ]
  },
  {
    id: "rec-halloumi-fajitas",
    title: "Smoky Halloumi & Sweet Pepper Fajitas",
    subtitle: "with Warm Tortillas, Fresh Guacamole & Lime Crema",
    emoji: "🧀",
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "12 mins",
    totalMinutes: 22,
    servings: 4,
    calories: "580 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["veggie", "quick", "kid-fav", "dinner"],
    source: "Family Favorite",
    isFavorite: true,
    ingredients: [
      "250g halloumi cheese (sliced into thick fingers)",
      "2 large bell peppers (red and yellow, thinly sliced)",
      "1 large red onion (sliced into half-moons)",
      "1 packet fajita seasoning (smoked paprika, cumin, oregano)",
      "8 soft mini flour tortillas",
      "2 ripe avocados (mashed with lime juice and salt)",
      "100g sour cream",
      "1 lime (cut into wedges)"
    ],
    instructions: [
      "Toss sliced peppers and onion with 1 tbsp oil and 2/3 of the fajita seasoning.",
      "Fry the seasoned veg in a scorching hot skillet for 6–8 minutes until nicely charred at the edges.",
      "Dust halloumi slices with remaining fajita spice. Fry in a dry non-stick pan for 2–3 minutes per side until golden brown.",
      "Warm tortillas in a dry pan or 20 seconds in the microwave wrapped in a clean tea towel.",
      "Bring the sizzling veg and golden halloumi to the table with guacamole, sour cream, and lime wedges for everyone to build their own."
    ]
  },
  {
    id: "rec-carbonara",
    title: "Authentic Roman Spaghetti Carbonara",
    subtitle: "with Crispy Pancetta, Egg Yolks, Pecorino & Black Pepper",
    emoji: "🍝",
    image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "15 mins",
    totalMinutes: 20,
    servings: 4,
    calories: "620 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["pasta", "quick", "dinner"],
    source: "Italian Classic",
    isFavorite: true,
    ingredients: [
      "400g bronze-die spaghetti",
      "150g smoked pancetta or guanciale cubes",
      "4 large free-range egg yolks + 1 whole egg",
      "75g finely grated Pecorino Romano (or Parmigiano)",
      "Coarsely cracked black pepper"
    ],
    instructions: [
      "Boil spaghetti in generously salted water until al dente.",
      "While pasta cooks, fry pancetta in a wide skillet until fat is rendered and edges are crisp. Remove pan from heat.",
      "In a bowl, whisk egg yolks, whole egg, grated Pecorino, and abundant black pepper into a thick paste.",
      "Transfer cooked pasta directly into the pancetta pan with tongs. Splash in 3 tbsp starchy pasta water.",
      "Allow pan to cool 30 seconds off the flame, then pour in egg cheese mixture, tossing quickly to create a silky glossy sauce without scrambling.",
      "Serve immediately on warm plates with extra cheese and cracked pepper."
    ]
  },
  {
    id: "rec-tikka-masala",
    title: "Authentic Chicken Tikka Masala",
    subtitle: "in Velvety Tomato Spiced Cream Sauce with Fluffy Basmati",
    emoji: "🍛",
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80",
    prepTime: "15 mins",
    cookTime: "25 mins",
    totalMinutes: 40,
    servings: 4,
    calories: "680 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["meat", "dinner"],
    source: "Curry Night",
    isFavorite: true,
    ingredients: [
      "600g diced chicken breast",
      "150g natural Greek yogurt",
      "2 tbsp tikka masala spice blend (garam masala, turmeric, cumin)",
      "1 large onion & 3 cloves garlic (finely minced)",
      "1 can (400g) crushed tomatoes",
      "100ml double cream",
      "Basmati rice and warm garlic naan bread"
    ],
    instructions: [
      "Coat chicken with yogurt and 1 tbsp tikka spices; marinate 15 minutes.",
      "Sear chicken in a hot pan until charred at the edges. Remove.",
      "Sauté onion and garlic until golden. Add remaining spices and cook 1 minute.",
      "Stir in crushed tomatoes and simmer for 15 minutes until rich.",
      "Stir in double cream and return chicken to pan. Simmer 5 minutes until succulent.",
      "Serve with steamed basmati rice, warm garlic naan, and fresh coriander."
    ]
  },
  {
    id: "rec-sweet-potato-curry",
    title: "Sweet Potato & Chickpea Coconut Curry",
    subtitle: "with Baby Spinach, Roasted Peanuts & Lime Wedges",
    emoji: "🍠",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "20 mins",
    totalMinutes: 30,
    servings: 4,
    calories: "490 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["veggie", "quick", "dinner"],
    source: "One-Pot Vegan",
    isFavorite: true,
    ingredients: [
      "2 large sweet potatoes (peeled and diced into 2cm cubes)",
      "1 can (400g) chickpeas (rinsed and drained)",
      "1 can (400ml) full-fat coconut milk",
      "1 can (400g) chopped plum tomatoes",
      "2 tbsp mild yellow curry paste or Katsu powder",
      "100g baby spinach leaves",
      "1 lime & small handful roasted peanuts"
    ],
    instructions: [
      "Fry curry paste in 1 tbsp oil in a deep pot for 1 minute until aromatic.",
      "Add diced sweet potato cubes and stir to coat.",
      "Pour in coconut milk and canned tomatoes. Bring to a simmer, cover, and cook for 15 minutes until sweet potato is tender.",
      "Stir in chickpeas and baby spinach until spinach is wilted.",
      "Squeeze fresh lime juice over the pot and scatter with roasted peanuts."
    ]
  },
  {
    id: "rec-chicken-tenders",
    title: "Crispy Oven-Baked Chicken Tenders",
    subtitle: "with Golden Panko Crumb, Paprika & Garlic Herb Dip",
    emoji: "🍗",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "15 mins",
    totalMinutes: 25,
    servings: 4,
    calories: "450 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["kid-fav", "meat", "quick", "dinner"],
    source: "Family Kitchen",
    isFavorite: true,
    ingredients: [
      "500g chicken mini fillets / tenders",
      "1 1/2 cups Japanese panko breadcrumbs",
      "2 large eggs (beaten)",
      "1/2 cup plain flour seasoned with salt, garlic powder & smoked paprika",
      "3 tbsp grated parmesan",
      "Sweet potato fries & homemade garlic mayo"
    ],
    instructions: [
      "Preheat oven to 210°C (410°F). Line a large baking sheet with parchment paper.",
      "Dredge chicken tenders in seasoned flour, dip in beaten eggs, then press firmly into panko mixed with parmesan.",
      "Arrange on baking sheet and lightly mist with olive oil spray.",
      "Bake for 15–18 minutes until deeply golden and crunchy.",
      "Serve with baked sweet potato fries and garlic herb dip."
    ]
  },
  {
    id: "rec-mac-and-cheese",
    title: "Creamy Stovetop Macaroni Cheese",
    subtitle: "with Three Cheeses, Crispy Herb Breadcrumbs & Bacon Bits",
    emoji: "🧀",
    image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "15 mins",
    totalMinutes: 25,
    servings: 4,
    calories: "620 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["kid-fav", "pasta", "veggie", "dinner"],
    source: "Comfort Classic",
    isFavorite: true,
    ingredients: [
      "350g elbow macaroni",
      "50g unsalted butter & 50g all-purpose flour",
      "600ml whole milk (warmed)",
      "150g mature cheddar cheese (grated)",
      "100g Red Leicester or Gruyère (grated)",
      "1 tsp Dijon mustard & pinch ground nutmeg",
      "1/2 cup crispy panko breadcrumbs toasted in butter"
    ],
    instructions: [
      "Boil macaroni in salted water until just tender (approx 8 mins). Drain.",
      "In a saucepan, melt butter, stir in flour and cook roux for 1 minute.",
      "Gradually whisk in warm milk until smooth. Simmer 3 minutes until thick and glossy.",
      "Remove from heat and stir in grated cheeses, mustard, and nutmeg until silky.",
      "Fold drained macaroni into the velvety cheese sauce.",
      "Scatter toasted herb panko on top and serve bubbly hot."
    ]
  },
  {
    id: "rec-sunday-roast",
    title: "Sunday Roast Lemon & Thyme Whole Chicken",
    subtitle: "with Crispy Roast Potatoes, Yorkshire Puddings & Rich Gravy",
    emoji: "🍗",
    image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80",
    prepTime: "15 mins",
    cookTime: "75 mins",
    totalMinutes: 90,
    servings: 6,
    calories: "720 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["meat", "dinner"],
    source: "Sunday Tradition",
    isFavorite: true,
    ingredients: [
      "1.6kg whole free-range chicken",
      "1 whole lemon (halved) & fresh thyme sprigs",
      "40g soft butter mixed with garlic and sea salt",
      "1kg Maris Piper potatoes (peeled and halved for roasting)",
      "Duck fat or vegetable oil for potatoes",
      "Yorkshire puddings, steamed green beans & rich chicken gravy"
    ],
    instructions: [
      "Preheat oven to 190°C (375°F). Stuff chicken cavity with lemon halves and fresh thyme.",
      "Rub garlic herb butter all over and under the chicken skin. Season generously.",
      "Roast chicken for 1 hour 15 minutes until juices run clear and skin is crackling crisp.",
      "Parboil potatoes for 8 minutes, rough up edges in a colander, and roast in hot duck fat for 45 minutes until ultra-crispy.",
      "Rest carved chicken for 15 minutes before serving with roasties, Yorkshires, and hot gravy."
    ]
  },
  {
    id: "rec-fish-finger-tacos",
    title: "Crispy Fish Finger Tacos",
    subtitle: "with Crunchy Slaw, Pickled Jalapeños & Lime Crema",
    emoji: "🌮",
    image: "https://images.unsplash.com/photo-1512838243191-e81e88375e2f?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "12 mins",
    totalMinutes: 22,
    servings: 4,
    calories: "480 kcal",
    category: "dinner",
    mealType: "dinner",
    tags: ["quick", "kid-fav", "dinner"],
    source: "Family Taco Night",
    isFavorite: true,
    ingredients: [
      "10 chunky cod or haddock fish fingers",
      "8 mini soft flour or corn tortillas",
      "2 cups shredded red cabbage and carrot slaw",
      "100g sour cream mixed with lime juice & zest",
      "Sliced pickled jalapeños & fresh coriander",
      "Hot sauce or chipotle mayo (optional)"
    ],
    instructions: [
      "Bake fish fingers in oven or air fryer at 200°C for 12–14 minutes until extra crispy.",
      "Warm tortillas in a dry pan until lightly charred.",
      "Toss shredded cabbage with a splash of lime juice and salt.",
      "Layer tortillas with slaw, 1–2 crispy fish fingers, lime crema, and jalapeños.",
      "Serve with lime wedges and sweetcorn."
    ]
  },

  // --------------------------------------------------------------------------
  // SNACK FAVORITES (S) — Matching Skylight Photo & Family Healthy Snacks
  // --------------------------------------------------------------------------
  {
    id: "rec-granola-bar",
    title: "Granola Bar",
    subtitle: "No-Bake Chewy Honey & Peanut Butter Oat Bars with Mini Choc Chips",
    emoji: "🍫",
    image: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "0 mins",
    totalMinutes: 10,
    servings: 8,
    calories: "190 kcal",
    category: "snack",
    mealType: "snack",
    tags: ["quick", "kid-fav", "snack"],
    source: "Skylight Snack",
    isFavorite: true,
    ingredients: [
      "2 cups rolled jumbo oats",
      "1/2 cup natural creamy peanut butter or almond butter",
      "1/3 cup pure honey or maple syrup",
      "1/4 cup mini dark chocolate chips",
      "2 tbsp chia seeds or ground flaxseed",
      "1/2 tsp vanilla extract",
      "Pinch of sea salt"
    ],
    instructions: [
      "Warm peanut butter and honey in a microwave-safe bowl for 20 seconds until easily stirrable.",
      "Stir in oats, chia seeds, vanilla, and salt until thoroughly combined.",
      "Let mixture cool slightly for 3 minutes, then fold in mini chocolate chips.",
      "Press firmly into an 8x8 inch baking dish lined with parchment paper.",
      "Chill in freezer for 20 minutes until set, then slice into 8 chewy snack bars."
    ]
  },
  {
    id: "rec-carrots-hummus",
    title: "Carrots and Hummus",
    subtitle: "Crisp Rainbow Carrot Batons with Creamy Smoked Paprika Hummus",
    emoji: "🥕",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "0 mins",
    totalMinutes: 5,
    servings: 2,
    calories: "160 kcal",
    category: "snack",
    mealType: "snack",
    tags: ["veggie", "quick", "snack"],
    source: "Healthy Snacking",
    isFavorite: true,
    ingredients: [
      "4 large crunchy carrots (peeled and cut into finger batons)",
      "1 tub (200g) smooth classic hummus",
      "1 tbsp extra virgin olive oil",
      "1/4 tsp smoked Spanish paprika",
      "Pita chips or cucumber slices (optional)"
    ],
    instructions: [
      "Spoon hummus into a serving dip bowl.",
      "Swirl the top with extra virgin olive oil and dust with smoked paprika.",
      "Arrange freshly cut carrot batons around the bowl for easy dipping."
    ]
  },
  {
    id: "rec-cheese-crackers",
    title: "Cheese and Crackers Platter",
    subtitle: "Artisan Aged Cheddar, Creamy Brie, Seeded Crackers & Red Grapes",
    emoji: "🧀",
    image: "https://images.unsplash.com/photo-1631379578550-7038263db699?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "0 mins",
    totalMinutes: 5,
    servings: 4,
    calories: "280 kcal",
    category: "snack",
    mealType: "snack",
    tags: ["quick", "kid-fav", "snack"],
    source: "Skylight Snack",
    isFavorite: true,
    ingredients: [
      "100g mature white cheddar cheese (cubed)",
      "100g French creamy brie cheese",
      "1 box artisan seeded sourdough crackers",
      "1 bunch crisp seedless red grapes",
      "Small handful of raw walnut halves"
    ],
    instructions: [
      "Arrange the crackers in a neat fan across a wooden board or platter.",
      "Place cheddar cubes and brie slices next to the crackers.",
      "Add a cluster of cold washed red grapes and scatter walnuts in remaining spaces."
    ]
  },
  {
    id: "rec-fruit",
    title: "Fruit",
    subtitle: "Crisp Red Apple Slices, Strawberries, Blueberries & Sweet Grapes",
    emoji: "🍎",
    image: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&auto=format&fit=crop&q=80",
    prepTime: "5 mins",
    cookTime: "0 mins",
    totalMinutes: 5,
    servings: 3,
    calories: "120 kcal",
    category: "snack",
    mealType: "snack",
    tags: ["quick", "kid-fav", "veggie", "snack"],
    source: "Skylight Snack",
    isFavorite: true,
    ingredients: [
      "2 crisp Gala or Pink Lady apples (cored and sliced)",
      "1 punnet fresh ripe strawberries (halved)",
      "1 cup fresh plump blueberries",
      "1 cup sweet seedless green grapes",
      "1 squeeze fresh lemon juice (to keep apples bright)"
    ],
    instructions: [
      "Wash all fruit in cold water and pat dry.",
      "Slice apples into wedges and toss lightly with a squeeze of fresh lemon juice.",
      "Arrange colorfully on a platter for the family to grab."
    ]
  },
  {
    id: "rec-peppermint-bark",
    title: "Peppermint Bark",
    subtitle: "Layered Dark & White Chocolate Topped with Crushed Candy Canes",
    emoji: "🍬",
    image: "https://images.unsplash.com/photo-1548848221-0c2e497ed557?w=800&auto=format&fit=crop&q=80",
    prepTime: "10 mins",
    cookTime: "5 mins",
    totalMinutes: 15,
    servings: 8,
    calories: "220 kcal",
    category: "snack",
    mealType: "snack",
    tags: ["dessert", "kid-fav", "snack"],
    source: "Holiday Favorite",
    isFavorite: false,
    ingredients: [
      "250g good quality dark chocolate (chopped)",
      "250g good quality white chocolate (chopped)",
      "1/2 tsp peppermint extract",
      "4 peppermint candy canes (crushed into coarse shards)"
    ],
    instructions: [
      "Melt dark chocolate in a heatproof bowl set over simmering water. Stir in 1/4 tsp peppermint extract.",
      "Pour onto a parchment-lined baking sheet and spread into an even 1/4-inch rectangle. Chill 20 minutes until set.",
      "Melt white chocolate with remaining 1/4 tsp peppermint extract. Gently pour over set dark chocolate layer.",
      "Immediately scatter crushed candy cane shards across the top, pressing in gently.",
      "Refrigerate for 30 minutes until firm, then snap into rustic shards."
    ]
  }
];

// Helper: get all recipes (custom user-added + preloaded)
export function getAllFamilyRecipes() {
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
  } catch (e) {
    console.warn("Could not load custom recipes from localStorage:", e);
  }
  const all = [...custom, ...PRELOADED_RECIPES];

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
