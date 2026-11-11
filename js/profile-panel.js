// ============================================================================
// A PERSON'S PROFILE (js/profile-panel.js)
// Opened from Settings → Profiles (tap a person, or "Profile"). Their colour
// and their buddy (js/buddies.js), with a preview you can tap to watch the
// buddy celebrate. Changes save straight away, like the rest of Profiles.
// ============================================================================
(function () {
  let person = null;

  const colours = () => (Array.isArray(window.SKYLIGHT_PROFILE_COLORS) ? window.SKYLIGHT_PROFILE_COLORS : []);
  const palette = (n) => (typeof window.getMemberPalette === "function" ? window.getMemberPalette(n) : { primary: "#64748b", id: null, name: "" });

  function ensureDialog() {
    let dlg = document.getElementById("profile-modal");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "profile-modal";
    dlg.className = "roster-dialog profile-dialog";
    dlg.setAttribute("aria-labelledby", "profile-title");
    dlg.innerHTML = `
      <div class="modal-content">
        <button type="button" class="btn-modal-close" id="btn-close-profile" aria-label="Close">✕</button>
        <div class="modal-header"><h2 id="profile-title" class="modal-title">Profile</h2></div>
        <div id="profile-body"></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#btn-close-profile").addEventListener("click", () => dlg.close());
    if (typeof window.upgradeToSidePanel === "function") window.upgradeToSidePanel(dlg);
    dlg.addEventListener("click", onClick);
    // Keep the page behind still while it's open (app.js syncModalScrollLock)
    dlg.addEventListener("close", () => { if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock(); });
    return dlg;
  }

  function render() {
    const dlg = document.getElementById("profile-modal");
    if (!dlg || !person) return;
    const pal = palette(person);
    const buddyId = window.Buddies ? window.Buddies.getMemberBuddy(person) : null;
    const buddy = buddyId ? window.Buddies.byId(buddyId) : null;
    const pictures = !!(window.PictureJobs && window.PictureJobs.isOn(person));
    dlg.style.setProperty("--profile-color", pal.primary);
    dlg.querySelector("#profile-title").textContent = `${person}'s profile`;
    const tiles = (window.Buddies ? window.Buddies.available() : []).map(b => `
      <button type="button" class="profile-buddy-tile" data-pick-buddy="${escapeHtml(b.id)}" aria-pressed="${b.id === buddyId}">
        ${window.Buddies.svgFor(b.id)}<span>${escapeHtml(b.name)}</span>
      </button>`).join("") + `
      <button type="button" class="profile-buddy-tile" data-pick-buddy="none" aria-pressed="${!buddyId}">
        <span class="profile-no-buddy" aria-hidden="true">–</span><span>No buddy</span>
      </button>`;
    dlg.querySelector("#profile-body").innerHTML = `
      <div class="profile-hero">
        ${(() => { const f = memberFace(person); return `<span class="profile-hero-avatar${f.cls}" style="${f.style}" aria-hidden="true">${f.html}</span>`; })()}
        <div><p class="profile-hero-name">${escapeHtml(person)}</p>
          <p class="profile-hero-sub">${escapeHtml([pal.name, buddy ? `${buddy.name} buddy` : "No buddy yet"].filter(Boolean).join(" · "))}</p></div>
      </div>

      <section class="profile-section" aria-labelledby="profile-reading-head">
        <h3 class="profile-section-title" id="profile-reading-head">Is ${escapeHtml(person)} reading yet?</h3>
        <div class="profile-reading" role="group" aria-label="Is ${escapeHtml(person)} reading yet?">
          <button type="button" class="profile-reading-btn" data-reading="no" aria-pressed="${pictures}">
            <span class="profile-reading-icon" aria-hidden="true">🖼️</span><span><strong>Not yet</strong><small>Show pictures and read jobs aloud</small></span></button>
          <button type="button" class="profile-reading-btn" data-reading="yes" aria-pressed="${!pictures}">
            <span class="profile-reading-icon" aria-hidden="true">📖</span><span><strong>Yes, they're reading</strong><small>Jobs show as words</small></span></button>
        </div>
        <p class="profile-section-desc">You can change this any time. Plenty of kids use pictures while they learn.</p>
        ${pictures ? `<button type="button" class="profile-starter-btn" data-open-starter>✨ Add a ready-made routine</button>` : ""}
      </section>

      <section class="profile-section" aria-labelledby="profile-buddy-head">
        <h3 class="profile-section-title" id="profile-buddy-head">Buddy</h3>
        <p class="profile-section-desc">When ${escapeHtml(person)} ticks off their last job of the day, their buddy pops up to say well done.</p>
        ${buddy ? `<div class="profile-buddy-preview">
            ${window.Buddies.svgFor(buddyId)}
            <div class="profile-buddy-preview-text"><strong>${escapeHtml(buddy.name)}</strong>
              <button type="button" class="profile-play-btn" data-play-buddy>▶ Watch ${escapeHtml(buddy.name)}</button></div>
          </div>` : ""}
        <div class="profile-buddy-grid" role="group" aria-label="Choose a buddy">${tiles}</div>
      </section>

      <section class="profile-section" aria-labelledby="profile-colour-head">
        <h3 class="profile-section-title" id="profile-colour-head">Colour</h3>
        <div class="profile-colour-grid" role="group" aria-label="${escapeHtml(person)}'s colour">
          ${colours().map(c => `<button type="button" class="profile-colour-swatch" data-pick-colour="${escapeHtml(c.id)}" aria-pressed="${c.id === pal.id}" aria-label="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" style="background: ${escapeHtml(c.solid)};"></button>`).join("")}
        </div>
      </section>`;
  }

  async function onClick(e) {
    const reading = e.target.closest("[data-reading]");
    if (reading && window.PictureJobs) {
      const pictures = reading.getAttribute("data-reading") === "no";
      const was = window.PictureJobs.isOn(person);
      await window.PictureJobs.setOn(person, pictures);
      render();
      // Just switched on, and no jobs yet: offer the ready-made routine
      const hasJobs = typeof window.getTasksForColumn === "function" && window.getTasksForColumn(person, new Date()).length > 0;
      if (pictures && !was && !hasJobs) window.PictureJobs.openStarter(person);
      return;
    }
    if (e.target.closest("[data-open-starter]") && window.PictureJobs) { window.PictureJobs.openStarter(person); return; }
    const pick = e.target.closest("[data-pick-buddy]");
    if (pick && window.Buddies) {
      const id = pick.getAttribute("data-pick-buddy");
      await window.Buddies.setMemberBuddy(person, id === "none" ? null : id);
      render();
      if (typeof window.renderRosterModalList === "function") window.renderRosterModalList();
      return;
    }
    if (e.target.closest("[data-play-buddy]") && window.Buddies) {
      window.Buddies.celebrate(person);
      return;
    }
    const colour = e.target.closest("[data-pick-colour]");
    if (colour && typeof window.setMemberColour === "function") {
      window.setMemberColour(person, colour.getAttribute("data-pick-colour"));
      render();
    }
  }

  function openProfilePanel(name) {
    if (!name) return;
    person = name;
    const dlg = ensureDialog();
    render();
    if (!dlg.open) dlg.showModal();
    if (typeof window.syncModalScrollLock === "function") window.syncModalScrollLock();
  }
  window.openProfilePanel = openProfilePanel;

  // Another device changed someone's buddy or colour
  document.addEventListener("harmonee:data", () => {
    const dlg = document.getElementById("profile-modal");
    if (dlg && dlg.open) render();
  });
})();
