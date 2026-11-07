// ============================================================================
// VOICE (js/voice.js)
// "🎤 Say it": the browser's own speech-to-text (British English) plus the
// phrase rules in js/voice-intent.js. No AI and no extra cost.
//
// - Shopping / list items are added straight away, with Undo
// - Events and tasks open their panel filled in, to check and save
// - Anything unclear: "I heard …" with Add as event / Add to shopping list / Try again
//
// Mic buttons: [data-voice] anywhere (Today at a glance), plus a small mic
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
  let rec = null, mode = null, sheet = null, closeTimer = null;

  function getSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("dialog");
    sheet.id = "voice-dialog";
    sheet.className = "voice-dialog";
    sheet.setAttribute("aria-labelledby", "voice-title");
    document.body.appendChild(sheet);
    sheet.addEventListener("cancel", (e) => { e.preventDefault(); stop(); });
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest("[data-voice-close]")) { stop(); return; }
      if (e.target.closest("[data-voice-again]")) { start(mode); return; }
      if (e.target.closest("[data-voice-done]")) { if (rec) { try { rec.stop(); } catch (err) {} } return; }
      const as = e.target.closest("[data-voice-as]");
      if (as) { act(window.VoiceIntent.parse(sheet._heard || "", ctx({ ...mode, want: as.getAttribute("data-voice-as") })), sheet._heard); return; }
      if (e.target.closest("[data-voice-undo]") && typeof sheet._undo === "function") { sheet._undo(); sheet._undo = null; return; }
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
      : "Like “Add milk to the shopping list” or “Swimming on Saturday at 10”";
    draw(`${closeBtn}
      <span class="voice-mic is-live" aria-hidden="true">${MIC_SVG}</span>
      <h2 class="voice-title" id="voice-title">${words ? "Listening…" : "I'm listening"}</h2>
      <p class="voice-words${words ? "" : " is-hint"}" aria-live="polite">${words ? esc(words) : hint}</p>
      <div class="voice-actions"><button type="button" class="voice-btn is-primary" data-voice-done>Done</button></div>`);
  }

  function drawMessage(title, text, buttons) {
    draw(`${closeBtn}
      <span class="voice-mic" aria-hidden="true">${MIC_SVG}</span>
      <h2 class="voice-title" id="voice-title">${esc(title)}</h2>
      ${text ? `<p class="voice-words">${text}</p>` : ""}
      <div class="voice-actions">${buttons || ""}</div>`);
  }

  function stop() {
    clearTimeout(closeTimer);
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    if (sheet && sheet.open) sheet.close();
  }

  // ---- Listening -----------------------------------------------------------------
  // opts: { want: "list" | "event" | "task" | null, listId }
  function start(opts = {}) {
    if (!Rec) return;
    clearTimeout(closeTimer);
    if (rec) { try { rec.abort(); } catch (e) {} }
    mode = opts || {};
    const r = new Rec();
    rec = r;
    r.lang = "en-GB";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "", heardAnything = false;
    drawListening("");
    r.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      heardAnything = true;
      if (rec === r) drawListening((finalText + " " + interim).trim());
    };
    r.onerror = (e) => {
      if (rec !== r) return;
      rec = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        blocked = true;
        markSupport();
        drawMessage("harmonee can't hear you", "The microphone is switched off for this page. Allow it in the browser's site settings, then try again.", `<button type="button" class="voice-btn" data-voice-close>OK</button>`);
      } else if (e.error === "no-speech" || e.error === "aborted") {
        drawMessage("I didn't catch that", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      } else if (e.error === "network") {
        drawMessage("Speech needs the internet", "Your browser turns speech into words online. Check the Wi-Fi and try again.", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      } else {
        drawMessage("Something went wrong", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
      }
    };
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      const text = finalText.trim();
      if (!text) {
        if (!heardAnything) drawMessage("I didn't catch that", "", `<button type="button" class="voice-btn" data-voice-close>Cancel</button><button type="button" class="voice-btn is-primary" data-voice-again>Try again</button>`);
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
    drawMessage("I heard", quote, `
      <button type="button" class="voice-btn" data-voice-as="event">📅 Add as event</button>
      <button type="button" class="voice-btn" data-voice-as="list">🛒 Add to shopping list</button>
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
    document.dispatchEvent(new CustomEvent("harmonee:voice-list"));
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
    let slot = { duration: "All Day" };
    if (!intent.allDay && intent.start) {
      let len = toMins(intent.end) - toMins(intent.start);
      if (len <= 0) len += 24 * 60;
      slot = { start: intent.start, duration: typeof window.formatEventDuration === "function" ? window.formatEventDuration(len) : "1 hour" };
    }
    window.openEventModal(null, null, dateKey(intent.date), slot, { title: intent.title, members: intent.members });
  }

  function openTask(intent) {
    stop();
    if (typeof window.openSkylightTaskDrawer !== "function") return;
    const prefill = { title: intent.title, people: intent.people, date: intent.date || new Date(), daily: intent.daily, slot: intent.slot };
    const overlay = document.getElementById("skylight-task-drawer-overlay");
    const drawerOpen = overlay && overlay.style.display && overlay.style.display !== "none";
    if (drawerOpen && (document.getElementById("drawer-task-id") || {}).value) { retitle("drawer-task-title", intent.title); return; }
    if (drawerOpen) { window.openSkylightTaskDrawer(null, prefill); return; }
    // The task panel sits on the Tasks page
    if (typeof window.closeTodayScreen === "function") window.closeTodayScreen();
    if (typeof window.switchSkylightView === "function") window.switchSkylightView("chores");
    setTimeout(() => window.openSkylightTaskDrawer(null, prefill), 250);
  }

  // ---- Mic buttons ---------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-voice]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    start({ want: b.getAttribute("data-voice") || null, listId: b.getAttribute("data-voice-list") || null });
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
  window.Voice = { start, stop, supported, micButton, MIC_SVG, heard };
})();
