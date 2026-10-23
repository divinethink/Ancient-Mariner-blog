// Firestore rules-test (Emulator; CI-তে `npm run test:rules`) — Checklist P1b / Arch §৯
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890"; // scripts/render-rules.ts-এর TEST_UID-এর সাথে মিল
let env: RulesTestEnvironment;

const post = (o: Record<string, unknown> = {}) => ({
  title: "শিরোনাম",
  ownerUid: OWNER,
  status: "draft",
  visibility: "private",
  ...o,
});
// rules-unit-testing-এর টাইপ সংস্করণভেদে compat হতে পারে; রানটাইমে modular ফাংশন চলে — তাই cast
const fs = (x: unknown) => x as Firestore;
const owner = () => fs(env.authenticatedContext(OWNER).firestore());
const other = () => fs(env.authenticatedContext("someoneElse123456").firestore());
const anon = () => fs(env.unauthenticatedContext().firestore());
const seed = (path: string, id: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(fs(ctx.firestore()), path, id), data));

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({ projectId: "demo-ancientmarinerblog", firestore: { rules } });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("posts", () => {
  it("(১) owner create/update/delete পারে; অন্য uid ও anonymous পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "posts", "a"), post()));
    await assertSucceeds(updateDoc(doc(owner(), "posts", "a"), { title: "নতুন" }));
    await assertFails(setDoc(doc(other(), "posts", "b"), post()));
    await assertFails(setDoc(doc(anon(), "posts", "b"), post()));
    await assertFails(updateDoc(doc(other(), "posts", "a"), { title: "হ্যাক" }));
    await assertFails(deleteDoc(doc(other(), "posts", "a")));
    await assertSucceeds(deleteDoc(doc(owner(), "posts", "a")));
  });

  it("(২) ownerUid immutable ও অবৈধ মান/enum আটকায়", async () => {
    await seed("posts", "a", post());
    await assertFails(updateDoc(doc(owner(), "posts", "a"), { ownerUid: "other" }));
    await assertFails(setDoc(doc(owner(), "posts", "x"), post({ ownerUid: "other" })));
    await assertFails(setDoc(doc(owner(), "posts", "y"), post({ status: "bogus" })));
    await assertFails(setDoc(doc(owner(), "posts", "z"), post({ visibility: "secret" })));
    await assertFails(setDoc(doc(owner(), "posts", "t"), post({ title: 5 })));
  });

  it("(৩) draft/private পাবলিক পায় না; published+public পায়", async () => {
    await seed("posts", "d", post());
    await seed("posts", "pr", post({ status: "published", visibility: "private" }));
    await seed("posts", "pub", post({ status: "published", visibility: "public" }));
    await assertFails(getDoc(doc(anon(), "posts", "d")));
    await assertFails(getDoc(doc(other(), "posts", "pr")));
    await assertSucceeds(getDoc(doc(anon(), "posts", "pub")));
    await assertSucceeds(getDoc(doc(owner(), "posts", "d")));
  });

  it("(৩খ) P11c-১: scheduled পাবলিক পায় না; unlisted শুধু get-এ (explicit published) পায়, public-filter query-তে আসে না; enum লেখা যায়", async () => {
    await seed("posts", "sc", post({ status: "scheduled", visibility: "public" }));
    await seed("posts", "un", post({ status: "published", visibility: "unlisted" }));
    await assertFails(getDoc(doc(anon(), "posts", "sc")));
    await assertSucceeds(getDoc(doc(anon(), "posts", "un")));
    await assertSucceeds(getDocs(query(collection(anon(), "posts"), where("status", "==", "published"), where("visibility", "==", "unlisted"))));
    await assertSucceeds(setDoc(doc(owner(), "posts", "n1"), post({ status: "scheduled", scheduledAt: new Date() })));
    await assertSucceeds(setDoc(doc(owner(), "posts", "n2"), post({ visibility: "unlisted" })));
    await assertFails(setDoc(doc(other(), "posts", "n3"), post({ status: "scheduled" })));
  });

  it("(৩ক) build-এর query: explicit filter সহ সফল, filter ছাড়া ব্যর্থ", async () => {
    await seed("posts", "d", post());
    await seed("posts", "pub", post({ status: "published", visibility: "public" }));
    const c = collection(anon(), "posts");
    await assertSucceeds(getDocs(query(c, where("status", "==", "published"), where("visibility", "==", "public"))));
    await assertFails(getDocs(c));
    await assertFails(getDocs(query(c, where("status", "==", "published"))));
  });
});

