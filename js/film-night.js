// ============================================================================
// FAMILY FILM NIGHT (js/film-night.js)
// A "🍿 Film night" card on Today at a glance: what's in UK cinemas, what's
// coming soon, and family films and series on the streaming services this
// family has. Tap a poster: rating, summary, trailer, and "Plan film night"
// (opens the event panel filled in) or "Count down to it".
//
// Film information comes from TMDB (themoviedb.org), free for non-commercial
// use. "Where to watch" comes from JustWatch, through TMDB. Both are credited
// in Settings > Film night. No showtimes: UK cinema chains don't share them,
// so cinema films offer a "Find showtimes" search instead.
//
//   boardSettings.filmNight = { services: [providerIds], maxCert: "PG" }
//
// Needs a TMDB API key (below). Without one, Film night doesn't appear.
// ============================================================================
(function (root) {
  // The free TMDB API key (themoviedb.org > Settings > API > "API Key").
  // Read-only, so it's fine in the page; regenerate it there if ever needed.
  let TMDB_KEY = "";

  const API = "https://api.themoviedb.org/3";
  const IMG = "https://image.tmdb.org/t/p/";
  const CERTS = ["U", "PG", "12A", "12", "15"]; // BBFC, mildest first
  const CERT_NOTE = { U: "Suitable for all", PG: "Parental guidance", "12A": "12 and over, or with an adult", "12": "12 and over", "15": "15 and over" };
  // UK streaming services (TMDB / JustWatch provider ids)
  const SERVICES = [
    { id: 8, name: "Netflix" },
    { id: 337, name: "Disney+" },
    { id: 9, name: "Prime Video" },
    { id: 350, name: "Apple TV+" },
    { id: 38, name: "BBC iPlayer" },
    { id: 41, name: "ITVX" },
    { id: 103, name: "Channel 4" },
    { id: 39, name: "NOW" }
  ];
  const TTL = 12 * 3600 * 1000; // lists are kept for 12 hours
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = (s) => (root.escapeHtml ? root.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  const ready = () => !!TMDB_KEY;
  function settings() {
    const s = ((root.boardSettings || {}).filmNight) || {};
    return {
      services: Array.isArray(s.services) ? s.services.filter(id => SERVICES.some(x => x.id === id)) : [],
      maxCert: CERTS.includes(s.maxCert) ? s.maxCert : "PG"
    };
  }

  // ---- What to ask TMDB (pure, tested in scripts/test-films.js) --------------------
  function query(path, params) {
    const q = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== "").map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
    return `${API}${path}?${q}`;
  }
  // kind: "cinema" | "soon" | "films" | "series"
  function urlFor(kind, s, today = new Date()) {
    const base = { api_key: TMDB_KEY, language: "en-GB", include_adult: "false", page: 1 };
    if (kind === "cinema") return query("/discover/movie", { ...base, region: "GB", with_release_type: "2|3", "release_date.gte": ymd(addDays(today, -42)), "release_date.lte": ymd(today), certification_country: "GB", "certification.lte": s.maxCert, sort_by: "popularity.desc" });
    if (kind === "soon") return query("/discover/movie", { ...base, region: "GB", with_release_type: "2|3", "release_date.gte": ymd(addDays(today, 1)), "release_date.lte": ymd(addDays(today, 120)), with_genres: "10751|16", sort_by: "popularity.desc" });
    const providers = s.services.join("|");
    if (kind === "films") return query("/discover/movie", { ...base, watch_region: "GB", with_watch_providers: providers, with_watch_monetization_types: "flatrate", certification_country: "GB", "certification.lte": s.maxCert, sort_by: "popularity.desc" });
    if (kind === "series") return query("/discover/tv", { ...base, watch_region: "GB", with_watch_providers: providers, with_watch_monetization_types: "flatrate", with_genres: "10762|10751", sort_by: "popularity.desc" });
    return null;
  }
  const detailsUrl = (item) => item.type === "tv"
    ? query(`/tv/${item.id}`, { api_key: TMDB_KEY, language: "en-GB", append_to_response: "videos,watch/providers,content_ratings" })
    : query(`/movie/${item.id}`, { api_key: TMDB_KEY, language: "en-GB", append_to_response: "videos,watch/providers,release_dates" });
  const datesUrl = (id) => query(`/movie/${id}/release_dates`, { api_key: TMDB_KEY });

  // A film or series from a TMDB list
  function normalise(r, type) {
    const date = type === "tv" ? r.first_air_date : r.release_date;
    return {
      id: r.id, type,
      title: (type === "tv" ? r.name : r.title) || "",
      year: date ? String(date).slice(0, 4) : "",
      date: date || "",
      poster: r.poster_path || null,
      backdrop: r.backdrop_path || null,
      overview: r.overview || "",
      popularity: r.popularity || 0
    };
  }
  // The UK certificate and cinema date, from /release_dates
  function gbRelease(json) {
    const gb = ((json && json.results) || []).find(r => r.iso_3166_1 === "GB");
    if (!gb) return { cert: "", date: "" };
    const rows = (gb.release_dates || []).slice().sort((a, b) => (a.type === 3 ? -1 : 0) - (b.type === 3 ? -1 : 0));
    const cert = (rows.find(r => r.certification) || {}).certification || "";
    const cinema = rows.find(r => r.type === 3 || r.type === 2);
    return { cert, date: cinema && cinema.release_date ? cinema.release_date.slice(0, 10) : "" };
  }
  const gbTvRating = (json) => ((((json || {}).results) || []).find(r => r.iso_3166_1 === "GB") || {}).rating || "";
  // The best YouTube trailer: official trailers first, then teasers
  function trailer(videos) {
    const yt = (((videos || {}).results) || []).filter(v => v.site === "YouTube" && v.key);
    const rank = (v) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) + (v.official ? 0 : 0.5) + (v.iso_639_1 === "en" ? 0 : 0.25);
    const best = yt.sort((a, b) => rank(a) - rank(b))[0];
    return best ? `https://www.youtube.com/watch?v=${encodeURIComponent(best.key)}` : null;
  }
  // Which of the family's services it's on in the UK (theirs first, then others)
  function whereToWatch(json, mine) {
    const gb = (((json || {}).results) || {}).GB || {};
    const names = (gb.flatrate || []).map(p => ({ id: p.provider_id, name: (SERVICES.find(x => x.id === p.provider_id) || {}).name || p.provider_name }));
    return { ours: names.filter(n => mine.includes(n.id)).map(n => n.name), others: names.filter(n => !mine.includes(n.id)).map(n => n.name) };
  }
  const allowed = (cert, max) => !cert || CERTS.indexOf(cert) < 0 || CERTS.indexOf(cert) <= CERTS.indexOf(max);
  const prettyDate = (s) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const runtimeText = (mins) => (mins ? (mins >= 60 ? `${Math.floor(mins / 60)}h ${pad(mins % 60)}m` : `${mins}m`) : "");

  // When "Plan film night" suggests: cinema the coming Saturday afternoon,
  // streaming tonight (or tomorrow once it's late)
  function planSlot(kind, now = new Date(), runtime = 0) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const len = Math.max(60, Math.ceil(((runtime || 100) + (kind === "cinema" ? 30 : 0)) / 15) * 15);
    if (kind === "cinema") {
      const toSat = (6 - today.getDay() + 7) % 7;
      return { date: addDays(today, toSat), start: "14:00", mins: len };
    }
    const late = now.getHours() * 60 + now.getMinutes() > 19 * 60 + 30;
    return { date: late ? addDays(today, 1) : today, start: "19:00", mins: len };
  }

  // ---- Fetching, with a 12-hour cache per device ---------------------------------------
  const cacheKey = (kind, s) => `harmonee_films_${kind}_${s.maxCert}_${kind === "films" || kind === "series" ? s.services.join("-") : ""}`;
  const loading = new Set();
  function cached(kind, s) {
    try { const c = JSON.parse(localStorage.getItem(cacheKey(kind, s)) || "null"); return c && Array.isArray(c.items) ? c : null; } catch (e) { return null; }
  }
  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json();
  }
  async function load(kind, s) {
    const key = cacheKey(kind, s);
    if (loading.has(key)) return;
    loading.add(key);
    try {
      let items;
      if (kind === "films" || kind === "series") {
        items = ((await getJson(urlFor(kind, s))).results || []).map(r => normalise(r, kind === "series" ? "tv" : "movie")).slice(0, 16);
      } else {
        // Cinema lists: the UK certificate and UK date for each (one small request each)
        const list = ((await getJson(urlFor(kind, s))).results || []).map(r => normalise(r, "movie")).slice(0, 12);
        await Promise.all(list.map(async (f) => {
          try { const gb = gbRelease(await getJson(datesUrl(f.id))); f.cert = gb.cert; if (gb.date) f.date = gb.date; } catch (e) {}
        }));
        items = list.filter(f => allowed(f.cert, s.maxCert));
        if (kind === "soon") items.sort((a, b) => a.date.localeCompare(b.date));
      }
      if (kind === "films") items.forEach(f => { f.cert = ""; });
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); } catch (e) {}
    } catch (e) {
      console.warn("Film night:", e);
      try { if (!cached(kind, s)) localStorage.setItem(key, JSON.stringify({ at: Date.now() - TTL + 15 * 60000, items: [], failed: true })); } catch (err) {}
    } finally {
      loading.delete(key);
      document.dispatchEvent(new CustomEvent("harmonee:films"));
    }
  }
  // Items for a tab, loading in the background when missing or old
  function items(tab, s) {
    const kinds = tab === "stream" ? ["films", "series"] : [tab];
    let out = [], waiting = false, failed = false;
    kinds.forEach(k => {
      const c = cached(k, s);
      if (!c || Date.now() - c.at > TTL) { load(k, s); if (!c) waiting = true; }
      if (c) { out = out.concat(c.items); if (c.failed) failed = true; }
    });
    if (tab === "stream") out.sort((a, b) => b.popularity - a.popularity);
    return { list: out, waiting, failed };
  }

  // ---- The card ------------------------------------------------------------------------
  const TAB_KEY = "harmonee_film_tab";
  function tabNow(s) {
    let t = "cinema";
    try { t = localStorage.getItem(TAB_KEY) || "cinema"; } catch (e) {}
    if (t === "stream" && !s.services.length) t = "cinema";
    return t;
  }
  const poster = (f, size = "w185") => f.poster
    ? `<img class="film-poster-img" src="${IMG}${size}${esc(f.poster)}" alt="" loading="lazy">`
    : `<span class="film-poster-img is-blank" aria-hidden="true">🎬</span>`; // no poster yet

  function cardHtml() {
    if (!ready()) return "";
    const s = settings();
    const tab = tabNow(s);
    const { list, waiting, failed } = items(tab, s);
    const tabs = [["cinema", "In cinemas"], ["soon", "Coming soon"]].concat(s.services.length ? [["stream", "Streaming"]] : []);
    const body = list.length
      ? `<div class="film-row">${list.map((f, i) => `<button type="button" class="film-tile" data-film="${i}" aria-label="${esc(f.title)}${f.cert ? `, ${esc(f.cert)}` : ""}">
          <span class="film-poster">${poster(f)}${f.cert ? `<span class="film-cert is-${esc(f.cert.toLowerCase())}">${esc(f.cert)}</span>` : ""}${f.type === "tv" ? `<span class="film-kind">Series</span>` : ""}</span>
          <span class="film-name">${esc(f.title)}</span>
          ${tab === "soon" && f.date ? `<span class="film-when">${prettyDate(f.date)}</span>` : ""}
        </button>`).join("")}</div>`
      : `<p class="today-empty">${waiting ? "Finding films…" : failed ? "Couldn't reach the film listings. It'll try again soon." : tab === "stream" ? "Nothing family-friendly found on your services just now." : "Nothing showing that fits your age setting."}</p>`;
    return `<section class="today-card today-films" aria-labelledby="today-films-title">
      <div class="film-head">
        <h3 class="today-card-title" id="today-films-title">🍿 Film night</h3>
        <div class="film-tabs" role="tablist" aria-label="Which films">${tabs.map(([k, label]) => `<button type="button" role="tab" class="film-tab${k === tab ? " is-on" : ""}" aria-selected="${k === tab}" data-film-tab="${k}">${label}</button>`).join("")}</div>
      </div>
      ${body}
    </section>`;
  }
  function itemAt(i) {
    const s = settings();
    return items(tabNow(s), s).list[Number(i)] || null;
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
      if (e.target.closest("[data-film-countdown]")) { countdown(); }
    });
    return sheet;
  }

  async function open(f, tab) {
    if (!f) return;
    current = { f, tab, runtime: 0, cert: f.cert || "", date: f.date };
    const d = getSheet();
    draw(null);
    if (!d.open) d.showModal();
    let info = null;
    try { info = await getJson(detailsUrl(f)); } catch (e) {}
    if (!current || current.f !== f) return;
    draw(info);
  }

  function draw(info) {
    const { f, tab } = current;
    const s = settings();
    let cert = current.cert, runtime = 0, genres = [], where = { ours: [], others: [] }, video = null;
    if (info) {
      if (f.type === "tv") { cert = gbTvRating(info.content_ratings) || cert; runtime = (info.episode_run_time || [])[0] || 0; }
      else { const gb = gbRelease(info.release_dates); cert = gb.cert || cert; if (gb.date) current.date = gb.date; runtime = info.runtime || 0; }
      genres = (info.genres || []).map(g => g.name).slice(0, 3);
      where = whereToWatch(info["watch/providers"], s.services);
      video = trailer(info.videos);
      current.runtime = runtime;
      current.cert = cert;
    }
    const today = ymd(new Date());
    const status = tab === "stream"
      ? (where.ours.length ? `On ${where.ours.join(", ")}` : where.others.length ? `On ${where.others.join(", ")}` : "")
      : current.date && current.date > today ? `In cinemas ${prettyDate(current.date)}` : "In cinemas now";
    const certBadge = cert ? `<span class="film-cert is-${esc(cert.toLowerCase())}">${esc(cert)}</span>` : "";
    const meta = [f.year, runtimeText(runtime), genres.join(", ")].filter(Boolean).map(esc).join(" · ");
    const showtimes = `https://www.google.com/search?q=${encodeURIComponent(`${f.title} showtimes near me`)}`;
    sheet.innerHTML = `<div class="film-card">
      <button type="button" class="film-x" data-film-close aria-label="Close">✕</button>
      <div class="film-top">
        <span class="film-big-poster">${poster(f, "w342")}</span>
        <div class="film-info">
          <h2 class="film-title" id="film-title">${esc(f.title)}</h2>
          <p class="film-meta">${certBadge}<span>${meta || "&nbsp;"}</span></p>
          ${cert && CERT_NOTE[cert] ? `<p class="film-cert-note">${esc(CERT_NOTE[cert])}</p>` : ""}
          ${status ? `<p class="film-status">${esc(status)}</p>` : ""}
        </div>
      </div>
      ${f.overview ? `<p class="film-overview">${esc(f.overview)}</p>` : ""}
      <div class="film-actions">
        ${video ? `<a class="film-btn" href="${esc(video)}" target="_blank" rel="noopener">▶ Trailer</a>` : ""}
        ${tab === "cinema" ? `<a class="film-btn" href="${esc(showtimes)}" target="_blank" rel="noopener">🎟️ Find showtimes</a>` : ""}
        ${tab === "soon" ? `<button type="button" class="film-btn" data-film-countdown>⏳ Count down to it</button>` : ""}
        <button type="button" class="film-btn is-primary" data-film-plan>🗓️ Plan film night</button>
      </div>
      ${tab === "stream" ? `<p class="film-credit">Where to watch: JustWatch</p>` : ""}
    </div>`;
  }

  function plan() {
    if (!current || typeof root.openEventModal !== "function") return;
    const { f, tab } = current;
    const kind = tab === "stream" ? "stream" : "cinema";
    const slot = planSlot(kind, new Date(), current.runtime);
    let date = slot.date;
    if (tab === "soon" && current.date) { const [y, m, d] = current.date.split("-").map(Number); date = new Date(y, m - 1, d); if (date.getDay() !== 6) date = addDays(date, (6 - date.getDay() + 7) % 7); }
    const title = kind === "cinema" ? `Cinema: ${f.title}` : f.type === "tv" ? `Watch together: ${f.title}` : `Film night: ${f.title}`;
    sheet.close();
    const len = typeof root.formatEventDuration === "function" ? root.formatEventDuration(slot.mins) : "2 hours";
    root.openEventModal(null, null, ymd(date), { start: slot.start, duration: len }, { title, members: ["Family"] });
  }
  function countdown() {
    if (!current || typeof root.openEventModal !== "function" || !current.date) return;
    sheet.close();
    root.openEventModal(null, null, current.date, { duration: "All Day" }, { title: `${current.f.title} in cinemas`, members: ["Family"], countdown: true });
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
      <p class="settings-box-desc">Streaming services you have (for the Streaming tab)</p>
      <div class="film-set-services" role="group" aria-label="Your streaming services">${SERVICES.map(x => `<button type="button" class="film-set-chip${s.services.includes(x.id) ? " is-on" : ""}" aria-pressed="${s.services.includes(x.id)}" data-film-service="${x.id}">${esc(x.name)}</button>`).join("")}</div>
      <p class="settings-box-desc film-set-label">Show films rated up to</p>
      <div class="film-set-certs" role="group" aria-label="Highest age rating">${CERTS.map(c => `<button type="button" class="film-set-chip is-cert${c === s.maxCert ? " is-on" : ""}" aria-pressed="${c === s.maxCert}" data-film-cert="${c}">${c}</button>`).join("")}</div>
      <p class="settings-box-desc film-set-help">${esc(CERT_NOTE[s.maxCert])}. Series are from the Kids and Family sections.</p>
      <p class="film-set-credit">Film information from <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB. Where to watch from <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a>.</p>`;
  }
  async function saveSettings(next) {
    if (typeof root.saveBoardSettingsNow === "function") await root.saveBoardSettingsNow({ filmNight: next });
    renderSettings();
    document.dispatchEvent(new CustomEvent("harmonee:films"));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest("[data-film-tab]");
      if (t) { try { localStorage.setItem(TAB_KEY, t.getAttribute("data-film-tab")); } catch (err) {} document.dispatchEvent(new CustomEvent("harmonee:films")); return; }
      const tile = e.target.closest && e.target.closest("[data-film]");
      if (tile) { const s = settings(); open(itemAt(tile.getAttribute("data-film")), tabNow(s)); return; }
      const svc = e.target.closest && e.target.closest("[data-film-service]");
      if (svc) { const s = settings(); const id = Number(svc.getAttribute("data-film-service")); saveSettings({ ...s, services: s.services.includes(id) ? s.services.filter(x => x !== id) : [...s.services, id] }); return; }
      const cert = e.target.closest && e.target.closest("[data-film-cert]");
      if (cert) { const s = settings(); saveSettings({ ...s, maxCert: cert.getAttribute("data-film-cert") }); }
    });
    const hideSettings = () => renderSettings();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideSettings); else hideSettings();
  }

  // Tests only (scripts/test-films.js and the test board): a stand-in key
  const _testKey = (k) => { TMDB_KEY = String(k || ""); };
  const api = { _testKey, ready, cardHtml, renderSettings, open, urlFor, normalise, gbRelease, trailer, whereToWatch, planSlot, allowed, SERVICES, CERTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FilmNight = api;
})(typeof window !== "undefined" ? window : globalThis);
