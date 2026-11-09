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
    // Soft 3D ("Pixar-like"): lit from the top left, glossy eyes, soft shadows
    dragon: () => `
      <defs>
        <radialGradient id="dg-body" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#7cf3e0"/><stop offset="0.45" stop-color="#22c3ad"/><stop offset="1" stop-color="#0b6f63"/></radialGradient>
        <radialGradient id="dg-head" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#8af6e6"/><stop offset="0.5" stop-color="#25c7b1"/><stop offset="1" stop-color="#0c7a6c"/></radialGradient>
        <radialGradient id="dg-belly" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6d5"/><stop offset="0.55" stop-color="#fcd770"/><stop offset="1" stop-color="#e9a51c"/></radialGradient>
        <radialGradient id="dg-snout" cx="40%" cy="25%" r="80%"><stop offset="0" stop-color="#c7fbf2"/><stop offset="1" stop-color="#3fd4bf"/></radialGradient>
        <linearGradient id="dg-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8fbef"/><stop offset="0.5" stop-color="#3cd3be"/><stop offset="1" stop-color="#0e8073"/></linearGradient>
        <linearGradient id="dg-horn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset="0.5" stop-color="#f6b93b"/><stop offset="1" stop-color="#c27a0e"/></linearGradient>
        <radialGradient id="dg-iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#f4b860"/><stop offset="0.55" stop-color="#9a5a12"/><stop offset="1" stop-color="#3b2106"/></radialGradient>
        <radialGradient id="dg-sclera" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe7ee"/></radialGradient>
        <radialGradient id="dg-cheek" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a5c" stop-opacity="0.55"/><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"/></radialGradient>
        <filter id="dg-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="#0f172a" opacity="0.22" filter="url(#dg-soft)"/>
      <g class="bd-tail"><path d="M66 158 C36 162 20 140 30 120 C38 136 52 142 70 140 Z" fill="url(#dg-body)"/><path d="M30 120 l-12 -2 l8 -10 l4 12z" fill="url(#dg-horn)"/></g>
      <g class="bd-wing bd-wing-l"><path d="M72 112 C46 82 22 86 16 108 C30 100 42 108 46 122 C52 110 60 108 70 120 Z" fill="url(#dg-wing)"/><path d="M68 112 C50 94 34 92 22 102" stroke="#0e8073" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/></g>
      <g class="bd-wing bd-wing-r"><path d="M128 112 C154 82 178 86 184 108 C170 100 158 108 154 122 C148 110 140 108 130 120 Z" fill="url(#dg-wing)"/><path d="M132 112 C150 94 166 92 178 102" stroke="#0e8073" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/></g>
      <path d="M100 104 C132 104 142 128 142 150 C142 172 124 182 100 182 C76 182 58 172 58 150 C58 128 68 104 100 104 Z" fill="url(#dg-body)"/>
      <path d="M100 118 C118 118 126 134 126 152 C126 168 114 176 100 176 C86 176 74 168 74 152 C74 134 82 118 100 118 Z" fill="url(#dg-belly)"/>
      <path d="M84 140 q16 6 32 0 M82 152 q18 6 36 0 M86 164 q14 5 28 0" stroke="#d58a0c" stroke-width="2.2" fill="none" opacity="0.45" stroke-linecap="round"/>
      <ellipse cx="62" cy="142" rx="9" ry="12" fill="url(#dg-body)" transform="rotate(25 62 142)"/>
      <ellipse cx="138" cy="142" rx="9" ry="12" fill="url(#dg-body)" transform="rotate(-25 138 142)"/>
      <ellipse cx="80" cy="182" rx="15" ry="9" fill="#0c7a6c"/><ellipse cx="120" cy="182" rx="15" ry="9" fill="#0c7a6c"/>
      <circle cx="72" cy="185" r="3.2" fill="#3fd4bf"/><circle cx="80" cy="187" r="3.2" fill="#3fd4bf"/><circle cx="88" cy="185" r="3.2" fill="#3fd4bf"/>
      <circle cx="112" cy="185" r="3.2" fill="#3fd4bf"/><circle cx="120" cy="187" r="3.2" fill="#3fd4bf"/><circle cx="128" cy="185" r="3.2" fill="#3fd4bf"/>
      <ellipse cx="100" cy="112" rx="34" ry="9" fill="#06463e" opacity="0.35" filter="url(#dg-soft)"/>
      <path d="M70 46 C64 30 66 18 74 12 C76 24 82 34 88 40 Z" fill="url(#dg-horn)"/>
      <path d="M130 46 C136 30 134 18 126 12 C124 24 118 34 112 40 Z" fill="url(#dg-horn)"/>
      <path d="M96 34 l4 -10 l4 10 z M88 36 l3 -7 l4 8 z M108 37 l4 -8 l3 7 z" fill="url(#dg-horn)"/>
      <path d="M100 32 C138 32 148 58 148 78 C148 102 128 116 100 116 C72 116 52 102 52 78 C52 58 62 32 100 32 Z" fill="url(#dg-head)"/>
      <path d="M66 50 C74 40 88 36 100 36" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"/>
      <ellipse cx="100" cy="98" rx="27" ry="15" fill="url(#dg-snout)"/>
      <ellipse cx="91" cy="94" rx="2.4" ry="1.8" fill="#0c5f55"/><ellipse cx="109" cy="94" rx="2.4" ry="1.8" fill="#0c5f55"/>
      <path d="M86 102 Q100 114 114 102 Q100 108 86 102 Z" fill="#1d3b37"/>
      <path d="M95 106 Q100 111 105 106 Q100 108 95 106 Z" fill="#ff8a4c"/>
      <ellipse cx="70" cy="90" rx="9" ry="6" fill="url(#dg-cheek)"/><ellipse cx="130" cy="90" rx="9" ry="6" fill="url(#dg-cheek)"/>
      <g class="bd-blink">
        <ellipse cx="81" cy="72" rx="14" ry="16" fill="url(#dg-sclera)"/><ellipse cx="119" cy="72" rx="14" ry="16" fill="url(#dg-sclera)"/>
        <circle cx="83" cy="73" r="10" fill="url(#dg-iris)"/><circle cx="117" cy="73" r="10" fill="url(#dg-iris)"/>
        <circle cx="83" cy="74" r="5.5" fill="#120b03"/><circle cx="117" cy="74" r="5.5" fill="#120b03"/>
        <circle cx="79" cy="68" r="3.8" fill="#fff"/><circle cx="113" cy="68" r="3.8" fill="#fff"/>
        <circle cx="87" cy="78" r="1.6" fill="#fff" opacity="0.9"/><circle cx="121" cy="78" r="1.6" fill="#fff" opacity="0.9"/>
        <path d="M67 64 Q81 52 95 64" stroke="#0c6e61" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>
        <path d="M105 64 Q119 52 133 64" stroke="#0c6e61" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>
      </g>
      <path d="M70 52 q10 -6 20 -2" stroke="#0a5a50" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M110 50 q10 -4 20 2" stroke="#0a5a50" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <g class="bd-puff"><circle cx="150" cy="70" r="9" fill="none" stroke="#e2e8f0" stroke-width="4" opacity="0.9"/><circle cx="166" cy="56" r="6" fill="none" stroke="#f1f5f9" stroke-width="3" opacity="0.8"/></g>`,

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
