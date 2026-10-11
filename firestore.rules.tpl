rules_version = '2';
// P1b: posts / slugs / siteSettings · P2a: drafts · P3a: categories / tags / series · P3b: ideas / notes · P4b: pages · P5a: revisions · P5b: backups · P6: media · P7b: templates · P11b: comments · P11c: shareLinks · P12-৩: bookmarks / highlights · P14a-১: writingProjects / chapters (Arch §৯)। বাকি collection phase-অনুযায়ী যোগ হয়; বাকি সব deny-all।
// placeholder scripts/render-rules.ts বসায়; rendered firestore.rules git-এ commit হয় না।
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == '__OWNER_UID__';
    }
    function validPage() {
      return request.resource.data.title is string
          && request.resource.data.ownerUid == '__OWNER_UID__'
          && request.resource.data.status in __PAGE_STATUS__;
    }
    function validPost() {
      return request.resource.data.title is string
          && request.resource.data.ownerUid == '__OWNER_UID__'
          && request.resource.data.status in __POST_STATUS__
          && request.resource.data.visibility in __POST_VISIBILITY__;
    }

    function validMedia() {
      return request.resource.data.ownerUid == request.auth.uid // isOwner() আগেই যাচাই ⇒ সমতুল্য; Console-paste-এ uid লাগে না
          && request.resource.data.type in __MEDIA_TYPE__
          && request.resource.data.deliveryType in __MEDIA_DELIVERY__
          && request.resource.data.visibility in __MEDIA_VISIBILITY__;
    }

    function validProject() {
      return request.resource.data.title is string
          && request.resource.data.ownerUid == '__OWNER_UID__'
          && request.resource.data.type in __PROJECT_TYPE__
          && request.resource.data.status in __PROJECT_STATUS__
          && request.resource.data.visibility in __PROJECT_VISIBILITY__;
    }
    function validChapter() {
      return request.resource.data.title is string
          && request.resource.data.ownerUid == '__OWNER_UID__'
          && request.resource.data.projectId is string
          && request.resource.data.order is int
          && request.resource.data.status in __CHAPTER_STATUS__
          && request.resource.data.visibility in __CHAPTER_VISIBILITY__;
    }

    match /posts/{postId} {
      // পাবলিক query-তে explicit status/visibility filter বাধ্যতামূলক (Arch §২)
      allow read: if resource.data.status == 'published'
                  && resource.data.visibility in ['public', 'unlisted'];
      allow read, delete: if isOwner();
      allow create: if isOwner() && validPost();
      allow update: if isOwner() && validPost()
                    && request.resource.data.ownerUid == resource.data.ownerUid;
    }

    // uniqueness-lock: শুধু owner; update নিষিদ্ধ ⇒ একই slug-এ দ্বিতীয় create ব্যর্থ
    match /slugs/{slug} {
      allow read, create, delete: if isOwner();
      allow update: if false;
    }

    // প্রকাশিত লেখার অপ্রকাশিত সম্পাদনা — শুধু owner; পাবলিক read নেই
    match /drafts/{targetId} {
      allow read, write: if isOwner();
    }

    // নাম/বিবরণ পাবলিক-readable; লেখা শুধু owner (Arch §৬/§৯)
    match /categories/{id} {
      allow read: if true;
      allow write: if isOwner();
    }
    match /tags/{id} {
      allow read: if true;
      allow write: if isOwner();
    }
    match /series/{id} {
      allow read: if true;
      allow write: if isOwner();
    }

    // আইডিয়া ও Inbox-নোট — শুধু owner; পাবলিক read নেই (Arch §৯ P3b)
    match /ideas/{id} {
      allow read, write: if isOwner();
    }
    match /notes/{id} {
      allow read, write: if isOwner();
    }

    // share-link (P11c-২): শুধু owner; doc-ID = token-এর SHA-256 (token নিজে নেই)। পাঠক Worker-এর privileged পথে — rules-এ পাবলিক read নেই
    match /shareLinks/{hash} {
      allow read, delete: if isOwner();
      allow create, update: if isOwner()
                            && request.resource.data.ownerUid == '__OWNER_UID__'
                            && request.resource.data.postId is string
                            && request.resource.data.expiresAt is timestamp;
    }

    // owner-এর বুকমার্ক (P12-৩): doc-ID = postId; পাবলিক read নেই
    match /bookmarks/{postId} {
      allow read, delete: if isOwner();
      allow create, update: if isOwner()
                            && request.resource.data.ownerUid == '__OWNER_UID__'
                            && request.resource.data.postId == postId;
    }

    // owner-এর হাইলাইট (P12-৩): নির্বাচিত plain-text উদ্ধৃতি (≤৬০০ অক্ষর); পাবলিক read নেই
    match /highlights/{id} {
      allow read, delete: if isOwner();
      allow create, update: if isOwner()
                            && request.resource.data.ownerUid == '__OWNER_UID__'
                            && request.resource.data.postId is string
                            && request.resource.data.quote is string
                            && request.resource.data.quote.size() > 0
                            && request.resource.data.quote.size() <= 2400;
    }

    // Writing Project (P14a-১): published+public পাবলিক-read (build-সময়ে REST; query-তে explicit status/visibility filter), বাকি শুধু owner।
    // update-এ ownerUid অপরিবর্তনীয়। অধ্যায়-সহ প্রজেক্ট মোছার guard repo-তে (rules-এ query চলে না)।
    match /writingProjects/{projectId} {
      allow read: if resource.data.status == 'published' && resource.data.visibility == 'public';
      allow read, delete: if isOwner();
      allow create: if isOwner() && validProject();
      allow update: if isOwner() && validProject()
                    && request.resource.data.ownerUid == resource.data.ownerUid;
    }

    // অধ্যায় (P14a-১): পাবলিক-read-এ অধ্যায় published+public এবং তার প্রজেক্টও published+public — দুটোই rules-এ (UI/build-নির্ভর নয়)।
    // পাবলিক পড়া doc-id ধরে (get) নিশ্চিতভাবে চলে; filter-সহ query-র পথ P14c-তে CI-তে যাচাই হয়ে চূড়ান্ত হবে। filter ছাড়া query সবসময় ব্যর্থ।
    // স্থায়ী মোছা শুধু ট্র্যাশ-করা অধ্যায়ে (স্বয়ংক্রিয় purge নেই — শুধু হাতে + confirm)।
    match /chapters/{chapterId} {
      allow read: if resource.data.status == 'published' && resource.data.visibility == 'public'
                  && get(/databases/$(database)/documents/writingProjects/$(resource.data.projectId)).data.status == 'published'
                  && get(/databases/$(database)/documents/writingProjects/$(resource.data.projectId)).data.visibility == 'public';
      allow read: if isOwner();
      allow delete: if isOwner() && resource.data.status == 'trashed';
      allow create: if isOwner() && validChapter();
      allow update: if isOwner() && validChapter()
                    && request.resource.data.ownerUid == resource.data.ownerUid
                    && request.resource.data.projectId == resource.data.projectId;
    }

    // মন্তব্য (P11b-১): approved পাবলিক-read (build-সময়ে REST; query-তে explicit status filter), বাকি (pending/spam) শুধু owner; client write নেই — জমা/মোছা/লুকানো শুধু Worker-এর privileged পথে
    match /comments/{commentId} {
      allow read: if resource.data.status == 'approved';
      allow read: if isOwner();
      allow write: if false;
    }

    // নিজের লেখার ছাঁচ (P7b-২) — শুধু owner; পাবলিক read নেই
    match /templates/{id} {
      allow read, write: if isOwner();
    }

    // পেজ (P4b-১): published পাবলিক-read (query-তে explicit status filter), draft শুধু owner; system পেজ মোছা নিষিদ্ধ (Arch §৯ P4b)
    match /pages/{slug} {
      allow read: if resource.data.status == 'published';
      allow read: if isOwner();
      allow create, update: if isOwner() && validPage();
      allow delete: if isOwner() && resource.data.get('system', false) != true;
    }

    // লেখার ইতিহাস-snapshot: owner read/create; update/delete নিষিদ্ধ — prune শুধু Cron (privileged, P5a-৩) (Arch §৯ P5a)
    match /revisions/{revisionId} {
      allow read, create: if isOwner();
      allow update, delete: if false;
    }

    // Backup-মেটা (সম্পূর্ণ সফল backup-এর রেকর্ড): owner read; client write নেই — লেখে শুধু backup job (privileged, P5b-২) (Arch §৯ P5b)
    match /backups/{backupId} {
      allow read: if isOwner();
      allow write: if false;
    }

    // মিডিয়া-মেটা (P6): visibility=='public' পাবলিক-read (build-সময়ে cover/logo; doc-id ধরে get, query-তে explicit filter); private শুধু owner।
    // public doc-এ location/capturedAt না রাখা (UI-তে public ছবিতে এই দুই ফিল্ড নেই)। write শুধু owner + validMedia।
    match /media/{mediaId} {
      allow read: if resource.data.visibility == 'public';
      allow read, delete: if isOwner();
      allow create: if isOwner() && validMedia();
      allow update: if isOwner() && validMedia()
                    && request.resource.data.ownerUid == resource.data.ownerUid;
    }

    match /siteSettings/{docId} {
      allow read: if true;
      allow write: if isOwner();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
