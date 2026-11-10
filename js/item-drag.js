// ============================================================================
// PRESS, HOLD AND DRAG (js/item-drag.js)
// One way of picking something up and putting it somewhere else, with the
// same look as dragging a job on the Tasks board: while dragging, the rest of
// the page fades and blurs a little, every place it can go gets a dashed
// outline, the one under the finger fills in, and a small label by the finger
// says what letting go will do ("Thu 12 Nov · 4:30pm").
//
// Touch: press and hold (300ms), then drag; moving before that is a scroll.
// Mouse: press and move a few pixels. A plain tap or click still works as
// before (the click after a drag is swallowed).
//
//   ItemDrag.attach(root, {
//     itemSelector,                 // what can be picked up (inside root)
//     canDrag(item) -> bool,
//     start(item) -> { zones: [el], origin: el|null } | null,
//     hit(ctx, x, y, under) -> zone|null    (optional; default: the zone under the finger)
//     label(ctx, zone, x, y) -> string      (optional; the label by the finger)
//     drop(ctx, zone, x, y)
//     scroller: el | () => el       (optional; scrolls up/down near its edges)
//     end(ctx)                      (optional; after every drag, dropped or not)
//   })
// Styles: css/item-drag.css. Used by the calendar (js/calendar-drag.js).
// ============================================================================
(function () {
  const HOLD_MS = 300;
  const MOVE_CANCEL_PX = 10;
  const MOUSE_START_PX = 6;
  const EDGE_PX = 56;
  let st = null;             // the drag in progress (or waiting for the hold)
  let swallowClickUntil = 0;

  // The click a browser fires right after a drag isn't a tap
  document.addEventListener("click", (e) => {
    if (Date.now() < swallowClickUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  function attach(root, opts) {
    if (!root || root.__itemDrag) return;
    root.__itemDrag = true;

    root.addEventListener("touchstart", (e) => {
      if (st || e.touches.length !== 1) return;
      const item = e.target.closest(opts.itemSelector);
      if (!item || !root.contains(item) || (opts.canDrag && !opts.canDrag(item))) return;
      const t = e.touches[0];
      const pending = { opts, item, startX: t.clientX, startY: t.clientY, x: t.clientX, y: t.clientY, touch: true };
      pending.timer = setTimeout(() => begin(pending), HOLD_MS);
      st = pending;
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
      document.addEventListener("touchcancel", onTouchCancel);
    }, { passive: true });

    root.addEventListener("mousedown", (e) => {
      if (st || e.button !== 0) return;
      const item = e.target.closest(opts.itemSelector);
      if (!item || !root.contains(item) || (opts.canDrag && !opts.canDrag(item))) return;
      st = { opts, item, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, touch: false };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  // ---- Touch ------------------------------------------------------------------------
  function onTouchMove(e) {
    if (!st) return;
    const t = e.touches[0];
    st.x = t.clientX; st.y = t.clientY;
    if (!st.active) {
      // Moved before the hold finished: a scroll or swipe, not a drag
      if (Math.hypot(st.x - st.startX, st.y - st.startY) > MOVE_CANCEL_PX) cleanupListeners(true);
      return;
    }
    e.preventDefault();
    move(st.x, st.y);
  }
  function onTouchEnd() {
    if (!st) return;
    if (st.active) finish(true); else cleanupListeners(true);
  }
  function onTouchCancel() { if (st) finish(false); }

  // ---- Mouse ------------------------------------------------------------------------
  function onMouseMove(e) {
    if (!st) return;
    st.x = e.clientX; st.y = e.clientY;
    if (!st.active) {
      if (Math.hypot(st.x - st.startX, st.y - st.startY) < MOUSE_START_PX) return;
      begin(st);
      if (!st || !st.active) return;
    }
    e.preventDefault();
    move(st.x, st.y);
  }
  function onMouseUp() {
    if (!st) return;
    if (st.active) finish(true); else cleanupListeners(true);
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && st && st.active) finish(false); });
  window.addEventListener("blur", () => { if (st && st.active) finish(false); });

  // ---- The drag ---------------------------------------------------------------------
  function begin(s) {
    if (st !== s) return;
    const setup = s.opts.start ? s.opts.start(s.item) : null;
    if (!setup || !setup.zones || !setup.zones.length) { cleanupListeners(true); return; }
    const rect = s.item.getBoundingClientRect();
    s.zones = setup.zones;
    s.origin = setup.origin || null;
    s.data = setup.data || {};
    s.grabX = s.startX - rect.left;
    s.grabY = s.startY - rect.top;
    s.itemHeight = rect.height;

    const ghost = s.item.cloneNode(true);
    ghost.classList.add("item-drag-ghost");
    ghost.removeAttribute("id");
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    document.body.appendChild(ghost);
    s.ghost = ghost;

    const hint = document.createElement("div");
    hint.className = "item-drag-hint";
    hint.setAttribute("role", "status");
    document.body.appendChild(hint);
    s.hint = hint;

    s.item.classList.add("is-drag-source");
    if (s.origin) s.origin.classList.add("is-drag-origin");
    s.zones.forEach(z => z.classList.add("is-drop-zone"));
    document.body.classList.add("is-item-dragging");
    s.active = true;
    if (navigator.vibrate) navigator.vibrate(15);
    move(s.x, s.y);
  }

  function move(x, y) {
    const s = st;
    if (!s || !s.active) return;
    s.ghost.style.left = (x - s.grabX) + "px";
    s.ghost.style.top = (y - s.grabY) + "px";

    // Near the top or bottom of a scrolling area: scroll it
    const scroller = typeof s.opts.scroller === "function" ? s.opts.scroller() : s.opts.scroller;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (x >= r.left && x <= r.right) {
        if (y < r.top + EDGE_PX) scroller.scrollTop -= 12;
        else if (y > r.bottom - EDGE_PX) scroller.scrollTop += 12;
      }
    }

    const under = document.elementFromPoint(x, y);
    let zone = s.opts.hit ? s.opts.hit(s, x, y, under) : (under ? s.zones.find(z => z.contains(under)) || null : null);
    if (zone && !s.zones.includes(zone)) zone = null;
    if (zone !== s.zone) {
      if (s.zone) s.zone.classList.remove("is-drop-target");
      if (zone) zone.classList.add("is-drop-target");
      s.zone = zone;
    }
    const text = zone && s.opts.label ? s.opts.label(s, zone, x, y) : "";
    s.hint.textContent = text;
    s.hint.classList.toggle("is-on", !!text);
    // Above the item, and never off the side of the screen
    const half = (s.hint.offsetWidth || 0) / 2;
    s.hint.style.left = Math.max(half + 8, Math.min(window.innerWidth - half - 8, x)) + "px";
    s.hint.style.top = Math.max(s.hint.offsetHeight + 8, y - s.grabY - 12) + "px";
  }

  function finish(dropIt) {
    const s = st;
    if (!s) return;
    const zone = dropIt ? s.zone : null;
    if (s.ghost) s.ghost.remove();
    if (s.hint) s.hint.remove();
    s.item.classList.remove("is-drag-source");
    if (s.origin) s.origin.classList.remove("is-drag-origin");
    (s.zones || []).forEach(z => z.classList.remove("is-drop-zone", "is-drop-target"));
    document.body.classList.remove("is-item-dragging");
    swallowClickUntil = Date.now() + 400;
    cleanupListeners(false);
    if (zone) {
      try { s.opts.drop(s, zone, s.x, s.y); } catch (err) { console.warn("Couldn't move it:", err); }
    }
    // Tidy up whatever start() added (dropped or not)
    if (s.opts.end) { try { s.opts.end(s); } catch (err) {} }
  }

  function cleanupListeners(clearState) {
    if (st && st.timer) clearTimeout(st.timer);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchCancel);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    st = null;
  }

  window.ItemDrag = { attach, isDragging: () => !!(st && st.active) };
})();
