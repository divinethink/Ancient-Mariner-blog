# Hardening (পার্ট ২) — পরিবর্তন, চালু করার ক্রম, ফেরত-পথ

## কী বদলেছে
| # | পরিবর্তন | ফাইল |
|---|---|---|
| ১ | **`posts` স্থায়ী মোছা শুধু `status == 'trashed'`-এ।** draft/published/archived সরাসরি মোছা যায় না। 'ট্র্যাশ খালি করুন' ও 'স্থায়ীভাবে মুছুন' অক্ষত (আগে থেকেই ট্র্যাশ-অবস্থা চায়); Cron-purge privileged পথে, অক্ষত | `firestore.rules.tpl`, `tests/rules/firestore.rules.test.ts` |
| ২ | **`comments` backup-এ যোগ** (Drive-ফাইল `comments.json` ও ম্যানুয়াল export)। rules-এ client write নেই বলে **client-restore-এ comments বাদ** (`NON_RESTORABLE`; restore-panel-এ দেখায় না) — backup-এ নিরাপদ থাকে | `src/lib/backup.ts`, `src/lib/restore.ts`, `RestorePanel.tsx`, `src/i18n/bn.ts` |
| ৩ | **শ্রিঙ্ক-গার্ড (শুধু স্বয়ংক্রিয় backup):** আগের সম্পূর্ণ backup-এর তুলনায় `posts/chapters/pages` ২০%-এর বেশি কমলে (আগে ≥১০টি থাকলে) backup **বাতিল** — `backups` doc লেখা হয় না, retention চলে না, ভালো পুরনো কপি অক্ষত; workflow লাল। **manual backup-এ গার্ড নেই** | `src/lib/backupPolicy.ts`, `src/data/privileged/backupJob.ts`, `scripts/backup.ts` |
| ৪ | **Google-বহির্ভূত encrypted ২য় কপি:** প্রতি backup-এর পর সব ফাইল tar → AES-256 (openssl, PBKDF2) → private GitHub Actions artifact (৯০ দিন)। secret `BACKUP_PASSPHRASE` না থাকলে বাদ যায়, Drive-backup অক্ষত | `.github/workflows/backup.yml` (আলাদা), `src/config/env.ts` |

## চালু করার ক্রম (মোবাইল থেকে)
1. ZIP আপলোড ⇒ CI চলবে (`npm run test:rules` নতুন rules-test সহ) — **সবুজ হওয়া পর্যন্ত অপেক্ষা**।
2. `.github/workflows/backup.yml` প্রতিস্থাপন (আলাদা ফাইল)।
3. GitHub → Settings → Secrets and variables → Actions → New secret: **`BACKUP_PASSPHRASE`** = লম্বা (≥২০ অক্ষর) random পাসফ্রেজ। **একই পাসফ্রেজ অন্য জায়গায়ও লিখে রাখুন (পাসওয়ার্ড-ম্যানেজার/কাগজ)** — হারালে artifact খোলা যাবে না।
4. Actions → **deploy-rules** → Run (নতুন rules live হবে)।
5. Actions → **backup** → Run (manual; এটা নতুন baseline) ⇒ শেষে run-পেজের **Artifacts**-এ `offsite-backup-encrypted` আসবে।
6. Actions → **verify-prod** → Run (`owner_uid` সহ) ⇒ সব ✅।
7. যাচাই-টেস্ট: ডেশবোর্ডে একটি পরীক্ষামূলক লেখা বানিয়ে ট্র্যাশে পাঠান → 'ট্র্যাশ খালি করুন' ⇒ মুছে যাওয়া উচিত।

## অফসাইট কপি খুলবেন যেভাবে (পিসি/টার্মিনাল লাগবে; প্রয়োজনের দিনের জন্য)
```
unzip offsite-backup-encrypted.zip
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass pass:'আপনার-পাসফ্রেজ' -in offsite-backup-YYYYMMDD-HHMM.tar.enc | tar -x
```
ভেতরের `*.json` ফাইলগুলো ডেশবোর্ড → ব্যাকআপ → পুনরুদ্ধারে (restore) সরাসরি ব্যবহারযোগ্য (Drive-ফাইলের একই ফরম্যাট)।

## শ্রিঙ্ক-গার্ডে backup লাল হলে
আগে নিশ্চিত হন কমা ইচ্ছাকৃত কিনা (যেমন বড় ট্র্যাশ খালি করেছেন)। ইচ্ছাকৃত হলে Actions → backup → Run (manual) — সেটাই নতুন baseline, পরের auto-backup স্বাভাবিক। ইচ্ছাকৃত না হলে **কিছু মুছবেন না/restore করবেন না** — ভালো কপি Drive-এ অক্ষত; আমাকে জানান।

## ফেরত-পথ (rollback)
- rules: `firestore.rules.tpl`-এ `allow delete` লাইন আগের `allow read, delete: if isOwner();`-এ ফিরিয়ে `deploy-rules` চালান।
- backup: `backup.yml` পুরনোটা ফেরান; শ্রিঙ্ক-গার্ড অন্য পরিবর্তনের সাথে commit-revert-এ যায়।

## সীমা (খোলাখুলি)
- artifact ৯০ দিনের বেশি থাকে না; GitHub-এর সময়সীমা/অ্যাকাউন্ট একই GitHub-অ্যাকাউন্টে — Google থেকে স্বতন্ত্র, কিন্তু GitHub থেকে নয়। ভবিষ্যতে Cloudflare R2/Backblaze B2 যোগ করা যায় (পেমেন্ট-কার্ড লাগতে পারে)।
- `BACKUP_PASSPHRASE` হারালে artifact অপাঠ্য; Drive-কপি অক্ষত থাকে।
- আসল GitHub/Drive/Firestore-এ এই পরিবর্তন আমি চালাইনি; ইউনিট-টেস্ট (১০০৮ পাস), tsc ও eslint পাস; rules-test (Emulator) CI-তে চলবে — এখানে চালানো যায়নি।
