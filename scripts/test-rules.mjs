#!/usr/bin/env node
// Live security-rules check for harmonee (run after deploying firestore.rules).
// Signs in throwaway anonymous devices and exercises the rules over REST.
// It only ever writes to its own temporary board (rules-test-*) and cleans
// up its device docs afterwards; family boards are only read-probed.
//
// Usage: node scripts/test-rules.mjs

const PROJECT = "harmonee-app";
const API_KEY = "AIzaSyCOkZ_BlVEgW8K9paG_L-JLrgtTzfgRzNQ";
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME = (p) => `projects/${PROJECT}/databases/(default)/documents/${p}`;

async function anonDevice() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = await res.json();
  if (!body.idToken) throw new Error("Anonymous sign-in failed: " + JSON.stringify(body.error || body));
  return { uid: body.localId, token: body.idToken };
}

async function call(device, method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (device) headers.Authorization = `Bearer ${device.token}`;
  const url = path.startsWith(":") ? `${ROOT}${path}` : `${ROOT}/${path}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.status;
}
const str = (s) => ({ stringValue: s });
const ok = (s) => s === 200 || s === 404; // 404 = allowed but doc missing
const denied = (s) => s === 403;

let failures = 0;
function check(label, passed, status) {
  console.log(`${passed ? "✅" : "❌"} ${label}${passed ? "" : `  (got HTTP ${status})`}`);
  if (!passed) failures++;
}

const testBoard = `rules-test-${Date.now().toString(36)}`;
const code = "TESTCODE";

const owner = await anonDevice();
const stranger = await anonDevice();
const joiner = await anonDevice();

// --- Family boards are closed to outsiders ---------------------------------
let s;
s = await call(null, "GET", "boards/turnbull");                      check("No sign-in: can't read the Turnbull board", denied(s), s);
s = await call(stranger, "GET", "boards/turnbull");                  check("Signed-in stranger: can't read the Turnbull board", denied(s), s);
s = await call(stranger, "GET", "boards/turnbull/tasks");            check("Stranger: can't list Turnbull chores", denied(s), s);
s = await call(stranger, "GET", "boards/turnbull/private/access");   check("Stranger: can't read the Turnbull family code", denied(s), s);
s = await call(stranger, "GET", "boards/turnbull/devices");          check("Stranger: can't list Turnbull devices", denied(s), s);
s = await call(stranger, "GET", "boards");                           check("Stranger: can't list all boards", denied(s), s);
s = await call(stranger, "GET", "turnbull_reset_tasks");             check("Stranger: legacy turnbull_reset_tasks is closed", denied(s), s);
s = await call(stranger, "PATCH", "boards/turnbull/private/access", { fields: { code: str("HIJACKED1") } });
check("Stranger: can't overwrite the Turnbull family code", denied(s), s);
s = await call(stranger, "PATCH", `boards/turnbull/devices/${stranger.uid}`, { fields: { code: str("WRONGCODE") } });
check("Stranger: can't join Turnbull with a wrong code", denied(s), s);
s = await call(stranger, "GET", `boards/turnbull/devices/${stranger.uid}`);
check("Stranger: may check its own (missing) device doc", ok(s), s);

// --- Creating a brand-new board -------------------------------------------
s = await call(owner, "POST", ":commit", { writes: [
  { update: { name: NAME(`boards/${testBoard}`), fields: { boardId: str(testBoard) } }, currentDocument: { exists: false } },
  { update: { name: NAME(`boards/${testBoard}/private/access`), fields: { code: str(code) } } },
  { update: { name: NAME(`boards/${testBoard}/devices/${owner.uid}`), fields: { code: str(code) } } },
] });
check("New board: created with its code and the creator's device in one batch", s === 200, s);
s = await call(owner, "GET", `boards/${testBoard}`);                  check("Creator: can read the new board", s === 200, s);
s = await call(owner, "PATCH", `boards/${testBoard}/tasks/t1`, { fields: { title: str("Test chore") } });
check("Creator: can write a chore", s === 200, s);
s = await call(owner, "GET", `boards/${testBoard}/private/access`);   check("Creator: can read the family code", s === 200, s);

// --- Joining ---------------------------------------------------------------
s = await call(joiner, "GET", `boards/${testBoard}`);                 check("Before joining: can't read the board", denied(s), s);
s = await call(joiner, "PATCH", `boards/${testBoard}/devices/${joiner.uid}`, { fields: { code: str("WRONGCODE") } });
check("Join with wrong code is refused", denied(s), s);
s = await call(joiner, "PATCH", `boards/${testBoard}/devices/${owner.uid}`, { fields: { code: str(code) } });
check("Can't join on behalf of another device", denied(s), s);
s = await call(joiner, "PATCH", `boards/${testBoard}/devices/${joiner.uid}`, { fields: { code: str(code) } });
check("Join with the right code works", s === 200, s);
s = await call(joiner, "GET", `boards/${testBoard}/tasks`);           check("After joining: can read chores", s === 200, s);
s = await call(joiner, "GET", `boards/${testBoard}/devices`);         check("After joining: can list devices", s === 200, s);
s = await call(joiner, "GET", "boards/turnbull");                     check("Joining one board gives no access to another", denied(s), s);

// --- Board takeover attempts ------------------------------------------------
s = await call(stranger, "POST", ":commit", { writes: [
  { update: { name: NAME(`boards/${testBoard}/private/access`), fields: { code: str("STRANGER1") } } },
  { update: { name: NAME(`boards/${testBoard}/devices/${stranger.uid}`), fields: { code: str("STRANGER1") } } },
] });
check("Stranger: can't take over an existing board by re-creating its code", denied(s), s);
s = await call(stranger, "DELETE", `boards/${testBoard}/devices/${owner.uid}`);
check("Stranger: can't remove a family's device", denied(s), s);

// --- Removing a device -------------------------------------------------------
s = await call(owner, "DELETE", `boards/${testBoard}/devices/${joiner.uid}`);
check("Member: can remove another device", s === 200, s);
s = await call(joiner, "GET", `boards/${testBoard}/tasks`);           check("Removed device: loses access", denied(s), s);

// --- Clean up what the rules allow; the board doc itself can't be deleted by design
await call(owner, "DELETE", `boards/${testBoard}/tasks/t1`);
await call(owner, "DELETE", `boards/${testBoard}/devices/${owner.uid}`);

console.log(`\n${failures === 0 ? "All rules checks passed." : `${failures} check(s) FAILED.`}`);
console.log(`Leftover test docs to remove with owner access: boards/${testBoard} and boards/${testBoard}/private/access`);
process.exit(failures === 0 ? 0 : 1);
