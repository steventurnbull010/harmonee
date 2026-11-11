// ============================================================================
// REWARD PHOTOS AND THE GOAL PANEL'S PIECES (js/reward-photos.js) · 11 Nov
//
// A goal's photo is one of:
//   - picked for you from its name ("Cinema trip" → the popcorn), the default
//   - one of the stock photos (free Unsplash photos, 480×320; see
//     images/rewards/CREDITS.md)
//   - your own photo, taken or chosen on the device, shrunk and kept on the
//     board like a dish photo (js/recipe-photos.js, id "goal-<goal id>")
//   - no photo: a coloured card with a 🎁
// Stored on the goal as photo: "" (picked for you) | a stock key | "own" (with
// photoRev) | "none".
//
// Also here, used by both goal panels (a person's goal and the family goal):
//   chooser  - one big preview, "Change photo" opens a row of choices
//   slider   - points needed: drag a big slider (a tick per step, a
//              ka-ching when you let go), with shortcuts underneath
// ============================================================================
(function () {
  const DIR = "images/rewards/";
  // In order: the first that matches wins ("Legoland" is a day out, not toys;
  // "Games night" is a board game, not a console; "date night" is a night out)
  const PHOTOS = [
    { key: "film", label: "Film", emoji: "🎬", emojis: ["🎬"], words: /\b(film|films|cinema|movie|movies|popcorn|netflix|disney\+?)\b/i },
    { key: "nightout", label: "Night out", emoji: "🍸", emojis: ["🍸", "🍷"], words: /\b(night out|date night|drinks|cocktails?|pub|evening out|gig|concert|theatre|show)\b/i },
    { key: "mealout", label: "Meal out", emoji: "🍽️", emojis: ["🍽️"], words: /\b(meal out|restaurant|dinner out|eat out|eating out|brunch|lunch out|afternoon tea)\b/i },
    { key: "dayout", label: "Day out", emoji: "🎢", emojis: ["🎢"], words: /\b(theme park|day out|days out|trip|zoo|legoland|alton towers|thorpe|chessington|fair|funfair|aquarium|adventure|safari)\b/i },
    { key: "beach", label: "Beach day", emoji: "🏖️", emojis: ["🏖️"], words: /\b(beach|seaside|holiday|sea)\b/i },
    { key: "boardgame", label: "Games night", emoji: "🎲", emojis: ["🎲"], words: /\b(board ?games?|games? night|family games?|puzzle|jigsaw|monopoly|card games?)\b/i },
    { key: "games", label: "Video games", emoji: "🎮", emojis: ["🎮", "📱"], words: /\b(games?|gaming|xbox|playstation|ps5|ps4|switch|nintendo|fortnite|minecraft|roblox|screen ?time|ipad|tablet|console|app)\b/i },
    { key: "sleepover", label: "Sleepover", emoji: "⛺", emojis: ["⛺", "🌙"], words: /\b(sleepover|sleep over|stay over|stayover|den|camp out|late night|stay up)\b/i },
    { key: "pizza", label: "Pizza", emoji: "🍕", emojis: ["🍕"], words: /\b(pizza|takeaway|take-away|chippy|fish and chips|burger|mcdonald'?s|nando'?s)\b/i },
    { key: "icecream", label: "Ice cream", emoji: "🍦", emojis: ["🍦"], words: /\b(ice ?cream|gelato|sundae|lolly|milkshake)\b/i },
    { key: "treat", label: "A treat", emoji: "🍪", emojis: [], words: /\b(sweets?|cake|cookies?|biscuits?|chocolate|treats?|bake|baking|doughnuts?|donuts?|pancakes?|hot chocolate)\b/i },
    { key: "shopping", label: "Shopping", emoji: "🛍️", emojis: ["🛍️"], words: /\b(shopping|shop|clothes|outfit|trainers|shoes|new bag|make-?up)\b/i },
    { key: "toys", label: "Toys", emoji: "🧸", emojis: ["🧸"], words: /\b(lego|toys?|teddy|doll|dolls|figures?|pok[eé]mon|playmobil|squishmallow|barbie)\b/i },
    { key: "pamper", label: "Pamper day", emoji: "🛁", emojis: ["🛁"], words: /\b(pamper|spa|nails|manicure|massage|bath|facial)\b/i },
    { key: "swim", label: "Swimming", emoji: "🏊", emojis: ["🏊"], words: /\b(swim|swimming|pool|splash|waterpark|water park)\b/i },
    { key: "bike", label: "Bike ride", emoji: "🚲", emojis: ["🚲"], words: /\b(bike|bicycle|cycling|cycle|scooter)\b/i },
    { key: "books", label: "Books", emoji: "📚", emojis: ["📚"], words: /\b(books?|comics?|magazines?|library|reading|kindle)\b/i },
    { key: "football", label: "Football", emoji: "⚽", emojis: ["⚽"], words: /\b(football|match|soccer|stadium|rugby|cricket)\b/i },
    { key: "money", label: "Money", emoji: "💷", emojis: ["💷"], words: /(£|\b(money|pocket money|cash|pounds?|savings|piggy)\b)/i }
  ];
  const byKey = (key) => PHOTOS.find(p => p.key === key) || null;
  const urlOf = (p) => (p ? `${DIR}${p.key}.jpg` : null);
  const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));

  // The stock photo that suits a name (and an old goal's icon), or null
  function guess(title, emoji) {
    const t = String(title || "");
    const hit = PHOTOS.find(p => p.words.test(t)) || (emoji ? PHOTOS.find(p => p.emojis.includes(emoji)) : null);
    return hit ? hit.key : null;
  }
  // Your own photo of a goal, if this device has it (fetches it otherwise)
  const ownId = (goalId) => `goal-${goalId}`;
  function ownUrl(goal) {
    if (!goal || goal.photo !== "own" || !goal.photoRev || !window.RecipePhotos) return "";
    return window.RecipePhotos.url({ id: ownId(goal.id), photo: { rev: goal.photoRev } }) || "";
  }
  // What a goal (or the family goal) shows: a URL, or null for no photo
  function photoFor(goal) {
    if (!goal || goal.photo === "none") return null;
    if (goal.photo === "own") return ownUrl(goal) || urlOf(byKey(guess(goal.title, goal.emoji)));
    if (goal.photo && byKey(goal.photo)) return urlOf(byKey(goal.photo));
    return urlOf(byKey(guess(goal.title, goal.emoji)));
  }
  const keyFor = (goal) => (!goal || goal.photo === "none" ? null : goal.photo === "own" ? "own" : (goal.photo && byKey(goal.photo) ? goal.photo : guess(goal.title, goal.emoji)));
  // An emoji for the goal (shown in the "redeemed" history), from its photo
  function emojiFor(goal, fallback = "🎁") {
    const k = keyFor(goal);
    return (k && byKey(k) && byKey(k).emoji) || fallback;
  }

  // ---- The photo chooser ---------------------------------------------------------------------
  // state: { choice: "" | key | "own" | "none", title, own: dataURL|"" (picked now or existing), open: bool }
  function chooserHtml(state) {
    const auto = guess(state.title);
    let url = null, caption = "";
    if (state.choice === "none") url = null;
    else if (state.choice === "own") url = state.own || null;
    else if (state.choice && byKey(state.choice)) url = urlOf(byKey(state.choice));
    else if (auto) { url = urlOf(byKey(auto)); caption = `Picked for “${esc(state.title)}”`; }
    const name = (state.title || "").trim() || "Your reward";
    const preview = url
      ? `<span class="rw-pc-preview" style="background-image: url('${url}')">${caption ? `<span class="rw-pc-tag">✨ ${caption}</span>` : ""}</span>`
      : `<span class="rw-pc-preview is-none"><span class="rw-pc-gift" aria-hidden="true">🎁</span><span class="rw-pc-none-name">${esc(name)}</span></span>`;
    const tile = (val, label, inner, extraClass = "") => `
      <button type="button" class="rw-pc-tile ${extraClass} ${state.choice === val ? "is-on" : ""}" data-pc-pick="${val}" aria-pressed="${state.choice === val}">
        <span class="rw-pc-tile-img">${inner}</span><span class="rw-pc-tile-label">${esc(label)}</span>
      </button>`;
    return `
      <div class="rw-pc">
        ${preview}
        <div class="rw-pc-actions">
          <button type="button" class="rw-pc-change" data-pc-toggle aria-expanded="${!!state.open}">${state.open ? "Done" : "📷 Change photo"}</button>
        </div>
        <div class="rw-pc-row" ${state.open ? "" : "hidden"}>
          ${tile("own", "Your own photo", `<span class="rw-pc-own-icon">📷</span>`, "is-own")}
          ${tile("none", "No photo", `<span class="rw-pc-own-icon">🎁</span>`, "is-none")}
          ${auto ? tile("", "Picked for you", `<img src="${urlOf(byKey(auto))}" alt="" loading="lazy">`) : ""}
          ${PHOTOS.map(p => tile(p.key, p.label, `<img src="${urlOf(p)}" alt="" loading="lazy">`)).join("")}
        </div>
      </div>`;
  }
  // Wires a chooser in `box`; get() returns the state, set() changes it; repaint is called after a change
  function wireChooser(box, get, set) {
    if (!box || box.hasAttribute("data-pc-wired")) return;
    box.setAttribute("data-pc-wired", "true");
    box.addEventListener("click", async (e) => {
      if (e.target.closest("[data-pc-toggle]")) { set({ open: !get().open }); return; }
      const t = e.target.closest("[data-pc-pick]");
      if (!t) return;
      const val = t.getAttribute("data-pc-pick");
      if (val === "own") {
        const data = await pickOwn(box);
        if (data) set({ choice: "own", own: data, ownNew: true, open: false });
        return;
      }
      set({ choice: val, open: false });
    });
  }
  // Take or choose a photo, shrunk to fit (like a dish photo)
  function pickOwn(box) {
    return new Promise((resolve) => {
      if (!window.RecipePhotos) { resolve(null); return; }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.hidden = true;
      input.addEventListener("click", (e) => e.stopPropagation());
      (box.closest("dialog") || document.body).appendChild(input);
      const done = (v) => { setTimeout(() => input.remove(), 0); resolve(v); };
      input.addEventListener("cancel", () => done(null));
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) { done(null); return; }
        try { done(await window.RecipePhotos.shrink(file)); }
        catch (err) { if (typeof window.showCalendarToast === "function") window.showCalendarToast(err.message || "Couldn't use that photo."); done(null); }
      });
      input.click();
    });
  }
  // Saves a chosen own photo for a goal; returns the goal's photo fields
  async function savePhoto(goalId, state, previous = {}) {
    if (state.choice === "own") {
      if (state.ownNew && state.own && window.RecipePhotos) {
        const rev = await window.RecipePhotos.save(ownId(goalId), state.own);
        return { photo: "own", photoRev: rev };
      }
      return { photo: "own", photoRev: previous.photoRev || null };
    }
    if (previous.photo === "own" && window.RecipePhotos) window.RecipePhotos.remove(ownId(goalId));
    return { photo: state.choice || "", photoRev: null };
  }
  const stateFor = (goal) => ({ choice: goal ? (goal.photo === "own" ? "own" : (goal.photo || "")) : "", title: goal ? goal.title : "", own: goal ? ownUrl(goal) : "", ownNew: false, open: false });

  // ---- The points slider ----------------------------------------------------------------------
  // A big number, a slider you drag (a tick at each step, rising with the
  // number; a ka-ching when you let go) and shortcuts underneath
  function sliderHtml(o) {
    const fmt = (v) => (o.money ? `${o.currency}${Number(v).toFixed(v % 1 ? 2 : 0)}` : `${v} pts`);
    return `
      <div class="rw-points">
        <output class="rw-points-value" data-pts-value>${fmt(o.value)}</output>
        <input type="range" class="rw-points-slider" data-pts-slider min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}" aria-label="${esc(o.label)}">
        <div class="rw-points-ends" aria-hidden="true"><span>${fmt(o.min)}</span><span>${fmt(o.max)}</span></div>
        <div class="rw-points-presets">${o.presets.map(p => `<button type="button" class="rw-points-preset" data-pts-preset="${p}">${fmt(p)}</button>`).join("")}</div>
      </div>`;
  }
  // input: the (hidden) number field the panel saves from
  function wireSlider(box, input, o) {
    if (!box) return;
    const slider = box.querySelector("[data-pts-slider]");
    const out = box.querySelector("[data-pts-value]");
    const fmt = (v) => (o.money ? `${o.currency}${Number(v).toFixed(v % 1 ? 2 : 0)}` : `${v} pts`);
    const paint = (v) => {
      out.textContent = fmt(v);
      const pct = ((v - o.min) / (o.max - o.min)) * 100;
      slider.style.setProperty("--pct", `${Math.max(0, Math.min(100, pct))}%`);
      box.querySelectorAll("[data-pts-preset]").forEach(b => b.classList.toggle("is-on", Number(b.getAttribute("data-pts-preset")) === Number(v)));
    };
    let last = Number(slider.value);
    slider.addEventListener("input", () => {
      const v = Number(slider.value);
      input.value = String(v);
      paint(v);
      if (v !== last && window.sfx && typeof window.sfx.playTick === "function") window.sfx.playTick((v - o.min) / (o.max - o.min));
      last = v;
    });
    // Let go: ka-ching
    slider.addEventListener("change", () => { if (window.sfx && typeof window.sfx.playCoinChime === "function") window.sfx.playCoinChime(); });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pts-preset]");
      if (!b) return;
      const v = Number(b.getAttribute("data-pts-preset"));
      slider.value = String(v);
      input.value = String(v);
      last = v;
      paint(v);
      if (window.sfx && typeof window.sfx.playCoinChime === "function") window.sfx.playCoinChime();
    });
    paint(Number(slider.value));
  }
  // The range and shortcuts for a goal (a person's, or the family's: bigger)
  function sliderOptions(kind, value) {
    const s = window.boardSettings || {};
    const money = s.gameMode === "money";
    const currency = s.currency || "£";
    let o = kind === "family"
      ? (money ? { min: 1, max: 100, step: 1, presets: [10, 20, 30, 50] } : { min: 10, max: 500, step: 10, presets: [100, 150, 200, 300] })
      : (money ? { min: 0.5, max: 50, step: 0.5, presets: [2, 5, 10, 20] } : { min: 5, max: 300, step: 5, presets: [20, 50, 100, 200] });
    o = { ...o, money, currency, label: money ? `Cost (${currency})` : "Points needed" };
    const v = Number(value) || o.presets[1];
    if (v > o.max) o.max = Math.ceil(v / o.step) * o.step;
    return { ...o, value: Math.max(o.min, v) };
  }

  window.RewardPhotos = { PHOTOS, guess, keyFor, photoFor, emojiFor, urlOf: (key) => urlOf(byKey(key)), ownUrl, chooserHtml, wireChooser, savePhoto, stateFor, sliderHtml, wireSlider, sliderOptions };
})();
