// ============================================================================
// READING A CALENDAR FEED (functions/ics.js) · no outside packages
//
// Turns an iCal feed (a Google Calendar "secret address", or an Outlook or
// iCloud one) into harmonee events: one per day it happens, in the family's
// time zone, between `from` and `to`. Handles what family calendars use:
//   - timed and all-day events, and all-day events over several days
//   - repeats: daily / weekly / monthly / yearly, every N, a count or an end
//     date, weekdays ("Mon, Wed"), "2nd Tuesday", "last Friday", a day of
//     the month, and skipped dates (EXDATE)
//   - one repeat moved or changed (RECURRENCE-ID), or cancelled
//   - time zones, including the clock change (a 9am class stays at 9am)
// Pure functions, so scripts/test-ics.js can check them without a server.
// ============================================================================
"use strict";

// ---- Reading the text -------------------------------------------------------------------
// Long lines are folded onto the next line starting with a space
function unfold(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}
function unescapeText(v) {
  return String(v || "").replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}
// "DTSTART;TZID=Europe/London:20261111T163000" -> { name, params, value }
function parseLine(line) {
  const colon = findValueColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(";");
  const name = parts.shift().toUpperCase();
  const params = {};
  parts.forEach(p => {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  });
  return { name, params, value };
}
// The first colon that isn't inside a quoted parameter
function findValueColon(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) return i;
  }
  return -1;
}
function parseEvents(text) {
  const events = [];
  let cur = null;
  let depth = 0; // skip VALARM etc. inside an event
  unfold(text).split("\n").forEach(raw => {
    const line = raw.trimEnd();
    if (!line) return;
    if (line === "BEGIN:VEVENT") { cur = { exdates: [] }; depth = 0; return; }
    if (!cur) return;
    if (line.startsWith("BEGIN:")) { depth++; return; }
    if (line.startsWith("END:") && depth > 0) { depth--; return; }
    if (line === "END:VEVENT") { events.push(cur); cur = null; return; }
    if (depth > 0) return;
    const p = parseLine(line);
    if (!p) return;
    switch (p.name) {
      case "UID": cur.uid = p.value; break;
      case "SUMMARY": cur.title = unescapeText(p.value); break;
      case "LOCATION": cur.location = unescapeText(p.value); break;
      case "STATUS": cur.status = p.value.toUpperCase(); break;
      case "DTSTART": cur.start = parseWhen(p); break;
      case "DTEND": cur.end = parseWhen(p); break;
      case "DURATION": cur.duration = p.value; break;
      case "RRULE": cur.rrule = parseRule(p.value); break;
      case "RECURRENCE-ID": cur.recurrenceId = parseWhen(p); break;
      case "EXDATE": p.value.split(",").forEach(v => cur.exdates.push(parseWhen({ ...p, value: v }))); break;
      default: break;
    }
  });
  return events;
}

// ---- Times ----------------------------------------------------------------------------------
// A "when": { allDay, y, m, d, h, mi, tz } where tz is "UTC", a zone name, or
// null for floating time (treated as the family's zone)
function parseWhen(p) {
  const v = String(p.value || "").trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const allDay = !m[4] || (p.params && p.params.VALUE === "DATE");
  return {
    allDay,
    y: +m[1], m: +m[2], d: +m[3],
    h: allDay ? 0 : +m[4], mi: allDay ? 0 : +m[5],
    tz: m[7] ? "UTC" : (p.params && p.params.TZID ? cleanTz(p.params.TZID) : null)
  };
}
// Outlook writes Windows zone names; the common ones for a UK family
const WINDOWS_TZ = { "GMT Standard Time": "Europe/London", "W. Europe Standard Time": "Europe/Berlin", "Romance Standard Time": "Europe/Paris", "Eastern Standard Time": "America/New_York", "Pacific Standard Time": "America/Los_Angeles", "UTC": "UTC" };
function cleanTz(tz) {
  const t = String(tz).replace(/^\/+/, "");
  if (WINDOWS_TZ[t]) return WINDOWS_TZ[t];
  try { new Intl.DateTimeFormat("en-GB", { timeZone: t }); return t; } catch (e) { return null; }
}
// The UTC instant (ms) of a wall-clock time in a zone, correct across the clock change
function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  if (!tz || tz === "UTC") return guess;
  let t = guess;
  for (let i = 0; i < 3; i++) {
    const off = offsetMinutes(t, tz);
    const next = guess - off * 60000;
    if (next === t) break;
    t = next;
  }
  return t;
}
function offsetMinutes(ms, tz) {
  const parts = partsIn(ms, tz);
  const asUtc = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.mi);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}
