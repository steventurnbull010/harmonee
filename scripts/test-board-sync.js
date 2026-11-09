#!/usr/bin/env node
// Two devices saving to the same board at the same time must both keep their
// changes (js/board-sync.js). Runs two separate copies of board-sync.js, as
// two tablets, against a small fake Firestore that behaves like the real one
// for what's used here: updates by field path, deleteField, and transactions
// that are retried when another device saved in between.
// Run: node scripts/test-board-sync.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const code = fs.readFileSync(path.join(__dirname, "..", "js", "board-sync.js"), "utf8");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const tick = () => new Promise(r => setImmediate(r));

// ---- A fake Firestore holding one board doc --------------------------------------------
function makeServer(initial) {
  const server = { data: JSON.parse(JSON.stringify(initial)), version: 0, commits: 0, retries: 0 };
  const DEL = { __del: true };
  function setPath(obj, segs, value) {
    let o = obj;
    for (let i = 0; i < segs.length - 1; i++) {
      if (!o[segs[i]] || typeof o[segs[i]] !== "object") o[segs[i]] = {};
      o = o[segs[i]];
    }
    if (value === DEL) delete o[segs[segs.length - 1]]; else o[segs[segs.length - 1]] = JSON.parse(JSON.stringify(value));
  }
  server.apply = (args) => {
    for (let i = 0; i < args.length; i += 2) setPath(server.data, args[i].segments, args[i + 1]);
    server.version++;
  };
  server.firestoreFor = (device) => ({
    db: {},
    doc: () => ({}),
    FieldPath: function FieldPath(...segs) { this.segments = segs; },
    deleteField: () => DEL,
    serverTimestamp: () => "now",
    updateDoc: async (ref, ...args) => {
      if (device.offline) { device.waiting.push(args); return; } // Firestore keeps it for later
      await tick();
      server.apply(args);
    },
    runTransaction: async (db, fn) => {
      if (device.offline) { const e = new Error("offline"); e.code = "unavailable"; throw e; }
      for (let attempt = 0; attempt < 5; attempt++) {
        const seen = server.version;
        let pending = null;
        await fn({
          get: async () => { await tick(); return { exists: () => true, data: () => JSON.parse(JSON.stringify(server.data)) }; },
          update: (ref, obj) => { pending = obj; },
          set: (ref, obj) => { pending = obj; }
        });
        await tick();
        if (server.version !== seen) { server.retries++; continue; } // someone saved meanwhile: try again
        Object.entries(pending).forEach(([k, v]) => { server.data[k] = JSON.parse(JSON.stringify(v)); });
        server.version++;
        server.commits++;
        return;
      }
      throw new Error("too many retries");
    }
  });
  return server;
}

