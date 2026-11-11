// ============================================================================
// PICTURE JOBS FOR CHILDREN WHO AREN'T READING YET (js/picture-jobs.js)
// Planned with Steven, 11 Nov (for his brother's two little ones, on phones).
//
//   - "Is Ruby reading yet?" on their profile and in setup. "Not yet" keeps
//     boardSettings.memberPictures = { "ruby": true } (lower-case name, like
//     memberBuddies). No age is stored.
//   - Their column on Tasks shows big picture cards with stars (★★) instead
//     of "2 pts" (the same points underneath). Tapping a picture reads the
//     job aloud; the round tick finishes it (tap again to undo); a small
//     pencil is for grown-ups to change the job.
//   - "▶ My jobs" opens their full-screen view: the next job big, the rest
//     small underneath (any can be ticked), "Well done, Ruby!" after each,
//     their buddy at the end, their stars toward their goal. It closes itself
//     after 2 minutes untouched.
//   - A ready-made routine to tick through (Morning, Out the door, Bedtime,
//     and some extras left unticked).
// Pictures: drawings in the buddies' style from js/job-art.js when there's
// one for the job (matched from its name), otherwise the job's emoji.
// Reading aloud: clips in a young, excited voice (js/voice-clips.js), else
// the phone's own voice.
// Styles: css/picture-jobs.css
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const lower = (n) => String(n || "").trim().toLowerCase();
  const IDLE_MS = 2 * 60 * 1000;

  // ---- Who sees pictures -------------------------------------------------------------
  function isOn(name) {
    const map = (window.boardSettings && window.boardSettings.memberPictures) || {};
    return !!map[lower(name)];
  }
  async function setOn(name, on) {
    const map = { ...((window.boardSettings && window.boardSettings.memberPictures) || {}) };
    if (on) map[lower(name)] = true; else delete map[lower(name)];
    if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ memberPictures: map });
    else if (window.boardSettings) window.boardSettings.memberPictures = map;
    if (typeof window.renderSkylightTasksPage === "function") window.renderSkylightTasksPage();
  }

  // ---- The pictures ------------------------------------------------------------------
  // In order: the first that matches wins ("Brush teeth" before "bath")
  const PICTURES = [
    { key: "teeth",     emoji: "🪥", words: /\b(teeth|tooth|toothbrush|brush your teeth)\b/i },
    { key: "toilet",    emoji: "🚽", words: /\b(wee|toilet|potty|loo|wash (your )?hands|hands)\b/i },
    { key: "dressed",   emoji: "👕", words: /\b(dressed|clothes on|uniform|get dressed)\b/i },
    { key: "pyjamas",   emoji: "🩳", words: /\b(pyjamas|pajamas|pjs|jammies|nightie)\b/i },
    { key: "bed",       emoji: "🛏️", words: /\b(make (your )?bed|bed made|making the bed)\b/i },
    { key: "wakeup",    emoji: "⏰", words: /\b(get up|wake up|up and out|out of bed)\b/i },
    { key: "breakfast", emoji: "🥣", words: /\b(breakfast|cereal|porridge)\b/i },
    { key: "shoes",     emoji: "👟", words: /\b(shoes|trainers|wellies|boots)\b/i },
    { key: "coat",      emoji: "🧥", words: /\b(coat|jacket|hat and gloves)\b/i },
    { key: "bag",       emoji: "🎒", words: /\b(bag|backpack|book bag|school bag)\b/i },
    { key: "bottle",    emoji: "🥤", words: /\b(water bottle|bottle|drink)\b/i },
    { key: "toys",      emoji: "🧸", words: /\b(toys|tidy|tidy up|playroom|bedroom)\b/i },
    { key: "bath",      emoji: "🛁", words: /\b(bath|shower|wash your hair)\b/i },
    { key: "story",     emoji: "📖", words: /\b(story|book|reading)\b/i },
    { key: "lights",    emoji: "🌙", words: /\b(lights out|sleep|bedtime|go to bed)\b/i },
    { key: "prayers",   emoji: "🙏", words: /\b(prayers?|pray)\b/i },
    { key: "pet",       emoji: "🐾", words: /\b(pet|pets|dog|cat|fish|hamster|rabbit|feed the)\b/i },
    { key: "table",     emoji: "🍴", words: /\b(table|plates|cutlery)\b/i },
    { key: "laundry",   emoji: "🧺", words: /\b(wash basket|laundry|washing basket|dirty clothes)\b/i },
    { key: "hair",      emoji: "💇", words: /\b(hair|brush your hair|comb)\b/i },
    { key: "vitamins",  emoji: "💊", words: /\b(vitamins?|medicine)\b/i },
    { key: "music",     emoji: "🎹", words: /\b(piano|violin|guitar|music|recorder|keyboard)\b/i },
    { key: "homework",  emoji: "✏️", words: /\b(homework|spellings|practise|practice)\b/i }
  ];
  const pictureKey = (task) => {
    const t = String((task && task.title) || "");
    const hit = PICTURES.find(p => p.words.test(t));
    return hit ? hit.key : null;
  };
  // The picture for a job: a drawing (js/job-art.js), else its emoji
  function pictureHtml(task) {
    const key = pictureKey(task);
    const art = window.JobArt && key ? window.JobArt.svgFor(key) : "";
    if (art) return art;
    const emoji = (task && task.icon) || (key && PICTURES.find(p => p.key === key).emoji) || (typeof window.detectEmojiForChore === "function" && window.detectEmojiForChore(task.title)) || "⭐";
    return `<span class="pj-emoji" aria-hidden="true">${esc(emoji)}</span>`;
  }
  // Stars instead of points: one per point, up to five (then "5+")
  function starsHtml(task) {
    const n = typeof window.taskPoints === "function" ? window.taskPoints(task) : 1;
    if (!n) return "";
    return `<span class="pj-stars" aria-label="${n} star${n === 1 ? "" : "s"}">${"★".repeat(Math.min(5, n))}${n > 5 ? "+" : ""}</span>`;
  }

  // ---- Reading aloud -----------------------------------------------------------------
  // Clips in the "Leda" voice (scripts/make-voice-clips.mjs, picked by Steven
  // 11 Nov: young and excited) for the ready-made jobs, the cheers and the
  // buddies' lines (js/voice-clips.js). Words with no clip (a job a parent
  // made up) use the phone's own voice: a young-sounding British one where
  // there is one, a little higher and livelier (Steven found the Mac's
  // default, "Daniel", sounded like an old man).
  const FIXED_WORDS = ["Well done!", "Brilliant!", "Great job!", "You did it!", "Super!", "All done! Amazing!", "No jobs right now!"];
  const clipKey = (text) => String(text || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const clipFor = (text) => { const c = window.VOICE_CLIPS || {}; return c[clipKey(text)] || null; };
  let voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const all = window.speechSynthesis.getVoices() || [];
    if (!all.length) return null;
    const en = all.filter(v => /^en/i.test(v.lang));
    const gb = en.filter(v => /^en[-_]GB/i.test(v.lang));
    const OLD = /daniel|grandpa|grandma|arthur|rocko|reed|eddy|fred|ralph|albert|bad news|bahh|bells|boing|bubbles|cellos|jester|organ|trinoids|whisper|zarvox|superstar|wobble|junior/i;
    const YOUNG = /flo|shelley|sandy|kate|serena|stephanie|martha|libby|sonia|amy|emma|google uk english female|female/i;
    return gb.find(v => YOUNG.test(v.name) && !OLD.test(v.name)) || en.find(v => YOUNG.test(v.name) && !OLD.test(v.name))
      || gb.find(v => !OLD.test(v.name)) || en.find(v => !OLD.test(v.name)) || all[0];
  }
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.addEventListener("voiceschanged", () => { voice = pickVoice(); }); } catch (e) {}
  }
  let player = null;
  let queue = [];
  function stop() {
    queue = [];
    try { if (player) { player.pause(); player.onended = null; } } catch (e) {}
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) {}
  }
  function sayWithPhone(text, then) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { then(); return; }
    try {
      const u = new SpeechSynthesisUtterance(String(text));
      voice = voice || pickVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-GB";
      u.rate = 1.0;
      u.pitch = 1.35;
      u.onend = then;
      u.onerror = then;
      window.speechSynthesis.speak(u);
    } catch (e) { then(); }
  }
  function next() {
    const text = queue.shift();
    if (text === undefined) return;
    const clip = clipFor(text);
    if (!clip) { sayWithPhone(text, next); return; }
    try {
      player = player || new Audio();
      player.onended = next;
      player.onerror = () => sayWithPhone(text, next);
      player.src = clip;
      const p = player.play();
      if (p && p.catch) p.catch(() => sayWithPhone(text, next));
    } catch (e) { sayWithPhone(text, next); }
  }
  // Say one thing, or several one after another (a list)
  function speak(words) {
    const list = (Array.isArray(words) ? words : [words]).filter(Boolean).map(String);
    if (!list.length) return false;
    window.__pjLastSpoken = list.join(" "); // for the smoke test
    if (window.__pjMute) return true;
    stop();
    queue = list;
    next();
    return true;
  }
  const CHEERS = ["Well done!", "Brilliant!", "Great job!", "You did it!", "Super!"];
  let lastCheer = -1;
  function cheer() {
    let i = Math.floor(Math.random() * CHEERS.length);
    if (i === lastCheer) i = (i + 1) % CHEERS.length;
    lastCheer = i;
    speak(CHEERS[i]);
  }

  // ---- A card in their column --------------------------------------------------------
  // c: { task, done, actionHtml, attrs, style, classes }: everything the board
  // card has, so ticking, undo and the slide after a tick work the same
  function cardHtml(c) {
    const t = c.task;
    return `
      <div class="skylight-task-card is-picture ${c.classes}" style="${c.style}" ${c.attrs}>
        <button type="button" class="pj-card-pic" data-pj-say="${esc(t.title)}" aria-label="Hear it: ${esc(t.title)}">${pictureHtml(t)}</button>
        <span class="pj-card-title">${esc(t.title)}</span>
        <span class="pj-card-foot">${c.done ? `<span class="pj-card-done">Done!</span>` : starsHtml(t)}</span>
        ${c.actionHtml}
        <button type="button" class="pj-card-edit" data-pj-edit aria-label="Change this job (for grown-ups)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
        </button>
      </div>`;
  }
  // The "▶ My jobs" button under their name
  function openButtonHtml(name) {
    return `<button type="button" class="pj-open-btn" data-pj-open="${esc(name)}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>My jobs</button>`;
  }

  // ---- Ready-made routine ------------------------------------------------------------
  // Agreed with Steven, 11 Nov: the first three groups ticked, extras not
  const STARTER = [
    { group: "Morning", slot: "morning", items: ["Get up", "Wee and wash hands", "Get dressed", "Brush teeth", "Make your bed", "Eat breakfast"] },
    { group: "Out the door", slot: "morning", items: ["Shoes on", "Coat on", "Pack your bag", "Water bottle"] },
    { group: "Bedtime", slot: "evening", items: ["Tidy toys", "Bath", "Pyjamas on", "Brush teeth", "Story time", "Lights out"] },
    { group: "Extras", slot: null, off: true, items: [["Say prayers", "evening"], ["Feed the pet", "anytime"], ["Help set the table", "anytime"], ["Clothes in the wash basket", "evening"]] }
  ];
  const starterItems = () => {
    const out = [];
    STARTER.forEach((g, gi) => g.items.forEach((it, ii) => {
      const [title, slot] = Array.isArray(it) ? it : [it, g.slot];
      out.push({ id: `${gi}-${ii}`, group: g.group, title, slot, on: !g.off });
    }));
    return out;
  };
  // The jobs a ticked routine makes for one person (also used by setup)
  function starterTasks(name, pickedIds, stamp = Date.now()) {
    const items = starterItems().filter(i => pickedIds.has(i.id));
    return items.map((i, n) => {
      const key = PICTURES.find(p => p.words.test(i.title));
      return {
        id: `pic-${lower(name).replace(/[^a-z0-9]+/g, "-")}-${stamp}-${n}`,
        title: i.title, icon: key ? key.emoji : "⭐",
        assignedTo: name,
        taskType: "Daily Task", day: "Daily", date: null, repeat: "daily",
        kind: "routine", routineSlot: i.slot, value: 1,
        order: { morning: 1, afternoon: 2, evening: 4, anytime: 5 }[i.slot] || 4,
        seq: n, // the order in their routine
        done: false, completedBy: null, completedAt: null
      };
    });
  }

  let starterFor = null;
  let starterPicked = new Set();
  function ensureStarterDialog() {
    let dlg = document.getElementById("pj-starter-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "pj-starter-modal";
    dlg.className = "roster-dialog pj-starter-dialog";
    dlg.setAttribute("aria-labelledby", "pj-starter-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-pj-starter-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="pj-starter-title" class="modal-title">A ready-made routine</h2></div>
        <div id="pj-starter-body"></div>
        <div class="modal-footer"><button type="button" class="btn-primary-modal" id="pj-starter-add">Add jobs</button></div>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-pj-starter-close]")) { dlg.close(); return; }
      const row = e.target.closest("[data-pj-item]");
      if (row) {
        const id = row.getAttribute("data-pj-item");
        if (starterPicked.has(id)) starterPicked.delete(id); else starterPicked.add(id);
        renderStarter();
        return;
      }
      if (e.target.closest("#pj-starter-add")) addStarter();
    });
    dlg.addEventListener("close", () => { if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock(); });
    return dlg;
  }
  function renderStarter() {
    const dlg = document.getElementById("pj-starter-modal");
    if (!dlg || !starterFor) return;
    const shown = typeof window.displayMemberName === "function" ? window.displayMemberName(starterFor) : starterFor;
    dlg.querySelector("#pj-starter-title").textContent = `A ready-made routine for ${shown}`;
    const items = starterItems();
    const groups = [...new Set(items.map(i => i.group))];
    dlg.querySelector("#pj-starter-body").innerHTML = `
      <p class="pj-starter-lead">Untick anything that doesn't fit. You can change or add jobs any time.</p>
      ${groups.map(g => `
        <h3 class="pj-starter-group">${esc(g)}</h3>
        <ul class="pj-starter-list">${items.filter(i => i.group === g).map(i => {
          const on = starterPicked.has(i.id);
          return `<li><button type="button" class="pj-starter-item${on ? " is-on" : ""}" data-pj-item="${i.id}" aria-pressed="${on}">
            <span class="pj-starter-pic">${pictureHtml({ title: i.title })}</span>
            <span class="pj-starter-name">${esc(i.title)}</span>
            <span class="pj-starter-box" aria-hidden="true">${on ? "✓" : ""}</span></button></li>`;
        }).join("")}</ul>`).join("")}`;
    const n = starterPicked.size;
    const add = dlg.querySelector("#pj-starter-add");
    add.textContent = n ? `Add ${n} job${n === 1 ? "" : "s"}` : "Pick a job first";
    add.disabled = !n;
  }
  function openStarter(name) {
    if (!name) return;
    starterFor = name;
    starterPicked = new Set(starterItems().filter(i => i.on).map(i => i.id));
    const dlg = ensureStarterDialog();
    renderStarter();
    if (!dlg.open) dlg.showModal();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
  }
  async function addStarter() {
    const dlg = document.getElementById("pj-starter-modal");
    const tasks = starterTasks(starterFor, starterPicked);
    if (!tasks.length) return;
    const add = dlg.querySelector("#pj-starter-add");
    add.disabled = true;
    add.textContent = "Adding…";
    for (const t of tasks) { try { await window.restoreTask(t); } catch (e) { console.warn("Couldn't add a routine job:", e); } }
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(`Added ${tasks.length} picture jobs for ${starterFor}`);
    if (window.sfx && typeof window.sfx.playSuccess === "function") window.sfx.playSuccess();
    dlg.close();
  }

  // ---- Their full-screen view --------------------------------------------------------
  let viewFor = null;
  let focusId = null;  // the job shown big (the next one, unless they tapped another)
  let idleTimer = null;
  let confettiFn = null;
  function todaysJobs(name) {
    if (typeof window.getTasksForColumn !== "function") return [];
    const today = new Date();
    const slots = typeof window.tasksSlotsOn === "function" ? window.tasksSlotsOn(true) : null;
    const slotOf = (t) => t.routineSlot || "chores";
    const showSlot = (k) => !slots || slots.has(k === "anytime" ? "chores" : k);
    const ORDER = { morning: 0, afternoon: 1, evening: 2, anytime: 3, chores: 4 };
    return window.getTasksForColumn(name, today)
      .filter(t => showSlot(slotOf(t)))
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (ORDER[slotOf(a.t)] - ORDER[slotOf(b.t)]) || ((a.t.seq ?? 999) - (b.t.seq ?? 999)) || (a.i - b.i))
      .map(x => x.t);
  }
  const isDone = (t, name) => typeof window.isTaskDoneOnDate === "function" && window.isTaskDoneOnDate(t, new Date(), lower(name));
  const dayName = () => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

  function ensureView() {
    let el = document.getElementById("pj-view");
    if (el) return el;
    el = document.createElement("dialog");
    el.id = "pj-view";
    el.className = "pj-view";
    el.setAttribute("aria-labelledby", "pj-view-title");
    el.innerHTML = `<canvas class="pj-confetti" aria-hidden="true"></canvas><div class="pj-view-inner" id="pj-view-inner"></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", onViewClick);
    el.addEventListener("pointerdown", bumpIdle);
    el.addEventListener("close", () => {
      clearTimeout(idleTimer);
      viewFor = null;
      stop();
      if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
    });
    el.addEventListener("cancel", () => el.close());
    try { if (window.confetti && window.confetti.create) confettiFn = window.confetti.create(el.querySelector(".pj-confetti"), { resize: true }); } catch (e) {}
    return el;
  }
  function bumpIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { const el = document.getElementById("pj-view"); if (el && el.open) el.close(); }, IDLE_MS);
  }
  function goalLine(name) {
    const bal = typeof window.getMemberRewardBalance === "function" ? Math.max(0, Math.floor(window.getMemberRewardBalance(name))) : 0;
    const goals = (window.rewardGoals || []).filter(g => g.member === name);
    const goal = goals.sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0))[0];
    if (!goal) return `<div class="pj-goal"><span class="pj-goal-stars">★ ${bal}</span><span class="pj-goal-words">stars saved up</span></div>`;
    const cost = Math.max(1, Number(goal.cost) || 1);
    const pct = Math.min(100, Math.round((bal / cost) * 100));
    const photo = window.RewardPhotos ? window.RewardPhotos.photoFor(goal) : null;
    return `<div class="pj-goal">
      ${photo ? `<span class="pj-goal-photo" style="background-image:url('${photo}')" aria-hidden="true"></span>` : `<span class="pj-goal-photo is-none" aria-hidden="true">🎁</span>`}
      <span class="pj-goal-main"><span class="pj-goal-words"><strong>★ ${Math.min(bal, cost)} of ${cost}</strong> for ${esc(goal.title)}</span>
        <span class="pj-goal-bar"><span style="width:${pct}%"></span></span></span>
    </div>`;
  }
  function renderView() {
    const el = document.getElementById("pj-view");
    if (!el || !el.open || !viewFor) return;
    const name = viewFor;
    const shown = typeof window.displayMemberName === "function" ? window.displayMemberName(name) : name;
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#0284c7", lightBg: "#e0f2fe" };
    el.style.setProperty("--pj-colour", pal.primary);
    el.style.setProperty("--pj-light", pal.lightBg || "#f1f5f9");
    const jobs = todaysJobs(name);
    const left = jobs.filter(t => !isDone(t, name));
    const done = jobs.filter(t => isDone(t, name));
    if (!left.some(t => t.id === focusId)) focusId = left.length ? left[0].id : null;
    const focus = left.find(t => t.id === focusId);
    const others = left.filter(t => t !== focus);
    const f = typeof window.memberFace === "function" ? window.memberFace(name) : { cls: "", style: "", html: esc(name.charAt(0)) };
    const top = `
      <header class="pj-top">
        <span class="pj-face${f.cls}" style="background:${pal.primary};${f.style}" aria-hidden="true">${f.html}</span>
        <h2 class="pj-title" id="pj-view-title">${esc(shown)}'s jobs</h2>
        <span class="pj-count" aria-label="${done.length} of ${jobs.length} done">${done.length}/${jobs.length}</span>
        <button type="button" class="pj-close" data-pj-close aria-label="Close">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </header>`;
    let main;
    if (!jobs.length) {
      main = `<div class="pj-empty"><button type="button" class="pj-empty-pic" data-pj-say="No jobs right now!" aria-label="No jobs right now">🌈</button><p>No jobs right now!</p></div>`;
    } else if (!focus) {
      main = `<div class="pj-alldone">
          <span class="pj-alldone-face${f.cls}" style="background:${pal.primary};${f.style}" aria-hidden="true">${f.html}</span>
          <p class="pj-alldone-words">All done, ${esc(shown)}!</p>
          <button type="button" class="pj-again" data-pj-say="All done! Amazing!">🔊 Hear it</button>
        </div>`;
    } else {
      main = `
        <section class="pj-next" aria-label="Next job">
          <p class="pj-next-label">${focus === left[0] ? "Next" : "This one"}</p>
          <button type="button" class="pj-next-pic" data-pj-say="${esc(focus.title)}" aria-label="Hear it: ${esc(focus.title)}">${pictureHtml(focus)}
            <span class="pj-hear" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg></span></button>
          <p class="pj-next-title">${esc(focus.title)}</p>
          ${starsHtml(focus)}
          <button type="button" class="pj-tick" data-pj-tick="${esc(focus.id)}" aria-label="Done: ${esc(focus.title)}">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
        </section>`;
    }
    const tile = (t, isDoneTile) => `
      <button type="button" class="pj-tile${isDoneTile ? " is-done" : ""}" ${isDoneTile ? `data-pj-untick="${esc(t.id)}" aria-label="${esc(t.title)}: done. Tap to undo"` : `data-pj-focus="${esc(t.id)}" aria-label="${esc(t.title)}"`}>
        <span class="pj-tile-pic">${pictureHtml(t)}</span>
        ${isDoneTile ? `<span class="pj-tile-tick" aria-hidden="true">✓</span>` : ""}
      </button>`;
    const rows = `
      ${others.length ? `<div class="pj-row"><p class="pj-row-label">Then</p><div class="pj-tiles">${others.map(t => tile(t, false)).join("")}</div></div>` : ""}
      ${done.length ? `<div class="pj-row"><p class="pj-row-label">Done</p><div class="pj-tiles">${done.map(t => tile(t, true)).join("")}</div></div>` : ""}`;
    el.querySelector("#pj-view-inner").innerHTML = `${top}<div class="pj-body">${main}${rows}</div><footer class="pj-foot">${goalLine(name)}</footer>`;
  }
  function openView(name) {
    if (!name) return;
    viewFor = name;
    focusId = null;
    const el = ensureView();
    if (!el.open) el.showModal();
    renderView();
    bumpIdle();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
  }
  function onViewClick(e) {
    const el = document.getElementById("pj-view");
    if (e.target.closest("[data-pj-close]")) { el.close(); return; }
    const say = e.target.closest("[data-pj-say]");
    if (say) { speak(say.getAttribute("data-pj-say")); popEl(say); return; }
    const foc = e.target.closest("[data-pj-focus]");
    if (foc) {
      focusId = foc.getAttribute("data-pj-focus");
      renderView();
      const t = todaysJobs(viewFor).find(x => x.id === focusId);
      if (t) speak(t.title);
      return;
    }
    const tick = e.target.closest("[data-pj-tick]");
    if (tick) { finish(tick.getAttribute("data-pj-tick"), tick); return; }
    const untick = e.target.closest("[data-pj-untick]");
    if (untick && typeof window.handleUndoTask === "function") {
      window.handleUndoTask(untick.getAttribute("data-pj-untick"), dayName(), null, viewFor);
      setTimeout(renderView, 150);
    }
  }
  function popEl(node) {
    if (!node || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    node.classList.remove("is-pop"); void node.offsetWidth; node.classList.add("is-pop");
  }
  function finish(taskId, btn) {
    const name = viewFor;
    if (!name || typeof window.handleCompleteTaskWithCelebration !== "function") return;
    if (btn) btn.classList.add("is-ticked");
    const leftBefore = todaysJobs(name).filter(t => !isDone(t, name)).length;
    window.handleCompleteTaskWithCelebration(taskId, dayName(), name, typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(new Date()) : null);
    // The last one: their buddy says its line (js/buddies.js reads it aloud)
    if (leftBefore > 1) cheer();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && confettiFn) {
      const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : null;
      try { confettiFn({ particleCount: leftBefore > 1 ? 60 : 160, spread: 70, origin: { y: 0.6 }, colors: pal ? [pal.primary, "#facc15", "#ffffff"] : undefined }); } catch (e) {}
    }
    focusId = null;
    setTimeout(renderView, 350);
  }

  // ---- Wiring ------------------------------------------------------------------------
  // On the board: a picture speaks, the pencil opens the job for grown-ups,
  // "My jobs" opens the full-screen view (the tick is the board's own)
  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-pj-open]");
    if (open) { e.stopPropagation(); openView(open.getAttribute("data-pj-open")); return; }
    if (e.target.closest("#pj-view")) return;
    const say = e.target.closest(".skylight-task-card.is-picture [data-pj-say]");
    if (say) { e.stopPropagation(); speak(say.getAttribute("data-pj-say")); popEl(say); }
  }, true);
  document.addEventListener("harmonee:data", () => renderView());

  window.PictureJobs = {
    isOn, setOn, pictureKey, pictureHtml, starsHtml, speak, cheer, cardHtml, openButtonHtml,
    starterItems, starterTasks, openStarter, openView, renderView, PICTURES, FIXED_WORDS, clipKey, clipFor, stop
  };
})();
