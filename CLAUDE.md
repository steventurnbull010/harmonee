# harmonee — Architecture & Project Guide

> **Family Life in Sync** — A tablet-first, real-time smart family dashboard inspired by the Skylight Calendar 15" Max hardware experience, built as a high-performance modern web app with Firebase.

---

## 🎯 Project Vision: The Skylight Philosophy
**harmonee** is built to replicate and elevate the physical smart family display experience (like the Skylight Calendar / Skylight 15" Max) into an open, responsive, real-time web application.

Key device paradigms:
1. **Always-On Kitchen / Living Room Display**: Designed for mounted iPad, Android tablets, or touch monitors running 24/7.
2. **Multi-Profile Color System**: Every family member has an assigned Skylight pastel color palette (Steven = Warm Ochre, Sorcha = Periwinkle, Ava = Coral Pink, Dara = Spring Green, Up for Grabs = Red).
3. **5 Core Skylight Hubs**:
   - 🗓️ **Calendar**: 8-column week view, 3-day schedule with zoomable hourly timeline, day view, and monthly grid.
   - 📋 **Tasks / Routines**: Multi-column profile board split by routine slots (☀️ Morning, ⛅ Afternoon, 🌙 Evening, standard chores), swipe gestures, audio chimes, and confetti.
   - 🍽️ **Meals**: 4-Tier weekly meal matrix with recipe drawer, dinner themes, and grocery synchronization.
   - 📝 **Lists**: Shared family checklists (groceries, packing, errands) with instant live check-offs.
   - 🏆 **Rewards / Podium**: 3D pastel pillars, weekly points / allowance ledger, and streak badges.
4. **Ambient Night Clock**: Scheduled lights-out overlay that dims the room overnight and automatically wakes in the morning with live weather.

---

## 🏗️ Codebase Structure

The project has been modularized into domain stylesheets and standalone JavaScript ES modules with clean separation of concerns:

```
harmonee/
├── index.html               # Main single-page application shell
├── app.js                   # Application coordinator, routing, and Firebase listeners
├── style.css                # Core design system tokens, typography, CSS variables
├── css/                     # 10 Domain-Specific Stylesheets
│   ├── navigation.css       # Skylight left-dock sidebar
│   ├── calendar.css         # Timeline grid, schedule cards, date badges
│   ├── tasks.css            # Multi-column profile cards, swipe animations
│   ├── meals.css            # Meal matrix, dinner drawers
│   ├── lists.css            # Checklist rows and grocery sync
│   ├── rewards.css          # Podium pillars, standings
│   ├── modals.css           # Dialogs, popovers, scroll locks
│   ├── widgets.css          # Live weather, clocks, battery status
│   ├── magic-ai.css         # Gemini AI multimodal recipe/flyer scanner
│   └── celebrations.css     # Confetti, burst particles, completion badges
├── js/                      # 12 Independent Domain Modules
│   ├── utils.js             # Core string escaping, date formatting, routine helpers
│   ├── seed-data.js         # Offline Turnbull & starter datasets
│   ├── audio.js             # Web Audio API synthesizer chimes & sound effects
│   ├── weather.js           # Live Open-Meteo & wttr.in weather providers
│   ├── sleep.js             # Overnight ambient clock & light/dark theme engine
│   ├── lists.js             # Family Shared Lists & grocery items
│   ├── magic-scanner.js     # Gemini AI vision OCR for meals & chores
│   ├── meals.js             # Weekly meal planning matrix & dinner drawer
│   ├── rewards.js           # Podium leaderboard & allowance tracker
│   ├── sticky-note.js       # Household pinboard sticky note
│   ├── calendar.js          # Skylight multi-view calendar engine
│   └── tasks.js             # Multi-column profiles board & drawer
├── scripts/
│   └── verify-build.js      # Zero-dependency AST/syntax verification script
├── firebase.json            # Firebase Hosting & Firestore configuration
└── .firebaserc              # Target: harmonee-app
```

---

## ⚡ Tech Stack & Rules

1. **Framework-Free Performance**: Pure vanilla JS + HTML5 + CSS3. Zero bundlers (no Webpack, Vite, or npm build step required). Every file runs natively in modern browsers.
2. **Live Backend**: Firebase Firestore (Web SDK v10 Modular CDN) with instant offline cache fallback via `localStorage`.
3. **Multi-Tenancy**: The Turnbull family board is accessible at `?board=turnbull`. Other households can create separate boards via `?board=<unique_name>`.
4. **Pre-Deploy Verification**: Before deploying to Firebase Hosting, always run:
   ```bash
   node scripts/verify-build.js
   ```
   to guarantee zero syntax errors and clean module interoperability.
5. **Live Deployment**:
   ```bash
   npx firebase-tools deploy --only hosting --project harmonee-app
   ```
   Live at: https://harmonee-app.web.app/?board=turnbull
