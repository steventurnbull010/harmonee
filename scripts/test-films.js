#!/usr/bin/env node
// Checks Film night's TMDB handling (js/film-night.js) with sample responses
// in TMDB's documented shape. The titles are made up and never shown in the app.
// Run: node scripts/test-films.js
global.window = global;
global.localStorage = { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = String(v); } };
const F = require("../js/film-night.js");
F._testKey("TESTKEY");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const params = (url) => Object.fromEntries(new URL(url).searchParams);
const today = new Date(2026, 10, 7, 17, 0); // Saturday 7 Nov 2026, 5pm
const s = { services: [8, 337], maxCert: "PG" };

// ---- What gets asked for
let p = params(F.urlFor("cinema", s, today));
check("cinema: UK, PG and under, last 6 weeks", [p.region, p["certification.lte"], p.certification_country, p["release_date.gte"], p["release_date.lte"], p.api_key], ["GB", "PG", "GB", "2026-09-26", "2026-11-07", "TESTKEY"]);
p = params(F.urlFor("soon", s, today));
check("soon: next 4 months, family or animation", [p["release_date.gte"], p["release_date.lte"], p.with_genres], ["2026-11-08", "2027-03-07", "10751|16"]);
p = params(F.urlFor("films", s, today));
check("films: on Netflix or Disney+ in the UK, subscription", [p.with_watch_providers, p.watch_region, p.with_watch_monetization_types, p["certification.lte"]], ["8|337", "GB", "flatrate", "PG"]);
p = params(F.urlFor("series", { ...s, maxCert: "12A" }, today));
check("series: kids and family", [new URL(F.urlFor("series", s, today)).pathname, p.with_genres], ["/3/discover/tv", "10762|10751"]);

// ---- Reading the answers
check("a film", F.normalise({ id: 1, title: "Sample Film A", release_date: "2026-10-24", poster_path: "/a.jpg", overview: "x", popularity: 50 }, "movie"),
  { id: 1, type: "movie", title: "Sample Film A", year: "2026", date: "2026-10-24", poster: "/a.jpg", backdrop: null, overview: "x", popularity: 50 });
check("a series", F.normalise({ id: 2, name: "Sample Series B", first_air_date: "2025-01-03" }, "tv").title, "Sample Series B");
check("UK certificate and cinema date", F.gbRelease({ results: [
  { iso_3166_1: "US", release_dates: [{ certification: "PG-13", type: 3, release_date: "2026-11-14T00:00:00.000Z" }] },
  { iso_3166_1: "GB", release_dates: [{ certification: "", type: 4, release_date: "2027-01-02T00:00:00.000Z" }, { certification: "PG", type: 3, release_date: "2026-11-21T00:00:00.000Z" }] }
] }), { cert: "PG", date: "2026-11-21" });
check("no UK release yet", F.gbRelease({ results: [{ iso_3166_1: "US", release_dates: [] }] }), { cert: "", date: "" });
check("trailer: official YouTube trailer first", F.trailer({ results: [
  { site: "YouTube", key: "teaser1", type: "Teaser", official: true, iso_639_1: "en" },
  { site: "Vimeo", key: "v1", type: "Trailer", official: true },
  { site: "YouTube", key: "trail1", type: "Trailer", official: true, iso_639_1: "en" }
] }), "https://www.youtube.com/watch?v=trail1");
check("no trailer", F.trailer({ results: [] }), null);
check("where to watch: ours first", F.whereToWatch({ results: { GB: { flatrate: [{ provider_id: 9, provider_name: "Amazon Prime Video" }, { provider_id: 8, provider_name: "Netflix" }] } } }, [8, 337]), { ours: ["Netflix"], others: ["Prime Video"] });
check("rating allowed: PG under PG", F.allowed("PG", "PG"), true);
check("rating allowed: 12A over PG", F.allowed("12A", "PG"), false);
check("rating allowed: not rated yet", F.allowed("", "PG"), true);

// ---- Plan film night: cinema the coming Saturday, streaming tonight
const plan = (kind, now, rt) => { const x = F.planSlot(kind, now, rt); return [x.date.getDate(), x.start, x.mins]; };
check("cinema on a Saturday: today, 2pm, film + 30 mins", plan("cinema", today, 100), [7, "14:00", 135]);
check("cinema on a Tuesday: Saturday", plan("cinema", new Date(2026, 10, 10, 9), 90), [14, "14:00", 120]);
check("streaming at 5pm: tonight at 7", plan("stream", today, 95), [7, "19:00", 105]);
check("streaming at 9pm: tomorrow at 7", plan("stream", new Date(2026, 10, 7, 21), 95), [8, "19:00", 105]);

// ---- No key: nothing shows
F._testKey("");
check("no key: no card", F.cardHtml(), "");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