describe("slugs", () => {
  it("(৫) একই slug-এ দ্বিতীয় create ব্যর্থ; update নিষিদ্ধ", async () => {
    await assertSucceeds(setDoc(doc(owner(), "slugs", "আমার-লেখা"), { postId: "a" }));
    await assertFails(setDoc(doc(owner(), "slugs", "আমার-লেখা"), { postId: "b" }));
    await assertFails(updateDoc(doc(owner(), "slugs", "আমার-লেখা"), { postId: "b" }));
  });

  it("(৬) non-owner/anonymous read ও write পারে না", async () => {
    await seed("slugs", "s", { postId: "a" });
    await assertFails(getDoc(doc(other(), "slugs", "s")));
    await assertFails(getDoc(doc(anon(), "slugs", "s")));
    await assertFails(setDoc(doc(other(), "slugs", "t"), { postId: "b" }));
    await assertSucceeds(getDoc(doc(owner(), "slugs", "s")));
  });
});

describe("siteSettings", () => {
  it("(৪) public read; non-owner write ব্যর্থ; owner write সফল", async () => {
    await seed("siteSettings", "main", { siteTitle: "x" });
    await assertSucceeds(getDoc(doc(anon(), "siteSettings", "main")));
    await assertFails(setDoc(doc(other(), "siteSettings", "main"), { siteTitle: "hack" }));
    await assertFails(setDoc(doc(anon(), "siteSettings", "main"), { siteTitle: "hack" }));
    await assertSucceeds(setDoc(doc(owner(), "siteSettings", "main"), { siteTitle: "y" }));
  });
});

// নতুন owner-only collection যোগে এই তালিকায় এক লাইন (Arch §৯)
const OWNER_ONLY_COLLECTIONS = ["drafts", "ideas", "notes", "templates", "letters", "quotes"];
describe.each(OWNER_ONLY_COLLECTIONS)("owner-only: %s", (name) => {
  it("owner read/write পারে; non-owner ও anonymous পারে না", async () => {
    await seed(name, "a", { title: "x", ownerUid: OWNER });
    await assertSucceeds(getDoc(doc(owner(), name, "a")));
    await assertSucceeds(setDoc(doc(owner(), name, "b"), { title: "y", ownerUid: OWNER }));
    await assertFails(getDoc(doc(other(), name, "a")));
    await assertFails(getDoc(doc(anon(), name, "a")));
    await assertFails(setDoc(doc(other(), name, "c"), { title: "z" }));
    await assertFails(deleteDoc(doc(other(), name, "a")));
    await assertFails(getDocs(collection(anon(), name)));
  });
});

// P5a: revisions — owner read/create; update/delete কারো জন্য নয় (prune শুধু Cron/privileged) (Arch §৯)
describe("revisions", () => {
  const rev = { targetType: "post", targetId: "p1", snapshot: "{}", versionNumber: 1, trigger: "manual", ownerUid: OWNER };
  it("owner read/create পারে; update/delete owner-ও পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "revisions", "r1"), rev));
    await assertSucceeds(getDoc(doc(owner(), "revisions", "r1")));
    await assertFails(updateDoc(doc(owner(), "revisions", "r1"), { snapshot: "x" }));
    await assertFails(setDoc(doc(owner(), "revisions", "r1"), rev)); // বিদ্যমান id-তে overwrite = update
    await assertFails(deleteDoc(doc(owner(), "revisions", "r1")));
  });
  it("non-owner ও anonymous read/create পারে না", async () => {
    await seed("revisions", "r2", rev);
    await assertFails(getDoc(doc(other(), "revisions", "r2")));
    await assertFails(getDoc(doc(anon(), "revisions", "r2")));
    await assertFails(setDoc(doc(other(), "revisions", "r3"), rev));
    await assertFails(setDoc(doc(anon(), "revisions", "r3"), rev));
    await assertFails(getDocs(collection(anon(), "revisions")));
    await assertFails(deleteDoc(doc(other(), "revisions", "r2")));
  });
});

// P3a: নাম/বিবরণ public-read, লেখা শুধু owner (Arch §৯)
describe.each(["categories", "tags", "series"])("taxonomy: %s", (name) => {
  it("public read সফল; non-owner/anonymous write ব্যর্থ; owner write সফল", async () => {
    await seed(name, "a", { name: "ভ্রমণ", ownerUid: OWNER });
    await assertSucceeds(getDoc(doc(anon(), name, "a")));
    await assertSucceeds(getDocs(collection(anon(), name)));
    await assertSucceeds(setDoc(doc(owner(), name, "b"), { name: "ডায়েরি", ownerUid: OWNER }));
    await assertSucceeds(deleteDoc(doc(owner(), name, "b")));
    await assertFails(setDoc(doc(other(), name, "c"), { name: "হ্যাক" }));
    await assertFails(setDoc(doc(anon(), name, "c"), { name: "হ্যাক" }));
    await assertFails(updateDoc(doc(other(), name, "a"), { name: "হ্যাক" }));
    await assertFails(deleteDoc(doc(other(), name, "a")));
  });
});

