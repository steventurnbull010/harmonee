// ============================================================================
// THE ERROR LOG (js/errors.js) — loaded first, before every other script
// Catches what goes wrong on this device and keeps the last 50, so a problem
// on the kitchen tablet can be read later in Settings → Diagnostics (and
// copied to send on). Nothing leaves the device.
//   - Errors nobody caught, and promises that failed with nobody waiting
//   - console.error, and console.warn when it says something failed
//   - A failed save also shows a short note, so a lost change isn't silent:
//     "will try again" only when it really will (BoardSync's queue)
//   - A crash shows the "Reload app" banner, as before
// HarmoneeErrors.log(kind, message) adds one by hand.
// ============================================================================
(function () {
  const KEY = "harmonee_error_log";
  const MAX = 50;
  const SAVE_NOTE_GAP_MS = 20000;
  let entries = null;
  let lastSaveNote = 0;

  function load() {
    if (entries) return entries;
    try { entries = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { entries = []; }
    if (!Array.isArray(entries)) entries = [];
    return entries;
  }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch (e) {}
  }

  // One line of text from whatever was thrown or logged
  function textOf(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (x instanceof Error || (x && typeof x.message === "string")) return (x.code ? `${x.code}: ` : "") + x.message;
    try { return JSON.stringify(x); } catch (e) { return String(x); }
  }
  // "app.js:3656" from a stack, so we know where it came from
  function whereOf(err) {
    const stack = err && typeof err.stack === "string" ? err.stack : "";
    const m = stack.match(/\/((?:js\/)?[\w.-]+\.js)(?:\?[^:\s)]*)?:(\d+)/);
    return m ? `${m[1]}:${m[2]}` : "";
  }

  function log(kind, message, where) {
    const list = load();
    const msg = String(message || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!msg) return;
    const now = Date.now();
    const last = list[list.length - 1];
    // The same thing again within a minute: count it rather than fill the log
    if (last && last.kind === kind && last.msg === msg && now - last.at < 60000) {
      last.n = (last.n || 1) + 1;
      last.at = now;
    } else {
      list.push({
        at: now, kind, msg, where: where || "",
        build: (window.HARMONEE_BUILD && window.HARMONEE_BUILD.id) || "",
        page: (document.body && document.body.getAttribute("data-view")) || ""
      });
      if (list.length > MAX) list.splice(0, list.length - MAX);
    }
    store();
    document.dispatchEvent(new CustomEvent("harmonee:errors"));
  }

  // ---- A failed save: a short note on screen ------------------------------------
  const SAVE_WORDS = /^(couldn't save|could not save|failed to (save|sync|update|create|delete|undo|restore|reset|update assignee))/i;
  const GIVE_UP = ["invalid-argument", "failed-precondition", "out-of-range", "permission-denied", "not-found", "unauthenticated"];
  function saveFailed(message, err) {
    const offline = typeof window.isOffline === "function" && window.isOffline();
    if (offline) return; // the offline banner already says changes will send later
    const now = Date.now();
    if (now - lastSaveNote < SAVE_NOTE_GAP_MS) return;
    lastSaveNote = now;
    const code = String((err && err.code) || (typeof err === "string" ? err : "")).replace(/^firestore\//, "");
    // BoardSync's queue ("…yet") tries again in 30 seconds unless the board refused it
    const retrying = /\byet\b/i.test(message) && !GIVE_UP.includes(code);
    const note = retrying
      ? "⚠️ Couldn't save just now. Trying again shortly."
      : "⚠️ Couldn't save that change. Details in Settings › Diagnostics.";
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(note);
  }

  // ---- What gets caught ------------------------------------------------------------
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = function (...args) {
    try { log("error", args.map(textOf).join(" "), whereOf(args.find(a => a && a.stack))); } catch (e) {}
    return origError(...args);
  };
  console.warn = function (...args) {
    try {
      const first = typeof args[0] === "string" ? args[0] : "";
      if (/fail|couldn't|could not|error|refused/i.test(first)) {
        const err = args.find(a => a && typeof a === "object");
        log(SAVE_WORDS.test(first) ? "save" : "warning", args.map(textOf).join(" "), whereOf(err));
        if (SAVE_WORDS.test(first)) saveFailed(first, args[1]);
      }
    } catch (e) {}
    return origWarn(...args);
  };

  window.addEventListener("error", (e) => {
    // A file that didn't load (script, style, image) arrives here with no message
    if (!e.message && e.target && e.target !== window) {
      const src = e.target.src || e.target.href || "";
      if (/\.(js|css)(\?|$)/.test(src)) log("load", `Didn't load ${src.replace(location.origin + "/", "").split("?")[0]}`);
      return;
    }
    log("crash", e.message || textOf(e.error), e.filename ? `${e.filename.replace(location.origin + "/", "").split("?")[0]}:${e.lineno}` : whereOf(e.error));
    showCrashBanner(e.message);
  }, true);
  // Something the content policy (firebase.json, report-only for now) would
  // block: logged so real devices show what to allow before it's switched on
  document.addEventListener("securitypolicyviolation", (e) => {
    log("policy", `The content policy would block ${String(e.blockedURI || "an inline script or style").split("?")[0]} (${e.effectiveDirective || e.violatedDirective})`, e.sourceFile ? `${String(e.sourceFile).replace(location.origin + "/", "").split("?")[0]}:${e.lineNumber}` : "");
  });
  window.addEventListener("unhandledrejection", (e) => {
    log("promise", textOf(e.reason) || "A background task failed", whereOf(e.reason));
  });

  // ---- The "Reload app" banner (was inline in index.html) ---------------------------
  window.hardReloadApp = function () {
    try { if ("caches" in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k))); } catch (e) {}
    try { localStorage.removeItem("chore_calendar_view"); } catch (e) {}
    const sep = window.location.href.indexOf("?") !== -1 ? "&" : "?";
    window.location.href = window.location.href + sep + "t=" + Date.now();
  };
  function showCrashBanner(message) {
    if (!document.body || document.getElementById("emergency-recovery-banner")) return;
    const b = document.createElement("div");
    b.id = "emergency-recovery-banner";
    b.className = "error-banner";
    b.setAttribute("role", "alert");
    const text = document.createElement("span");
    text.textContent = `⚠️ ${message || "Something went wrong"}. Your family's data on the board is safe.`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reload app";
    btn.addEventListener("click", () => window.hardReloadApp());
    const close = document.createElement("button");
    close.type = "button";
    close.className = "error-banner-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "✕";
    close.addEventListener("click", () => b.remove());
    b.append(text, btn, close);
    document.body.appendChild(b);
  }

  // ---- Settings → Diagnostics -------------------------------------------------------
  const LABEL = { crash: "Crash", promise: "Background task", error: "Error", warning: "Warning", save: "Save failed", load: "File didn't load", policy: "Content policy" };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = (t) => {
    const d = new Date(t);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return today ? time : `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ${time}`;
  };

  function asText() {
    const b = window.HARMONEE_BUILD || {};
    const lines = [
      `harmonee build ${b.id || "?"} (${b.builtAt || "?"})`,
      `Device: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth}×${window.innerHeight}, ${navigator.onLine ? "online" : "offline"}`,
      `Changes waiting to save: ${window.BoardSync ? window.BoardSync.pendingCount() : "?"}`,
      ""
    ];
    load().slice().reverse().forEach(x => lines.push(`${new Date(x.at).toISOString()} · ${LABEL[x.kind] || x.kind}${x.n > 1 ? ` ×${x.n}` : ""} · ${x.msg}${x.where ? ` · ${x.where}` : ""}${x.build ? ` · build ${x.build}` : ""}`));
    return lines.join("\n");
  }

  function renderSettings() {
    const box = document.getElementById("diagnostics-box");
    if (!box) return;
    const list = load().slice().reverse();
    const pending = window.BoardSync ? window.BoardSync.pendingCount() : 0;
    const b = window.HARMONEE_BUILD || {};
    box.innerHTML = `
      <ul class="diag-facts">
        <li><span>Build</span><strong>${esc(b.id || "?")}</strong></li>
        <li><span>Connection</span><strong>${navigator.onLine ? "Online" : "Offline"}</strong></li>
        <li><span>Changes waiting to save</span><strong>${pending}</strong></li>
      </ul>
      ${list.length ? `<ol class="diag-list" aria-label="Problems, newest first">${list.map(x => `
        <li class="diag-item is-${esc(x.kind)}">
          <span class="diag-meta"><span class="diag-kind">${esc(LABEL[x.kind] || x.kind)}${x.n > 1 ? ` ×${x.n}` : ""}</span><span class="diag-when">${esc(when(x.at))}</span></span>
          <span class="diag-msg">${esc(x.msg)}</span>
          ${x.where ? `<span class="diag-where">${esc(x.where)}</span>` : ""}
        </li>`).join("")}</ol>`
        : `<p class="diag-empty">✅ Nothing has gone wrong on this device.</p>`}
      <div class="diag-actions">
        <button type="button" class="settings-outline-btn" data-diag="copy">Copy the details</button>
        ${list.length ? `<button type="button" class="settings-outline-btn is-quiet" data-diag="clear">Clear</button>` : ""}
      </div>`;
    if (!box._wired) {
      box._wired = true;
      box.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-diag]");
        if (!btn) return;
        if (btn.dataset.diag === "clear") { entries = []; store(); renderSettings(); return; }
        try {
          await navigator.clipboard.writeText(asText());
          btn.textContent = "Copied ✓";
        } catch (err) {
          btn.textContent = "Couldn't copy";
        }
        setTimeout(() => { btn.textContent = "Copy the details"; }, 2000);
      });
      document.addEventListener("harmonee:errors", () => {
        const dlg = document.getElementById("settings-modal");
        if (dlg && dlg.open) renderSettings();
      });
    }
  }

  window.HarmoneeErrors = { log, list: () => load().slice(), clear: () => { entries = []; store(); }, asText, renderSettings, _saveFailed: saveFailed };
})();