const fmtCache = {};
function partsIn(ms, tz) {
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  const o = {};
  f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute };
}
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// Days since 1970 for a calendar date (for date maths without time zones)
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const fromDayNum = (n) => { const t = new Date(n * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };

// ---- Repeats ----------------------------------------------------------------------------------
function parseRule(v) {
  const r = {};
  String(v).split(";").forEach(kv => {
    const [k, val] = kv.split("=");
    if (k && val !== undefined) r[k.toUpperCase()] = val;
  });
  const out = { freq: (r.FREQ || "").toUpperCase(), interval: Math.max(1, parseInt(r.INTERVAL, 10) || 1) };
  if (r.COUNT) out.count = parseInt(r.COUNT, 10);
  if (r.UNTIL) out.until = parseWhen({ value: r.UNTIL, params: {} });
  if (r.BYDAY) out.byday = r.BYDAY.split(",").map(s => { const m = s.match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/i); return m ? { n: m[1] ? parseInt(m[1], 10) : 0, wd: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].indexOf(m[2].toUpperCase()) } : null; }).filter(Boolean);
  if (r.BYMONTHDAY) out.bymonthday = r.BYMONTHDAY.split(",").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  if (r.BYMONTH) out.bymonth = r.BYMONTH.split(",").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  return out;
}
const weekdayOf = (y, m, d) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// The dates in a month that match BYDAY entries like 2TU, -1FR, or plain MO
function monthDaysForByday(y, m, byday) {
  const dim = daysInMonth(y, m);
  const out = new Set();
  byday.forEach(({ n, wd }) => {
    const all = [];
    for (let d = 1; d <= dim; d++) if (weekdayOf(y, m, d) === wd) all.push(d);
    if (n === 0) all.forEach(d => out.add(d));
    else if (n > 0 && all[n - 1]) out.add(all[n - 1]);
    else if (n < 0 && all[all.length + n]) out.add(all[all.length + n]);
  });
  return [...out].sort((a, b) => a - b);
}
// Every start date (as {y,m,d}) of a repeating event, in its own wall-clock
// calendar, up to `lastDay` (a day number). Stops at COUNT / UNTIL / 2000 repeats.
function repeatDates(start, rule, lastDay, firstDay = -Infinity) {
  const out = [];
  const startDay = dayNum(start.y, start.m, start.d);
  let untilDay = Infinity;
  if (rule.until) {
    // UNTIL in UTC (with a time) is compared in the event's own calendar
    if (!rule.until.allDay && rule.until.tz === "UTC" && start.tz && start.tz !== "UTC") {
      const p = partsIn(Date.UTC(rule.until.y, rule.until.m - 1, rule.until.d, rule.until.h, rule.until.mi), start.tz);
      untilDay = dayNum(p.y, p.m, p.d);
    } else untilDay = dayNum(rule.until.y, rule.until.m, rule.until.d);
  }
  const stopDay = Math.min(lastDay, untilDay);
  const max = rule.count || Infinity;
  const push = (y, m, d) => {
    const n = dayNum(y, m, d);
    if (n < startDay || n > stopDay) return n > stopDay;
    out.push({ y, m, d });
    return out.length >= max;
  };
  const LIMIT = 2000;
  // A repeat with no fixed count can skip ahead to just before the window
  // (a daily one started years ago would otherwise use up the limit first)
  const skipTo = !rule.count && firstDay > startDay ? firstDay - 7 : startDay;
  if (rule.freq === "DAILY") {
    const k = Math.max(0, Math.floor((skipTo - startDay) / rule.interval));
    for (let n = startDay + k * rule.interval, i = 0; n <= stopDay && i < LIMIT; n += rule.interval, i++) {
      const t = fromDayNum(n);
      if (rule.byday && rule.byday.length && !rule.byday.some(b => b.wd === weekdayOf(t.y, t.m, t.d))) continue;
      if (rule.bymonth && !rule.bymonth.includes(t.m)) continue;
      if (push(t.y, t.m, t.d)) break;
    }
  } else if (rule.freq === "WEEKLY") {
    const days = rule.byday && rule.byday.length ? rule.byday.map(b => b.wd).sort((a, b) => a - b) : [weekdayOf(start.y, start.m, start.d)];
    const weekStart0 = startDay - weekdayOf(start.y, start.m, start.d);
    const weeks = Math.max(0, Math.floor((skipTo - weekStart0) / (7 * rule.interval)));
    const weekStart = weekStart0 + weeks * 7 * rule.interval;
    outer: for (let w = weekStart, i = 0; w <= stopDay && i < LIMIT; w += 7 * rule.interval, i++) {
      for (const wd of days) {
        const t = fromDayNum(w + wd);
        if (push(t.y, t.m, t.d)) break outer;
      }
    }
  } else if (rule.freq === "MONTHLY") {
    let y = start.y, m = start.m;
    if (skipTo > startDay) {
      const t = fromDayNum(skipTo);
      const months = Math.max(0, Math.floor(((t.y - y) * 12 + (t.m - m)) / rule.interval) - 1) * rule.interval;
      m += months;
      while (m > 12) { m -= 12; y++; }
    }
    for (let i = 0; i < LIMIT; i++) {
      if (dayNum(y, m, 1) > stopDay) break;
      let days;
      if (rule.byday && rule.byday.length) days = monthDaysForByday(y, m, rule.byday);
      else if (rule.bymonthday && rule.bymonthday.length) days = rule.bymonthday.map(d => (d < 0 ? daysInMonth(y, m) + d + 1 : d)).filter(d => d >= 1 && d <= daysInMonth(y, m)).sort((a, b) => a - b);
      else days = start.d <= daysInMonth(y, m) ? [start.d] : []; // the 31st skips short months
      let stop = false;
      for (const d of days) { if (push(y, m, d)) { stop = true; break; } }
      if (stop) break;
      m += rule.interval;
      while (m > 12) { m -= 12; y++; }
    }
  } else if (rule.freq === "YEARLY") {
    for (let y = start.y, i = 0; i < LIMIT; y += rule.interval, i++) {
      if (dayNum(y, 1, 1) > stopDay) break;
      const months = rule.bymonth && rule.bymonth.length ? rule.bymonth : [start.m];
      let stop = false;
      for (const m of months) {
        let days;
        if (rule.byday && rule.byday.length) days = monthDaysForByday(y, m, rule.byday);
        else days = (start.d <= daysInMonth(y, m)) ? [start.d] : []; // 29 Feb only in leap years
        for (const d of days) { if (push(y, m, d)) { stop = true; break; } }
        if (stop) break;
      }
      if (stop) break;
    }
  } else {
    push(start.y, start.m, start.d);
  }
  return out;
}

