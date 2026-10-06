import { describe, expect, it } from "vitest";
import { createCollectionReader, safeDecodeId } from "./firestoreList";

describe("firestoreList", () => {
  it("pageToken দিয়ে পড়ে, decode করে, Bearer পাঠায়", async () => {
    const urls: string[] = [];
    const read = createCollectionReader({
      projectId: "p",
      getToken: async () => "T",
      fetchImpl: (async (u: string, init?: RequestInit) => {
        urls.push(u);
        expect((init?.headers as Record<string, string>).authorization).toBe("Bearer T");
        return new Response(
          JSON.stringify({
            documents: [
              {
                name: "projects/p/databases/(default)/documents/slugs/%E0%A6%95",
                fields: { postId: { stringValue: "a" } },
              },
            ],
            nextPageToken: "NEXT",
          }),
        );
      }) as unknown as typeof fetch,
    });
    const r = await read("slugs", "TOK", 100);
    expect(urls[0]).toContain("/documents/slugs?pageSize=100&pageToken=TOK");
    expect(r.docs).toEqual([{ id: "ক", data: { postId: "a" } }]);
    expect(r.next).toBe("NEXT");
  });
  it("অবৈধ collection-নাম আটকায়; বিকৃত % যেমন আছে", async () => {
    const read = createCollectionReader({ projectId: "p", getToken: async () => "T" });
    await expect(read("../x", undefined, 1)).rejects.toThrow();
    expect(safeDecodeId("a%zz")).toBe("a%zz");
  });
});
