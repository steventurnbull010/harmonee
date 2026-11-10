// ============================================================================
// REWARD PHOTOS (js/reward-photos.js)
// Twelve stock photos for the rewards families save up for most (free
// Unsplash photos, 480×320; see images/rewards/CREDITS.md). A goal shows the
// photo it was given in its panel, or one picked from its name and icon
// ("Cinema trip" gets the popcorn), or none if nothing fits: then its icon.
//
// A goal's photo field: a key below, "none" for no photo, or absent (pick
// one from the name).
// ============================================================================
(function () {
  const DIR = "images/rewards/";
  // In order: the first that matches wins, so "Legoland" is a day out (not
  // toys) and "Games night" is a board game (not a console)
  const PHOTOS = [
    { key: "film", label: "Film", emojis: ["🎬"], words: /\b(film|films|cinema|movie|movies|popcorn|netflix|disney\+?)\b/i },
    { key: "dayout", label: "Day out", emojis: ["🎢"], words: /\b(theme park|day out|days out|trip|zoo|legoland|alton towers|thorpe|chessington|fair|funfair|aquarium|adventure|safari)\b/i },
    { key: "boardgame", label: "Games night", emojis: [], words: /\b(board ?games?|games? night|family games?|puzzle|jigsaw|monopoly|card games?)\b/i },
    { key: "games", label: "Video games", emojis: ["🎮", "📱"], words: /\b(games?|gaming|xbox|playstation|ps5|ps4|switch|nintendo|fortnite|minecraft|roblox|screen ?time|ipad|tablet|console|app)\b/i },
    { key: "pizza", label: "Pizza", emojis: ["🍕"], words: /\b(pizza|takeaway|take-away|chippy|fish and chips|burger|mcdonald'?s|nando'?s)\b/i },
    { key: "icecream", label: "Ice cream", emojis: ["🍦"], words: /\b(ice ?cream|gelato|sundae|lolly|milkshake)\b/i },
    { key: "treat", label: "A treat", emojis: [], words: /\b(sweets?|cake|cookies?|biscuits?|chocolate|treats?|bake|baking|doughnuts?|donuts?|pancakes?|hot chocolate)\b/i },
    { key: "toys", label: "Toys", emojis: ["🧸"], words: /\b(lego|toys?|teddy|doll|dolls|figures?|pok[eé]mon|playmobil|squishmallow|barbie)\b/i },
    { key: "swim", label: "Swimming", emojis: ["🏊"], words: /\b(swim|swimming|pool|splash|waterpark|water park)\b/i },
    { key: "books", label: "Books", emojis: ["📚"], words: /\b(books?|comics?|magazines?|library|reading|kindle)\b/i },
    { key: "football", label: "Football", emojis: ["⚽"], words: /\b(football|match|soccer|stadium|rugby|cricket)\b/i },
    { key: "money", label: "Money", emojis: ["💷"], words: /(£|\b(money|pocket money|cash|pounds?|savings|piggy)\b)/i }
  ];
  const byKey = (key) => PHOTOS.find(p => p.key === key) || null;
  const urlOf = (p) => (p ? `${DIR}${p.key}.jpg` : null);

  // The photo that suits a goal's name (and icon), or null
  function guess(title, emoji) {
    const t = String(title || "");
    const hit = PHOTOS.find(p => p.words.test(t)) || (emoji ? PHOTOS.find(p => p.emojis.includes(emoji)) : null);
    return hit ? hit.key : null;
  }
  // What a goal (or the family goal) shows: its chosen photo, else a guess
  function keyFor(goal) {
    if (!goal) return null;
    if (goal.photo === "none") return null;
    if (goal.photo && byKey(goal.photo)) return goal.photo;
    return guess(goal.title, goal.emoji);
  }
  const photoFor = (goal) => urlOf(byKey(keyFor(goal)));

  // A row of photo tiles to choose from, with "No photo" first and "Match the
  // name" (the default) second. chosen: a key, "none" or "" (match the name)
  function pickerHtml(chosen, title, emoji) {
    const auto = guess(title, emoji);
    const autoUrl = urlOf(byKey(auto));
    const tile = (val, label, url, extra = "") => `
      <button type="button" class="rw-photo-pick ${chosen === val ? "is-on" : ""}" data-photo-pick="${val}" aria-pressed="${chosen === val}" aria-label="${escapeHtml(label)}">
        <span class="rw-photo-pick-img" ${url ? `style="background-image: url('${url}')"` : ""}>${url ? "" : extra}</span>
        <span class="rw-photo-pick-label">${escapeHtml(label)}</span>
      </button>`;
    return [
      tile("", "Match the name", autoUrl, "✨"),
      tile("none", "No photo", null, escapeHtml(emoji || "🎁")),
      ...PHOTOS.map(p => tile(p.key, p.label, urlOf(p)))
    ].join("");
  }

  window.RewardPhotos = { PHOTOS, guess, keyFor, photoFor, urlOf: (key) => urlOf(byKey(key)), pickerHtml };
})();
