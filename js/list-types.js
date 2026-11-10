// ============================================================================
// KINDS OF LIST (js/list-types.js)
// Every list is one of four kinds, each with its own cover photo and tools:
//   shopping  the food shop: aisles, usuals, Shop mode, meal ingredients
//   packing   holidays and days out: a section per person plus Family,
//             "Start again" to untick it all for the next trip
//   wish      Christmas and birthdays: whose list it is, links and prices
//   todo      anything else, plain and simple
//
// A list remembers its kind (list.type, set when it's made or edited). Older
// lists don't have one, so it's worked out from the name: "Family Groceries"
// is shopping, "Holiday & Travel Packing" is packing, "Ava Christmas List" is
// Ava's wish list. Nothing is saved for that: it's worked out each time.
// ============================================================================
(function () {
  const TYPES = {
    shopping: { key: "shopping", label: "Shopping", emoji: "🛒", color: "sky", cover: "images/lists/shopping.jpg", thumb: "images/lists/shopping-thumb.jpg", blurb: "Sorted into aisles, with your usuals" },
    packing: { key: "packing", label: "Packing", emoji: "🧳", color: "teal", cover: "images/lists/packing.jpg", thumb: "images/lists/packing-thumb.jpg", blurb: "Holidays and days out, a bit for each of you" },
    wish: { key: "wish", label: "Wish list", emoji: "🎁", color: "rose", cover: "images/lists/wish.jpg", thumb: "images/lists/wish-thumb.jpg", blurb: "Christmas and birthdays, with links and prices" },
    todo: { key: "todo", label: "To-do", emoji: "✅", color: "amber", cover: "images/lists/todo.jpg", thumb: "images/lists/todo-thumb.jpg", blurb: "Anything else" }
  };
  const ORDER = ["shopping", "packing", "wish", "todo"];

  const people = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);

  // Words that say what a list is for (whole words only)
  const has = (title, re) => re.test(String(title || "").toLowerCase());
  function guess(list) {
    if (!list) return "todo";
    if (list.id === "groceries" || list.emoji === "🛒" || has(list.title, /\b(grocer(y|ies)|shopping|food shop|supermarket)\b/)) return "shopping";
    if (list.emoji === "🧳" || has(list.title, /\b(pack|packing|holiday|holidays|travel|trip|camping|suitcase|weekend away)\b/)) return "packing";
    if (list.emoji === "🎁" || has(list.title, /\b(wish|wishlist|christmas|xmas|birthday|presents?|santa)\b/)) return "wish";
    return "todo";
  }
  function typeOf(list) {
    return list && TYPES[list.type] ? list.type : guess(list);
  }

  // Whose wish list: list.owner, or a family name in the title ("Ava Christmas
  // List" is Ava's, "Steve Xmas" is Steven's)
  function ownerOf(list) {
    if (!list) return "";
    const names = people();
    if (list.owner && names.includes(list.owner)) return list.owner;
    if (list.owner) return list.owner;
    const words = String(list.title || "").toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).map(w => w.replace(/'s$/, "")).filter(Boolean);
    for (const name of names) {
      const n = name.toLowerCase();
      if (words.some(w => w === n || (w.length >= 4 && n.startsWith(w)) || (n.length >= 4 && w.startsWith(n)))) return name;
    }
    return "";
  }

  // A list's cover photo and its kind's details
  const info = (list) => TYPES[typeOf(list)];
  // The cover as a full address: a relative path inside a CSS variable is
  // read from the stylesheet's folder (css/images/... = not found)
  const coverUrl = (list) => { try { return new URL(info(list).cover, document.baseURI).href; } catch (e) { return info(list).cover; } };

  // Packing: who an item is for ("Family" when it's for everyone)
  const FAMILY = "Family";
  const whoOf = (item) => (item && item.who) || FAMILY;

  // A new packing list starts with these (suggestions: tick, delete or add)
  function packingStarter() {
    const family = ["Passports", "Tickets and bookings", "Phone chargers", "Plug adapters", "Suncream", "First aid kit", "Snacks for the journey"];
    const each = ["Clothes for each day", "Pyjamas", "Toothbrush", "Swimwear", "Shoes", "Coat"];
    const out = family.map(text => ({ text, who: FAMILY }));
    people().forEach(name => each.forEach(text => out.push({ text, who: name })));
    return out;
  }

  // Wish list items: a link and a price, if the text has them
  // ("Burgundy Vans £60 https://..." -> name "Burgundy Vans", price "£60")
  function wishParts(text) {
    let rest = String(text || "");
    const linkMatch = rest.match(/https?:\/\/[^\s]+/i);
    const link = linkMatch ? linkMatch[0].replace(/[).,]+$/, "") : "";
    if (linkMatch) rest = rest.replace(linkMatch[0], " ");
    const priceMatch = rest.match(/(?:£|\$|€)\s?\d+(?:[.,]\d{1,2})?/);
    const price = priceMatch ? priceMatch[0].replace(/\s/g, "") : "";
    if (priceMatch) rest = rest.replace(priceMatch[0], " ");
    const name = rest.replace(/\s+/g, " ").replace(/\s*[-–,·]\s*$/, "").trim() || (link ? "A link" : String(text || ""));
    let site = "";
    try { site = link ? new URL(link).hostname.replace(/^www\./, "") : ""; } catch (e) {}
    return { name, price, link, site };
  }

  window.ListTypes = { TYPES, ORDER, typeOf, guess, ownerOf, info, coverUrl, whoOf, FAMILY, people, packingStarter, wishParts };
})();
