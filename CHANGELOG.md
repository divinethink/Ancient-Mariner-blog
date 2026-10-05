# CHANGELOG

## Unreleased

- P0a: static পরিবেশন, `_headers`, Firestore REST-পড়া যাচাই সম্পন্ন; হ্যালো-পেজ সরানো, Firestore rule deny-all।
- P0b: Tailwind v4, ESLint 9 (architecture guardrails), Prettier, Vitest, README/CHANGELOG, CI-তে lint+test।
- P0c: data/lib/theme/i18n/error-boundary/PWA-manifest/CSP/rules-scaffold (`enums`, `datetime`, `logger`, `localStore`, `postRepo` interface, ৬ থিম token, `deploy:rules`)।
- P1a (কোড): Google Sign-In, `/login`, `POST /api/auth/session|logout`, edge `middleware.ts` (session + nonce-CSP), `AuthGate`, `lib/session.ts` (`jose`), `lib/csp.ts`, `/dashboard` স্থানধারক। Owner-যাচাই বাকি।
- P1b (কোড): Firestore rules (`posts`/`slugs`/`siteSettings` + deny-all), `posts.body` index exemption, Emulator কনফিগ (`firebase.json`), rules-test (`tests/rules`, `npm run test:rules`), CI-তে rules-test gate। Production deploy ও CI-যাচাই বাকি।
- P2a-১ (কোড): `lib/slug.ts`, `postRepo` Zod boundary (+`drafts`, patch, defensive read), `postRepo.client.ts` (পথ ক: atomic post+slug-lock, rename, drafts), `postRepo.server.ts` + `firestoreRest.ts` (পথ খ: build-সময়ের REST-পড়া), `drafts` rules, composite index (`status`+`visibility`+`publishedAt desc`), Emulator-এ repo integration test। UI নেই।
- P2a-২ক (কোড): Tiptap editor (allowlist, lazy), IndexedDB autosave (`draftStore`) ও caret/scroll পুনঃস্থাপন, লাইব্রেরি হোম, `/dashboard/posts/new|[id]/edit`, `/dashboard/menu`, dashboard nav, `postRepo.list()`, logout-এ unsynced-confirm। Firestore sync ও Publish panel P2a-২খ-তে।
- P2a-২খ (কোড): Firestore sync engine (`syncEngine`, `postSync`, `lib/syncPlan`; idle/blur/manual, conflict-সতর্কতা, race-নিরাপদ `sync:<id>` dirty-তথ্য), Publish/Metadata panel, `postRepo.update/saveEdit/applyDraft` এখন `updatedAt` ফেরত দেয়, `lib/datetime`-এ `toZonedInput/fromZonedInput`, `lib/publish`, লাইব্রেরি-খোলা ও logout-এ সব dirty ড্রাফট sync। CI ও owner-যাচাই বাকি; rebuild trigger P2a-৩-এ।
- Fix (P2a-২খ lint): `PublishPanel`-এ effect-এর ভেতরে sync setState (load এখন ফল ফেরত দেয়, state `.then`-এ) ও render-এ `Date.now()` (`max` এখন meta-লোডের সময় state-এ) — `react-hooks/set-state-in-effect`/`purity`।
- P2a-৩ক (কোড): Trash — `postRepo.trash/restore/deletePermanently/listTrashed/emptyTrash` (প্রকাশিত লেখার `drafts` আগে `posts`-এ কপি; slug-lock অক্ষত; স্থায়ী মোছায় post+নিজের slug-lock+drafts এক batch), `lib/trash` (৭ দিন), লাইব্রেরিতে ফিল্টার-চিপ (সব/Draft/Published/ট্র্যাশ), কার্ডের ⋯ → ট্র্যাশে পাঠান (আগে সংরক্ষণহীন লোকাল লেখা sync), ট্র্যাশ-তালিকা (পুনরুদ্ধার/স্থায়ীভাবে মুছুন/ট্র্যাশ খালি করুন, দুই-ধাপ confirm), list-style `/dashboard/menu` ও `/dashboard/settings` স্ক্যাফোল্ড। CI ও owner-যাচাই বাকি; পাবলিক build/rebuild P2a-৩খ-তে (ট্র্যাশে-পাঠানো প্রকাশিত লেখা সাইটে থেকে যায় যতক্ষণ হাতে `deploy` না চলে)।
