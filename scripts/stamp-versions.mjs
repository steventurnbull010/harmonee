// ============================================================================
// STAMP VERSIONS (scripts/stamp-versions.mjs)
// Sets every cache-busting ?v= from the file's own content (first 8 characters
// of its SHA-1), so a changed file always gets a new URL and an unchanged one
// keeps its cached copy. No more bumping numbers by hand.
//   - index.html: <link href> / <script src> / icons / manifest
//   - module imports inside JS files (js/meals.js -> recipes-data.js -> recipes-themealdb.js)
//   - icon links inside manifest.webmanifest
// Also writes js/build-info.js (the build shown at the bottom of Settings): an
// id from the content of every file, and the time that id last changed.
//
//   node scripts/stamp-versions.mjs           rewrite the files
//   node scripts/stamp-versions.mjs --check   change nothing; exit 1 if anything is out of date
// No installs needed. Not deployed (scripts/** is ignored by Hosting).
// ============================================================================
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const BUILD_INFO = "js/build-info.js";

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const sha = (text) => createHash("sha1").update(text).digest("hex");
const shortHash = (rel) => sha(readFileSync(join(ROOT, rel))).slice(0, 8);
// "../recipes-data.js" from "js/meals.js" -> "recipes-data.js"; "/icons/x.png" -> "icons/x.png"
const resolveFrom = (fromRel, ref) => ref.startsWith("/") ? ref.slice(1) : posix.normalize(posix.join(posix.dirname(fromRel), ref));

// Files whose contents mention other files' versions, in memory while we work
const files = new Map();
const load = (rel) => { if (!files.has(rel)) files.set(rel, read(rel)); return files.get(rel); };
const hashOf = (rel) => (files.has(rel) ? sha(files.get(rel)).slice(0, 8) : shortHash(rel));

// A local file reference followed by ?v=… inside quotes
const REF = /(["'])((?:\.{0,2}\/)?[A-Za-z0-9_\-./]+\.(?:js|mjs|css|webmanifest|png|svg|ico|json))\?v=([A-Za-z0-9]+)(["'])/g;
function restamp(rel) {
  const before = load(rel);
  const after = before.replace(REF, (m, q1, ref, v, q2) => {
    if (/^(https?:)?\/\//.test(ref)) return m;
    const target = resolveFrom(rel, ref);
    if (!files.has(target) && !existsSync(join(ROOT, target))) return m; // (files we're about to write count)
    return `${q1}${ref}?v=${hashOf(target)}${q2}`;
  });
  files.set(rel, after);
  return after !== before;
}

// 1. JS modules and the manifest (they can depend on each other, so repeat until settled)
const jsFiles = ["app.js", "recipes-data.js", ...readdirSync(join(ROOT, "js")).filter(f => f.endsWith(".js")).map(f => `js/${f}`)]
  .filter(f => existsSync(join(ROOT, f)) && f !== BUILD_INFO);
const inner = [...jsFiles, "manifest.webmanifest"].filter(f => existsSync(join(ROOT, f)) && REF.test(read(f)) && (REF.lastIndex = 0, true));
for (let pass = 0; pass < 10; pass++) {
  let changed = false;
  inner.forEach(f => { if (restamp(f)) changed = true; });
  if (!changed) break;
}

// 2. The build: one id for everything (index.html counted without its ?v= numbers)
const html = load("index.html");
const referenced = new Set();
for (const m of html.matchAll(REF)) {
  const t = resolveFrom("index.html", m[2]);
  if (existsSync(join(ROOT, t)) && t !== BUILD_INFO) referenced.add(t);
}
inner.forEach(f => referenced.add(f));
const fingerprint = [...referenced].sort().map(f => `${f}:${hashOf(f)}`).join("\n")
  + "\n" + html.replace(/\?v=[A-Za-z0-9]+/g, "");
const buildId = sha(fingerprint).slice(0, 7);
let builtAt = null;
if (existsSync(join(ROOT, BUILD_INFO))) {
  const old = read(BUILD_INFO);
  const m = old.match(/id: "([0-9a-f]+)", builtAt: "([^"]+)"/);
  if (m && m[1] === buildId) builtAt = m[2]; // nothing changed: keep its time
}
if (!builtAt) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  builtAt = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
files.set(BUILD_INFO, `// Written by scripts/stamp-versions.mjs: don't edit by hand. Shown at the bottom of Settings.
window.HARMONEE_BUILD = { id: "${buildId}", builtAt: "${builtAt}" };
`);

// 3. index.html last, now every file it points at is final
restamp("index.html");

// Write (or, with --check, report)
const stale = [...files.entries()].filter(([rel, text]) => !existsSync(join(ROOT, rel)) || read(rel) !== text).map(([rel]) => rel);
if (CHECK) {
  if (stale.length) {
    console.error(`   ❌ Versions out of date in: ${stale.join(", ")}\n      Run: node scripts/stamp-versions.mjs`);
    process.exit(1);
  }
  console.log(`   ✅ Every ?v= matches its file (build ${buildId}).`);
} else {
  stale.forEach(rel => writeFileSync(join(ROOT, rel), files.get(rel)));
  console.log(stale.length ? `Stamped ${stale.length} file(s): ${stale.join(", ")}` : "Everything already up to date.");
  console.log(`Build ${buildId} · ${builtAt}`);
}
