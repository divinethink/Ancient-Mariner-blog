# Ancient Mariner Blog

ব্যক্তিগত লেখা ও প্রকাশনা প্ল্যাটফর্ম (Next.js + Cloudflare Workers + Firestore)। পরিকল্পনা: প্রজেক্টের Roadmap / Architecture Plan / Checklist।

## Local setup

```
npm ci
export FIREBASE_PROJECT_ID=ancientmarinerblog FIREBASE_SERVER_API_KEY=... SITE_URL=https://blog.ancientmariner.workers.dev
npm run dev
```

## Scripts

| কমান্ড                                | কাজ                                       |
| ------------------------------------- | ----------------------------------------- |
| `npm run lint` / `typecheck` / `test` | CI-র তিন gate                             |
| `npm run format`                      | Prettier (স্থানীয়; CI gate নেই)          |
| `npm run build:cf`                    | OpenNext build + public HTML → assets কপি |
| `npm run deploy:dry`                  | `wrangler deploy --dry-run` (আকার-যাচাই)  |
| `npm run test:rules`                  | Firestore rules-test (Emulator; Java লাগে) |
| `npm run deploy:rules`                | rules+indexes production-এ (`OWNER_UID` env, Firebase login) |

## Env তালিকা (`src/config/env.ts`, Zod boot-check)

`FIREBASE_PROJECT_ID`, `FIREBASE_SERVER_API_KEY` (GitHub secret), `SITE_URL`। Deploy-secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`। Worker secret (Cloudflare → Worker `blog` → Settings → Variables and Secrets, type = Secret): `OWNER_UID`, `SESSION_SECRET` (≥৩২ অক্ষরের random), `GITHUB_TOKEN` (P2a-তে ব্যবহার)। Build env (GitHub → Settings → Variables): `FIREBASE_BROWSER_API_KEY` → build-এ `NEXT_PUBLIC_FIREBASE_API_KEY` (browser-key; secret নয়)। শুধু `deploy:rules`-এর লোকাল env: `OWNER_UID` (Firebase Auth-এ owner-এর uid; P1a-র পর)।

## Auth (P1a)

Google Sign-In (popup) → `POST /api/auth/session` (`jose`-এ ID token যাচাই: signature/iss/aud/exp, Google provider, সাম্প্রতিক sign-in, `sub == OWNER_UID`) → `__session` cookie (HS256 JWT, httpOnly/Secure/Lax, ৫ দিন rolling) → `src/middleware.ts` `/dashboard/*`, `/api/owner/*` রক্ষা ও `/dashboard`, `/login`-এ nonce-CSP। Logout = `POST /api/auth/logout` + Firebase `signOut` + `localStore.clearAll()`।

জরুরি revoke: Cloudflare-এ `SESSION_SECRET` বদলান (সব cookie অবৈধ) **এবং** Firebase Console → Authentication → owner user → Disable, পরে Enable (refresh token আটকায়; বিদ্যমান ID token সর্বোচ্চ ১ ঘণ্টা বৈধ)।

## Deploy

ZIP আপলোড → `unzip.yml` commit → `ci` চলে। `deploy.yml` হাতে: Actions → deploy → Run workflow। Rules/enum/index বদলালে: `OWNER_UID=<uid> npm run deploy:rules` (লোকাল টার্মিনাল/Codespaces; `firebase login` আগে একবার)। CI-র rules-test Emulator-এ নকল uid ব্যবহার করে (`render-rules.ts --test`), production-এ কিছু পাঠায় না।

## Data layer (P2a-১)

পথ ক `src/data/postRepo.client.ts` (`createPostRepoClient(db, ownerUid)`; dashboard থেকে dynamic import), পথ খ `src/data/postRepo.server.ts` (`getPublicPostSource().listPublished()` — build-সময়ে REST)। Slug: `posts` ও `slugs/{slug}` lock এক `writeBatch`-এ; lock না-মোছা (rename-এর পুরনো slug reserved)। প্রকাশিত post-এ `publishedAt` বাধ্যতামূলক (পাবলিক query তা দিয়ে order করে; `update()` প্রথম প্রকাশে বসায়)। পাবলিক REST-পড়া একবারে সব published পোস্ট আনে, pagination নেই — শত শত পোস্টের পর দেখা হবে।

## Editor (P2a-২ক)

লেখা IndexedDB-তে autosave (`src/data/draftStore.ts`, `dirty=true` = এখনো Firestore-এ যায়নি; sync P2a-২খ)। Logout `localStore.clearAll()` করে, তাই dirty ড্রাফট থাকলে আগে confirm। Editor schema = `src/lib/editor-nodes.ts`-এর allowlist; সেভের আগে `sanitizeDoc`। Tiptap ভারী, তাই শুধু edit route-এ `next/dynamic`। Dependency: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (v3, exact-pin)।

## Known shortcuts

- ফন্ট `next/font/google`-এর বদলে npm-এর `@fontsource` (Noto Sans/Serif Bengali, OFL) — একই ফন্ট, self-hosted, build-এ Google-এ নির্ভর নেই; `.woff`ও emit হয় (asset-সংখ্যা সীমার অনেক নিচে)। preload নেই (সব subset `unicode-range`-এ লোড)।
- `theme-init.js` `src/theme/`-এর বদলে `public/`-এ (external script, CSP `script-src 'self'`-এ চলে; ESLint-এর ignore-এ `public/**`)। bg-মান `tokens.css`-এর সাথে হাতে মেলাতে হয়।
- সাধারণ নাম `postRepo.client.ts`/`postRepo.server.ts` adapter P2a-তে (Firebase SDK/REST লাগে)।
- `public/icons/*` placeholder আইকন; owner-এর আসল আইকন পরে বদলাবে।
- Public পেজের CSP `public/_headers`-এ (শুধু static asset-এ প্রযোজ্য); `/dashboard`/`/login`-এর nonce-CSP `src/middleware.ts` থেকে (`lib/csp.ts`)।
- `typescript` 6.0.x ও `eslint` 9.x — `typescript-eslint` TS 7 এবং `eslint-plugin-react` ESLint 10 সমর্থন করে না; সমর্থন এলে owner-অনুমোদনে আপগ্রেড।
- Session-যাচাই `jose`-ভিত্তিক (Firebase Admin SDK নয়) — Workers-এ Admin SDK-র নির্ভরযোগ্যতা অনিশ্চিত; `jose` edge-এ নিশ্চিত চলে (Arch §৫-এর অনুমোদিত fallback)।
- Sign-In popup-only; popup ব্লক/ব্যর্থ হলে error-বার্তা, redirect fallback নেই (owner-এর ফোন/PWA-যাচাইয়ের পর সিদ্ধান্ত)।
- `middleware.ts` (edge) ব্যবহার হবে; Next 16-এর `proxy.ts` Node runtime-এ, OpenNext-এ unsupported — deprecation warning প্রত্যাশিত।
- সাইট এখন সর্বত্র `noindex` (লঞ্চ-যাচাইয়ের আগে); Google-ইনডেক্স টগল P2c-তে।
