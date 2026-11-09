// ============================================================================
// A FAKE FIREBASE for the smoke test (scripts/smoke-test.mjs)
// Served in place of the real firebase-app / firestore / auth libraries, so the
// app runs against an in-memory board (window.__SMOKE_STORE, set up by the
// test) and never talks to the real database. Covers what app.js and
// js/list-guest.js use; writes change the memory copy and fire listeners.
// ============================================================================
const store = (globalThis.__SMOKE_STORE = globalThis.__SMOKE_STORE || {});
const listeners = new Set();
let autoId = 0;

class FakeTimestamp extends Date {
  toDate() { return new Date(this.getTime()); }
  toMillis() { return this.getTime(); }
}
const DELETE = { __fake: "delete" };
const SERVER_TIME = { __fake: "serverTimestamp" };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// ---- app and auth -----------------------------------------------------------------
export const initializeApp = (cfg) => ({ options: cfg || {}, name: "[DEFAULT]" });
export const getApp = () => ({ name: "[DEFAULT]" });
export const getApps = () => [];
const user = { uid: "smoke-test-device", isAnonymous: true };
export const getAuth = () => ({ currentUser: user });
export const signInAnonymously = async () => ({ user });
export const onAuthStateChanged = (auth, cb) => { setTimeout(() => cb(user), 0); return () => {}; };

// ---- references -----------------------------------------------------------------
export const getFirestore = () => ({ __fakeDb: true });
export const initializeFirestore = () => ({ __fakeDb: true });
export const persistentLocalCache = (o) => ({ ...o });
export const persistentMultipleTabManager = () => ({});
export const terminate = async () => {};
export const clearIndexedDbPersistence = async () => {};
export const enableNetwork = async () => {};
export const disableNetwork = async () => {};

export function collection(base, ...segs) {
  const prefix = base && base.path ? base.path.split("/") : [];
  return { kind: "col", path: [...prefix, ...segs].join("/"), id: segs[segs.length - 1] };
}
export function doc(base, ...segs) {
  const prefix = base && base.path ? base.path.split("/") : [];
  const parts = [...prefix, ...segs];
  if (parts.length % 2 === 1) parts.push(`auto${++autoId}`); // doc(collectionRef) gets a new id
  return { kind: "doc", path: parts.join("/"), id: parts[parts.length - 1] };
}
export const query = (ref) => ref;
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});

export function FieldPath(...segments) { this.segments = segments; }
export const deleteField = () => DELETE;
export const serverTimestamp = () => SERVER_TIME;
export const arrayUnion = (...items) => ({ __fake: "union", items });
export const arrayRemove = (...items) => ({ __fake: "remove", items });
export const increment = (n) => ({ __fake: "inc", n });
export const Timestamp = { now: () => new FakeTimestamp(), fromDate: (d) => new FakeTimestamp(d) };

// ---- reading ----------------------------------------------------------------------
const meta = { fromCache: false, hasPendingWrites: false };
function docSnap(path) {
  const data = store[path];
  const id = path.split("/").pop();
  return { id, ref: { kind: "doc", path, id }, metadata: meta, exists: () => data !== undefined, data: () => clone(data), get: (k) => (data || {})[k] };
}
function querySnap(colPath) {
  const depth = colPath.split("/").length + 1;
  const docs = Object.keys(store).filter(p => p.startsWith(colPath + "/") && p.split("/").length === depth).map(docSnap);
  return { docs, size: docs.length, empty: !docs.length, metadata: meta, forEach: (fn) => docs.forEach(fn), docChanges: () => [] };
}
const snapOf = (ref) => (ref.kind === "col" ? querySnap(ref.path) : docSnap(ref.path));
export const getDoc = async (ref) => docSnap(ref.path);
export const getDocFromServer = getDoc;
export const getDocs = async (ref) => querySnap(ref.path);
export const getDocsFromServer = getDocs;
export function onSnapshot(ref, a, b) {
  const next = typeof a === "function" ? a : (b && typeof b === "function" ? b : (a && a.next));
  const l = { ref, next };
  listeners.add(l);
  setTimeout(() => { if (listeners.has(l)) next(snapOf(ref)); }, 0);
  return () => listeners.delete(l);
}
function changed(path) {
  setTimeout(() => listeners.forEach(l => {
    if (l.ref.path === path || path.startsWith(l.ref.path + "/")) l.next(snapOf(l.ref));
  }), 0);
}

// ---- writing ----------------------------------------------------------------------
function resolve(value, old) {
  if (value === SERVER_TIME) return new FakeTimestamp().toISOString();
  if (value && value.__fake === "union") return [...(Array.isArray(old) ? old : []), ...value.items.filter(i => !(old || []).includes(i))];
  if (value && value.__fake === "remove") return (Array.isArray(old) ? old : []).filter(i => !value.items.includes(i));
  if (value && value.__fake === "inc") return (Number(old) || 0) + value.n;
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { if (v !== DELETE) out[k] = resolve(v, old && old[k]); });
    return out;
  }
  return value instanceof Date ? value.toISOString() : value;
}
function setPath(obj, parts, value) {
  let o = obj;
  parts.slice(0, -1).forEach(p => { if (!o[p] || typeof o[p] !== "object") o[p] = {}; o = o[p]; });
  const last = parts[parts.length - 1];
  if (value === DELETE) delete o[last]; else o[last] = resolve(value, o[last]);
}
function applyUpdate(path, args) {
  const data = clone(store[path]) || {};
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !(args[0] instanceof FieldPath)) {
    Object.entries(args[0]).forEach(([k, v]) => setPath(data, k.split("."), v));
  } else {
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      setPath(data, key instanceof FieldPath ? key.segments : String(key).split("."), args[i + 1]);
    }
  }
  store[path] = data;
  changed(path);
}
export async function setDoc(ref, data, opts) {
  store[ref.path] = opts && opts.merge ? { ...(store[ref.path] || {}), ...resolve(data, store[ref.path]) } : resolve(data);
  changed(ref.path);
}
export async function updateDoc(ref, ...args) {
  if (store[ref.path] === undefined) { const e = new Error("No document to update"); e.code = "not-found"; throw e; }
  applyUpdate(ref.path, args);
}
export async function deleteDoc(ref) { delete store[ref.path]; changed(ref.path); }
export async function addDoc(col, data) { const ref = doc(col); await setDoc(ref, data); return ref; }
export function writeBatch() {
  const ops = [];
  return {
    set: (ref, d, o) => { ops.push(() => setDoc(ref, d, o)); },
    update: (ref, ...a) => { ops.push(() => updateDoc(ref, ...a)); },
    delete: (ref) => { ops.push(() => deleteDoc(ref)); },
    commit: async () => { for (const op of ops) await op(); }
  };
}
export async function runTransaction(db, fn) {
  const tx = {
    get: async (ref) => docSnap(ref.path),
    set: (ref, d, o) => { setDoc(ref, d, o); return tx; },
    update: (ref, ...a) => { applyUpdate(ref.path, a); return tx; },
    delete: (ref) => { deleteDoc(ref); return tx; }
  };
  return fn(tx);
}
