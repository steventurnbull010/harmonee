// ============================================================================
// MAGIC IMPORT (js/magic-import.js)
// "📷 Fill in from a photo" in the Add Event panel: take or choose a photo of
// a flyer, invite, school letter or screenshot, and harmonee reads it.
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
  const AI_SWITCHED_ON = false;            // flip once AI Logic and billing are on
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

  const available = () => AI_SWITCHED_ON || typeof window.__SMOKE_AI === "function";

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
  async function schemaFor(ai) {
    const S = ai.Schema;
    return S.object({
      properties: {
        events: S.array({
          items: S.object({
            properties: {
              title: S.string(), date: S.string(), startTime: S.string(), endTime: S.string(),
              allDay: S.boolean(), location: S.string(), notes: S.string(),
              people: S.array({ items: S.string() }), emoji: S.string()
            },
            optionalProperties: ["startTime", "endTime", "location", "notes", "people", "emoji"]
          })
        })
      }
    });
  }

  // ---- Asking Gemini (through Firebase AI Logic) ----------------------------------
  let modelPromise = null;
  async function model() {
    if (!modelPromise) modelPromise = (async () => {
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
        systemInstruction: instructions(),
        // Reading a flyer needs little "thinking", and a short answer: keeps
        // each photo to about a penny (paid Gemini prices, Nov 2026)
        generationConfig: {
          responseMimeType: "application/json", responseSchema: await schemaFor(ai), temperature: 0.1, maxOutputTokens: 2048,
          ...(ai.ThinkingLevel && ai.ThinkingLevel.LOW ? { thinkingConfig: { thinkingLevel: ai.ThinkingLevel.LOW } } : {})
        }
      });
    })().catch(e => { modelPromise = null; throw e; });
    return modelPromise;
  }

  async function askAI(photo) {
    if (typeof window.__SMOKE_AI === "function") return window.__SMOKE_AI(photo);
    const m = await model();
    const res = await m.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: photo.base64 } },
      { text: "Find the events in this photo." }
    ]);
    return JSON.parse(res.response.text());
  }

  function withTimeout(promise) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("That took too long. Check the connection and try again.")), TIMEOUT_MS))]);
  }

  // ---- Checking what came back --------------------------------------------------
  const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  function tidy(answer) {
    const list = Array.isArray(answer && answer.events) ? answer.events : [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const earliest = new Date(today.getTime() - 366 * 86400000), latest = new Date(today.getTime() + 2 * 366 * 86400000);
    const family = people();
    const time = (t) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || "").trim()) ? String(t).trim() : "");
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
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
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

  function reading(photo) {
    show(`
      <div class="magic-import-photo"><img src="${photo.dataUrl}" alt=""><span class="magic-import-scan" aria-hidden="true"></span></div>
      <h2 class="magic-import-title" id="magic-import-title">Reading your photo…</h2>
      <p class="magic-import-lead" role="status">Looking for dates, times and places. This takes a few seconds.</p>
      <div class="magic-import-actions"><button type="button" class="magic-import-btn" data-mi-close>Cancel</button></div>`);
  }

  function problem(text) {
    const dlg = show(`
      <div class="magic-import-mark" aria-hidden="true">🤔</div>
      <h2 class="magic-import-title" id="magic-import-title">${esc(text.title)}</h2>
      <p class="magic-import-lead">${esc(text.lead)}</p>
      <div class="magic-import-actions">
        <button type="button" class="magic-import-btn" data-mi-close>Close</button>
        <button type="button" class="magic-import-btn is-primary" data-mi-again>Try another photo</button>
      </div>`);
    dlg.querySelector("[data-mi-again]").onclick = () => { close(); pickPhoto(); };
  }

  // One event: fill in the Add Event panel to check
  function fillEditor(e) {
    close();
    const day = DAYS[e.when.getDay()];
    if (typeof window.openEventModal !== "function") return;
    window.openEventModal(null, day, e.date, { start: e.allDay ? "09:00" : e.start, duration: durationOf(e) },
      { title: e.title, members: e.people.length ? e.people : null, location: e.location, description: e.notes, icon: e.icon, fromPhoto: true });
  }

  // Several: tick the ones to add
  function chooseMany(list) {
    const dlg = show(`
      <h2 class="magic-import-title" id="magic-import-title">Found ${list.length} events</h2>
      <p class="magic-import-lead">Untick any you don't want. You can change them afterwards on the calendar.</p>
      <ul class="magic-import-list">${list.map((e, i) => `<li>
        <label class="magic-import-row">
          <input type="checkbox" data-mi-pick="${i}" checked>
          <span class="magic-import-emoji" aria-hidden="true">${esc(e.icon || "📅")}</span>
          <span class="magic-import-text"><b>${esc(e.title)}</b><small>${esc(whenText(e))}${e.location ? ` · ${esc(e.location)}` : ""}${e.people.length ? ` · ${esc(e.people.join(" & "))}` : ""}</small></span>
        </label></li>`).join("")}</ul>
      <div class="magic-import-actions">
        <button type="button" class="magic-import-btn" data-mi-close>Cancel</button>
        <button type="button" class="magic-import-btn is-primary" data-mi-add>Add ${list.length} to the calendar</button>
      </div>`);
    const addBtn = dlg.querySelector("[data-mi-add]");
    const picked = () => [...dlg.querySelectorAll("[data-mi-pick]")].filter(c => c.checked).map(c => list[Number(c.getAttribute("data-mi-pick"))]);
    dlg.querySelectorAll("[data-mi-pick]").forEach(c => c.addEventListener("change", () => {
      const n = picked().length;
      addBtn.textContent = n ? `Add ${n} to the calendar` : "Pick at least one";
      addBtn.disabled = !n;
    }));
    addBtn.onclick = () => addAll(picked());
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
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(`📷 Added ${list.length} event${list.length === 1 ? "" : "s"} from your photo`);
    if (window.sfx && window.sfx.playCelebrationChime) window.sfx.playCelebrationChime();
  }

  // ---- Start: choose or take a photo -------------------------------------------------
  function pickPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => { if (input.files && input.files[0]) readPhoto(input.files[0]); });
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
      else chooseMany(events);
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

  window.MagicImport = { available, readPhoto, pickPhoto, _tidy: tidy };
})();
