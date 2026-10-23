// Firestore REST (পথ খ) — value-decode ও query-বিল্ডার; pure, SDK-মুক্ত (Arch §২)।
export type RestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  arrayValue?: { values?: RestValue[] };
  mapValue?: { fields?: Record<string, RestValue> };
};
export type RestDocument = { name: string; fields?: Record<string, RestValue>; updateTime?: string };

export function decodeValue(v: RestValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue as string);
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue?.fields ?? {});
  return undefined; // bytes/reference/geo — এই প্রজেক্টে ব্যবহার নেই
}

export const decodeFields = (fields: Record<string, RestValue>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));

export function decodeDocument(doc: RestDocument): { id: string; data: Record<string, unknown> } {
  const id = doc.name.slice(doc.name.lastIndexOf("/") + 1);
  return { id, data: decodeFields(doc.fields ?? {}) };
}

/** build-এর একমাত্র পাবলিক query: published+public, publishedAt desc (composite index — firestore.indexes.json) */
export function publishedPostsQuery(visibility: "public" | "unlisted" = "public") {
  const eq = (field: string, value: string) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
  });
  return {
    structuredQuery: {
      from: [{ collectionId: "posts" }],
      where: { compositeFilter: { op: "AND", filters: [eq("status", "published"), eq("visibility", visibility)] } },
      orderBy: [{ field: { fieldPath: "publishedAt" }, direction: "DESCENDING" }],
    },
  };
}

/** পুরো collection (ছোট taxonomy-collection-এর জন্য; categories/tags/series public-read — rules) */
export const collectionQuery = (collectionId: string) => ({
  structuredQuery: { from: [{ collectionId }] },
});

/** build-এর পাবলিক pages query: শুধু published (rules-সম্মত; single-field filter — নতুন index লাগে না) */
export function publishedPagesQuery() {
  return {
    structuredQuery: {
      from: [{ collectionId: "pages" }],
      where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
    },
  };
}

/** build-এর পাবলিক মন্তব্য query (P11b-২): শুধু approved (rules-সম্মত; single-field filter — নতুন index লাগে না); ক্রম কোডে ঠিক হয় */
export function approvedCommentsQuery(limit = 5000) {
  return {
    structuredQuery: {
      from: [{ collectionId: "comments" }],
      where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "approved" } } },
      limit,
    },
  };
}

const eqFilter = (field: string, value: string) => ({
  fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
});

/** build-এর পাবলিক বই query (দিনলিপি-ঘ): `visibility=='public'` (rules-সম্মত; শুধু equality ⇒ নতুন index লাগে না) */
export function publicBooksQuery(limit = 500) {
  return {
    structuredQuery: {
      from: [{ collectionId: "books" }],
      where: eqFilter("visibility", "public"),
      limit,
    },
  };
}

/** build-এর পাবলিক প্রজেক্ট query (P14c-১): published+public (rules-সম্মত; শুধু equality ⇒ নতুন index লাগে না) */
export function publishedProjectsQuery() {
  return {
    structuredQuery: {
      from: [{ collectionId: "writingProjects" }],
      where: { compositeFilter: { op: "AND", filters: [eqFilter("status", "published"), eqFilter("visibility", "public")] } },
    },
  };
}

/**
 * build-এর পাবলিক অধ্যায় query (P14c-১): এক প্রজেক্টের published+public অধ্যায়। `projectId` equality থাকায় rules-এর
 * `get(writingProjects/$(resource.data.projectId))` শর্ত query-তে প্রমাণযোগ্য; শুধু equality ⇒ নতুন composite index নেই; ক্রম কোডে (`order`)।
 */
export function publishedChaptersQuery(projectId: string, limit = 500) {
  return {
    structuredQuery: {
      from: [{ collectionId: "chapters" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [eqFilter("projectId", projectId), eqFilter("status", "published"), eqFilter("visibility", "public")],
        },
      },
      limit,
    },
  };
}
