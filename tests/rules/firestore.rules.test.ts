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
const OWNER_ONLY_COLLECTIONS = ["drafts", "ideas", "notes", "templates"];
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
