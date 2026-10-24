# Data Safety, Security & Recovery Audit — Ancient Mariner Blog

> তারিখ: ২০২৬-১০-২৪ · ভিত্তি: আপলোড-করা repo ZIP (`Ancient-Mariner-blog-main`) + Architecture Plan। Production-এ কোনো লেখা/মোছা/পরিবর্তন করা হয়নি; repo-র কোনো বিদ্যমান ফাইলও বদলানো হয়নি।
> **নীতি:** "Verified" = এই অডিটে নিজে চালিয়ে/পড়ে প্রমাণ পাওয়া গেছে। "Not Verified" = প্রমাণ পাওয়া যায়নি (live সিস্টেমে ঢোকা যায়নি)।

## ১. সামগ্রিক অবস্থা

**কোড ও নকশা শক্ত; কিন্তু একটিও live-প্রমাণ নেই, আর সব কপি একই Google-অ্যাকাউন্ট-কেন্দ্রিক।**

- কোড-স্তরে লেখা হারানোর বিরুদ্ধে ভালো স্তর আছে: Trash (৭ দিন) → revision (২০টি) → `drafts` স্তর → দৈনিক Drive-backup → add-only restore।
- তবে আপনার লেখার **একমাত্র স্বতন্ত্র কপি = Google Drive-এ plain JSON**, আর সেটা সম্ভবত Firebase-owner-এর একই Google-অ্যাকাউন্টে (**Not Verified**)। অ্যাকাউন্ট হারালে/দখল হলে Firestore ও backup একসাথে যায়।
- Firestore-এর নিজস্ব managed backup এই প্ল্যানে (Spark) নেই — Firebase ডকুমেন্টেশন অনুযায়ী scheduled backup-এ Blaze লাগে ([Firebase: Back up and restore data](https://firebase.google.com/docs/firestore/backups))। তাই Drive-JSON-ই একমাত্র backup-স্তর।
- "একমাত্র কপি" ঝুঁকি: **মাঝারি-উচ্চ** — backup বাস্তবে চলছে কিনা ও Drive-এ আছে কিনা আমি দেখতে পারিনি।

## ২. গুরুতর ঝুঁকি (অগ্রাধিকার অনুযায়ী)

| # | ঝুঁকি | মাত্রা | প্রমাণ | প্রভাব |
|---|---|---|---|---|
| ১ | **একক Google-অ্যাকাউন্ট SPOF** — Firebase, Drive-backup (OAuth `drive.file`), সম্ভবত একই অ্যাকাউন্ট; backup unencrypted plain JSON | উচ্চ | `.github/workflows/backup.yml`, `scripts/backup.ts`, Arch §১৪.৮, §১৫ | অ্যাকাউন্ট-দখল/বন্ধে লেখা + backup একসাথে হারায়; দখল হলে ডায়েরি ফাঁস |
| ২ | **Live rules = repo rules কিনা অজানা।** ZIP-এর rendered `firestore.rules` পুরনো: ১১টি collection নেই (`bookmarks, books, chapters, comments, highlights, letters, quotes, shareLinks, specialDays, trips, writingProjects`) | উচ্চ (অযাচাইকৃত) | `firestore.rules` বনাম `firestore.rules.tpl` — `diffRules` চালিয়ে পাওয়া ([নিচে ৩](#৩-যাচাইকৃত-ব্যবস্থা)) | live যদি পুরনো হয়: ওই feature-গুলো `permission-denied` (fail-closed, নিরাপদ দিক) ও restore ওই collection-এ ব্যর্থ। live যদি আরও খোলা হয়: পাবলিক ফাঁস। (rendered ফাইল `.gitignore`-এ; tpl-এ `Console-paste` মন্তব্য থেকে হাতে-পেস্টের সম্ভাবনা) |
| ৩ | **Backup-যাচাই দুর্বল:** শুধু ফাইল-আকার মেলানো ও মোট doc ≠ ০। আগের backup-এর চেয়ে হঠাৎ অনেক কম doc হলেও "সম্পূর্ণ" ধরে; ~৪ সপ্তাহ পর ভালো কপি retention-এ মুছে যায় | মাঝারি-উচ্চ | `src/data/privileged/backupJob.ts` (`total === 0` ছাড়া কোনো শ্রিঙ্ক-গার্ড নেই), `src/lib/backupPolicy.ts` (৭ দৈনিক + ৪ সাপ্তাহিক + ৩ manual) | নীরব ক্ষয় (bug/ভুল-মোছা) ধরা না পড়লে ভালো backup ঘুরে মুছে যায় |
| ৪ | **`posts` hard-delete rules-এ যেকোনো অবস্থায় অনুমোদিত** (`allow read, delete: if isOwner()`); `chapters`-এ ইতিমধ্যে "শুধু trashed" | মাঝারি | `firestore.rules.tpl` `match /posts` বনাম `match /chapters`; কোডে সব মোছা-পথ trashed চায় (`postRepo.client.ts` `deletePermanently` → `TrashRequiredError`) | ভবিষ্যৎ bug বা চুরি-হওয়া session এক ধাপে লেখা স্থায়ী মুছতে পারে |
| ৫ | **`unlisted` লেখা যে-কেউ তালিকাভুক্ত করতে পারে** — rules `visibility in ['public','unlisted']`; আপনার নিজের test সেটাই নিশ্চিত করে | মাঝারি (গোপনীয়তা) | `firestore.rules.tpl` `match /posts`; `tests/rules/firestore.rules.test.ts:83-88` | Firebase API-key (পাবলিক) থাকলে সব unlisted লেখার পূর্ণ body পড়া যায়; ব্যক্তিগত লেখা unlisted রাখলে ফাঁস |
| ৬ | **`/api/owner/*` privileged route শুধু middleware-এর ওপর নির্ভর**; handler-এ session পুনঃযাচাই নেই (`verifySessionToken` শুধু `middleware.ts` ও `/api/view`-তে) | মাঝারি | `grep verifySessionToken`; `guard.ts` মন্তব্য "middleware আগেই যাচাই করে" | middleware-bypass হলে service-account/Cloudinary/GitHub-token-ভিত্তিক কাজ খোলা। (Next 16.3.8-এ পরিচিত bypass-CVE নেই বলে মনে হয়; তবু defense-in-depth নেই) |
| ৭ | **Cloudinary ছবি মোছা অপরিবর্তনীয়, ব্যবহার-যাচাই নেই**; media-ফাইল backup-এ নেই (শুধু metadata) | মাঝারি | `api/owner/media/delete/route.ts`, `MediaManager.tsx` (শুধু ConfirmButton), Arch §১৫ | প্রকাশিত লেখা থেকে ছবি নীরবে উধাও (renderer meta না পেলে কিছু দেখায় না); মূল ছবি শুধু আপনার ফোনে |
| ৮ | **Backup-পরিধির ফাঁক:** `comments` নেই; `revisions` ইচ্ছাকৃত বাদ; D1 `viewCounts` নেই | নিম্ন-মাঝারি | `src/lib/backup.ts` `BACKUP_COLLECTIONS` | পাঠকের মন্তব্য হারালে ফেরানো যায় না; লেখার ইতিহাস শুধু একই Firestore-এ |
| ৯ | **Deploy CI-gated নয়:** `deploy.yml` `push: main`-এ চলে, `ci.yml`-এর সাফল্যের অপেক্ষা করে না; `unzip.yml` সরাসরি `main`-এ push (`contents: write`) | নিম্ন-মাঝারি | `.github/workflows/deploy.yml`, `unzip.yml` | ভাঙা কোড (যেমন ভুল delete-লুপ) CI লাল হওয়ার আগেই live হতে পারে; Branch protection **Not Verified** |
| ১০ | **একটি দীর্ঘস্থায়ী service-account key** দুই জায়গায় (GitHub secret + Worker secret), rules-bypass সম্পূর্ণ Firestore-অধিকার; IAM role **Not Verified** | নিম্ন-মাঝারি | `backup.yml`, `deploy-rules.yml`, `src/config/env.ts` | key ফাঁসলে সব ডেটা পড়া/মোছা যায় |
| ১১ | সম্পাদনা-conflict অ্যাটমিক নয় (read→compare→write); মোছা/bulk-এর audit-log নেই | নিম্ন | `src/data/postSync.ts` | একক-owner ও ট্র্যাশ-স্তরের কারণে বাস্তব ঝুঁকি কম |
| ১২ | backup ব্যর্থতার খবর শুধু dashboard খুললে (লাল ব্যানার) বা GitHub-ইমেইলে (**সেটিং Not Verified**) | নিম্ন | Arch §১৫ | কয়েক সপ্তাহ নীরবে backup বন্ধ থাকতে পারে |

## ৩. যাচাইকৃত ব্যবস্থা

| ব্যবস্থা | প্রমাণ (এই অডিটে চালানো/পড়া) |
|---|---|
| ইউনিট টেস্ট | `npx vitest run` ⇒ **১৩৫ ফাইল / ৯৮৭ টেস্ট পাস** (backup, restore, session, comments, cron, rules-renderer সহ) |
| Typecheck ও lint | `tsc --noEmit` ও `eslint .` — ত্রুটি ০ |
| Rules (টেমপ্লেট, static পাঠ) | Default-deny `match /{document=**}` (false); private collection (`drafts, ideas, notes, letters, quotes, templates, bookmarks, highlights, shareLinks…`) owner-only; `revisions` update/delete = false; `backups` ও `comments` client-write = false; `chapters` delete শুধু trashed; `slugs` update = false। *(Emulator-test চালানো যায়নি — নিচে ৪)* |
| Session/Auth কোড | `src/lib/session.ts`: Firebase ID-token (`RS256`, iss/aud/exp, provider `google.com`, `auth_time ≤ ৩০০s`, `sub == OWNER_UID`); session = HS256 JWT, cookie `httpOnly; Secure; SameSite=Lax`, ৫ দিন rolling; `safeNext` open-redirect রোধ; `session.test.ts` পাস |
| CSRF | `isSameOrigin` — `api/auth/session`, `api/owner/backup`, `media/guard.ts`, `api/comment`-এ |
| Public লেখার পথ | `api/comment`: Origin + ১৬KB সীমা + D1 rate-limit + Turnstile + idempotent id + fail-closed ৫০৩; লগে নাম/IP নেই |
| XSS | `dangerouslySetInnerHTML` শুধু ধ্রুবক script ও JSON-LD (`seo.ts:219` — `<` escape); Tiptap→allowlist-renderer; dashboard-এ nonce-CSP (`src/lib/csp.ts`) |
| Backup job-এর ক্রম | ফোল্ডার → প্রতি ফাইল আপলোড → আকার-যাচাই → `backups` doc (শুধু সম্পূর্ণ-সফল, `exists:false`) → তারপর retention; অসম্পূর্ণ/শূন্য হলে কিছু মোছে না (`backupJob.ts`, `backupJob.test.ts` পাস) |
| লেখা-সুরক্ষা স্তর | Trash ৭ দিন, revision ২০টি, প্রকাশিত লেখার সম্পাদনা `drafts`-এ, মোছা শুধু ট্র্যাশ-থেকে (`postRepo.client.ts`) |
| Restore-কোড | add-only ডিফল্ট, কিছু মোছে না (`restoreRepo.client.ts`, `lib/restore.ts`, `restore.test.ts` পাস) |
| Rules-drift যাচাই-যন্ত্র | ZIP-এর পুরনো `firestore.rules` বনাম rendered টেমপ্লেটে নতুন `diffRules` চালিয়ে ১১টি collection-এর অনুপস্থিতি ধরা পড়েছে; ১২টি নতুন ইউনিট-টেস্ট পাস |

## ৪. ঘাটতি (অনুপস্থিত / দুর্বল / যাচাই করা যায়নি)

**Not Verified (live/বাইরের সিস্টেমে ঢোকা যায়নি):**
- live Firestore rules কী (আর deploy কীভাবে হয়েছে);
- **Rules Emulator-test** — `npm run test:rules` চালানোর চেষ্টায় Emulator jar ডাউনলোড ব্লক (`storage.googleapis.com`)। CI-তে চলার কথা, ফলাফল আমি দেখিনি;
- আসলে কটি backup চলেছে, Drive-এ ফোল্ডার/ফাইল আছে কিনা, refresh-token বৈধ কিনা, Drive-অ্যাকাউন্ট = Firebase-অ্যাকাউন্ট কিনা;
- Firebase browser/server API-key restriction, Authorized domains, চালু Auth provider;
- Google অ্যাকাউন্টে 2FA/passkey, recovery; GitHub 2FA ও branch protection; GitHub failure-notification;
- service-account-এর IAM role; Worker secret-এর তালিকা; Cloudinary অ্যাকাউন্ট;
- **Restore বাস্তবে** (Drive থেকে নামিয়ে খালি DB-তে) — শুধু CI-র Emulator-drill আছে (`tests/rules/restore.client.test.ts`), চালাইনি।

**অনুপস্থিত/দুর্বল:** ২য় স্বতন্ত্র (Google-বহির্ভূত) encrypted backup; backup-এর শ্রিঙ্ক-গার্ড ও content-hash; `comments` ও D1-এর backup; মাসিক দীর্ঘ-retention; deploy-gating; handler-স্তরে session পুনঃযাচাই; মোছার audit-log; Firestore managed backup/PITR (Spark-এ নেই)।

## ৫. জরুরি করণীয় (এই ক্রমে; সবই মোবাইল থেকে)

1. **এখনই একটি manual backup নিন:** GitHub → Actions → `backup` → *Run workflow*। সবুজ হলে Drive-এ `ancient-mariner-backup-…` ফোল্ডার ও ফাইল আছে কিনা দেখুন। *(যাচাই: backup বাস্তবে চলে)*
2. **Google-এর বাইরে একটি কপি রাখুন:** dashboard → `/dashboard/backups` → ম্যানুয়াল JSON export ডাউনলোড করে অন্য একটি সেবায় (যেমন OneDrive/Dropbox/Proton/ইমেইল-করা নিজেকে) রাখুন। ডায়েরির কারণে সম্ভব হলে পাসওয়ার্ড-যুক্ত zip করে। এটাই এখন একমাত্র "দ্বিতীয় কপি"।
3. **`verify-prod.yml` বসান ও চালান** (নিচে ৭): live rules, নামহীন-প্রবেশ, backup-তাজাভাব এক রানে। `live rules ≠ repo` এলে `deploy-rules` workflow চালান (বিদ্যমান; কোনো কোড-বদল লাগে না)।
4. **অ্যাকাউন্ট-সুরক্ষা (হাতে, Not Verified অংশ):** Google (passkey/2FA, recovery email-phone হালনাগাদ), GitHub (2FA, `main`-এ branch protection), Firebase Console → API key restriction ও Authentication → অপ্রয়োজনীয় provider বন্ধ।
5. **`unlisted`-এ সংবেদনশীল লেখা রাখবেন না** — গোপন রাখতে `private` + share-link ব্যবহার করুন (ঝুঁকি ৫-এর সমাধান না হওয়া পর্যন্ত)।
6. **Cloudinary ছবি মোছার আগে** দেখুন কোন লেখায় ব্যবহৃত; মূল ছবি ফোন/Google Photos-এ রাখা চালিয়ে যান।

## ৬. স্থায়ী সমাধান (প্রতিটি বাস্তবায়নের আগে আপনার অনুমোদন লাগবে — আপনার নিয়ম ১)

| ধাপ | কী | কেন | ঝুঁকি/খরচ |
|---|---|---|---|
| ক | **২য় backup গন্তব্য, Google-বহির্ভূত ও encrypted:** Cloudflare R2 / Backblaze B2 (বা সহজতমে private GitHub Actions artifact), `age`-এর public-key দিয়ে encrypt; private key আপনার কাছে অফলাইনে। নতুন secret: গন্তব্যের key + `AGE_PUBLIC_KEY` | ঝুঁকি ১ | R2/B2-এ পেমেন্ট-কার্ড লাগতে পারে (যাচাই করুন); artifact-এ ৯০ দিনের সীমা |
| খ | **Backup-যাচাই শক্ত:** আগের backup-এর তুলনায় `posts/chapters` >২০% কমলে "সন্দেহজনক" ⇒ job লাল ও retention বন্ধ; প্রতি ফাইলের SHA-256 `backups` doc-এ; মাসিক ৬টি দীর্ঘ-retention কপি | ঝুঁকি ৩ | additive; `backupJob.ts` + test বদল |
| গ | **`comments` backup-এ যোগ** (`BACKUP_COLLECTIONS` + restore-তালিকা + test) | ঝুঁকি ৮ | additive |
| ঘ | **Rules কঠোর:** `posts` delete শুধু `resource.data.status == 'trashed'` (নিচের স্নিপেট) + rules-test + `deploy-rules` | ঝুঁকি ৪ | কোডের সব পথ আগেই trashed চায় ⇒ সামঞ্জস্যপূর্ণ; deploy-এর আগে CI-র rules-test লাল/সবুজ দেখুন |
| ঙ | **`unlisted` সিদ্ধান্ত:** (১) মেনে নেওয়া ও নথিভুক্ত করা, অথবা (২) `unlisted` বাদ দিয়ে শুধু `private` + share-link | ঝুঁকি ৫ | (২)-এ build-এর `listUnlisted` ও P11c-ফিচারে বদল — বড় পরিবর্তন |
| চ | **handler-স্তরে session পুনঃযাচাই:** `/api/owner/*`-এর শেয়ার্ড guard-এ `verifySessionToken` | ঝুঁকি ৬ | ছোট, test-যোগ্য |
| ছ | **Service-account আলাদা ও least-privilege:** backup-job = শুধু পড়া (`roles/datastore.viewer`), Worker = আলাদা key; বছরে একবার rotate | ঝুঁকি ১০ | Console-কাজ (মোবাইলে সম্ভব) |
| জ | **Deploy-gating:** `deploy.yml` CI-র সবুজের পর (`workflow_run`/`needs`) | ঝুঁকি ৯ | workflow-বদল — আলাদা অনুমোদন |
| ঝ | **Restore-drill ত্রৈমাসিক:** Drive-এর সর্বশেষ backup নামিয়ে Emulator-এ restore করে doc-সংখ্যা মেলানো (CI-র বিদ্যমান drill-কে আসল ফাইলে প্রসারিত) | Restore কখনো আসল ডেটায় পরীক্ষিত নয় | মাঝারি কাজ |
| ঞ | **(ঐচ্ছিক) Blaze + budget-cap:** Firestore scheduled backup (সর্বোচ্চ ১৪ সপ্তাহ) — আপনার ফ্রি-প্ল্যান নীতির ব্যতিক্রম, তাই শুধু আপনার সিদ্ধান্তে | স্বতন্ত্র কপির আরেকটি স্তর | বিল-ঝুঁকি; budget-alert বাধ্যতামূলক |

**ঘ-এর rules স্নিপেট (প্রস্তাব — প্রয়োগ করা হয়নি):**
```
// firestore.rules.tpl, match /posts/{postId}
allow read: if isOwner();
allow delete: if isOwner() && resource.data.status == 'trashed';
```
**rules-test যোগ:** owner `published`/`draft` post delete ⇒ `assertFails`; `trashed` post delete ⇒ `assertSucceeds`।

## ৭. এই অডিটের সাথে দেওয়া নতুন ফাইল (শুধু-পড়া; বিদ্যমান কিছু বদলায়নি)

| ফাইল | কাজ |
|---|---|
| `.github/workflows/verify-prod.yml` *(আলাদা, হাতে বসাতে হবে)* | Production-এ read-only যাচাই (সাপ্তাহিক + ম্যানুয়াল); ব্যর্থ হলে workflow লাল ⇒ ইমেইল |
| `scripts/verify-prod.ts` | live rules ↔ repo diff; ~২৮টি নামহীন probe (শুধু `runQuery`, `limit 1`); backup-তাজাভাব |
| `src/lib/prodVerify.ts` + `.test.ts` | pure যুক্তি ও ১২টি ইউনিট-টেস্ট (পাস) |
| `docs/audit/…-audit.md` | এই রিপোর্ট |

**সীমা:** `verify-prod`-এর নেটওয়ার্ক-অংশ (Firebase Rules API, Firestore REST) এখানে চালানো যায়নি — প্রথম GitHub রানই তার আসল পরীক্ষা। তার আগে সেটি **Not Verified**। probe-এ কোনো লেখা নেই; Firestore-এ প্রতি রানে ~২৮টি read (দৈনিক সীমার নগণ্য অংশ)।

## ৮. চূড়ান্ত সিদ্ধান্ত

| বিষয় | অবস্থা | সংক্ষেপে |
|---|---|---|
| Data safety | **Partial** | কোড-স্তরে একাধিক সুরক্ষা প্রমাণিত; স্বতন্ত্র দ্বিতীয় কপি নেই, backup-যাচাই দুর্বল |
| Firestore Security Rules | **Partial** | টেমপ্লেট নকশা শক্ত; live-deploy, Emulator-ফল ও ZIP-এর পুরনো rendered ফাইল **Not Verified/অসঙ্গত**; `unlisted`/hard-delete শিথিল |
| Authentication ও access control | **Partial** | session/owner-গেট কোডে ও টেস্টে প্রমাণিত; 2FA, API-key restriction, provider-তালিকা, handler-স্তর পুনঃযাচাই বাকি |
| Backup | **Partial** | দৈনিক Drive-job কোডে ও টেস্টে সঠিক; বাস্তবে চলছে কিনা **Not Verified**; পরিধির ফাঁক |
| Restore ও disaster recovery | **Not Verified** | restore-কোড ও CI-drill আছে; আসল Drive-ডেটা থেকে কখনো পরীক্ষিত নয়; অ্যাকাউন্ট-হারানো পরিস্থিতির পথ নেই |
| Production security | **Not Verified** | live সিস্টেমে ঢোকা যায়নি; `verify-prod` + হাতে-যাচাইয়ের পর হালনাগাদ হবে |

*Failed বলার মতো প্রমাণিত ব্যর্থতা পাইনি।*
