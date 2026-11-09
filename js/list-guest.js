// ============================================================================
// LIST-ONLY PAGE (list.html?k=…, js/list-guest.js)
// Opened from a list's link on a device that hasn't joined the family's board.
// It shows just that list (a copy kept in sharedLists/{key} by the family's
// devices) and lets the person add things and tick them off. Their changes go
// as notes to sharedLists/{key}/ops, which a family device applies to the
// board (see js/lists.js, "List-only links", and firestore.rules).
// A device that has joined the board goes straight to the full board instead.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { DEFAULT_FIREBASE_CONFIG } from "./firebase-config.js?v=baea2c0a";

const COLORS = {
  sky: ["#0284c7", "#e0f2fe"], rose: ["#e11d48", "#ffe4e6"], amber: ["#d97706", "#fef3c7"], emerald: ["#059669", "#d1fae5"],
  violet: ["#7c3aed", "#ede9fe"], teal: ["#0d9488", "#ccfbf1"], orange: ["#ea580c", "#ffedd5"], slate: ["#475569", "#e2e8f0"]
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const keyOf = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
const root = document.getElementById("guest");

function showState(icon, title, text, button) {
  root.innerHTML = `<div class="guest-card guest-state">
    <div class="guest-state-icon" aria-hidden="true">${icon}</div>
    <h1 class="guest-state-title">${esc(title)}</h1>
    ${text ? `<p class="guest-state-text">${esc(text)}</p>` : ""}
    ${button || ""}
  </div>`;
}

const key = (new URLSearchParams(location.search).get("k") || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);

async function start() {
  if (key.length < 18) {
    showState("🔗", "This link isn't complete", "Ask whoever sent it for the link again.");
    return;
  }
  let db, uid;
  try {
    const app = initializeApp(DEFAULT_FIREBASE_CONFIG);
    db = getFirestore(app);
    uid = (await signInAnonymously(getAuth(app))).user.uid;
  } catch (e) {
    showState("📶", "No connection", "Connect to the internet, then open the link again.", `<button type="button" class="guest-btn" onclick="location.reload()">Try again</button>`);
    return;
  }

  const ref = doc(db, "sharedLists", key);
  let first;
  try {
    first = await getDoc(ref);
  } catch (e) {
    showState("📶", "Couldn't open the list", "Check the connection and try again.", `<button type="button" class="guest-btn" onclick="location.reload()">Try again</button>`);
    return;
  }
  if (!first.exists()) {
    showState("🚫", "This link doesn't work any more", "The family has switched it off. Ask them for a new one.");
    return;
  }
  const { boardId, listId } = first.data();

  // Already one of the family's devices: the whole board, on this list
  try {
    const me = await getDoc(doc(db, "boards", boardId, "devices", uid));
    if (me.exists()) {
      location.replace(`/?board=${encodeURIComponent(boardId)}&list=${encodeURIComponent(listId)}`);
      return;
    }
  } catch (e) { /* not a family device: carry on with just the list */ }

  runList(db, ref, boardId);
}

// ---- The list --------------------------------------------------------------------------
function runList(db, ref, boardId) {
  const ops = collection(db, "sharedLists", key, "ops");
  let copy = null;
  let pendingAdds = [];          // { text, at } sent but not on the copy yet
  const pendingTicks = new Map(); // itemId -> checked, until the copy agrees
  let showDone = false;

  function render() {
    if (!copy) return;
    const [accent, light] = COLORS[copy.color] || COLORS.sky;
    const items = (copy.items || []).map(i => ({ ...i, checked: pendingTicks.has(i.id) ? pendingTicks.get(i.id) : i.checked }));
    const onList = new Set(items.filter(i => !i.checked).map(i => keyOf(i.text)));
    pendingAdds = pendingAdds.filter(p => !onList.has(keyOf(p.text)) && Date.now() - p.at < 60000);
    const open = items.filter(i => !i.checked);
    const done = items.filter(i => i.checked);
    const row = (i) => `<li><button type="button" class="guest-item${i.checked ? " is-done" : ""}" data-tick="${esc(i.id)}" aria-pressed="${i.checked}">
        <span class="guest-check" aria-hidden="true">${i.checked ? "✓" : ""}</span><span class="guest-item-text">${esc(i.text)}</span></button></li>`;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-light", light);
    root.innerHTML = `<div class="guest-card">
      <header class="guest-head">
        <span class="guest-emoji" aria-hidden="true">${esc(copy.emoji || "📋")}</span>
        <div><h1 class="guest-title">${esc(copy.title || "List")}</h1>
        <p class="guest-sub">${open.length + pendingAdds.length === 0 ? "Nothing on it right now" : `${open.length + pendingAdds.length} to ${/grocer|shop/i.test(copy.title || "") ? "get" : "do"}`}</p></div>
      </header>
      <form class="guest-add" id="guest-add" autocomplete="off">
        <label class="guest-sr" for="guest-add-input">Add to the list</label>
        <input id="guest-add-input" class="guest-input" type="text" maxlength="80" placeholder="Add something…" enterkeyhint="done">
        <button type="submit" class="guest-btn">Add</button>
      </form>
      <ul class="guest-items">
        ${pendingAdds.map(p => `<li><div class="guest-item is-sending"><span class="guest-check" aria-hidden="true"></span><span class="guest-item-text">${esc(p.text)}</span><span class="guest-sending">Adding…</span></div></li>`).join("")}
        ${open.map(row).join("")}
      </ul>
      ${done.length ? `<button type="button" class="guest-done-toggle" data-toggle-done aria-expanded="${showDone}">${showDone ? "Hide" : "Show"} ${done.length} ticked off</button>
        ${showDone ? `<ul class="guest-items is-done-list">${done.map(row).join("")}</ul>` : ""}` : ""}
      <footer class="guest-foot">
        <p>Only this list is shared with you. Changes show on the family's harmonee straight away.</p>
        <a class="guest-join" href="/?board=${encodeURIComponent(boardId)}">Part of the family? Join the whole board</a>
      </footer>
    </div>`;
  }

  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "guest-add") return;
    e.preventDefault();
    const input = document.getElementById("guest-add-input");
    const text = input.value.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!text) return;
    input.value = "";
    pendingAdds.push({ text, at: Date.now() });
    render();
    document.getElementById("guest-add-input")?.focus();
    try { await addDoc(ops, { type: "add", texts: [text], at: serverTimestamp() }); }
    catch (err) { pendingAdds = pendingAdds.filter(p => p.text !== text); render(); alert("That didn't save. Check the connection and try again."); }
  });

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-toggle-done]")) { showDone = !showDone; render(); return; }
    const btn = e.target.closest("[data-tick]");
    if (!btn) return;
    const id = btn.getAttribute("data-tick");
    const item = (copy.items || []).find(i => i.id === id);
    if (!item) return;
    const now = pendingTicks.has(id) ? pendingTicks.get(id) : item.checked;
    pendingTicks.set(id, !now);
    render();
    try { await addDoc(ops, { type: "tick", itemId: id, checked: !now, at: serverTimestamp() }); }
    catch (err) { pendingTicks.delete(id); render(); alert("That didn't save. Check the connection and try again."); }
  });

  onSnapshot(ref, (snap) => {
    if (!snap.exists()) { showState("🚫", "This link doesn't work any more", "The family has switched it off. Ask them for a new one."); return; }
    copy = snap.data();
    // Ticks the copy now agrees with are done
    (copy.items || []).forEach(i => { if (pendingTicks.has(i.id) && pendingTicks.get(i.id) === !!i.checked) pendingTicks.delete(i.id); });
    const focused = document.activeElement && document.activeElement.id === "guest-add-input";
    const draft = document.getElementById("guest-add-input")?.value || "";
    render();
    const input = document.getElementById("guest-add-input");
    if (input) { input.value = draft; if (focused) input.focus(); }
  }, () => showState("📶", "Lost the connection", "Open the link again when you're back online.", `<button type="button" class="guest-btn" onclick="location.reload()">Try again</button>`));
}

start();
