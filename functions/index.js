// ============================================================================
// HARMONEE SERVER JOBS (functions/index.js) · Cloud Functions, europe-west2
//
// Google Calendar (and Outlook / iCloud) into harmonee, read-only (agreed
// with Steven, 11 Nov). Each person pastes their calendar's private iCal
// link in Settings. The links are kept in boards/{board}/private/calendarLinks,
// which devices can write but never read back (rules); only this server
// reads them. Their events are written to boards/{board}/externalEvents/{key}
// (devices can read, never write), one document per person.
//
//   refreshCalendars  - called by the app: when the calendar is open and the
//                       last check is over 10 minutes old, when ↻ is tapped,
//                       and just after a link is added. At most once a minute
//                       per board.
//   hourlyCalendars   - a backstop once an hour, so a calendar is roughly up
//                       to date when someone opens harmonee.
//
// Cost: a family is a few thousand runs a month, inside the free allowance.
// ============================================================================
"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const ics = require("./ics.js");

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "europe-west2", maxInstances: 3, memory: "256MiB", timeoutSeconds: 60 });

const MIN_GAP_MS = 60 * 1000;       // a board is checked at most once a minute
const FETCH_TIMEOUT_MS = 15 * 1000;
const MAX_BYTES = 5 * 1024 * 1024;  // a feed bigger than this is refused
const PAST_DAYS = 31;               // events from a month ago...
const FUTURE_DAYS = 400;            // ...to a year ahead (and a bit)
const MAX_EVENTS = 1500;            // per person (keeps each document small)

const keyOf = (name) => String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "person";
const dayKey = (d) => d.toISOString().slice(0, 10);

// Fetch a feed, with a time limit and a size limit
async function fetchFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "harmonee-calendar/1.0", Accept: "text/calendar, */*" } });
    if (res.status === 404 || res.status === 403 || res.status === 401) throw new Error("not-found");
    if (!res.ok) throw new Error(`http-${res.status}`);
    // Where it ended up must still be a calendar host
    if (!ics.checkLink(res.url || url).ok) throw new Error("not-calendar");
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { ctrl.abort(); throw new Error("too-big"); }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks.map(c => Buffer.from(c))).toString("utf8");
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("not-calendar");
    return text;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// What a family sees when a link doesn't work
const PROBLEM_WORDS = {
  "not-found": "Google says that link doesn't work any more. It may have been reset: copy the Secret address again.",
  "not-calendar": "That link isn't a calendar any more.",
  "too-big": "That calendar is too big to bring in.",
  "timeout": "Google didn't answer in time. We'll try again shortly.",
};
const wordsFor = (e) => PROBLEM_WORDS[e.message] || "We couldn't read that calendar just now. We'll try again shortly.";

// Read every linked calendar for one board and save each person's events
async function refreshBoard(boardId, why) {
  const linksSnap = await db.doc(`boards/${boardId}/private/calendarLinks`).get();
  const links = (linksSnap.exists && linksSnap.data().links) || {};
  const settings = (await db.doc(`boards/${boardId}`).get()).data() || {};
  const tz = (settings.settings && settings.settings.timeZone) || "Europe/London";
  const now = new Date();
  const from = new Date(now.getTime() - PAST_DAYS * 86400000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 86400000);
  const results = [];

  const wanted = new Set();
  for (const [key, link] of Object.entries(links)) {
    if (!link || !link.url || !link.member) continue;
    const docKey = keyOf(key);
    wanted.add(docKey);
    const ref = db.doc(`boards/${boardId}/externalEvents/${docKey}`);
    const checked = ics.checkLink(link.url);
    if (!checked.ok) {
      await ref.set({ member: link.member, ok: false, problem: "That doesn't look like a calendar link.", checkedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      results.push({ member: link.member, ok: false });
      continue;
    }
    try {
      const text = await fetchFeed(checked.url);
      const out = ics.toHarmoneeEvents(text, { member: link.member, tz, fromKey: dayKey(from), toKey: dayKey(to), max: MAX_EVENTS });
      await ref.set({
        member: link.member, kind: checked.kind, ok: true, problem: null,
        events: out.events, count: out.count, capped: out.skipped > 0,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      results.push({ member: link.member, ok: true, count: out.count });
    } catch (e) {
      // Keep the events we had; just say what went wrong
      await ref.set({ member: link.member, ok: false, problem: wordsFor(e), checkedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      results.push({ member: link.member, ok: false });
      logger.warn("Calendar fetch failed", { boardId, member: link.member, why, error: e.message });
    }
  }

  // Someone disconnected: their events go
  const existing = await db.collection(`boards/${boardId}/externalEvents`).listDocuments();
  await Promise.all(existing.filter(d => !wanted.has(d.id)).map(d => d.delete()));

  await db.doc(`boards/${boardId}/private/calendarSync`).set({ lastRun: Date.now(), why }, { merge: true });
  return results;
}

// ---- Called by the app --------------------------------------------------------------------------
exports.refreshCalendars = onCall(async (req) => {
  const uid = req.auth && req.auth.uid;
  const boardId = String((req.data && req.data.boardId) || "");
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(boardId)) throw new HttpsError("invalid-argument", "Which board?");
  // Only a device that has joined the board
  const device = await db.doc(`boards/${boardId}/devices/${uid}`).get();
  if (!device.exists) throw new HttpsError("permission-denied", "This device hasn't joined that board.");
  // At most once a minute per board
  const syncRef = db.doc(`boards/${boardId}/private/calendarSync`);
  const ok = await db.runTransaction(async (tx) => {
    const s = await tx.get(syncRef);
    const last = (s.exists && s.data().lastRun) || 0;
    if (Date.now() - last < MIN_GAP_MS) return false;
    tx.set(syncRef, { lastRun: Date.now() }, { merge: true });
    return true;
  });
  if (!ok) return { ok: true, tooSoon: true };
  const results = await refreshBoard(boardId, (req.data && req.data.why) || "app");
  return { ok: true, results };
});

// ---- Once an hour, every board with a linked calendar ---------------------------------------------
exports.hourlyCalendars = onSchedule({ schedule: "every 60 minutes", timeZone: "Europe/London" }, async () => {
  const boards = await db.collection("boards").listDocuments();
  for (const b of boards) {
    try {
      const links = await db.doc(`boards/${b.id}/private/calendarLinks`).get();
      if (!links.exists || !Object.keys(links.data().links || {}).length) continue;
      const sync = await db.doc(`boards/${b.id}/private/calendarSync`).get();
      // Checked by someone looking at it in the last half hour: leave it
      if (sync.exists && Date.now() - (sync.data().lastRun || 0) < 30 * 60 * 1000) continue;
      await refreshBoard(b.id, "hourly");
    } catch (e) {
      logger.warn("Hourly calendar check failed", { board: b.id, error: e.message });
    }
  }
});
