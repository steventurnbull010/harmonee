// ============================================================================
// MEALS INTRO (js/meals-intro.js)
// The first time a device opens Meals, the planner is replaced by a short
// three-step introduction: a sample week on the left, what Meals does on the
// right, Next / Skip tutorial. Once finished or skipped it never shows again
// on that device. Call showMealsIntro() to replay it.
// ============================================================================

const MEALS_INTRO_SEEN_KEY = "harmonee_meals_intro_seen";

const MEALS_INTRO_STEPS = [
  {
    title: "Meals",
    lead: "Plan the week's meals in a few minutes, and stop answering “what's for dinner?” every night.",
    rows: [
      { icon: "📖", text: "Keep your family's favourite recipes in one place." },
      { icon: "🍴", text: "Use them to plan breakfast, lunch and dinner for the week." },
      { icon: "🛒", text: "Send a recipe's ingredients straight to your Groceries list." }
    ],
    highlight: null
  },
  {
    title: "Plan a meal",
    lead: "Tap + Plan on any day, then pick one of your recipes or just type what you're having.",
    rows: [
      { icon: "👩‍🍳", text: "Choose who's cooking. Their name shows on the meal in their colour." },
      { icon: "📅", text: "Use ‹ Today › to look ahead and plan next week too." }
    ],
    highlight: { day: 2, slot: "dinner" } // today's dinner (the middle column)
  },
  {
    title: "Your grocery list",
    lead: "Tap Grocery List to see what to buy. It's the same Groceries list as on the Lists page, so the whole family can add to it and tick things off.",
    rows: [
      { icon: "✅", text: "Tick items off in the shop. Everyone's devices update straight away." }
    ],
    highlight: null
  }
];

// A believable sample week for the preview (not saved anywhere)
const MEALS_INTRO_SAMPLE = {
  breakfast: ["Porridge", "Pancakes", "Cereal", "Toast & jam", "Yoghurt & fruit"],
  lunch: ["Ham & cheese sandwich", "", "Soup & a roll", "Egg sandwich", "Wraps"],
  dinner: ["Spaghetti bolognese", "Fish pie", "Chicken stir-fry", null, "Pizza night"]
};

function hasSeenMealsIntro() {
  try { return localStorage.getItem(MEALS_INTRO_SEEN_KEY) === "true"; } catch (e) { return true; }
}

function markMealsIntroSeen() {
  try { localStorage.setItem(MEALS_INTRO_SEEN_KEY, "true"); } catch (e) {}
}

function renderMealsIntroPreview(step) {
  // Five days starting two days ago, so today (marked) is always in view
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(today.getDate() - 2);
  const days = Array.from({ length: 5 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const head = days.map(d => {
    const isToday = d.getTime() === today.getTime();
    return `<div class="meals-intro-day ${isToday ? "is-today" : ""}">${short[d.getDay()]} ${isToday ? `<span class="meals-intro-today-dot">${d.getDate()}</span>` : d.getDate()}</div>`;
  }).join("");

  const rows = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]].map(([slot, label]) => {
    const cells = days.map((_, i) => {
      const meal = MEALS_INTRO_SAMPLE[slot][i];
      const hl = step.highlight && step.highlight.day === i && step.highlight.slot === slot;
      if (hl) return `<div class="meals-intro-cell is-plan is-highlight"><span>+ Plan</span></div>`;
      if (!meal) return `<div class="meals-intro-cell is-empty"></div>`;
      return `<div class="meals-intro-cell meal-block-card meal-cat-${slot}"><span>${escapeHtml(meal)}</span></div>`;
    }).join("");
    return `<div class="meals-intro-row-label cat-theme-${slot}"><span>${label}</span></div>${cells}`;
  }).join("");

  return `<div class="meals-intro-grid" aria-hidden="true"><div></div>${head}${rows}</div>`;
}

function renderMealsIntro(stepIndex) {
  const host = document.getElementById("meals-intro");
  if (!host) return;
  const step = MEALS_INTRO_STEPS[stepIndex];
  const isLast = stepIndex === MEALS_INTRO_STEPS.length - 1;
  host.innerHTML = `
    <button type="button" class="meals-intro-skip" data-intro-skip>Skip tutorial</button>
    <div class="meals-intro-preview">${renderMealsIntroPreview(step)}</div>
    <div class="meals-intro-copy">
      <h2 class="meals-intro-title" id="meals-intro-title">${escapeHtml(step.title)}</h2>
      <p class="meals-intro-lead">${escapeHtml(step.lead)}</p>
      <ul class="meals-intro-rows">
        ${step.rows.map(r => `<li><span class="meals-intro-icon" aria-hidden="true">${r.icon}</span><span>${escapeHtml(r.text)}</span></li>`).join("")}
      </ul>
      <div class="meals-intro-footer">
        <button type="button" class="meals-intro-next" data-intro-next>${isLast ? "Get started" : "Next"}</button>
        <span class="meals-intro-steps" aria-label="Step ${stepIndex + 1} of ${MEALS_INTRO_STEPS.length}">
          ${MEALS_INTRO_STEPS.map((_, i) => `<span class="meals-intro-dot ${i === stepIndex ? "is-current" : ""}"></span>`).join("")}
        </span>
      </div>
    </div>`;
  host.setAttribute("data-step", String(stepIndex));
  const next = host.querySelector("[data-intro-next]");
  if (next) setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
}

function closeMealsIntro() {
  markMealsIntroSeen();
  const view = document.getElementById("view-meals");
  const host = document.getElementById("meals-intro");
  if (host) host.remove();
  if (view) view.classList.remove("meals-intro-active");
}

function showMealsIntro() {
  const main = document.querySelector("#view-meals .skylight-meals-main");
  if (!main) return;
  let host = document.getElementById("meals-intro");
  if (!host) {
    host = document.createElement("section");
    host.id = "meals-intro";
    host.className = "meals-intro";
    host.setAttribute("aria-labelledby", "meals-intro-title");
    const header = main.querySelector(".calendar-header");
    if (header && header.nextSibling) main.insertBefore(host, header.nextSibling);
    else main.appendChild(host);
    host.addEventListener("click", (e) => {
      if (e.target.closest("[data-intro-skip]")) { closeMealsIntro(); return; }
      if (e.target.closest("[data-intro-next]")) {
        const i = Number(host.getAttribute("data-step") || 0);
        if (i >= MEALS_INTRO_STEPS.length - 1) closeMealsIntro();
        else renderMealsIntro(i + 1);
      }
    });
  }
  document.getElementById("view-meals").classList.add("meals-intro-active");
  renderMealsIntro(0);
}
window.showMealsIntro = showMealsIntro;

// Called whenever the Meals page renders: first visit on this device only
function maybeShowMealsIntro() {
  if (hasSeenMealsIntro()) return;
  if (document.getElementById("meals-intro")) return;
  const view = document.getElementById("view-meals");
  if (!view || view.style.display === "none") return;
  showMealsIntro();
}
window.maybeShowMealsIntro = maybeShowMealsIntro;
