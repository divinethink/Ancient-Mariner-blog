# পার্ট ৩ — handler-স্তরে session যাচাই ও CI-র পর deploy

## ১. `/api/owner/*` — session পুনঃযাচাই
- নতুন `src/app/api/owner/requireOwner.ts`: একই `verifySessionToken` (middleware-এর মতো) handler-এও চলে। বৈধ নয় ⇒ ৪০১; env অসম্পূর্ণ ⇒ ৫০০ (fail-closed)।
- যুক্ত: `comments`, `rebuild`, `backup`, `stats` route ও `media/guard.ts` (ফলে `media/sign|url|import|delete` সব)।
- আচরণ অপরিবর্তিত (middleware আগের মতোই); শুধু দ্বিতীয় স্তর। টেস্ট: `requireOwner.test.ts` (বৈধ/নেই/tamper/অন্য owner/ভুল secret/মেয়াদ-শেষ/env-নেই)।

## ২. Deploy এখন CI সবুজ হলে (`deploy.yml`, `unzip.yml` — আলাদা ফাইল)
- আগে: `push: main`-এ deploy ও ci সমান্তরালে (ci লাল হলেও deploy)। এখন: ci শেষ হলে `workflow_run`, **শুধু সফল হলে** deploy; ঠিক যে commit-এ CI সবুজ সেটাই deploy।
- অপরিবর্তিত: ড্যাশবোর্ডের rebuild/প্রকাশ (`workflow_dispatch`), হাতে Run, ৬-ঘণ্টার schedule — এগুলো gate-এর বাইরে।
- `unzip.yml` থেকে সরাসরি "Trigger deploy" ধাপ বাদ (নইলে CI-gate এড়ানো যেত); ZIP-আপলোড ⇒ unzip ⇒ ci (dispatch) ⇒ সফল হলে deploy।
- জানা সীমা: unzip-এর `gh workflow run ci.yml` (GITHUB_TOKEN-dispatch) থেকে `workflow_run` ঠিকমতো জ্বলে কিনা প্রথম ZIP-আপলোডে দেখতে হবে (**Not Verified**)। না জ্বললে: Actions → deploy → Run workflow (হাতে), বা ≤৬ ঘণ্টায় schedule।
- CI লাল থাকলে ইচ্ছাকৃতভাবেই deploy হবে না; জরুরিতে হাতে Run করা যায়।

## ফেরত-পথ
`deploy.yml`/`unzip.yml` পুরনো সংস্করণ বসান; কোড-অংশ commit-revert।
