rules_version = '2';
// P0c: deny-all। collection-rules P1b থেকে phase-অনুযায়ী যোগ হয় (Arch §৯)।
// placeholder scripts/render-rules.ts বসায়; rendered firestore.rules git-এ commit হয় না।
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == '__OWNER_UID__';
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
