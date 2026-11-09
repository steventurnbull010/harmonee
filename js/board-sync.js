// ============================================================================
// SAVING TO THE BOARD WITHOUT OVERWRITING OTHER DEVICES (js/board-sync.js)
//
// The board doc holds maps (meals by date, settings) and lists (events,
// reward goals, redemptions). Saving a whole map or list meant the last
// device to save won: two tablets planning meals or adding events at the
// same time lost one of the changes.
//
// Maps: only the parts that changed are written (meals.2026-11-09.title),
//   compared with what this device last had from the board.
// Lists: each change is kept on this device as "add or update this item" or
//   "remove this item" and applied to the board's latest copy inside a
//   transaction (Firestore retries it if another device saved meanwhile).
//   Changes made offline wait here and save when the signal is back.
//
// The data keeps its shape, so older copies of the app still read it.
// Uses window.db, doc, updateDoc, runTransaction, FieldPath and deleteField
// (shared by app.js) and getSaveBoardId (js/utils.js).
// ============================================================================
(function (root) {
  const DELETE = { __delete: true };
  const baselines = {}; // field -> JSON of what this device last had from the board

  const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  // ---- Maps --------------------------------------------------------------------------

  // The changes between two maps, as [[path segments], value or DELETE].
  // depth 1: one entry per top-level key; depth 2: one level further down
  // where both sides are maps (so two devices editing different meals on the
  // same day both keep theirs).
  function diffMap(prefix, before, after, depth = 1) {
    const out = [];
    const a = isPlainObject(before) ? before : {};
    const b = isPlainObject(after) ? after : {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach(k => {
      const had = Object.prototype.hasOwnProperty.call(a, k);
      const has = Object.prototype.hasOwnProperty.call(b, k);
      if (has && had && same(a[k], b[k])) return;
      if (!has) { out.push([[...prefix, k], DELETE]); return; }
      if (depth > 1 && had && isPlainObject(a[k]) && isPlainObject(b[k])) {
        out.push(...diffMap([...prefix, k], a[k], b[k], depth - 1));
        return;
      }
      out.push([[...prefix, k], b[k] === undefined ? null : b[k]]);
    });
    return out;
  }

  // What this device last had from the board (or last saved) for a field
  function setBaseline(field, value) {
    try { baselines[field] = JSON.stringify(value === undefined ? null : value); } catch (e) { delete baselines[field]; }
  }
  function getBaseline(field) {
    if (!(field in baselines)) return undefined;
    try { return JSON.parse(baselines[field]); } catch (e) { return undefined; }
  }

  // Save just what changed in a map field. Returns the number of parts written.
  function saveMapChanges(field, value, depth = 1) {
    const before = getBaseline(field);
    const changes = before === undefined
      ? Object.keys(isPlainObject(value) ? value : {}).map(k => [[field, k], value[k] === undefined ? null : value[k]])
      : diffMap([field], before, value, depth);
    setBaseline(field, value);
    if (!changes.length) return 0;
    writeFields(changes);
    return changes.length;
  }

  // Write [[path], value|DELETE] pairs to the board doc in one update.
  // Works offline (Firestore keeps it and sends it later).
  function writeFields(changes, extra) {
    const boardId = typeof root.getSaveBoardId === "function" ? root.getSaveBoardId() : null;
    if (!boardId || !root.db || typeof root.updateDoc !== "function" || typeof root.FieldPath !== "function") return null;
    const args = [];
    changes.forEach(([path, value]) => {
      args.push(new root.FieldPath(...path), value === DELETE ? root.deleteField() : value);
    });
    if (extra) Object.entries(extra).forEach(([k, v]) => args.push(new root.FieldPath(k), v));
    if (typeof root.serverTimestamp === "function") args.push(new root.FieldPath("updatedAt"), root.serverTimestamp());
    const ref = root.doc(root.db, "boards", boardId);
    return root.updateDoc(ref, ...args).catch(err => console.warn("Couldn't save to the board:", err));
  }

  // ---- Lists of items with ids -----------------------------------------------------------

  const QUEUE_KEY = () => (typeof root.boardCacheKey === "function" ? root.boardCacheKey("harmonee_board_ops") : "harmonee_board_ops");
  let queue = null;
  function loadQueue() {
    if (queue) return queue;
    try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY()) || "[]"); } catch (e) { queue = []; }
    if (!Array.isArray(queue)) queue = [];
    return queue;
  }
  function saveQueue() {
    try { localStorage.setItem(QUEUE_KEY(), JSON.stringify(queue || [])); } catch (e) {}
  }

  // The changes between two lists, by id: [{ op: "upsert", id, item } | { op: "remove", id }]
  function diffList(before, after) {
    const ops = [];
    const a = new Map((Array.isArray(before) ? before : []).filter(x => x && x.id != null).map(x => [String(x.id), x]));
    const b = new Map((Array.isArray(after) ? after : []).filter(x => x && x.id != null).map(x => [String(x.id), x]));
    b.forEach((item, id) => { if (!a.has(id) || !same(a.get(id), item)) ops.push({ op: "upsert", id, item }); });
    a.forEach((_, id) => { if (!b.has(id)) ops.push({ op: "remove", id }); });
    return ops;
  }

  // Apply changes to a list: updates stay in place, new items go on the end
  function applyOps(list, ops) {
    const out = (Array.isArray(list) ? list : []).slice();
    ops.forEach(o => {
      const i = out.findIndex(x => x && x.id != null && String(x.id) === String(o.id));
      if (o.op === "remove") { if (i !== -1) out.splice(i, 1); }
      else if (i !== -1) out[i] = o.item;
      else out.push(o.item);
    });
    return out;
  }

  // Save what changed in a list field
  function saveListChanges(field, value) {
    const before = getBaseline(field);
    const ops = before === undefined
      ? (Array.isArray(value) ? value : []).filter(x => x && x.id != null).map(item => ({ op: "upsert", id: String(item.id), item }))
      : diffList(before, value);
    setBaseline(field, value);
    if (!ops.length) return 0;
    const q = loadQueue();
    const at = Date.now();
    ops.forEach((o, n) => q.push({ ...o, field, opId: `${at}-${n}-${Math.random().toString(36).slice(2, 8)}` }));
    saveQueue();
    flush();
    return ops.length;
  }

  // A list from the board, with this device's unsaved changes on top (so a
  // snapshot arriving before they're saved doesn't make them flicker away)
  function withPending(field, list) {
    const mine = loadQueue().filter(o => o.field === field);
    return mine.length ? applyOps(list, mine) : (Array.isArray(list) ? list : []);
  }

  let flushing = false, again = false, retryTimer = null;
  const GIVE_UP_CODES = ["invalid-argument", "failed-precondition", "out-of-range"];
  async function flush() {
    const q = loadQueue();
    if (!q.length) return;
    const boardId = typeof root.getSaveBoardId === "function" ? root.getSaveBoardId() : null;
    if (!boardId || !root.db || typeof root.runTransaction !== "function") return;
    if (root.isOffline && root.isOffline()) return; // the "online" event brings us back
    if (flushing) { again = true; return; }
    flushing = true;
    const batch = q.slice();
    const ref = root.doc(root.db, "boards", boardId);
    try {
      await root.runTransaction(root.db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists() ? snap.data() : {};
        const fields = [...new Set(batch.map(o => o.field))];
        const update = {};
        fields.forEach(f => { update[f] = applyOps(data[f], batch.filter(o => o.field === f)); });
        if (typeof root.serverTimestamp === "function") update.updatedAt = root.serverTimestamp();
        if (snap.exists()) tx.update(ref, update); else tx.set(ref, update, { merge: true });
      });
      const sent = new Set(batch.map(o => o.opId));
      queue = loadQueue().filter(o => !sent.has(o.opId));
      saveQueue();
    } catch (err) {
      const code = (err && err.code) || "";
      console.warn("Couldn't save to the board yet:", code || err);
      if (GIVE_UP_CODES.includes(code)) {
        // The board will never take these: drop them rather than retry forever
        const sent = new Set(batch.map(o => o.opId));
        queue = loadQueue().filter(o => !sent.has(o.opId));
        saveQueue();
      } else {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(flush, 30000);
      }
    } finally {
      flushing = false;
      if (again) { again = false; flush(); }
    }
  }

  if (root.addEventListener) root.addEventListener("online", () => flush());

  const api = { DELETE, diffMap, diffList, applyOps, setBaseline, getBaseline, saveMapChanges, saveListChanges, writeFields, withPending, flush, pendingCount: () => loadQueue().length, _resetForTests: () => { queue = null; Object.keys(baselines).forEach(k => delete baselines[k]); } };
  root.BoardSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