// ---- A device: its own copy of board-sync.js and its own saved data --------------------
function makeDevice(server, name) {
  const device = { name, offline: false, waiting: [], store: {} };
  const fake = server.firestoreFor(device);
  const win = {
    ...fake,
    localStorage: { getItem: k => device.store[k] ?? null, setItem: (k, v) => { device.store[k] = String(v); } },
    getSaveBoardId: () => "test-board",
    isOffline: () => device.offline,
    addEventListener: () => {},
    console: { warn() {}, log: console.log },
    setTimeout: () => 0, clearTimeout: () => {},
    JSON, Object, Array, Map, Set, String, Date, Math, Promise
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(code.replace("typeof window !== \"undefined\" ? window : globalThis", "window"), win);
  device.sync = win.BoardSync;
  device.reconnect = async () => {
    device.offline = false;
    for (const args of device.waiting.splice(0)) server.apply(args);
    await device.sync.flush();
  };
  return device;
}
const copy = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  // ---- Meals: two tablets plan different days at once ----------------------------------
  {
    const start = { meals: { "2026-11-09": { title: "Tacos", cook: "Steven" } } };
    const server = makeServer(start);
    const a = makeDevice(server, "kitchen"), b = makeDevice(server, "phone");
    a.sync.setBaseline("meals", start.meals); b.sync.setBaseline("meals", start.meals);
    const aMeals = copy(start.meals); aMeals["2026-11-10"] = { title: "Pasta" };
    const bMeals = copy(start.meals); bMeals["2026-11-11"] = { title: "Curry" };
    a.sync.saveMapChanges("meals", aMeals, 2); b.sync.saveMapChanges("meals", bMeals, 2);
    await tick(); await tick();
    check("meals: both new days kept", Object.keys(server.data.meals).sort(), ["2026-11-09", "2026-11-10", "2026-11-11"]);

    // Same day, different parts: one changes the cook, the other the title
    const a2 = copy(server.data.meals); a2["2026-11-09"].cook = "Sorcha";
    const b2 = copy(server.data.meals); b2["2026-11-09"].title = "Fajitas";
    a.sync.setBaseline("meals", server.data.meals); b.sync.setBaseline("meals", server.data.meals);
    a.sync.saveMapChanges("meals", a2, 2); b.sync.saveMapChanges("meals", b2, 2);
    await tick(); await tick();
    check("meals: same day, both edits kept", server.data.meals["2026-11-09"], { title: "Fajitas", cook: "Sorcha" });

    // Removing a day removes just that day
    const a3 = copy(server.data.meals); delete a3["2026-11-10"];
    a.sync.setBaseline("meals", server.data.meals);
    a.sync.saveMapChanges("meals", a3, 2);
    await tick(); await tick();
    check("meals: removed day gone, others kept", Object.keys(server.data.meals).sort(), ["2026-11-09", "2026-11-11"]);
  }

  // ---- Events: two tablets add, edit and delete at once ---------------------------------
  {
    const start = { events: [{ id: "e1", title: "Swimming" }, { id: "e2", title: "Dentist" }, { id: "e3", title: "Party" }] };
    const server = makeServer(start);
    const a = makeDevice(server, "kitchen"), b = makeDevice(server, "phone");
    a.sync.setBaseline("events", start.events); b.sync.setBaseline("events", start.events);
    const aEvents = copy(start.events).filter(e => e.id !== "e3"); aEvents.push({ id: "e4", title: "Football" });
    const bEvents = copy(start.events); bEvents[1].title = "Dentist (moved)"; bEvents.push({ id: "e5", title: "Cinema" });
    a.sync.saveListChanges("events", aEvents); b.sync.saveListChanges("events", bEvents);
    for (let i = 0; i < 10; i++) await tick();
    check("events: both devices' changes kept", server.data.events.map(e => `${e.id}:${e.title}`),
      ["e1:Swimming", "e2:Dentist (moved)", "e4:Football", "e5:Cinema"]);
    check("events: a clash was retried, not lost", server.retries >= 1, true);
    check("events: nothing left waiting", [a.sync.pendingCount(), b.sync.pendingCount()], [0, 0]);
  }

  // ---- Reward redemptions: two kids redeem at the same moment ----------------------------
  {
    const server = makeServer({ rewardRedemptions: [] });
    const a = makeDevice(server, "kitchen"), b = makeDevice(server, "phone");
    a.sync.setBaseline("rewardRedemptions", []); b.sync.setBaseline("rewardRedemptions", []);
    a.sync.saveListChanges("rewardRedemptions", [{ id: "r1", member: "Ava", cost: 10 }]);
    b.sync.saveListChanges("rewardRedemptions", [{ id: "r2", member: "Dara", cost: 5 }]);
    for (let i = 0; i < 10; i++) await tick();
    check("redemptions: both kept", server.data.rewardRedemptions.map(r => r.id).sort(), ["r1", "r2"]);
  }

  // ---- Offline: the change waits, shows on top of the board, and saves on reconnect -------
  {
    const start = { events: [{ id: "e1", title: "Swimming" }] };
    const server = makeServer(start);
    const a = makeDevice(server, "kitchen"), b = makeDevice(server, "phone");
    a.sync.setBaseline("events", start.events); b.sync.setBaseline("events", start.events);
    a.offline = true;
    a.sync.saveListChanges("events", [...start.events, { id: "e2", title: "Added offline" }]);
    b.sync.saveListChanges("events", [...start.events, { id: "e3", title: "Added on the phone" }]);
    for (let i = 0; i < 10; i++) await tick();
    check("offline: waiting on the device", a.sync.pendingCount(), 1);
    check("offline: shown on top of the board's list", a.sync.withPending("events", server.data.events).map(e => e.id), ["e1", "e3", "e2"]);
    await a.reconnect();
    for (let i = 0; i < 10; i++) await tick();
    check("offline: saved on reconnecting, phone's event kept", server.data.events.map(e => e.id), ["e1", "e3", "e2"]);
    check("offline: nothing left waiting", a.sync.pendingCount(), 0);
  }

  // ---- Settings: only what changed is written ---------------------------------------------
  {
    const s = makeDevice(makeServer({}), "x").sync;
    const before = { gameMode: "points", currency: "£", sleepStartTime: "21:00" };
    const after = { gameMode: "money", currency: "£", sleepStartTime: "21:00" };
    check("settings: only the changed one", s.diffMap(["settings"], before, after, 1), [[["settings", "gameMode"], "money"]]);
    check("settings: nothing changed, nothing written", s.diffMap(["settings"], before, copy(before), 1), []);
  }

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
