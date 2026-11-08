// ============================================================================
// FIRST-TIME CELEBRATIONS (js/firsts.js)
// A new family's first event, first chore, first chore done, first meal
// planned and first thing on a list each get a burst of confetti, a happy
// jingle and a friendly card. Once per family (saved on the board as
// settings.firsts, so the other devices don't repeat it).
//
// Only boards made after this shipped take part: a new board starts with
// settings.firsts = {} (app.js createBoardWithAccess). Older boards have no
// "firsts" at all, so families already using harmonee never get surprised.
//
// Call window.celebrateFirst("event" | "chore" | "tick" | "meal" | "list").
// ============================================================================
(function () {
  const FIRSTS = {
    event: { emoji: "📅", title: "Your first event!", text: "It's on the calendar, and on Today for the whole family." },
    chore: { emoji: "✨", title: "Your first chore!", text: "It's on the Tasks board. Tick it off when it's done." },
    tick:  { emoji: "🏆", title: "First chore done!", text: "Points go on the scoreboard in Rewards. Nice work!" },
    meal:  { emoji: "🍽️", title: "First meal planned!", text: "That's one less “what's for dinner?” to answer." },
    list:  { emoji: "📝", title: "First thing on a list!", text: "Everyone sees it straight away, and anyone can tick it off." }
  };
  const shownThisVisit = new Set();

  function celebrateFirst(kind) {
    const cfg = FIRSTS[kind];
    const settings = window.boardSettings;
    if (!cfg || !settings) return;
    const firsts = settings.firsts;
    if (!firsts || typeof firsts !== "object") return; // an older board: not taking part
    if (firsts[kind] || shownThisVisit.has(kind)) return;
    shownThisVisit.add(kind);
    // Saved first, so a second device (or a quick double add) doesn't repeat it
    if (typeof window.saveBoardSettingsNow === "function") {
      window.saveBoardSettingsNow({ firsts: { ...firsts, [kind]: new Date().toISOString() } });
    }
    // A moment after the panel closes, so the card isn't hidden behind it
    setTimeout(() => show(cfg, kind), 450);
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function show(cfg, kind) {
    let card = document.getElementById("first-cheer");
    if (!card) {
      card = document.createElement("div");
      card.id = "first-cheer";
      card.className = "first-cheer";
      card.setAttribute("role", "status");
      card.setAttribute("aria-live", "polite");
      card.addEventListener("click", (e) => {
        const next = e.target.closest("[data-cheer-next]");
        hide();
        if (next && window.GettingStarted) window.GettingStarted.go(next.getAttribute("data-cheer-next"));
      });
      document.body.appendChild(card);
    }
    // Getting started still going: offer the next thing (never pushed)
    const next = kind && window.GettingStarted ? window.GettingStarted.nextAfter(kind) : null;
    card.innerHTML = `
      <span class="first-cheer-emoji" aria-hidden="true">${cfg.emoji}</span>
      <span class="first-cheer-words">
        <strong class="first-cheer-title">${escapeHtml(cfg.title)}</strong>
        <span class="first-cheer-text">${escapeHtml(cfg.text)}</span>
        ${next ? `<button type="button" class="first-cheer-next" data-cheer-next="${next.key}">Next up: ${escapeHtml(next.label)} →</button>` : ""}
      </span>`;
    card.classList.remove("is-showing");
    void card.offsetWidth; // restart the pop-in
    card.classList.toggle("has-next", !!next);
    card.classList.add("is-showing");
    clearTimeout(card._timer);
    card._timer = setTimeout(hide, next ? 8000 : 5000);

    playFanfare();
    if (!reduceMotion() && typeof window.triggerConfettiBurst === "function") window.triggerConfettiBurst();
  }

  function hide() {
    const card = document.getElementById("first-cheer");
    if (card) card.classList.remove("is-showing");
  }

  // A short rising "ta-da": the usual chime, then a bright two-note sparkle
  function playFanfare() {
    const fx = window.sfx;
    if (!fx) return;
    try {
      if (fx.playCelebrationChime) fx.playCelebrationChime();
      fx.init && fx.init();
      const ctx = fx.ctx;
      if (!ctx) return;
      const start = ctx.currentTime + 0.42;
      [[1318.51, 0], [1567.98, 0.12], [2093.0, 0.24]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start + at);
        gain.gain.setValueAtTime(0, start + at);
        gain.gain.linearRampToValueAtTime(0.18, start + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + at + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start + at);
        osc.stop(start + at + 0.65);
      });
    } catch (e) {}
  }

  window.celebrateFirst = celebrateFirst;
  window.FirstCheers = { FIRSTS, show: (kind) => FIRSTS[kind] && show(FIRSTS[kind]) }; // preview / testing
})();
