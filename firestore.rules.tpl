rules_version = '2';
// P1b: posts / slugs / siteSettings · P2a: drafts · P3a: categories / tags / series · P3b: ideas / notes · P5a: revisions (Arch §৯)। বাকি collection phase-অনুযায়ী যোগ হয়; বাকি সব deny-all।
// placeholder scripts/render-rules.ts বসায়; rendered firestore.rules git-এ commit হয় না।
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == '__OWNER_UID__';
    }
    function validPost() {
      return request.resource.data.title is string
          && request.resource.data.ownerUid == '__OWNER_UID__'
          && request.resource.data.status in __POST_STATUS__
          && request.resource.data.visibility in __POST_VISIBILITY__;
    }

    match /posts/{postId} {
      // পাবলিক query-তে explicit status/visibility filter বাধ্যতামূলক (Arch §২)
      allow read: if resource.data.status == 'published'
                  && resource.data.visibility == 'public';
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

    // লেখার ইতিহাস-snapshot: owner read/create; update/delete নিষিদ্ধ — prune শুধু Cron (privileged, P5a-৩) (Arch §৯ P5a)
    match /revisions/{revisionId} {
      allow read, create: if isOwner();
      allow update, delete: if false;
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
