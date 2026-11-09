#!/usr/bin/env node
// List-only links (js/lists.js): a guest's note becomes a change to the list
// only after being checked again, and applying the same note twice (two
// family tablets both see it) changes nothing twice. Also checks what a guest
// gets to see of a list, and that link keys are long and random.
// Pulls the real functions out of js/lists.js by name.
// Run: node scripts/test-list-links.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "lists.js"), "utf8");

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in js/lists.js`);
  let i = src.indexOf("{", src.indexOf(")", start)), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}
const constLine = (name) => src.match(new RegExp(`const ${name} = [^;]*;`, "s"))[0];

global.window = { currentBoardId: "test-board" };
global.crypto = require("crypto").webcrypto;
const { guestOpToListOps, sharedListCopy, newShareKey, applyListOp } = new Function(`
  ${constLine("LIST_COLORS")}
  ${constLine("SHARED_ITEM_LIMIT")}
  const GROCERIES_LIST_ID = "groceries";
  const cloneLists = (x) => JSON.parse(JSON.stringify(x));
  ${extract("listItemKey")}
  ${extract("findListForOp")}
  ${extract("applyListOp")}
  ${extract("guestOpToListOps")}
  ${extract("sharedListCopy")}
  ${extract("newShareKey")}
  return { guestOpToListOps, sharedListCopy, newShareKey, applyListOp };
`)();

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};

const list = () => ({ id: "l1", title: "Packing", emoji: "🎒", color: "rose", usuals: { secret: { text: "x", n: 3 } }, aisles: { a: "b" },
  items: [{ id: "i1", text: "Suncream", checked: false }, { id: "i2", text: "Hats", checked: true }] });

// ---- Adding
let ops = guestOpToListOps("l1", "op123", { type: "add", texts: ["Towels", "  Swim   shorts  "] }, list());
check("add: two new items, ids from the note", ops[0].items.map(i => [i.id, i.text]), [["guest-op123-0", "Towels"], ["guest-op123-1", "Swim   shorts"]]);
check("add: marked as added by link", ops[0].items.every(i => i.addedBy === "link" && i.checked === false), true);
check("add: already on the list is skipped", guestOpToListOps("l1", "op2", { type: "add", texts: ["suncream"] }, list()), []);
check("add: ticked-off item can be added again", guestOpToListOps("l1", "op3", { type: "add", texts: ["Hats"] }, list())[0].items.length, 1);
check("add: long text cut to 80", guestOpToListOps("l1", "op4", { type: "add", texts: ["x".repeat(500)] }, list())[0].items[0].text.length, 80);
check("add: at most 10 at once", guestOpToListOps("l1", "op5", { type: "add", texts: Array.from({ length: 30 }, (_, n) => `thing ${n}`) }, list())[0].items.length, 10);
check("add: not text, ignored", guestOpToListOps("l1", "op6", { type: "add", texts: [{ evil: 1 }, 42, ""] }, list()), []);
check("add: odd note id cleaned", guestOpToListOps("l1", "a/b<c>", { type: "add", texts: ["Map"] }, list())[0].items[0].id, "guest-abc-0");

// Applying the same note twice (two tablets) adds it once
const lists = [list()];
const twice = guestOpToListOps("l1", "op7", { type: "add", texts: ["Towels"] }, lists[0]);
applyListOp(lists, {}, twice[0]);
applyListOp(lists, {}, twice[0]);
check("add: same note twice, added once", lists[0].items.filter(i => i.text === "Towels").length, 1);

// ---- Ticking
check("tick: an item on the list", guestOpToListOps("l1", "op8", { type: "tick", itemId: "i1", checked: true }, list()), [{ type: "toggleItem", listId: "l1", itemId: "i1", checked: true }]);
check("tick: an item that isn't there, ignored", guestOpToListOps("l1", "op9", { type: "tick", itemId: "nope", checked: true }, list()), []);

// ---- Anything else does nothing
check("other kinds of note ignored", [
  guestOpToListOps("l1", "x", { type: "deleteList" }, list()),
  guestOpToListOps("l1", "x", { type: "deleteItems", itemIds: ["i1"] }, list()),
  guestOpToListOps("l1", "x", null, list()),
  guestOpToListOps("l1", "x", { type: "add", texts: ["a"] }, undefined)
], [[], [], [], []]);

// ---- What a guest sees of a list: title, emoji, colour and items only
const copy = sharedListCopy(list());
check("copy: only what the guest needs", Object.keys(copy).sort(), ["boardId", "color", "emoji", "items", "listId", "title"]);
check("copy: items are id, text, ticked", copy.items[0], { id: "i1", text: "Suncream", checked: false });
check("copy: unknown colour falls back", sharedListCopy({ ...list(), color: "<b>" }).color, "sky");

// ---- Keys: long and different every time
const keys = new Set(Array.from({ length: 200 }, newShareKey));
check("keys: 18 characters, no clashes in 200", [[...keys][0].length, keys.size], [18, 200]);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
