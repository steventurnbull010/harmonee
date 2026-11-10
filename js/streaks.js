// ============================================================================
// STREAKS (js/streaks.js)
// "🔥 6 days in a row" for a daily job, counted from the days it was done.
//
// Each daily job keeps the dates it was done in tickDates (["2026-11-09",
// "2026-11-10", ...], the last two months). Ticks add today's date with
// arrayUnion and taking a tick back removes it with arrayRemove, so two
// tablets ticking at once both count. This week's ticks (completedDays) count
// too, so streaks started before tickDates existed still show.
//
// Before 10 Nov a streak was a stored counter that only the Calendar's tick
// added to: ticks on the Tasks page never counted, and Monday's reset cleared
// the ticks it could have been rebuilt from.
// ============================================================================
(function () {
  const KEEP = 60;          // dates kept per job (two months)
  const TRIM_AT = 70;       // when the list gets this long, it's trimmed back
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const isDailyTask = (t) => !!t && (t.repeat === "daily" || t.day === "Daily" || t.taskType === "Daily Task");

  // The date of a weekday ("Tuesday") in the same Monday-to-Sunday week as ref
  function dateOfWeekday(dayName, ref = new Date()) {
    const i = DAYS.indexOf(dayName);
    if (i < 0) return "";
    const d = new Date(ref);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i);
    return keyOf(d);
  }
  const weekKeyOf = (d) => (typeof window.getIsoWeekKey === "function" ? window.getIsoWeekKey(d) : null);

  // Every date the job was done that we know of
  function doneDates(task, now = new Date()) {
    const set = new Set(Array.isArray(task && task.tickDates) ? task.tickDates.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)) : []);
    const thisWeek = weekKeyOf(now);
    const today = keyOf(now);
    Object.entries((task && task.completedDays) || {}).forEach(([day, rec]) => {
      if (!rec) return;
      if (rec.completedWeek && thisWeek && rec.completedWeek !== thisWeek) return; // last week's, not yet cleared
      const k = dateOfWeekday(day, now);
      if (k && k <= today) set.add(k);
    });
    return set;
  }

  // Days in a row up to today (or up to yesterday, if today isn't done yet)
  function streakOf(task, now = new Date()) {
    if (!isDailyTask(task)) return 0;
    const set = doneDates(task, now);
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    if (!set.has(keyOf(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(keyOf(d)) && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // What to save when a daily job is ticked for dateKey (and the local copy)
  function recordTick(task, dateKey) {
    const list = Array.isArray(task.tickDates) ? task.tickDates.slice() : [];
    if (!list.includes(dateKey)) list.push(dateKey);
    list.sort();
    task.tickDates = list.length > TRIM_AT ? list.slice(-KEEP) : list;
    if (list.length > TRIM_AT || !window.arrayUnion) return { tickDates: task.tickDates };
    return { tickDates: window.arrayUnion(dateKey) };
  }
  // ... and when that day's tick is taken back
  function recordUntick(task, dateKey) {
    task.tickDates = (Array.isArray(task.tickDates) ? task.tickDates : []).filter(k => k !== dateKey);
    return window.arrayRemove ? { tickDates: window.arrayRemove(dateKey) } : { tickDates: task.tickDates };
  }

  window.Streaks = { streakOf, doneDates, dateOfWeekday, keyOf, isDailyTask, recordTick, recordUntick };
})();
