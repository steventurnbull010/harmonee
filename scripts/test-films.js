#!/usr/bin/env node
// Checks Film night's streaming data handling (js/film-night.js) with sample
// answers in the Streaming Availability API's shape. Titles are made up.
// Run: node scripts/test-films.js
global.window = global;
global.localStorage = { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = String(v); } };
const F = require("../js/film-night.js");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
};
const params = (url) => Object.fromEntries(new URL(url).searchParams);
const CDN = "https://cdn.movieofthenight.com/show/1/poster/vertical/en/";

// ---- What gets asked for
let p = params(F.urlFor("netflix", "popular"));
check("popular: UK Netflix subscription, English family titles", [p.country, p.catalogs, p.genres, p.show_original_language, p.order_by], ["gb", "netflix.subscription", "family", "en", "popularity_1month"]);
p = params(F.urlFor("prime", "latest"));
check("latest: newest first", [p.catalogs, p.order_by, p.order_direction], ["prime.subscription", "release_date", "desc"]);

// ---- Reading the answers
const show = (id, title, genres, extra = {}) => ({
  id: String(id), showType: "movie", title, releaseYear: 2026, overview: "x", runtime: 95,
  genres: genres.map(g => ({ id: g, name: g })),
  imageSet: { verticalPoster: { w240: CDN + "240.jpg?sig", w360: CDN + "360.jpg?sig" } },
  streamingOptions: { gb: [
    { service: { id: "netflix" }, type: "subscription", availableSince: 1793000000 },
    { service: { id: "prime" }, type: "buy", availableSince: 1700000000 }
  ] },
  ...extra
});
const one = F.slim(show(1, "Sample Film A", ["animation", "family"]), "netflix");
check("a film, trimmed", [one.id, one.type, one.title, one.genres, one.runtime, one.since], ["1", "movie", "Sample Film A", ["animation", "family"], 95, 1793000000000]);
check("posters kept from the API's image server", [one.poster.startsWith(CDN), one.posterBig.endsWith("360.jpg?sig")], [true, true]);
check("posters from anywhere else dropped", F.slim(show(2, "B", ["family"], { imageSet: { verticalPoster: { w240: "https://evil.example/x.jpg" } } }), "netflix").poster, null);
check("horror left out", F.slim(show(3, "C", ["family", "horror"]), "netflix"), null);
check("reality left out", F.slim(show(4, "D", ["family", "reality"]), "netflix"), null);
check("only this service's subscription counts for 'since'", F.slim(show(5, "E", ["family"]), "prime").since, null);
check("a series", F.slim(show(6, "F", ["family"], { showType: "series", seasonCount: 3, releaseYear: undefined, firstAirYear: 2020 }), "netflix").seasons, 3);
check("list reading skips bad entries", F.slimList({ shows: [show(7, "G", ["family"]), show(8, "", ["family"]), show(9, "H", ["family", "crime"])] }, "netflix").map(x => x.title), ["G"]);

// ---- Merging the family's services
const n = { popular: [{ id: "1", title: "A", since: 5 }, { id: "2", title: "B" }, { id: "3", title: "C" }] };
const pr = { popular: [{ id: "2", title: "B", since: 3 }, { id: "4", title: "D" }] };
const merged = F.merge({ netflix: n, prime: pr }, "popular", ["netflix", "prime"], []);
check("one entry per show, services listed", merged.map(m => `${m.title}:${m.on.join("+")}`), ["A:netflix", "B:netflix+prime", "D:prime", "C:netflix"]);
check("earliest arrival kept", merged.find(m => m.id === "2").since, 3);
check("only the ticked services", F.merge({ netflix: n, prime: pr }, "popular", ["prime"], []).map(m => m.title), ["B", "D"]);
check("hidden titles left out", F.merge({ netflix: n }, "popular", ["netflix"], ["2"]).map(m => m.title), ["A", "C"]);
check("latest: newest year first", F.merge({ netflix: { latest: [{ id: "1", title: "Old", year: 2019 }, { id: "2", title: "New", year: 2026 }] } }, "latest", ["netflix"], []).map(m => m.title), ["New", "Old"]);

// ---- "New" and the weekly refresh (Sunday 6pm)
const now = new Date(2026, 10, 7, 17, 0); // Saturday 5pm
check("new: arrived 3 days ago", F.isNew({ since: now - 3 * 86400000 }, now.getTime()), true);
check("not new: 20 days ago", F.isNew({ since: now - 20 * 86400000 }, now.getTime()), false);
check("week starts last Sunday 6pm", F.weekStart(now).toString(), new Date(2026, 10, 1, 18, 0).toString());
check("Sunday 7pm: the new week has started", F.weekStart(new Date(2026, 10, 8, 19, 0)).toString(), new Date(2026, 10, 8, 18, 0).toString());
check("fetched Monday: still fresh on Saturday", F.isStale(new Date(2026, 10, 2, 9).getTime(), now), false);
check("fetched Monday: stale after Sunday 6pm", F.isStale(new Date(2026, 10, 2, 9).getTime(), new Date(2026, 10, 8, 18, 30)), true);
check("never fetched: stale", F.isStale(0, now), true);

// ---- Plan film night: tonight at 7, tomorrow once it's late
const plan = (when, rt) => { const x = F.planSlot(when, rt); return [x.date.getDate(), x.start, x.mins]; };
check("at 5pm: tonight at 7, film length", plan(now, 95), [7, "19:00", 105]);
check("at 9pm: tomorrow at 7", plan(new Date(2026, 10, 7, 21), 95), [8, "19:00", 105]);

// ---- No key: nothing shows
window.HARMONEE_KEYS = {};
check("no key: no card", F.cardHtml(), "");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
