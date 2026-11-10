// ============================================================================
// PAGE INTROS (js/page-intro.js)
// The first time a device opens a page (Calendar, Tasks, Meals, Lists,
// Rewards) the page's content is replaced by a short three-step intro: a
// preview on the left, what the page does on the right, Next / Skip tutorial.
// Finishing or skipping hides it for good on that device. Replay one with
// window.showPageIntro("lists"), or all with window.resetPageIntros().
// ============================================================================

const PAGE_INTRO_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function introPeople(max = 4) {
  const names = (window.familyMembers && window.familyMembers.length) ? window.familyMembers : ["Steven", "Sorcha", "Ava", "Dara"];
  return names.slice(0, max).map(name => {
    const pal = typeof window.getMemberPalette === "function" ? window.getMemberPalette(name) : { primary: "#0284c7", lightBg: "#e0f2fe", border: "#7dd3fc", text: "#075985" };
    return { name, pal };
  });
}

function introDays(count, startOffset) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + startOffset + i);
    return { date: d, isToday: d.getTime() === today.getTime(), label: PAGE_INTRO_DAY[d.getDay()], num: d.getDate() };
  });
}

function introDayLabel(day) {
  return `${day.label} ${day.isToday ? `<span class="page-intro-today-dot">${day.num}</span>` : day.num}`;
}

