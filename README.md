# Ancient Mariner Blog

ব্যক্তিগত লেখা ও প্রকাশনা প্ল্যাটফর্ম (Next.js + Cloudflare Workers + Firestore)। পরিকল্পনা: প্রজেক্টের Roadmap / Architecture Plan / Checklist।

## Local setup

```
npm ci
export FIREBASE_PROJECT_ID=ancientmarinerblog FIREBASE_SERVER_API_KEY=... SITE_URL=https://blog.ancientmariner.workers.dev
npm run dev
```

## Scripts

| কমান্ড | কাজ |
|---|---|
| `npm run lint` / `typecheck` / `test` | CI-র তিন gate |
| `npm run format` | Prettier (স্থানীয়; CI gate নেই) |
| `npm run build:cf` | OpenNext build + public HTML → assets কপি |
| `npm run deploy:dry` | `wrangler deploy --dry-run` (আকার-যাচাই) |

## Env তালিকা (`src/config/env.ts`, Zod boot-check)

`FIREBASE_PROJECT_ID`, `FIREBASE_SERVER_API_KEY` (GitHub secret), `SITE_URL`। Deploy-secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`। Worker secret: `GITHUB_TOKEN` (P2a-তে ব্যবহার)।

## Deploy

ZIP আপলোড → `unzip.yml` commit → `ci` চলে। `deploy.yml` হাতে: Actions → deploy → Run workflow। `npm run deploy:rules` P0c-তে আসবে।

## Known shortcuts

- `typescript` 6.0.x ও `eslint` 9.x — `typescript-eslint` TS 7 এবং `eslint-plugin-react` ESLint 10 সমর্থন করে না; সমর্থন এলে owner-অনুমোদনে আপগ্রেড।
- `middleware.ts` (edge) ব্যবহার হবে; Next 16-এর `proxy.ts` Node runtime-এ, OpenNext-এ unsupported — deprecation warning প্রত্যাশিত।
- সাইট এখন সর্বত্র `noindex` (লঞ্চ-যাচাইয়ের আগে); Google-ইনডেক্স টগল P2c-তে।
