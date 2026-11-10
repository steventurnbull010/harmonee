// ============================================================================
// DISH PHOTOS FOR YOUR OWN RECIPES (js/recipe-photos.js)
// A family recipe can have a photo of the finished dish (the recipe form's
// "Photo of the dish"). It's shrunk on the device to about 100KB and kept in
// its own document, boards/{board}/recipePhotos/{recipeId} (firestore.rules),
// so the board document stays small. The recipe itself only remembers that it
// has one: photo: { rev } (a new rev each time it changes).
//
// Other devices fetch a photo the first time they need it and keep a copy on
// the device; until then the recipe shows its stand-in (js/recipe-stock.js).
// ============================================================================
(function () {
  const MAX_PX = 900;
  const MAX_CHARS = 380000; // firestore.rules allows 400,000
  const memory = new Map(); // `${id}:${rev}` -> data URL
  const loading = new Set();
  const cacheKey = (id) => `harmonee_recipe_photo_${window.currentBoardId || "board"}_${id}`;
  const isDataUrl = (s) => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(s || ""));

  function photoRef(id) {
    if (!window.db || typeof window.doc !== "function" || !window.currentBoardId) return null;
    return window.doc(window.db, "boards", window.currentBoardId, "recipePhotos", String(id));
  }

  // The photo for a recipe, if this device has it; otherwise starts fetching it
  function url(recipe) {
    const rev = recipe && recipe.photo && recipe.photo.rev;
    if (!rev) return "";
    const key = `${recipe.id}:${rev}`;
    if (memory.has(key)) return memory.get(key);
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey(recipe.id)) || "null");
      if (saved && saved.rev === rev && isDataUrl(saved.data)) { memory.set(key, saved.data); return saved.data; }
    } catch (e) {}
    fetchPhoto(recipe.id, rev);
    return "";
  }

  function remember(id, rev, data) {
    memory.set(`${id}:${rev}`, data);
    try { localStorage.setItem(cacheKey(id), JSON.stringify({ rev, data })); } catch (e) { /* full: memory only */ }
  }

  async function fetchPhoto(id, rev) {
    const key = `${id}:${rev}`;
    const ref = photoRef(id);
    if (!ref || loading.has(key) || typeof window.getDoc !== "function") return;
    loading.add(key);
    try {
      const snap = await window.getDoc(ref);
      const data = snap && snap.exists && snap.exists() ? (snap.data() || {}).data : "";
      if (isDataUrl(data)) {
        remember(id, rev, data);
        document.dispatchEvent(new CustomEvent("harmonee:recipe-photo", { detail: { id } }));
      }
    } catch (e) {
      console.warn("Couldn't load a recipe photo:", e);
    } finally {
      loading.delete(key);
    }
  }

  // A photo file, shrunk to a JPEG data URL small enough to store
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(src);
        let px = MAX_PX, q = 0.72, out = "";
        for (let i = 0; i < 6; i++) {
          const scale = Math.min(1, px / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", q);
          if (out.length <= MAX_CHARS) break;
          px = Math.round(px * 0.8); q = Math.max(0.5, q - 0.06);
        }
        if (out.length > MAX_CHARS) { reject(new Error("That photo is too big to save. Try another.")); return; }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("That file isn't a photo harmonee can read.")); };
      img.src = src;
    });
  }

  // Saved with the recipe (js/family-recipes.js submit): returns the new rev
  async function save(id, dataUrl, rev = Date.now()) {
    remember(id, rev, dataUrl);
    const ref = photoRef(id);
    if (ref && typeof window.setDoc === "function") {
      const payload = { data: dataUrl };
      if (typeof window.serverTimestamp === "function") payload.updatedAt = window.serverTimestamp();
      await window.setDoc(ref, payload);
    }
    return rev;
  }

  async function remove(id) {
    try { localStorage.removeItem(cacheKey(id)); } catch (e) {}
    const ref = photoRef(id);
    if (ref && typeof window.deleteDoc === "function") {
      try { await window.deleteDoc(ref); } catch (e) { console.warn("Couldn't delete a recipe photo:", e); }
    }
  }

  // A photo arrived: redraw what shows recipe photos
  document.addEventListener("harmonee:recipe-photo", () => {
    if (window.RecipeBrowse) window.RecipeBrowse.refresh();
    if (typeof window.renderDrawerRecipeList === "function") window.renderDrawerRecipeList();
    const meals = document.getElementById("view-meals");
    if (meals && meals.style.display !== "none" && typeof window.renderMealsView === "function") window.renderMealsView();
  });

  window.RecipePhotos = { url, shrink, save, remove, isDataUrl, MAX_CHARS };
})();
