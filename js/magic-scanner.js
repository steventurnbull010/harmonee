// ============================================================================
// GEMINI MULTIMODAL VISION & AI SCANNERS MODULE (js/magic-scanner.js)
// Recipe Photo Scanner & Calendar Event/Flyer AI Import
// ============================================================================

// ============================================================================
// ADD RECIPE FROM PHOTO (Gemini 1.5 Flash Multimodal Vision Extraction)
// ============================================================================
let currentScannedRecipeData = null;
let currentScannedCalendarEvents = [];

// Guardrail constants: Daily Allowance & Anti-Spam Debounce
const MAX_DAILY_PHOTO_SCANS = 15;
const PHOTO_SCAN_COOLDOWN_MS = 4000;
let isPhotoScanningActive = false;
let lastPhotoScanTimestamp = 0;

// Helper: Track & check daily recipe photo scanning quota
function getDailyPhotoScanQuota() {
  try {
    const todayKey = (typeof getLocalDateKey === "function") 
      ? getLocalDateKey(new Date()) 
      : new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem("turnbull_photo_scan_quota");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === todayKey) {
        return { count: parsed.count || 0, date: todayKey };
      }
    }
    return { count: 0, date: todayKey };
  } catch (e) {
    return { count: 0, date: "today" };
  }
}

function incrementDailyPhotoScanQuota() {
  try {
    const quota = getDailyPhotoScanQuota();
    quota.count += 1;
    localStorage.setItem("turnbull_photo_scan_quota", JSON.stringify(quota));
    return quota.count;
  } catch (e) {
    return 1;
  }
}

// Ultra-compact storage compression for Firestore 1MB doc shield & localStorage quota (~20-25KB)
function compressImageForStorage(dataUrl, maxDimension = 480, quality = 0.65) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith("data:image")) return resolve(dataUrl || "");
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// Helper: compress image using HTML5 Canvas to keep latency low (<2s) and memory lightweight
function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = dataUrl.split(",")[1];
        resolve({ dataUrl, base64Data, mimeType: "image/jpeg" });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Call Gemini 1.5 Flash multimodal vision API to extract recipe structure