// ---- Durations ------------------------------------------------------------------------------
// "PT1H30M", "P1D" -> minutes
function isoDurationMinutes(v) {
  const m = String(v || "").match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  return ((+m[1] || 0) * 7 * 1440) + ((+m[2] || 0) * 1440) + ((+m[3] || 0) * 60) + (+m[4] || 0);
}
// The same words harmonee uses (js/calendar.js formatEventDuration)
function durationWords(mins) {
  if (mins < 60) return `${mins} mins`;
  const h = Math.round((mins / 60) * 100) / 100;
  return h === 1 ? "1 hour" : `${h} hours`;
}

// ---- A repeat in words ("Every week on Tuesday") ------------------------------------------------
// The feed's rule, said the way harmonee says its own repeats. Google events
// are read-only copies, one per date, so the words ride along on each copy.
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const andList = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
function repeatWords(rule, start) {
  if (!rule || !rule.freq) return "";
  const n = rule.interval || 1;
  const every = (one, many) => n === 1 ? `Every ${one}` : `Every ${n} ${many}`;
  const startDay = start ? weekdayOf(start.y, start.m, start.d) : null;
  switch (rule.freq) {
    case "DAILY": return every("day", "days");
    case "WEEKLY": {
      const days = rule.byday && rule.byday.length ? [...new Set(rule.byday.map(b => b.wd))].sort() : (startDay === null ? [] : [startDay]);
      if (n === 1 && days.join() === "0,1,2,3,4") return "Every weekday";
      if (n === 1 && days.length === 7) return "Every day";
      return `${every("week", "weeks")}${days.length ? ` on ${andList(days.map(d => DAY_NAMES[d]))}` : ""}`;
    }
    case "MONTHLY": {
      if (rule.byday && rule.byday.length === 1 && rule.byday[0].n) {
        const b = rule.byday[0];
        return `${every("month", "months")} on the ${b.n === -1 ? "last" : ordinal(b.n)} ${DAY_NAMES[b.wd]}`;
      }
      const d = rule.bymonthday && rule.bymonthday.length === 1 ? rule.bymonthday[0] : (start ? start.d : null);
      if (d === -1) return `${every("month", "months")} on the last day`;
      return `${every("month", "months")}${d > 0 ? ` on the ${ordinal(d)}` : ""}`;
    }
    case "YEARLY": return `${every("year", "years")}${start ? ` on ${start.d} ${MONTH_NAMES[start.m - 1]}` : ""}`;
    default: return "Repeats";
  }
}

