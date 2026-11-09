// ============================================================================
// GETTING STARTED (js/getting-started.js)
// A new family lands on Today at a glance with a "Getting started" card:
//   👋 Invite your family        → the QR sheet (never pushed, just offered)
//   📅 Add your first event      → Calendar, add-event panel open
//   🍽️ Plan a meal               → Meals, plan-dinner panel open for tonight
//   🛒 Add something to a list   → Lists, Groceries with the add box open
// Each item ticks itself off whenever it's done, however and whenever (the
// board's settings.firsts, from js/firsts.js, or the data itself). The ✕
// hides the card for good; it also goes once everything's done.
// Going to a page from here counts as seeing that page's tutorial: the card
// is the guidance, so nobody reads three screens before doing what they
// tapped. Only new boards (made with settings.firsts) get the card.
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]))); // escapes even if utils.js hasn't loaded
  const ITEMS = [
    { key: "invite", icon: "👋", title: "Invite your family", sub: "Share a QR code so they can join" },
    { key: "event",  icon: "📅", title: "Add your first event", sub: "A club, a birthday, the dentist" },
    { key: "meal",   icon: "🍽️", title: "Plan a meal", sub: "What's for dinner tonight?" },
    { key: "list",   icon: "🛒", title: "Add something to a list", sub: "Milk, bread, anything" }
  ];
  const NEXT_LABEL = { invite: "👋 Invite your family", event: "📅 Add an event", meal: "🍽️ Plan a meal", list: "🛒 Add to a list" };

  // Someone else has joined (a second device): checked now and then
  let otherDevices = false;
  let checkedDevicesAt = 0;
  async function checkDevices() {
    if (otherDevices || Date.now() - checkedDevicesAt < 60000 || typeof window.loadFamilyAccessInfo !== "function") return;
    checkedDevicesAt = Date.now();
    try {
      const info = await window.loadFamilyAccessInfo();
      if (info && Array.isArray(info.devices) && info.devices.length > 1) {
        otherDevices = true;
        document.dispatchEvent(new CustomEvent("harmonee:data"));
      }
    } catch (e) {}
  }

  function anyMealPlanned() {
    try {
      const store = typeof window.loadDateMeals === "function" ? window.loadDateMeals() : null;
      return !!store && Object.values(store).some(day => day && typeof day === "object" &&
        (day.title || ["breakfast", "lunch", "dinner"].some(k => day[k] && day[k].title)));
    } catch (e) { return false; }
  }
  function anyListItem() {
    try { return (typeof window.loadFamilyLists === "function" ? window.loadFamilyLists() : []).some(l => (l.items || []).length); }
    catch (e) { return false; }
  }

  function done() {
    const f = ((window.boardSettings || {}).firsts) || {};
    return {
      invite: !!f.invite || otherDevices,
      event: !!f.event || (window.familyEvents || []).length > 0,
      meal: !!f.meal || anyMealPlanned(),
      list: !!f.list || anyListItem()
    };
  }

  // New boards only, not hidden, and something still to do
  function isActive() {
    const s = window.boardSettings || {};
    if (!s.firsts || typeof s.firsts !== "object" || s.gettingStartedHidden) return false;
    const d = done();
    return ITEMS.some(i => !d[i.key]);
  }

  // The next thing still to do, after the one just done
  function nextAfter(kind) {
    if (!isActive()) return null;
    const d = done();
    const order = ITEMS.map(i => i.key);
    const from = Math.max(0, order.indexOf(kind));
    const rest = [...order.slice(from + 1), ...order.slice(0, from)];
    const key = rest.find(k => !d[k] && k !== kind);
    return key ? { key, label: NEXT_LABEL[key] } : null;
  }

  function cardHtml() {
    if (!isActive()) return "";
    checkDevices();
    const d = done();
    const left = ITEMS.filter(i => !d[i.key]).length;
    const doneCount = ITEMS.length - left;
    const nextKey = (ITEMS.find(i => !d[i.key]) || {}).key;
    return `<section class="today-card today-getting-started" aria-labelledby="gs-title">
      <button type="button" class="gs-hide" data-gs-hide aria-label="Hide getting started" title="Hide">✕</button>
      <div class="gs-head">
        <h3 class="gs-title" id="gs-title"><span class="gs-title-icon" aria-hidden="true">🏡</span>Getting started</h3>
        <p class="gs-lead">${doneCount ? `${left} to go. Nice work!` : "Welcome home! Four quick things to try:"}</p>
        <div class="gs-progress" role="progressbar" aria-label="Getting started" aria-valuemin="0" aria-valuemax="${ITEMS.length}" aria-valuenow="${doneCount}">
          <span class="gs-progress-bar"><i style="width:${(doneCount / ITEMS.length) * 100}%"></i></span>
          <span class="gs-progress-text">${doneCount} of ${ITEMS.length} done</span>
        </div>
      </div>
      <ul class="gs-list">${ITEMS.map(i => `<li>
        <button type="button" class="gs-item${d[i.key] ? " is-done" : ""}${i.key === nextKey ? " is-next" : ""}" data-gs="${i.key}">
          <span class="gs-icon" aria-hidden="true">${i.icon}</span>
          <span class="gs-text">${i.key === nextKey ? `<span class="gs-badge">Start here</span>` : ""}<strong>${esc(i.title)}</strong>${d[i.key] ? `<small>Done</small>` : `<small>${esc(i.sub)}</small>`}</span>
          <span class="gs-check" aria-hidden="true">${d[i.key] ? "✓" : ""}</span>
        </button>
      </li>`).join("")}</ul>
    </section>`;
  }

  function hide() {
    if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ gettingStartedHidden: true });
    document.dispatchEvent(new CustomEvent("harmonee:data"));
  }

  function markFirst(kind) {
    const s = window.boardSettings || {};
    if (!s.firsts || s.firsts[kind]) return;
    if (typeof window.saveBoardSettingsNow === "function") window.saveBoardSettingsNow({ firsts: { ...s.firsts, [kind]: new Date().toISOString() } });
  }

  // Leave Today for a page, skipping that page's tutorial (we're doing, not reading)
  function goTo(view, introPage, then) {
    if (typeof window.markPageIntroSeen === "function") window.markPageIntroSeen(introPage);
    if (typeof window.closeTodayScreen === "function") window.closeTodayScreen({ quiet: true });
    if (typeof window.switchSkylightView === "function") window.switchSkylightView(view);
    setTimeout(then, 350);
  }

  async function go(key) {
    if (key === "invite") {
      let info = null;
      try { info = typeof window.loadFamilyAccessInfo === "function" ? await window.loadFamilyAccessInfo() : null; } catch (e) {}
      if (!info || !info.joinUrl) {
        if (typeof window.showCalendarToast === "function") window.showCalendarToast("Your family's QR code is in Settings › Access.");
        return;
      }
      const name = (window.boardSettings || {}).familyName || "";
      if (window.JoinQR) window.JoinQR.show({ url: info.joinUrl, code: info.code, familyName: name });
      markFirst("invite"); // offering it counts: nobody has to share
      document.dispatchEvent(new CustomEvent("harmonee:data"));
      return;
    }
    const todayKey = typeof window.getLocalDateKey === "function" ? window.getLocalDateKey(new Date()) : null;
    if (key === "event") return goTo("calendar", "calendar", () => { if (typeof window.openEventModal === "function") window.openEventModal(); });
    if (key === "meal") return goTo("meals", "meals", () => { if (typeof window.openPlanMealDrawer === "function") window.openPlanMealDrawer(todayKey, "dinner"); });
    if (key === "list") return goTo("lists", "lists", () => { if (typeof window.openAddListItemPanel === "function") window.openAddListItemPanel("groceries"); });
  }

  window.GettingStarted = { isActive, cardHtml, go, hide, nextAfter, done };
})();
