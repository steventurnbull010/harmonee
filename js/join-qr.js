// ============================================================================
// JOIN QR CODE (js/join-qr.js)
// The family's join link as a QR code: hold the tablet up and everyone
// points their phone camera at it to join the board. Drawn as an SVG by
// qrcode-generator (cdnjs, loaded in index.html).
//   JoinQR.svg(url)          the QR as an SVG string ("" if it can't be drawn)
//   JoinQR.show({ url, code, familyName })   a big QR to show the family
// ============================================================================
(function () {
  const esc = (s) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]))); // escapes even if utils.js hasn't loaded

  function svg(url) {
    if (!url || typeof window.qrcode !== "function") return "";
    try {
      const qr = window.qrcode(0, "M"); // medium error correction: scans well off a screen
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: "QR code to join the family board" });
    } catch (e) {
      console.warn("Join QR:", e);
      return "";
    }
  }

  function show({ url, code, familyName }) {
    const qr = svg(url);
    let dlg = document.getElementById("join-qr-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "join-qr-dialog";
      dlg.className = "join-qr-dialog";
      dlg.setAttribute("aria-labelledby", "join-qr-title");
      document.body.appendChild(dlg);
      dlg.addEventListener("click", async (e) => {
        if (e.target === dlg || e.target.closest("[data-qr-close]")) { dlg.close(); return; }
        const copy = e.target.closest("[data-qr-copy]");
        if (copy) {
          try { await navigator.clipboard.writeText(dlg._url); copy.textContent = "Copied ✓"; }
          catch (err) { window.prompt("Copy this join link:", dlg._url); }
          setTimeout(() => { copy.textContent = "Copy link"; }, 2000);
        }
      });
    }
    dlg._url = url;
    dlg.innerHTML = `
      <div class="join-qr-card">
        <h2 class="join-qr-title" id="join-qr-title">Join ${esc(familyName || "the family")} 👋</h2>
        <p class="join-qr-lead">Point your phone's camera at this, then tap the link that pops up.</p>
        ${qr ? `<div class="join-qr-code">${qr}</div>` : `<p class="join-qr-lead">The QR code couldn't be drawn. Send the link instead.</p>`}
        ${code ? `<p class="join-qr-family-code">Family code <strong>${esc(code)}</strong></p>` : ""}
        <div class="join-qr-actions">
          <button type="button" class="join-qr-btn" data-qr-copy>Copy link</button>
          <button type="button" class="join-qr-btn is-primary" data-qr-close>Done</button>
        </div>
      </div>`;
    if (!dlg.open) dlg.showModal();
  }

  window.JoinQR = { svg, show };
})();