// P5b: backups — owner read; client write কারো জন্য নয় (লেখে শুধু backup job/privileged) (Arch §৯)
describe("backups", () => {
  const meta = { type: "auto", status: "complete", ownerUid: OWNER };
  it("owner read পারে; owner-ও write/delete পারে না", async () => {
    await seed("backups", "b1", meta);
    await assertSucceeds(getDoc(doc(owner(), "backups", "b1")));
    await assertSucceeds(getDocs(collection(owner(), "backups")));
    await assertFails(setDoc(doc(owner(), "backups", "b2"), meta));
    await assertFails(updateDoc(doc(owner(), "backups", "b1"), { status: "x" }));
    await assertFails(deleteDoc(doc(owner(), "backups", "b1")));
  });
  it("non-owner ও anonymous read/write পারে না", async () => {
    await seed("backups", "b3", meta);
    await assertFails(getDoc(doc(other(), "backups", "b3")));
    await assertFails(getDoc(doc(anon(), "backups", "b3")));
    await assertFails(getDocs(collection(anon(), "backups")));
    await assertFails(setDoc(doc(other(), "backups", "b4"), meta));
    await assertFails(setDoc(doc(anon(), "backups", "b4"), meta));
    await assertFails(deleteDoc(doc(other(), "backups", "b3")));
  });
});

// P6: media — visibility=='public' পাবলিক-read (explicit filter); private শুধু owner; write owner + validMedia (Arch §৯)
describe("media", () => {
  const m = (visibility: string, extra: Record<string, unknown> = {}) => ({
    type: "image",
    deliveryType: visibility === "public" ? "upload" : "authenticated",
    visibility,
    cloudinaryPublicId: "blog/x",
    ownerUid: OWNER,
    ...extra,
  });
  it("public পাবলিক পড়া যায়; private anonymous/non-owner পড়তে পারে না; owner পারে", async () => {
    await seed("media", "pub", m("public"));
    await seed("media", "priv", m("private"));
    await assertSucceeds(getDoc(doc(anon(), "media", "pub")));
    await assertFails(getDoc(doc(anon(), "media", "priv")));
    await assertFails(getDoc(doc(other(), "media", "priv")));
    await assertSucceeds(getDoc(doc(owner(), "media", "priv")));
  });
  it("পাবলিক query শুধু visibility==public filter-সহ সফল; filter ছাড়া ব্যর্থ", async () => {
    await seed("media", "pub", m("public"));
    await seed("media", "priv", m("private"));
    const col = collection(anon(), "media");
    const snap = await assertSucceeds(getDocs(query(col, where("visibility", "==", "public"))));
    expect(snap.docs.map((d) => d.id)).toEqual(["pub"]);
    await assertFails(getDocs(col));
  });
  it("write: শুধু owner; অবৈধ enum ও ভুল ownerUid ব্যর্থ; ownerUid বদলানো ব্যর্থ", async () => {
    await assertSucceeds(setDoc(doc(owner(), "media", "a"), m("public")));
    await assertSucceeds(setDoc(doc(owner(), "media", "b"), m("private")));
    await assertFails(setDoc(doc(other(), "media", "c"), m("public")));
    await assertFails(setDoc(doc(anon(), "media", "c"), m("public")));
    await assertFails(setDoc(doc(owner(), "media", "d"), m("secret")));
    await assertFails(setDoc(doc(owner(), "media", "e"), m("public", { type: "video" })));
    await assertFails(setDoc(doc(owner(), "media", "f"), m("public", { deliveryType: "signed" })));
    await assertFails(setDoc(doc(owner(), "media", "g"), m("public", { ownerUid: "someoneElse" })));
    await assertFails(updateDoc(doc(owner(), "media", "a"), { ownerUid: "someoneElse123456" }));
    await assertSucceeds(updateDoc(doc(owner(), "media", "a"), { altText: "সৈকত" }));
    await assertFails(deleteDoc(doc(other(), "media", "a")));
    await assertSucceeds(deleteDoc(doc(owner(), "media", "a")));
  });
});

describe("posts: P3a enum", () => {
  it("archived status ও আগের মান চলে; অবৈধ মান আটকায়", async () => {
    await assertSucceeds(setDoc(doc(owner(), "posts", "x"), post({ status: "archived" })));
    await assertFails(setDoc(doc(owner(), "posts", "y"), post({ status: "bogus" })));
  });
});

describe("অন্য collection", () => {
  it("অনির্ধারিত collection-এ owner-ও read/write পারে না (deny-all)", async () => {
    await assertFails(setDoc(doc(owner(), "unknown", "a"), { x: 1 }));
    await assertFails(getDoc(doc(owner(), "unknown", "a")));
  });
});

