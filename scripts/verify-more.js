// ============================================================================
// MORE BUILD CHECKS (scripts/verify-more.js), run by scripts/verify-build.js
//   6. Every script parses (node --check), not only the ones index.html loads
//   7. Every file the pages, modules, stylesheets and manifest point at exists
//   8. No two classic scripts declare the same top-level name (the later one
//      silently replaces the earlier: two different getTaskRoutineInfo did)
//   9. No name is used that nothing defines (ESLint's no-undef, run through
//      npx: nothing is installed in the project)
//  10. The scripts/test-*.js tests pass
// Each returns a list of problems; an empty list means it passed.
// ============================================================================
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ESLINT = "eslint@9.39.1";
const ROOT = path.resolve(__dirname, "..");
const rel = (p) => path.relative(ROOT, p);
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const jsIn = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".js") || f.endsWith(".mjs")).map(f => path.posix.join(dir, f));

// Pages and the scripts they load, split into classic scripts and modules
function pageScripts() {
  const pages = ["index.html", "list.html"].filter(p => fs.existsSync(path.join(ROOT, p)));
  const classic = new Set();
  const modules = new Set();
  pages.forEach(page => {
    for (const m of read(page).matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/g)) {
      const src = m[2].split("?")[0];
      if (/^https?:/.test(src)) continue;
      (/type="module"/.test(m[1]) ? modules : classic).add(src.replace(/^\//, ""));
    }
  });
  // Files a module imports are modules too
  const queue = [...modules];
  while (queue.length) {
    const file = queue.shift();
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    for (const m of read(file).matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
      if (/^https?:/.test(m[1])) continue;
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1].split("?")[0]));
      if (!modules.has(dep)) { modules.add(dep); queue.push(dep); }
    }
  }
  return { pages, classic: [...classic], modules: [...modules] };
}

// 6. Every script parses
function checkSyntax() {
  const { modules } = pageScripts();
  const files = [...jsIn("js"), ...jsIn("scripts"), "app.js", "sw.js", "recipes-data.js"].filter(f => fs.existsSync(path.join(ROOT, f)));
  const problems = [];
  for (const f of [...new Set(files)]) {
    const asModule = modules.includes(f) || f.endsWith(".mjs");
    const r = asModule
      ? spawnSync(process.execPath, ["--input-type=module", "--check"], { input: read(f), encoding: "utf8" })
      : spawnSync(process.execPath, ["--check", path.join(ROOT, f)], { encoding: "utf8" });
    if (r.status !== 0) problems.push(`${f}: ${(r.stderr || "").split("\n").find(l => /Error/.test(l)) || "doesn't parse"}`);
  }
  return { problems, count: new Set(files).size };
}

// 7. Every referenced file exists
function checkFilesExist() {
  const { pages, modules } = pageScripts();
  const problems = [];
  const local = (ref) => ref && !/^(https?:|data:|mailto:|tel:|#|javascript:|blob:)/.test(ref) && !ref.includes("${");
  const exists = (from, ref) => {
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) return true;
    const abs = clean.startsWith("/") ? path.join(ROOT, clean) : path.join(ROOT, path.dirname(from), clean);
    return fs.existsSync(abs);
  };
  pages.forEach(page => {
    for (const m of read(page).matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (local(m[1]) && !exists(page, m[1])) problems.push(`${page} points at ${m[1].split("?")[0]}, which doesn't exist`);
    }
  });
  modules.forEach(file => {
    if (!fs.existsSync(path.join(ROOT, file))) { problems.push(`${file} is loaded as a module but doesn't exist`); return; }
    for (const m of read(file).matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
      if (local(m[1]) && !exists(file, m[1])) problems.push(`${file} imports ${m[1].split("?")[0]}, which doesn't exist`);
    }
  });
  const sheets = ["style.css", ...fs.readdirSync(path.join(ROOT, "css")).filter(f => f.endsWith(".css")).map(f => `css/${f}`)];
  sheets.forEach(file => {
    for (const m of read(file).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (local(m[1]) && !exists(file, m[1])) problems.push(`${file} uses ${m[1]}, which doesn't exist`);
    }
  });
  const manifest = "manifest.webmanifest";
  if (fs.existsSync(path.join(ROOT, manifest))) {
    try {
      const json = JSON.parse(read(manifest));
      [...(json.icons || []), ...(json.screenshots || [])].forEach(i => { if (local(i.src) && !exists(manifest, i.src)) problems.push(`${manifest} lists ${i.src}, which doesn't exist`); });
    } catch (e) { problems.push(`${manifest} isn't valid JSON: ${e.message}`); }
  }
  return { problems };
}

