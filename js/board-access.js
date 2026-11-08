// ============================================================================
// BOARD ACCESS SCREEN (js/board-access.js)
// Full-screen "enter your family code" prompt shown when this device hasn't
// joined the board yet. The Firebase side lives in app.js (ensureBoardAccess);
// this file is only the UI. Resolves once a code is accepted.
// ============================================================================

function showJoinBoardScreen({ familyName = "", hadWrongLinkCode = false, tryCode }) {
  return new Promise((resolve) => {
    const existing = document.getElementById("board-join-screen");
    if (existing) existing.remove();

    const title = familyName ? `Join the ${familyName} board` : "Join your family board";
    const overlay = document.createElement("div");
    overlay.id = "board-join-screen";
    overlay.className = "board-join-screen";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "board-join-title");
    overlay.innerHTML = `
      <form class="board-join-card" novalidate>
        <div class="board-join-icon" aria-hidden="true">🔐</div>
        <h1 id="board-join-title" class="board-join-title">${escapeHtml(title)}</h1>
        <p class="board-join-sub">Enter your family code to use harmonee on this device. You only need to do this once.</p>
        <label class="board-join-label" for="board-join-code">Family code</label>
        <input id="board-join-code" class="board-join-input" type="text" inputmode="text"
               autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"
               maxlength="14" placeholder="MINT-FROG-LAMP" aria-describedby="board-join-error">
        <p id="board-join-error" class="board-join-error" role="alert">${hadWrongLinkCode ? "That link's code didn't work. Check it and try again." : ""}</p>
        <button type="submit" class="board-join-btn">Join board</button>
        <p class="board-join-help">Find the code in <strong>Settings → Family access</strong> on a device that's already set up.</p>
      </form>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("board-join-active");

    const form = overlay.querySelector("form");
    const input = overlay.querySelector("#board-join-code");
    const errorEl = overlay.querySelector("#board-join-error");
    const btn = overlay.querySelector(".board-join-btn");
    setTimeout(() => input.focus(), 50);

    // Auto-format in groups of 4 while typing: MINT-FROG-LAMP (new codes)
    // or ABCD-EFGH (codes from before Nov 2026)
    input.addEventListener("input", () => {
      const raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      input.value = (raw.match(/.{1,4}/g) || []).join("-");
      errorEl.textContent = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = input.value.replace(/[^A-Z0-9]/gi, "");
      if (code.length < 8) {
        errorEl.textContent = "Enter all of the code, like MINT-FROG-LAMP.";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Checking…";
      const ok = await tryCode(code);
      if (ok) {
        overlay.remove();
        document.body.classList.remove("board-join-active");
        resolve();
      } else {
        btn.disabled = false;
        btn.textContent = "Join board";
        errorEl.textContent = window.isOffline && window.isOffline()
          ? "You're offline. Joining needs the internet: try again when you're connected."
          : "That code didn't work. Check it and try again.";
        input.select();
      }
    });
  });
}
window.showJoinBoardScreen = showJoinBoardScreen;
