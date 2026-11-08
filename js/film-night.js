// ============================================================================
// WATCH TOGETHER (js/film-night.js; it began as "Film night")
// A "🍿 Watch together" card on Today at a glance: popular and latest family films
// and series on the streaming services this family has ticked in Settings.
// Tap a poster: what it is, which of your services it's on, "New" if it
// arrived in the last two weeks, and "Plan when to watch" (the event panel,
// filled in). No links out of harmonee.
//
// Data: Streaming Availability API by Movie of the Night (free plan, 1,000
// requests a month, commercial use allowed, credit required: Settings).
// The key lives in js/secret-keys.js, which is never committed.
//
// Only English-language titles tagged Family, and nothing also tagged horror,
// thriller, crime, war, reality, news or talk. Anything else that isn't right
// for a family can be hidden for the whole board ("Hide this").
//
// One list per service, shared by every harmonee family: the first device to
// open after Sunday 6pm fetches the new week's list (2 requests per service)
// and saves it to streaming/{service}; everyone else reads that copy. So the
// requests don't grow with the number of families.
//
//   boardSettings.filmNight = { services: ["netflix", "prime"], hidden: [showIds] }
// ============================================================================
(function (root) {
  const KEY = () => ((root.HARMONEE_KEYS || {}).motn) || "";
  const API = "https://api.movieofthenight.com/v4";
  const CDN = "https://cdn.movieofthenight.com/";
  const CREDIT_URL = "https://www.movieofthenight.com/about/api";
  // UK subscription services (Movie of the Night ids)
  const SERVICES = [
    { id: "netflix", name: "Netflix" },
    { id: "prime", name: "Prime Video" },
    { id: "disney", name: "Disney+" },
    { id: "apple", name: "Apple TV" },
    { id: "iplayer", name: "BBC iPlayer" },
    { id: "itvx", name: "ITVX" },
    { id: "all4", name: "Channel 4" },
    { id: "now", name: "NOW" },
    { id: "paramount", name: "Paramount+" }
  ];
  const NOT_FOR_FAMILIES = ["horror", "thriller", "crime", "war", "reality", "news", "talk"];
  const GENRE_NAMES = { action: "Action", adventure: "Adventure", animation: "Animation", comedy: "Comedy", documentary: "Documentary", drama: "Drama", family: "Family", fantasy: "Fantasy", history: "History", music: "Music", mystery: "Mystery", romance: "Romance", scifi: "Sci-fi", western: "Western" };
  const NEW_DAYS = 14;
  const esc = (s) => (root.escapeHtml ? root.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  const ready = () => !!KEY();
  function settings() {
    const s = ((root.boardSettings || {}).filmNight) || {};
    return {
      services: Array.isArray(s.services) ? s.services.filter(id => SERVICES.some(x => x.id === id)) : [],
      hidden: Array.isArray(s.hidden) ? s.hidden.map(String) : []
    };
  }

  // ---- The week ("Sunday 6pm" is when a new list is due) ------------------------------
  function weekStart(now = new Date()) {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // this week's Sunday, 6pm
    if (d > now) d.setDate(d.getDate() - 7);
    return d;
  }
  const isStale = (fetchedAt, now = new Date()) => !fetchedAt || fetchedAt < weekStart(now).getTime();

  // ---- What to ask for (pure, tested in scripts/test-films.js) -------------------------
  function urlFor(service, order) {
    const q = {
      country: "gb",
      catalogs: `${service}.subscription`,
      genres: "family",
      show_original_language: "en",
      order_by: order === "latest" ? "release_date" : "popularity_1month",
      order_direction: "desc",
      output_language: "en"
    };
    return `${API}/shows/search/filters?${Object.keys(q).map(k => `${k}=${encodeURIComponent(q[k])}`).join("&")}`;
  }
  // A show from the API, trimmed to what the card needs (kept small: it's shared)
  function slim(show, service) {
    const genres = (show.genres || []).map(g => g.id).filter(Boolean);
    if (genres.some(g => NOT_FOR_FAMILIES.includes(g))) return null;
    const subs = (((show.streamingOptions || {}).gb) || []).filter(o => o.type === "subscription" && o.service && o.service.id === service);
    const since = subs.map(o => o.availableSince || 0).filter(Boolean);
    const posters = (show.imageSet || {}).verticalPoster || {};
    const safe = (u) => (typeof u === "string" && u.startsWith(CDN) ? u : null);
    return {
      id: String(show.id || ""),
      type: show.showType === "series" ? "series" : "movie",
      title: String(show.title || "").slice(0, 120),
      year: show.releaseYear || show.firstAirYear || null,
      genres,
      overview: String(show.overview || "").slice(0, 500),
      runtime: show.runtime || null,
      seasons: show.seasonCount || null,
      poster: safe(posters.w240),
      posterBig: safe(posters.w360) || safe(posters.w240),
      since: since.length ? Math.min(...since) * 1000 : null
    };
  }
  function slimList(json, service) {
    return ((json && json.shows) || []).map(s => slim(s, service)).filter(x => x && x.id && x.title);
  }
  // The family's services merged: one entry per show, with every service it's on
  function merge(byService, which, chosen, hidden) {
    const out = new Map();
    chosen.forEach(svc => {
      const list = ((byService[svc] || {})[which]) || [];
      list.forEach((item, rank) => {
        if (!item || hidden.includes(item.id)) return;
        const have = out.get(item.id);
        if (have) {
          if (!have.on.includes(svc)) have.on.push(svc);
          if (item.since && (!have.since || item.since < have.since)) have.since = item.since;
          have.rank = Math.min(have.rank, rank);
        } else out.set(item.id, { ...item, on: [svc], rank });
      });
    });
    const items = [...out.values()];
    // Popular: each service's own order, taking turns; Latest: newest first
    items.sort((a, b) => which === "latest" ? ((b.year || 0) - (a.year || 0)) || (a.rank - b.rank) : (a.rank - b.rank));
    return items.slice(0, 24);
  }
  const isNew = (item, now = Date.now()) => !!item.since && now - item.since < NEW_DAYS * 86400000;

  // When "Plan film night" suggests: tonight at 7 (tomorrow once it's late)
  function planSlot(now = new Date(), runtime = 0) {
    const day = new Date(now); day.setHours(0, 0, 0, 0);
    if (now.getHours() * 60 + now.getMinutes() > 19 * 60 + 30) day.setDate(day.getDate() + 1);
    return { date: day, start: "19:00", mins: Math.max(60, Math.ceil((runtime || 100) / 15) * 15) };
  }

  // ---- Lists: this device's copy, the shared copy, or a fresh fetch ----------------------
  const LOCAL = "harmonee_streaming_";
  const local = (svc) => { try { return JSON.parse(localStorage.getItem(LOCAL + svc) || "null"); } catch (e) { return null; } };
  const saveLocal = (svc, data) => { try { localStorage.setItem(LOCAL + svc, JSON.stringify(data)); } catch (e) {} };
  const busy = new Set();
  const failedAt = {};

  async function fetchService(svc) {
    const get = async (order) => {
      const res = await fetch(urlFor(svc, order), { headers: { "X-API-Key": KEY() } });
      if (!res.ok) throw new Error(`Streaming list ${res.status}`);
      return slimList(await res.json(), svc);
    };
    const [popular, latest] = await Promise.all([get("popular"), get("latest")]);
    return { popular, latest };
  }

  // Makes sure a service's list is this week's; tells the card when it changes
  async function refresh(svc) {
    if (busy.has(svc) || !ready()) return;
    if (failedAt[svc] && Date.now() - failedAt[svc] < 3600000) return; // after a failure, wait an hour
    busy.add(svc);
    try {
      // Another family's device may already have fetched it this week
      const shared = typeof root.streamingListGet === "function" ? await root.streamingListGet(svc) : null;
      if (shared && !isStale(shared.fetchedAt)) { saveLocal(svc, shared); return; }
      const fresh = await fetchService(svc);
      saveLocal(svc, { ...fresh, fetchedAt: Date.now() });
      if (typeof root.streamingListSave === "function") { try { await root.streamingListSave(svc, fresh); } catch (e) {} }
    } catch (e) {
      console.warn("Watch together:", e);
      // Offline isn't the service failing: look again as soon as we're back
      if (!(window.isOffline && window.isOffline())) failedAt[svc] = Date.now();
    } finally {
      busy.delete(svc);
      document.dispatchEvent(new CustomEvent("harmonee:films"));
    }
  }

  function lists(s) {
    const byService = {};
    let waiting = false;
    s.services.forEach(svc => {
      const l = local(svc);
      if (l) byService[svc] = l;
      if (!l || isStale(l.fetchedAt)) { refresh(svc); if (!l && !failedAt[svc]) waiting = true; }
    });
    return { byService, waiting };
  }

  // ---- The card ------------------------------------------------------------------------
  const TAB_KEY = "harmonee_film_tab";
  const tabNow = () => { try { return localStorage.getItem(TAB_KEY) === "latest" ? "latest" : "popular"; } catch (e) { return "popular"; } };
  let shown = [];
  const poster = (f, big) => (big ? f.posterBig : f.poster)
    ? `<img class="film-poster-img" src="${esc(big ? f.posterBig : f.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="film-poster-img is-blank" aria-hidden="true">🎬</span>`;
  const serviceNames = (ids) => ids.map(id => (SERVICES.find(x => x.id === id) || {}).name).filter(Boolean);

  function cardHtml() {
    if (!ready()) return "";
    const s = settings();
    if (!s.services.length) {
      return `<section class="today-card today-films" aria-labelledby="today-films-title">
        <h3 class="today-card-title" id="today-films-title">🍿 Watch together</h3>
        <p class="today-empty">Family films and series to watch together, from your streaming services. Choose which ones you have.</p>
        <div class="today-card-foot"><button type="button" class="today-add-btn" data-film-setup><span class="today-add-plus" aria-hidden="true">${root.TODAY_PLUS_ICON || "+"}</span> Choose services</button></div>
      </section>`;
    }
    const tab = tabNow();
    const { byService, waiting } = lists(s);
    shown = merge(byService, tab, s.services, s.hidden);
    const body = shown.length
      ? `<div class="film-row">${shown.map((f, i) => `<button type="button" class="film-tile" data-film="${i}" aria-label="${esc(f.title)}${isNew(f) ? ", new" : ""}">
          <span class="film-poster">${poster(f)}${isNew(f) ? `<span class="film-new">New</span>` : ""}${f.type === "series" ? `<span class="film-kind">Series</span>` : ""}</span>
          <span class="film-name">${esc(f.title)}</span>
        </button>`).join("")}</div>`
      : `<p class="today-empty">${window.isOffline && window.isOffline() ? "Finding films needs the internet. They'll show when you're back online."
          : waiting ? "Finding family films…" : "Nothing to show just now. It'll look again soon."}</p>`;
    return `<section class="today-card today-films" aria-labelledby="today-films-title">
      <div class="film-head">
        <h3 class="today-card-title" id="today-films-title">🍿 Watch together</h3>
        <div class="film-tabs" role="tablist" aria-label="Which films">${[["popular", "Popular"], ["latest", "Latest"]].map(([k, label]) => `<button type="button" role="tab" class="film-tab${k === tab ? " is-on" : ""}" aria-selected="${k === tab}" data-film-tab="${k}">${label}</button>`).join("")}</div>
      </div>
      ${body}
    </section>`;
  }

  // ---- Details sheet ---------------------------------------------------------------------
  let sheet = null, current = null;
  function getSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("dialog");
    sheet.id = "film-dialog";
    sheet.className = "film-dialog";
    sheet.setAttribute("aria-labelledby", "film-title");
    document.body.appendChild(sheet);
    sheet.addEventListener("cancel", (e) => { e.preventDefault(); sheet.close(); });
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest("[data-film-close]")) { sheet.close(); return; }
      if (e.target.closest("[data-film-plan]")) { plan(); return; }
      if (e.target.closest("[data-film-hide]")) { hide(); }
    });
    return sheet;
  }

  function open(f) {
    if (!f) return;
    current = f;
    const d = getSheet();
    const length = f.type === "series"
      ? (f.seasons ? `${f.seasons} season${f.seasons === 1 ? "" : "s"}` : "Series")
      : (f.runtime ? (f.runtime >= 60 ? `${Math.floor(f.runtime / 60)}h ${String(f.runtime % 60).padStart(2, "0")}m` : `${f.runtime}m`) : "Film");
    const meta = [f.year, length, f.genres.filter(g => g !== "family").map(g => GENRE_NAMES[g]).filter(Boolean).slice(0, 3).join(", ")].filter(Boolean).map(esc).join(" · ");
    const on = serviceNames(f.on || []);
    d.innerHTML = `<div class="film-card">
      <button type="button" class="film-x" data-film-close aria-label="Close">✕</button>
      <div class="film-top">
        <span class="film-big-poster">${poster(f, true)}</span>
        <div class="film-info">
          <h2 class="film-title" id="film-title">${esc(f.title)}</h2>
          <p class="film-meta"><span>${meta || "&nbsp;"}</span></p>
          ${on.length ? `<p class="film-status">On ${esc(on.join(" and "))}${isNew(f) ? ` <span class="film-new is-inline">New</span>` : ""}</p>` : ""}
        </div>
      </div>
      ${f.overview ? `<p class="film-overview">${esc(f.overview)}</p>` : ""}
      <div class="film-actions">
        <button type="button" class="film-btn" data-film-hide>🙈 Hide this</button>
        <button type="button" class="film-btn is-primary" data-film-plan>🗓️ Plan when to watch</button>
      </div>
    </div>`;
    if (!d.open) d.showModal();
  }

  function plan() {
    if (!current || typeof root.openEventModal !== "function") return;
    const slot = planSlot(new Date(), current.type === "movie" ? current.runtime : 60);
    const pad = (n) => String(n).padStart(2, "0");
    const key = `${slot.date.getFullYear()}-${pad(slot.date.getMonth() + 1)}-${pad(slot.date.getDate())}`;
    const title = `Watch together: ${current.title}`;
    const len = typeof root.formatEventDuration === "function" ? root.formatEventDuration(slot.mins) : "2 hours";
    sheet.close();
    root.openEventModal(null, null, key, { start: slot.start, duration: len }, { title, members: ["Family"] });
  }

  async function hide() {
    if (!current) return;
    const s = settings();
    const title = current.title;
    sheet.close();
    await saveSettings({ services: s.services, hidden: [...new Set([...s.hidden, current.id])].slice(-300) });
    if (typeof root.showCalendarToast === "function") root.showCalendarToast(`🙈 ${title} won't show again`);
  }

  // ---- Settings > Film night -------------------------------------------------------------
  function renderSettings() {
    const sec = document.getElementById("settings-sec-films");
    const chip = document.querySelector('#settings-section-nav [data-section="films"]');
    if (sec) sec.hidden = !ready();
    if (chip) chip.hidden = !ready();
    const box = document.getElementById("film-settings");
    if (!box || !ready()) return;
    const s = settings();
    box.innerHTML = `
      <p class="settings-box-desc">Which streaming services do you have?</p>
      <div class="film-set-services" role="group" aria-label="Your streaming services">${SERVICES.map(x => `<button type="button" class="film-set-chip${s.services.includes(x.id) ? " is-on" : ""}" aria-pressed="${s.services.includes(x.id)}" data-film-service="${x.id}">${esc(x.name)}</button>`).join("")}</div>
      <p class="settings-box-desc film-set-help">Only family films and series in English. ${s.hidden.length ? `${s.hidden.length} hidden. <button type="button" class="film-set-link" data-film-unhide>Show them again</button>` : `Tap a poster, then "Hide this", to take anything off.`}</p>
      <p class="film-set-credit">Streaming availability and images provided by <a href="${CREDIT_URL}" target="_blank" rel="noopener">Streaming Availability API by Movie of the Night</a>.</p>`;
  }
  async function saveSettings(next) {
    // Explicit values (board settings merge, so a missing key would come back)
    if (typeof root.saveBoardSettingsNow === "function") await root.saveBoardSettingsNow({ filmNight: { services: next.services, hidden: next.hidden } });
    renderSettings();
    document.dispatchEvent(new CustomEvent("harmonee:films"));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", (e) => {
      const at = (sel) => e.target.closest && e.target.closest(sel);
      const t = at("[data-film-tab]");
      if (t) { try { localStorage.setItem(TAB_KEY, t.getAttribute("data-film-tab")); } catch (err) {} document.dispatchEvent(new CustomEvent("harmonee:films")); return; }
      const tile = at("[data-film]");
      if (tile) { open(shown[Number(tile.getAttribute("data-film"))]); return; }
      if (at("[data-film-setup]")) {
        if (typeof root.closeTodayScreen === "function") root.closeTodayScreen();
        const btn = document.getElementById("nav-item-settings");
        if (btn) btn.click();
        setTimeout(() => { const c = document.querySelector('#settings-section-nav [data-section="films"]'); if (c) c.click(); }, 500);
        return;
      }
      const svc = at("[data-film-service]");
      if (svc) {
        const s = settings(); const id = svc.getAttribute("data-film-service");
        saveSettings({ services: s.services.includes(id) ? s.services.filter(x => x !== id) : [...s.services, id], hidden: s.hidden });
        return;
      }
      if (at("[data-film-unhide]")) { const s = settings(); saveSettings({ services: s.services, hidden: [] }); }
    });
    const first = () => renderSettings();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", first); else first();
    window.addEventListener("online", () => document.dispatchEvent(new CustomEvent("harmonee:films")));
  }

  const api = { ready, cardHtml, renderSettings, open, urlFor, slim, slimList, merge, isNew, isStale, weekStart, planSlot, SERVICES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FilmNight = api;
})(typeof window !== "undefined" ? window : globalThis);
