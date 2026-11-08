// ============================================================================
// VOICE (js/voice.js)
// "🎤 Say it": the browser's own speech-to-text (British English) plus the
// phrase rules in js/voice-intent.js. No AI and no extra cost.
//
// - Shopping / list items are added straight away, with Undo
// - Events and tasks open their panel filled in, to check and save
// - Meals open the Plan Meal panel ("We're having tacos tonight")
// - Removing ("Cancel the dentist on Tuesday", "Take milk off the list"):
//   list items go straight away with Undo; events, tasks and meals are shown
//   to confirm first, then can be put back with Undo
// - Anything unclear: "I heard …" with Add as event / Add to shopping list / Plan for dinner / Try again
//
// Mic buttons: "Add by voice" on Today at a glance ([data-voice-intro]: a first
// screen with examples, then "Tap to talk"), plus a small mic
// added to the event, task and quick-list panels. They are hidden where the
// browser can't do speech (Firefox) or the microphone is blocked.
// ============================================================================
(function () {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let blocked = false;
  const supported = () => !!Rec && !blocked && window.isSecureContext !== false;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const MIC_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0"></path><line x1="12" y1="17" x2="12" y2="22"></line></svg>`;

  // A blocked microphone: hide the mics rather than fail every time
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "microphone" }).then(p => {
        const apply = () => { blocked = p.state === "denied"; document.body.classList.toggle("voice-off", !supported()); };
        apply();
        p.onchange = apply;
      }).catch(() => {});
    }
  } catch (e) {}
  const markSupport = () => document.body.classList.toggle("voice-off", !supported());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markSupport); else markSupport();

  // ---- The listening sheet ------------------------------------------------------
  let rec = null, mode = null, sheet = null, closeTimer = null, listenTimer = null;

  function getSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("dialog");
    sheet.id = "voice-dialog";
    sheet.className = "voice-dialog";
    sheet.setAttribute("aria-labelledby", "voice-title");
    document.body.appendChild(sheet);
    sheet.addEventListener("cancel", (e) => { e.preventDefault(); stop(); });
    // "Type it instead": the same words go through the same steps as speech
    sheet.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-voice-typed]");
      if (!form) return;
      e.preventDefault();
      const text = (form.querySelector("input").value || "").trim();
      if (text) handle(text);
    });
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest("[data-voice-close]")) { stop(); return; }
      if (e.target.closest("[data-voice-again]") || e.target.closest("[data-voice-talk]")) { start(mode); return; }
      if (e.target.closest("[data-voice-type]")) { typeIt("Type it instead", "", ""); return; }
      if (e.target.closest("[data-voice-done]")) { if (rec) { try { rec.stop(); } catch (err) {} } return; }
      const as = e.target.closest("[data-voice-as]");
      if (as) { act(window.VoiceIntent.parse(sheet._heard || "", ctx({ ...mode, want: as.getAttribute("data-voice-as") })), sheet._heard); return; }
      if (e.target.closest("[data-voice-undo]") && typeof sheet._undo === "function") { sheet._undo(); sheet._undo = null; return; }
      if (e.target.closest("[data-voice-groc]") && sheet._groc) { const g = sheet._groc; sheet._groc = null; stop(); window.MealGroceries.askRemove(g.meal, g.dateStr, g.slot); return; }
      const pick = e.target.closest("[data-voice-pick]");
      if (pick) { clearTimeout(closeTimer); removePicked(pick.getAttribute("data-voice-pick")); return; }
    });
    return sheet;
  }
  function draw(html) {
    const d = getSheet();
    d.innerHTML = `<div class="voice-card">${html}</div>`;
    if (!d.open) d.showModal();
  }
  const closeBtn = `<button type="button" class="voice-x" data-voice-close aria-label="Close">✕</button>`;

  function drawListening(words) {
    const hint = mode && mode.want === "list" ? "Say what you need, like “milk and bread”"
      : mode && mode.want === "event" ? "Like “Dentist on Tuesday at 4”"
      : mode && mode.want === "task" ? "Like “Ava to tidy her room on Saturday”"
      : "Like “Add milk to the shopping list”, “Swimming every Saturday at 10” or “We're having tacos tonight”";
    draw(`${closeBtn}
      <span class="voice-mic is-live" aria-hidden="true">${MIC_SVG}</span>
      <h2 class="voice-title" id="voice-title">${words ? "Listening…" : "I'm listening"}</h2>
      <p class="voice-words${words ? "" : " is-hint"}" aria-live="polite">${words ? esc(words) : hint}</p>
      <div class="voice-actions"><button type="button" class="voice-btn is-primary" data-voice-done>Done</button></div>`);
  }

  // "Add by voice" on Today at a glance: a calm first screen with examples;
  // nothing records until "Tap to talk" (panel mics start straight away)
  function intro(opts = {}) {
    clearTimeout(closeTimer);
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    mode = opts || {};
    const names = (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
    const who = names.length ? names[names.length - 1] : "Ava";
    const examples = [
      ["Add milk and eggs to the shopping list", "Shopping list"],
      ["Swimming every Saturday at 10", "Calendar"],
      [`${who} needs to tidy their room on Saturday`, "Tasks"],
      ["We're having tacos on Friday", "Meals"],
      ["Cancel the dentist on Tuesday", "Removes it (asks first)"]
    ];
    draw(`${closeBtn}
      <h2 class="voice-title is-intro" id="voice-title">Add by voice</h2>
      <p class="voice-words is-hint">Tap the button, then say something like:</p>
      <ul class="voice-examples">${examples.map(([say, where]) => `<li><span class="voice-ex-say">“${esc(say)}”</span><span class="voice-ex-where">${esc(where)}</span></li>`).join("")}</ul>
      <button type="button" class="voice-talk" data-voice-talk><span class="voice-talk-icon" aria-hidden="true">${MIC_SVG}</span>Tap to talk</button>
      <button type="button" class="voice-type-link" data-voice-type>⌨️ Type instead</button>
      <p class="voice-small voice-intro-foot">Events, tasks and meals open for you to check before they're saved.</p>`);
    setTimeout(() => { try { sheet.querySelector("[data-voice-talk]").focus({ preventScroll: true }); } catch (e) {} }, 50);
  }

  function drawMessage(title, text, buttons) {
    draw(`${closeBtn}
      <span class="voice-mic" aria-hidden="true">${MIC_SVG}</span>
      <h2 class="voice-title" id="voice-title">${esc(title)}</h2>
      ${text ? `<p class="voice-words">${text}</p>` : ""}
      <div class="voice-actions">${buttons || ""}</div>`);
  }

  // A box to type what you'd have said ("Add milk to the shopping list"):
  // works with no connection, since only turning speech into words needs it
  function typeIt(title, text, words) {
    clearTimeout(closeTimer);
    clearTimeout(listenTimer);
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    const eg = mode && mode.want === "list" ? "Like “milk and bread”"
      : mode && mode.want === "event" ? "Like “Dentist on Tuesday at 4”"
      : mode && mode.want === "task" ? "Like “Ava to tidy her room on Saturday”"
      : "Like “Add milk to the shopping list”";
    draw(`${closeBtn}
      <span class="voice-mic is-keys" aria-hidden="true">⌨️</span>
      <h2 class="voice-title" id="voice-title">${esc(title)}</h2>
      ${text ? `<p class="voice-words">${esc(text)}</p>` : ""}
      <form class="voice-typed" data-voice-typed>
        <input type="text" value="${esc(words || "")}" placeholder="${esc(eg)}" aria-label="What to add" autocomplete="off" enterkeyhint="go">
        <button type="submit" class="voice-btn is-primary">Add</button>
      </form>
      ${window.isOffline && window.isOffline() ? "" : `<div class="voice-actions"><button type="button" class="voice-btn" data-voice-again>🎤 Try speaking again</button></div>`}`);
    setTimeout(() => { try { const i = sheet.querySelector("[data-voice-typed] input"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} }, 60);
  }

  function stop() {
    clearTimeout(closeTimer);
    clearTimeout(listenTimer);
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    if (sheet && sheet.open) sheet.close();
  }

  // ---- Listening -----------------------------------------------------------------
  // opts: { want: "list" | "event" | "task" | null, listId }
  function start(opts = {}) {
    if (!Rec) return;
    clearTimeout(closeTimer);
    clearTimeout(listenTimer);
    if (rec) { try { rec.abort(); } catch (e) {} }
    mode = opts || {};
    // No connection: the browser can't turn speech into words, so go
    // straight to typing (adding still works offline)
    if (window.isOffline && window.isOffline()) {
      typeIt("You're offline", "Speech needs the internet, but you can type it and harmonee does the rest.", "");
      return;
    }
    const r = new Rec();
    rec = r;
    r.lang = "en-GB";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "", interimText = "", heardAnything = false;
    drawListening("");
    // On a weak signal speech can hang with no error at all. Nothing heard
    // in 8 seconds: offer typing. Words heard but the rest never arrives:
    // keep them in the box to finish off.
    const giveUp = () => {
      if (rec !== r) return;
      rec = null;
      try { r.abort(); } catch (e) {}
      const got = (finalText + " " + interimText).trim();
      if (got) typeIt("Is this right?", "The connection is slow, so check the words and tap Add.", got);
      else typeIt("This is taking a while", "The connection looks slow. Type it instead, or try speaking again.", "");
    };
    listenTimer = setTimeout(giveUp, 8000);
    r.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      heardAnything = true;
      interimText = interim;
      clearTimeout(listenTimer);
      listenTimer = setTimeout(giveUp, 5000); // still waiting 5s after the last word
      if (rec === r) drawListening((finalText + " " + interim).trim());
    };
    r.onerror = (e) => {
      if (rec !== r) return;
      rec = null;
      clearTimeout(listenTimer);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        blocked = true;
        markSupport();
        drawMessage("harmonee can't hear you", "The microphone is switched off for this page. Allow it in the browser's site settings, then try again.", `<button type="button" class="voice-btn" data-voice-close>OK</button>`);
      } else if (e.error === "no-speech" || e.error === "aborted") {
        drawMessage("I didn't catch that", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn" data-voice-type>⌨️ Type it</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      } else if (e.error === "network") {
        typeIt("The signal dropped", "Speech needs the internet. Type it instead (it still saves offline), or try again.", (finalText + " " + interimText).trim());
      } else {
        drawMessage("Something went wrong", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn" data-voice-type>⌨️ Type it</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      }
    };
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      clearTimeout(listenTimer);
      const text = finalText.trim();
      if (!text) {
        if (!heardAnything) drawMessage("I didn't catch that", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn" data-voice-type>⌨️ Type it</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
        else stop();
        return;
      }
      handle(text);
    };
    try { r.start(); } catch (e) { rec = null; }
  }

  function ctx(extra = {}) {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    const members = (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
    return { now: new Date(), members, lists: lists.map(l => ({ id: l.id, title: l.title })), want: extra.want || null, listId: extra.listId || null };
  }

  function handle(text) {
    getSheet()._heard = text;
    act(window.VoiceIntent.parse(text, ctx(mode)), text);
  }

  // ---- Doing it ------------------------------------------------------------------
  function act(intent, heard) {
    const quote = `“${esc(heard)}”`;
    if (intent.kind === "list") return addToList(intent, quote);
    if (intent.kind === "event") return openEvent(intent);
    if (intent.kind === "task") return openTask(intent);
    if (intent.kind === "meal") return openMeal(intent);
    if (intent.kind === "remove") return intent.target === "list" ? removeFromList(intent, quote) : findToRemove(intent, quote);
    drawMessage("I heard", quote, `
      <button type="button" class="voice-btn" data-voice-as="event">📅 Add as event</button>
      <button type="button" class="voice-btn" data-voice-as="list">🛒 Add to shopping list</button>
      <button type="button" class="voice-btn" data-voice-as="meal">🍽️ Plan for dinner</button>
      <button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
  }

  function addToList(intent, quote) {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    const list = lists.find(l => l.id === intent.listId) || lists.find(l => l.id === "groceries") || lists[0];
    if (!list || typeof window.addTextsToList !== "function") { drawMessage("There's no list to add to yet", "", `<button type="button" class="voice-btn" data-voice-close>OK</button>`); return; }
    const items = intent.items.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const res = window.addTextsToList(list.id, items);
    if (typeof sfx !== "undefined" && sfx && sfx.playClick) sfx.playClick();
    const names = (arr) => { const t = arr.map(i => esc(i.text)); return t.length > 1 ? `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}` : t[0]; };
    const lines = [];
    if (res.added.length) lines.push(`<strong>${names(res.added)}</strong> added to ${esc(list.title)}`);
    if (res.back.length) lines.push(`<strong>${names(res.back)}</strong> back on ${esc(list.title)}`);
    if (res.already.length) lines.push(`<strong>${names(res.already)}</strong> already on ${esc(list.title)}`);
    const canUndo = res.added.length || res.back.length;
    getSheet()._undo = canUndo ? () => {
      if (res.added.length) window.mutateFamilyLists({ type: "deleteItems", listId: list.id, itemIds: res.added.map(i => i.id) });
      res.back.forEach(i => window.mutateFamilyLists({ type: "toggleItem", listId: list.id, itemId: i.id, checked: true }));
      refreshAfterList();
      drawMessage("Undone", `Nothing added to ${esc(list.title)}`, `<button type="button" class="voice-btn is-primary" data-voice-close>OK</button>`);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(stop, 2500);
    } : null;
    refreshAfterList();
    drawMessage(canUndo ? "Done ✓" : "Already there", lines.join("<br>"), `
      ${canUndo ? `<button type="button" class="voice-btn" data-voice-undo>Undo</button>` : ""}
      <button type="button" class="voice-btn" data-voice-again>🎤 Add more</button>
      <button type="button" class="voice-btn is-primary" data-voice-close>Done</button>`);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(stop, 6000);
  }
  function refreshAfterList() {
    if (typeof window.renderListsView === "function") { try { window.renderListsView(); } catch (e) {} }
    document.dispatchEvent(new CustomEvent("harmonee:voice-change"));
  }

  const dateKey = (d) => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(d) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  const toMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  // Editing something that's already saved: the mic only changes its title
  function retitle(inputId, title) {
    const input = document.getElementById(inputId);
    if (!input || !title) return;
    input.value = title;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function openEvent(intent) {
    stop();
    const modal = document.getElementById("event-modal");
    if (modal && modal.open && (document.getElementById("event-id-input") || {}).value) { retitle("event-title-input", intent.title); return; }
    if (typeof window.openEventModal !== "function") return;
    const length = (mins) => (typeof window.formatEventDuration === "function" ? window.formatEventDuration(mins) : "1 hour");
    let slot;
    if (intent.allDay) slot = { duration: "All Day" };
    else if (intent.start) {
      let len = toMins(intent.end) - toMins(intent.start);
      if (len <= 0) len += 24 * 60;
      slot = { start: intent.start, duration: length(len) };
    } else {
      // No time said: an hour. Today, the panel's next half hour; another day, 9am
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const sameDay = intent.date && new Date(intent.date).setHours(0, 0, 0, 0) === today.getTime();
      slot = sameDay ? { duration: length(intent.length || 60) } : { start: "09:00", duration: length(intent.length || 60) };
    }
    window.openEventModal(null, null, dateKey(intent.date), slot, { title: intent.title, members: intent.members, repeat: intent.repeat });
  }

  function openTask(intent) {
    stop();
    if (typeof window.openSkylightTaskDrawer !== "function") return;
    const prefill = { title: intent.title, people: intent.people, date: intent.date || new Date(), daily: intent.daily, weekly: intent.weekly, slot: intent.slot };
    const overlay = document.getElementById("skylight-task-drawer-overlay");
    const drawerOpen = overlay && overlay.style.display && overlay.style.display !== "none";
    if (drawerOpen && (document.getElementById("drawer-task-id") || {}).value) { retitle("drawer-task-title", intent.title); return; }
    if (drawerOpen) { window.openSkylightTaskDrawer(null, prefill); return; }
    // The task panel sits on the Tasks page
    if (typeof window.closeTodayScreen === "function") window.closeTodayScreen();
    if (typeof window.switchSkylightView === "function") window.switchSkylightView("chores");
    setTimeout(() => window.openSkylightTaskDrawer(null, prefill), 250);
  }

  // Meals: the Plan Meal panel on the Meals page, with the recipe found or the name typed in
  function openMeal(intent) {
    stop();
    if (typeof window.openPlanMealDrawer !== "function") return;
    if (typeof window.closeTodayScreen === "function") window.closeTodayScreen();
    if (typeof window.switchSkylightView === "function") window.switchSkylightView("meals");
    setTimeout(() => window.openPlanMealDrawer(dateKey(intent.date), intent.slot || "dinner", { title: intent.title, cooks: intent.cooks }), 350);
  }

  // ---- Removing --------------------------------------------------------------------
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayText = (d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  };
  const SLOT_NAME = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const tokens = (t) => String(t || "").toLowerCase().replace(/[’']s\b/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.length > 4 && b.length > 4 && window.VoiceIntent && lev(a, b) <= 1);
  function lev(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // How well a title matches the spoken words: 0..1
  function score(title, words) {
    if (!words.length) return 0.5;
    const have = tokens(title);
    return words.filter(w => have.some(h => near(h, w))).length / words.length;
  }
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function eventCandidates(intent) {
    const events = window.familyEvents || (typeof loadFamilyEvents === "function" ? loadFamilyEvents() : []);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const on = (e, d) => typeof window.isEventOnDate === "function" && window.isEventOnDate(e, dateKey(d), DAY_LONG[d.getDay()], d);
    return (events || []).filter(e => e && typeof e === "object" && e.id).map(e => {
      let when = null;
      if (intent.date) { if (!on(e, intent.date)) return null; when = intent.date; }
      else for (let i = 0; i < 120 && !when; i++) { const d = new Date(today); d.setDate(d.getDate() + i); if (on(e, d)) when = d; }
      const sc = score(e.title, intent.words) + (intent.people && intent.people.some(p => String(e.member || "").includes(p)) ? 0.2 : 0);
      const time = e.time && !/all\s*day/i.test(e.time) && !/all\s*day/i.test(e.duration || "") ? `, ${e.time}` : "";
      const repeats = e.repeat && e.repeat !== "none";
      return {
        type: "event", score: sc, soon: when ? when.getTime() : Infinity, icon: e.icon || "📅", title: e.title || "Event",
        when: [e.member && !/^(family|everyone)$/i.test(e.member) ? e.member : "", when ? `${dayText(when)}${time}` : (e.date || "")].filter(Boolean).join(" · "),
        note: repeats ? "This repeats: removing it takes away every one" : "",
        where: "off the calendar",
        remove: () => {
          window.familyEvents = (window.familyEvents || loadFamilyEvents()).filter(x => x.id !== e.id);
          saveFamilyEvents(window.familyEvents);
          if (typeof renderWeekCalendar === "function") renderWeekCalendar();
        },
        undo: () => {
          window.familyEvents = [...(window.familyEvents || loadFamilyEvents()).filter(x => x.id !== e.id), e];
          saveFamilyEvents(window.familyEvents);
          if (typeof renderWeekCalendar === "function") renderWeekCalendar();
        }
      };
    }).filter(Boolean);
  }

  function taskCandidates(intent) {
    if (intent.date && !intent.words.length) return [];
    return (window.currentTasks || []).filter(t => t && t.id).map(t => {
      const daily = t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task";
      const who = [].concat(t.assignedTo || []).join(", ");
      const sc = score(t.title, intent.words) + (intent.people && intent.people.some(p => who.includes(p)) ? 0.2 : 0);
      const when = daily ? "Every day" : t.repeat === "weekly" && t.day ? `Every ${t.day}` : t.date ? dayText(new Date(`${t.date}T00:00`)) : (t.day || "");
      let saved = null;
      return {
        type: "task", score: sc, soon: Infinity, icon: t.emoji || t.icon || "✅", title: t.title || "Task",
        when: [who, when].filter(Boolean).join(" · "),
        note: daily || t.repeat === "weekly" ? "This repeats: removing it takes away every one" : "",
        where: "off Tasks",
        remove: async () => { saved = typeof window.deleteTaskById === "function" ? await window.deleteTaskById(t.id) : null; },
        undo: () => { if (saved && typeof window.restoreTask === "function") window.restoreTask(saved); }
      };
    });
  }

  function mealCandidates(intent) {
    if (typeof window.getMealForDate !== "function" || typeof window.setMealForDate !== "function") return [];
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = intent.date ? [intent.date] : Array.from({ length: 28 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i - 7); return d; });
    const slots = intent.slot ? [intent.slot] : ["breakfast", "lunch", "dinner", "snack"];
    days.forEach(d => slots.forEach(slot => {
      const meal = window.getMealForDate(d, slot);
      if (!meal || !meal.title) return;
      const saved = JSON.parse(JSON.stringify(meal));
      const sc = intent.target === "meal" && !intent.words.length ? 1 : score(meal.title, intent.words);
      out.push({
        type: "meal", score: sc, soon: d < today ? Infinity : d.getTime(), icon: meal.emoji || "🍽️", title: meal.title,
        when: `${SLOT_NAME[slot] || "Dinner"} · ${dayText(d)}`, note: "", where: "off the meal plan",
        groc: { meal: saved, dateStr: dateKey(d), slot },
        remove: () => { window.setMealForDate(d, null, slot); if (window.renderMealsView) window.renderMealsView(); if (typeof renderWeekCalendar === "function") renderWeekCalendar(); },
        undo: () => { window.setMealForDate(d, saved, slot); if (window.renderMealsView) window.renderMealsView(); if (typeof renderWeekCalendar === "function") renderWeekCalendar(); }
      });
    }));
    return out;
  }

  function findToRemove(intent, quote) {
    const kinds = intent.target ? [intent.target] : ["event", "task", "meal"];
    let found = [];
    if (kinds.includes("event")) found = found.concat(eventCandidates(intent));
    if (kinds.includes("task")) found = found.concat(taskCandidates(intent));
    if (kinds.includes("meal")) found = found.concat(mealCandidates(intent));
    const bar = intent.words.length ? 0.6 : 0.5;
    found = found.filter(c => c.score >= bar).sort((a, b) => (b.score - a.score) || (a.soon - b.soon)).slice(0, 4);
    if (!found.length) {
      drawMessage("I couldn't find that", `${quote}<br><span class="voice-small">Try saying its name as it shows on the board.</span>`, `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      return;
    }
    const best = found[0].score;
    const top = found.filter(c => c.score >= best - 0.05);
    const sheet = getSheet();
    sheet._picks = top;
    const row = (c, i, asButton) => `<${asButton ? `button type="button" data-voice-pick="${i}"` : "div"} class="voice-thing${asButton ? " is-pick" : ""}">
        <span class="voice-thing-icon" aria-hidden="true">${esc(c.icon)}</span>
        <span class="voice-thing-text"><strong>${esc(c.title)}</strong><span>${esc(c.when)}</span>${c.note ? `<em>${esc(c.note)}</em>` : ""}</span>
      </${asButton ? "button" : "div"}>`;
    if (top.length === 1) {
      drawMessage("Remove this?", row(top[0], 0, false), `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-danger" data-voice-pick="0">Remove</button>`);
    } else {
      drawMessage("Which one?", `<span class="voice-small">Tap the one to remove</span><span class="voice-things">${top.map((c, i) => row(c, i, true)).join("")}</span>`, `<button type="button" class="voice-btn" data-voice-close>Cancel</button>`);
    }
  }

  async function removePicked(i) {
    const sheet = getSheet();
    const c = (sheet._picks || [])[Number(i)];
    if (!c) return;
    sheet._picks = null;
    await c.remove();
    if (typeof sfx !== "undefined" && sfx && sfx.playTrash) sfx.playTrash();
    refreshAfterList();
    sheet._undo = () => {
      c.undo();
      refreshAfterList();
      drawMessage("Put back ✓", `<strong>${esc(c.title)}</strong> is back`, `<button type="button" class="voice-btn is-primary" data-voice-close>OK</button>`);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(stop, 2500);
    };
    // A meal whose ingredients are still on the shopping list: offer to take them off too
    const groc = c.groc && window.MealGroceries && window.MealGroceries.onList(c.groc.meal, c.groc.dateStr, c.groc.slot).length ? c.groc : null;
    sheet._groc = groc;
    drawMessage("Removed ✓", `<strong>${esc(c.title)}</strong> is ${esc(c.where)}`, `<button type="button" class="voice-btn" data-voice-undo>Undo</button>${groc ? `<button type="button" class="voice-btn" data-voice-groc>🛒 Its ingredients too</button>` : ""}<button type="button" class="voice-btn is-primary" data-voice-close>Done</button>`);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(stop, 6000);
  }

  // Lists: straight off, with Undo (like adding)
  function removeFromList(intent, quote) {
    const lists = typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : [];
    const list = lists.find(l => l.id === intent.listId) || lists.find(l => l.id === "groceries");
    if (!list) { drawMessage("There's no list like that", quote, `<button type="button" class="voice-btn" data-voice-close>OK</button>`); return; }
    const key = (t) => (typeof window.listItemKey === "function" ? window.listItemKey(t) : String(t).toLowerCase().trim());
    const textOf = (i) => (window.Grocery ? window.Grocery.displayText(i) : i.text);
    const open = (list.items || []).filter(i => !i.checked);
    const gone = [], missing = [];
    intent.items.forEach(said => {
      const k = key(said);
      const hit = open.find(i => key(textOf(i)) === k && !gone.includes(i)) || open.find(i => !gone.includes(i) && score(textOf(i), tokens(said)) >= 1);
      if (hit) gone.push(hit); else missing.push(said);
    });
    if (gone.length) window.mutateFamilyLists({ type: "deleteItems", listId: list.id, itemIds: gone.map(i => i.id) });
    refreshAfterList();
    const names = (arr) => { const t = arr.map(x => esc(typeof x === "string" ? x : x.text)); return t.length > 1 ? `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}` : t[0]; };
    const lines = [];
    if (gone.length) lines.push(`<strong>${names(gone)}</strong> taken off ${esc(list.title)}`);
    if (missing.length) lines.push(`<strong>${names(missing)}</strong> ${missing.length > 1 ? "weren't" : "wasn't"} on ${esc(list.title)}`);
    getSheet()._undo = gone.length ? () => {
      // New ids: the list remembers deleted ones so other devices don't bring them back
      const stamp = Date.now();
      window.mutateFamilyLists({ type: "addItems", listId: list.id, items: gone.map((i, n) => ({ ...i, id: `item-${stamp}-${n}-${Math.random().toString(36).slice(2, 6)}` })) });
      refreshAfterList();
      drawMessage("Put back ✓", `${names(gone)} ${gone.length > 1 ? "are" : "is"} back on ${esc(list.title)}`, `<button type="button" class="voice-btn is-primary" data-voice-close>OK</button>`);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(stop, 2500);
    } : null;
    drawMessage(gone.length ? "Done ✓" : "Not on the list", lines.join("<br>"), `
      ${gone.length ? `<button type="button" class="voice-btn" data-voice-undo>Undo</button>` : ""}
      <button type="button" class="voice-btn is-primary" data-voice-close>Done</button>`);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(stop, 6000);
  }

  // ---- Mic buttons ---------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-voice]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const opts = { want: b.getAttribute("data-voice") || null, listId: b.getAttribute("data-voice-list") || null };
    if (b.hasAttribute("data-voice-intro")) intro(opts); else start(opts);
  }, true);

  const micButton = (want, label) => `<button type="button" class="voice-mini" data-voice="${want}" aria-label="${label}" title="${label}">${MIC_SVG}</button>`;
  // A mic at the end of the title box in the event and task panels
  function addPanelMics() {
    [["event-title-input", "event", "Say the event"], ["drawer-task-title", "task", "Say the task"]].forEach(([id, want, label]) => {
      const input = document.getElementById(id);
      const row = input && input.closest(".drawer-input-row");
      if (row && !row.querySelector(".voice-mini")) row.insertAdjacentHTML("beforeend", micButton(want, label));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPanelMics); else addPanelMics();

  // heard(): runs a sentence as if it was spoken (for testing without a microphone)
  const heard = (text, opts = {}) => { mode = opts; handle(String(text || "")); };
  window.Voice = { start, intro, stop, supported, micButton, MIC_SVG, heard };
})();
