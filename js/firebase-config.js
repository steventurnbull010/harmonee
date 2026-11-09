// ============================================================================
// FIREBASE SETTINGS (js/firebase-config.js)
// Shared by the app (app.js) and the list-only page (list.html). The web key
// is public by design: access is controlled by firestore.rules (and, once set
// up, the key's site restrictions in the Google Cloud console).
// ============================================================================
export const DEFAULT_FIREBASE_CONFIG = {
  projectId: "harmonee-app",
  appId: "1:344148325793:web:4e6f27fa8e15d5082087e0",
  storageBucket: "harmonee-app.firebasestorage.app",
  apiKey: "AIzaSyCOkZ_BlVEgW8K9paG_L-JLrgtTzfgRzNQ",
  authDomain: "harmonee-app.firebaseapp.com",
  messagingSenderId: "344148325793"
};

// App Check (reCAPTCHA v3): proves requests come from harmonee itself, so
// nobody can use the board's Firebase or AI allowance from elsewhere. The site
// key is public by design (the secret one lives only in the Firebase console).
// Only on harmonee's own web addresses: anywhere else (this Mac, the build
// check, the smoke test) there's no valid token to get.
export const APP_CHECK_SITE_KEY = "6LcMWxguAAAAAGq8dNNjqLCW6TMfXxoE8B4oivhN";
export function appCheckWanted() {
  return typeof location !== "undefined" && /^harmonee-app\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
}