// ---------------------------------------------------------------------------
// Previews (decorative, nothing is saved)
// ---------------------------------------------------------------------------
const INTRO_PREVIEWS = {
  calendar(stepIndex) {
    const people = introPeople();
    const days = introDays(4, -1);
    const sample = [
      [["Swimming", "8:30"], ["Piano lesson", "16:30"]],
      [["Dentist", "10:00"], ["Football", "17:00"], ["Book club", "19:30"]],
      [["Parents' evening", "18:00"]],
      [["Gran visiting", "All day"], ["Cinema", "15:00"]]
    ];
    let n = 0;
    const cols = days.map((day, di) => {
      const events = sample[di].map(([title, time]) => {
        const p = people[n++ % people.length];
        return `<div class="intro-cal-event" style="background:${p.pal.lightBg};border-color:${p.pal.border};color:${p.pal.text}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(time)} · ${escapeHtml(p.name)}</span></div>`;
      }).join("");
      const add = (stepIndex === 1 && day.isToday) ? `<div class="intro-cal-event is-new page-intro-highlight"><strong>+ New event</strong><span>Who's it for?</span></div>` : "";
      return `<div class="intro-cal-day ${day.isToday ? "is-today" : ""}"><div class="intro-cal-day-head">${introDayLabel(day)}</div>${events}${add}</div>`;
    }).join("");
    const filter = stepIndex === 2
      ? `<div class="intro-filter-row">${people.map((p, i) => `<span class="intro-filter-chip ${i === 0 ? "is-on page-intro-highlight" : ""}" style="--chip:${p.pal.primary}">${escapeHtml(p.name)}</span>`).join("")}</div>`
      : "";
    return `${filter}<div class="intro-cal-grid">${cols}</div>`;
  },

  chores(stepIndex) {
    const people = introPeople(3); // three people; Grab it is the button above the board
    const chores = [["🛏️", "Make bed"], ["🐱", "Feed the cats"], ["🍽️", "Empty dishwasher"], ["📚", "Homework"], ["🍴", "Set the table"], ["🧹", "Hoover the stairs"]];
    const col = (p, items, opts = {}) => `
      <div class="intro-task-col" style="border-color:${p.pal.border};background:${p.pal.lightBg}33">
        <div class="intro-task-head"><span class="intro-avatar" style="background:${p.pal.primary}">${opts.icon || escapeHtml(p.name.charAt(0))}</span><span>${escapeHtml(p.name)}</span></div>
        ${items.map((c, i) => `
          <div class="intro-task-card ${c.done ? "is-done" : ""} ${c.hl ? "page-intro-highlight" : ""}" style="background:${p.pal.lightBg};border-color:${p.pal.border}">
            <span class="intro-task-emoji">${c.icon}</span><span class="intro-task-title">${escapeHtml(c.title)}</span>
            ${opts.grab ? `<span class="intro-task-grip">⠿</span>` : `<span class="intro-task-tick">${c.done ? "✓" : ""}</span>`}
          </div>`).join("")}
      </div>`;
    const cols = people.map((p, i) => col(p, [
      { icon: chores[i * 2][0], title: chores[i * 2][1], done: i === 0 || (stepIndex === 0 && i === 1) },
      { icon: chores[i * 2 + 1][0], title: chores[i * 2 + 1][1] }
    ])).join("");
    const grabs = `<div class="intro-grab-row"><span class="intro-grab-pill${stepIndex === 1 ? " page-intro-highlight" : ""}">🛠️ ${escapeHtml(window.BIG_JOBS_LABEL || "Big jobs")} <b>2</b></span></div>`;
    const fab = stepIndex === 2 ? `<span class="intro-fab page-intro-highlight">+</span>` : "";
    return `${grabs}<div class="intro-task-board">${cols}</div>${fab}`;
  },

  meals(stepIndex) {
    const days = introDays(5, -2);
    const sample = {
      breakfast: ["Porridge", "Pancakes", "Cereal", "Toast & jam", "Yoghurt & fruit"],
      lunch: ["Ham & cheese sandwich", "", "Soup & a roll", "Egg sandwich", "Wraps"],
      dinner: ["Spaghetti bolognese", "Fish pie", "Chicken stir-fry", null, "Pizza night"]
    };
    const head = days.map(d => `<div class="meals-intro-day ${d.isToday ? "is-today" : ""}">${introDayLabel(d)}</div>`).join("");
    const rows = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]].map(([slot, label]) => {
      const cells = days.map((_, i) => {
        if (stepIndex === 1 && slot === "dinner" && i === 2) return `<div class="meals-intro-cell is-plan page-intro-highlight"><span>+ Plan</span></div>`;
        const meal = sample[slot][i];
        if (!meal) return `<div class="meals-intro-cell is-empty"></div>`;
        return `<div class="meals-intro-cell meal-block-card meal-cat-${slot}"><span>${escapeHtml(meal)}</span></div>`;
      }).join("");
      return `<div class="meals-intro-row-label cat-theme-${slot}"><span>${label}</span></div>${cells}`;
    }).join("");
    return `<div class="meals-intro-grid"><div></div>${head}${rows}</div>`;
  },

  lists(stepIndex) {
    // Same shape as the page: your lists down the side, Groceries open with
    // its aisles, ticked things folded into Done
    const lists = [
      { title: "Groceries", icon: "🛒", accent: "#0284c7", light: "#e0f2fe", n: 4 },
      { title: "Weekend jobs", icon: "🛠️", accent: "#d97706", light: "#fef3c7", n: 2 },
      { title: "Holiday packing", icon: "🧳", accent: "#7c3aed", light: "#ede9fe", n: 5 }
    ];
    const rail = lists.map((l, i) => `<div class="intro-lrail-row ${i === 0 ? "is-on" : ""}" style="--list-accent:${l.accent};--list-light:${l.light}"><span class="intro-lrail-icon">${l.icon}</span><span class="intro-lrail-name">${escapeHtml(l.title)}</span><span class="intro-lrail-n">${l.n}</span></div>`).join("");
    const row = (t, done) => `<div class="intro-list-row ${done ? "is-done" : ""}"><span class="intro-list-box">${done ? "✓" : ""}</span>${escapeHtml(t)}</div>`;
    const sec = (title, n, rows) => `<div class="intro-lsec"><span>${title}</span><span>${n} ⌄</span></div>${rows}`;
    const g = lists[0];
    const detail = `
      <div class="intro-ldetail" style="--list-accent:${g.accent};--list-light:${g.light}">
        <div class="intro-ldetail-title">${g.icon} Groceries</div>
        <div class="intro-ladd ${stepIndex === 1 ? "page-intro-highlight" : ""}"><span class="intro-ladd-ring"></span>${stepIndex === 1 ? "Eggs" : "Add to Groceries"}<span class="intro-ladd-plus">+</span></div>
        ${sec("🍎 Fruit &amp; veg", 2, row("Bananas") + row("Apples"))}
        ${sec("🥛 Dairy", 2, row("Milk") + row("Cheddar"))}
        <div class="intro-lsec is-done"><span>✓ Done</span><span>1 ›</span></div>
      </div>`;
    const newBtn = stepIndex === 2 ? `<span class="intro-new-list page-intro-highlight">+ New List</span>` : "";
    return `${newBtn}<div class="intro-lists"><div class="intro-lrail">${rail}</div>${detail}</div>`;
  },

  rewards(stepIndex) {
    const people = introPeople(3);
    const pts = [42, 30, 18];
    const order = [1, 0, 2]; // 2nd, 1st, 3rd
    const podium = order.map(i => {
      const p = people[i] || people[0];
      return `<div class="intro-podium-col"><span class="intro-avatar" style="background:${p.pal.primary}">${i === 0 ? "👑" : escapeHtml(p.name.charAt(0))}</span><span class="intro-podium-name">${escapeHtml(p.name)}</span><div class="intro-podium-pillar" style="height:${40 + pts[i] * 2}px;background:${p.pal.lightBg};border-color:${p.pal.border};color:${p.pal.text}">${pts[i]} pts</div></div>`;
    }).join("");
    const kid = people[2] || people[0];
    const have = stepIndex === 2 ? 50 : 32;
    const goal = `
      <div class="intro-goal ${stepIndex >= 1 ? "page-intro-highlight-soft" : ""}" style="--goal:${kid.pal.primary};background:${kid.pal.lightBg};border-color:${kid.pal.border}">
        <div class="intro-goal-top"><span class="intro-avatar" style="background:${kid.pal.primary}">${escapeHtml(kid.name.charAt(0))}</span><strong>${escapeHtml(kid.name)}</strong><span class="intro-goal-spend">${have} pts to spend</span></div>
        <div class="intro-goal-row"><span>🎬</span><div><strong>Cinema trip</strong><span>${Math.min(have, 50)} of 50 pts</span></div></div>
        <div class="intro-goal-bar"><div style="width:${Math.min(100, have * 2)}%"></div></div>
        ${stepIndex === 2 ? `<span class="intro-redeem page-intro-highlight">Redeem</span>` : `<span class="intro-goal-togo">${50 - have} pts to go</span>`}
      </div>`;
    return `<div class="intro-rewards"><div class="intro-podium">${podium}</div>${goal}</div>`;
  }
};

