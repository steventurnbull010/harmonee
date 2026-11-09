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

  // Every buddy agreed on 9 Nov. `draw` is filled in as each one is drawn;
  // only drawn buddies can be picked.
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
  // 200 x 200, flat and friendly. Parts that move have bd-* classes
  // (css/buddies.css): bd-blink eyes, plus each buddy's own move.
  const DRAW = {
    dragon: () => `
      <g class="bd-tail"><path d="M58 150 C30 150 22 128 34 116 C40 132 52 136 66 134 Z" fill="#0f766e"/><path d="M28 112 l-8 -6 l10 -2 z" fill="#f59e0b"/></g>
      <g class="bd-wing bd-wing-l"><path d="M70 104 C44 84 30 92 26 110 C40 104 50 112 54 122 C60 112 66 110 72 116 Z" fill="#2dd4bf" stroke="#0f766e" stroke-width="3" stroke-linejoin="round"/></g>
      <g class="bd-wing bd-wing-r"><path d="M130 104 C156 84 170 92 174 110 C160 104 150 112 146 122 C140 112 134 110 128 116 Z" fill="#2dd4bf" stroke="#0f766e" stroke-width="3" stroke-linejoin="round"/></g>
      <ellipse cx="100" cy="140" rx="40" ry="36" fill="#14b8a6"/>
      <ellipse cx="100" cy="148" rx="24" ry="24" fill="#fcd34d"/>
      <path d="M86 138 h28 M84 148 h32 M86 158 h28" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="80" cy="174" rx="12" ry="7" fill="#0f766e"/><ellipse cx="120" cy="174" rx="12" ry="7" fill="#0f766e"/>
      <path d="M74 56 l-6 -20 l16 12 z" fill="#f59e0b"/><path d="M126 56 l6 -20 l-16 12 z" fill="#f59e0b"/>
      <circle cx="100" cy="80" r="36" fill="#14b8a6"/>
      <ellipse cx="100" cy="96" rx="24" ry="15" fill="#5eead4"/>
      <circle cx="92" cy="96" r="2.5" fill="#0f766e"/><circle cx="108" cy="96" r="2.5" fill="#0f766e"/>
      <g class="bd-blink"><ellipse cx="86" cy="76" rx="6" ry="8" fill="#134e4a"/><ellipse cx="114" cy="76" rx="6" ry="8" fill="#134e4a"/>
        <circle cx="88" cy="73" r="2.2" fill="#fff"/><circle cx="116" cy="73" r="2.2" fill="#fff"/></g>
      <path d="M92 104 q8 6 16 0" stroke="#0f766e" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g class="bd-puff"><circle cx="146" cy="70" r="9" fill="none" stroke="#cbd5e1" stroke-width="4"/><circle cx="162" cy="56" r="6" fill="none" stroke="#e2e8f0" stroke-width="3"/></g>`,

    robot: () => `
      <g class="bd-antenna"><line x1="100" y1="44" x2="100" y2="24" stroke="#4b5563" stroke-width="4" stroke-linecap="round"/><circle class="bd-antenna-light" cx="100" cy="20" r="8" fill="#a3e635"/></g>
      <rect x="62" y="44" width="76" height="62" rx="18" fill="#4b5563"/>
      <rect x="72" y="54" width="56" height="40" rx="12" fill="#111827"/>
      <g class="bd-blink"><rect x="82" y="64" width="12" height="14" rx="5" fill="#a3e635"/><rect x="106" y="64" width="12" height="14" rx="5" fill="#a3e635"/></g>
      <path d="M90 84 q10 7 20 0" stroke="#a3e635" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="54" y="66" width="8" height="18" rx="4" fill="#9ca3af"/><rect x="138" y="66" width="8" height="18" rx="4" fill="#9ca3af"/>
      <rect x="92" y="106" width="16" height="8" fill="#6b7280"/>
      <rect x="64" y="112" width="72" height="56" rx="16" fill="#374151"/>
      <rect x="80" y="124" width="40" height="20" rx="6" fill="#111827"/>
      <circle cx="90" cy="134" r="4" fill="#a3e635"/><circle cx="100" cy="134" r="4" fill="#facc15"/><circle cx="110" cy="134" r="4" fill="#fb923c"/>
      <g class="bd-arm-l"><rect x="40" y="118" width="26" height="12" rx="6" fill="#6b7280"/><circle cx="40" cy="124" r="9" fill="#9ca3af"/></g>
      <g class="bd-arm-r"><rect x="134" y="118" width="26" height="12" rx="6" fill="#6b7280"/>
        <g class="bd-thumb"><rect x="152" y="112" width="18" height="18" rx="6" fill="#9ca3af"/><rect x="158" y="98" width="8" height="18" rx="4" fill="#9ca3af"/></g></g>
      <rect x="74" y="168" width="18" height="16" rx="4" fill="#4b5563"/><rect x="108" y="168" width="18" height="16" rx="4" fill="#4b5563"/>`,

    fox: () => `
      <g class="bd-tail"><path d="M128 150 C162 150 176 120 166 96 C160 116 146 124 128 128 Z" fill="#ea580c"/><path d="M166 96 C170 108 166 118 158 124 C164 112 164 104 166 96 Z" fill="#fef3c7"/><path d="M160 104 c6 8 4 18 -4 22 c4 -8 6 -14 4 -22z" fill="#fef3c7"/></g>
      <ellipse cx="100" cy="146" rx="34" ry="32" fill="#ea580c"/>
      <ellipse cx="100" cy="152" rx="20" ry="22" fill="#fef3c7"/>
      <ellipse cx="82" cy="176" rx="11" ry="7" fill="#7c2d12"/><ellipse cx="118" cy="176" rx="11" ry="7" fill="#7c2d12"/>
      <path d="M62 66 L70 28 L92 54 Z" fill="#ea580c"/><path d="M68 56 L72 38 L84 52 Z" fill="#7c2d12"/>
      <path d="M138 66 L130 28 L108 54 Z" fill="#ea580c"/><path d="M132 56 L128 38 L116 52 Z" fill="#7c2d12"/>
      <path d="M58 76 C58 50 142 50 142 76 C142 100 118 116 100 118 C82 116 58 100 58 76 Z" fill="#ea580c"/>
      <path d="M60 82 C70 100 86 112 100 118 C88 104 84 92 78 86 Z" fill="#fef3c7"/><path d="M140 82 C130 100 114 112 100 118 C112 104 116 92 122 86 Z" fill="#fef3c7"/>
      <g class="bd-blink"><ellipse cx="84" cy="80" rx="5.5" ry="7" fill="#1c1917"/><circle cx="86" cy="77" r="2" fill="#fff"/></g>
      <g class="bd-wink-eye"><ellipse class="bd-eye-open" cx="116" cy="80" rx="5.5" ry="7" fill="#1c1917"/><circle class="bd-eye-open" cx="118" cy="77" r="2" fill="#fff"/>
        <path class="bd-eye-shut" d="M110 81 q6 5 12 0" stroke="#1c1917" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <ellipse cx="100" cy="104" rx="6" ry="4.5" fill="#1c1917"/>
      <path d="M94 110 q6 5 12 0" stroke="#7c2d12" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
  };

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
