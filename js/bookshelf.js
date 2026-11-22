// ============================================================================
// THE BOOKSHELF (js/bookshelf.js) · asked for by families, 22 Nov
// A kind of list (js/list-types.js "books") for the books the family reads.
//
//   - Each book: its cover, title and author, who's reading it (a person, or
//     Everyone for a read-together), Want to read / Reading / Finished, 0–5
//     stars, a comment, and the day it was finished.
//   - Adding: type a title and pick from Open Library's suggestions, with
//     their covers (free, no account; only the typed words are sent), or just
//     keep what you typed.
//   - The shelf: Reading, Want to read and Finished, as covers, with a chip
//     for each person to see just theirs.
//   - Reading targets (🎯 Targets): each person can have a number of books
//     a year or a month, shown as a progress bar. Points (set there too):
//     some for each finished book and a bonus for reaching a target, added to
//     their Rewards balance (js/reward-goals.js). Read-togethers earn none.
//
// Books are list items, so they sync, share and save like any list:
//   { id, text: title, author, cover, olKey, who, status: "want" | "reading"
//     | "done", rating 0–5, comment, finishedAt "YYYY-MM-DD", points?,
//     checked (= finished), addedAt }
// A book's points are kept on it when it's finished (so changing the points
// later doesn't change what was earned), and go if it's un-finished.
// Targets and points: board settings readingGoals { name: { target, period:
// "year" | "month", awarded: { "2026": 20 } } } and bookPoints { perBook,
// targetBonus }.
// ============================================================================
(function () {
  const EVERYONE = "Everyone";
  const STATUSES = [
    { key: "reading", label: "Reading", icon: "📖" },
    { key: "want", label: "Want to read", icon: "🔖" },
    { key: "done", label: "Finished", icon: "✅" }
  ];
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const people = () => (window.familyMembers || []).map(m => (typeof m === "string" ? m : m && m.name)).filter(Boolean);
  const palette = (n) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(n) : { primary: "#64748b" });
  const todayKey = () => (typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(new Date()) : new Date().toISOString().slice(0, 10));
  const lists = () => (typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : []);
  const isBooks = (l) => !!(l && window.ListTypes && window.ListTypes.typeOf(l) === "books");
  const statusOf = (b) => (b.status === "reading" || b.status === "done" || b.status === "want") ? b.status : (b.checked ? "done" : "want");
  const settings = () => window.boardSettings || {};
  const bookPoints = () => ({ perBook: 0, targetBonus: 0, ...(settings().bookPoints || {}) });
  const goals = () => settings().readingGoals || {};
  const coverOf = (b) => (/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(String(b.cover || "")) ? b.cover : "");
  const stars = (n, cls = "") => `<span class="book-stars ${cls}" aria-label="${n} star${n === 1 ? "" : "s"}">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? "is-on" : ""}" aria-hidden="true">★</span>`).join("")}</span>`;
  function face(name) {
    if (!name || name === EVERYONE) return `<span class="book-face is-everyone" title="Read together" aria-hidden="true">👪</span>`;
    const f = typeof window.memberFace === "function" ? window.memberFace(name) : { html: esc(name.charAt(0)), buddy: false };
    return `<span class="book-face${f.buddy ? " is-buddy" : ""}" style="--face:${palette(name).primary}" title="${esc(name)}" aria-hidden="true">${f.html}</span>`;
  }

  // ---- Targets ----------------------------------------------------------------------
  const periodKey = (period, dateKey = todayKey()) => (period === "month" ? dateKey.slice(0, 7) : dateKey.slice(0, 4));
  const periodWords = (period) => (period === "month" ? "this month" : "this year");
  // Books finished by name in this period (on every bookshelf)
  function finishedIn(name, period, dateKey) {
    const key = periodKey(period, dateKey);
    let n = 0;
    lists().filter(isBooks).forEach(l => (l.items || []).forEach(b => {
      if (b.who === name && statusOf(b) === "done" && String(b.finishedAt || "").startsWith(key)) n++;
    }));
    return n;
  }
  // Reward points from reading (js/reward-goals.js adds these to the balance)
  function pointsFor(name) {
    let n = 0;
    lists().filter(isBooks).forEach(l => (l.items || []).forEach(b => { if (b.who === name && statusOf(b) === "done") n += Number(b.points) || 0; }));
    const g = goals()[name];
    if (g && g.awarded) Object.values(g.awarded).forEach(v => { n += Number(v) || 0; });
    return n;
  }

  // ---- The shelf (inside the list, js/lists.js renderListDetail) ------------------------
  const filterBy = {}; // listId -> name or "" (everyone), this device only
  function bodyHtml(list) {
    const all = (list.items || []).slice();
    const who = filterBy[list.id] || "";
    const mine = who ? all.filter(b => b.who === who || (!b.who && who === EVERYONE)) : all;
    const names = people();
    const chips = `<div class="book-filter" role="radiogroup" aria-label="Whose books">
        <button type="button" class="list-who${!who ? " is-on" : ""}" role="radio" aria-checked="${!who}" data-book-filter="">Everyone</button>
        ${names.map(n => `<button type="button" class="list-who${who === n ? " is-on" : ""}" role="radio" aria-checked="${who === n}" data-book-filter="${esc(n)}">${esc(n)}</button>`).join("")}
      </div>`;
    // Targets: each person (or the one picked) with one
    const g = goals();
    const withTargets = (who ? [who] : names).filter(n => g[n] && Number(g[n].target) > 0);
    const targets = withTargets.length ? `<div class="book-targets">${withTargets.map(n => {
      const t = Number(g[n].target), done = finishedIn(n, g[n].period);
      const pct = Math.min(100, Math.round(done / t * 100));
      return `<div class="book-target">
        <div class="book-target-top">${face(n)}<span class="book-target-words"><strong>${esc(n)}</strong> ${done} of ${t} book${t === 1 ? "" : "s"} ${periodWords(g[n].period)}${done >= t ? " 🎉" : ""}</span></div>
        <div class="book-target-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${done}" aria-label="${esc(n)}: ${done} of ${t}"><span style="width:${pct}%"></span></div>
      </div>`;
    }).join("")}</div>` : "";
    const add = `<form class="list-column-add book-add" data-book-add autocomplete="off">
        <span class="book-add-icon" aria-hidden="true">🔎</span>
        <input type="text" placeholder="Add a book: type its title" aria-label="Add a book: type its title" enterkeyhint="search" data-book-search>
        <button type="button" data-book-new aria-label="Add a book" title="Add a book">+</button>
      </form>
      <div class="book-suggest" data-book-suggest hidden></div>`;
    const tile = (b) => {
      const st = statusOf(b);
      const cover = coverOf(b);
      return `<li><button type="button" class="book-tile" data-book-open="${esc(b.id)}" aria-label="${esc(b.text)}${b.author ? ` by ${esc(b.author)}` : ""}">
        <span class="book-cover${cover ? "" : " is-blank"}"${cover ? ` style="background-image:url('${esc(cover)}')"` : ""}>${cover ? "" : `<span>${esc(b.text)}</span>`}${face(b.who)}</span>
        <span class="book-title">${esc(b.text)}</span>
        ${b.author ? `<span class="book-author">${esc(b.author)}</span>` : ""}
        ${st === "done" && b.rating ? stars(Number(b.rating)) : ""}
      </button></li>`;
    };
    const sections = STATUSES.map(s => {
      let books = mine.filter(b => statusOf(b) === s.key);
      if (s.key === "done") books.sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
      if (!books.length) return "";
      return `<section class="book-section"><h3 class="book-section-title">${s.icon} ${esc(s.label)} <span>${books.length}</span></h3>
        <ul class="book-grid">${books.map(tile).join("")}</ul></section>`;
    }).join("");
    const empty = `<div class="list-detail-empty"><span class="list-detail-empty-icon" aria-hidden="true">📚</span>
        <p class="list-detail-empty-title">${who ? `Nothing on ${esc(who)}'s shelf yet` : "Your bookshelf is empty"}</p>
        <p class="list-detail-empty-text">Type a book's title above to add it, with its cover.</p></div>`;
    return `${chips}${targets}${add}${sections ? `<div class="book-sections">${sections}</div>` : empty}`;
  }
  function countText(list) {
    const items = list.items || [];
    if (!items.length) return "Empty";
    const reading = items.filter(b => statusOf(b) === "reading").length;
    const done = items.filter(b => statusOf(b) === "done").length;
    return [reading ? `${reading} reading` : "", `${done} finished`].filter(Boolean).join(" · ");
  }
  function railSubtitle(list) { const n = (list.items || []).filter(b => statusOf(b) === "done").length; return n ? `${n} finished` : "Bookshelf"; }
  // The newest finished book's cover for the list's tile, or the drawn shelf
  function thumbOf(list) {
    const withCover = (list.items || []).filter(b => coverOf(b)).sort((a, b) => String(b.finishedAt || b.addedAt || "").localeCompare(String(a.finishedAt || a.addedAt || "")));
    return withCover.length ? coverOf(withCover[0]) : "";
  }

  // ---- Searching Open Library -----------------------------------------------------------
  let searchTimer = null, searchAbort = null;
  async function search(q) {
    if (typeof window.__SMOKE_BOOKS === "function") return window.__SMOKE_BOOKS(q);
    if (searchAbort) searchAbort.abort();
    searchAbort = typeof AbortController === "function" ? new AbortController() : null;
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,cover_i,first_publish_year`;
    const res = await fetch(url, searchAbort ? { signal: searchAbort.signal } : {});
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs || []).map(d => ({
      title: String(d.title || "").slice(0, 120),
      author: Array.isArray(d.author_name) ? String(d.author_name[0] || "").slice(0, 80) : "",
      cover: Number.isInteger(d.cover_i) ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
      olKey: /^\/works\/OL\d+W$/.test(String(d.key || "")) ? d.key : "",
      year: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null
    })).filter(d => d.title);
  }
  function suggestHtml(results, typed) {
    return `<ul class="book-suggest-list" role="listbox" aria-label="Matching books">${results.map((r, i) => `<li><button type="button" class="book-suggest-row" data-book-pick="${i}" role="option">
        <span class="book-suggest-cover${r.cover ? "" : " is-blank"}"${r.cover ? ` style="background-image:url('${esc(r.cover.replace("-M.jpg", "-S.jpg"))}')"` : ""}></span>
        <span class="book-suggest-words"><strong>${esc(r.title)}</strong><small>${esc([r.author, r.year].filter(Boolean).join(" · "))}</small></span>
      </button></li>`).join("")}
      <li><button type="button" class="book-suggest-row is-own" data-book-pick="own"><span class="book-suggest-cover is-blank" aria-hidden="true">✏️</span><span class="book-suggest-words"><strong>Add "${esc(typed)}"</strong><small>Just as typed</small></span></button></li>
    </ul>`;
  }
  // Suggestions under a box (the shelf's or the panel's), picked -> onPick(result or null)
  function wireSearch(input, box, onPick) {
    let results = [];
    const run = () => {
      const q = input.value.trim();
      clearTimeout(searchTimer);
      if (q.length < 3) { box.hidden = true; box.innerHTML = ""; return; }
      searchTimer = setTimeout(async () => {
        try { results = await search(q); } catch (e) { results = []; }
        if (input.value.trim() !== q) return; // typed more since
        box.innerHTML = suggestHtml(results.slice(0, 5), q);
        box.hidden = false;
      }, typeof window.__SMOKE_BOOKS === "function" ? 0 : 350);
    };
    input.addEventListener("input", run);
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-book-pick]");
      if (!b) return;
      e.preventDefault();
      const k = b.getAttribute("data-book-pick");
      box.hidden = true;
      onPick(k === "own" ? null : results[Number(k)] || null);
    });
  }

  // ---- Clicks and typing on the shelf ---------------------------------------------------
  function onBoardClick(e) {
    const col = e.target.closest(".list-type-books[data-list-id]");
    if (!col) return false;
    const listId = col.getAttribute("data-list-id");
    const f = e.target.closest("[data-book-filter]");
    if (f) { filterBy[listId] = f.getAttribute("data-book-filter"); window.renderListsView(); return true; }
    const open = e.target.closest("[data-book-open]");
    if (open) { openBook(listId, open.getAttribute("data-book-open")); return true; }
    if (e.target.closest("[data-book-new]")) {
      const input = col.querySelector("[data-book-search]");
      openBook(listId, null, { title: input ? input.value.trim() : "" });
      if (input) input.value = "";
      return true;
    }
    if (e.target.closest("[data-book-targets]")) { openTargets(); return true; }
    return false;
  }
  // After the shelf is drawn: suggestions under its box
  function afterRender(board) {
    const col = board && board.querySelector(".list-type-books[data-list-id]");
    if (!col) return;
    const input = col.querySelector("[data-book-search]");
    const box = col.querySelector("[data-book-suggest]");
    if (!input || !box || input._wired) return;
    input._wired = true;
    const listId = col.getAttribute("data-list-id");
    wireSearch(input, box, (r) => {
      const typed = input.value.trim();
      input.value = "";
      openBook(listId, null, r ? { title: r.title, author: r.author, cover: r.cover, olKey: r.olKey } : { title: typed });
    });
    col.querySelector("[data-book-add]").addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const typed = input.value.trim();
      if (!typed) return;
      input.value = "";
      box.hidden = true;
      openBook(listId, null, { title: typed });
    }, true);
  }

  // ---- One book: the side panel ------------------------------------------------------
  let editing = null; // { listId, id|null, before }
  function dialog() {
    let dlg = document.getElementById("book-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "book-modal";
    dlg.className = "roster-dialog book-dialog";
    dlg.setAttribute("aria-labelledby", "book-modal-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-book-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="book-modal-title" class="modal-title">Add a book</h2></div>
        <form class="book-form" id="book-form" novalidate>
          <input type="hidden" id="book-cover">
          <input type="hidden" id="book-olkey">
          <input type="hidden" id="book-who">
          <input type="hidden" id="book-status">
          <input type="hidden" id="book-rating">
          <div class="book-form-top">
            <span class="book-form-cover is-blank" id="book-form-cover" aria-hidden="true">📚</span>
            <div class="book-form-names">
              <label class="ev-field"><span class="ev-field-label">Title</span>
                <input type="text" id="book-title" class="ev-native-input" maxlength="120" placeholder="The book's title" autocomplete="off" required></label>
              <div class="book-suggest is-panel" id="book-panel-suggest" hidden></div>
              <label class="ev-field"><span class="ev-field-label">Author</span>
                <input type="text" id="book-author" class="ev-native-input" maxlength="80" placeholder="Who wrote it (optional)" autocomplete="off"></label>
            </div>
          </div>
          <div class="drawer-field-group">
            <div class="drawer-section-label-row"><span class="drawer-section-icon">👥</span><span class="drawer-section-label">Who's reading it</span></div>
            <div class="drawer-profiles-pills-row" id="book-who-row" role="radiogroup" aria-label="Who's reading it"></div>
          </div>
          <div class="drawer-field-group">
            <div class="drawer-section-label-row"><span class="drawer-section-icon">📖</span><span class="drawer-section-label">Where they're up to</span></div>
            <div class="drawer-segmented-pills book-status-pills" id="book-status-row" role="radiogroup" aria-label="Where they're up to">
              ${STATUSES.slice().sort((a, b) => ["want", "reading", "done"].indexOf(a.key) - ["want", "reading", "done"].indexOf(b.key)).map(s => `<button type="button" class="drawer-pill-segment" role="radio" data-book-status="${s.key}">${esc(s.label)}</button>`).join("")}
            </div>
            <label class="ev-field book-finished-row" id="book-finished-row" hidden><span class="ev-field-label">Finished on</span>
              <input type="date" id="book-finished" class="ev-native-input"></label>
            <p class="book-points-note" id="book-points-note" hidden></p>
          </div>
          <div class="drawer-field-group">
            <div class="drawer-section-label-row"><span class="drawer-section-icon">⭐</span><span class="drawer-section-label">Stars</span></div>
            <div class="book-star-row" id="book-star-row" role="radiogroup" aria-label="Stars out of 5">
              ${[1, 2, 3, 4, 5].map(i => `<button type="button" class="book-star" role="radio" data-book-star="${i}" aria-label="${i} star${i === 1 ? "" : "s"}">★</button>`).join("")}
            </div>
          </div>
          <div class="drawer-field-group">
            <div class="drawer-section-label-row"><span class="drawer-section-icon">💬</span><label class="drawer-section-label" for="book-comment">What they thought</label></div>
            <textarea id="book-comment" class="ev-native-input ev-notes" rows="3" maxlength="400" placeholder="e.g. Loved the ending! (optional)"></textarea>
          </div>
          <div class="modal-actions ev-actions">
            <button type="button" class="btn-delete-event ev-delete" id="book-delete" hidden>Remove from the shelf</button>
            <button type="submit" class="btn-submit" id="book-save">Add to the shelf</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.querySelector("[data-book-close]").addEventListener("click", () => dlg.close());
    const $ = (id) => dlg.querySelector(`#${id}`);
    wireSearch($("book-title"), $("book-panel-suggest"), (r) => {
      if (!r) return;
      $("book-title").value = r.title;
      $("book-author").value = r.author || "";
      $("book-cover").value = r.cover || "";
      $("book-olkey").value = r.olKey || "";
      drawCover();
    });
    $("book-who-row").addEventListener("click", (e) => { const b = e.target.closest("[data-book-who]"); if (b) { $("book-who").value = b.getAttribute("data-book-who"); drawPills(); } });
    $("book-status-row").addEventListener("click", (e) => {
      const b = e.target.closest("[data-book-status]");
      if (!b) return;
      $("book-status").value = b.getAttribute("data-book-status");
      if ($("book-status").value === "done" && !$("book-finished").value) $("book-finished").value = todayKey();
      drawPills();
    });
    $("book-star-row").addEventListener("click", (e) => {
      const b = e.target.closest("[data-book-star]");
      if (!b) return;
      const n = Number(b.getAttribute("data-book-star"));
      $("book-rating").value = String(Number($("book-rating").value) === n ? 0 : n); // the same star again clears it
      drawPills();
    });
    $("book-form").addEventListener("submit", (e) => { e.preventDefault(); save(); });
    $("book-delete").addEventListener("click", remove);
    return dlg;
  }
  function drawCover() {
    const dlg = dialog();
    const el = dlg.querySelector("#book-form-cover");
    const url = coverOf({ cover: dlg.querySelector("#book-cover").value });
    el.classList.toggle("is-blank", !url);
    el.style.backgroundImage = url ? `url('${url}')` : "";
    el.textContent = url ? "" : "📚";
  }
  function drawPills() {
    const dlg = dialog();
    const who = dlg.querySelector("#book-who").value;
    const status = dlg.querySelector("#book-status").value;
    const rating = Number(dlg.querySelector("#book-rating").value) || 0;
    const tick = `<span class="drawer-profile-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
    dlg.querySelector("#book-who-row").innerHTML = [...people(), EVERYONE].map(n => {
      const fam = n === EVERYONE, on = who === n;
      const f = fam ? { html: "👪", buddy: false } : (typeof window.memberFace === "function" ? window.memberFace(n) : { html: esc(n.charAt(0)), buddy: false });
      return `<button type="button" class="drawer-profile-pill ${on ? "active" : ""}" role="radio" aria-checked="${on}" data-book-who="${esc(n)}" style="--profile-color:${fam ? "#f59e0b" : palette(n).primary};">
        <span class="drawer-profile-avatar${f.buddy ? " is-buddy" : ""}">${f.html}${tick}</span><span class="drawer-profile-name">${fam ? "Together" : esc(n)}</span></button>`;
    }).join("");
    dlg.querySelectorAll("[data-book-status]").forEach(b => { const on = b.getAttribute("data-book-status") === status; b.classList.toggle("active", on); b.setAttribute("aria-checked", String(on)); });
    dlg.querySelectorAll("[data-book-star]").forEach(b => { const n = Number(b.getAttribute("data-book-star")); b.classList.toggle("is-on", n <= rating); b.setAttribute("aria-checked", String(n === rating)); });
    dlg.querySelector("#book-finished-row").hidden = status !== "done";
    // What finishing it earns (a person, not a read-together)
    const note = dlg.querySelector("#book-points-note");
    const pts = bookPoints().perBook;
    const earned = editing && editing.before && statusOf(editing.before) === "done" && editing.before.who === who;
    note.hidden = !(status === "done" && who && who !== EVERYONE && pts > 0 && !earned);
    note.textContent = `🏆 ${who} gets ${pts} point${pts === 1 ? "" : "s"} for finishing it`;
  }
  // listId; id of a book to edit (or null for a new one); prefill { title, author, cover, olKey }
  function openBook(listId, id, prefill = {}) {
    const dlg = dialog();
    const list = lists().find(l => l.id === listId);
    if (!list) return;
    const book = id ? (list.items || []).find(b => b.id === id) : null;
    editing = { listId, id: book ? book.id : null, before: book ? { ...book } : null };
    const $ = (x) => dlg.querySelector(`#${x}`);
    // A new book is for whoever the shelf is showing, else read together (tap a face to change)
    const who = book ? (book.who || EVERYONE) : (filterBy[listId] || EVERYONE);
    $("book-modal-title").textContent = book ? "Book" : "Add a book";
    $("book-title").value = book ? book.text : (prefill.title || "");
    $("book-author").value = book ? (book.author || "") : (prefill.author || "");
    $("book-cover").value = book ? (book.cover || "") : (prefill.cover || "");
    $("book-olkey").value = book ? (book.olKey || "") : (prefill.olKey || "");
    $("book-who").value = who;
    $("book-status").value = book ? statusOf(book) : "reading";
    $("book-rating").value = String(book ? (Number(book.rating) || 0) : 0);
    $("book-comment").value = book ? (book.comment || "") : "";
    $("book-finished").value = book ? (book.finishedAt || "") : "";
    $("book-delete").hidden = !book;
    $("book-save").textContent = book ? "Save" : "Add to the shelf";
    $("book-panel-suggest").hidden = true;
    drawCover();
    drawPills();
    if (!dlg.open) dlg.showModal();
  }

  function save() {
    const dlg = dialog();
    const $ = (x) => dlg.querySelector(`#${x}`);
    const title = $("book-title").value.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!title) { $("book-title").focus(); return; }
    const status = $("book-status").value || "want";
    const who = $("book-who").value || EVERYONE;
    const before = editing.before;
    const book = {
      ...(before || {}),
      id: before ? before.id : `book-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: title,
      author: $("book-author").value.replace(/\s+/g, " ").trim().slice(0, 80),
      cover: coverOf({ cover: $("book-cover").value }),
      olKey: $("book-olkey").value || "",
      who, status,
      rating: Math.max(0, Math.min(5, Number($("book-rating").value) || 0)),
      comment: $("book-comment").value.trim().slice(0, 400),
      finishedAt: status === "done" ? ($("book-finished").value || todayKey()) : "",
      checked: status === "done",
      addedAt: before ? (before.addedAt || new Date().toISOString()) : new Date().toISOString()
    };
    // Points: kept on the book when it's finished by someone; gone if not
    const person = who !== EVERYONE && people().includes(who);
    const wasEarned = before && statusOf(before) === "done" && before.who === who && before.points !== undefined;
    let earnedNow = 0;
    if (status === "done" && person) {
      if (!wasEarned) { book.points = bookPoints().perBook || 0; earnedNow = book.points; }
    } else delete book.points;
    if (before) window.mutateFamilyLists({ type: "updateItem", listId: editing.listId, item: book });
    else window.mutateFamilyLists({ type: "addItems", listId: editing.listId, items: [book] });
    const reached = person && status === "done" ? checkTarget(who, book.finishedAt) : 0;
    dlg.close();
    if (typeof window.renderListsView === "function") window.renderListsView();
    if (typeof window.renderRewardGoals === "function") { try { window.renderRewardGoals(); } catch (e) {} }
    const justFinished = status === "done" && !(before && statusOf(before) === "done");
    if (reached) {
      const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!calm && typeof window.confetti === "function") window.confetti({ zIndex: 200000, particleCount: 110, spread: 80, origin: { x: 0.5, y: 0.7 } });
      if (typeof window.showCalendarToast === "function") window.showCalendarToast(`🎯 ${who} reached their reading target!${reached > 0 ? ` +${reached} points` : ""}`);
    } else if (typeof window.showActionToast === "function") {
      window.showActionToast({ icon: justFinished ? "🎉" : "📚", title, text: justFinished ? `Finished${person ? ` by ${who}` : ""}${earnedNow ? ` · +${earnedNow} point${earnedNow === 1 ? "" : "s"}` : ""}` : before ? "Updated" : "Added to the shelf" });
    }
    if (justFinished && typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
    editing = null;
  }
  // Reached their target with this book? Gives the bonus once per year/month. Returns the bonus (or -1 for reached with no bonus), else 0
  function checkTarget(name, dateKey) {
    const all = goals();
    const g = all[name];
    if (!g || !(Number(g.target) > 0)) return 0;
    const key = periodKey(g.period, dateKey);
    if (g.awarded && g.awarded[key] !== undefined) return 0;
    if (finishedIn(name, g.period, dateKey) < Number(g.target)) return 0;
    const bonus = bookPoints().targetBonus || 0;
    const next = { ...all, [name]: { ...g, awarded: { ...(g.awarded || {}), [key]: bonus } } };
    if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ readingGoals: next });
    return bonus || -1;
  }
  function remove() {
    if (!editing || !editing.id) return;
    const { listId, id } = editing;
    const title = editing.before ? editing.before.text : "this book";
    const go = () => {
      window.mutateFamilyLists({ type: "deleteItems", itemIds: [id] });
      const dlg = dialog();
      if (window.PanelGuard) window.PanelGuard.mark(dlg); // nothing to save now
      dlg.close();
      if (typeof window.renderListsView === "function") window.renderListsView();
    };
    if (window.Sheet && window.Sheet.confirm) {
      window.Sheet.confirm({ icon: "📚", title: "Take it off the shelf?", text: `${title} comes off the bookshelf${editing.before && editing.before.points ? ", with the points it earned" : ""}.`, yes: "Remove", no: "Keep it", danger: true }).then(ok => { if (ok) go(); });
    } else if (confirm(`Take ${title} off the shelf?`)) go();
    void listId;
  }

  // ---- 🎯 Reading targets and points ------------------------------------------------------
  function targetsDialog() {
    let dlg = document.getElementById("reading-targets-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "reading-targets-modal";
    dlg.className = "roster-dialog book-dialog";
    dlg.setAttribute("aria-labelledby", "reading-targets-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" data-rt-close aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="reading-targets-title" class="modal-title">Reading targets</h2></div>
        <form class="book-form" id="reading-targets-form" novalidate>
          <p class="book-targets-hint">How many books each of you wants to read. Leave it at 0 for no target.</p>
          <div class="book-targets-people" id="reading-targets-people"></div>
          <div class="drawer-field-group">
            <div class="drawer-section-label-row"><span class="drawer-section-icon">🏆</span><span class="drawer-section-label">Reward points</span></div>
            <div class="book-points-grid">
              <label class="ev-field"><span class="ev-field-label">For each book</span><input type="number" id="rt-per-book" class="ev-native-input" min="0" max="100" inputmode="numeric"></label>
              <label class="ev-field"><span class="ev-field-label">Bonus for a target</span><input type="number" id="rt-bonus" class="ev-native-input" min="0" max="500" inputmode="numeric"></label>
            </div>
            <p class="book-targets-hint">Added to each person's Rewards balance. Books read together don't earn points.</p>
          </div>
          <div class="modal-actions ev-actions"><button type="submit" class="btn-submit">Save</button></div>
        </form>
      </div>`;
    document.body.appendChild(dlg);
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.querySelector("[data-rt-close]").addEventListener("click", () => dlg.close());
    dlg.querySelector("#reading-targets-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const all = goals(), next = {};
      people().forEach((n, i) => {
        const target = Math.max(0, Math.min(366, parseInt(dlg.querySelector(`#rt-target-${i}`).value, 10) || 0));
        const period = dlg.querySelector(`#rt-period-${i}`).value === "month" ? "month" : "year";
        const before = all[n] || {};
        if (target || before.awarded) next[n] = { ...before, target, period };
      });
      const num = (id, max) => Math.max(0, Math.min(max, parseInt(dlg.querySelector(id).value, 10) || 0));
      if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ readingGoals: next, bookPoints: { perBook: num("#rt-per-book", 100), targetBonus: num("#rt-bonus", 500) } });
      dlg.close();
      if (typeof window.renderListsView === "function") window.renderListsView();
      if (typeof window.showCalendarToast === "function") window.showCalendarToast("🎯 Reading targets saved");
    });
    return dlg;
  }
  function openTargets() {
    const dlg = targetsDialog();
    const g = goals(), pts = bookPoints();
    dlg.querySelector("#reading-targets-people").innerHTML = people().map((n, i) => {
      const t = g[n] || {};
      return `<div class="book-target-edit">
        ${face(n)}<strong>${esc(n)}</strong>
        <label class="book-target-num"><span class="sr-only">${esc(n)}'s target</span><input type="number" id="rt-target-${i}" class="ev-native-input" min="0" max="366" inputmode="numeric" value="${Number(t.target) || 0}" aria-label="${esc(n)}'s number of books"></label>
        <select id="rt-period-${i}" class="ev-native-input" aria-label="${esc(n)}'s target is for"><option value="year"${t.period !== "month" ? " selected" : ""}>a year</option><option value="month"${t.period === "month" ? " selected" : ""}>a month</option></select>
      </div>`;
    }).join("");
    dlg.querySelector("#rt-per-book").value = String(pts.perBook || 0);
    dlg.querySelector("#rt-bonus").value = String(pts.targetBonus || 0);
    if (!dlg.open) dlg.showModal();
  }

  window.Bookshelf = { bodyHtml, countText, railSubtitle, thumbOf, onBoardClick, afterRender, openBook, openTargets, pointsFor, finishedIn, statusOf, EVERYONE, _search: search };
})();
