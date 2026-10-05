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
| `npm run fetch:public`                | Firestore REST থেকে published+public পোস্ট → `.build-data/posts.json` (build:cf-এর প্রথম ধাপ) |
| `npm run build:cf`                    | fetch → OpenNext build → public HTML → assets কপি → `_redirects` → `robots.txt`/`sitemap.xml` → `theme-init.js`-এ default থিম |
| `npm run deploy:dry`                  | `wrangler deploy --dry-run` (আকার-যাচাই)  |
| `npm run test:rules`                  | Firestore rules-test (Emulator; Java লাগে) |
| `npm run deploy:rules`                | rules+indexes production-এ (`OWNER_UID` env, Firebase login) |

## Env তালিকা (`src/config/env.ts`, Zod boot-check)

`FIREBASE_PROJECT_ID`, `FIREBASE_SERVER_API_KEY` (GitHub secret), `SITE_URL`। Deploy-secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`। Worker secret (Cloudflare → Worker `blog` → Settings → Variables and Secrets, type = Secret): `OWNER_UID`, `SESSION_SECRET` (≥৩২ অক্ষরের random), `GITHUB_TOKEN` (`/api/owner/rebuild` ব্যবহার করে; fine-grained, শুধু এই repo-র Actions write)। `wrangler.jsonc` vars-এ `GITHUB_REPO` (`owner/repo`)। Build env (GitHub → Settings → Variables): `FIREBASE_BROWSER_API_KEY` → build-এ `NEXT_PUBLIC_FIREBASE_API_KEY` (browser-key; secret নয়)। শুধু `deploy:rules`-এর লোকাল env: `OWNER_UID` (Firebase Auth-এ owner-এর uid; P1a-র পর)।

## Auth (P1a)

Google Sign-In (popup) → `POST /api/auth/session` (`jose`-এ ID token যাচাই: signature/iss/aud/exp, Google provider, সাম্প্রতিক sign-in, `sub == OWNER_UID`) → `__session` cookie (HS256 JWT, httpOnly/Secure/Lax, ৫ দিন rolling) → `src/middleware.ts` `/dashboard/*`, `/api/owner/*` রক্ষা ও `/dashboard`, `/login`-এ nonce-CSP। Logout = `POST /api/auth/logout` + Firebase `signOut` + `localStore.clearAll()`।

জরুরি revoke: Cloudflare-এ `SESSION_SECRET` বদলান (সব cookie অবৈধ) **এবং** Firebase Console → Authentication → owner user → Disable, পরে Enable (refresh token আটকায়; বিদ্যমান ID token সর্বোচ্চ ১ ঘণ্টা বৈধ)।

## Deploy

ZIP আপলোড → `unzip.yml` commit → `ci` চলে। `deploy.yml` হাতে: Actions → deploy → Run workflow। Rules/enum/index বদলালে: `OWNER_UID=<uid> npm run deploy:rules` (লোকাল টার্মিনাল/Codespaces; `firebase login` আগে একবার)। CI-র rules-test Emulator-এ নকল uid ব্যবহার করে (`render-rules.ts --test`), production-এ কিছু পাঠায় না।

## Data layer (P2a-১)

পথ ক `src/data/postRepo.client.ts` (`createPostRepoClient(db, ownerUid)`; dashboard থেকে dynamic import), পথ খ `src/data/postRepo.server.ts` (`getPublicPostSource().listPublished()` — build-সময়ে REST)। Slug: `posts` ও `slugs/{slug}` lock এক `writeBatch`-এ; lock না-মোছা (rename-এর পুরনো slug reserved)। প্রকাশিত post-এ `publishedAt` বাধ্যতামূলক (পাবলিক query তা দিয়ে order করে; `update()` প্রথম প্রকাশে বসায়)। পাবলিক REST-পড়া একবারে সব published পোস্ট আনে, pagination নেই — শত শত পোস্টের পর দেখা হবে।

## Editor (P2a-২ক)

লেখা IndexedDB-তে autosave (`src/data/draftStore.ts`)। Logout `localStore.clearAll()` করে, তাই dirty ড্রাফট থাকলে আগে confirm। Editor schema = `src/lib/editor-nodes.ts`-এর allowlist; সেভের আগে `sanitizeDoc`। Tiptap ভারী, তাই শুধু edit route-এ `next/dynamic`। Dependency: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (v3, exact-pin)।

## Sync ও Publish (P2a-২খ)

- লোকাল ড্রাফট → Firestore: `src/data/syncEngine.ts` (idle ≥৫s / blur / manual; দুই sync-এর ব্যবধান ≥১৫s; ব্যর্থ হলে ৩০s পরে আবার, লেখা লোকালে অক্ষত)। draft = `posts`, প্রকাশিত = `drafts/{id}` (`src/data/postSync.ts`)। নিয়ম pure ফাংশনে `src/lib/syncPlan.ts`।
- **dirty** আলাদা key `sync:<id>`-এর `syncedUpdatedAt` থেকে হিসাব (draft-key শুধু editor লেখে) — sync চলাকালে নতুন টাইপ কখনো মোছে না।
- **Conflict:** sync-এর আগে রিমোট (post/drafts-এর বড় `updatedAt`) ≠ আমার base হলে লেখা বন্ধ, editor-এ [আমার লেখা রাখুন]/[সার্ভারের লেখা আনুন]; merge নেই (Arch §১২-ঙ)। কনটেন্ট হুবহু সমান হলে conflict নয় (retry-নিরাপদ)।
- Publish panel (`PublishPanel.tsx`): slug/সারাংশ/দৃশ্যমানতা/প্রকাশের তারিখ + [প্রকাশ করুন] / [আপডেট প্রকাশ করুন] / [পরিবর্তন বাতিল] / [Draft-এ ফেরান]। সব রিমোট-লেখা `engine.exclusive`-এ।
- সাইটে লাইভ হওয়া: প্রকাশ/আপডেট/Draft-এ ফেরানো/প্রকাশিত লেখায় metadata-বদল/প্রকাশিত লেখা ট্র্যাশে পাঠানো সফল হলে `POST /api/owner/rebuild` (P2a-৩খ, নিচে)। autosave-এ কখনো rebuild নয়।

## Public build ও rebuild (P2a-৩খ)

- **একবারই Firestore-পড়া:** `build:cf` শুরুতে `scripts/fetch-public-data.ts` সব published+public পোস্ট ও `siteSettings/main` REST-এ পড়ে `.build-data/posts.json`-এ রাখে (settings doc না থাকলে defaults; অন্য ব্যর্থতায় build থামে) (gitignored; `fetchedAt` = পড়া শুরুর UTC → `/build.json` `builtAt`)। পাবলিক পেজ (`/`, `/blog/[slug]`) ও `scripts/build-redirects.ts` শুধু এই ফাইল পড়ে (`src/data/publicSnapshot.ts`) — Next-এর একাধিক worker হলেও read বাড়ে না। পড়া ব্যর্থ হলে build/deploy থামে (বিদ্যমান সাইট অক্ষত); ফাইল ছাড়া `build-public.mjs` ব্যর্থ। CI-র `next build`-এ ফাইল থাকে না → সাইট খালি, শুধু কম্পাইল-যাচাই।
- **`/blog/[slug]`:** `force-static` + `dynamicParams = false`; Tiptap `body` allowlist-renderer-এ (`components/public/PostBody.ts`, `.ts`+`createElement` ইচ্ছাকৃত — Vitest-এ JSX transform এড়াতে)। Home card-এ `body` নেই (`toPostCard`); সারাংশ খালি হলে লেখা থেকে।
- **পুরনো slug:** ASCII → build-সময়ে `_redirects`-এ 308 (`scripts/build-redirects.ts`); বাংলা → একই `/blog/[slug]` রুটে stub পেজ (`<meta http-equiv=refresh>` + canonical + noindex, JS ছাড়া)। জীবিত slug-ের সাথে সংঘাতে নতুন পোস্টই জেতে (`lib/publicSite.ts`)।
- **Rebuild:** `POST /api/owner/rebuild` (`middleware` session + `Origin` যাচাই) → `src/data/privileged/githubDispatch.ts` → GitHub `workflow_dispatch` (`deploy.yml`, `concurrency`-এ জমে)। Dashboard-এ `BuildStatus` (Settings ও প্রকাশিত লেখার Publish panel): `/build.json` (no-store) বনাম IndexedDB-র শেষ সাইট-বদল-চিহ্ন; ৫ মিনিট পার হলে 'হালনাগাদ হয়নি' ও [আবার build করুন]।
- `postsPerPage` আপাতত `lib/publicSite.ts`-এর ধ্রুবক (১০); `siteSettings` REST-পড়া ও সম্পাদনা UI P2c-তে।

## Known shortcuts

- ফন্ট `next/font/google`-এর বদলে npm-এর `@fontsource` (Noto Sans/Serif Bengali, OFL) — একই ফন্ট, self-hosted, build-এ Google-এ নির্ভর নেই; `.woff`ও emit হয় (asset-সংখ্যা সীমার অনেক নিচে)। preload নেই (সব subset `unicode-range`-এ লোড)।
- `theme-init.js` `src/theme/`-এর বদলে `public/`-এ (external script, CSP `script-src 'self'`-এ চলে; ESLint-এর ignore-এ `public/**`)। bg-মান `tokens.css`-এর সাথে হাতে মেলাতে হয়।
- সাধারণ নাম `postRepo.client.ts`/`postRepo.server.ts` adapter P2a-তে (Firebase SDK/REST লাগে)।
- `public/icons/*` placeholder আইকন; owner-এর আসল আইকন পরে বদলাবে।
- Public পেজের CSP `public/_headers`-এ (শুধু static asset-এ প্রযোজ্য); `/dashboard`/`/login`-এর nonce-CSP `src/middleware.ts` থেকে (`lib/csp.ts`)।
- `allowIndexing` doc না থাকলে `false` (Arch §৬-এর 'শুরুর true'-এর বদলে; owner-অনুমোদিত)। APP_ENV/preview-noindex নেই — preview environment নেই।
- `typescript` 6.0.x ও `eslint` 9.x — `typescript-eslint` TS 7 এবং `eslint-plugin-react` ESLint 10 সমর্থন করে না; সমর্থন এলে owner-অনুমোদনে আপগ্রেড।
- Session-যাচাই `jose`-ভিত্তিক (Firebase Admin SDK নয়) — Workers-এ Admin SDK-র নির্ভরযোগ্যতা অনিশ্চিত; `jose` edge-এ নিশ্চিত চলে (Arch §৫-এর অনুমোদিত fallback)।
- Sign-In popup-only; popup ব্লক/ব্যর্থ হলে error-বার্তা, redirect fallback নেই (owner-এর ফোন/PWA-যাচাইয়ের পর সিদ্ধান্ত)।
- `middleware.ts` (edge) ব্যবহার হবে; Next 16-এর `proxy.ts` Node runtime-এ, OpenNext-এ unsupported — deprecation warning প্রত্যাশিত।
- Publish panel-এ Mockup-এর 'অবস্থা' radio-র বদলে অবস্থা-ব্যাজ + ক্রিয়া-বোতাম (প্রকাশ/আপডেট/Draft-এ ফেরান) — owner-অনুমোদন বাকি; focus-trap নেই (aria-modal + Esc)।
- সাইট `noindex` থাকে যতক্ষণ Settings-এ [Google-এ ইনডেক্স হোক] চালু না হয় — `siteSettings` doc না থাকলে/পড়া না গেলে `allowIndexing` default `false` (Arch §৬-এর 'শুরুর true'-এর বদলে fail-closed; owner-অনুমোদিত ২০২৬-১০-০৫)। টগল ও meta/sitemap/robots P2c-২-তে।
- SEO (P2c-২): `lib/seo.ts` (pure + test) → Home/Article `generateMetadata` (title/description/canonical/OG/twitter)। Root layout-এর `noindex` থাকে (dashboard/login fail-closed); শুধু পাবলিক পেজ `allowIndexing=true` হলে `robots: index` দিয়ে override করে (stub পেজ সবসময় noindex)। `robots.txt`/`sitemap.xml` `scripts/build-seo.ts` দিয়ে সরাসরি assets-এ: ইনডেক্স বন্ধ = `Disallow: /` + sitemap নেই; চালু = `/dashboard /login /api` Disallow + Sitemap, `blockAiCrawlers` হলে `AI_CRAWLERS` তালিকার প্রত্যেকে `Disallow: /`। og:image = `public/og-default.png` থাকলে, নইলে tag বাদ।
- Backups (P2c-৩): `/dashboard/backups` (মেনুতে ☁️) — শুধু read; আগে `count()` + read-সীমা (৫০K/দিন) % দেখিয়ে confirm, তারপর `lib/backup.ts` পাতায় পাতায় (১০০, doc-id cursor) পড়ে Blob-parts-এ জমায়; posts/drafts/slugs/siteSettings (revisions বাদ); Timestamp = `{"$timestamp":"ISO"}` (P5b restore এই ফাইল পড়বে)। ব্যর্থ/বাতিলে আংশিক ফাইল দেওয়া হয় না। Adapter `data/backupRepo(.client).ts`।
- 404/error: `app/not-found.tsx` build-এ `404.html` হয়ে assets-এ (`build-public.mjs`) + `wrangler.jsonc` `not_found_handling: "404-page"` (অজানা URL-এ Worker চলে না); `/dashboard/error.tsx`-এ 'লাইব্রেরিতে ফিরুন'।
- Analytics: Cloudflare Web Analytics beacon শুধু পাবলিক Home/Article-এ, `lazyOnload`; GitHub repo variable `CF_ANALYTICS_TOKEN` (৩২-হেক্স, `lib/analytics.ts` যাচাই) থাকলেই render। CSP (`public/_headers`) শুধু `static.cloudflareinsights.com` (script-src) ও `cloudflareinsights.com` (connect-src) যোগ।
- Settings: `siteSettings/main`; সেভ = শুধু P2c-র ফিল্ডগুলোর `merge` (পরের phase-এর `menu/layout/design` অক্ষত), last-write-wins (একক owner)। Dashboard timezone/সেটিং প্রতি-ডিভাইস `prefs` cache থেকে সাথে সাথে, পেছনে ১ read-এ হালনাগাদ। থিম-default build-সময়ে assets-এর `theme-init.js`-এর `DEFAULT_THEME`-এ বসে (`scripts/build-theme-default.ts`); প্রতি-ডিভাইস পছন্দ জেতে।
