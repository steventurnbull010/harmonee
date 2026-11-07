// ============================================================================
// VOICE: WHAT DID THEY MEAN? (js/voice-intent.js)
// Turns a spoken sentence into something harmonee can do, with plain phrase
// rules (no AI, nothing leaves the device):
//
//   VoiceIntent.parse("add vinegar to my shopping list", ctx)
//     -> { kind: "list", listId: "groceries", items: ["vinegar"] }
//   VoiceIntent.parse("a trip to the theatre next wednesday at 7:30", ctx)
//     -> { kind: "event", title: "Trip to the theatre", date, start: "19:30", end: "20:30", allDay: false, members: [] }
//   VoiceIntent.parse("ava needs to tidy her room on saturday", ctx)
//     -> { kind: "task", title: "Tidy her room", people: ["Ava"], date, daily: false }
//   VoiceIntent.parse("we're having tacos tonight", ctx)
//     -> { kind: "meal", title: "Tacos", date, slot: "dinner", cooks: [] }
//   VoiceIntent.parse("cancel the dentist on tuesday", ctx)
//     -> { kind: "remove", target: null, words: ["dentist"], date, ... }
//   anything else -> { kind: "unknown", text }
//
// ctx = { now: Date, members: [names], lists: [{ id, title }], want: "list" | "event" | "task" | "meal" | null }
// "want" is set when the mic was tapped inside a panel, so a bare "vinegar"
// in the shopping panel is a list item and "dentist friday" there is an event.
//
// Pure functions (no DOM), so scripts/test-voice.js can check them in Node.
// ============================================================================
(function (root) {
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const MONTH_RE = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, "forty five": 45, "forty-five": 45, "a couple of": 2, "a few": 3 };
  // Words that make "at 7" mean the evening
  const EVENING_HINTS = /\b(tonight|evening|night|dinner|supper|theatre|theater|cinema|film|movie|concert|gig|show|party|pub|drinks|disco|panto|pantomime|takeaway|table|restaurant|meal out|date night|bonfire|fireworks)\b/;

  // ---------------------------------------------------------------- helpers --
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const squash = (s) => s.replace(/\s+/g, " ").trim();
  const monthIndex = (m) => MONTHS.findIndex(x => x.startsWith(m.slice(0, 3)));

  function normalise(text) {
    let s = " " + String(text || "").toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/[“”"!?]/g, " ")
      .replace(/(\d)\.(\d\d)(?!\d)/g, "$1:$2")   // "7.30" -> "7:30"
      .replace(/\b(a|p)\.m\.?/g, "$1m")      // "p.m." -> "pm"
      .replace(/(\d)\s+(am|pm)\b/g, "$1$2")  // "7 pm" -> "7pm"
      .replace(/[,;]+/g, " , ") + " ";
    // Spoken numbers (longest first so "forty five" beats "five")
    Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).forEach(w => {
      s = s.replace(new RegExp(`\\b${w}\\b`, "g"), String(NUM_WORDS[w]));
    });
    s = s.replace(/\bo'?clock\b/g, " ");
    return squash(s);
  }

  // Edit distance, for names the speech engine spells differently ("Sorsha")
  function distance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[m][n];
  }
  // "ava", "ava's", "sorsha" -> "Ava" / "Sorcha" (or null)
  function memberFor(word, members) {
    const w = String(word || "").toLowerCase().replace(/'s$/, "").replace(/[^a-z]/g, "");
    if (!w) return null;
    let best = null, bestD = 99;
    members.forEach(m => {
      const n = m.toLowerCase().replace(/[^a-z]/g, "");
      if (!n) return;
      const d = n === w ? 0 : distance(n, w);
      const allowed = n.length <= 3 ? 0 : n.length <= 5 ? 1 : 2;
      if (d <= allowed && d < bestD && n[0] === w[0]) { best = m; bestD = d; }
    });
    return best;
  }

  // Names as the board spells them ("Kid 1", "Mary Kate") count as one word.
  // NAME: a regex piece for "a name"; who(): the member it means (or null)
  function names(members) {
    const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const full = members.map(m => ({ m, n: normalise(m) })).filter(x => x.n.includes(" ")).sort((a, b) => b.n.length - a.n.length);
    const NAME = `(?:${full.map(x => reEsc(x.n)).concat("[a-z']+").join("|")})`;
    const who = (w) => { const hit = full.find(x => x.n === String(w || "").replace(/'s$/, "")); return hit ? hit.m : memberFor(w, members); };
    return { full, NAME, who };
  }

  // ------------------------------------------------------------------ dates --
  // Finds a day in the sentence; returns { date, rest, part } (part: a time-of-day word)
  function findDate(s, now) {
    const today = startOfDay(now);
    const todayIdx = today.getDay();
    let date = null, part = null;
    const take = (re, fn) => {
      if (date) return;
      const m = s.match(re);
      if (!m) return;
      const d = fn(m);
      if (d) { date = d; s = squash(s.replace(m[0], " ")); }
    };
    // "tomorrow morning", "tonight", "this evening"
    const pm = s.match(/\b(?:tomorrow|this|on \w+day)?\s*(morning|afternoon|evening|night)\b/);
    if (pm) part = pm[1];
    if (/\btonight\b/.test(s)) part = "evening";

    take(/\b(?:on )?the day after tomorrow\b/, () => addDays(today, 2));
    take(/\b(?:on )?tomorrow\b/, () => addDays(today, 1));
    take(/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/, () => today);
    take(/\bin (\d+) (day|days|week|weeks)\b/, (m) => addDays(today, Number(m[1]) * (m[2].startsWith("week") ? 7 : 1)));
    take(/\b(?:on )?(?:this )?weekend\b/, () => addDays(today, (6 - todayIdx + 7) % 7 || (todayIdx === 6 ? 0 : 7)));
    // "the 14th of november", "14th november", "november the 14th", "on the 14th"
    take(new RegExp(`\\b(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${MONTH_RE}\\b`), (m) => dayMonth(Number(m[1]), monthIndex(m[2]), today));
    take(new RegExp(`\\b(?:on )?${MONTH_RE} (?:the )?(\\d{1,2})(?:st|nd|rd|th)?\\b`), (m) => dayMonth(Number(m[2]), monthIndex(m[1]), today));
    take(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/, (m) => dayOnly(Number(m[1]), today));
    // "wednesday week", "next wednesday", "this wednesday", "on wednesday"
    take(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday) week\b/, (m) => addDays(nextWeekday(DAYS.indexOf(m[1]), today, false), 7));
    take(/\b(?:on |this |next |coming |this coming )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/, (m) => {
      const includeToday = /\bthis\b/.test(m[0]) && !/coming/.test(m[0]);
      return nextWeekday(DAYS.indexOf(m[1]), today, includeToday);
    });
    return { date, rest: s, part };
  }
  function nextWeekday(target, today, includeToday) {
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0 && !includeToday) diff = 7;
    return addDays(today, diff);
  }
  function dayMonth(day, month, today) {
    if (month < 0 || day < 1 || day > 31) return null;
    let d = new Date(today.getFullYear(), month, day);
    if (d < today) d = new Date(today.getFullYear() + 1, month, day);
    return d;
  }
  function dayOnly(day, today) {
    if (day < 1 || day > 31) return null;
    let d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
    return d;
  }

  // ------------------------------------------------------------------ times --
  // One spoken time -> { mins, ampm } where ampm is "am" | "pm" | null
  function readTime(t) {
    t = t.trim();
    if (/^(noon|midday|12 noon)$/.test(t)) return { mins: 12 * 60, ampm: "pm" };
    if (t === "midnight") return { mins: 0, ampm: "am" };
    let m = t.match(/^half past (\d{1,2})(am|pm)?$/);
    if (m) return { mins: Number(m[1]) * 60 + 30, ampm: m[2] || null };
    m = t.match(/^(?:a )?quarter past (\d{1,2})(am|pm)?$/);
    if (m) return { mins: Number(m[1]) * 60 + 15, ampm: m[2] || null };
    m = t.match(/^(?:a )?quarter to (\d{1,2})(am|pm)?$/);
    if (m) return { mins: Number(m[1]) * 60 - 15, ampm: m[2] || null };
    m = t.match(/^(\d{1,2})(?::(\d{2})| (\d{2}))?(am|pm)?$/);
    if (m) {
      const h = Number(m[1]), mm = Number(m[2] || m[3] || 0);
      if (h > 23 || mm > 59) return null;
      return { mins: h * 60 + mm, ampm: m[4] || (h >= 13 ? "pm" : null) };
    }
    return null;
  }
  // Morning or afternoon/evening when nobody said am/pm
  function settle(t, part, eveningHint) {
    let h = Math.floor(t.mins / 60);
    const mm = t.mins % 60;
    if (h >= 13) return t.mins;
    if (t.ampm === "am") return (h % 12) * 60 + mm;
    if (t.ampm === "pm") return ((h % 12) + 12) * 60 + mm;
    if (part === "morning") return (h % 12) * 60 + mm;
    if (part === "afternoon" || part === "evening" || part === "night" || eveningHint) return ((h % 12) + 12) * 60 + mm;
    if (h === 12) return 12 * 60 + mm;
    if (h >= 1 && h <= 6) return (h + 12) * 60 + mm;  // "at 3" is 3pm
    return h * 60 + mm;                                // "at 9" is 9am
  }
  const TIME = "(?:noon|midday|midnight|half past \\d{1,2}(?:am|pm)?|(?:a )?quarter (?:past|to) \\d{1,2}(?:am|pm)?|\\d{1,2}(?::\\d{2}| \\d{2})?(?:am|pm)?)";
  function findTime(s, part, eveningHint) {
    let start = null, end = null;
    // "from 9 till 5", "9 to 5", "6-7", "between 2 and 4"
    const range = s.match(new RegExp(`\\b(?:from |between )?(${TIME})\\s*(?:till|until|to|-|and)\\s*(${TIME})\\b`));
    if (range) {
      const a = readTime(range[1]), b = readTime(range[2]);
      if (a && b && (/\d/.test(range[1]) || /noon|midday|midnight/.test(range[1]))) {
        if (!a.ampm && b.ampm) a.ampm = (a.mins % 720) < (b.mins % 720) || b.ampm === "am" ? b.ampm : (b.ampm === "pm" ? "am" : null);
        start = settle(a, part, eveningHint);
        end = settle(b, part, eveningHint);
        if (end <= start) end += 12 * 60;           // "9 till 5": 9am-5pm
        if (end <= start) end = start + 60;
        s = squash(s.replace(range[0], " "));
      }
    }
    if (start === null) {
      // A bare number ("Kid 1", "3 days") is only a time when "at", am/pm or ":" makes it one
      const one = [...s.matchAll(new RegExp(`\\b(?:at |for |by |around |about )?(${TIME})\\b`, "g"))]
        .find(m => /\bat |:|am|pm|half|quarter|noon|midday|midnight/.test(m[0]));
      if (one) {
        const t = readTime(one[1]);
        if (t) { start = settle(t, part, eveningHint); s = squash(s.replace(one[0], " ")); }
      }
    }
    // "for 2 hours", "for an hour", "for 30 minutes", "for half an hour"
    const dur = s.match(/\bfor (an|a|\d+(?:\.5)?|half an?) ?(hour|hours|hr|hrs|minute|minutes|mins)\b/);
    if (dur) {
      const n = /half/.test(dur[1]) ? 0.5 : (dur[1] === "an" || dur[1] === "a" ? 1 : Number(dur[1]));
      const mins = /^h/.test(dur[2]) ? Math.round(n * 60) : Math.round(n);
      if (start !== null && mins > 0) end = start + mins;
      s = squash(s.replace(dur[0], " "));
    }
    if (start !== null && end === null) end = start + 60;
    return { start, end, rest: s };
  }

  // ---------------------------------------------------------------- people ---
  function findPeople(s, members) {
    const people = [];
    let family = false;
    if (/\b(the whole family|whole family|everyone|everybody|all of us|the family)\b/.test(s)) {
      family = true;
      s = squash(s.replace(/\b(?:for |with )?(the whole family|whole family|everyone|everybody|all of us|the family)\b/, " "));
    }
    const { full, NAME, who } = names(members);
    // "for ava", "for ava and dara", "with mom and kid 1": take them out of the title
    s = s.replace(new RegExp(`\\b(?:for|with) (${NAME})(?:(?: ,)? and (${NAME}))?(?=\\s|$)`, "g"), (all, a, b) => {
      const ma = who(a), mb = b ? who(b) : null;
      if (!ma) return all;
      people.push(ma); if (mb) people.push(mb);
      return " ";
    });
    full.forEach(x => { if (new RegExp(`\\b${x.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s) && !people.includes(x.m)) people.push(x.m); });
    // Names said elsewhere ("ava's dentist"): keep the words, note the person
    s.split(/\s+/).forEach(w => { const m = memberFor(w, members); if (m && !people.includes(m)) people.push(m); });
    return { people, family, rest: squash(s) };
  }

  // ------------------------------------------------------------------ lists --
  const SHOPPING = /^(?:the |my |our )?(?:shopping|grocery|groceries|food shop|shop|food|supermarket)(?: list)?$|^(?:the |my |our )?list$/;
  function listFor(target, lists) {
    const t = squash(String(target || "").replace(/\blist\b/, "")).replace(/^(?:the|my|our) /, "");
    if (SHOPPING.test(target) || SHOPPING.test(t)) return "groceries";
    const hit = (lists || []).find(l => {
      const n = String(l.title || "").toLowerCase();
      return n && (n === t || n.replace(/\s*list$/, "") === t || t.includes(n) || n.includes(t));
    });
    return hit ? hit.id : null;
  }
  function splitItems(text) {
    return text.split(/\s*,\s*|\s+and\s+|\s*&\s*/)
      .map(x => squash(x.replace(/^(?:a bag of|a bottle of|a packet of|a box of|a tin of|a jar of|a few|some|more|another|the|an|a)\s+/, "")))
      .map(x => x.replace(/\s+please$/, ""))
      .filter(x => x && x.length < 60 && !/^(and|please)$/.test(x));
  }
  function findList(s, lists) {
    let m = s.match(/^(?:please |can you |could you |can we )?(?:add|put|stick|pop|write)\s+(.+?)\s+(?:to|on|onto|in|into)\s+(.+?)\s*(?:please)?$/);
    if (m) {
      const id = listFor(m[2], lists);
      if (id) return { listId: id, items: splitItems(m[1]) };
    }
    m = s.match(/^(?:we're|we are|we've|we have|i'm|i am)\s+(?:out of|run out of|low on|running low on|nearly out of|almost out of)\s+(.+)$/);
    if (m) return { listId: "groceries", items: splitItems(m[1]) };
    m = s.match(/^(?:we|i)\s+need\s+(?!to\b)(?:some |more )?(.+)$/);
    if (m) return { listId: "groceries", items: splitItems(m[1]) };
    m = s.match(/^(?:buy|pick up|get)\s+(?:some |more )?(.+?)(?:\s+from the shop)?$/);
    if (m && !/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m[1])) return { listId: "groceries", items: splitItems(m[1]) };
    return null;
  }

  // ------------------------------------------------------------------ tasks --
  function findTask(s, members) {
    const { NAME, who } = names(members);
    let m = s.match(new RegExp(`^(?:please )?remind (${NAME}) to (.+)$`));
    if (m && who(m[1])) return { person: who(m[1]), rest: m[2] };
    m = s.match(new RegExp(`^(${NAME}) (?:needs to|has to|ought to|is going to|should|must|to) (.+)$`));
    if (m && who(m[1])) return { person: who(m[1]), rest: m[2] };
    m = s.match(new RegExp(`^(?:please |can you )?(?:add|create|make|set)\\s+(?:a |an )?(?:new )?(?:task|job|chore)(?:\\s+for (${NAME}))?(?:\\s+to)?\\s+(.+)$`));
    if (m) return { person: m[1] ? who(m[1]) : null, rest: m[2] };
    m = s.match(new RegExp(`^(?:please |can you )?(?:add|create|make)\\s+(?:a |an )?(?:task|job|chore)(?:\\s+for (${NAME}))?$`));
    if (m) return { person: m[1] ? who(m[1]) : null, rest: "" };
    return null;
  }

  // ---------------------------------------------------------------- repeats --
  // "every thursday", "on mondays", "every day", "monthly" -> { repeat, rest }
  // (the day stays in the sentence so the date is still found)
  const WEEKDAY = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
  function findRepeat(s) {
    let repeat = null;
    const take = (re, value, put = " ") => { if (repeat) return; if (re.test(s)) { repeat = value; s = squash(s.replace(re, put)); } };
    take(/\b(?:every|each) (?:week ?day|weekday)s?\b|\bweekdays\b|\bmonday to friday\b/, "weekdays");
    take(new RegExp(`\\b(?:every|each) ${WEEKDAY}\\b`), "weekly", " on $1 ");
    take(new RegExp(`\\bon ${WEEKDAY}s\\b`), "weekly", " on $1 ");
    take(/\b(?:every day|everyday|each day|daily)\b/, "daily");
    take(/\b(?:every week|each week|weekly|once a week)\b/, "weekly");
    take(/\b(?:every month|each month|monthly|once a month)\b/, "monthly");
    take(/\b(?:every year|each year|yearly|annually|once a year)\b/, "annually");
    return { repeat, rest: s };
  }

  // ------------------------------------------------------------------ meals --
  // "we're having tacos tonight", "lasagne for dinner on friday",
  // "dad's cooking curry on saturday", "add fish pie to the meal plan for tuesday"
  const SLOT = "(breakfast|brunch|lunch|dinner|tea|supper|snack|snacks)";
  const slotKey = (w) => ({ brunch: "lunch", tea: "dinner", supper: "dinner", snacks: "snack" }[w] || w);
  function findMeal(s, members, now) {
    if (/\bat \d|\d(?:am|pm)\b|\d:\d\d/.test(s)) return null; // a time: that's an event
    const { NAME, who } = names(members);
    let title = null, cooks = [], slot = null, m;
    const slotIn = (x) => { const k = x.match(new RegExp(`\\b(?:for |as )?(?:our |the )?${SLOT}\\b`)); return k ? slotKey(k[1]) : null; };
    if ((m = s.match(new RegExp(`^(${NAME})(?: is| will be| will|'s)? (?:cooking|making|doing) (.+)$`))) && who(m[1])) {
      cooks = [who(m[1])]; title = m[2];
    } else if ((m = s.match(/^(?:we're|we are|we'll be|we will be|we'll|we will|let's|lets|shall we|i'm|i am|i'll|i will)\s+(having|have|eating|eat|cooking|cook|making|make|doing|do)\s+(.+)$/))) {
      if (/^do/.test(m[1]) && !slotIn(m[2])) return null; // "we're doing the school run": not a meal
      title = m[2];
    } else if ((m = s.match(/^(?:please )?(?:add|put|plan|pop|stick|schedule)\s+(.+?)\s+(?:to|on|in|into) (?:the |our |my )?(?:meal plan|meal planner|meals|menu)\b(.*)$/))) {
      title = `${m[1]} ${m[2]}`;
    } else if ((m = s.match(new RegExp(`^(?:the |our )?${SLOT} (.*?)\\s*(?:is|will be|is going to be)\\s+(.+)$`)))) {
      slot = slotKey(m[1]); title = `${m[3]} ${m[2]}`;
    } else if ((m = s.match(new RegExp(`^(?:please )?(?:(?:add|put|plan|pop|have|make|do)\\s+)?(.+?)\\s+(?:for|as) (?:our |the )?${SLOT}\\b(.*)$`)))) {
      title = `${m[1]} ${m[3]}`; slot = slotKey(m[2]);
    }
    if (title === null) return null;
    slot = slot || slotIn(title) || "dinner";
    title = title.replace(new RegExp(`\\b(?:for |as )?(?:our |the )?${SLOT}\\b`, "g"), " ");
    const d = findDate(squash(title), now);
    let t = d.rest
      .replace(new RegExp(`(?:,? )?(?:and )?(?:with )?(${NAME})(?: is)? (?:cooking|making it|making)\\b`), (all, n) => { const c = who(n); if (c) { cooks.push(c); return " "; } return all; })
      .replace(/\b(?:cooked|made) by (\S+)/, (all, n) => { const c = who(n); if (c) { cooks.push(c); return " "; } return all; });
    t = squash(t).replace(/^(?:a|an|some|the|our|my)\s+/, "").replace(/\s+(?:on|for|please|tonight|then)$/g, "");
    if (!t || t.length > 60) return null;
    t = t.split(" ").map(w => (caseOf && caseOf[w]) || w).join(" ");
    return { kind: "meal", title: cap(t), date: d.date || startOfDay(now), dateSaid: !!d.date, slot, cooks };
  }

  // --------------------------------------------------------------- removing --
  // "take milk off the list", "cancel the dentist on tuesday", "clear dinner on
  // friday", "delete the task to tidy her room". Finding the actual thing is
  // done in js/voice.js, against the board.
  const REMOVE = "(?:please )?(?:can you |could you )?(?:delete|remove|cancel|scrap|get rid of|erase|unplan|call off|take|cross|clear|rub out)";
  const STOP = new Set(["the", "a", "an", "my", "our", "on", "at", "for", "to", "of", "from", "in", "please", "event", "appointment", "task", "job", "chore", "it", "this", "that"]);
  function findRemove(s, lists, members, now) {
    if (!new RegExp(`^${REMOVE}\\b`).test(s)) return null;
    // "take milk off the list", "cross eggs off", "remove bread from the shopping list"
    let m = s.match(new RegExp(`^${REMOVE}\\s+(.+?)\\s+(?:off|from|out of)\\s*(?:of\\s+)?(.*)$`));
    if (m) {
      const id = m[2] ? listFor(m[2], lists) : "groceries";
      if (id && !/\b(?:meal plan|menu|meals|calendar|diary|tasks?|jobs?|chores?)\b/.test(m[2])) return { kind: "remove", target: "list", listId: id, items: splitItems(m[1]) };
    }
    // "take" and "clear" only ever mean removing in the forms above, or with a meal
    const verbless = s.replace(new RegExp(`^${REMOVE}\\s+`), "")
      .replace(/\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)'s\b/g, "$1");
    const loose = /^(?:please )?(?:can you |could you )?(?:take|cross|clear|rub out)\b/.test(s);
    let target = null, slot = null;
    const fromMeals = /\b(?:from|off) (?:the |our )?(?:meal plan|meal planner|menu|meals)\b/;
    const slotHit = verbless.match(new RegExp(`\\b${SLOT}\\b`));
    let rest = verbless.replace(fromMeals, () => { target = "meal"; return " "; })
      .replace(/\b(?:from|off) (?:the |our |my )?(?:calendar|diary)\b/, () => { target = target || "event"; return " "; })
      .replace(/\b(?:from|off) (?:the |our |my )?(?:tasks?|jobs?|chores?)(?: list)?\b/, () => { target = target || "task"; return " "; });
    if (/^(?:the )?(?:task|job|chore)s?\b/.test(rest)) { target = "task"; rest = rest.replace(/^(?:the )?(?:task|job|chore)s?\s*(?:to |called |for )?/, ""); }
    if (/^(?:the )?(?:event|appointment)\b/.test(rest)) { target = "event"; rest = rest.replace(/^(?:the )?(?:event|appointment)\s*(?:called |for )?/, ""); }
    const d = findDate(squash(rest), now);
    rest = d.rest;
    if (slotHit && (!target || target === "meal")) {
      const left = squash(rest.replace(new RegExp(`\\b${SLOT}\\b`, "g"), " ").replace(/\b(?:the|for|on|our|meal|plan|planned)\b/g, " "));
      if (!left) return { kind: "remove", target: "meal", slot: slotKey(slotHit[1]), date: d.date || startOfDay(now), dateSaid: !!d.date, words: [] };
    }
    if (loose && target !== "meal") return null;
    const { people } = findPeople(rest, members);
    const words = rest.split(/\s+/).map(w => w.replace(/'s$/, "")).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w) && !members.some(n => n.toLowerCase() === w));
    if (!words.length && !d.date) return null;
    return { kind: "remove", target, date: d.date, dateSaid: !!d.date, slot: slotHit ? slotKey(slotHit[1]) : null, words, people };
  }

  // ------------------------------------------------------------------ title --
  // Keeps "MOT", "GP", "Nandos" as the speech engine wrote them (not the first word,
  // which is only capitalised because it starts the sentence)
  let caseOf = null;
  function rememberCase(text) {
    caseOf = {};
    String(text || "").split(/\s+/).forEach((raw, i) => {
      const w = raw.replace(/[^A-Za-z'’]/g, "").replace(/’/g, "'");
      if (w.length < 2 || w === w.toLowerCase()) return;
      if (i === 0 && w !== w.toUpperCase()) return;
      caseOf[w.toLowerCase()] = w;
    });
  }
  // forTask: "make his bed" keeps its "make"
  function tidyTitle(s, forTask = false) {
    let t = squash(s.replace(/\s+,\s+/g, " "));
    // Lead-in words: "i need to add", "can you put", "add an event for"
    const leads = [
      /^(?:okay|ok|right|so|hey|please|um|erm)\s+/,
      /^(?:i need to|i want to|i'd like to|we need to|can you|could you|can we|please|let's|lets)\s+/,
      forTask ? /^(?:add|create|put|pop|stick|enter)\s+(?:in\s+)?/ : /^(?:add|create|make|put|schedule|set up|pop|stick|enter)\s+(?:in\s+)?/,
      /^book\s+(?=(?:a|an|the|in)\s)/,
      /^(?:a new|a|an|the)\s+(?:event|appointment|calendar event|entry)\s*(?:(?:for|called|of)\s+)*/,
      /^(?:an? )?(?:event|appointment)\s*(?:(?:for|called)\s+)*/,
      /^(?:called|for)\s+/,
      /^(?:a|an|the)\s+/
    ];
    let changed = true;
    while (changed) { changed = false; leads.forEach(re => { const n = t.replace(re, ""); if (n !== t) { t = n; changed = true; } }); }
    // Leftover joining words at the ends: "... on", "... at", "for ..."
    const tail = /\s+(?:on|at|for|from|in|in the calendar|to the calendar|in my calendar|to my calendar|on the calendar|in the diary|please)$/;
    while (tail.test(t)) t = t.replace(tail, "");
    t = t.replace(/^(?:for|on|at)\s+/, "");
    t = t.replace(/\btheater\b/g, "theatre");
    t = squash(t).split(" ").map(w => (caseOf && caseOf[w]) || w).join(" ");
    return cap(t);
  }

  // ------------------------------------------------------------------ parse --
  function parse(text, ctx = {}) {
    const now = ctx.now instanceof Date ? ctx.now : new Date();
    const members = Array.isArray(ctx.members) ? ctx.members : [];
    const lists = Array.isArray(ctx.lists) ? ctx.lists : [];
    const want = ctx.want || null;
    const s = normalise(text);
    rememberCase(text);
    if (!s) return { kind: "unknown", text: "" };

    // 0. Removing ("take milk off the list", "cancel the dentist on tuesday")
    const gone = findRemove(s, lists, members, now);
    if (gone) return gone;

    // 1. Lists ("add vinegar to my shopping list", "we're out of milk")
    if (want !== "event" && want !== "task") {
      const l = findList(s, lists);
      if (l && l.items.length) return { kind: "list", listId: l.listId, items: l.items };
      if (want === "list") {
        const plain = s.replace(/^(?:please |can you |could you )?(?:add|put|get|buy)\s+/, "").replace(/\s+(?:to|on) (?:the|my|our) (?:shopping )?list$/, "");
        const items = splitItems(plain);
        if (items.length) return { kind: "list", listId: ctx.listId || "groceries", items };
      }
    }

    // 2. Meals ("we're having tacos tonight", "dad's cooking curry on friday")
    if (want !== "event" && want !== "task" && want !== "list") {
      const meal = findMeal(s, members, now);
      if (meal) return meal;
    }
    if (want === "meal") {
      const meal = findMeal(`${s} for dinner`, members, now);
      if (meal) return meal;
    }

    // 3. Tasks ("ava needs to tidy her room on saturday", "remind dara to feed the cat")
    let task = want === "event" ? null : findTask(s, members);
    if (!task && want === "task") task = { person: null, rest: s };
    if (task) {
      let rest = task.rest;
      const slot = /\bmorning\b/.test(rest) ? "morning" : /\b(evening|night|bedtime)\b/.test(rest) ? "evening" : /\bafternoon\b/.test(rest) ? "afternoon" : null;
      let daily = /\b(every morning|every evening|every night)\b/.test(rest);
      rest = squash(rest.replace(/\b(every morning|every evening|every night)\b/, " "));
      const rep = findRepeat(rest);
      rest = rep.rest;
      if (rep.repeat === "daily" || rep.repeat === "weekdays") daily = true;
      const weekly = rep.repeat === "weekly";
      const d = findDate(rest, now);
      rest = d.rest;
      const ppl = findPeople(rest, members);
      const people = [task.person, ...ppl.people].filter((p, i, a) => p && a.indexOf(p) === i);
      return { kind: "task", title: tidyTitle(ppl.rest.replace(/\b(?:in the|this|tomorrow|each|every)\s+(?:morning|afternoon|evening)\b/g, " "), true), people, date: d.date, daily, weekly, slot };
    }

    // 4. Events: anything with a day or a time, or that says "event" / "appointment"
    const rep = findRepeat(s);
    const d = findDate(rep.rest, now);
    const eveningHint = EVENING_HINTS.test(s);
    const t = findTime(d.rest, d.part, eveningHint);
    const saidEvent = /\b(event|appointment|calendar|diary)\b/.test(s);
    if (d.date || t.start !== null || saidEvent || rep.repeat || want === "event") {
      const ppl = findPeople(t.rest, members);
      const title = tidyTitle(ppl.rest.replace(/\b(?:in the |this |tomorrow )?(?:morning|afternoon|evening)\b/g, " "));
      return {
        kind: "event",
        title,
        date: d.date || startOfDay(now),
        dateSaid: !!d.date,
        start: t.start !== null ? hhmm(t.start) : null,
        end: t.start !== null ? hhmm(t.end) : null,
        allDay: t.start === null,
        members: ppl.family ? ["Family"] : ppl.people,
        repeat: rep.repeat || "none"
      };
    }

    return { kind: "unknown", text: s };
  }

  const api = { parse, normalise, memberFor, readTime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VoiceIntent = api;
})(typeof window !== "undefined" ? window : globalThis);
