// ============================================================================
// GUIDED SETUP FOR NEW FAMILIES (js/setup-wizard.js)
// Opens at /?new=true (and from "Create a Brand New Board" in the share
// window). Six short steps:
//   1. Family name ("The Bakers")          -> shown at the top of every page
//   2. Who's in the family                 -> names and colours
//   3. Pick a buddy (optional, each person) -> js/buddies.js
//   4. Points or pocket money (+ currency)
//   5. Starter routines (tap who does each) and jobs up for grabs
//   6. All set                             -> creates the board
// It saves everything where a new board reads it, then goes to the board,
// which is created (with its family code) on arrival by ensureBoardAccess in
// app.js. The first visit then shows a welcome card with the family code
// and join link, so phones can be added straight away.
// ============================================================================
(function () {
  const COLOUR_ORDER = ["warm-ochre", "periwinkle", "coral-pink", "spring-green", "sky-blue", "tangerine", "deep-teal", "lavender", "petal-pink", "emerald", "cornflower", "lemon-yellow"];
  const MAX_PEOPLE = 12;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const palette = () => (Array.isArray(window.SKYLIGHT_PROFILE_COLORS) ? window.SKYLIGHT_PROFILE_COLORS : []);
  const colourOf = (id) => (palette().find(c => c.id === id) || { solid: "#64748b" }).solid;

  // Starter routines (each child ticks their own) and jobs anyone can grab.
  // value: 1-10 (points, or tens of pence in pocket-money mode)
  const ROUTINES = [
    { key: "bed",       icon: "🛏️", title: "Make your bed",          slot: "morning",   on: true },
    { key: "teeth-am",  icon: "🪥", title: "Brush teeth",            slot: "morning",   on: true },
    { key: "dressed",   icon: "👕", title: "Get dressed",            slot: "morning",   on: false },
    { key: "homework",  icon: "📚", title: "Homework",               slot: "afternoon", on: false },
    { key: "bag",       icon: "🎒", title: "Pack your school bag",   slot: "evening",   on: false },
    { key: "tidy",      icon: "🧸", title: "Tidy your bedroom",      slot: "evening",   on: true },
    { key: "bath",      icon: "🛁", title: "Bath or shower",         slot: "evening",   on: false },
    { key: "teeth-pm",  icon: "🪥", title: "Brush teeth before bed", slot: "evening",   on: true },
    { key: "read",      icon: "📖", title: "Reading time",           slot: "evening",   on: false }
  ];
  const JOBS = [
    { key: "dishwasher", icon: "🍽️", title: "Empty the dishwasher", on: true },
    { key: "table",      icon: "🍴", title: "Lay the table",         on: true },
    { key: "pets",       icon: "🐾", title: "Feed the pets",         on: false },
    { key: "kitchen",    icon: "🧽", title: "Wipe the kitchen sides", on: false },
    { key: "hoover",     icon: "🧹", title: "Hoover the lounge",     day: "Saturday", on: false },
    { key: "sheets",     icon: "🛏️", title: "Change the bedsheets",  day: "Sunday",   on: false }
  ];
  const SLOT_LABEL = { morning: "☀️ Morning", afternoon: "⛅ Afternoon", evening: "🌙 Evening" };

  let state = null;
  const STEPS = 6;

  function freshState() {
    const params = new URLSearchParams(window.location.search);
    return {
      // Arrived at the plain address (no board, none before): say hello first.
      // A "?new=true" link goes straight to step 1.
      step: params.get("new") === "true" ? 1 : 0,
      familyName: (params.get("family") || "").slice(0, 40),
      people: [],          // { name, colour, buddy }
      openColour: null,    // index of the person whose colour row is open
      mode: "points",
      currency: "£",
      picked: new Set([...ROUTINES, ...JOBS].filter(x => x.on).map(x => x.key)),
      weather: null,       // { lat, lon, name, label } from the place picker (js/weather.js)
      error: ""
    };
  }

  const nextColour = () => COLOUR_ORDER.find(id => !state.people.some(p => p.colour === id)) || COLOUR_ORDER[state.people.length % COLOUR_ORDER.length];
  // Who does each starter routine: { routineKey: Set of names }. Made the
  // first time step 5 opens: the routines that start on go to anyone after
  // the first two people (or everyone, in a family of one or two).
  function routineWho() {
    const s = state;
    const names = everyone();
    if (!s.who) {
      const guess = names.length > 2 ? names.slice(2) : names;
      s.who = {};
      ROUTINES.forEach(r => { s.who[r.key] = new Set(r.on ? guess : []); });
    }
    // Someone removed on step 2 since: drop them
    Object.values(s.who).forEach(set => [...set].forEach(n => { if (!names.includes(n)) set.delete(n); }));
    return s.who;
  }
  // "S", or "Sa" and "So" when two names start the same
  function initialOf(name) {
    const first = name.charAt(0).toUpperCase();
    const clash = state.people.filter(p => p.name.charAt(0).toUpperCase() === first).length > 1;
    return clash ? name.slice(0, 2).replace(/^./, c => c.toUpperCase()) : first;
  }
  const everyone = () => state.people.map(p => p.name);

  // ---- Steps ---------------------------------------------------------------------
  function stepHtml() {
    const s = state;
    if (s.step === 0) return `
      <h1 class="setup-title setup-hello" id="setup-title">Welcome to <span class="hw" role="img" aria-label="harmonee"><span class="hw-ink" aria-hidden="true">harmonee</span><span class="hw-stars" aria-hidden="true"><span class="hw-star is-1"><svg viewBox="0 0 24 24"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="currentColor"/></svg></span><span class="hw-star is-2"><svg viewBox="0 0 24 24"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="currentColor"/></svg></span><span class="hw-star is-3"><svg viewBox="0 0 24 24"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="currentColor"/></svg></span></span></span></h1>
      <p class="setup-lead setup-tagline">One board for the whole family 💛</p>
      <ul class="setup-perks" aria-label="What's in harmonee">
        <li><span aria-hidden="true">📅</span>Shared calendar</li>
        <li><span aria-hidden="true">✅</span>Chores &amp; rewards</li>
        <li><span aria-hidden="true">🍽️</span>Meal plans</li>
        <li><span aria-hidden="true">🛒</span>Shopping lists</li>
      </ul>
      <button type="button" class="setup-btn is-primary setup-start" data-act="start">Let's get started</button>
      <div class="setup-join-note is-short">
        <p>👋 <strong>Joining your family?</strong> Scan their QR code or open their join link.${s.pasteOpen ? "" : ` <button type="button" class="setup-paste-link" data-act="paste">Paste a link</button>`}</p>
        ${s.pasteOpen ? `<form class="setup-paste-form" data-paste-form>
          <input id="setup-paste" class="setup-input" type="text" inputmode="url" placeholder="Paste the join link" autocomplete="off" enterkeyhint="go" aria-label="Join link">
          <button type="submit" class="setup-btn is-primary">Join</button>
        </form>
        ${s.pasteError ? `<p class="setup-paste-error" role="alert">${esc(s.pasteError)}</p>` : ""}` : ""}
      </div>`;
    if (s.step === 1) return `
      <h1 class="setup-title" id="setup-title">👋 What's your family called?</h1>
      <input id="setup-family" class="setup-input setup-family-input" type="text" maxlength="40" placeholder="e.g. The Bakers" value="${esc(s.familyName)}" autocomplete="off" enterkeyhint="next" aria-label="Family name">
      <p class="setup-label setup-label-row">🌤️ Your town, for the weather <span class="setup-optional">Optional</span></p>
      <div id="setup-weather" class="setup-weather is-compact"></div>`;

    if (s.step === 2) return `
      <h1 class="setup-title" id="setup-title">🏡 Who's in the family?</h1>
      ${s.people.length ? `<div class="setup-pills" role="list" aria-label="Added so far">${s.people.map((p, i) => `
        <span class="setup-pill${s.openColour === i ? " is-open" : ""}" role="listitem" style="--pill:${colourOf(p.colour)}">
          <button type="button" class="setup-pill-name" data-act="colour" data-i="${i}" aria-label="${esc(p.name)}: change colour" aria-expanded="${s.openColour === i}">${esc(p.name)}</button>
          <button type="button" class="setup-pill-x" data-act="remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">✕</button>
        </span>`).join("")}</div>
      ${s.openColour !== null && s.openColour !== undefined && s.people[s.openColour] ? `<div class="setup-swatches" role="group" aria-label="${esc(s.people[s.openColour].name)}'s colour">${palette().map(c => `<button type="button" class="setup-swatch${c.id === s.people[s.openColour].colour ? " is-on" : ""}" style="background:${c.solid}" data-act="pick-colour" data-i="${s.openColour}" data-colour="${c.id}" aria-label="${esc(c.name)}" aria-pressed="${c.id === s.people[s.openColour].colour}"></button>`).join("")}</div>` : ""}` : ""}
      <div class="setup-add-row">
        <input id="setup-person" class="setup-input" type="text" maxlength="24" placeholder="${s.people.length ? "Add someone else" : "A name, e.g. Sam"}" autocomplete="off" enterkeyhint="done" ${s.people.length >= MAX_PEOPLE ? "disabled" : ""}>
        <button type="button" class="setup-btn is-secondary" data-act="add-person" ${s.people.length >= MAX_PEOPLE ? "disabled" : ""}>Add</button>
      </div>
      <p class="setup-hint">${s.people.length ? "🎨 Tap a name to change its colour" : "Add everyone who'll use harmonee."}</p>`;

    if (s.step === 3) {
      // Pick a buddy: optional, one strip of buddies per person
      const list = window.Buddies ? window.Buddies.available() : [];
      return `
      <h1 class="setup-title" id="setup-title">🐾 Pick a buddy</h1>
      <p class="setup-lead">When someone ticks off their last job of the day, their buddy pops up to say well done.</p>
      <p class="setup-later">✨ Optional: skip anyone, or change it later in Settings → Profiles</p>
      ${s.people.map((p, i) => {
        const chosen = p.buddy && window.Buddies ? window.Buddies.byId(p.buddy) : null;
        return `<div class="setup-buddy-row">
          <p class="setup-buddy-who"><span class="setup-mini-avatar" style="background:${colourOf(p.colour)}">${esc(p.name.charAt(0).toUpperCase())}</span>
            <span class="setup-buddy-name">${esc(p.name)}</span><span class="setup-buddy-chosen">${chosen ? esc(chosen.name) : "No buddy yet"}</span></p>
          <div class="setup-buddy-strip" role="group" aria-label="${esc(p.name)}'s buddy">${list.map(b => `
            <button type="button" class="setup-buddy${p.buddy === b.id ? " is-on" : ""}" style="--pill:${colourOf(p.colour)}" data-act="buddy" data-i="${i}" data-buddy="${b.id}" aria-pressed="${p.buddy === b.id}" aria-label="${esc(b.name)} for ${esc(p.name)}">
              ${window.Buddies.svgFor(b.id)}<span>${esc(b.name)}</span></button>`).join("")}</div>
        </div>`;
      }).join("")}`;
    }

    if (s.step === 4) return `
      <h1 class="setup-title" id="setup-title">⭐ Points or pocket money?</h1>
      <p class="setup-lead">What do jobs earn?</p>
      <div class="setup-choice-grid">
        <button type="button" class="setup-choice${s.mode === "points" ? " is-on" : ""}" data-act="mode" data-mode="points" aria-pressed="${s.mode === "points"}">
          <span class="setup-choice-icon" aria-hidden="true">🏆</span><span class="setup-choice-title">Points</span><span class="setup-choice-desc">Weekly podium &amp; goals</span>
        </button>
        <button type="button" class="setup-choice${s.mode === "money" ? " is-on" : ""}" data-act="mode" data-mode="money" aria-pressed="${s.mode === "money"}">
          <span class="setup-choice-icon" aria-hidden="true">💰</span><span class="setup-choice-title">Pocket money</span><span class="setup-choice-desc">Earn real money</span>
        </button>
      </div>
      ${s.mode === "money" ? `<div class="setup-currency" role="group" aria-label="Currency">${["£", "€", "$"].map(c => `<button type="button" class="${s.currency === c ? "is-on" : ""}" data-act="currency" data-currency="${c}" aria-pressed="${s.currency === c}">${c}</button>`).join("")}</div>` : ""}`;

    if (s.step === 5) {
      const who = routineWho();
      const group = (slot) => ROUTINES.filter(r => r.slot === slot);
      const row = (r) => {
        const set = who[r.key];
        return `<li class="setup-routine${set.size ? " is-on" : ""}${s.people.length > 5 ? " is-crowded" : ""}">
          <span class="setup-routine-icon" aria-hidden="true">${r.icon}</span>
          <span class="setup-routine-title">${esc(r.title)}</span>
          <span class="setup-routine-who" role="group" aria-label="Who does ${esc(r.title)}">${s.people.map(p => {
            const on = set.has(p.name);
            return `<button type="button" class="setup-who${on ? " is-on" : ""}" style="--who:${colourOf(p.colour)}" data-act="who" data-key="${r.key}" data-name="${esc(p.name)}" aria-pressed="${on}" aria-label="${esc(p.name)}">${esc(initialOf(p.name))}</button>`;
          }).join("")}</span>
        </li>`;
      };
      return `
        <h1 class="setup-title" id="setup-title">✅ Starter routines</h1>
        <p class="setup-lead">A few ideas to get going. Tap who does each one, or skip it.</p>
        <p class="setup-later">✨ Add your own any time on the Tasks page</p>
        ${["morning", "afternoon", "evening"].map(slot => `<p class="setup-slot">${SLOT_LABEL[slot]}</p><ul class="setup-routines">${group(slot).map(row).join("")}</ul>`).join("")}
        <h2 class="setup-group">🙋 Up for grabs <span>anyone can do these</span></h2>
        <div class="setup-job-chips">${JOBS.map(j => `<button type="button" class="setup-job-chip${s.picked.has(j.key) ? " is-on" : ""}" data-act="pick" data-key="${j.key}" aria-pressed="${s.picked.has(j.key)}"><span aria-hidden="true">${j.icon}</span> ${esc(j.title)}${j.day ? ` <small>${esc(j.day)}s</small>` : ""}</button>`).join("")}</div>`;
    }

    // 6: summary
    const nRoutines = ROUTINES.filter(r => routineWho()[r.key].size).length;
    const nJobs = JOBS.filter(j => s.picked.has(j.key)).length;
    return `
      <div class="setup-done-mark" aria-hidden="true">🎉</div>
      <h1 class="setup-title" id="setup-title">You're all set!</h1>
      ${s.familyName ? `<p class="setup-family-badge">🏡 ${esc(s.familyName)}</p>` : ""}

      <ul class="setup-summary">
        <li><span aria-hidden="true">👥</span><span>${s.people.map(p => `<span class="setup-mini-avatar" style="background:${colourOf(p.colour)}">${esc(p.name.charAt(0).toUpperCase())}</span>`).join("")} ${esc(s.people.map(p => p.name).join(", "))}</span></li>
        <li><span aria-hidden="true">🐾</span><span>${(() => {
          const withBuddy = s.people.filter(p => p.buddy && window.Buddies && window.Buddies.byId(p.buddy));
          return withBuddy.length ? esc(withBuddy.map(p => `${p.name}: ${window.Buddies.byId(p.buddy).name}`).join(", ")) : "No buddies yet (add them in Settings → Profiles)";
        })()}</span></li>
        <li><span aria-hidden="true">${s.mode === "money" ? "💰" : "🏆"}</span><span>${s.mode === "money" ? `Pocket money in ${esc(s.currency)}` : "Points &amp; a weekly podium"}</span></li>
        <li><span aria-hidden="true">✅</span><span>${nRoutines} routine${nRoutines === 1 ? "" : "s"} &amp; ${nJobs} job${nJobs === 1 ? "" : "s"} up for grabs</span></li>
        <li><span aria-hidden="true">🌤️</span><span>${s.weather ? `Weather for ${esc(s.weather.label || s.weather.name)}` : "No weather yet (add it in Settings)"}</span></li>
        <li><span aria-hidden="true">🔐</span><span>A QR code to add everyone's phones, next</span></li>
      </ul>`;
  }

  function render() {
    const el = document.getElementById("setup-wizard");
    const s = state;
    const canBack = s.step > 1;
    const intro = s.step === 0;
    const nextLabel = s.step === STEPS ? "Create the board 🎉" : "Continue";
    el.innerHTML = `
      <div class="setup-card${intro ? " is-intro" : ""}" role="document">
        <div class="setup-top">
          <span class="setup-brand" aria-hidden="true">h</span>
          ${intro ? "" : `<span class="setup-step-count" aria-hidden="true">${s.step === STEPS ? "Last step!" : `Step ${s.step} of ${STEPS}`}</span><ol class="setup-dots" aria-label="Step ${s.step} of ${STEPS}">${Array.from({ length: STEPS }, (_, i) => `<li class="${i + 1 === s.step ? "is-now" : (i + 1 < s.step ? "is-done" : "")}"></li>`).join("")}</ol>`}
        </div>
        <div class="setup-body">${stepHtml()}</div>
        <p class="setup-error" role="alert">${esc(s.error || "")}</p>
        ${intro ? "" : `<div class="setup-foot">
          ${canBack || s.step === 1 && state.cameFromIntro ? `<button type="button" class="setup-btn is-ghost" data-act="back">Back</button>` : `<span></span>`}
          <button type="button" class="setup-btn is-primary" data-act="next">${nextLabel}</button>
        </div>`}
      </div>`;
    if (s.step === 1 && window.WeatherPlace) {
      window.WeatherPlace.renderWeatherPlacePicker(document.getElementById("setup-weather"), {
        current: s.weather,
        compact: true,
        onPick: (place) => { state.weather = place; }
      });
    }
    if (s.step === 0) {
      const hello = el.querySelector(".setup-hello");
      const go = () => { if (hello) hello.classList.add("is-writing"); };
      try { Promise.race([document.fonts.load('400 48px "Parisienne"'), new Promise(r => setTimeout(r, 1500))]).then(go, go); }
      catch (e) { go(); }
    }
    const focus = el.querySelector(s.step === 1 ? "#setup-family" : s.step === 2 ? "#setup-person" : s.step === 0 ? ".setup-start" : ".setup-btn.is-primary");
    if (focus && !(s.step === 2 && s.people.length >= MAX_PEOPLE)) setTimeout(() => { try { focus.focus({ preventScroll: true }); } catch (e) {} }, 30);
  }

  // ---- Actions ---------------------------------------------------------------------
  function addPerson() {
    const input = document.getElementById("setup-person");
    const name = (input && input.value || "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (!name) return;
    if (state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { state.error = `${name} is already on the list.`; render(); return; }
    state.people.push({ name, colour: nextColour() });
    state.error = "";
    render();
    // Keep the keyboard up for the next name
    const again = document.getElementById("setup-person");
    if (again) { try { again.focus({ preventScroll: true }); } catch (e) { again.focus(); } }
  }

  function next() {
    const s = state;
    s.error = "";
    if (s.step === 1) {
      const v = (document.getElementById("setup-family").value || "").trim();
      if (!v) { s.error = "Add your family's name first 🙂"; render(); return; }
      s.familyName = v.slice(0, 40);
    }
    if (s.step === 2) {
      const typed = (document.getElementById("setup-person") || {}).value;
      if (typed && typed.trim()) addPerson(); // pressed Continue with a name still typed
      if (!s.people.length) { s.error = "Add at least one person."; render(); return; }
    }
    if (s.step === STEPS) { create(); return; }
    s.step++;
    render();
    document.getElementById("setup-wizard").scrollTop = 0;
  }

  // Builds the board's starting data and goes to it
  function create() {
    const s = state;
    // Making a family's board (and its family code) happens online
    if (window.isOffline && window.isOffline()) {
      s.error = "Setting up a family needs the internet. Your answers are kept: tap “Create the board” again when you're back online.";
      render();
      return;
    }
    const slug = (s.familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "family").slice(0, 30);
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
    const boardId = `${slug}-${rand}`;
    const names = everyone();
    const who = routineWho();
    const stamp = Date.now();
    const tasks = [];
    ROUTINES.filter(r => who[r.key].size).forEach((r, i) => tasks.push({
      id: `setup-${stamp}-r${i}`,
      title: r.title, icon: r.icon,
      assignedTo: who[r.key].size === 1 ? [...who[r.key]][0] : names.filter(n => who[r.key].has(n)),
      taskType: "Daily Task", day: "Daily", date: null, repeat: "daily",
      kind: "routine", routineSlot: r.slot, value: 1,
      order: { morning: 1, afternoon: 2, evening: 4 }[r.slot] || 4,
      done: false, completedBy: null, completedAt: null
    }));
    JOBS.filter(j => s.picked.has(j.key)).forEach((j, i) => tasks.push(j.day ? {
      id: `setup-${stamp}-j${i}`,
      title: j.title, icon: j.icon, assignedTo: null,
      taskType: "Standard", day: j.day, date: null, repeat: "weekly",
      kind: "chore", routineSlot: null, value: 2, order: 3,
      done: false, completedBy: null, completedAt: null
    } : {
      id: `setup-${stamp}-j${i}`,
      title: j.title, icon: j.icon, assignedTo: null,
      taskType: "Daily Task", day: "Daily", date: null, repeat: "daily",
      kind: "chore", routineSlot: "anytime", value: 2, order: 5,
      done: false, completedBy: null, completedAt: null
    }));

    const memberColors = {};
    const memberBuddies = {};
    s.people.forEach(p => {
      memberColors[p.name.toLowerCase()] = p.colour;
      if (p.buddy) memberBuddies[p.name.toLowerCase()] = p.buddy;
    });
    try {
      localStorage.setItem("harmonee_active_board_id", boardId);
      localStorage.setItem("chore_active_board_id", boardId);
      localStorage.setItem("harmonee_pending_new_board", boardId); // app.js creates it, with a family code
      localStorage.setItem(`harmonee_roster_${boardId}`, JSON.stringify(names));
      localStorage.setItem(`harmonee_settings_${boardId}`, JSON.stringify({
        familyName: s.familyName, gameMode: s.mode, currency: s.currency, memberColors,
        ...(Object.keys(memberBuddies).length ? { memberBuddies } : {}),
        ...(s.weather ? { weatherLocation: { lat: s.weather.lat, lon: s.weather.lon, name: s.weather.name, label: s.weather.label || s.weather.name } } : {})
      }));
      localStorage.setItem(`harmonee_setup_tasks_${boardId}`, JSON.stringify(tasks));
    } catch (e) {
      s.error = "This browser won't let harmonee save. Check it isn't in private mode.";
      render();
      return;
    }
    const btn = document.querySelector("#setup-wizard [data-act='next']");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
    // A little celebration (it's this tap, so the sound is allowed), then
    // open the new board once the confetti has had its moment
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { if (window.sfx && window.sfx.playCelebrationChime) window.sfx.playCelebrationChime(); } catch (e) {}
    if (!reduce && typeof window.confetti === "function") {
      try {
        const colors = ["#38bdf8", "#0284c7", "#f59e0b", "#10b981", "#ec4899"];
        window.confetti({ zIndex: 200000, particleCount: 90, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.75 }, colors });
        setTimeout(() => window.confetti({ zIndex: 200000, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors }), 180);
        setTimeout(() => window.confetti({ zIndex: 200000, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors }), 300);
      } catch (e) {}
    }
    const go = new URL(window.location.origin + window.location.pathname);
    go.searchParams.set("board", boardId);
    go.searchParams.set("template", "setup");
    setTimeout(() => { window.location.href = go.toString(); }, reduce ? 300 : 1400);
  }

  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.getAttribute("data-act");
    const i = parseInt(b.getAttribute("data-i"), 10);
    const s = state;
    if (act === "next") return next();
    if (act === "start") { s.step = 1; s.cameFromIntro = true; return render(); }
    if (act === "paste") {
      s.pasteOpen = true; s.pasteError = "";
      render();
      setTimeout(() => { const i = document.getElementById("setup-paste"); if (i) i.focus(); }, 50);
      return;
    }
    if (act === "back") { s.error = ""; s.step = Math.max(s.cameFromIntro ? 0 : 1, s.step - 1); return render(); }
    if (act === "add-person") return addPerson();
    if (act === "remove") { s.people.splice(i, 1); s.openColour = null; return render(); }
    if (act === "who") {
      const set = routineWho()[b.getAttribute("data-key")];
      const n = b.getAttribute("data-name");
      if (set.has(n)) set.delete(n); else set.add(n);
      return render();
    }
    if (act === "colour") { s.openColour = s.openColour === i ? null : i; return render(); }
    if (act === "pick-colour") { s.people[i].colour = b.getAttribute("data-colour"); s.openColour = null; return render(); }
    if (act === "buddy") {
      // Tap to choose, tap again to go without; keep the strip where it was
      const id = b.getAttribute("data-buddy");
      const strip = b.closest(".setup-buddy-strip");
      const left = strip ? strip.scrollLeft : 0;
      s.people[i].buddy = s.people[i].buddy === id ? null : id;
      render();
      const again = document.querySelectorAll(".setup-buddy-strip")[i];
      if (again) again.scrollLeft = left;
      return;
    }
    if (act === "mode") { s.mode = b.getAttribute("data-mode"); return render(); }
    if (act === "currency") { s.currency = b.getAttribute("data-currency"); return render(); }
    if (act === "pick") { const k = b.getAttribute("data-key"); if (s.picked.has(k)) s.picked.delete(k); else s.picked.add(k); return render(); }
  }

  function onKey(e) {
    if (e.key !== "Enter") return;
    if (e.target.id === "setup-person") { e.preventDefault(); addPerson(); }
    else if (e.target.id === "setup-family") { e.preventDefault(); next(); }
  }

  function openSetupWizard() {
    state = freshState();
    let el = document.getElementById("setup-wizard");
    if (!el) {
      el = document.createElement("div");
      el.id = "setup-wizard";
      el.className = "setup-wizard";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "setup-title");
      document.body.appendChild(el);
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKey);
      // A pasted join link (…?board=the-bakers-k3m9&code=MINT-FROG-LAMP):
      // open it here, which joins this device (needed in an iPhone
      // home-screen app, where tapping a link opens Safari instead)
      el.addEventListener("submit", (e) => {
        if (!e.target.closest("[data-paste-form]")) return;
        e.preventDefault();
        // Find the link even inside a pasted message ("Join us! https://…")
        const pasted = (document.getElementById("setup-paste").value || "").trim();
        const typed = (pasted.match(/\S*[?&](?:board|b)=\S+/) || [pasted])[0];
        let link = null;
        try { link = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`); } catch (err) {}
        const board = link && (link.searchParams.get("board") || link.searchParams.get("b"));
        const code = link && (link.searchParams.get("code") || link.searchParams.get("join"));
        if (!board || !code) {
          state.pasteError = "That isn't a join link. Copy it from Settings › Access.";
          render();
          return;
        }
        const go = new URL(window.location.origin + window.location.pathname);
        go.searchParams.set("board", board);
        go.searchParams.set("code", code);
        window.location.href = go.toString();
      });
      el.addEventListener("input", (e) => {
        if (e.target.id === "setup-family") {
          state.familyName = e.target.value;
          const prev = el.querySelector(".setup-preview-name");
          if (prev) prev.textContent = e.target.value.trim() || "The Bakers";
        }
      });
    }
    el.hidden = false;
    render();
  }
  window.openSetupWizard = openSetupWizard;

  // ---- First visit to a brand-new board: the family code -------------------------
  let welcomeShowing = false;
  // First visit to a brand-new board: open Today at a glance, where the
  // Getting started card offers the QR (js/getting-started.js), rather than
  // a QR pop-up landing on top of everything
  async function showWelcome() {
    if (welcomeShowing) return;
    const key = `harmonee_welcome_${window.currentBoardId}`;
    try { if (!localStorage.getItem(key)) return; localStorage.removeItem(key); localStorage.removeItem(`harmonee_setup_tasks_${window.currentBoardId}`); } catch (e) { return; }
    welcomeShowing = true;
    for (let tries = 0; tries < 20 && typeof window.showTodayScreen !== "function"; tries++) await new Promise(r => setTimeout(r, 250));
    if (typeof window.showTodayScreen === "function") window.showTodayScreen({ from: "welcome" });
  }
  window.showSetupWelcome = showWelcome;
  if (document.readyState === "complete") setTimeout(showWelcome, 500);
  else window.addEventListener("load", () => setTimeout(showWelcome, 500));
})();
