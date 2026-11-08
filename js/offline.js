// ============================================================================
// OFFLINE (js/offline.js)
// harmonee keeps working without a connection: changes are saved on the
// device (Firestore's offline storage, the lists queue) and sync when the
// signal comes back. This file:
//  - shows a small "Offline" pill while the device has no connection, so
//    nobody wonders why the other devices haven't caught up
//  - gives the few things that really need the internet (voice to words,
//    Magic Import, weather search, joining or setting up a family) one
//    friendly message instead of a confusing failure:
//      if (window.needsInternet("Magic Import")) return;
//  - window.isOffline() for anything else that wants to check
// A weak signal still counts as "online" to the browser, so features that
// talk to the internet should also handle slow or failed requests.
// ============================================================================
(function () {
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

  function pill() {
    let el = document.getElementById("offline-pill");
    if (!el) {
      el = document.createElement("div");
      el.id = "offline-pill";
      el.className = "offline-pill";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg><span class="offline-pill-text"><strong>Offline</strong> · changes will sync later</span>`;
      el.addEventListener("click", () => el.classList.toggle("is-short"));
      document.body.appendChild(el);
    }
    return el;
  }

  let backTimer = null;
  function update() {
    if (!document.body) return;
    const el = pill();
    clearTimeout(backTimer);
    if (isOffline()) {
      el.classList.remove("is-back");
      el.querySelector(".offline-pill-text").innerHTML = "<strong>Offline</strong> · changes will sync later";
      el.classList.add("is-showing");
    } else if (el.classList.contains("is-showing")) {
      // Back online: say so briefly, then tuck away
      el.classList.add("is-back");
      el.querySelector(".offline-pill-text").innerHTML = "<strong>Back online</strong> · syncing";
      backTimer = setTimeout(() => el.classList.remove("is-showing", "is-back"), 2500);
    }
  }

  // "Magic Import needs the internet": a short message, and true if offline
  function needsInternet(what) {
    if (!isOffline()) return false;
    const msg = `${what} needs the internet. Try again when you're back online.`;
    if (typeof window.showCalendarToast === "function") window.showCalendarToast(`📶 ${msg}`);
    else alert(msg);
    return true;
  }

  // A fetch that failed because of the connection (rather than a bad reply)
  function isNetworkError(err) {
    return isOffline() || (err && (err.name === "TypeError" || err.name === "AbortError" || /network|failed to fetch|load failed|offline|unavailable/i.test(String(err.message || err.code || ""))));
  }

  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update); else update();

  window.isOffline = isOffline;
  window.needsInternet = needsInternet;
  window.isNetworkError = isNetworkError;
})();
