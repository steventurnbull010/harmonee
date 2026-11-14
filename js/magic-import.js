// ============================================================================
// MAGIC IMPORT (js/magic-import.js)
// "📷 Snap a flyer" in the Calendar's ＋ menu (straight to the camera, like
// Snap a recipe), or "📷 From a photo" in the Add Event panel: a photo of a
// flyer, invite, school letter or screenshot, and harmonee reads it.
//   - One event: the Add Event panel is filled in (title, date, time, place,
//     notes, who it's for, an emoji) to check, then Add as usual.
//   - Several (a term's dates, a fixture list): a tick list, "Add 3 to the
//     calendar"; each can be opened and changed afterwards.
//   - None: says so, with a tip for a better photo.
//
// The reading is done by Google's Gemini through Firebase AI Logic (the
// key stays with Firebase, never in the page). It's off until the board's
// owner switches it on: AI_SWITCHED_ON below, after AI Logic is enabled in
// the Firebase console. Families in the UK may only use the paid Gemini
// service (Google's terms), so switching on needs billing on the project.
//
// The photo is shrunk to 1280px before it's sent, and isn't kept. What comes
// back is checked before it's used: real dates within two years, real
// times, only the board's own people, short plain text (shown escaped).
//
// The smoke test (scripts/smoke-test.mjs) sets window.__SMOKE_AI to answer
// instead of Gemini, so all of this is tested without the real service.
// ============================================================================
(function () {
  // AI Logic, App Check (Fraud Defense key, enforced) and billing are on.
  // Each use has its own switch: recipes from a photo (since 10 Nov) and
  // flyers to events (Snap a flyer, 10 Nov)
  const AI_SWITCHED_ON = { recipe: true, events: true };
  const AI_SDK = "https://www.gstatic.com/firebasejs/12.19.0";
  const MODEL = "gemini-3.8-flash";        // current Flash model on Firebase AI Logic (Nov 2026; gemini-2.5-flash is redirected from 1 Dec)
  const TIMEOUT_MS = 45000;
  const MAX_PX = 1280;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const people = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);

  const available = (kind = "events") => !!AI_SWITCHED_ON[kind] || typeof window.__SMOKE_AI === "function";

  // ---- The photo: shrunk, as JPEG ---------------------------------------------
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const dataUrl = c.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl, base64: dataUrl.split(",")[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo harmonee can read.")); };
      img.src = url;
    });
  }

  // ---- What we ask, and the shape of the answer -----------------------------------
  function instructions() {
    const today = new Date();
    return [
      "You read photos of flyers, invitations, school letters, appointment cards and screenshots for a family calendar.",
      `Today is ${DAYS[today.getDay()]} ${keyOf(today)}. When a date has no year, use the next time that date comes round.`,
      `The family on this calendar: ${people().join(", ") || "(none given)"}. Only put a name in "people" if the photo clearly names that person.`,
      "List every event in the photo with a specific date. Ignore adverts, prices and anything without a date.",
      "title: short and plain, as the family would say it (\"Ava's swimming gala\", not the whole headline). At most 60 characters.",
      "date: YYYY-MM-DD. startTime and endTime: 24-hour HH:MM, or empty if not given. allDay: true if there's no time.",
      "location: the place, as written. notes: anything useful to remember (what to bring, cost, RSVP by), at most 200 characters, else empty.",
      "emoji: one emoji that suits the event.",
      "If the photo has no events, return an empty list."
    ].join("\n");
  }
  // A recipe: a cookbook page, a handwritten card, or a screenshot (js/family-recipes.js)
  function recipeInstructions() {
    return [
      "You read photos of recipes for a family's own recipe collection: a page of a printed cookbook, a handwritten card or note, or a screenshot.",
      "Several photos are pages of the same recipe, in order.",
      "title: the recipe's name as written, at most 80 characters.",
      "servings: how many it serves or makes, if given, else 0. prepMinutes and cookMinutes: whole minutes if given (1 hr = 60), else 0.",
      "mealType: one of breakfast, lunch, dinner, snack, pudding (your best guess; puddings and desserts such as crumbles, tarts and cheesecakes are pudding; cakes, biscuits and bakes are snack).",
      "ingredients: one item per ingredient with its amount as written (\"200g plain flour\", \"2 eggs\").",
      "method: one item per step, in order, in the recipe's own words (only fix obvious spelling).",
      "Leave out page numbers, headings, adverts, nutrition panels and anything that isn't part of this recipe.",
      "If handwriting is hard to read, give your best reading.",
      "emoji: one emoji that suits the dish. isRecipe: false if the photos don't show a recipe."
    ].join("\n");
  }
  async function recipeSchema(ai) {
    const S = ai.Schema;
    return S.object({
      properties: {
        isRecipe: S.boolean(), title: S.string(), servings: S.integer(), prepMinutes: S.integer(), cookMinutes: S.integer(),
        mealType: S.string(), ingredients: S.array({ items: S.string() }), method: S.array({ items: S.string() }), emoji: S.string()
      },
      optionalProperties: ["servings", "prepMinutes", "cookMinutes", "mealType", "emoji"]
    });
  }

  // Each field described, with an example, in a fixed order. Without that
  // (tested live 10 Nov) Gemini often stopped after the first event's start
  // time and filled it with junk ("10:00px"); with it, 3 out of 3 were right.
  async function schemaFor(ai) {
    const S = ai.Schema;
    const order = ["title", "date", "allDay", "startTime", "endTime", "location", "notes", "people", "emoji"];
    return S.object({
      properties: {
        events: S.array({
          items: S.object({
            properties: {
              title: S.string({ description: "Short plain name, at most 60 characters" }),
              date: S.string({ description: "The date as YYYY-MM-DD, e.g. 2026-12-05" }),
              allDay: S.boolean({ description: "true if no time is given" }),
              startTime: S.string({ description: "24-hour time as HH:MM, e.g. 14:00. Empty string if none" }),
              endTime: S.string({ description: "24-hour time as HH:MM, e.g. 16:30. Empty string if none" }),
              location: S.string({ description: "The place as written, or empty" }),
              notes: S.string({ description: "What to bring or remember, or empty" }),
              people: S.array({ items: S.string() }),
              emoji: S.string({ description: "One emoji" })
            },
            optionalProperties: ["startTime", "endTime", "location", "notes", "people", "emoji"],
            propertyOrdering: order
          })
        })
      },
      propertyOrdering: ["events"]
    });
  }

  // ---- Asking Gemini (through Firebase AI Logic) ----------------------------------
  const modelPromises = {};
  async function model(kind = "events") {
    if (!modelPromises[kind]) modelPromises[kind] = (async () => {
      const [appMod, ai] = await Promise.all([import(`${AI_SDK}/firebase-app.js`), import(`${AI_SDK}/firebase-ai.js`)]);
      const cfg = window.DEFAULT_FIREBASE_CONFIG;
      if (!cfg) throw new Error("harmonee isn't connected yet.");
      // Its own app copy (this library is newer than the one the board uses)
      let app = appMod.getApps().find(a => a.name === "harmonee-ai");
      if (!app) {
        app = appMod.initializeApp(cfg, "harmonee-ai");
        // App Check on this copy too (once it's enforced, AI Logic refuses requests without it)
        if (typeof window.appCheckWanted === "function" && window.appCheckWanted() && window.APP_CHECK_SITE_KEY) {
          const ac = await import(`${AI_SDK}/firebase-app-check.js`);
          ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(window.APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
        }
      }
      const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
      return ai.getGenerativeModel(backend, {
        model: MODEL,
        systemInstruction: kind === "recipe" ? recipeInstructions() : instructions(),
        // Reading a flyer needs little "thinking", and a short answer: keeps
        // each photo to about a penny (paid Gemini prices, Nov 2026)
        generationConfig: {
          responseMimeType: "application/json", responseSchema: kind === "recipe" ? await recipeSchema(ai) : await schemaFor(ai),
          temperature: 0.1, maxOutputTokens: kind === "recipe" ? 4096 : 2048,
          ...(ai.ThinkingLevel && ai.ThinkingLevel.LOW ? { thinkingConfig: { thinkingLevel: ai.ThinkingLevel.LOW } } : {})
        }
      });
    })().catch(e => { delete modelPromises[kind]; throw e; });
    return modelPromises[kind];
  }

  // photo: one { base64 } or a list of them; kind: "events" or "recipe"
  async function askAI(photo, kind = "events") {
    const photos = Array.isArray(photo) ? photo : [photo];
    if (typeof window.__SMOKE_AI === "function") return window.__SMOKE_AI(photos[0], kind, photos);
    const m = await model(kind);
    const res = await m.generateContent([
      ...photos.map(p => ({ inlineData: { mimeType: "image/jpeg", data: p.base64 } })),
      { text: kind === "recipe" ? "Read the recipe in these photos." : "Find the events in this photo." }
    ]);
    return JSON.parse(res.response.text());
  }

  // ---- Checking a recipe that came back -------------------------------------------
  function tidyRecipe(a) {
    if (!a || a.isRecipe === false) return null;
    const list = (x, max, each) => (Array.isArray(x) ? x : []).map(v => clean(v, each)).filter(Boolean).slice(0, max);
    const ingredients = list(a.ingredients, 60, 160);
    const instructions = list(a.method, 40, 600);
    const title = clean(a.title, 80);
    if (!title || (!ingredients.length && !instructions.length)) return null;
    const n = (v, max) => { const x = Math.round(Number(v)); return x > 0 && x <= max ? x : null; };
    const meal = String(a.mealType || "").toLowerCase().trim();
    const emoji = String(a.emoji || "").trim();
    return {
      title, ingredients, instructions,
      servings: n(a.servings, 50),
      prepTime: n(a.prepMinutes, 600) ? String(n(a.prepMinutes, 600)) : "",
      cookTime: n(a.cookMinutes, 1440) ? String(n(a.cookMinutes, 1440)) : "",
      mealType: ["breakfast", "lunch", "dinner", "snack", "pudding"].includes(meal) ? meal : meal === "dessert" ? "pudding" : "",
      emoji: emoji && /\p{Extended_Pictographic}/u.test(emoji) && [...emoji].length <= 4 ? emoji : ""
    };
  }

  // Photos of a recipe (up to 3 pages) -> the recipe to check, or null (it says why)
  async function readRecipe(files) {
    const ticket = ++busy;
    let photos;
    try { photos = await Promise.all([...files].slice(0, 3).map(shrink)); }
    catch (err) { problem({ title: "That isn't a photo", lead: err.message }, false); return null; }
    reading(photos[0], "recipe");
    if (window.isOffline && window.isOffline()) { problem({ title: "No internet", lead: "Reading a recipe needs the internet. Try again when you're back online." }, false); return null; }
    try {
      const recipe = tidyRecipe(await withTimeout(askAI(photos, "recipe")));
      if (ticket !== busy) return null; // cancelled while reading
      if (!recipe) { problem({ title: "No recipe found", lead: "Try a closer photo, straight on and in good light, with the ingredients and method in it." }, false); return null; }
      close();
      return recipe;
    } catch (err) {
      if (ticket !== busy) return null;
      console.warn("Magic Import couldn't read the recipe:", err);
      problem({ title: "Couldn't read that one", lead: err && /too long|internet|connected/.test(err.message) ? err.message : "Something went wrong reading the photo. Try again in a moment." }, false);
      return null;
    }
  }

  function withTimeout(promise) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("That took too long. Check the connection and try again.")), TIMEOUT_MS))]);
  }

  // ---- Checking what came back --------------------------------------------------
  const clean = (s, max) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  function tidy(answer) {
    const list = Array.isArray(answer && answer.events) ? answer.events : [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const earliest = new Date(today.getTime() - 366 * 86400000), latest = new Date(today.getTime() + 2 * 366 * 86400000);
    const family = people();
    // "14:00", and also "9:30" or "14:00px" (the time at the start is kept)
    const time = (t) => { const m = String(t || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?!\d)/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""; };
    return list.map(e => {
      const date = String(e && e.date || "").trim();
      const [y, mo, d] = date.split("-").map(Number);
      const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(y, mo - 1, d) : null;
      if (!when || when.getMonth() !== mo - 1 || when < earliest || when > latest) return null;
      const title = clean(e.title, 60);
      if (!title) return null;
      const start = e.allDay ? "" : time(e.startTime);
      const end = start ? time(e.endTime) : "";
      const who = (Array.isArray(e.people) ? e.people : []).map(n => family.find(f => f.toLowerCase() === String(n).trim().toLowerCase())).filter(Boolean);
      const emoji = String(e.emoji || "").trim();
      return {
        title, date, when, start, end, allDay: !start,
        location: clean(e.location, 120), notes: clean(e.notes, 200),
        people: [...new Set(who)],
        icon: emoji && /\p{Extended_Pictographic}/u.test(emoji) && [...emoji].length <= 4 ? emoji : ""
      };
    }).filter(Boolean).slice(0, 20);
  }

  const mins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function durationOf(e) {
    if (e.allDay) return "All Day";
    if (!e.end || mins(e.end) <= mins(e.start)) return "1 hour";
    return typeof window.formatEventDuration === "function" ? window.formatEventDuration(mins(e.end) - mins(e.start)) : "1 hour";
  }
  function whenText(e) {
    const d = e.when;
    const day = `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (e.allDay) return `${day} · All day`;
    const t = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + pad(m) : ""}${h < 12 ? "am" : "pm"}`; };
    return `${day} · ${t(e.start)}${e.end ? `–${t(e.end)}` : ""}`;
  }

  // ---- On screen --------------------------------------------------------------------
  function sheet() {
    let dlg = document.getElementById("magic-import");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "magic-import";
    dlg.className = "magic-import-dialog";
    dlg.setAttribute("aria-labelledby", "magic-import-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      // Esc on the full-size photo goes back to the list
      const full = dlg.querySelector("[data-mi-photo-full]:not([hidden])");
      if (full) full.hidden = true; else close();
    });
    return dlg;
  }
  let busy = 0; // counts each read, so a cancelled one is ignored when it returns
  function close() {
    busy++;
    const dlg = document.getElementById("magic-import");
    if (dlg && dlg.open) dlg.close();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
  }
  function show(html) {
    const dlg = sheet();
    dlg.innerHTML = `<div class="magic-import-card">${html}</div>`;
    if (!dlg.open) dlg.showModal();
    dlg.querySelectorAll("[data-mi-close]").forEach(b => { b.onclick = close; });
    return dlg;
  }

  function reading(photo, kind = "events") {
    show(`
      <div class="magic-import-photo"><img src="${photo.dataUrl}" alt=""><span class="magic-import-scan" aria-hidden="true"></span></div>
      <h2 class="magic-import-title" id="magic-import-title">${kind === "recipe" ? "Reading your recipe…" : "Reading your photo…"}</h2>
      <p class="magic-import-lead" role="status">${kind === "recipe" ? "Looking for the ingredients and method. This takes a few seconds." : "Looking for dates, times and places. This takes a few seconds."}</p>
      <div class="magic-import-actions"><button type="button" class="magic-import-btn" data-mi-close>Cancel</button></div>`);
  }

  function problem(text, again = true) {
    const dlg = show(`
      <div class="magic-import-mark" aria-hidden="true">🤔</div>
      <h2 class="magic-import-title" id="magic-import-title">${esc(text.title)}</h2>
      <p class="magic-import-lead">${esc(text.lead)}</p>
      <div class="magic-import-actions">
        <button type="button" class="magic-import-btn" data-mi-close>Close</button>
        ${again ? `<button type="button" class="magic-import-btn is-primary" data-mi-again>Try another photo</button>` : ""}
      </div>`);
    const againBtn = dlg.querySelector("[data-mi-again]");
    if (againBtn) againBtn.onclick = () => { close(); pickPhoto(); };
  }

  // One event: fill in the Add Event panel to check
  function fillEditor(e) {
    close();
    const day = DAYS[e.when.getDay()];
    if (typeof window.openEventModal !== "function") return;
    window.openEventModal(null, day, e.date, { start: e.allDay ? "09:00" : e.start, duration: durationOf(e) },
      { title: e.title, members: e.people.length ? e.people : null, location: e.location, description: e.notes, icon: e.icon, fromPhoto: true });
  }

  // Several: check them before adding (14 Nov, from Steven: ten events from
  // a fixture list shouldn't mean opening ten events to say who they're for).
  // - "Who are these for?" sets everyone the photo didn't name, in one tap
  // - each event has its own faces, for the odd one that's different
  // - tap an event's name to fix the name, date, time or place in place
  // - the photo at the top, to check against; nothing is saved until Add
  function chooseMany(found, photo) {
    const family = people();
    const list = found.map(e => ({ ...e, picked: true, own: e.people.length > 0 }));
    let forAll = []; // who the events without their own people are for (none: the family)
    const whoOf = (e) => e.own ? e.people : forAll;
    const colour = (n) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(n).primary : "#0284c7");
    const face = (n, on, attr, small) => `<button type="button" class="mi-face${small ? " is-small" : ""}${on ? " is-on" : ""}" ${attr} aria-pressed="${on}" style="--mi-face: ${colour(n)};" aria-label="${esc(n)}" title="${esc(n)}">${esc(n.charAt(0).toUpperCase())}</button>`;
    const summary = (e) => `${esc(whenText(e))}${e.location ? ` · ${esc(e.location)}` : ""}`;
    const rowFaces = (e, i) => family.length
      ? family.map(n => face(n, whoOf(e).includes(n), `data-mi-who="${i}" data-name="${esc(n)}"`, true)).join("") + (whoOf(e).length ? "" : `<span class="mi-family">Family</span>`)
      : "";
    const editor = (e, i) => `
      <div class="mi-edit" data-mi-editor="${i}" hidden>
        <label class="mi-field mi-field-wide"><span>Name</span><input type="text" id="mi-title-${i}" data-mi-field="title" maxlength="60" value="${esc(e.title)}"></label>
        <label class="mi-field"><span>Date</span><input type="date" id="mi-date-${i}" data-mi-field="date" value="${esc(e.date)}"></label>
        <label class="mi-allday"><input type="checkbox" id="mi-allday-${i}" data-mi-field="allDay" ${e.allDay ? "checked" : ""}> All day</label>
        <label class="mi-field" data-mi-times><span>Starts</span><input type="time" id="mi-start-${i}" data-mi-field="start" value="${esc(e.start)}" ${e.allDay ? "disabled" : ""}></label>
        <label class="mi-field" data-mi-times><span>Ends</span><input type="time" id="mi-end-${i}" data-mi-field="end" value="${esc(e.end)}" ${e.allDay ? "disabled" : ""}></label>
        <label class="mi-field mi-field-wide"><span>Place</span><input type="text" id="mi-place-${i}" data-mi-field="location" maxlength="120" value="${esc(e.location)}" placeholder="Optional"></label>
        <button type="button" class="magic-import-btn mi-done" data-mi-done="${i}">Done</button>
      </div>`;
    const dlg = show(`
      <div class="mi-review-head">
        ${photo ? `<button type="button" class="mi-thumb" data-mi-photo aria-label="See your photo full size"><img src="${photo.dataUrl}" alt=""></button>` : ""}
        <div class="mi-review-title">
          <h2 class="magic-import-title" id="magic-import-title">Found ${list.length} events</h2>
          <p class="magic-import-lead">Check them against your photo. Tap a name to change it.</p>
        </div>
      </div>
      ${family.length ? `<div class="mi-who-all" role="group" aria-labelledby="mi-who-label">
        <span class="mi-who-label" id="mi-who-label">Who are these for?</span>
        <div class="mi-faces" data-mi-allfaces>${family.map(n => face(n, false, `data-mi-all data-name="${esc(n)}"`)).join("")}
          <button type="button" class="mi-everyone is-on" data-mi-everyone aria-pressed="true">Everyone</button></div>
      </div>` : ""}
      <ul class="magic-import-list">${list.map((e, i) => `<li class="mi-item" data-mi-item="${i}">
        <div class="magic-import-row">
          <input type="checkbox" data-mi-pick="${i}" checked aria-label="Add ${esc(e.title)}">
          <span class="magic-import-emoji" aria-hidden="true">${esc(e.icon || "📅")}</span>
          <button type="button" class="mi-open magic-import-text" data-mi-edit="${i}" aria-expanded="false"><b data-mi-name>${esc(e.title)}</b><small data-mi-when>${summary(e)}</small></button>
          <span class="mi-faces mi-row-faces" data-mi-faces="${i}">${rowFaces(e, i)}</span>
        </div>
        ${editor(e, i)}
      </li>`).join("")}</ul>
      <div class="magic-import-actions">
        <button type="button" class="magic-import-btn" data-mi-close>Cancel</button>
        <button type="button" class="magic-import-btn is-primary" data-mi-add>Add ${list.length} to the calendar</button>
      </div>
      ${photo ? `<button type="button" class="mi-photo-full" data-mi-photo-full hidden aria-label="Close your photo"><img src="${photo.dataUrl}" alt="Your photo"></button>` : ""}`);
    // Listen on this card (new each time), not the dialog, which is reused
    const card = dlg.querySelector(".magic-import-card");
    const addBtn = dlg.querySelector("[data-mi-add]");
    const picked = () => list.filter(e => e.picked);
    const refreshCount = () => {
      const n = picked().length;
      addBtn.textContent = n ? `Add ${n} to the calendar` : "Pick at least one";
      addBtn.disabled = !n;
    };
    const refreshFaces = () => {
      list.forEach((e, i) => { const box = dlg.querySelector(`[data-mi-faces="${i}"]`); if (box) box.innerHTML = rowFaces(e, i); });
      dlg.querySelectorAll("[data-mi-all]").forEach(b => { const on = forAll.includes(b.getAttribute("data-name")); b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
      const every = dlg.querySelector("[data-mi-everyone]");
      if (every) { every.classList.toggle("is-on", !forAll.length); every.setAttribute("aria-pressed", !forAll.length); }
    };
    const openEditor = (i, open) => {
      list.forEach((_, j) => {
        const ed = dlg.querySelector(`[data-mi-editor="${j}"]`), btn = dlg.querySelector(`[data-mi-edit="${j}"]`);
        const show = j === i && open;
        ed.hidden = !show; btn.setAttribute("aria-expanded", show);
        dlg.querySelector(`[data-mi-item="${j}"]`).classList.toggle("is-editing", show);
      });
      if (open) { const f = dlg.querySelector(`#mi-title-${i}`); if (f) f.focus({ preventScroll: true }); dlg.querySelector(`[data-mi-item="${i}"]`).scrollIntoView({ block: "nearest" }); }
    };
    card.addEventListener("change", (ev) => {
      const pick = ev.target.closest("[data-mi-pick]");
      if (pick) { list[Number(pick.getAttribute("data-mi-pick"))].picked = pick.checked; refreshCount(); }
    });
    // Typing in an event's boxes changes it straight away (its line updates)
    const onField = (ev) => {
      const f = ev.target.closest("[data-mi-field]");
      if (!f) return;
      const i = Number(f.closest("[data-mi-editor]").getAttribute("data-mi-editor")), e = list[i], k = f.getAttribute("data-mi-field");
      if (k === "title") { const t = clean(f.value, 60); if (t) e.title = t; }
      else if (k === "location") e.location = clean(f.value, 120);
      else if (k === "date") {
        const [y, mo, d] = String(f.value).split("-").map(Number);
        if (y && mo && d) { e.date = f.value; e.when = new Date(y, mo - 1, d); }
      } else if (k === "allDay") {
        e.allDay = f.checked;
        dlg.querySelectorAll(`[data-mi-editor="${i}"] [data-mi-times] input`).forEach(t => { t.disabled = f.checked; });
        if (!f.checked && !e.start) { e.start = "09:00"; dlg.querySelector(`#mi-start-${i}`).value = "09:00"; }
      } else if (k === "start") { e.start = f.value || ""; if (!e.start) { e.allDay = true; dlg.querySelector(`#mi-allday-${i}`).checked = true; } if (e.end && e.start && mins(e.end) <= mins(e.start)) e.end = ""; }
      else if (k === "end") e.end = e.start ? (f.value || "") : "";
      const item = dlg.querySelector(`[data-mi-item="${i}"]`);
      item.querySelector("[data-mi-name]").textContent = e.title;
      item.querySelector("[data-mi-when]").innerHTML = summary(e);
      item.querySelector("[data-mi-pick]").setAttribute("aria-label", `Add ${e.title}`);
    };
    card.addEventListener("input", onField);
    card.addEventListener("change", onField);
    card.addEventListener("click", (ev) => {
      const t = ev.target;
      const all = t.closest("[data-mi-all]");
      if (all) { const n = all.getAttribute("data-name"); forAll = forAll.includes(n) ? forAll.filter(x => x !== n) : family.filter(x => x === n || forAll.includes(x)); refreshFaces(); return; }
      if (t.closest("[data-mi-everyone]")) { forAll = []; refreshFaces(); return; }
      const who = t.closest("[data-mi-who]");
      if (who) {
        const e = list[Number(who.getAttribute("data-mi-who"))], n = who.getAttribute("data-name");
        const now = whoOf(e);
        e.people = now.includes(n) ? now.filter(x => x !== n) : family.filter(x => x === n || now.includes(x));
        e.own = true;
        refreshFaces();
        return;
      }
      const edit = t.closest("[data-mi-edit]");
      if (edit) { const i = Number(edit.getAttribute("data-mi-edit")); openEditor(i, edit.getAttribute("aria-expanded") !== "true"); return; }
      const done = t.closest("[data-mi-done]");
      if (done) { const i = Number(done.getAttribute("data-mi-done")); openEditor(i, false); dlg.querySelector(`[data-mi-edit="${i}"]`).focus({ preventScroll: true }); return; }
      if (t.closest("[data-mi-photo]")) { const full = dlg.querySelector("[data-mi-photo-full]"); full.hidden = false; full.focus(); return; }
      if (t.closest("[data-mi-photo-full]")) { t.closest("[data-mi-photo-full]").hidden = true; return; }
    });
    addBtn.onclick = () => addAll(picked().map(e => ({ ...e, people: whoOf(e) })));
  }

  function addAll(list) {
    if (!list.length) return;
    if (!Array.isArray(window.familyEvents)) window.familyEvents = typeof window.loadFamilyEvents === "function" ? window.loadFamilyEvents() : [];
    const stamp = Date.now();
    list.forEach((e, i) => window.familyEvents.push({
      id: `evt_${stamp}_${i}`, title: e.title, date: e.date, day: DAYS[e.when.getDay()],
      time: e.allDay ? "09:00" : e.start, duration: durationOf(e), repeat: "none",
      member: e.people.length ? e.people.join(" & ") : "Family",
      description: e.notes, location: e.location, icon: e.icon || "📅", category: "Other"
    }));
    if (typeof window.saveFamilyEvents === "function") window.saveFamilyEvents(window.familyEvents);
    if (typeof window.renderWeekCalendar === "function") window.renderWeekCalendar();
    if (typeof window.refreshCountdowns === "function") window.refreshCountdowns();
    if (typeof window.celebrateFirst === "function") window.celebrateFirst("event");
    close();
    // Close the Add Event panel it was started from (its own close button)
    const ev = document.getElementById("event-modal");
    if (ev && ev.open) { const x = document.getElementById("btn-close-event-modal"); if (x) x.click(); }
    // "Added 3 events" with Show me, like "Recipe saved" with View recipe
    const first = list.map(e => e.date).sort()[0];
    const showMe = () => {
      if (typeof window.switchSkylightView === "function" && window.currentActiveView !== "calendar") window.switchSkylightView("calendar");
      if (typeof window.setCalendarView === "function") window.setCalendarView(window.currentCalendarView || "week", first);
    };
    if (typeof window.showActionToast === "function") {
      window.showActionToast({ icon: "📷", title: `Added ${list.length} event${list.length === 1 ? "" : "s"}`, text: "From your photo", action: { label: "Show me", onClick: showMe }, ms: 10000 });
    } else if (typeof window.showCalendarToast === "function") window.showCalendarToast(`📷 Added ${list.length} event${list.length === 1 ? "" : "s"} from your photo`);
    if (window.sfx && window.sfx.playCelebrationChime) window.sfx.playCelebrationChime();
  }

  // ---- Start: choose or take a photo -------------------------------------------------
  function pickPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    // In the page (some browsers won't open a file box that isn't), inside the
    // Add Event panel if it's open, and its click kept to itself (as the
    // recipe photo does, js/family-recipes.js)
    input.addEventListener("click", (e) => e.stopPropagation());
    const panel = document.getElementById("event-modal");
    (panel && panel.open ? panel : document.body).appendChild(input);
    input.addEventListener("cancel", () => input.remove());
    input.addEventListener("change", () => { input.remove(); if (input.files && input.files[0]) readPhoto(input.files[0]); });
    input.click();
  }

  async function readPhoto(file) {
    const ticket = ++busy;
    let photo;
    try { photo = await shrink(file); }
    catch (err) { problem({ title: "That isn't a photo", lead: err.message }); return; }
    reading(photo);
    if (window.isOffline && window.isOffline()) { problem({ title: "No internet", lead: "Reading a photo needs the internet. Try again when you're back online." }); return; }
    try {
      const events = tidy(await withTimeout(askAI(photo)));
      if (ticket !== busy) return; // cancelled while reading
      if (!events.length) problem({ title: "No dates found", lead: "Try a closer photo, straight on, with the date and time in it." });
      else if (events.length === 1) fillEditor(events[0]);
      else chooseMany(events, photo);
    } catch (err) {
      if (ticket !== busy) return;
      console.warn("Magic Import couldn't read the photo:", err);
      problem({ title: "Couldn't read that one", lead: err && /too long|internet|connected/.test(err.message) ? err.message : "Something went wrong reading the photo. Try again in a moment." });
    }
  }

  // The button in the Add Event panel
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-event-from-photo")) { e.preventDefault(); pickPhoto(); }
  });

  window.MagicImport = { available, readPhoto, pickPhoto, readRecipe, _tidy: tidy, _tidyRecipe: tidyRecipe };
})();