// P4b-১: pages — published পাবলিক-read (explicit filter), draft শুধু owner; system পেজ delete নিষিদ্ধ (Arch §৯)
describe("pages", () => {
  const pg = (status: string, extra: Record<string, unknown> = {}) => ({ title: "এই আমি", body: "{}", status, ownerUid: OWNER, ...extra });
  it("published পাবলিক পড়া যায়; draft anonymous/non-owner পড়তে পারে না; owner পারে", async () => {
    await seed("pages", "about", pg("published"));
    await seed("pages", "wip", pg("draft"));
    await assertSucceeds(getDoc(doc(anon(), "pages", "about")));
    await assertFails(getDoc(doc(anon(), "pages", "wip")));
    await assertFails(getDoc(doc(other(), "pages", "wip")));
    await assertSucceeds(getDoc(doc(owner(), "pages", "wip")));
  });
  it("পাবলিক query শুধু status==published filter-সহ সফল; filter ছাড়া ব্যর্থ", async () => {
    await seed("pages", "about", pg("published"));
    await seed("pages", "wip", pg("draft"));
    const col = collection(anon(), "pages");
    const snap = await assertSucceeds(getDocs(query(col, where("status", "==", "published"))));
    expect(snap.docs.map((d) => d.id)).toEqual(["about"]);
    await assertFails(getDocs(col));
  });
  it("write: শুধু owner; অবৈধ status ও ভুল ownerUid ব্যর্থ", async () => {
    await assertSucceeds(setDoc(doc(owner(), "pages", "a"), pg("draft")));
    await assertFails(setDoc(doc(other(), "pages", "b"), pg("draft")));
    await assertFails(setDoc(doc(anon(), "pages", "b"), pg("draft")));
    await assertFails(setDoc(doc(owner(), "pages", "c"), pg("trashed")));
    await assertFails(setDoc(doc(owner(), "pages", "d"), pg("draft", { ownerUid: "someoneElse" })));
    await assertSucceeds(updateDoc(doc(owner(), "pages", "a"), { status: "published" }));
    await assertFails(updateDoc(doc(owner(), "pages", "a"), { status: "nope" }));
  });
  it("delete: সাধারণ পেজ owner পারে; system==true পেজ owner-ও পারে না; non-owner পারে না", async () => {
    await seed("pages", "x", pg("draft"));
    await seed("pages", "about", pg("draft", { system: true }));
    await assertFails(deleteDoc(doc(other(), "pages", "x")));
    await assertSucceeds(deleteDoc(doc(owner(), "pages", "x")));
    await assertFails(deleteDoc(doc(owner(), "pages", "about")));
  });
});

describe("shareLinks (P11c-২)", () => {
  const link = (extra: Record<string, unknown> = {}) => ({ postId: "p1", ownerUid: OWNER, expiresAt: new Date(Date.now() + 86_400_000), ...extra });
  it("পাবলিক/অন্য ব্যবহারকারী পড়তে বা লিখতে পারে না; owner পারে", async () => {
    await seed("shareLinks", "h1", link());
    await assertFails(getDoc(doc(anon(), "shareLinks", "h1")));
    await assertFails(getDoc(doc(other(), "shareLinks", "h1")));
    await assertFails(setDoc(doc(other(), "shareLinks", "h2"), link()));
    await assertSucceeds(getDoc(doc(owner(), "shareLinks", "h1")));
    await assertSucceeds(setDoc(doc(owner(), "shareLinks", "h2"), link()));
    await assertSucceeds(updateDoc(doc(owner(), "shareLinks", "h1"), { revokedAt: new Date() }));
    await assertSucceeds(deleteDoc(doc(owner(), "shareLinks", "h1")));
  });
  it("অবৈধ আকার আটকায় (expiresAt timestamp নয়, ownerUid ভুল, postId নেই)", async () => {
    await assertFails(setDoc(doc(owner(), "shareLinks", "b1"), link({ expiresAt: "kal" })));
    await assertFails(setDoc(doc(owner(), "shareLinks", "b2"), link({ ownerUid: "other" })));
    await assertFails(setDoc(doc(owner(), "shareLinks", "b3"), link({ postId: 5 })));
  });
});

describe("comments (P11b-১)", () => {
  const cm = (status: string, extra: Record<string, unknown> = {}) => ({ postId: "p1", authorName: "পাঠক", content: "ভালো লাগল", status, ownerUid: OWNER, ...extra });
  it("approved পাবলিক পড়তে পারে; pending/spam পারে না (get ও query দুই পথে)", async () => {
    await seed("comments", "a1", cm("approved"));
    await seed("comments", "s1", cm("spam"));
    await seed("comments", "p9", cm("pending"));
    await assertSucceeds(getDoc(doc(anon(), "comments", "a1")));
    await assertFails(getDoc(doc(anon(), "comments", "s1")));
    await assertFails(getDoc(doc(anon(), "comments", "p9")));
    await assertSucceeds(getDocs(query(collection(anon(), "comments"), where("status", "==", "approved"))));
    await assertFails(getDocs(collection(anon(), "comments"))); // filter ছাড়া পুরো collection নয়
    await assertFails(getDocs(query(collection(anon(), "comments"), where("status", "==", "spam"))));
  });
  it("owner সব status পড়তে পারে", async () => {
    await seed("comments", "s1", cm("spam"));
    await assertSucceeds(getDoc(doc(owner(), "comments", "s1")));
  });
  it("কেউ — owner-সহ — client থেকে লিখতে/বদলাতে/মুছতে পারে না", async () => {
    await seed("comments", "a1", cm("approved"));
    for (const db of [anon(), other(), owner()]) {
      await assertFails(setDoc(doc(db, "comments", "n1"), cm("approved")));
      await assertFails(updateDoc(doc(db, "comments", "a1"), { status: "spam" }));
      await assertFails(deleteDoc(doc(db, "comments", "a1")));
    }
  });
});

