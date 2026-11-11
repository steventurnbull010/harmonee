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

// --- Photos of the family's own dishes (recipePhotos) ------------------------
const tinyJpeg = "data:image/jpeg;base64," + "A".repeat(400);
s = await call(owner, "PATCH", `boards/${testBoard}/recipePhotos/family-1`, { fields: { data: str(tinyJpeg) } });
check("Member: can save a dish photo", s === 200, s);
s = await call(owner, "GET", `boards/${testBoard}/recipePhotos/family-1`);  check("Member: can read a dish photo", s === 200, s);
s = await call(owner, "PATCH", `boards/${testBoard}/recipePhotos/family-big`, { fields: { data: str("data:image/jpeg;base64," + "Ab9+/".repeat(75990)) } });
check("Member: a full-size photo (about 380,000 characters) saves", s === 200, s);
await call(owner, "DELETE", `boards/${testBoard}/recipePhotos/family-big`);
s = await call(stranger, "GET", `boards/${testBoard}/recipePhotos/family-1`); check("Stranger: can't read a dish photo", denied(s), s);
s = await call(stranger, "PATCH", `boards/${testBoard}/recipePhotos/family-2`, { fields: { data: str(tinyJpeg) } });
check("Stranger: can't save a dish photo", denied(s), s);
s = await call(stranger, "GET", "boards/turnbull/recipePhotos");     check("Stranger: can't list Turnbull dish photos", denied(s), s);
s = await call(owner, "PATCH", `boards/${testBoard}/recipePhotos/family-3`, { fields: { data: str("data:image/jpeg;base64," + "A".repeat(400001)) } });
check("Member: a photo over 400,000 characters is refused", denied(s), s);
s = await call(owner, "PATCH", `boards/${testBoard}/recipePhotos/family-4`, { fields: { data: str("<script>not a photo</script>") } });
check("Member: something that isn't a JPEG is refused", denied(s), s);
s = await call(owner, "PATCH", `boards/${testBoard}/recipePhotos/family-5`, { fields: { data: str(tinyJpeg), extra: str("x") } });
check("Member: a dish photo holds only the photo", denied(s), s);
s = await call(owner, "DELETE", `boards/${testBoard}/recipePhotos/family-1`); check("Member: can delete a dish photo", s === 200, s);

// --- Linked calendars (Google Calendar, read-only; 11 Nov) -------------------
const linkBody = { fields: { links: { mapValue: { fields: { sam: { mapValue: { fields: { member: str("Sam"), url: str("https://calendar.google.com/calendar/ical/a/private-b/basic.ics") } } } } } } } };
s = await call(owner, "PATCH", `boards/${testBoard}/private/calendarLinks`, linkBody);
check("Member: can save a calendar link", s === 200, s);
s = await call(owner, "GET", `boards/${testBoard}/private/calendarLinks`);
check("Member: can't read calendar links back (only the server can)", denied(s), s);
s = await call(stranger, "PATCH", `boards/${testBoard}/private/calendarLinks`, linkBody);
check("Stranger: can't save a calendar link", denied(s), s);
s = await call(owner, "PATCH", `boards/${testBoard}/private/calendarLinks`, { fields: { links: linkBody.fields.links, other: str("x") } });
check("Member: can't add other fields to the links", denied(s), s);
s = await call(owner, "DELETE", `boards/${testBoard}/private/calendarLinks`);
check("Member: can't delete the links document", denied(s), s);
s = await call(owner, "GET", `boards/${testBoard}/private/calendarSync`);
check("Member: can't read the server's sync note", denied(s), s);
s = await call(owner, "GET", `boards/${testBoard}/externalEvents/sam`);
check("Member: can read linked calendar events", ok(s), s);
s = await call(owner, "PATCH", `boards/${testBoard}/externalEvents/sam`, { fields: { member: str("Sam") } });
check("Member: can't write linked calendar events (only the server can)", denied(s), s);
s = await call(stranger, "GET", `boards/${testBoard}/externalEvents/sam`);
check("Stranger: can't read linked calendar events", denied(s), s);

// --- List-only links (sharedLists) -----------------------------------------
const shareKey = `rulestest${Date.now().toString(36)}abcdefgh`.slice(0, 24);
const listCopy = (board) => ({ fields: { boardId: str(board), listId: str("l1"), title: str("Test list"), emoji: str("📋"), color: str("sky"), items: { arrayValue: { values: [] } } } });
s = await call(stranger, "PATCH", `sharedLists/${shareKey}`, listCopy(testBoard));
check("Stranger: can't make a list link for a board it isn't on", denied(s), s);
s = await call(stranger, "PATCH", `sharedLists/${shareKey}`, listCopy("turnbull"));
check("Stranger: can't make a list link for the Turnbull board", denied(s), s);
s = await call(owner, "PATCH", `sharedLists/${shareKey}`, listCopy(testBoard));
check("Member: can make a list link", s === 200, s);
s = await call(owner, "PATCH", `sharedLists/${shareKey}`, { fields: { ...listCopy(testBoard).fields, secret: str("x") } });
check("Member: a list link holds only the list", denied(s), s);
s = await call(stranger, "GET", `sharedLists/${shareKey}`);          check("Link holder: can read that one list", s === 200, s);
s = await call(stranger, "GET", "sharedLists");                      check("Link holder: can't list other links", denied(s), s);
s = await call(stranger, "PATCH", `sharedLists/${shareKey}`, listCopy(testBoard));
check("Link holder: can't change the list copy itself", denied(s), s);
const addOp = { fields: { type: str("add"), texts: { arrayValue: { values: [str("Milk")] } } } };
const withTime = (op) => ({ writes: [{ update: { name: NAME(`sharedLists/${shareKey}/ops/op${Date.now()}`), fields: op.fields }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }] });
s = await call(stranger, "POST", ":commit", withTime(addOp));
check("Link holder: can leave an 'add' note", s === 200, s);
s = await call(stranger, "POST", ":commit", withTime({ fields: { type: str("deleteList") } }));
check("Link holder: other kinds of note are refused", denied(s), s);
s = await call(stranger, "POST", ":commit", withTime({ fields: { ...addOp.fields, extra: str("x") } }));
check("Link holder: notes with extra fields are refused", denied(s), s);
s = await call(stranger, "GET", `sharedLists/${shareKey}/ops`);      check("Link holder: can't read other people's notes", denied(s), s);
s = await call(stranger, "GET", `boards/${testBoard}`);              check("Link holder: still can't read the board", denied(s), s);
s = await call(owner, "GET", `sharedLists/${shareKey}/ops`);         check("Member: can read the notes", s === 200, s);
s = await call(stranger, "DELETE", `sharedLists/${shareKey}`);       check("Link holder: can't switch the link off", denied(s), s);
s = await call(owner, "DELETE", `sharedLists/${shareKey}`);          check("Member: can switch the link off", s === 200, s);
s = await call(stranger, "POST", ":commit", withTime(addOp));
check("Switched off: no more notes", denied(s), s);

// --- Clean up what the rules allow; the board doc itself can't be deleted by design
await call(owner, "DELETE", `boards/${testBoard}/tasks/t1`);
await call(owner, "DELETE", `boards/${testBoard}/devices/${owner.uid}`);

console.log(`\n${failures === 0 ? "All rules checks passed." : `${failures} check(s) FAILED.`}`);
console.log(`Leftover test docs to remove with owner access: boards/${testBoard} and boards/${testBoard}/private/access`);
process.exit(failures === 0 ? 0 : 1);
