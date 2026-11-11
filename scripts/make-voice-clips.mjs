#!/usr/bin/env node
// ============================================================================
// MAKE VOICE CLIPS (scripts/make-voice-clips.mjs)
// The spoken words for picture jobs (js/picture-jobs.js), made once with
// Gemini's text-to-speech in the "Leda" voice (picked by Steven, 11 Nov) and
// kept as small .m4a files in audio/voice/. The app plays a clip when it has
// one for the words, and the phone's own voice otherwise.
//
// What's made: every ready-made routine job, the cheers, "All done!", and
// every buddy's lines (js/buddies.js). It also writes js/voice-clips.js, the
// list the app reads.
//
//   GEMINI_API_KEY=... node scripts/make-voice-clips.mjs          only new words
//   GEMINI_API_KEY=... node scripts/make-voice-clips.mjs --all    remake them all
// Needs macOS (afconvert turns each clip into AAC).
// ============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";

const VOICE = "Leda";
const STYLE = "Say this in a bright, young, really excited and encouraging British voice, like a cheerful big sister talking to a four-year-old. Lots of energy and warmth, smiling as you speak. Say only these words:";
const OUT = "audio/voice";
const KEY = process.env.GEMINI_API_KEY;
const ALL = process.argv.includes("--all");

// The words: read from the app itself, so the clips always match it
const ctx = { window: {}, document: { addEventListener() {} }, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(`var window = this.window; var document = this.document;`, ctx);
for (const f of ["js/buddies.js", "js/picture-jobs.js"]) vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
const PJ = ctx.window.PictureJobs;
const B = ctx.window.Buddies;
const phrases = new Set();
PJ.starterItems().forEach(i => phrases.add(i.title));
PJ.FIXED_WORDS.forEach(w => phrases.add(w));
B.BUDDIES.forEach(b => b.lines.forEach(l => phrases.add(l)));

const keyOf = (text) => PJ.clipKey(text);
const fileOf = (text) => `${keyOf(text)}-${createHash("sha1").update(`${VOICE}|${STYLE}|${text}`).digest("hex").slice(0, 6)}.m4a`;

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const todo = [...phrases].filter(t => ALL || !existsSync(`${OUT}/${fileOf(t)}`));
if (todo.length && !KEY) { console.error(`${todo.length} clips to make: set GEMINI_API_KEY.`); process.exit(1); }

const API = "https://generativelanguage.googleapis.com/v1beta";
let model = null;
if (todo.length) {
  const list = await (await fetch(`${API}/models?pageSize=200&key=${KEY}`)).json();
  if (list.error) { console.error("Gemini said:", list.error.message); process.exit(1); }
  const tts = (list.models || []).map(m => m.name).filter(n => /tts/i.test(n));
  model = tts.find(n => /flash/i.test(n)) || tts[0];
  console.log(`Making ${todo.length} clips with ${model} (${VOICE})`);
}
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
// Quiet at the start and end trimmed, so a tap speaks straight away
function trim(pcm) {
  const n = pcm.length / 2, LIMIT = 500, PAD = 1200;
  let a = 0, b = n - 1;
  while (a < n && Math.abs(pcm.readInt16LE(a * 2)) < LIMIT) a++;
  while (b > a && Math.abs(pcm.readInt16LE(b * 2)) < LIMIT) b--;
  return pcm.subarray(Math.max(0, a - PAD) * 2, Math.min(n, b + PAD) * 2);
}
let made = 0;
for (const text of todo) {
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    const res = await fetch(`${API}/${model}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\n${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } }
      })
    });
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) { console.log(`  retry "${text}": ${data?.error?.message || "no audio"}`); await new Promise(r => setTimeout(r, 35000)); continue; }
    const rate = Number((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
    const tmp = `${OUT}/.tmp.wav`;
    writeFileSync(tmp, wav(trim(Buffer.from(part.inlineData.data, "base64")), rate));
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", tmp, `${OUT}/${fileOf(text)}`]);
    unlinkSync(tmp);
    ok = true; made++;
    console.log(`✓ ${text}`);
  }
  if (!ok) console.log(`✗ ${text}`);
}

// The list the app reads: words -> file
const map = {};
[...phrases].sort().forEach(t => { if (existsSync(`${OUT}/${fileOf(t)}`)) map[keyOf(t)] = `${OUT}/${fileOf(t)}`; });
writeFileSync("js/voice-clips.js", `// Made by scripts/make-voice-clips.mjs (Gemini text-to-speech, voice "${VOICE}"). Don't edit by hand.
// Words (as PictureJobs.clipKey) -> clip. Played by js/picture-jobs.js.
window.VOICE_CLIPS = ${JSON.stringify(map, null, 2)};
`);
console.log(`Made ${made}; ${Object.keys(map).length} clips listed in js/voice-clips.js`);
