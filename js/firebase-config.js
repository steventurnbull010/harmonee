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

// App Check: proves requests come from harmonee itself, so nobody can use the
// board's Firebase or AI allowance from elsewhere. A Fraud Defense
// (reCAPTCHA Enterprise) key made in the Google Cloud console for harmonee-app
// and registered in Firebase App Check (token 6 hours, risk Medium). The key
// is public by design. app.js and js/magic-import.js use ReCaptchaEnterpriseProvider.
export const APP_CHECK_SITE_KEY = "6LcqpBguAAAAAE_FO9qsgSFoHcIdksbyQtPzjQyF"; // Fraud Defense key "harmonee web" (9 Nov), public by design
export function appCheckWanted() {
  return !!APP_CHECK_SITE_KEY && typeof location !== "undefined" && /^harmonee-app\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
}
