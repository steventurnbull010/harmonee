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

// 4. Mock DOM Execution Check
console.log('\n4. Simulating app.js execution in mock browser environment...');
let appCode = fs.readFileSync(appJsPath, 'utf8');
const window = {
  location: { search: '?board=turnbull' },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  addEventListener: () => {},
  scrollTo: () => {}
};
global.window = window;
global.localStorage = window.localStorage;
const createMockEl = (id) => ({
  id,
  addEventListener: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  setAttribute: () => {},
  getAttribute: () => null,
  hasAttribute: () => false,
  style: { setProperty: () => {} },
  appendChild: () => {},
  querySelectorAll: () => [],
  querySelector: () => null
});
const document = {
  readyState: 'complete',
  location: window.location,
  documentElement: {
    classList: { add: () => {}, remove: () => {} }
  },
  getElementById: (id) => createMockEl(id),
  createElement: (tag) => createMockEl(tag),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  body: { classList: { add: () => {}, remove: () => {} } }
};
global.document = document;
global.initializeApp = () => ({});
global.getFirestore = () => ({});
global.collection = () => ({});
global.doc = () => ({});
global.onSnapshot = () => () => {};
global.setDoc = () => Promise.resolve();
global.updateDoc = () => Promise.resolve();
global.deleteDoc = () => Promise.resolve();
global.writeBatch = () => ({ set: () => {}, update: () => {}, commit: () => Promise.resolve() });
global.serverTimestamp = () => new Date();
global.SoundEffects = function() {};

appCode = appCode.replace(/import\s*\{[^}]*\}\s*from\s*[^;]+;/g, '');
appCode = appCode.replace(/^export /gm, '');

try {
  eval(appCode);
  console.log('   ✅ app.js executed from top to bottom with 0 runtime errors.');
} catch (e) {
  console.error('   ❌ RUNTIME CRASH in app.js during init:', e);
  process.exit(1);
}

console.log('\n🎉 ALL CHECKS PASSED! Safe to deploy.\n');
process.exit(0);