// ---------------------------------------------------------------------------
// What each page says
// ---------------------------------------------------------------------------
const PAGE_INTROS = {
  calendar: {
    seenKey: "harmonee_calendar_intro_seen",
    container: "#view-calendar .calendar-view-container",
    steps: [
      { title: "Calendar", lead: "Everyone's plans in one place, on the kitchen wall and on your phone.",
        rows: [["🎨", "Each person has their own colour, so you can see who's busy at a glance."],
               ["📅", "Switch between 3-day, day, week and month views."],
               ["🔁", "Repeat things like lessons and clubs every week."]] },
      { title: "Add an event", lead: "Tap + and choose Add Event: what it is, when, and who it's for.",
        rows: [["👨‍👩‍👧", "Pick one person, a few of you, or the whole family."],
               ["📌", "Pin a message of the day for everyone to see."]] },
      { title: "Always in sync", lead: "Anything added on the tablet or a phone shows on every device that's joined your family board.",
        rows: [["🔎", "Use Filter to show just one person's plans."]] }
    ]
  },
  chores: {
    seenKey: "harmonee_tasks_intro_seen",
    container: "#view-chores .skylight-tasks-page-container",
    steps: [
      { title: "Tasks", lead: "Chores and daily routines for everyone, with a column for each person.",
        rows: [["☀️", "Routines are grouped into Morning, Afternoon, Evening and Anytime."],
               ["✅", "Tap the circle to tick a chore off and earn points."],
               ["⚡", "Small everyday jobs nobody owns are Quick grabs: drag one into your column."]] },
      { title: "Big jobs", lead: "Tap Big jobs to see the bigger jobs nobody's doing yet, then tap 👤 to give one to someone.",
        rows: [["👆", "Changed your mind? Press and hold a chore, then drag it to someone else."],
               ["🔄", "Set a rota so a chore goes to different people on different days."]] },
      { title: "Add a chore", lead: "Tap + to add a chore or routine, choose who it's for and how many points it's worth.",
        rows: [["🏆", "Points count towards reward goals on the Rewards page."]] }
    ]
  },
  meals: {
    seenKey: "harmonee_meals_intro_seen",
    container: "#view-meals .skylight-meals-main",
    steps: [
      { title: "Meals", lead: "Plan the week's meals in a few minutes, and stop answering “what's for dinner?” every night.",
        rows: [["📖", "Keep your family's favourite recipes in one place."],
               ["🍴", "Use them to plan breakfast, lunch and dinner for the week."],
               ["🛒", "Send a recipe's ingredients straight to your Groceries list."]] },
      { title: "Plan a meal", lead: "Tap + Plan on any day, then pick one of your recipes or just type what you're having.",
        rows: [["👩‍🍳", "Choose who's cooking. Their name shows on the meal in their colour."],
               ["📅", "Use ‹ Today › to look ahead and plan next week too."]] },
      { title: "Your grocery list", lead: "Tap Grocery List to see what to buy. It's the same Groceries list as on the Lists page, so the whole family can add to it and tick things off.",
        rows: [["✅", "Tick items off in the shop. Everyone's devices update straight away."]] }
    ]
  },
  lists: {
    seenKey: "harmonee_lists_intro_seen",
    container: "#view-lists .lists-view-container",
    steps: [
      { title: "Lists", lead: "Shared lists for the whole family: the food shop, packing, jobs for the weekend.",
        rows: [["🛒", "Groceries is shared with the Meals page."],
               ["🎨", "Every list has its own colour and icon."],
               ["⚡", "Ticks show on every device straight away."]] },
      { title: "Add items", lead: "Type in a list's box and press Return, or tap + to add several things at once, one per line.",
        rows: [["✓", "Tap an item to tick it. Ticked items fold away into Done."],
               ["🛒", "Groceries sort themselves into aisles you can fold away."]] },
      { title: "Make a new list", lead: "Tap New List, then give it a name, an icon and a colour.",
        rows: [["✎", "Tap the pencil on any list to rename it, change its colour or delete it."]] }
    ]
  },
  rewards: {
    seenKey: "harmonee_rewards_intro_seen",
    container: "#view-rewards .rewards-view-container",
    steps: [
      { title: "Rewards", lead: "Every job earns stars. The bars at the top show this week's stars, and start again every Monday.",
        rows: [["👑", "Whoever's ahead this week wears the crown."],
               ["🤝", "Set a family goal: everyone's stars add up to one treat together."],
               ["💷", "Prefer pocket money? Switch to £ in Settings."]] },
      { title: "Everyone's card", lead: "Each person has a card: today's jobs, points to spend and what they're saving up for.",
        rows: [["🎯", "Tap ＋ Set a goal, then pick how many points it costs."],
               ["🔥", "Daily jobs done day after day build a streak."],
               ["⭐", "Stickers are earned for real things: a first job, 7 days in a row, a Big job."]] },
      { title: "Redeem", lead: "When there are enough points, tap Redeem, then tap again to confirm. Unspent points carry over from week to week.",
        rows: [["👆", "Tap someone's card to see all their goals, stickers and jobs this week."]] }
    ]
  }
};

