# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Family planning app (French UI/domain names): shared calendar, a shopping list where kids propose items and a parent approves, chores with points, and birthday/Christmas wish lists with secret gift reservations. React 18 + Vite, optionally backed by Firebase (Auth anonymous + Firestore + Cloud Messaging). Without Firebase env vars, the app runs in a local-only "mode test" (data in `localStorage`), which is the default for a fresh checkout.

## Commands

- `npm run dev` — start Vite dev server (`--host`, so it's reachable from phones on the LAN)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run rappels` — run `scripts/envoyer-rappels.js` once locally (needs `FIREBASE_SERVICE_ACCOUNT` env var with the full service-account JSON)

There is no lint, format, or test command configured in this repo — don't invent one.

## Architecture

### Data layer: `src/db.js`
Every feature goes through this single module, never through Firestore SDK calls elsewhere. It exposes a small collection-agnostic API: `subscribe(col, cb, onError)`, `add`, `update`, `set`, `remove`, `getAll`. Each function has two code paths selected once at module load by `useFirebase` (true only if `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are set):
- **Firebase path**: real Firestore (`onSnapshot` for live subscriptions), with persistent IndexedDB local cache so the app keeps working offline and queues writes until reconnect.
- **Local path**: a `localStorage`-backed fake store with its own in-memory listener map, mimicking the same subscribe/callback shape.

Any new feature should add a collection and reuse these functions rather than writing Firestore calls or localStorage code directly — this is what keeps "mode test" and Firebase mode behaviorally identical.

### Auth / permission model
There's no password-based auth — Firebase Auth is only used anonymously to satisfy Firestore rules (`request.auth != null`). Real identity is a family "member" document (`collection: members`) picked in `Login.jsx` and remembered in `localStorage` (`planning-famille:session`). The actual access control (parent vs. enfant) is enforced in the UI layer (`App.jsx` decides which tabs/components render based on `me.role === 'parent'`), **not** in `firestore.rules`, which only gates "is this an app user at all." Treat `firestore.rules` changes as security-sensitive since it's the one real technical boundary; everything else is a client-side convention.

Member codes are hashed (`src/utils.js: hashPin`/`hashPinFor`) using `sha256(pf:<salt>:<pin>)` with a per-member `pinSalt`. A legacy path (`hashPinLegacy`) still supports accounts created before `pinSalt` existed, keyed by name instead of a stable id — keep this fallback when touching PIN logic, don't remove it.

`Login.jsx` enforces an anti-brute-force lockout (`MAX_ATTEMPTS = 5`, `LOCK_MINUTES = 5`): `failedAttempts`/`lockUntil` live on the member's Firestore document (not just `localStorage`), so the lock survives a cleared browser or a login attempt from another device. A parent can manually reset it from `Famille.jsx`.

### Date/recurrence logic duplicated in two runtimes
`src/utils.js` has the canonical recurrence engine (`expandEvents`/`occurrenceDates`) and chore rotation logic (`chorePeriod`/`choreAssignee`, week-indexed from `WEEK0 = 2024-01-01`), used by the browser app. `scripts/envoyer-rappels.js` reimplements the *same* logic with Luxon (`DateTime`) instead of native `Date`, because it's a plain Node script run by GitHub Actions and can't import Vite/browser code. **If you change recurrence or chore-rotation rules in `src/utils.js`, mirror the change in `scripts/envoyer-rappels.js`** or reminders will drift out of sync with what the app displays.

### Notifications pipeline
`scripts/envoyer-rappels.js` runs every 15 minutes via `.github/workflows/rappels.yml` (cron, pinned to `TZ: America/Miquelon`), reads Firestore directly with `firebase-admin` using the `FIREBASE_SERVICE_ACCOUNT` secret, and sends FCM pushes. It writes to the `rappelsEnvoyes` collection to dedupe reminders (tolerates a late GitHub Actions run via `CATCH_UP_HOURS`); that collection is deliberately excluded from `firestore.rules` since only this script (service-account credentials, which bypass rules entirely) ever touches it. Client-side push registration lives in `src/messaging.js` (`enableNotifications`), which requires `VITE_FIREBASE_VAPID_KEY` and — on iOS — the app to be added to the home screen (`isStandalone()`), since Safari tabs can't receive web push.

### Birthdays aren't stored events
Birthdays are never written as calendar documents; `nextBirthday`/`birthdaysInRange` in `src/utils.js` compute them on the fly from each member's `birthDay`/`birthMonth`/`birthYear` fields (year optional) and the app overlays them onto the agenda at render time with a 🎂 marker.

### Firebase config and secrets
`src/db.js` reads all Firebase web config from `VITE_FIREBASE_*` env vars (`.env`, not committed — see `.env.example`). The admin-side secret (`FIREBASE_SERVICE_ACCOUNT`) is a GitHub Actions secret, never present in the repo. Firebase Hosting project id lives in `.firebaserc`; `firebase.json` serves `dist/` as an SPA (all routes rewrite to `/index.html`).
