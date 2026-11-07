// ============================================================================
// SHOPPING LIST RULES (js/grocery.js)
// How recipe ingredients become items on the Groceries list (the same list
// the Lists page shows). Shared by the recipe card, the planned-meal panel and
// "Add this week's meals".
//
//  - Each line is read as amount + unit + ingredient ("1 finely sliced Onion"
//    -> 1 x onion). Words like "chopped" or "medium" don't make a new item.
//  - The same ingredient adds up: 100g + 25g butter = 125g Butter, 1 + 2
//    onions = 3 Onions. Units that can't be added together (100g and 1 tbsp)
//    stay on one line: "Butter: 100g + 1 tbsp".
//  - Only items not yet bought are added to. Once something's ticked, a new
//    recipe puts it back as a fresh item.
//  - Salt, pepper, cooking oil and water are left out unless the family asks
//    for them (a setting on this device).
//  - Each item remembers which meals it's for ("For: Cumberland Pie").
//  - Adding the same meal (same dish and day) twice doesn't double up.
//
// Items keep a readable `text`, so anything that shows a list still works;
// the extra details live in `item.grocery`.
// ============================================================================

(function () {
  // ---- Units ---------------------------------------------------------------
  // dim: which amounts can be added together; f: size in that dim's base unit
  const UNITS = {
    g:      { dim: "mass", f: 1,      words: ["g", "gr", "gram", "grams", "gm", "gms"] },
    kg:     { dim: "mass", f: 1000,   words: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"] },
    oz:     { dim: "mass", f: 28.35,  words: ["oz", "ounce", "ounces"] },
    lb:     { dim: "mass", f: 453.6,  words: ["lb", "lbs", "pound", "pounds"] },
    ml:     { dim: "vol",  f: 1,      words: ["ml", "mls", "millilitre", "millilitres", "milliliter", "milliliters"] },
    l:      { dim: "vol",  f: 1000,   words: ["l", "litre", "litres", "liter", "liters", "ltr"] },
    tsp:    { dim: "spoon", f: 1,     words: ["tsp", "tsps", "teaspoon", "teaspoons", "t"] },
    tbsp:   { dim: "spoon", f: 3,     words: ["tbsp", "tbsps", "tbs", "tbls", "tblsp", "tblsps", "tablespoon", "tablespoons", "tbl"] },
    cup:    { dim: "cup",  f: 1,      words: ["cup", "cups"] },
    clove:  { dim: "clove", f: 1,     words: ["clove", "cloves"] },
    can:    { dim: "can",  f: 1,      words: ["can", "cans", "tin", "tins"] },
    jar:    { dim: "jar",  f: 1,      words: ["jar", "jars"] },
    pack:   { dim: "pack", f: 1,      words: ["pack", "packs", "packet", "packets", "pkt", "pouch", "pouches", "bag", "bags"] },
    slice:  { dim: "slice", f: 1,     words: ["slice", "slices", "rasher", "rashers"] },
    sprig:  { dim: "sprig", f: 1,     words: ["sprig", "sprigs"] },
    bunch:  { dim: "bunch", f: 1,     words: ["bunch", "bunches"] },
    head:   { dim: "head", f: 1,      words: ["head", "heads"] },
    stick:  { dim: "stick", f: 1,     words: ["stick", "sticks", "stalk", "stalks"] },
    handful:{ dim: "handful", f: 1,   words: ["handful", "handfuls"] },
    pinch:  { dim: "pinch", f: 1,     words: ["pinch", "pinches"] },
    dash:   { dim: "dash", f: 1,      words: ["dash", "dashes", "splash", "drizzle"] },
    knob:   { dim: "knob", f: 1,      words: ["knob", "knobs"] },
  };
  const UNIT_BY_WORD = {};
  Object.entries(UNITS).forEach(([u, def]) => def.words.forEach(w => { UNIT_BY_WORD[w] = u; }));

  // Words that describe how it's prepared, not what to buy
  const DESCRIPTORS = new Set(("chopped finely roughly thinly thickly sliced diced minced grated crushed " +
    "peeled deseeded seeded halved quartered cubed shredded torn beaten softened melted cooked uncooked " +
    "fresh freshly dried ground large medium small big little whole ripe trimmed rinsed drained washed " +
    "boneless skinless lean cut into pieces chunks to taste serve garnish optional heaped level " +
    "about approx approximately plus extra more some few good handful of the a an and or for " +
  "pounded thickness cubes cube blanched briefly in into boiling shaved crumbled zested juiced").split(/\s+/));

  // Left out unless asked for: the things nearly every kitchen already has
  const BASICS = new Set(["salt", "sea salt", "kosher salt", "table salt", "pepper", "black pepper",
    "ground black pepper", "white pepper", "salt and pepper", "salt pepper", "water", "cold water", "warm water",
    "hot water", "boiling water", "ice", "oil", "olive oil", "extra virgin olive oil", "vegetable oil",
    "rapeseed oil", "sunflower oil", "cooking oil", "groundnut oil"]);

  const FRACTIONS = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };

  // "1 1/2", "1½", "½", "1.5", "1-2" (takes the larger), "2x"
  function readNumber(s) {
    const m = s.match(/^\s*(\d+(?:[.,]\d+)?)?\s*([½⅓⅔¼¾⅛])?(?:\s*(\d+)\/(\d+)|\/(\d+))?(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*x?\s*/i);
    if (!m || !m[0].trim()) return null;
    let n = 0, any = false;
    if (m[1] && m[5]) { n = parseFloat(m[1]) / parseFloat(m[5]); any = true; }            // 1/2
    else if (m[1]) { n = parseFloat(m[1].replace(",", ".")); any = true; }
    if (m[2]) { n += FRACTIONS[m[2]]; any = true; }
    if (m[3] && m[4]) { n += parseFloat(m[3]) / parseFloat(m[4]); any = true; }           // 1 1/2
    if (m[6]) { n = Math.max(n, parseFloat(m[6].replace(",", "."))); any = true; }        // 1-2
    return any ? { qty: n, rest: s.slice(m[0].length) } : null;
  }

  const singular = (w) => {
    if (/(ss|us|is)$/i.test(w)) return w;
    if (/(tomato|potato)es$/i.test(w)) return w.slice(0, -2);
    if (/ies$/i.test(w) && w.length > 4) return w.slice(0, -3) + "y";
    if (/(ch|sh|x)es$/i.test(w)) return w.slice(0, -2);
    if (/s$/i.test(w) && w.length > 3) return w.slice(0, -1);
    return w;
  };
  // Words that don't take an s: "2 Celery", "3 Garlic"
  const UNCOUNTABLE = /(celery|garlic|ginger|parsley|coriander|basil|thyme|rosemary|sage|mint|dill|chives|rice|pasta|spinach|lettuce|broccoli|cauliflower|cabbage|kale|bread|cheese|butter|milk|cream|yogurt|yoghurt|flour|sugar|beef|pork|lamb|chicken|fish|salmon|cod|haddock|tuna|tofu|paneer|feta|halloumi|mozzarella|cheddar|parmesan|stock|sauce|oil|vinegar|water|corn|couscous|quinoa|oregano|cumin|paprika|turmeric|cinnamon|nutmeg|honey|mustard|ketchup|mayonnaise|mince|bacon|ham)$/i;
  const plural = (w) => {
    if (UNCOUNTABLE.test(w)) return w;
    if (/s$/i.test(w)) return w;
    if (/(tomato|potato)$/i.test(w)) return w + "es";
    if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + "ies";
    if (/(ch|sh|x)$/i.test(w)) return w + "es";
    return w + "s";
  };

  // One ingredient line -> { key, name, qty, unit, note, basic }
  function parseLine(raw) {
    let s = String(raw || "").replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
    if (!s) return null;
    let note = "";
    // "(melted)", "x, finely chopped" -> drop the preparation part
    s = s.replace(/\(([^)]*)\)/g, " ").replace(/\s+/g, " ").trim();
    // "2-1/2 cups" -> "2 1/2 cups"
    s = s.replace(/(\d)\s*-\s*(\d+\/\d+)/, "$1 $2");
    // "Juice of 1 Lemon", "Grated zest and juice of 2 Limes"
    const juice = s.match(/^(?:grated\s+)?(juice|zest)(?:\s+and\s+(?:juice|zest))?\s+of\s+(.*)$/i);
    if (juice) { note = juice[1].toLowerCase(); s = juice[2]; }
    // "to serve Black Olives", "to taste Salt"
    const lead = s.match(/^(to serve|to taste|for serving|to garnish|for frying|optional)\s+(.*)$/i);
    if (lead) { note = lead[1].toLowerCase(); s = lead[2]; }

    let qty = null, unit = null;
    const num = readNumber(s);
    if (num) { qty = num.qty; s = num.rest; }
    // "3 400g cans", "2 x 400g tins": count times the size
    const pack = qty !== null && s.match(/^\s*(?:x\s*)?(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz)\b\s*/i);
    if (pack) { qty = qty * parseFloat(pack[1]); unit = UNIT_BY_WORD[pack[2].toLowerCase()]; s = s.slice(pack[0].length); }
    // "100g", "2tbsp": unit stuck to the number, or the next word
    const um = !unit && s.match(/^\s*([a-zA-Z]+)\.?\b\s*(?:of\s+)?/);
    if (um && UNIT_BY_WORD[um[1].toLowerCase()] && !(um[1].toLowerCase() === "t" && qty === null)) {
      unit = UNIT_BY_WORD[um[1].toLowerCase()];
      s = s.slice(um[0].length);
      if (qty === null) qty = 1; // "pinch Salt" -> 1 pinch
    }
    // "50g/2oz butter": keep the first amount
    s = s.replace(/^\s*\/\s*[\d.]+\s*[a-z]+\b/i, "");
    // "400g can chopped tomatoes": the container word isn't part of the name
    if (unit && ["g", "kg", "ml", "l", "oz"].includes(unit)) s = s.replace(/^\s*(cans?|tins?|jars?|packs?|packets?|bags?)\b\s*/i, "");
    // A second number after the unit word ("1 can 400g chopped tomatoes"): keep the first
    const name = s.split(",")[0].trim();
    const words = name.split(" ").filter(Boolean);
    const kept = words.filter(w => !DESCRIPTORS.has(w.toLowerCase().replace(/[^a-z]/g, "")) && !/\d/.test(w));
    const core = (kept.length ? kept : words).join(" ").replace(/[^\p{L}\p{N}&' -]/gu, "").trim();
    if (!core) return null;
    const keyWords = core.toLowerCase().split(" ");
    keyWords[keyWords.length - 1] = singular(keyWords[keyWords.length - 1]);
    const key = keyWords.join(" ");
    // Shown in the singular; describe() makes it plural for "3 Onions"
    const dWords = core.split(" ");
    dWords[dWords.length - 1] = singular(dWords[dWords.length - 1]);
    const display = dWords.join(" ").charAt(0).toUpperCase() + dWords.join(" ").slice(1);
    const label = core.charAt(0).toUpperCase() + core.slice(1); // as the recipe wrote it
    return { key, name: display, label, qty, unit, note, basic: BASICS.has(key) || BASICS.has(core.toLowerCase()) };
  }

  // ---- Amounts -------------------------------------------------------------
  const round = (n) => Math.round(n * 100) / 100;
  const nice = (n) => {
    const whole = Math.floor(n + 1e-9), frac = round(n - whole);
    const f = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" }[frac];
    if (f) return whole ? `${whole}${f}` : f;
    return String(round(n));
  };
  // amounts: { [dim]: number in base units, each: count of the item }
  function addAmount(amounts, p) {
    if (p.qty === null || p.qty === undefined) { amounts.loose = true; return; }
    if (!p.unit) { amounts.each = round((amounts.each || 0) + p.qty); return; }
    const def = UNITS[p.unit];
    amounts[def.dim] = round((amounts[def.dim] || 0) + p.qty * def.f);
  }
  function amountParts(amounts) {
    const parts = [];
    if (amounts.mass) parts.push(amounts.mass >= 1000 ? `${nice(amounts.mass / 1000)}kg` : `${Math.round(amounts.mass)}g`);
    if (amounts.vol) parts.push(amounts.vol >= 1000 ? `${nice(amounts.vol / 1000)} litres` : `${Math.round(amounts.vol)}ml`);
    if (amounts.spoon) parts.push(amounts.spoon % 3 === 0 ? `${nice(amounts.spoon / 3)} tbsp` : `${nice(amounts.spoon)} tsp`);
    Object.keys(UNITS).forEach(u => {
      const def = UNITS[u];
      if (["mass", "vol", "spoon"].includes(def.dim) || !amounts[def.dim] || u !== Object.keys(UNITS).find(x => UNITS[x].dim === def.dim)) return;
      const n = amounts[def.dim];
      parts.push(`${nice(n)} ${n > 1 ? plural(u) : u}`);
    });
    return parts;
  }
  // Units that just count things: a bare "3 Thyme" next to "3 sprigs Thyme"
  // reads as 6 sprigs
  const COUNT_DIMS = ["sprig", "bunch", "clove", "stick", "slice", "head", "handful", "knob"];
  function describe(g) {
    let amounts = g.amounts;
    const countDims = COUNT_DIMS.filter(d => amounts[d]);
    if (amounts.each && countDims.length === 1) {
      amounts = { ...amounts, [countDims[0]]: round(amounts[countDims[0]] + amounts.each) };
      delete amounts.each;
    }
    const parts = amountParts(amounts);
    const each = amounts.each;
    if (!parts.length && each) return `${nice(each)} ${each > 1 ? plural(g.name) : g.name}`;
    const label = g.label || g.name;
    if (parts.length === 1 && !each) return `${parts[0]} ${label}`;
    if (!parts.length && !each) return label;
    if (each) parts.unshift(String(nice(each)));
    return `${g.name}: ${parts.join(" + ")}`;
  }

  // Grocery details for an item, worked out from its text if it has none
  // (items typed by hand, or added before this)
  function detailsOf(item) {
    if (item.grocery && item.grocery.key) return item.grocery;
    const p = parseLine(item.text);
    if (!p) return null;
    const amounts = {};
    addAmount(amounts, p);
    return { key: p.key, name: p.name, label: p.label, amounts, sources: item.source && item.source !== "Manual" ? [item.source] : [], sourceKeys: [] };
  }

  // ---- Adding a recipe's ingredients ------------------------------------------
  // items: the Groceries list's items (changed in place)
  // returns { added, combined, skipped: [names], already }
  function addLinesToItems(items, lines, { title = "", sourceKey = "", includeBasics = false, idFor = null } = {}) {
    const result = { added: 0, combined: 0, skipped: [], already: 0 };
    const sk = sourceKey || title;
    // This meal is already on the list if an item had it before this add;
    // a recipe listing butter twice still adds both
    // (bought or not: re-adding a meal never puts its ingredients back)
    const hadMeal = new Set(items.filter(it => sk && ((detailsOf(it) || {}).sourceKeys || []).includes(sk)).map(it => (detailsOf(it) || {}).key));
    (lines || []).forEach(line => {
      const p = parseLine(line);
      if (!p) return;
      if (p.basic && !includeBasics) { if (!result.skipped.includes(p.name)) result.skipped.push(p.name); return; }
      if (hadMeal.has(p.key)) { result.already++; return; } // same meal again
      const existing = items.find(it => !it.checked && (detailsOf(it) || {}).key === p.key);
      if (existing) {
        const g = detailsOf(existing);
        addAmount(g.amounts, p);
        if (title && !g.sources.includes(title)) g.sources.push(title);
        if (sk && !(g.sourceKeys = g.sourceKeys || []).includes(sk)) g.sourceKeys.push(sk);
        existing.grocery = g;
        existing.text = describe(g);
        result.combined++;
        return;
      }
      const g = { key: p.key, name: p.name, label: p.label, amounts: {}, sources: title ? [title] : [], sourceKeys: sk ? [sk] : [] };
      addAmount(g.amounts, p);
      items.push({
        // idFor lets a synced change name its new items the same way each time it runs
        id: idFor ? idFor(result.added) : "g-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        text: describe(g),
        checked: false,
        source: title || "Recipe",
        addedAt: new Date().toISOString(),
        grocery: g
      });
      result.added++;
    });
    return result;
  }

  // ---- Taking a meal's ingredients back off ---------------------------------------
  // sourceKey is "Title|YYYY-MM-DD|slot" (how a planned meal's ingredients are
  // added). Items only this meal needed go; on items another meal also needs,
  // just this meal's amount comes off. Bought (ticked) items are left alone.
  // keys: only these ingredients (the ones still ticked in the question).
  // returns { removed: [item ids], reduced: n }
  function removeMealFromItems(items, { sourceKey = "", title = "", lines = [], keys = null } = {}) {
    const res = { removed: [], reduced: 0 };
    if (!sourceKey) return res;
    const only = Array.isArray(keys) ? new Set(keys) : null;
    const mine = {}; // ingredient key -> the amounts this meal added
    (lines || []).forEach(line => {
      const p = parseLine(line);
      if (!p) return;
      mine[p.key] = mine[p.key] || {};
      addAmount(mine[p.key], p);
    });
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const g = it && !it.checked && it.grocery;
      if (!g || !Array.isArray(g.sourceKeys) || !g.sourceKeys.includes(sourceKey)) continue;
      if (only && !only.has(g.key)) continue;
      const others = g.sourceKeys.filter(k => k !== sourceKey);
      // Typed in by hand before the meal added to it: that stays, just without the meal's share
      if (!others.length && !byHand(it)) { res.removed.push(it.id); items.splice(i, 1); continue; }
      const take = mine[g.key] || {};
      Object.keys(take).forEach(dim => {
        if (dim === "loose" || typeof g.amounts[dim] !== "number") return;
        g.amounts[dim] = round(g.amounts[dim] - take[dim]);
        if (g.amounts[dim] <= 0) delete g.amounts[dim];
      });
      if (!Object.keys(g.amounts).length) g.amounts.loose = true;
      g.sourceKeys = others;
      if (title && !others.some(k => k.split("|")[0] === title)) g.sources = (g.sources || []).filter(x => x !== title);
      it.grocery = g;
      it.text = describe(g);
      res.reduced++;
    }
    return res;
  }

  // Put on the list by someone typing it (or a usual), not by a recipe
  const byHand = (it) => !it.source || it.source === "Manual";

  // A planned meal's ingredients still on the list (not yet bought), for the
  // "take these off too?" question. others: the other meals that need it.
  function mealItemsOnList(items, sourceKey) {
    return (items || []).filter(it => it && !it.checked && it.grocery && (it.grocery.sourceKeys || []).includes(sourceKey)).map(it => {
      const others = [...new Set(it.grocery.sourceKeys.filter(k => k !== sourceKey).map(k => k.split("|")[0]))];
      return { id: it.id, key: it.grocery.key, text: displayText(it), others, byHand: byHand(it) };
    });
  }

  // How one recipe line reads on its own ("500g Beef mince"), for the add question
  function lineText(line) {
    const p = parseLine(line);
    if (!p) return null;
    const amounts = {};
    addAmount(amounts, p);
    return { key: p.key, name: p.name, basic: !!p.basic, text: describe({ key: p.key, name: p.name, label: p.label, amounts }) };
  }

  // "For: Cumberland Pie, Lancashire hotpot"
  function sourcesLabel(item) {
    const g = item && item.grocery;
    const s = g && Array.isArray(g.sources) ? g.sources : [];
    return s.length ? `For: ${s.join(", ")}` : "";
  }

  // "Added 12 items for Cumberland Pie · 3 added to what's there · left out salt & pepper"
  function summary(res, title) {
    const bits = [];
    const total = res.added + res.combined;
    if (total === 0 && res.already) return /^\d+ meals$/.test(title || "") ? "These meals are already on the list" : `${title || "That meal"} is already on the list`;
    if (total === 0 && !res.skipped.length) return "Nothing to add";
    if (res.added) bits.push(`Added ${res.added} item${res.added === 1 ? "" : "s"}${title ? ` for ${title}` : ""}`);
    if (res.combined) bits.push(`${res.combined} added to what's already there`);
    if (res.skipped.length) bits.push(`left out ${res.skipped.map(s => s.toLowerCase()).join(", ")}`);
    return bits.join(" · ");
  }

  // Device setting: include salt, pepper, oil and water from recipes
  const BASICS_KEY = "harmonee_grocery_include_basics";
  const includeBasics = () => { try { return localStorage.getItem(BASICS_KEY) === "1"; } catch (e) { return false; } };
  const setIncludeBasics = (on) => { try { localStorage.setItem(BASICS_KEY, on ? "1" : "0"); } catch (e) {} };

  // What to show for an item: worked out fresh from its amounts, so wording
  // improvements reach items already on the list
  function displayText(item) {
    if (item && item.grocery && item.grocery.amounts) { try { return describe(item.grocery); } catch (e) {} }
    return item ? item.text : "";
  }

  window.Grocery = { parseLine, addLinesToItems, removeMealFromItems, mealItemsOnList, lineText, describe, detailsOf, sourcesLabel, summary, displayText, includeBasics, setIncludeBasics };
})();