// ---------------------------------------------------------------------------
// Showing and hiding
// ---------------------------------------------------------------------------
function pageIntroSeen(page) {
  try { return localStorage.getItem(PAGE_INTROS[page].seenKey) === "true"; } catch (e) { return true; }
}

function renderPageIntro(page, stepIndex) {
  const host = document.getElementById("page-intro");
  if (!host) return;
  const cfg = PAGE_INTROS[page];
  const step = cfg.steps[stepIndex];
  const isLast = stepIndex === cfg.steps.length - 1;
  host.innerHTML = `
    <button type="button" class="page-intro-skip" data-intro-skip>Skip tutorial</button>
    <div class="page-intro-preview page-intro-preview-${page}" aria-hidden="true">${INTRO_PREVIEWS[page](stepIndex)}</div>
    <div class="page-intro-copy">
      <h2 class="page-intro-title" id="page-intro-title">${escapeHtml(step.title)}</h2>
      <p class="page-intro-lead">${escapeHtml(step.lead)}</p>
      <ul class="page-intro-rows">
        ${step.rows.map(([icon, text]) => `<li><span class="page-intro-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(text)}</span></li>`).join("")}
      </ul>
      <div class="page-intro-footer">
        <button type="button" class="page-intro-next" data-intro-next>${isLast ? "Get started" : "Next"}</button>
        <span class="page-intro-steps" aria-label="Step ${stepIndex + 1} of ${cfg.steps.length}">
          ${cfg.steps.map((_, i) => `<span class="page-intro-dot ${i === stepIndex ? "is-current" : ""}"></span>`).join("")}
        </span>
      </div>
    </div>`;
  host.setAttribute("data-step", String(stepIndex));
  const next = host.querySelector("[data-intro-next]");
  if (next) setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
}

function closePageIntro() {
  const host = document.getElementById("page-intro");
  if (!host) return;
  const page = host.getAttribute("data-page");
  try { localStorage.setItem(PAGE_INTROS[page].seenKey, "true"); } catch (e) {}
  host.remove();
  clearPageIntroClasses();
}

function clearPageIntroClasses() {
  document.querySelectorAll(".page-intro-container").forEach(el => el.classList.remove("page-intro-container"));
  document.querySelectorAll(".page-intro-active").forEach(el => el.classList.remove("page-intro-active"));
}

function showPageIntro(page) {
  const cfg = PAGE_INTROS[page];
  if (!cfg) return;
  const container = document.querySelector(cfg.container);
  if (!container) return;
  if (document.getElementById("page-intro")) closePageIntroWithoutSaving();
  const view = container.closest(".skylight-page-view");
  const header = container.querySelector(":scope > header");

  const host = document.createElement("section");
  host.id = "page-intro";
  host.className = "page-intro";
  host.setAttribute("data-page", page);
  host.setAttribute("aria-labelledby", "page-intro-title");
  if (header) header.after(host); else container.prepend(host);

  // Hide the page's own content, header buttons and + button while the
  // intro shows. Done in CSS by position (css/page-intro.css), so anything
  // the page redraws underneath stays hidden too.
  container.classList.add("page-intro-container");
  if (view) view.classList.add("page-intro-active");

  host.addEventListener("click", (e) => {
    if (e.target.closest("[data-intro-skip]")) { closePageIntro(); return; }
    if (e.target.closest("[data-intro-next]")) {
      const i = Number(host.getAttribute("data-step") || 0);
      if (i >= cfg.steps.length - 1) closePageIntro();
      else renderPageIntro(page, i + 1);
    }
  });
  renderPageIntro(page, 0);
}
window.showPageIntro = showPageIntro;

// Leaving a page mid-intro: take it down without marking it seen
function closePageIntroWithoutSaving() {
  const host = document.getElementById("page-intro");
  if (host) host.remove();
  clearPageIntroClasses();
}

// Called whenever a page is shown: first visit on this device only
function maybeShowPageIntro(page) {
  const host = document.getElementById("page-intro");
  if (host && host.getAttribute("data-page") === page) return;
  if (host) closePageIntroWithoutSaving();
  if (!PAGE_INTROS[page] || pageIntroSeen(page)) return;
  // Never on top of the family code screen or first-time setup
  if (document.body.classList.contains("board-join-active") || document.getElementById("board-join-screen")) return;
  const onboarding = document.getElementById("onboarding-modal");
  if (onboarding && onboarding.open) return;
  // One thing at a time: not over Today at a glance, setup or an open panel
  // (it shows when Today closes, or the next time the page opens)
  const today = document.getElementById("today-screen");
  if (today && !today.hidden) return;
  if (document.getElementById("setup-wizard") && !document.getElementById("setup-wizard").hidden) return;
  if (document.querySelector("dialog[open]")) return;
  const container = document.querySelector(PAGE_INTROS[page].container);
  const view = container && container.closest(".skylight-page-view");
  if (!view || view.style.display === "none") return;
  showPageIntro(page);
}
window.maybeShowPageIntro = maybeShowPageIntro;

// Going to a page to do something (Getting started): count its tutorial as seen
window.markPageIntroSeen = function (page) {
  const key = page === "tasks" ? "chores" : page;
  if (!PAGE_INTROS[key]) return;
  try { localStorage.setItem(PAGE_INTROS[key].seenKey, "true"); } catch (e) {}
  const host = document.getElementById("page-intro");
  if (host && host.getAttribute("data-page") === key) closePageIntroWithoutSaving();
};

window.resetPageIntros = function () {
  Object.values(PAGE_INTROS).forEach(cfg => { try { localStorage.removeItem(cfg.seenKey); } catch (e) {} });
};