// P12-৩: bookmarks (doc-ID = postId) ও highlights — শুধু owner; পাবলিক/অন্য ব্যবহারকারী কিছুই পারে না
describe("bookmarks / highlights (P12-৩)", () => {
  const bm = { postId: "p1", postTitle: "ক", ownerUid: OWNER };
  const hl = { postId: "p1", postTitle: "ক", quote: "একটি নির্বাচিত উদ্ধৃতি", ownerUid: OWNER };
  it("owner create/read/delete পারে", async () => {
    await assertSucceeds(setDoc(doc(owner(), "bookmarks", "p1"), bm));
    await assertSucceeds(getDoc(doc(owner(), "bookmarks", "p1")));
    await assertSucceeds(deleteDoc(doc(owner(), "bookmarks", "p1")));
    await assertSucceeds(setDoc(doc(owner(), "highlights", "h1"), hl));
    await assertSucceeds(getDoc(doc(owner(), "highlights", "h1")));
    await assertSucceeds(deleteDoc(doc(owner(), "highlights", "h1")));
  });
  it("অবৈধ ফিল্ড (doc-ID≠postId, ভুল ownerUid, খালি/অতিদীর্ঘ/non-string quote) ব্যর্থ", async () => {
    await assertFails(setDoc(doc(owner(), "bookmarks", "p2"), bm)); // postId ≠ doc-ID
    await assertFails(setDoc(doc(owner(), "bookmarks", "p1"), { ...bm, ownerUid: "x" }));
    await assertFails(setDoc(doc(owner(), "highlights", "h2"), { ...hl, quote: "" }));
    await assertFails(setDoc(doc(owner(), "highlights", "h2"), { ...hl, quote: "অ".repeat(2401) }));
    await assertFails(setDoc(doc(owner(), "highlights", "h2"), { ...hl, quote: 5 }));
    await assertFails(setDoc(doc(owner(), "highlights", "h2"), { ...hl, ownerUid: "x" }));
  });
  it("non-owner ও anonymous read/write/list পারে না", async () => {
    await seed("bookmarks", "p3", { ...bm, postId: "p3" });
    await seed("highlights", "h3", hl);
    for (const [name, id] of [["bookmarks", "p3"], ["highlights", "h3"]] as const) {
      await assertFails(getDoc(doc(other(), name, id)));
      await assertFails(getDoc(doc(anon(), name, id)));
      await assertFails(getDocs(collection(anon(), name)));
      await assertFails(setDoc(doc(other(), name, "z"), name === "bookmarks" ? { ...bm, postId: "z" } : hl));
      await assertFails(deleteDoc(doc(other(), name, id)));
    }
  });
});

