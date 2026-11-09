// ============================================================================
// BUDDIES (js/buddies.js)
// Each person can pick a buddy on their profile. When they tick their last
// job of the day, their buddy hops up from the bottom of the screen, does its
// own celebration and says one of its lines with their name, for 8 seconds
// (long enough to shout someone over to see). Tap to close it sooner.
//
// The buddies are drawn here (original characters, no outside files), and
// animated by css/buddies.css. Colours are chosen to avoid "boy" and "girl"
// coding. Lines were agreed with Steven (9 Nov): keep them exactly as written.
//
// Saved per person in boardSettings.memberBuddies: { "ava": "dragon", ... }
// (keyed by lower-case name, like memberColors). "none" means no buddy.
// ============================================================================
(function () {
  const SHOW_MS = 8000;

  // Every buddy agreed on 9 Nov (drawings in js/buddy-art.js)
  const BUDDIES = [
    { id: "kitten",    name: "Kitten",    lines: ["Purr-fect. Nap time?", "All done. I'm impressed, and I'm hard to impress.", "Every job ticked. I'll allow it."] },
    { id: "puppy",     name: "Puppy",     lines: ["You did it! You did it! Walk?", "Best job ever! Every single one!", "Good human! All done!"] },
    { id: "unicorn",   name: "Unicorn",   lines: ["Magical. Every job done.", "That's sparkle-level work.", "Wishes granted: all jobs done."] },
    { id: "knight",    name: "Knight",    lines: ["Huzzah! Quest complete.", "Well fought, brave one.", "The kingdom thanks you."] },
    { id: "dragon",    name: "Dragon",    lines: ["Roarsome! All done.", "Even dragons rest now. Enjoy yours.", "Treasure earned: every job done."] },
    { id: "fox",       name: "Fox",       lines: ["Clever work. Everything's done.", "Quick as a fox, and twice as tidy.", "Done and dusted. Off you go!"] },
    { id: "owl",       name: "Owl",       lines: ["Hoo-ray. That's every job done.", "Wise move, finishing early.", "Hoo knew? You did it all."] },
    { id: "robot",     name: "Robot",     lines: ["Task list: 100% complete.", "Beep boop. Brilliant.", "All systems: done."] },
    { id: "astronaut", name: "Astronaut", lines: ["Mission complete!", "Out of this world.", "Houston, we have a tidy house."] },
    { id: "octopus",   name: "Octopus",   lines: ["Eight arms, and you still beat me to it!", "High five, times eight!", "Ink-credible work."] },
    { id: "dinosaur",  name: "Dinosaur",  lines: ["Dino-mite!", "Rawr-some work today.", "That's a giant effort!"] },
    { id: "sloth",     name: "Sloth",     lines: ["Wow. All that. I'm tired just watching.", "Done already? Respect.", "Every job done. Time to hang out."] }
  ];

  // ---- The drawings ------------------------------------------------------------------
  // In js/buddy-art.js (loaded first): all twelve, in the soft 3D style
  const DRAW = window.BUDDY_ART || {};

  const svgFor = (id) => (DRAW[id] ? `<svg class="buddy-svg buddy-${id}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${DRAW[id]()}</svg>` : "");
  const available = () => BUDDIES.filter(b => DRAW[b.id]);
  const byId = (id) => BUDDIES.find(b => b.id === id) || null;

  // ---- Who has which buddy -----------------------------------------------------------
  const keyFor = (name) => String(name || "").trim().toLowerCase();
  function getMemberBuddy(name) {
    const map = (window.boardSettings && window.boardSettings.memberBuddies) || {};
    const id = map[keyFor(name)];
    return id && id !== "none" && DRAW[id] ? id : null;
  }
  async function setMemberBuddy(name, id) {
    const map = { ...((window.boardSettings && window.boardSettings.memberBuddies) || {}) };
    map[keyFor(name)] = id || "none";
    if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ memberBuddies: map });
    else if (window.boardSettings) window.boardSettings.memberBuddies = map;
  }

  // ---- The celebration ---------------------------------------------------------------
  let closeTimer = null;
  let afterClose = [];
  function celebrate(name, id = getMemberBuddy(name), opts = {}) {
    const buddy = byId(id);
    if (!buddy || !DRAW[id]) return false;
    close(true);
    const line = buddy.lines[Math.floor(Math.random() * buddy.lines.length)];
    const shown = typeof window.displayMemberName === "function" ? window.displayMemberName(name) : name;
    const el = document.createElement("div");
    el.className = `buddy-stage buddy-move-${id}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
      <div class="buddy-backdrop"></div>
      <div class="buddy-sparkles" aria-hidden="true">${"<i></i>".repeat(10)}</div>
      <div class="buddy-bubble"><strong>${escapeHtml(shown ? `${shown}, you did it!` : "You did it!")}</strong><span>${escapeHtml(line)}</span></div>
      <div class="buddy-figure">${svgFor(id)}</div>
      <p class="buddy-close-hint">Tap to close</p>`;
    el.addEventListener("click", () => close());
    // Inside an open panel (the profile preview), so it isn't under its backdrop
    const panels = [...document.querySelectorAll("dialog[open]")];
    (panels.length ? panels[panels.length - 1] : document.body).appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    if (!opts.quiet && typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    closeTimer = setTimeout(() => close(), SHOW_MS);
    return true;
  }

  function close(instant) {
    clearTimeout(closeTimer);
    closeTimer = null;
    const el = document.querySelector(".buddy-stage");
    if (!el) return;
    const done = () => {
      el.remove();
      const queued = afterClose; afterClose = [];
      queued.forEach(fn => { try { fn(); } catch (e) {} });
    };
    if (instant) { done(); return; }
    el.classList.remove("is-in");
    el.classList.add("is-out");
    setTimeout(done, 350);
  }

  const isShowing = () => !!document.querySelector(".buddy-stage");
  // Something to do once the buddy has gone (the whole-family celebration)
  function whenClosed(fn) { if (isShowing()) afterClose.push(fn); else fn(); }

  // ---- Has this person finished today? ----------------------------------------------
  // Called after a tick. Celebrates once per person per day (ticking, unticking
  // and ticking again doesn't repeat it).
  function checkFinished(names, date = new Date()) {
    const list = (Array.isArray(names) ? names : String(names || "").split(","))
      .map(n => String(n).trim()).filter(n => n && !/^(team effort|up for grabs|anyone|family)$/i.test(n));
    const dayKey = getLocalDateKey(date);
    if (dayKey !== getLocalDateKey(new Date())) return; // only for today
    for (const name of list) {
      if (!getMemberBuddy(name) || typeof getTasksForColumn !== "function") continue;
      const jobs = getTasksForColumn(name, date);
      if (!jobs.length) continue;
      const lower = name.toLowerCase();
      if (!jobs.every(t => isTaskDoneOnDate(t, date, lower))) continue;
      const seenKey = `harmonee_buddy_seen_${dayKey}_${lower}`;
      try { if (localStorage.getItem(seenKey)) continue; localStorage.setItem(seenKey, "1"); } catch (e) {}
      celebrate(name);
      return; // one at a time
    }
  }

  window.Buddies = { BUDDIES, available, byId, svgFor, getMemberBuddy, setMemberBuddy, celebrate, close, isShowing, whenClosed, checkFinished, SHOW_MS };
})();
