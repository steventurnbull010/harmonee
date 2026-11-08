// ============================================================================
// GUIDED SETUP FOR NEW FAMILIES (js/setup-wizard.js)
// Opens at /?new=true (and from "Create a Brand New Board" in the share
// window). Five short steps:
//   1. Family name ("The Bakers")          -> shown at the top of every page
//   2. Who's in the family                 -> names, colours, grown-up / child
//   3. Points or pocket money (+ currency)
//   4. Starter routines and jobs to tick   -> kids' routines go to children
//   5. All set                             -> creates the board
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
  const STEPS = 5;

  function freshState() {
    const params = new URLSearchParams(window.location.search);
    return {
      // Arrived at the plain address (no board, none before): say hello first.
      // A "?new=true" link goes straight to step 1.
      step: params.get("new") === "true" ? 1 : 0,
      familyName: (params.get("family") || "").slice(0, 40),
      people: [],          // { name, colour, child }
      openColour: null,    // index of the person whose colour row is open
      mode: "points",
      currency: "£",
      picked: new Set([...ROUTINES, ...JOBS].filter(x => x.on).map(x => x.key)),
      weather: null,       // { lat, lon, name, label } from the place picker (js/weather.js)
      error: ""
    };
  }

  const nextColour = () => COLOUR_ORDER.find(id => !state.people.some(p => p.colour === id)) || COLOUR_ORDER[state.people.length % COLOUR_ORDER.length];
  const children = () => state.people.filter(p => p.child).map(p => p.name);
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
      <ul class="setup-chips" aria-label="About setup"><li>⏱️ About a minute</li><li>✏️ Change it later</li></ul>
      <input id="setup-family" class="setup-input setup-family-input" type="text" maxlength="40" placeholder="e.g. The Bakers" value="${esc(s.familyName)}" autocomplete="off" enterkeyhint="next" aria-label="Family name">
      <p class="setup-label setup-label-row">🌤️ Your town, for the weather <span class="setup-optional">Optional</span></p>
      <div id="setup-weather" class="setup-weather is-compact"></div>`;

    if (s.step === 2) return `
      <h1 class="setup-title" id="setup-title">Who's in the family?</h1>
      <p class="setup-lead">Add everyone who'll use the board. Children get the starter routines.</p>
      <div class="setup-add-row">
        <input id="setup-person" class="setup-input" type="text" maxlength="24" placeholder="A name, e.g. Sam" autocomplete="off" enterkeyhint="done" ${s.people.length >= MAX_PEOPLE ? "disabled" : ""}>
        <button type="button" class="setup-btn is-secondary" data-act="add-person" ${s.people.length >= MAX_PEOPLE ? "disabled" : ""}>Add</button>
      </div>
      ${s.people.length ? `<ul class="setup-people">${s.people.map((p, i) => `
        <li class="setup-person">
          <div class="setup-person-row">
            <button type="button" class="setup-avatar" style="background:${colourOf(p.colour)}" data-act="colour" data-i="${i}" aria-label="Change ${esc(p.name)}'s colour" aria-expanded="${s.openColour === i}">${esc(p.name.charAt(0).toUpperCase())}</button>
            <span class="setup-person-name">${esc(p.name)}</span>
            <span class="setup-seg" role="group" aria-label="${esc(p.name)} is a">
              <button type="button" class="${p.child ? "" : "is-on"}" data-act="adult" data-i="${i}" aria-pressed="${!p.child}">Grown-up</button>
              <button type="button" class="${p.child ? "is-on" : ""}" data-act="child" data-i="${i}" aria-pressed="${p.child}">Child</button>
            </span>
            <button type="button" class="setup-remove" data-act="remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">✕</button>
          </div>
          ${s.openColour === i ? `<div class="setup-swatches" role="group" aria-label="Colours">${palette().map(c => `<button type="button" class="setup-swatch${c.id === p.colour ? " is-on" : ""}" style="background:${c.solid}" data-act="pick-colour" data-i="${i}" data-colour="${c.id}" aria-label="${esc(c.name)}" aria-pressed="${c.id === p.colour}"></button>`).join("")}</div>` : ""}
        </li>`).join("")}</ul>` : `<p class="setup-hint">Nobody yet. Type a name and press Add.</p>`}`;

    if (s.step === 3) return `
      <h1 class="setup-title" id="setup-title">Points or pocket money?</h1>
      <p class="setup-lead">Jobs earn something. You can switch later in Settings.</p>
      <div class="setup-choice-grid">
        <button type="button" class="setup-choice${s.mode === "points" ? " is-on" : ""}" data-act="mode" data-mode="points" aria-pressed="${s.mode === "points"}">
          <span class="setup-choice-icon" aria-hidden="true">🏆</span><span class="setup-choice-title">Points</span><span class="setup-choice-desc">A weekly podium, and goals to save up for</span>
        </button>
        <button type="button" class="setup-choice${s.mode === "money" ? " is-on" : ""}" data-act="mode" data-mode="money" aria-pressed="${s.mode === "money"}">
          <span class="setup-choice-icon" aria-hidden="true">💰</span><span class="setup-choice-title">Pocket money</span><span class="setup-choice-desc">Jobs earn real money towards treats</span>
        </button>
      </div>
      ${s.mode === "money" ? `<div class="setup-currency" role="group" aria-label="Currency">${["£", "€", "$"].map(c => `<button type="button" class="${s.currency === c ? "is-on" : ""}" data-act="currency" data-currency="${c}" aria-pressed="${s.currency === c}">${c}</button>`).join("")}</div>` : ""}`;

    if (s.step === 4) {
      const kids = children();
      const forWho = kids.length ? `for ${kids.length === 1 ? kids[0] : (kids.length === 2 ? kids.join(" and ") : "the children")}` : "for everyone";
      const group = (slot) => ROUTINES.filter(r => r.slot === slot);
      const check = (x, sub = "") => `<button type="button" class="setup-check${s.picked.has(x.key) ? " is-on" : ""}" data-act="pick" data-key="${x.key}" aria-pressed="${s.picked.has(x.key)}">
        <span class="setup-check-box" aria-hidden="true">✓</span><span class="setup-check-icon" aria-hidden="true">${x.icon}</span><span class="setup-check-title">${esc(x.title)}</span>${sub ? `<span class="setup-check-sub">${esc(sub)}</span>` : ""}
      </button>`;
      return `
        <h1 class="setup-title" id="setup-title">Pick some starter routines</h1>
        <p class="setup-lead">A head start for the Tasks page. Untick anything you don't want.</p>
        <h2 class="setup-group">Daily routines <span>${esc(forWho)}</span></h2>
        ${["morning", "afternoon", "evening"].map(slot => `<p class="setup-slot">${SLOT_LABEL[slot]}</p><div class="setup-checks">${group(slot).map(r => check(r)).join("")}</div>`).join("")}
        <h2 class="setup-group">Jobs anyone can grab <span>points for whoever does it</span></h2>
        <div class="setup-checks">${JOBS.map(j => check(j, j.day ? `${j.day}s` : "Every day")).join("")}</div>`;
    }

    // 5: summary
    const nRoutines = ROUTINES.filter(r => s.picked.has(r.key)).length;
    const nJobs = JOBS.filter(j => s.picked.has(j.key)).length;
    return `
      <div class="setup-done-mark" aria-hidden="true">🎉</div>
      <h1 class="setup-title" id="setup-title">All set, ${esc(s.familyName || "your family")}!</h1>
      <p class="setup-lead">Here's what we'll make. Everything can be changed later.</p>
      <ul class="setup-summary">
        <li><span aria-hidden="true">👥</span><span>${s.people.map(p => `<span class="setup-mini-avatar" style="background:${colourOf(p.colour)}">${esc(p.name.charAt(0).toUpperCase())}</span>`).join("")} ${esc(s.people.map(p => p.name).join(", "))}</span></li>
        <li><span aria-hidden="true">${s.mode === "money" ? "💰" : "🏆"}</span><span>${s.mode === "money" ? `Pocket money in ${esc(s.currency)}` : "Points and a weekly podium"}</span></li>
        <li><span aria-hidden="true">✅</span><span>${nRoutines} daily routine${nRoutines === 1 ? "" : "s"} and ${nJobs} job${nJobs === 1 ? "" : "s"} to grab</span></li>
        <li><span aria-hidden="true">🌤️</span><span>${s.weather ? `Weather for ${esc(s.weather.label || s.weather.name)}` : "No weather yet. Add your town any time in Settings › Display"}</span></li>
        <li><span aria-hidden="true">🔐</span><span>A family code to add your phones, shown on the next screen</span></li>
      </ul>`;
  }

  function render() {
    const el = document.getElementById("setup-wizard");
    const s = state;
    const canBack = s.step > 1;
    const intro = s.step === 0;
    const nextLabel = s.step === STEPS ? "Create our board" : "Continue";
    el.innerHTML = `
      <div class="setup-card${intro ? " is-intro" : ""}" role="document">
        <div class="setup-top">
          <span class="setup-brand" aria-hidden="true">h</span>
          ${intro ? "" : `<ol class="setup-dots" aria-label="Step ${s.step} of ${STEPS}">${Array.from({ length: STEPS }, (_, i) => `<li class="${i + 1 === s.step ? "is-now" : (i + 1 < s.step ? "is-done" : "")}"></li>`).join("")}</ol>`}
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
    // First two default to grown-ups, the rest to children (one tap to change)
    state.people.push({ name, colour: nextColour(), child: state.people.filter(p => !p.child).length >= 2 });
    state.error = "";
    render();
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
      s.error = "Setting up a family needs the internet. Your answers are kept: tap “Create our board” again when you're back online.";
      render();
      return;
    }
    const slug = (s.familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "family").slice(0, 30);
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
    const boardId = `${slug}-${rand}`;
    const names = everyone();
    const kids = children();
    const routineFor = kids.length ? kids : names;
    const stamp = Date.now();
    const tasks = [];
    ROUTINES.filter(r => s.picked.has(r.key)).forEach((r, i) => tasks.push({
      id: `setup-${stamp}-r${i}`,
      title: r.title, icon: r.icon,
      assignedTo: routineFor.length === 1 ? routineFor[0] : routineFor,
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
    s.people.forEach(p => { memberColors[p.name.toLowerCase()] = p.colour; });
    try {
      localStorage.setItem("harmonee_active_board_id", boardId);
      localStorage.setItem("chore_active_board_id", boardId);
      localStorage.setItem("harmonee_pending_new_board", boardId); // app.js creates it, with a family code
      localStorage.setItem(`harmonee_roster_${boardId}`, JSON.stringify(names));
      localStorage.setItem(`harmonee_settings_${boardId}`, JSON.stringify({
        familyName: s.familyName, gameMode: s.mode, currency: s.currency, memberColors,
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
    const go = new URL(window.location.origin + window.location.pathname);
    go.searchParams.set("board", boardId);
    go.searchParams.set("template", "setup");
    window.location.href = go.toString();
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
    if (act === "adult" || act === "child") { s.people[i].child = act === "child"; return render(); }
    if (act === "colour") { s.openColour = s.openColour === i ? null : i; return render(); }
    if (act === "pick-colour") { s.people[i].colour = b.getAttribute("data-colour"); s.openColour = null; return render(); }
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
  async function showWelcome() {
    if (welcomeShowing) return;
    const boardId = window.currentBoardId;
    const key = `harmonee_welcome_${boardId}`;
    try { if (!localStorage.getItem(key)) return; } catch (e) { return; }
    let info = null;
    for (let tries = 0; tries < 10 && !(info && info.code); tries++) {
      await new Promise(r => setTimeout(r, 700));
      try { info = typeof window.loadFamilyAccessInfo === "function" ? await window.loadFamilyAccessInfo() : null; } catch (e) {}
    }
    if (!info || !info.code) return; // try again next visit
    if (welcomeShowing) return;
    welcomeShowing = true;
    try { localStorage.removeItem(key); localStorage.removeItem(`harmonee_setup_tasks_${boardId}`); } catch (e) {}
    const name = ((window.boardSettings || {}).familyName) || "";
    const dlg = document.createElement("dialog");
    dlg.className = "setup-welcome-dialog";
    dlg.setAttribute("aria-labelledby", "setup-welcome-title");
    dlg.innerHTML = `
      <div class="setup-welcome-card">
        <div class="setup-done-mark" aria-hidden="true">🏡</div>
        <h2 class="setup-title" id="setup-welcome-title">${name ? `Welcome, ${esc(name)}!` : "You're all set!"}</h2>
        <p class="setup-lead">Bring the family in: they point their phone camera at this code, or you send them the link.</p>
        ${window.JoinQR && window.JoinQR.svg(info.joinUrl) ? `<div class="setup-welcome-qr">${window.JoinQR.svg(info.joinUrl)}</div>` : ""}
        <p class="setup-code-small">Family code <strong>${esc(info.code)}</strong></p>
        <div class="setup-welcome-actions">
          <button type="button" class="setup-btn is-secondary" data-welcome="copy">Copy join link</button>
          <button type="button" class="setup-btn is-primary" data-welcome="close">Let's go</button>
        </div>
        <p class="setup-hint">Find this again any time in Settings › Access.</p>
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-welcome]");
      if (!b) return;
      if (b.getAttribute("data-welcome") === "copy") {
        try { await navigator.clipboard.writeText(info.joinUrl); b.textContent = "Copied ✓"; }
        catch (err) { b.textContent = "Copy didn't work"; }
        return;
      }
      dlg.close();
      dlg.remove();
    });
    dlg.showModal();
  }
  // app.js calls this right after creating a new board; on load it also
  // catches a welcome that didn't get shown (e.g. the page was reloaded)
  window.showSetupWelcome = showWelcome;
  if (document.readyState === "complete") setTimeout(showWelcome, 500);
  else window.addEventListener("load", () => setTimeout(showWelcome, 500));
})();