async function parseRecipeFromPhoto(base64Data, mimeType = "image/jpeg") {
  const apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;
  const prompt = `You are an expert culinary assistant and OCR recipe parser for a family cookbook app.
Analyze this photo of a cookbook page, recipe card, food packaging, magazine clipping, or handwritten note.
Extract the recipe into clean, structured JSON.

Return ONLY a single valid JSON object with NO markdown formatting, no code fences, no backticks, and no extra commentary.

The JSON object MUST contain:
- "title": Clean, appetizing dish name (e.g. "Grandma's Apple Pie", "Classic Spaghetti Bolognese", "Creamy Tomato Basil Soup")
- "subtitle": Short description or highlight of key flavors/texture (e.g. "Fluffy cinnamon spiced filling with golden flaky butter crust")
- "category": One of ["dinner", "lunch", "breakfast", "snack"]. Default to "dinner" if ambiguous.
- "prepTime": Estimated preparation time (e.g. "15 mins", "20 mins", or "5 mins" if ready-to-eat)
- "cookTime": Estimated cooking time (e.g. "30 mins", "1 hour 15 mins", or "0 mins" / "5 mins" if no cooking required)
- "servings": Number of servings as an integer (e.g. 4)
- "ingredients": Array of ingredient strings with quantities and units where available (e.g. ["500g minced beef", "1 medium onion (diced)", "2 tbsp olive oil"])
- "instructions": Array of step-by-step cooking instruction strings (e.g. ["Preheat oven to 180°C.", "Sauté chopped onions in olive oil until golden.", "Simmer sauce on low heat for 25 minutes."])
- "tags": Array of relevant tags from ["kid-fav", "quick", "veggie", "pasta", "meat", "healthy", "comfort-food"]
- "emoji": One suitable food emoji for this dish (e.g. "🥧", "🍝", "🍗", "🥗", "🥘")

If text is partially obscured or missing details, use your culinary expertise to infer sensible, delicious defaults.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error("No extraction response received from Gemini AI");
  return JSON.parse(rawJson);
}

// Modal Show/Hide Helpers
function openPhotoScanningModal(initialDataUrl = "") {
  const modal = document.getElementById("photo-recipe-scanning-modal");
  if (!modal) return;
  const imgEl = document.getElementById("photo-scan-img-preview");
  if (imgEl) imgEl.src = initialDataUrl || "";
  const titleEl = document.getElementById("photo-scan-title");
  const subEl = document.getElementById("photo-scan-status-text");
  if (titleEl) titleEl.textContent = "Scanning Recipe...";
  if (subEl) subEl.textContent = "Gemini AI is reading ingredients & instructions";

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closePhotoScanningModal() {
  const modal = document.getElementById("photo-recipe-scanning-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function openPhotoReviewModal(recipe) {
  const modal = document.getElementById("photo-recipe-review-modal");
  if (!modal) return;

  const heroImg = document.getElementById("photo-review-hero-img");
  const titleInput = document.getElementById("review-recipe-title");
  const subInput = document.getElementById("review-recipe-subtitle");
  const catSelect = document.getElementById("review-recipe-category");
  const prepInput = document.getElementById("review-recipe-prep");
  const cookInput = document.getElementById("review-recipe-cook");
  const servingsInput = document.getElementById("review-recipe-servings");
  const ingTextarea = document.getElementById("review-recipe-ingredients");
  const instTextarea = document.getElementById("review-recipe-instructions");

  if (heroImg) heroImg.src = recipe.image || recipe.imageUrl || "";
  if (titleInput) titleInput.value = recipe.title || "";
  if (subInput) subInput.value = recipe.subtitle || "";
  if (catSelect) catSelect.value = (recipe.category || recipe.mealType || "dinner").toLowerCase();
  if (prepInput) prepInput.value = recipe.prepTime || "15 mins";
  if (cookInput) cookInput.value = recipe.cookTime || "30 mins";
  if (servingsInput) servingsInput.value = recipe.servings || 4;
  if (ingTextarea) ingTextarea.value = (recipe.ingredients || []).join("\n");
  if (instTextarea) instTextarea.value = (recipe.instructions || []).join("\n");

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closePhotoReviewModal() {
  const modal = document.getElementById("photo-recipe-review-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

// Handle Photo File Selected (from either Camera or Gallery)
async function handleRecipePhotoUpload(file) {
  if (!file) return;

  // Guardrail 1: In-Flight Lock
  if (isPhotoScanningActive) {
    alert("A recipe photo scan is currently running. Please wait for it to finish!");
    return;
  }

  // Guardrail 2: Anti-Spam Cooldown
  const now = Date.now();
  if (now - lastPhotoScanTimestamp < PHOTO_SCAN_COOLDOWN_MS) {
    alert("Please wait a few seconds before scanning another recipe photo.");
    return;
  }

  // Guardrail 3: Daily Scan Allowance Cap (15 scans/day)
  const quota = getDailyPhotoScanQuota();
  if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
    alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
    return;
  }

  // Guardrail 4: File Validation (image type and max 20MB)
  if (!file.type || !file.type.startsWith("image/")) {
    alert("Please select a valid image file (JPEG, PNG, HEIC, or WebP).");
    return;
  }
  const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert("The selected photo is larger than 20MB. Please choose a standard camera photo or screenshot.");
    return;
  }

  isPhotoScanningActive = true;
  openPhotoScanningModal();

  try {
    const { dataUrl, base64Data, mimeType } = await compressImageFile(file, 1280, 0.82);
    const imgEl = document.getElementById("photo-scan-img-preview");
    if (imgEl) imgEl.src = dataUrl;

    const parsed = await parseRecipeFromPhoto(base64Data, mimeType);

    currentScannedRecipeData = {
      id: `custom-${Date.now()}`,
      title: (parsed.title || "Scanned Recipe").trim(),
      subtitle: (parsed.subtitle || "").trim(),
      category: (parsed.category || currentPlanningSlot || "dinner").toLowerCase(),
      mealType: (parsed.category || currentPlanningSlot || "dinner").toLowerCase(),
      prepTime: parsed.prepTime || "15 mins",
      cookTime: parsed.cookTime || "30 mins",
      servings: parseInt(parsed.servings, 10) || 4,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["custom"],
      emoji: parsed.emoji || "🥘",
      image: dataUrl,
      imageUrl: dataUrl,
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // Increment consumed scan count upon successful extraction
    incrementDailyPhotoScanQuota();

    closePhotoScanningModal();
    openPhotoReviewModal(currentScannedRecipeData);

    if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  } catch (err) {
    console.error("Photo recipe extraction error:", err);
    closePhotoScanningModal();
    alert("Could not read recipe details from that photo. Please make sure the photo clearly shows recipe ingredients or steps, and try again!");
  } finally {
    isPhotoScanningActive = false;
    lastPhotoScanTimestamp = Date.now();
  }
}

// Save Recipe from Review Modal
async function saveReviewedPhotoRecipe(andPlan = false) {
  if (!currentScannedRecipeData) return;

  const titleInput = document.getElementById("review-recipe-title");
  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) {
    alert("Please enter a title for this recipe before saving!");
    if (titleInput) titleInput.focus();
    return;
  }

  const subInput = document.getElementById("review-recipe-subtitle");
  const catSelect = document.getElementById("review-recipe-category");
  const prepInput = document.getElementById("review-recipe-prep");
  const cookInput = document.getElementById("review-recipe-cook");
  const servingsInput = document.getElementById("review-recipe-servings");
  const ingTextarea = document.getElementById("review-recipe-ingredients");
  const instTextarea = document.getElementById("review-recipe-instructions");

  const rawIngredients = ingTextarea ? ingTextarea.value.split("\n") : [];
  const cleanedIngredients = rawIngredients
    .map(s => s.trim().replace(/^[-*•\d+\.]\s*/, "").trim())
    .filter(Boolean);

  const rawInstructions = instTextarea ? instTextarea.value.split("\n") : [];
  const cleanedInstructions = rawInstructions
    .map(s => s.trim().replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);

  const prepStr = (prepInput && prepInput.value.trim()) || "15 mins";
  const cookStr = (cookInput && cookInput.value.trim()) || "30 mins";
  const cat = (catSelect && catSelect.value) || "dinner";

  // Compress photo down to ultra-compact storage thumbnail (~20-25KB)
  const storageImg = await compressImageForStorage(currentScannedRecipeData.imageUrl, 480, 0.65);

  const updated = {
    ...currentScannedRecipeData,
    title: title,
    subtitle: (subInput && subInput.value.trim()) || "",
    category: cat,
    mealType: cat,
    prepTime: prepStr,
    cookTime: cookStr,
    servings: (servingsInput && parseInt(servingsInput.value, 10)) || 4,
    ingredients: cleanedIngredients.length > 0 ? cleanedIngredients : ["Ingredients as directed in recipe"],
    instructions: cleanedInstructions.length > 0 ? cleanedInstructions : ["Cook and serve according to recipe steps."],
    totalMinutes: (parseInt(prepStr, 10) || 0) + (parseInt(cookStr, 10) || 0),
    image: storageImg,
    imageUrl: storageImg
  };

  // 1. Add to local custom recipes storage (capped at 50)
  addCustomRecipe(updated);

  // 2. Sync to Firestore boards/turnbull with 1MB Document Shield
  if (db) {
    try {
      const boardDocRef = doc(db, "boards", (window.currentBoardId || "turnbull"));
      const raw = localStorage.getItem(boardCacheKey("turnbull_custom_recipes"));
      let list = [];
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed.filter(r => r && typeof r === "object" && r.id);
        }
      } catch (e) {}
      if (!list.length) list = [updated];
      // Cap at 50
      list = list.slice(0, 50);

      // Firestore 1MB document shield: if total payload exceeds 600KB, prune image data from older entries
      if (JSON.stringify(list).length > 600000) {
        list = list.map((r, idx) => {
          if (idx < 15) return r; // keep photos for 15 most recent
          return { ...r, image: "", imageUrl: "" };
        });
      }

      updateDoc(boardDocRef, {
        customRecipes: list,
        updatedAt: serverTimestamp()
      }).catch(() => {
        setDoc(boardDocRef, { customRecipes: list, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      });
    } catch (e) {}
  }

  closePhotoReviewModal();
  renderDrawerRecipeList();

  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();
  if (typeof showCalendarToast === "function") {
    const remainingScans = Math.max(0, MAX_DAILY_PHOTO_SCANS - getDailyPhotoScanQuota().count);
    const badge = remainingScans <= 3 ? ` (${remainingScans} scans left today)` : "";
    showCalendarToast(`Saved "${updated.title}" to family recipes!${badge}`);
  }

  // 3. If "Save & Add to Plan" was clicked, open the cooking recipe modal pre-filled
  if (andPlan) {
    openCookingRecipeModal(updated, currentPlanningDateStr, cat);
  }
}

// Wire Event Listeners for Add from Photo
function wirePhotoRecipeImportListeners() {
  const btnTrigger = document.getElementById("btn-trigger-add-from-photo");
  const photoMenu = document.getElementById("photo-import-menu");
  const optCamera = document.getElementById("opt-photo-camera");
  const optGallery = document.getElementById("opt-photo-gallery");
  const cameraInput = document.getElementById("recipe-camera-input");
  const galleryInput = document.getElementById("recipe-gallery-input");
  const newEntryPhotoCard = document.getElementById("btn-new-entry-photo-card");

  if (btnTrigger && photoMenu && !btnTrigger.hasAttribute("data-wired")) {
    btnTrigger.setAttribute("data-wired", "true");
    btnTrigger.onclick = (e) => {
      e.stopPropagation();
      const quota = getDailyPhotoScanQuota();
      if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
        alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
        return;
      }
      const isVisible = photoMenu.style.display === "flex";
      photoMenu.style.display = isVisible ? "none" : "flex";
      btnTrigger.setAttribute("aria-expanded", !isVisible ? "true" : "false");
    };

    document.addEventListener("click", (e) => {
      if (photoMenu.style.display === "flex") {
        if (!photoMenu.contains(e.target) && e.target !== btnTrigger) {
          photoMenu.style.display = "none";
          btnTrigger.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  if (optCamera && cameraInput && !optCamera.hasAttribute("data-wired")) {
    optCamera.setAttribute("data-wired", "true");
    optCamera.onclick = (e) => {
      e.stopPropagation();
      if (photoMenu) photoMenu.style.display = "none";
      if (btnTrigger) btnTrigger.setAttribute("aria-expanded", "false");
      cameraInput.click();
    };
  }

  if (optGallery && galleryInput && !optGallery.hasAttribute("data-wired")) {
    optGallery.setAttribute("data-wired", "true");
    optGallery.onclick = (e) => {
      e.stopPropagation();
      if (photoMenu) photoMenu.style.display = "none";
      if (btnTrigger) btnTrigger.setAttribute("aria-expanded", "false");
      galleryInput.click();
    };
  }

  if (cameraInput && !cameraInput.hasAttribute("data-wired")) {
    cameraInput.setAttribute("data-wired", "true");
    cameraInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleRecipePhotoUpload(file);
        cameraInput.value = "";
      }
    };
  }

  if (galleryInput && !galleryInput.hasAttribute("data-wired")) {
    galleryInput.setAttribute("data-wired", "true");
    galleryInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleRecipePhotoUpload(file);
        galleryInput.value = "";
      }
    };
  }

  if (newEntryPhotoCard && !newEntryPhotoCard.hasAttribute("data-wired")) {
    newEntryPhotoCard.setAttribute("data-wired", "true");
    newEntryPhotoCard.onclick = (e) => {
      e.stopPropagation();
      const quota = getDailyPhotoScanQuota();
      if (quota.count >= MAX_DAILY_PHOTO_SCANS) {
        alert(`You've reached today's recipe photo scan limit (${MAX_DAILY_PHOTO_SCANS}/${MAX_DAILY_PHOTO_SCANS}). This protects our family AI quota! You can still add recipes manually or scan more tomorrow.`);
        return;
      }
      if (galleryInput) galleryInput.click();
    };
  }

  // Scanning Modal Cancel
  const btnCancelScan = document.getElementById("btn-cancel-photo-scan");
  if (btnCancelScan && !btnCancelScan.hasAttribute("data-wired")) {
    btnCancelScan.setAttribute("data-wired", "true");
    btnCancelScan.onclick = () => closePhotoScanningModal();
  }

  // Review Modal Buttons
  const btnCloseReview = document.getElementById("btn-close-photo-review");
  const btnCancelReview = document.getElementById("btn-cancel-photo-review");
  const btnSaveRecipe = document.getElementById("btn-save-photo-recipe");
  const btnSaveAndPlan = document.getElementById("btn-save-and-plan-recipe");

  if (btnCloseReview && !btnCloseReview.hasAttribute("data-wired")) {
    btnCloseReview.setAttribute("data-wired", "true");
    btnCloseReview.onclick = () => closePhotoReviewModal();
  }
  if (btnCancelReview && !btnCancelReview.hasAttribute("data-wired")) {
    btnCancelReview.setAttribute("data-wired", "true");
    btnCancelReview.onclick = () => closePhotoReviewModal();
  }
  if (btnSaveRecipe && !btnSaveRecipe.hasAttribute("data-wired")) {
    btnSaveRecipe.setAttribute("data-wired", "true");
    btnSaveRecipe.onclick = () => saveReviewedPhotoRecipe(false);
  }
  if (btnSaveAndPlan && !btnSaveAndPlan.hasAttribute("data-wired")) {
    btnSaveAndPlan.setAttribute("data-wired", "true");
    btnSaveAndPlan.onclick = () => saveReviewedPhotoRecipe(true);
  }
}

// ============================================================================
// SPRINT 3: MAGIC CALENDAR EVENT IMPORT (AI Flyer, Timetable & Schedule Scanner)
// ============================================================================

function openCalendarMagicSourceModal() {
  const modal = document.getElementById("calendar-source-picker-modal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}
window.openCalendarMagicSourceModal = openCalendarMagicSourceModal;

function closeCalendarMagicSourceModal() {
  const modal = document.getElementById("calendar-source-picker-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}
window.closeCalendarMagicSourceModal = closeCalendarMagicSourceModal;

function openCalendarMagicScanningModal(dataUrl = "") {
  const modal = document.getElementById("calendar-magic-scanning-modal");
  if (!modal) return;
  const imgEl = document.getElementById("magic-scan-img-preview");
  if (imgEl) imgEl.src = dataUrl || "";
  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closeCalendarMagicScanningModal() {
  const modal = document.getElementById("calendar-magic-scanning-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function openCalendarMagicReviewModal(events, flyerDataUrl = "", docTitle = "") {
  const modal = document.getElementById("calendar-magic-review-modal");
  if (!modal) return;

  currentScannedCalendarEvents = (events || []).map((evt, idx) => ({
    id: `scan_${Date.now()}_${idx}`,
    title: (evt.title || "Calendar Event").trim(),
    date: evt.date || getLocalDateKey(new Date()),
    day: evt.day || getDayNameFromDateStr(evt.date),
    time: evt.time || "09:00",
    duration: evt.duration || "1 hour",
    member: evt.member || "Family",
    location: evt.location || "",
    category: evt.category || "Other",
    icon: evt.icon || detectEmojiForTitle(evt.title) || "📅",
    notes: evt.notes || "",
    selected: true
  }));

  currentScannedFlyerDataUrl = flyerDataUrl || "";
  currentScannedDocTitle = docTitle || "Paper Schedule / Flyer";

  const docTitleEl = document.getElementById("magic-review-doc-title");
  if (docTitleEl) docTitleEl.textContent = currentScannedDocTitle;

  const flyerThumb = document.getElementById("magic-review-flyer-thumb");
  if (flyerThumb) flyerThumb.src = currentScannedFlyerDataUrl;

  const flyerFull = document.getElementById("magic-flyer-full-img");
  if (flyerFull) flyerFull.src = currentScannedFlyerDataUrl;

  const flyerExpanded = document.getElementById("magic-flyer-expanded-preview");
  if (flyerExpanded) flyerExpanded.style.display = "none";

  renderMagicEventsReviewList();

  if (typeof modal.showModal === "function") {
    try { modal.showModal(); } catch (e) { modal.style.display = "flex"; }
  } else {
    modal.style.display = "flex";
  }
}

function closeCalendarMagicReviewModal() {
  const modal = document.getElementById("calendar-magic-review-modal");
  if (!modal) return;
  if (typeof modal.close === "function") {
    try { modal.close(); } catch (e) { modal.style.display = "none"; }
  } else {
    modal.style.display = "none";
  }
}

function getDayNameFromDateStr(dateStr) {
  if (!dateStr) return "Monday";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return days[d.getDay()] || "Monday";
    }
  } catch (e) {}
  return "Monday";
}

function renderMagicEventsReviewList() {
  const listEl = document.getElementById("magic-events-review-list");
  if (!listEl) return;

  const countBadge = document.getElementById("magic-review-count-badge");
  const subtitleEl = document.getElementById("magic-review-subtitle");
  const confirmBtn = document.getElementById("btn-confirm-magic-import");

  const totalCount = currentScannedCalendarEvents.length;
  const selectedCount = currentScannedCalendarEvents.filter(e => e.selected).length;

  if (countBadge) countBadge.textContent = `Found ${totalCount} event${totalCount === 1 ? "" : "s"}`;
  if (subtitleEl) subtitleEl.textContent = `Found ${totalCount} event${totalCount === 1 ? "" : "s"}. Review or adjust details before adding to your calendar.`;
  if (confirmBtn) {
    confirmBtn.innerHTML = `<span>🪄 Import ${selectedCount} Event${selectedCount === 1 ? "" : "s"} to Calendar</span>`;
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.style.opacity = selectedCount === 0 ? "0.5" : "1";
    confirmBtn.style.cursor = selectedCount === 0 ? "not-allowed" : "pointer";
  }

  if (totalCount === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
        <p style="font-size: 1.1rem; margin-bottom: 8px;">No events in this review list.</p>
        <p style="font-size: 0.85rem;">Tap below to add an event manually or scan another flyer.</p>
      </div>
    `;
    return;
  }

  const members = ["Ava", "Dara", "Steve", "Sorcha", "Family"];

  listEl.innerHTML = currentScannedCalendarEvents.map((evt, idx) => {
    const isUnselected = !evt.selected;
    const dayName = getDayNameFromDateStr(evt.date);
    return `
      <div class="magic-event-card ${isUnselected ? "is-unselected" : ""}" data-idx="${idx}">
        <div class="magic-card-top-row">
          <input type="checkbox" class="magic-event-select-box" data-idx="${idx}" ${evt.selected ? "checked" : ""} title="Include this event">
          <button type="button" class="magic-event-emoji-btn" data-idx="${idx}" title="Change emoji">${evt.icon || "📅"}</button>
          <input type="text" class="magic-event-title-input" data-idx="${idx}" value="${escapeHtml(evt.title)}" placeholder="Event title..." required>
          <button type="button" class="btn-magic-card-delete" data-idx="${idx}" title="Remove this event">✕</button>
        </div>

        <div class="magic-card-meta-row">
          <input type="date" class="magic-event-date-input" data-idx="${idx}" value="${evt.date || ""}" title="Event Date">
          <span style="font-size: 0.8rem; font-weight: 700; color: #7e22ce; padding: 2px 6px; background: rgba(147, 51, 234, 0.08); border-radius: 6px;">${dayName.slice(0, 3)}</span>
          <input type="time" class="magic-event-time-input" data-idx="${idx}" value="${evt.time || "09:00"}" title="Start Time">
          <select class="magic-event-duration-select" data-idx="${idx}" title="Duration">
            <option value="30 mins" ${evt.duration === "30 mins" ? "selected" : ""}>30 mins</option>
            <option value="45 mins" ${evt.duration === "45 mins" ? "selected" : ""}>45 mins</option>
            <option value="1 hour" ${evt.duration === "1 hour" || !evt.duration ? "selected" : ""}>1 hour</option>
            <option value="1.5 hours" ${evt.duration === "1.5 hours" ? "selected" : ""}>1.5 hours</option>
            <option value="2 hours" ${evt.duration === "2 hours" ? "selected" : ""}>2 hours</option>
            <option value="All Day" ${evt.duration === "All Day" ? "selected" : ""}>All Day</option>
          </select>
          <select class="magic-event-category-select" data-idx="${idx}" title="Category">
            <option value="Sports" ${evt.category === "Sports" ? "selected" : ""}>⚽ Sports</option>
            <option value="School" ${evt.category === "School" ? "selected" : ""}>📚 School</option>
            <option value="Music" ${evt.category === "Music" ? "selected" : ""}>🎵 Music</option>
            <option value="Social" ${evt.category === "Social" ? "selected" : ""}>🎉 Social</option>
            <option value="Health" ${evt.category === "Health" ? "selected" : ""}>🏥 Health</option>
            <option value="Other" ${evt.category === "Other" || !evt.category ? "selected" : ""}>📅 Other</option>
          </select>
        </div>

        <div class="magic-card-members-row">
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">Assign to:</span>
          ${members.map(m => `
            <button type="button" class="magic-member-pill ${evt.member === m ? "is-active" : ""}" data-idx="${idx}" data-member="${m}">
              ${m}
            </button>
          `).join("")}
        </div>

        <div class="magic-card-extra-row">
          <input type="text" class="magic-event-location-input" data-idx="${idx}" value="${escapeHtml(evt.location || "")}" placeholder="📍 Location / venue (e.g. Sports Hall, Pitch 2)...">
          <input type="text" class="magic-event-notes-input" data-idx="${idx}" value="${escapeHtml(evt.notes || "")}" placeholder="📝 Notes / kit reminders...">
        </div>
      </div>
    `;
  }).join("");

  // Wire card inputs
  listEl.querySelectorAll(".magic-event-select-box").forEach(box => {
    box.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].selected = e.target.checked;
        const card = listEl.querySelector(`.magic-event-card[data-idx="${idx}"]`);
        if (card) {
          if (e.target.checked) card.classList.remove("is-unselected");
          else card.classList.add("is-unselected");
        }
        const selCount = currentScannedCalendarEvents.filter(x => x.selected).length;
        if (confirmBtn) {
          confirmBtn.innerHTML = `<span>🪄 Import ${selCount} Event${selCount === 1 ? "" : "s"} to Calendar</span>`;
          confirmBtn.disabled = selCount === 0;
          confirmBtn.style.opacity = selCount === 0 ? "0.5" : "1";
          confirmBtn.style.cursor = selCount === 0 ? "not-allowed" : "pointer";
        }
      }
    };
  });

  listEl.querySelectorAll(".magic-event-title-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].title = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-date-input").forEach(input => {
    input.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].date = e.target.value;
        currentScannedCalendarEvents[idx].day = getDayNameFromDateStr(e.target.value);
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-time-input").forEach(input => {
    input.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].time = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-duration-select").forEach(sel => {
    sel.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].duration = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-category-select").forEach(sel => {
    sel.onchange = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].category = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-member-pill").forEach(pill => {
    pill.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(pill.getAttribute("data-idx"), 10);
      const member = pill.getAttribute("data-member");
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].member = member;
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-location-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].location = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".magic-event-notes-input").forEach(input => {
    input.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].notes = e.target.value;
      }
    };
  });

  listEl.querySelectorAll(".btn-magic-card-delete").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (!isNaN(idx)) {
        currentScannedCalendarEvents.splice(idx, 1);
        renderMagicEventsReviewList();
      }
    };
  });

  listEl.querySelectorAll(".magic-event-emoji-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      const emojis = ["📅", "⚽", "🥋", "🏊", "🎤", "📚", "🏥", "🎂", "🏆", "🎨", "🎭", "🍕", "🚗", "✈️"];
      const current = currentScannedCalendarEvents[idx]?.icon || "📅";
      const nextIdx = (emojis.indexOf(current) + 1) % emojis.length;
      const nextEmoji = emojis[nextIdx];
      if (currentScannedCalendarEvents[idx]) {
        currentScannedCalendarEvents[idx].icon = nextEmoji;
        btn.textContent = nextEmoji;
      }
    };
  });
}

