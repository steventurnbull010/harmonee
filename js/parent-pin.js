// ============================================================================
// PARENT PIN (js/parent-pin.js)
// An optional 4-digit PIN so children can't change Settings, redeem rewards
// or set up reward goals on the wall tablet. It's a lock for little hands,
// not account security: the board itself is protected by the family code.
//
//   await ParentPin.require("Settings")  -> true if no PIN is set, the PIN
//                                           was typed, or a parent unlocked
//                                           in the last 5 minutes
//   ParentPin.renderSettingsBox()        -> the Settings > Access controls
//
// Stored as a hash in board settings (parentPinHash), so it works on every
// device on the board. Forgot it? The family code unlocks instead.
// ============================================================================
(function () {
  const UNLOCK_MS = 5 * 60 * 1000;
  let unlockedUntil = 0;

  const settings = () => window.boardSettings || {};
  const isSet = () => typeof settings().parentPinHash === "string" && settings().parentPinHash.length > 0;

  async function hashPin(pin) {
    const boardId = typeof window.getCurrentBoardId === "function" ? window.getCurrentBoardId() : "";
    const text = `harmonee-parent-pin:${boardId}:${pin}`;
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      // No crypto.subtle (plain http on a LAN address): a simple stand-in
      let h = 0;
      for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
      return `s${(h >>> 0).toString(16)}`;
    }
  }

  // ---- The PIN pad (a <dialog>, so it opens above Settings and panels) ----
  let dlg = null;
  function buildDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "parent-pin-modal";
    dlg.className = "parent-pin-dialog";
    dlg.setAttribute("aria-labelledby", "parent-pin-title");
    dlg.innerHTML = `
      <div class="parent-pin-card">
        <div class="parent-pin-icon" aria-hidden="true">🔒</div>
        <h2 class="parent-pin-title" id="parent-pin-title">Parent PIN</h2>
        <p class="parent-pin-sub" id="parent-pin-sub"></p>
        <div class="parent-pin-dots" id="parent-pin-dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <p class="parent-pin-error" id="parent-pin-error" role="alert"></p>
        <div class="parent-pin-pad" id="parent-pin-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" class="parent-pin-key" data-key="${n}">${n}</button>`).join("")}
          <button type="button" class="parent-pin-key is-text" data-key="cancel">Cancel</button>
          <button type="button" class="parent-pin-key" data-key="0">0</button>
          <button type="button" class="parent-pin-key is-text" data-key="back" aria-label="Delete">⌫</button>
        </div>
        <form class="parent-pin-code-form" id="parent-pin-code-form" hidden>
          <label class="parent-pin-code-label" for="parent-pin-code-input">Family code</label>
          <input id="parent-pin-code-input" class="parent-pin-code-input" type="text" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="MINT-FROG-LAMP">
          <div class="parent-pin-code-actions">
            <button type="button" class="parent-pin-link" id="parent-pin-code-back">Back to PIN</button>
            <button type="submit" class="parent-pin-unlock">Unlock</button>
          </div>
        </form>
        <button type="button" class="parent-pin-link" id="parent-pin-forgot">Forgot the PIN? Use the family code</button>
      </div>`;
    document.body.appendChild(dlg);
    return dlg;
  }

  // mode: "check" (unlock) or "set" (choose a new PIN, typed twice)
  function askForPin({ mode = "check", reason = "" } = {}) {
    const d = buildDialog();
    const $ = (id) => d.querySelector("#" + id);
    const dots = [...$("parent-pin-dots").children];
    const pad = $("parent-pin-pad");
    const codeForm = $("parent-pin-code-form");
    const forgot = $("parent-pin-forgot");
    let typed = "";
    let firstPin = null; // "set" mode: the first entry, waiting for the repeat
    let busy = false;

    const setText = () => {
      $("parent-pin-title").textContent = mode === "set" ? (firstPin ? "Type it again" : "Choose a PIN") : "Parent PIN";
      $("parent-pin-sub").textContent = mode === "set"
        ? (firstPin ? "Just to be sure." : "4 numbers that grown-ups will remember.")
        : (reason ? `Enter the PIN to open ${reason}.` : "Enter the PIN to carry on.");
    };
    const showDots = () => dots.forEach((dot, i) => dot.classList.toggle("is-filled", i < typed.length));
    const showError = (msg) => {
      $("parent-pin-error").textContent = msg;
      const box = $("parent-pin-dots");
      box.classList.remove("is-wrong");
      void box.offsetWidth;
      box.classList.add("is-wrong");
    };
    const showCodeForm = (on) => {
      codeForm.hidden = !on;
      pad.hidden = on;
      $("parent-pin-dots").hidden = on;
      forgot.hidden = on || mode === "set";
      $("parent-pin-error").textContent = "";
      if (on) setTimeout(() => $("parent-pin-code-input").focus(), 30);
    };

    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        if (d.open) d.close();
        resolve(ok);
      };

      const press = async (key) => {
        if (busy) return;
        if (key === "cancel") return finish(mode === "set" ? null : false);
        if (key === "back") { typed = typed.slice(0, -1); showDots(); return; }
        if (!/^\d$/.test(key) || typed.length >= 4) return;
        typed += key;
        $("parent-pin-error").textContent = "";
        showDots();
        if (typed.length < 4) return;

        busy = true;
        await new Promise(r => setTimeout(r, 120)); // let the 4th dot show
        if (mode === "set") {
          if (!firstPin) { firstPin = typed; typed = ""; showDots(); setText(); busy = false; return; }
          if (typed !== firstPin) { firstPin = null; typed = ""; showDots(); setText(); showError("Those didn't match. Try again."); busy = false; return; }
          busy = false;
          return finish(typed);
        }
        const ok = (await hashPin(typed)) === settings().parentPinHash;
        busy = false;
        if (ok) return finish(true);
        typed = "";
        showDots();
        showError("That's not it. Try again.");
      };

      const onKey = (e) => {
        if (!d.open || !codeForm.hidden) return;
        if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
        else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
      };

      pad.onclick = (e) => { const k = e.target.closest("[data-key]"); if (k) press(k.dataset.key); };
      forgot.onclick = () => showCodeForm(true);
      $("parent-pin-code-back").onclick = () => showCodeForm(false);
      codeForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = codeForm.querySelector(".parent-pin-unlock");
        btn.disabled = true;
        const ok = typeof window.checkFamilyCode === "function" && await window.checkFamilyCode($("parent-pin-code-input").value);
        btn.disabled = false;
        if (ok) return finish(true);
        $("parent-pin-error").textContent = "That code didn't work. It's in Settings → Access on another device.";
      };
      d.oncancel = (e) => { e.preventDefault(); finish(mode === "set" ? null : false); }; // Esc
      d.onclick = (e) => { if (e.target === d) finish(mode === "set" ? null : false); };   // tap outside

      typed = "";
      $("parent-pin-code-input").value = "";
      showDots();
      showCodeForm(false);
      setText();
      document.addEventListener("keydown", onKey, true);
      if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    });
  }

  async function require(reason = "") {
    if (!isSet()) return true;
    if (Date.now() < unlockedUntil) { unlockedUntil = Date.now() + UNLOCK_MS; return true; }
    const ok = await askForPin({ mode: "check", reason });
    if (ok) unlockedUntil = Date.now() + UNLOCK_MS;
    return !!ok;
  }

  async function setNewPin() {
    const pin = await askForPin({ mode: "set" });
    if (!pin) return false;
    const hash = await hashPin(pin);
    if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ parentPinHash: hash });
    unlockedUntil = Date.now() + UNLOCK_MS;
    return true;
  }

  async function turnOff() {
    if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ parentPinHash: null });
  }

  // ---- Settings > Access: "Parent PIN" box ---------------------------------
  function renderSettingsBox() {
    const box = document.getElementById("parent-pin-settings");
    if (!box) return;
    const on = isSet();
    box.innerHTML = `
      <div class="parent-pin-settings-row">
        <div>
          <div class="parent-pin-settings-title">🔒 Parent PIN <span class="parent-pin-badge ${on ? "is-on" : ""}">${on ? "On" : "Off"}</span></div>
          <p class="settings-box-desc">${on
            ? "Needed to open Settings, redeem a reward or set up a reward goal. Stays unlocked for 5 minutes."
            : "Stop little hands changing Settings, redeeming rewards or setting up reward goals."}</p>
        </div>
      </div>
      <div class="parent-pin-settings-actions">
        <button type="button" class="settings-outline-btn" data-pin-action="set">${on ? "Change PIN" : "Set a PIN"}</button>
        ${on ? `<button type="button" class="settings-outline-btn is-quiet" data-pin-action="off">Turn off</button>` : ""}
      </div>`;
    box.onclick = async (e) => {
      const btn = e.target.closest("[data-pin-action]");
      if (!btn) return;
      if (btn.dataset.pinAction === "set") {
        if (await setNewPin() && typeof window.showCalendarToast === "function") window.showCalendarToast("Parent PIN saved");
      } else if (btn.dataset.pinAction === "off") {
        await turnOff();
      }
      renderSettingsBox();
    };
  }

  // ---- Asked once per board, at the top of Settings ------------------------
  // The PIN is off unless a parent wants it (older children may not need
  // one). The first time Settings is opened we ask; either answer is
  // remembered for the whole board, and it can still be set later in Access.
  function renderOffer() {
    const box = document.getElementById("parent-pin-offer");
    if (!box) return;
    if (isSet() || settings().parentPinAsked) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `
      <div class="parent-pin-offer-icon" aria-hidden="true">🔒</div>
      <div class="parent-pin-offer-body">
        <p class="parent-pin-offer-title">Would you like a parent PIN?</p>
        <p class="parent-pin-offer-text">Handy with younger children: a 4-number PIN for Settings and rewards. Older kids you trust? Skip it. You can change your mind any time in Access.</p>
        <div class="parent-pin-offer-actions">
          <button type="button" class="settings-outline-btn is-primary" data-offer="yes">Set a PIN</button>
          <button type="button" class="settings-outline-btn" data-offer="no">No thanks</button>
        </div>
      </div>`;
    box.onclick = async (e) => {
      const btn = e.target.closest("[data-offer]");
      if (!btn) return;
      if (btn.dataset.offer === "yes") {
        const saved = await setNewPin();
        if (!saved) return; // cancelled: ask again next time
        if (typeof window.showCalendarToast === "function") window.showCalendarToast("Parent PIN saved");
      }
      if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ parentPinAsked: true });
      renderOffer();
      renderSettingsBox();
    };
  }

  window.ParentPin = { isSet, require, renderSettingsBox, renderOffer };
})();
