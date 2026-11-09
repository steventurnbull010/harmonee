#!/usr/bin/env node
// Checks live sync comes back after an error: both listeners are closed, the
// device tries again after growing pauses (5s, 15s, 1 min, 2 min, then 5 min),
// tries at once when the screen wakes, waits while offline, and starts from
// the shortest pause again once a snapshot arrives.
// Pulls the real functions out of app.js by name and runs them with a fake clock.
// Run: node scripts/test-sync-recovery.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extract(name) {
  const start = src.search(new RegExp(`(async )?function ${name}\\(`));
  if (start === -1) throw new Error(`${name} not found in app.js`);
  let i = src.indexOf("{", src.indexOf(")", start)), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}
const delays = src.match(/const LIVE_SYNC_RETRY_DELAYS = (\[[^\]]*\]);/)[1];

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

// A small world for the functions to run in
const world = new Function("env", `
  let { setTimeout, clearTimeout, document, window, ensureBoardAccess, listenToFirestoreTasks, loadLocalTasks } = env;
  let firestoreUnsubscribe = env.unsubTasks, firestoreBoardUnsubscribe = env.unsubBoard;
  let db = {}, firebaseApp = {};
  const console = { warn() {}, error() {} }; // the failed tries are expected here
  const LIVE_SYNC_RETRY_DELAYS = ${delays};
  let liveSyncBroken = false, liveSyncAttempt = 0, liveSyncTimer = null, liveSyncRestarting = false;
  ${["setSyncStatus", "liveSyncFailed", "scheduleLiveSyncRestart", "restartLiveSync", "noteLiveSyncWorking", "retryLiveSyncSoon"].map(extract).join("\n")}
  return { liveSyncFailed, noteLiveSyncWorking, retryLiveSyncSoon, state: () => ({ liveSyncBroken, liveSyncAttempt, tasks: !!firestoreUnsubscribe, board: !!firestoreBoardUnsubscribe }) };
`);

function setup({ failTimes = 0 } = {}) {
  const timers = [];
  const env = {
    timers,
    status: "",
    closed: [],
    listened: 0,
    joins: 0,
    offline: false,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (id) => { if (id && timers[id - 1]) timers[id - 1].cleared = true; },
    document: { getElementById: (id) => id === "sync-status-text" ? { set textContent(t) { env.status = t; } } : null },
    window: { isOffline: () => env.offline },
    ensureBoardAccess: async () => { env.joins++; if (env.joins <= failTimes) throw new Error("no luck yet"); },
    listenToFirestoreTasks: () => { env.listened++; },
    loadLocalTasks: () => {},
    unsubTasks: () => env.closed.push("tasks"),
    unsubBoard: () => env.closed.push("board")
  };
  env.api = world(env);
  // Run the next waiting timer; returns its pause
  env.tick = async () => {
    const t = timers.find(x => !x.cleared && !x.ran);
    if (!t) return null;
    t.ran = true;
    await t.fn();
    return t.ms;
  };
  return env;
}

(async () => {
  // An error: both listeners closed, "Reconnecting…", first try after 5s
  let e = setup({ failTimes: 3 });
  e.api.liveSyncFailed(new Error("permission-denied"));
  check("both listeners closed", e.closed, ["tasks", "board"]);
  check("status while waiting", e.status, "Reconnecting…");
  const pauses = [];
  for (let i = 0; i < 4; i++) pauses.push(await e.tick());
  check("pauses grow: 5s, 15s, 1 min, 2 min", pauses, [5000, 15000, 60000, 120000]);
  check("4th try works: listening again", [e.listened, e.status, e.api.state().liveSyncBroken], [1, "Live Sync", false]);

  // Lots of failures: settles on every 5 minutes
  e = setup({ failTimes: 50 });
  e.api.liveSyncFailed(new Error("x"));
  const later = [];
  for (let i = 0; i < 8; i++) later.push(await e.tick());
  check("then every 5 minutes", later.slice(4), [300000, 300000, 300000, 300000]);

  // Screen wakes: try straight away instead of waiting
  e = setup({ failTimes: 0 });
  e.api.liveSyncFailed(new Error("x"));
  e.api.retryLiveSyncSoon();
  check("screen wakes: next try is now", await e.tick(), 0);
  check("…and it's listening", e.listened, 1);

  // Nothing broken: waking the screen does nothing
  e = setup();
  e.api.retryLiveSyncSoon();
  check("all fine: waking does nothing", e.timers.length, 0);

  // Offline: don't burn tries; the "online" event brings it back
  e = setup({ failTimes: 0 });
  e.api.liveSyncFailed(new Error("x"));
  e.offline = true;
  await e.tick();
  check("offline: no try made", [e.joins, e.api.state().liveSyncAttempt], [0, 0]);
  e.offline = false;
  e.api.retryLiveSyncSoon();
  await e.tick();
  check("back online: reconnects", e.listened, 1);

  // A snapshot after recovering: the next problem starts from 5s again
  e = setup({ failTimes: 2 });
  e.api.liveSyncFailed(new Error("x"));
  await e.tick(); await e.tick(); await e.tick();
  e.api.noteLiveSyncWorking();
  e.api.liveSyncFailed(new Error("again"));
  check("after a good snapshot, back to 5s", await e.tick(), 5000);

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