// P14a-১: writingProjects / chapters — পাবলিক-read শুধু (অধ্যায় ও তার প্রজেক্ট, দুটোই) published+public; owner write; স্থায়ী মোছা শুধু ট্র্যাশে
describe("writingProjects / chapters (P14a-১)", () => {
  const proj = (o: Record<string, unknown> = {}) => ({
    title: "প্রাচীন নাবিক",
    slug: "প্রাচীন-নাবিক",
    type: "novel",
    status: "draft",
    visibility: "private",
    ownerUid: OWNER,
    ...o,
  });
  const chap = (o: Record<string, unknown> = {}) => ({
    projectId: "p1",
    title: "প্রথম অধ্যায়",
    slug: "প্রথম-অধ্যায়",
    body: "",
    order: 0,
    status: "draft",
    visibility: "private",
    ownerUid: OWNER,
    ...o,
  });
  const PUB = { status: "published", visibility: "public" };

  it("প্রজেক্ট: owner create/update পারে; অবৈধ ধরন/enum/ownerUid ও অন্য uid/anonymous পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "writingProjects", "p1"), proj()));
    await assertSucceeds(updateDoc(doc(owner(), "writingProjects", "p1"), { title: "নতুন" }));
    await assertSucceeds(setDoc(doc(owner(), "writingProjects", "p3"), proj({ type: "গবেষণা" }))); // মুক্ত ধরন বৈধ
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ type: "" })));
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ type: "ক".repeat(41) })));
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ type: 5 })));
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ status: "scheduled" })));
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ visibility: "unlisted" })));
    await assertFails(setDoc(doc(owner(), "writingProjects", "p2"), proj({ ownerUid: "someoneElse123456" })));
    await assertFails(updateDoc(doc(owner(), "writingProjects", "p1"), { ownerUid: "someoneElse123456" }));
    await assertFails(setDoc(doc(other(), "writingProjects", "p3"), proj()));
    await assertFails(setDoc(doc(anon(), "writingProjects", "p3"), proj()));
    await assertFails(updateDoc(doc(other(), "writingProjects", "p1"), { title: "হ্যাক" }));
  });

  it("প্রজেক্ট: published+public পাবলিক পায়; draft/private/archived পায় না (owner পায়)", async () => {
    await seed("writingProjects", "pub", proj(PUB));
    await seed("writingProjects", "priv", proj({ status: "published", visibility: "private" }));
    await seed("writingProjects", "drf", proj({ status: "draft", visibility: "public" }));
    await seed("writingProjects", "arc", proj({ status: "archived", visibility: "public" }));
    await assertSucceeds(getDoc(doc(anon(), "writingProjects", "pub")));
    for (const id of ["priv", "drf", "arc"]) {
      await assertFails(getDoc(doc(anon(), "writingProjects", id)));
      await assertFails(getDoc(doc(other(), "writingProjects", id)));
      await assertSucceeds(getDoc(doc(owner(), "writingProjects", id)));
    }
    await assertFails(getDocs(collection(anon(), "writingProjects"))); // filter ছাড়া query ব্যর্থ
    await assertSucceeds(
      getDocs(query(collection(anon(), "writingProjects"), where("status", "==", "published"), where("visibility", "==", "public"))),
    );
  });

  it("অধ্যায়: owner create/update পারে; অবৈধ order/enum ও ownerUid/projectId বদল পারে না; non-owner পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "chapters", "c1"), chap()));
    await assertSucceeds(updateDoc(doc(owner(), "chapters", "c1"), { title: "নতুন", order: 3 }));
    await assertFails(setDoc(doc(owner(), "chapters", "c2"), chap({ order: "১" })));
    await assertFails(setDoc(doc(owner(), "chapters", "c2"), chap({ order: 1.5 })));
    await assertFails(setDoc(doc(owner(), "chapters", "c2"), chap({ status: "archived" })));
    await assertFails(setDoc(doc(owner(), "chapters", "c2"), chap({ visibility: "unlisted" })));
    await assertFails(setDoc(doc(owner(), "chapters", "c2"), chap({ projectId: 5 })));
    await assertFails(updateDoc(doc(owner(), "chapters", "c1"), { projectId: "p2" }));
    await assertFails(updateDoc(doc(owner(), "chapters", "c1"), { ownerUid: "someoneElse123456" }));
    await assertFails(setDoc(doc(other(), "chapters", "c3"), chap()));
    await assertFails(setDoc(doc(anon(), "chapters", "c3"), chap()));
    await assertFails(updateDoc(doc(other(), "chapters", "c1"), { title: "হ্যাক" }));
  });

  it("অধ্যায় পাবলিক-read: শুধু অধ্যায় ও প্রজেক্ট দুটোই published+public হলে", async () => {
    await seed("writingProjects", "p1", proj(PUB));
    await seed("chapters", "ok", chap(PUB));
    await seed("chapters", "draftCh", chap({ status: "draft", visibility: "public" }));
    await seed("chapters", "privCh", chap({ status: "published", visibility: "private" }));
    await seed("chapters", "trashCh", chap({ status: "trashed", visibility: "public" }));
    await assertSucceeds(getDoc(doc(anon(), "chapters", "ok")));
    for (const id of ["draftCh", "privCh", "trashCh"]) await assertFails(getDoc(doc(anon(), "chapters", id)));
    await assertFails(getDocs(collection(anon(), "chapters"))); // filter ছাড়া query ব্যর্থ
  });

  it("অধ্যায় ফাঁস-রোধ: প্রজেক্ট private/draft/archived/অনুপস্থিত হলে published+public অধ্যায়ও পাবলিক পায় না", async () => {
    await seed("chapters", "c", chap({ ...PUB, projectId: "pp" }));
    await assertFails(getDoc(doc(anon(), "chapters", "c"))); // প্রজেক্ট নেই
    for (const [id, o] of [
      ["pPriv", { status: "published", visibility: "private" }],
      ["pDraft", { status: "draft", visibility: "public" }],
      ["pArch", { status: "archived", visibility: "public" }],
    ] as const) {
      await seed("writingProjects", id, proj(o));
      await seed("chapters", `c-${id}`, chap({ ...PUB, projectId: id }));
      await assertFails(getDoc(doc(anon(), "chapters", `c-${id}`)));
      await assertFails(getDoc(doc(other(), "chapters", `c-${id}`)));
      await assertSucceeds(getDoc(doc(owner(), "chapters", `c-${id}`)));
    }
    // প্রজেক্ট পরে private করলে আগে-প্রকাশিত অধ্যায় সঙ্গে সঙ্গে বন্ধ
    await seed("writingProjects", "pFlip", proj(PUB));
    await seed("chapters", "cFlip", chap({ ...PUB, projectId: "pFlip" }));
    await assertSucceeds(getDoc(doc(anon(), "chapters", "cFlip")));
    await updateDoc(doc(owner(), "writingProjects", "pFlip"), { visibility: "private" });
    await assertFails(getDoc(doc(anon(), "chapters", "cFlip")));
  });

  // P14c-১: build-এর পাবলিক REST query-র ধাঁচ — projectId + status + visibility equality; rules-এর get() শর্ত query-তে প্রমাণযোগ্য কিনা
  it("অধ্যায় পাবলিক query (projectId+status+visibility filter): প্রজেক্ট published+public হলে চলে; filter-ছাড়া/প্রজেক্ট-ছাড়া ব্যর্থ; প্রজেক্ট private হলে ব্যর্থ", async () => {
    await seed("writingProjects", "qp", proj(PUB));
    await seed("writingProjects", "qpriv", proj({ status: "published", visibility: "private" }));
    await seed("chapters", "q1", chap({ ...PUB, projectId: "qp", order: 1 }));
    await seed("chapters", "q2", chap({ ...PUB, projectId: "qp", order: 0 }));
    await seed("chapters", "qd", chap({ status: "draft", visibility: "public", projectId: "qp" }));
    await seed("chapters", "qx", chap({ ...PUB, projectId: "qpriv" }));
    const q = (pid: string) =>
      query(collection(anon(), "chapters"), where("projectId", "==", pid), where("status", "==", "published"), where("visibility", "==", "public"));
    const snap = await assertSucceeds(getDocs(q("qp")));
    expect(snap.docs.map((d) => d.id).sort()).toEqual(["q1", "q2"]); // draft নেই
    await assertFails(getDocs(q("qpriv"))); // প্রজেক্ট private ⇒ অধ্যায়-query-ও বন্ধ
    await assertFails(getDocs(q("nonexistent")));
    await assertFails(getDocs(query(collection(anon(), "chapters"), where("projectId", "==", "qp")))); // status/visibility filter ছাড়া
    await assertFails(getDocs(query(collection(anon(), "chapters"), where("status", "==", "published"), where("visibility", "==", "public")))); // projectId ছাড়া
  });

  it("অধ্যায় মোছা: শুধু ট্র্যাশ-করা অধ্যায় owner মুছতে পারে; অন্যরা কখনো না", async () => {
    await seed("chapters", "live", chap());
    await seed("chapters", "pubCh", chap(PUB));
    await seed("chapters", "gone", chap({ status: "trashed" }));
    await assertFails(deleteDoc(doc(owner(), "chapters", "live")));
    await assertFails(deleteDoc(doc(owner(), "chapters", "pubCh")));
    await assertFails(deleteDoc(doc(other(), "chapters", "gone")));
    await assertFails(deleteDoc(doc(anon(), "chapters", "gone")));
    await assertSucceeds(deleteDoc(doc(owner(), "chapters", "gone")));
  });

  it("প্রজেক্ট মোছা: owner পারে, অন্যরা না", async () => {
    await seed("writingProjects", "d", proj());
    await assertFails(deleteDoc(doc(other(), "writingProjects", "d")));
    await assertSucceeds(deleteDoc(doc(owner(), "writingProjects", "d")));
  });
});

