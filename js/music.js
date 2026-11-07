// ============================================================================
// MUSIC TILES (js/music.js)
// A family's favourite Spotify playlists, one tap away on Today at a glance.
// Tapping a tile opens it in the Spotify app (or Spotify on the web), where
// it plays on the phone or goes to a speaker as usual - harmonee doesn't play
// anything itself, so there's nothing to stop when you leave the board.
// Works with free and Premium Spotify; no sign-in.
//
// Settings > Music: paste a playlist link ("Share > Copy link" in Spotify).
// The cover and title come from Spotify's public link preview (oEmbed), and
// are kept with the board so every device shows them.
//
// Spotify's Design & Branding Guidelines (developer.spotify.com/documentation
// /design), which apply because we show their artwork and names:
// - their official full logo with the content (black on light, white on dark,
//   at least 70px wide, with clear space; never inside a sentence)
// - artwork untouched: no overlays, no animation, no cropping, corners 8px on
//   larger screens and 4px on phones
// - names exactly as Spotify gives them (so only private playlists without a
//   cover, which show no Spotify content, can be renamed)
// - links open the Spotify app; labelled "Play on Spotify"
//
//   boardSettings.musicTiles = [{ id, url, title, name, cover }]
// ============================================================================
(function () {
  const MAX_TILES = 8;
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s));
  const tiles = () => (Array.isArray((window.boardSettings || {}).musicTiles) ? window.boardSettings.musicTiles : []);
  const save = (list) => (typeof window.saveBoardSettingsNow === "function" ? window.saveBoardSettingsNow({ musicTiles: list }) : null);

  // "https://open.spotify.com/playlist/37i9...?si=abc", "spotify:playlist:37i9..."
  // -> "https://open.spotify.com/playlist/37i9..." (playlists, albums, artists,
  // podcasts; a single track works too)
  function cleanLink(raw) {
    const s = String(raw || "").trim();
    let m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|artist|show|episode|track)\/([A-Za-z0-9]{10,40})/i);
    if (!m) m = s.match(/^spotify:(playlist|album|artist|show|episode|track):([A-Za-z0-9]{10,40})$/i);
    return m ? `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}` : null;
  }

  async function preview(url) {
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const d = await res.json();
      const cover = typeof d.thumbnail_url === "string" && /^https:\/\/[a-z0-9.-]*scdn\.co\//i.test(d.thumbnail_url) ? d.thumbnail_url : null;
      return { title: typeof d.title === "string" ? d.title.slice(0, 60) : "", cover };
    } catch (e) {
      return null; // private playlists, or offline: the tile gets a gradient instead
    }
  }

  // Covers missing: a soft gradient with a note, in one of a few calm colours
  const FALLBACKS = [["#fde68a", "#f59e0b"], ["#bae6fd", "#0284c7"], ["#ddd6fe", "#7c3aed"], ["#bbf7d0", "#16a34a"], ["#fecdd3", "#e11d48"]];
  const fallbackStyle = (id) => {
    const n = [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACKS.length;
    return `background: linear-gradient(135deg, ${FALLBACKS[n][0]}, ${FALLBACKS[n][1]});`;
  };
  const art = (t, cls) => t.cover
    ? `<img class="${cls}" src="${esc(t.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls} is-fallback" style="${fallbackStyle(t.id)}" aria-hidden="true">♪</span>`;

  // The official Spotify logo files (icons/spotify), black or white to suit the theme
  const logoHtml = (cls) => `<span class="spotify-logo ${cls}" role="img" aria-label="Spotify">
    <img class="spotify-logo-img is-on-light" src="icons/spotify/spotify-logo-black.svg" alt="" width="80" height="22">
    <img class="spotify-logo-img is-on-dark" src="icons/spotify/spotify-logo-white.svg" alt="" width="80" height="22">
  </span>`;
  // What a tile is called: Spotify's own title when it shows their artwork
  const nameOf = (t) => (t.cover ? (t.title || t.name) : t.name) || "Playlist";

  // ---- Today at a glance --------------------------------------------------------
  function todayCardHtml() {
    const list = tiles();
    if (!list.length) return "";
    return `<section class="today-card today-music" aria-labelledby="today-music-title">
      <div class="today-music-head">
        <h3 class="today-card-title" id="today-music-title">🎵 Music</h3>
        ${logoHtml("is-card")}
      </div>
      <div class="today-music-row">
        ${list.map(t => `<a class="music-tile" href="${esc(t.url)}" target="_blank" rel="noopener" aria-label="${esc(nameOf(t))}: Play on Spotify" title="${esc(nameOf(t))}">
          <span class="music-tile-art">${art(t, "music-tile-img")}</span>
          <span class="music-tile-name">${esc(nameOf(t))}</span>
        </a>`).join("")}
      </div>
    </section>`;
  }

  // ---- Settings > Music -----------------------------------------------------------
  function renderSettings(message = "") {
    const box = document.getElementById("music-settings");
    if (!box) return;
    const list = tiles();
    box.innerHTML = `
      ${list.length ? `<ul class="music-set-list">${list.map((t, i) => `<li class="music-set-row" data-music-id="${esc(t.id)}">
        <span class="music-set-art">${art(t, "music-set-img")}</span>
        ${t.cover
          ? `<span class="music-set-title" title="${esc(nameOf(t))}">${esc(nameOf(t))}</span>`
          : `<input class="music-set-name ev-native-input" type="text" value="${esc(t.name || "")}" maxlength="40" aria-label="Name for this playlist" data-music-name>`}
        <button type="button" class="music-set-btn is-remove" data-music-remove aria-label="Remove ${esc(t.name)}">✕</button>
      </li>`).join("")}</ul>` : `<p class="settings-box-desc music-set-empty">No playlists yet. Add your family's favourites below.</p>`}
      ${list.length < MAX_TILES ? `<div class="music-set-add">
        <input id="music-link-input" class="ev-native-input" type="url" inputmode="url" placeholder="Paste a Spotify playlist link" aria-label="Spotify playlist link" autocomplete="off">
        <button type="button" class="settings-outline-btn is-primary" id="btn-music-add">Add</button>
      </div>
      <p class="settings-box-desc music-set-help">In Spotify, open a playlist and tap <strong>⋯</strong> › <strong>Share</strong> › <strong>Copy link</strong>.</p>` : `<p class="settings-box-desc">That's the most there's room for (${MAX_TILES}). Remove one to add another.</p>`}
      <p class="music-set-msg" role="status">${esc(message)}</p>`;
  }

  async function addFromInput() {
    const input = document.getElementById("music-link-input");
    const btn = document.getElementById("btn-music-add");
    if (!input) return;
    const url = cleanLink(input.value);
    if (!url) { renderSettings("That doesn't look like a Spotify link. Copy it from Share › Copy link."); document.getElementById("music-link-input").value = input.value; return; }
    if (tiles().some(t => t.url === url)) { renderSettings("That one's already on the board."); return; }
    if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
    const info = await preview(url);
    const kind = url.split("/")[3];
    const tile = {
      id: `m-${Date.now().toString(36)}`,
      url,
      title: (info && info.title) || "",
      name: (info && info.title) || ({ album: "Album", artist: "Artist", show: "Podcast", episode: "Episode", track: "Song" }[kind] || "Playlist"),
      cover: (info && info.cover) || null
    };
    await save([...tiles(), tile].slice(0, MAX_TILES));
    renderSettings(`Added ${tile.name}. ${info ? "" : "Private playlists don't share their cover, so it has a colour instead."}`.trim());
  }

  document.addEventListener("click", async (e) => {
    const box = e.target.closest && e.target.closest("#music-settings");
    if (!box) return;
    if (e.target.closest("#btn-music-add")) { e.preventDefault(); addFromInput(); return; }
    const row = e.target.closest("[data-music-id]");
    if (!row) return;
    const id = row.getAttribute("data-music-id");
    const list = tiles().slice();
    const i = list.findIndex(t => t.id === id);
    if (i < 0) return;
    if (e.target.closest("[data-music-remove]")) { list.splice(i, 1); await save(list); renderSettings(); return; }
    const mv = e.target.closest("[data-music-move]");
    if (mv) {
      const j = i + parseInt(mv.getAttribute("data-music-move"), 10);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await save(list);
      renderSettings();
    }
  });
  // Rename: saved when you leave the box
  document.addEventListener("change", async (e) => {
    if (!e.target.matches || !e.target.matches("#music-settings [data-music-name]")) return;
    const id = e.target.closest("[data-music-id]").getAttribute("data-music-id");
    const name = e.target.value.trim().slice(0, 40);
    if (!name) { renderSettings(); return; }
    await save(tiles().map(t => (t.id === id ? { ...t, name } : t)));
  });
  // Enter in the link box adds it (and mustn't submit the Settings form)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.closest || !e.target.closest("#music-settings")) return;
    e.preventDefault();
    if (e.target.id === "music-link-input") addFromInput();
    else e.target.blur();
  });

  // Settings > Music header: the Spotify logo beside the section title
  const markSettingsHeader = () => {
    const head = document.getElementById("settings-head-music");
    if (head && !head.querySelector(".spotify-logo")) head.insertAdjacentHTML("beforeend", logoHtml("is-settings"));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markSettingsHeader); else markSettingsHeader();

  window.Music = { todayCardHtml, renderSettings, cleanLink };
})();
