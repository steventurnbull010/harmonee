#!/usr/bin/env node
/**
 * Automated Verification Script for harmonee App
 * Run before every deployment to guarantee zero syntax errors and zero runtime crashes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const appJsPath = path.join(rootDir, 'app.js');
const styleCssPath = path.join(rootDir, 'style.css');
const indexHtmlPath = path.join(rootDir, 'index.html');

console.log('🔍 Running Pre-Deploy Integrity Checks...\n');

// 1. ES Module Strict Syntax Check
console.log('1. Checking app.js ES Module syntax...');
try {
  execSync(`node --input-type=module --check < "${appJsPath}"`, { stdio: 'pipe' });
  console.log('   ✅ app.js passed ES module strict syntax check.');
} catch (err) {
  console.error('   ❌ SYNTAX ERROR in app.js:');
  console.error(err.stderr.toString());
  process.exit(1);
}

// 2. CSS Brace Balance Check (every stylesheet)
// One missing or extra brace silently breaks every rule after it: browsers
// read the rest of the file as nested inside the open rule, or drop the
// rule after a stray "}". Comments are ignored; line numbers are reported.
console.log('\n2. Checking every stylesheet\'s brace balance...');
const cssFiles = [styleCssPath, ...fs.readdirSync(path.join(__dirname, '..', 'css'))
  .filter(f => f.endsWith('.css'))
  .map(f => path.join(__dirname, '..', 'css', f))];
let cssProblems = 0;
for (const file of cssFiles) {
  const raw = fs.readFileSync(file, 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const name = path.relative(path.join(__dirname, '..'), file);
  const open = [];
  let line = 1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '\n') line++;
    else if (ch === '{') open.push(line);
    else if (ch === '}') {
      if (open.length === 0) { console.error(`   ❌ ${name}: extra closing brace on line ${line}`); cssProblems++; }
      else open.pop();
    }
  }
  open.forEach(l => { console.error(`   ❌ ${name}: block opened on line ${l} is never closed`); cssProblems++; });
}
if (cssProblems) process.exit(1);
console.log(`   ✅ ${cssFiles.length} stylesheets, all braces balanced.`);

// 3. index.html Cache Buster Check
console.log('\n3. Checking index.html script & css links...');
const html = fs.readFileSync(indexHtmlPath, 'utf8');
const cssMatch = html.match(/style\.css\?v=([A-Za-z0-9]+)/);
const jsMatch = html.match(/app\.js\?v=([A-Za-z0-9]+)/);
if (!cssMatch || !jsMatch) {
  console.error('   ❌ Missing cache buster on style.css or app.js in index.html!');
  process.exit(1);
}
console.log(`   ✅ Cache busters found: style.css?v=${cssMatch[1]}, app.js?v=${jsMatch[1]}`);
// Every ?v= must match its file's content (scripts/stamp-versions.mjs sets them)
{
  const stamp = require('child_process').spawnSync(process.execPath, [require('path').join(__dirname, 'stamp-versions.mjs'), '--check'], { encoding: 'utf8' });
  process.stdout.write(stamp.stdout || '');
  if (stamp.status !== 0) { process.stderr.write(stamp.stderr || ''); process.exit(1); }
}

// 4. Browser-faithful Boot Simulation
// Loads every local <script> from index.html in page order inside one shared
// global (like a browser tab). Classic scripts share globals; type="module"
// files get their own private scope, so anything app.js forgets to put on
// window is invisible to the js/ modules here exactly as it is in Chrome.
console.log('\n4. Booting all index.html scripts in a simulated browser...');
const vm = require('vm');

const anything = () => {
  const fn = function () {};
  return new Proxy(fn, {
    get: (t, k) => {
      if (k === 'then') return undefined;
      if (k === Symbol.iterator) return function* () {};
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      return anything();
    },
    set: () => true,
    apply: () => anything(),
    construct: () => anything()
  });
};

const store = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; }
  };
};

const boardSearch = '?board=verify-build';
const win = {
  console,
  location: { search: boardSearch, href: 'http://localhost/' + boardSearch, hostname: 'localhost', pathname: '/', origin: 'http://localhost', reload() {} },
  localStorage: store(),
  sessionStorage: store(),
  navigator: anything(),
  history: anything(),
  screen: anything(),
  document: anything(),
  setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  getComputedStyle: () => anything(),
  scrollTo: () => {},
  alert: () => {}, confirm: () => false, prompt: () => null,
  fetch: () => Promise.resolve({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
  Audio: anything(), AudioContext: anything(), webkitAudioContext: anything(),
  Image: anything(), FileReader: anything(), Notification: anything(),
  IntersectionObserver: anything(), ResizeObserver: anything(), MutationObserver: anything(),
  CustomEvent: anything(), Event: anything(), URLSearchParams, URL, TextEncoder, TextDecoder, AbortController,
  confetti: () => {}
};
win.window = win; win.self = win; win.globalThis = win; win.top = win;
const document_ = win.document;
vm.createContext(win);

const firebaseMock = {
  initializeApp: () => ({}),
  getFirestore: () => ({ __mockDb: true }),
  collection: () => ({}), doc: () => ({}), query: () => ({}), where: () => ({}),
  onSnapshot: () => () => {},
  getDocs: () => Promise.resolve({ docs: [], empty: true, forEach() {} }),
  getDoc: () => Promise.resolve({ exists: () => true, data: () => ({}) }), // device has joined
  getAuth: () => ({ currentUser: null }),
  signInAnonymously: () => Promise.resolve({ user: { uid: 'verify-build-device' } }),
  setDoc: () => Promise.resolve(), updateDoc: () => Promise.resolve(),
  deleteDoc: () => Promise.resolve(), addDoc: () => Promise.resolve({ id: 'mock' }),
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }),
  serverTimestamp: () => new Date(), arrayUnion: (...a) => a, arrayRemove: (...a) => a, increment: (n) => n,
  deleteField: () => ({ __delete: true }), FieldPath: function FieldPath(...p) { this.segments = p; }
};

const moduleCache = new Map();
function loadModule(absPath) {
  if (moduleCache.has(absPath)) return moduleCache.get(absPath);
  let code = fs.readFileSync(absPath, 'utf8');
  const exported = [];
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*(["'][^"']+["'])\s*;?/g,
    (_, names, spec) => `const {${names.replace(/\bas\b/g, ':')}} = __import(${spec}, ${JSON.stringify(absPath)});`);
  code = code.replace(/^export\s+((?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*))/gm,
    (_, decl, name) => { exported.push(name); return decl; });
  const wrapped = `(function(){"use strict";${code}\n;return {${exported.join(',')}};})()`;
  const exportsObj = new vm.Script(wrapped, { filename: absPath }).runInContext(win);
  moduleCache.set(absPath, exportsObj);
  return exportsObj;
}
win.__import = (spec, fromPath) => {
  if (/^https?:/.test(spec)) {
    if (spec.includes('firebasejs')) return firebaseMock;
    throw new Error(`Unmocked remote import: ${spec}`);
  }
  return loadModule(path.resolve(path.dirname(fromPath), spec.split('?')[0]));
};

const asyncErrors = [];
process.on('unhandledRejection', (e) => asyncErrors.push(e));

const scriptTags = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/g)]
  .map(([, attrs, src]) => ({ src: src.split('?')[0], isModule: /type="module"/.test(attrs + src) || /type="module"/.test(attrs) }))
  .filter(({ src }) => !/^https?:/.test(src));

const crash = (where, e) => {
  console.error(`   ❌ RUNTIME CRASH while loading ${where}:`, e);
  process.exit(1);
};

for (const { src, isModule } of scriptTags) {
  const abs = path.join(rootDir, src);
  try {
    if (isModule) loadModule(abs);
    else new vm.Script(fs.readFileSync(abs, 'utf8'), { filename: abs }).runInContext(win);
  } catch (e) {
    crash(src, e);
  }
}

setImmediate(() => setImmediate(() => {
  if (asyncErrors.length) crash('async startup', asyncErrors[0]);
  console.log(`   ✅ ${scriptTags.length} scripts booted in page order with 0 runtime errors.`);

  // 5. Cross-file Scope Check
  // Flags names that app.js declares privately (module scope) but that a
  // js/ file reads as a bare global — the bug class that broke Firestore
  // sync after the modular refactor. Only names missing from the booted
  // global scope are reported.
  console.log('\n5. Checking js/ modules only use globals that actually exist...');
  const appSrc = fs.readFileSync(appJsPath, 'utf8');
  // What app.js really shares: window.name = ..., and the keys of its
  // Object.assign(window, { ... }) block. (The sandbox runs app.js as a plain
  // script, which makes every top-level function a global, so "is it on the
  // booted window?" can't tell shared from private for functions.)
  const sharedByApp = new Set([...appSrc.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => m[1]));
  for (const block of appSrc.matchAll(/Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const m of block[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=[:,]|$)/gm)) sharedByApp.add(m[1]);
  }
  // Names a classic js/ script declares at its top level, or puts on window,
  // are real globals too (e.g. escapeHtml in utils.js, which app.js also has
  // its own copy of). Module scripts (type="module") don't count.
  const otherGlobals = new Set();
  const moduleFiles = new Set(scriptTags.filter((t) => t.isModule).map((t) => path.basename(t.src)));
  for (const f of fs.readdirSync(path.join(rootDir, 'js')).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(rootDir, 'js', f), 'utf8');
    for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) otherGlobals.add(m[1]);
    if (moduleFiles.has(f)) continue;
    for (const m of src.matchAll(/^(?:async\s+)?(?:let|const|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) otherGlobals.add(m[1]);
  }
  const privateNames = new Set(
    [...appSrc.matchAll(/^(?:export\s+)?(?:async\s+)?(?:let|const|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)]
      .map((m) => m[1])
      .filter((n) => !sharedByApp.has(n) && !otherGlobals.has(n))
  );
  // Blank out comments and the text inside strings, templates and regexes,
  // keeping code (including code inside ${ } in templates) and every newline,
  // so line numbers still match. One pass with a small scanner: regex-based
  // stripping got out of step on "//" inside strings and nested templates
  // and silently erased real code.
  const stripNoise = (src) => {
    let out = '';
    let i = 0;
    const n = src.length;
    const braceStack = []; // for each open "${": brace depth inside it
    let prevSig = '';      // last significant code character, for regex detection
    const blank = (text) => text.replace(/[^\n]/g, ' ');
    const readTemplate = () => { // at the char after an opening ` or after a closing } of ${ }
      while (i < n) {
        const c = src[i];
        if (c === '\\') { out += blank(src.slice(i, i + 2)); i += 2; continue; }
        if (c === '`') { out += '`'; i++; prevSig = '`'; return; }
        if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; braceStack.push(0); prevSig = '{'; return; }
        out += c === '\n' ? '\n' : ' ';
        i++;
      }
    };
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e === -1 ? n : e; out += blank(src.slice(i, end)); i = end; continue; }
      if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e === -1 ? n : e + 2; out += blank(src.slice(i, end)); i = end; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        out += c + blank(src.slice(i + 1, j)) + c; i = j + 1; prevSig = c; continue;
      }
      if (c === '`') { out += '`'; i++; readTemplate(); continue; }
      if (c === '/' && (prevSig === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prevSig))) {
        // Regex literal
        let j = i + 1; let inClass = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) break;
          j++;
        }
        out += '/' + blank(src.slice(i + 1, j)) + '/'; i = j + 1; prevSig = '/x'; continue;
      }
      if (braceStack.length) {
        if (c === '{') braceStack[braceStack.length - 1]++;
        else if (c === '}') {
          if (braceStack[braceStack.length - 1] === 0) { braceStack.pop(); out += '}'; i++; readTemplate(); continue; }
          braceStack[braceStack.length - 1]--;
        }
      }
      out += c;
      if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? 'w' : c;
      if (c === ')' || c === ']') prevSig = 'w'; // "a) / b" divides
      i++;
    }
    return out;
  };
  const problems = [];
  const jsDir = path.join(rootDir, 'js');
  for (const file of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
    const src = stripNoise(fs.readFileSync(path.join(jsDir, file), 'utf8'));
    for (const name of privateNames) {
      // A parameter or destructured name, not a call: "(name," or "{ name }",
      // never "{\n  name(" (that's a call that happens to follow a brace)
      const declared = new RegExp(`(?:\\b(?:let|const|var|function|class)\\s+|[({,][ \\t]*)${name.replace(/\$/g, '\\$')}\\b(?!\\s*[:(])`).test(src);
      if (declared) continue;
      const lines = src.split('\n');
      const re = new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])(?!\\s*:)`);
      lines.forEach((line, i) => { if (re.test(line)) problems.push(`js/${file}:${i + 1} uses '${name}', which only exists inside app.js`); });
    }
  }
  if (problems.length) {
    console.error('   ❌ js/ modules reference app.js-private names (put them on window in app.js):');
    problems.forEach((p) => console.error('      ' + p));
    process.exit(1);
  }
  console.log('   ✅ No js/ module depends on an app.js-private name.');

  console.log('\n🎉 ALL CHECKS PASSED! Safe to deploy.\n');
  process.exit(0);
}));
