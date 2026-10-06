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
export function publishedPostsQuery() {
  const eq = (field: string, value: string) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
  });
  return {
    structuredQuery: {
      from: [{ collectionId: "posts" }],
      where: { compositeFilter: { op: "AND", filters: [eq("status", "published"), eq("visibility", "public")] } },
      orderBy: [{ field: { fieldPath: "publishedAt" }, direction: "DESCENDING" }],
    },
  };
}