// P14a-৩: প্রকাশিত অধ্যায়ের অপ্রকাশিত সম্পাদনা (drafts) ও ইতিহাস (revisions) পাবলিকে কখনো ফাঁস নয় — অধ্যায় ও প্রজেক্ট published+public হলেও
describe("chapter drafts/revisions গোপনীয়তা (P14a-৩)", () => {
  const cdraft = { targetType: "chapter", title: "অপ্রকাশিত", body: "{}", wordCount: 0, ownerUid: OWNER };
  const crev = { targetType: "chapter", targetId: "c1", snapshot: "{}", versionNumber: 1, trigger: "manual", ownerUid: OWNER };
  beforeEach(async () => {
    await seed("writingProjects", "p1", { title: "প", slug: "প", type: "novel", status: "published", visibility: "public", ownerUid: OWNER });
    await seed("chapters", "c1", { projectId: "p1", title: "অ", slug: "অ", body: "{}", order: 0, status: "published", visibility: "public", ownerUid: OWNER });
  });
  it("অধ্যায় পাবলিক-readable হলেও তার drafts/revisions anonymous ও non-owner পড়তে/লিখতে পারে না", async () => {
    await assertSucceeds(getDoc(doc(anon(), "chapters", "c1")));
    await seed("drafts", "c1", cdraft);
    await seed("revisions", "r1", crev);
    await assertFails(getDoc(doc(anon(), "drafts", "c1")));
    await assertFails(getDoc(doc(other(), "drafts", "c1")));
    await assertFails(getDoc(doc(anon(), "revisions", "r1")));
    await assertFails(getDoc(doc(other(), "revisions", "r1")));
    await assertFails(setDoc(doc(other(), "drafts", "c1"), cdraft));
    await assertFails(setDoc(doc(anon(), "revisions", "r2"), crev));
  });
  it("owner chapter-draft লিখতে/মুছতে, chapter-revision বানাতে পারে (update/delete নয়)", async () => {
    await assertSucceeds(setDoc(doc(owner(), "drafts", "c1"), cdraft));
    await assertSucceeds(deleteDoc(doc(owner(), "drafts", "c1")));
    await assertSucceeds(setDoc(doc(owner(), "revisions", "r1"), crev));
    await assertFails(deleteDoc(doc(owner(), "revisions", "r1")));
  });
});