// ---- Putting it together ----------------------------------------------------------------------
// text: the feed; opts: { member, tz (family's zone), fromKey, toKey ("YYYY-MM-DD"), max }
// Returns { events: [...harmonee events], count, skipped }
function toHarmoneeEvents(text, opts = {}) {
  const tz = opts.tz || "Europe/London";
  const [fy, fm, fd] = (opts.fromKey || "1970-01-01").split("-").map(Number);
  const [ty, tm, td] = (opts.toKey || "2100-01-01").split("-").map(Number);
  const fromDay = dayNum(fy, fm, fd), toDay = dayNum(ty, tm, td);
  const max = opts.max || 1500;
  const raw = parseEvents(text).filter(e => e.start && e.status !== "CANCELLED" || (e.recurrenceId && e.status === "CANCELLED"));

  // Changes to single repeats: uid -> { "YYYY-MM-DDTHH:MM" (original start) -> event or "cancelled" }
  const overrides = {};
  raw.filter(e => e.recurrenceId).forEach(e => {
    const id = e.recurrenceId;
    const k = `${keyOf(id.y, id.m, id.d)}T${pad(id.h)}:${pad(id.mi)}`;
    (overrides[e.uid] = overrides[e.uid] || {})[k] = e.status === "CANCELLED" ? "cancelled" : e;
  });

  const out = [];
  let skipped = 0;
  const emit = (e, start, startOverride, repeatText) => {
    // Length: DTEND, or DURATION, or an hour (all-day: a day)
    let mins;
    if (e.end) {
      if (start.allDay) mins = Math.max(1, dayNum(e.end.y, e.end.m, e.end.d) - dayNum(e.start.y, e.start.m, e.start.d)) * 1440;
      else mins = Math.round((zonedToUtc(e.end.y, e.end.m, e.end.d, e.end.h, e.end.mi, e.end.tz || tz) - zonedToUtc(e.start.y, e.start.m, e.start.d, e.start.h, e.start.mi, e.start.tz || tz)) / 60000);
    } else {
      mins = isoDurationMinutes(e.duration);
      if (mins === null) mins = start.allDay ? 1440 : 60;
    }
    const title = e.title || "Busy";
    const base = { title, member: opts.member || "Family", icon: "📅", repeat: "none", source: "google", readOnly: true };
    if (e.location) base.location = e.location;
    if (repeatText) base.repeatText = repeatText;
    if (start.allDay) {
      // All-day: one entry per day it covers (up to two weeks)
      const days = Math.min(14, Math.max(1, Math.round(mins / 1440)));
      const first = dayNum(start.y, start.m, start.d);
      for (let i = 0; i < days; i++) {
        const n = first + i;
        if (n < fromDay || n > toDay) continue;
        const t = fromDayNum(n);
        const date = keyOf(t.y, t.m, t.d);
        out.push({ ...base, id: `g-${hash(`${e.uid}|${date}`)}`, date, time: "", duration: "All day", ...(days > 1 ? { title: `${title} (day ${i + 1} of ${days})` } : {}) });
      }
      return;
    }
    // Timed: the start in the family's zone
    const ms = zonedToUtc(start.y, start.m, start.d, start.h, start.mi, start.tz || tz);
    const p = partsIn(ms, tz);
    const n = dayNum(p.y, p.m, p.d);
    if (n < fromDay || n > toDay) return;
    const date = keyOf(p.y, p.m, p.d);
    out.push({ ...base, id: `g-${hash(`${e.uid}|${startOverride || date}`)}`, date, time: `${pad(p.h)}:${pad(p.mi)}`, duration: durationWords(Math.max(5, Math.min(mins, 24 * 60))) });
  };

  raw.filter(e => !e.recurrenceId && e.start).forEach(e => {
    if (out.length >= max) { skipped++; return; }
    if (!e.rrule) { emit(e, e.start); return; }
    const ex = new Set(e.exdates.filter(Boolean).map(x => keyOf(x.y, x.m, x.d)));
    const ov = overrides[e.uid] || {};
    const words = repeatWords(e.rrule, e.start);
    repeatDates(e.start, e.rrule, toDay + 1, fromDay).forEach(dt => {
      if (out.length >= max) { skipped++; return; }
      const dk = keyOf(dt.y, dt.m, dt.d);
      if (ex.has(dk)) return;
      const ok = `${dk}T${pad(e.start.h)}:${pad(e.start.mi)}`;
      const changed = ov[ok] || ov[`${dk}T00:00`];
      if (changed === "cancelled") return;
      if (changed) { emit(changed, changed.start, dk, words); return; }
      emit(e, { ...e.start, y: dt.y, m: dt.m, d: dt.d }, dk, words);
    });
  });
  // Changed repeats whose series isn't in the feed (rare): show them as they are
  Object.entries(overrides).forEach(([uid, map]) => {
    if (raw.some(e => e.uid === uid && !e.recurrenceId)) return;
    Object.values(map).forEach(e => { if (e !== "cancelled" && e.start) emit(e, e.start); });
  });

  out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { events: out.slice(0, max), count: Math.min(out.length, max), skipped };
}