// Top-level names a classic script declares (they all share one global scope)
function topLevelNames(file) {
  return [...read(file).matchAll(/^(?:async\s+)?(let|const|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => ({ kind: m[1], name: m[2] }));
}

// 8. No duplicate top-level names across classic scripts on the same page
function checkDuplicates() {
  const { classic } = pageScripts();
  const seen = new Map();
  classic.filter(f => fs.existsSync(path.join(ROOT, f))).forEach(file => {
    topLevelNames(file).forEach(({ name }) => {
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(file);
    });
  });
  const problems = [];
  seen.forEach((files, name) => { if (files.length > 1) problems.push(`'${name}' is declared in ${files.join(" and ")}: the later one replaces the earlier`); });
  return { problems };
}

// 9. No undefined names (ESLint no-undef)
async function checkUndefinedNames() {
  let nm;
  try {
    const bin = execFileSync("npx", ["--yes", "-p", ESLINT, "-c", "command -v eslint"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    nm = path.resolve(fs.realpathSync(bin), "../../..");
  } catch (e) {
    return { problems: [`Couldn't get ${ESLINT} through npx (needs the internet the first time): ${String(e.message).split("\n")[0]}`] };
  }
  const { ESLint } = require(path.join(nm, "eslint"));
  const browserGlobals = require(path.join(nm, "globals"));
  const { classic, modules } = pageScripts();
  const allJs = [...new Set([...classic, ...modules, ...jsIn("js")])].filter(f => fs.existsSync(path.join(ROOT, f)) && f !== "js/build-info.js");

  // What the scripts share with each other: window.x = …, Object.assign(window, { … }),
  // and every classic script's top-level names
  const shared = { module: "readonly", HARMONEE_BUILD: "readonly" };
  allJs.forEach(file => {
    const src = read(file);
    for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) shared[m[1]] = "writable";
    for (const block of src.matchAll(/Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
      for (const m of block[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=[:,]|$)/gm)) shared[m[1]] = "writable";
    }
    if (!modules.includes(file)) topLevelNames(file).forEach(({ name }) => { shared[name] = "writable"; });
  });
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...browserGlobals.browser, ...browserGlobals.es2021, ...shared } }, rules: { "no-undef": "error" } },
      { files: modules, languageOptions: { sourceType: "module" } }
    ]
  });
  const results = await eslint.lintFiles(allJs);
  const problems = [];
  results.forEach(r => r.messages.forEach(m => problems.push(`${rel(r.filePath)}:${m.line} ${m.message}`)));
  return { problems, count: allJs.length };
}

// 10. The tests
function runTests() {
  const tests = fs.readdirSync(__dirname).filter(f => /^test-.*\.js$/.test(f));
  const problems = [];
  tests.forEach(t => {
    const r = spawnSync(process.execPath, [path.join(__dirname, t)], { encoding: "utf8", timeout: 120000 });
    if (r.status !== 0) problems.push(`scripts/${t} failed:\n${((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-8).map(l => "        " + l).join("\n")}`);
  });
  return { problems, count: tests.length };
}

module.exports = { checkSyntax, checkFilesExist, checkDuplicates, checkUndefinedNames, runTests, pageScripts };
