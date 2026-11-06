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

// 2. CSS Brace Balance Check
console.log('\n2. Checking style.css brace balance...');
const css = fs.readFileSync(styleCssPath, 'utf8');
let openBraces = 0;
for (let i = 0; i < css.length; i++) {
  if (css[i] === '{') openBraces++;
  else if (css[i] === '}') openBraces--;
  if (openBraces < 0) {
    console.error(`   ❌ Extra closing brace in style.css at char ${i}`);
    process.exit(1);
  }
}
if (openBraces !== 0) {
  console.error(`   ❌ Mismatched braces in style.css! Unclosed: ${openBraces}`);
  process.exit(1);
}
console.log('   ✅ style.css braces balanced perfectly.');

// 3. index.html Cache Buster Check
console.log('\n3. Checking index.html script & css links...');
const html = fs.readFileSync(indexHtmlPath, 'utf8');
const cssMatch = html.match(/style\.css\?v=(\d+)/);
const jsMatch = html.match(/app\.js\?v=(\d+)/);
if (!cssMatch || !jsMatch) {
  console.error('   ❌ Missing cache buster on style.css or app.js in index.html!');
  process.exit(1);
}
console.log(`   ✅ Cache busters found: style.css?v=${cssMatch[1]}, app.js?v=${jsMatch[1]}`);

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
  CustomEvent: anything(), Event: anything(), URLSearchParams, URL, TextEncoder, TextDecoder,
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
  getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
  setDoc: () => Promise.resolve(), updateDoc: () => Promise.resolve(),
  deleteDoc: () => Promise.resolve(), addDoc: () => Promise.resolve({ id: 'mock' }),
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }),
  serverTimestamp: () => new Date(), arrayUnion: (...a) => a, increment: (n) => n
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
  const privateNames = new Set(
    [...appSrc.matchAll(/^(?:export\s+)?(?:async\s+)?(?:let|const|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)]
      .map((m) => m[1])
      .filter((n) => !(n in win))
  );
  const stripNoise = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/g, (m) => '``' + '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""');
  const problems = [];
  const jsDir = path.join(rootDir, 'js');
  for (const file of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
    const src = stripNoise(fs.readFileSync(path.join(jsDir, file), 'utf8'));
    for (const name of privateNames) {
      const declared = new RegExp(`(?:\\b(?:let|const|var|function|class)\\s+|[({,]\\s*)${name.replace(/\$/g, '\\$')}\\b(?!\\s*:)`).test(src);
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