// A short, stable id (same event, same id on every refresh)
function hash(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ---- Which links we'll fetch ------------------------------------------------------------------
// Only calendar feeds from Google, Outlook and iCloud (so the server can't be
// pointed anywhere else). Returns { ok, url, kind, problem }
function checkLink(input) {
  let v = String(input || "").trim();
  if (!v) return { ok: false, problem: "empty" };
  v = v.replace(/^webcals?:\/\//i, "https://");
  let u;
  try { u = new URL(v); } catch (e) { return { ok: false, problem: "not-a-link" }; }
  if (u.protocol !== "https:") return { ok: false, problem: "not-a-link" };
  const host = u.hostname.toLowerCase();
  if (host === "calendar.google.com") {
    if (/\/calendar\/ical\/[^/]+\/public\//.test(u.pathname)) return { ok: false, problem: "public" };
    if (!/\/calendar\/ical\/[^/]+\/private-[^/]+\/basic\.ics$/.test(u.pathname)) return { ok: false, problem: "google-page" };
    return { ok: true, url: u.href, kind: "google" };
  }
  if (host === "outlook.live.com" || host === "outlook.office365.com") {
    if (!/\.ics$/i.test(u.pathname)) return { ok: false, problem: "not-calendar" };
    return { ok: true, url: u.href, kind: "outlook" };
  }
  if (/^p\d+-caldav\.icloud\.com$/.test(host) || host === "caldav.icloud.com") return { ok: true, url: u.href, kind: "icloud" };
  return { ok: false, problem: "not-calendar" };
}

module.exports = { parseEvents, parseRule, repeatDates, repeatWords, toHarmoneeEvents, zonedToUtc, partsIn, checkLink, durationWords, isoDurationMinutes };