// দিনলিপি-ঘ: books — পাবলিক-read শুধু visibility=='public'; owner write + enum/ownerUid/দৈর্ঘ্য যাচাই। quotes = OWNER_ONLY_COLLECTIONS-এ
describe("books (দিনলিপি-ঘ)", () => {
  const book = (o: Record<string, unknown> = {}) => ({ title: "বই", status: "reading", visibility: "private", ownerUid: OWNER, ...o });

  it("owner create/update পারে; অবৈধ enum/ownerUid/দৈর্ঘ্য ও non-owner পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "books", "b1"), book()));
    await assertSucceeds(updateDoc(doc(owner(), "books", "b1"), { status: "finished", endDay: "2026-10-22" }));
    await assertFails(setDoc(doc(owner(), "books", "b2"), book({ status: "dropped" })));
    await assertFails(setDoc(doc(owner(), "books", "b2"), book({ visibility: "unlisted" })));
    await assertFails(setDoc(doc(owner(), "books", "b2"), book({ ownerUid: "someoneElse123456" })));
    await assertFails(setDoc(doc(owner(), "books", "b2"), book({ title: "ক".repeat(151) })));
    await assertFails(setDoc(doc(owner(), "books", "b2"), book({ title: 5 })));
    await assertFails(updateDoc(doc(owner(), "books", "b1"), { ownerUid: "someoneElse123456" }));
    await assertFails(setDoc(doc(other(), "books", "b3"), book()));
    await assertFails(setDoc(doc(anon(), "books", "b3"), book()));
    await assertFails(deleteDoc(doc(other(), "books", "b1")));
  });

  it("public বই পাবলিক পায়; private পায় না (owner পায়); filter ছাড়া query ব্যর্থ", async () => {
    await seed("books", "pub", book({ visibility: "public" }));
    await seed("books", "priv", book({ visibility: "private" }));
    await assertSucceeds(getDoc(doc(anon(), "books", "pub")));
    await assertFails(getDoc(doc(anon(), "books", "priv")));
    await assertFails(getDoc(doc(other(), "books", "priv")));
    await assertSucceeds(getDoc(doc(owner(), "books", "priv")));
    await assertFails(getDocs(collection(anon(), "books")));
    await assertSucceeds(getDocs(query(collection(anon(), "books"), where("visibility", "==", "public"))));
  });
});

// দিনলিপি-চ: trips / specialDays — শুধু owner; enum, ownerUid, দৈর্ঘ্য ও পূর্ণসংখ্যা-খরচ/মাস-দিন যাচাই
describe("trips (দিনলিপি-চ)", () => {
  const trip = (o: Record<string, unknown> = {}) => ({ place: "কক্সবাজার", status: "wish", ownerUid: OWNER, ...o });
  it("owner ঠিক ডেটা পারে; অবৈধ status/ownerUid/place/খরচ ও non-owner পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "trips", "t1"), trip()));
    await assertSucceeds(setDoc(doc(owner(), "trips", "t2"), trip({ status: "been", costTaka: 12000 })));
    await assertSucceeds(updateDoc(doc(owner(), "trips", "t1"), { status: "been", costTaka: 0 }));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ status: "maybe" })));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ place: "" })));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ place: "ক".repeat(101) })));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ costTaka: 12.5 })));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ costTaka: -1 })));
    await assertFails(setDoc(doc(owner(), "trips", "t3"), trip({ ownerUid: "someoneElse123456" })));
    await assertFails(setDoc(doc(other(), "trips", "t4"), trip()));
    await assertFails(getDoc(doc(other(), "trips", "t1")));
    await assertFails(getDoc(doc(anon(), "trips", "t1")));
  });
});

describe("specialDays (দিনলিপি-চ)", () => {
  const sd = (o: Record<string, unknown> = {}) => ({ name: "আম্মু", kind: "birthday", month: 10, day: 22, ownerUid: OWNER, ...o });
  it("owner ঠিক ডেটা পারে; অবৈধ kind/মাস/দিন/ownerUid ও non-owner পারে না", async () => {
    await assertSucceeds(setDoc(doc(owner(), "specialDays", "d1"), sd()));
    await assertSucceeds(setDoc(doc(owner(), "specialDays", "d2"), sd({ year: 1990 })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ kind: "holiday" })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ month: 13 })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ day: 0 })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ month: "10" })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ name: "" })));
    await assertFails(setDoc(doc(owner(), "specialDays", "d3"), sd({ ownerUid: "someoneElse123456" })));
    await assertFails(setDoc(doc(other(), "specialDays", "d4"), sd()));
    await assertFails(getDoc(doc(anon(), "specialDays", "d1")));
    await assertFails(getDocs(collection(other(), "specialDays")));
  });
});