function addNewManualReviewEvent() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrow);
  const tomorrowDay = getDayNameFromDateStr(tomorrowKey);

  currentScannedCalendarEvents.push({
    id: `manual_${Date.now()}`,
    title: "",
    date: tomorrowKey,
    day: tomorrowDay,
    time: "16:30",
    duration: "1 hour",
    member: "Ava",
    location: "",
    category: "Other",
    icon: "📅",
    notes: "",
    selected: true
  });

  renderMagicEventsReviewList();

  setTimeout(() => {
    const listEl = document.getElementById("magic-events-review-list");
    if (listEl) {
      const inputs = listEl.querySelectorAll(".magic-event-title-input");
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }
  }, 50);
}

async function handleCalendarPhotoUpload(file) {
  if (!file) return;

  if (isMagicEventScanningActive) {
    alert("A calendar schedule scan is currently in progress. Please wait for it to finish!");
    return;
  }

  const now = Date.now();
  if (now - lastMagicEventScanTimestamp < 2500) {
    alert("Please wait a moment before scanning another flyer.");
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Please select a valid image file (JPEG, PNG, HEIC, or WebP).");
    return;
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    alert("The selected image is larger than 20MB. Please use a standard camera photo or screenshot.");
    return;
  }

  isMagicEventScanningActive = true;
  closeCalendarMagicSourceModal();

  try {
    const { dataUrl, base64Data, mimeType } = await compressImageFile(file, 1400, 0.85);
    openCalendarMagicScanningModal(dataUrl);

    const result = await parseCalendarEventsFromPhoto(base64Data, mimeType);

    closeCalendarMagicScanningModal();

    if (!result || !Array.isArray(result.events) || result.events.length === 0) {
      alert("We couldn't detect any specific dates or event times in that photo. Please make sure the photo is sharp, well-lit, and shows the schedule details clearly!");
      return;
    }

    openCalendarMagicReviewModal(result.events, dataUrl, result.documentTitle || "Paper Schedule");
    if (typeof sfx !== "undefined" && sfx && sfx.playSuccess) sfx.playSuccess();
  } catch (err) {
    console.error("Calendar schedule photo extraction error:", err);
    closeCalendarMagicScanningModal();
    alert("Could not read schedule details from that photo. Please try again with a clear photo in good light!");
  } finally {
    isMagicEventScanningActive = false;
    lastMagicEventScanTimestamp = Date.now();
  }
}

