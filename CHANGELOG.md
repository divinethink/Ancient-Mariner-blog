# CHANGELOG

## Unreleased

- P0a: static পরিবেশন, `_headers`, Firestore REST-পড়া যাচাই সম্পন্ন; হ্যালো-পেজ সরানো, Firestore rule deny-all।
- P0b: Tailwind v4, ESLint 9 (architecture guardrails), Prettier, Vitest, README/CHANGELOG, CI-তে lint+test।
- P0c: data/lib/theme/i18n/error-boundary/PWA-manifest/CSP/rules-scaffold (`enums`, `datetime`, `logger`, `localStore`, `postRepo` interface, ৬ থিম token, `deploy:rules`)।
- P1a (কোড): Google Sign-In, `/login`, `POST /api/auth/session|logout`, edge `middleware.ts` (session + nonce-CSP), `AuthGate`, `lib/session.ts` (`jose`), `lib/csp.ts`, `/dashboard` স্থানধারক। Owner-যাচাই বাকি।