async function parseCalendarEventsFromPhoto(base64Data, mimeType = "image/jpeg") {
  const apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;
  const todayIso = getLocalDateKey(new Date());
  const curYear = new Date().getFullYear();

  const prompt = `You are an expert OCR and schedule parser for a family calendar app (The Turnbull Family: Steve, Sorcha, Ava, Dara).
Current reference date today is: ${todayIso}. The current year is ${curYear}.

Analyze this photo of a school newsletter, extracurricular club timetable, sports match schedule/fixtures, birthday party invitation, appointment card, or calendar handout.
Extract ALL distinct events and activities mentioned in the document into structured JSON.

Return ONLY a single valid JSON object with NO markdown formatting, no code fences, no backticks, and no extra commentary.

The JSON object MUST have the following structure:
{
  "documentTitle": "Brief title of flyer or schedule (e.g., 'Spring Football Fixtures', 'St. Peters Term Dates', 'Swim Club')",
  "events": [
    {
      "title": "Clear concise event title (e.g., 'Ava Swimming Gala', 'Dara Football vs St Peters', 'Parents Evening', 'Karate Grading')",
      "date": "YYYY-MM-DD",
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "time": "HH:MM (24-hour format, e.g. '09:30', '15:15', '18:00'. If all-day or time unspecified, use '09:00')",
      "duration": "1 hour" (or '30 mins', '45 mins', '1.5 hours', '2 hours', 'All Day'),
      "member": "Ava" | "Dara" | "Steve" | "Sorcha" | "Family",
      "location": "Location or venue if mentioned (e.g. 'Sports Hall', 'Pitch 3'), otherwise empty string",
      "category": "Sports" | "School" | "Social" | "Music" | "Health" | "Other",
      "icon": "One relevant emoji (e.g. ⚽, 🥋, 🏊, 🎤, 📚, 🏥, 🎂, 🏆, 🎨, 🎭, 📅)",
      "notes": "Short note of kit/equipment, reminders or notes mentioned, otherwise empty string"
    }
  ]
}

Important Instructions:
1. Date parsing: If only day and month are listed (e.g. 'Saturday 14 Nov', '14th November'), resolve to the full 'YYYY-MM-DD' using current year ${curYear} (or ${curYear + 1} if that date has already passed).
2. Turnbull Family member matching:
   - 'Ava': girls' sports, ballet, singing, choir, dance, secondary school activities for Ava.
   - 'Dara': boys' sports, football, rugby, karate, primary/prep school activities for Dara.
   - 'Steve' / 'Sorcha': parents meetings, adult medical/social appointments.
   - 'Family': whole family events, school holidays, term start/end dates, joint social gatherings.
3. If no specific events or dates can be found, return { "documentTitle": "", "events": [] }.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new Error("No schedule extraction response received from Gemini AI");
  let cleanJson = rawJson.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return JSON.parse(cleanJson);
}

function confirmAndImportMagicEvents() {
  const selected = currentScannedCalendarEvents.filter(x => x.selected);
  if (selected.length === 0) {
    alert("Please select at least one event to import!");
    return;
  }

  const newEvents = selected.map(item => ({
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: (item.title || "Calendar Event").trim(),
    date: item.date || getLocalDateKey(new Date()),
    day: item.day || getDayNameFromDateStr(item.date),
    time: item.time || "09:00",
    duration: item.duration || "1 hour",
    repeat: "none",
    member: item.member || "Family",
    description: [item.location ? `📍 ${item.location}` : "", item.notes ? `📝 ${item.notes}` : ""].filter(Boolean).join(" • "),
    location: item.location || "",
    icon: item.icon || detectEmojiForTitle(item.title) || "📅",
    category: item.category || "Other"
  }));

  if (!window.familyEvents) window.familyEvents = loadFamilyEvents();
  window.familyEvents = (window.familyEvents || []).concat(newEvents);
  saveFamilyEvents(window.familyEvents || []);

  if (typeof renderWeekCalendar === "function") renderWeekCalendar();

  closeCalendarMagicReviewModal();

  if (typeof sfx !== "undefined" && sfx && sfx.playCelebrationChime) sfx.playCelebrationChime();

  if (typeof confetti === "function") {
    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }

  if (typeof showCalendarToast === "function") {
    showCalendarToast(`✨ Imported ${newEvents.length} event${newEvents.length === 1 ? "" : "s"} to Turnbull Calendar!`);
  }
}

function wireCalendarMagicImportListeners() {
  const btnHeaderScan = document.getElementById("btn-calendar-magic-scan");
  const fabBtnMagicImport = document.getElementById("fab-action-magic-import");
  const btnEventModalScan = document.getElementById("btn-event-magic-scan");

  const btnCloseSource = document.getElementById("btn-close-magic-source");
  const btnCameraSource = document.getElementById("btn-magic-source-camera");
  const btnGallerySource = document.getElementById("btn-magic-source-gallery");

  const cameraInput = document.getElementById("calendar-camera-input");
  const galleryInput = document.getElementById("calendar-gallery-input");

  const btnCancelScan = document.getElementById("btn-cancel-magic-scan");

  const btnCloseReview = document.getElementById("btn-close-magic-review");
  const btnCancelReview = document.getElementById("btn-cancel-magic-review");
  const btnToggleFlyer = document.getElementById("btn-toggle-flyer-preview");
  const btnSelectAll = document.getElementById("btn-magic-select-all");
  const btnAddAnother = document.getElementById("btn-magic-add-another");
  const btnConfirmImport = document.getElementById("btn-confirm-magic-import");

  if (btnHeaderScan && !btnHeaderScan.hasAttribute("data-wired")) {
    btnHeaderScan.setAttribute("data-wired", "true");
    btnHeaderScan.onclick = (e) => {
      e.preventDefault();
      openCalendarMagicSourceModal();
    };
  }

  if (fabBtnMagicImport && !fabBtnMagicImport.hasAttribute("data-wired")) {
    fabBtnMagicImport.setAttribute("data-wired", "true");
    fabBtnMagicImport.onclick = (e) => {
      e.preventDefault();
      const fabContainer = document.getElementById("calendar-fab-container");
      const fabBackdrop = document.getElementById("calendar-fab-backdrop");
      if (fabContainer) fabContainer.classList.remove("is-open");
      if (fabBackdrop) fabBackdrop.classList.remove("is-active");
      document.body.classList.remove("has-fab-open");
      openCalendarMagicSourceModal();
    };
  }

  if (btnEventModalScan && !btnEventModalScan.hasAttribute("data-wired")) {
    btnEventModalScan.setAttribute("data-wired", "true");
    btnEventModalScan.onclick = (e) => {
      e.preventDefault();
      const eventModal = document.getElementById("event-modal");
      if (eventModal) {
        if (typeof eventModal.close === "function") eventModal.close();
        else eventModal.removeAttribute("open");
      }
      openCalendarMagicSourceModal();
    };
  }

  if (btnCloseSource && !btnCloseSource.hasAttribute("data-wired")) {
    btnCloseSource.setAttribute("data-wired", "true");
    btnCloseSource.onclick = () => closeCalendarMagicSourceModal();
  }

  if (btnCameraSource && cameraInput && !btnCameraSource.hasAttribute("data-wired")) {
    btnCameraSource.setAttribute("data-wired", "true");
    btnCameraSource.onclick = (e) => {
      e.preventDefault();
      closeCalendarMagicSourceModal();
      cameraInput.click();
    };
  }

  if (btnGallerySource && galleryInput && !btnGallerySource.hasAttribute("data-wired")) {
    btnGallerySource.setAttribute("data-wired", "true");
    btnGallerySource.onclick = (e) => {
      e.preventDefault();
      closeCalendarMagicSourceModal();
      galleryInput.click();
    };
  }

  if (cameraInput && !cameraInput.hasAttribute("data-wired")) {
    cameraInput.setAttribute("data-wired", "true");
    cameraInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleCalendarPhotoUpload(file);
        cameraInput.value = "";
      }
    };
  }

  if (galleryInput && !galleryInput.hasAttribute("data-wired")) {
    galleryInput.setAttribute("data-wired", "true");
    galleryInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleCalendarPhotoUpload(file);
        galleryInput.value = "";
      }
    };
  }

  if (btnCancelScan && !btnCancelScan.hasAttribute("data-wired")) {
    btnCancelScan.setAttribute("data-wired", "true");
    btnCancelScan.onclick = () => {
      isMagicEventScanningActive = false;
      closeCalendarMagicScanningModal();
    };
  }

  if (btnCloseReview && !btnCloseReview.hasAttribute("data-wired")) {
    btnCloseReview.setAttribute("data-wired", "true");
    btnCloseReview.onclick = () => closeCalendarMagicReviewModal();
  }

  if (btnCancelReview && !btnCancelReview.hasAttribute("data-wired")) {
    btnCancelReview.setAttribute("data-wired", "true");
    btnCancelReview.onclick = () => closeCalendarMagicReviewModal();
  }

  if (btnToggleFlyer && !btnToggleFlyer.hasAttribute("data-wired")) {
    btnToggleFlyer.setAttribute("data-wired", "true");
    btnToggleFlyer.onclick = (e) => {
      e.preventDefault();
      const preview = document.getElementById("magic-flyer-expanded-preview");
      if (preview) {
        const isHidden = preview.style.display === "none";
        preview.style.display = isHidden ? "block" : "none";
        btnToggleFlyer.innerHTML = isHidden ? "<span>🔼 Hide Photo</span>" : "<span>🔍 View Original Photo</span>";
      }
    };
  }

  if (btnSelectAll && !btnSelectAll.hasAttribute("data-wired")) {
    btnSelectAll.setAttribute("data-wired", "true");
    btnSelectAll.onclick = (e) => {
      e.preventDefault();
      const allSelected = currentScannedCalendarEvents.every(x => x.selected);
      currentScannedCalendarEvents.forEach(x => { x.selected = !allSelected; });
      btnSelectAll.textContent = allSelected ? "Select All" : "Deselect All";
      renderMagicEventsReviewList();
    };
  }

  if (btnAddAnother && !btnAddAnother.hasAttribute("data-wired")) {
    btnAddAnother.setAttribute("data-wired", "true");
    btnAddAnother.onclick = (e) => {
      e.preventDefault();
      addNewManualReviewEvent();
    };
  }

  if (btnConfirmImport && !btnConfirmImport.hasAttribute("data-wired")) {
    btnConfirmImport.setAttribute("data-wired", "true");
    btnConfirmImport.onclick = (e) => {
      e.preventDefault();
      confirmAndImportMagicEvents();
    };
  }
}
window.wireCalendarMagicImportListeners = wireCalendarMagicImportListeners;


window.parseRecipeFromPhoto = parseRecipeFromPhoto;
window.handleRecipePhotoUpload = handleRecipePhotoUpload;
window.saveReviewedPhotoRecipe = saveReviewedPhotoRecipe;
window.wirePhotoRecipeImportListeners = wirePhotoRecipeImportListeners;
window.handleCalendarPhotoUpload = handleCalendarPhotoUpload;
window.parseCalendarEventsFromPhoto = parseCalendarEventsFromPhoto;
window.confirmAndImportMagicEvents = confirmAndImportMagicEvents;
