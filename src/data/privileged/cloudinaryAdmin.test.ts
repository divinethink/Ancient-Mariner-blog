import { describe, expect, it, vi } from "vitest";
import { signParams } from "@/lib/cloudinarySign";
import { createUploadTicket, destroyAsset, privateDownloadUrl, type CloudinaryConfig } from "./cloudinaryAdmin";

const cfg = (f?: typeof fetch): CloudinaryConfig => ({ cloudName: "demo", apiKey: "123456", apiSecret: "topsecret123", nowSec: () => 1000, fetchImpl: f });

describe("cloudinaryAdmin", () => {
  it("upload ticket: public_id/type/স্বাক্ষর সঠিক; secret ফেরে না", async () => {
    const t = await createUploadTicket(cfg(), { kind: "image", visibility: "public", mediaId: "abc123" });
    expect(t.publicId).toBe("blog/abc123");
    expect(t.uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(t.fields.type).toBe("upload");
    expect(t.fields.allowed_formats).toBe("jpg,jpeg,png,webp,gif");
    const expected = await signParams({ public_id: "blog/abc123", timestamp: 1000, type: "upload", allowed_formats: "jpg,jpeg,png,webp,gif" }, "topsecret123");
    expect(t.fields.signature).toBe(expected);
    expect(JSON.stringify(t)).not.toContain("topsecret123");
  });
  it("private ফাইল ⇒ authenticated + raw; ফরম্যাট-সীমা নেই; mediaId স্বয়ংক্রিয়", async () => {
    const t = await createUploadTicket(cfg(), { kind: "file", visibility: "private" });
    expect(t.fields.type).toBe("authenticated");
    expect(t.fields.allowed_formats).toBeUndefined();
    expect(t.uploadUrl).toContain("/raw/upload");
    expect(t.publicId).toMatch(/^blog\/[A-Za-z0-9]{20}$/);
  });
  it("অবৈধ mediaId/public_id প্রত্যাখ্যাত", async () => {
    await expect(createUploadTicket(cfg(), { kind: "image", visibility: "public", mediaId: "a/../b" })).rejects.toThrow();
    await expect(destroyAsset(cfg(), { publicId: "x/y", kind: "image", delivery: "upload" })).rejects.toThrow();
    await expect(privateDownloadUrl(cfg(), { publicId: "blog/a b", kind: "file" })).rejects.toThrow();
  });
  it("destroy: ok ও 'not found' দুটোই সফল; অন্য ফল ব্যর্থ", async () => {
    const mk = (r: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(r), { status })) as unknown as typeof fetch;
    await expect(destroyAsset(cfg(mk({ result: "ok" })), { publicId: "blog/abc", kind: "image", delivery: "upload" })).resolves.toBeUndefined();
    await expect(destroyAsset(cfg(mk({ result: "not found" })), { publicId: "blog/abc", kind: "image", delivery: "upload" })).resolves.toBeUndefined();
    await expect(destroyAsset(cfg(mk({ error: { message: "Invalid Signature" } }, 401)), { publicId: "blog/abc", kind: "file", delivery: "authenticated" })).rejects.toThrow(/Invalid Signature/);
  }, 15000);
  it("destroy অনুরোধে api_key+স্বাক্ষর+invalidate যায়, secret নয়", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ result: "ok" }))) as unknown as typeof fetch;
    await destroyAsset(cfg(f), { publicId: "blog/abc", kind: "image", delivery: "upload" });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/destroy");
    const body = String(init.body);
    expect(body).toContain("invalidate=true");
    expect(body).toContain("api_key=123456");
    expect(body).not.toContain("topsecret123");
  });
  it("private download URL: মেয়াদ ৫ মিনিট, স্বাক্ষর ঠিক", async () => {
    const u = new URL(await privateDownloadUrl(cfg(), { publicId: "blog/abc", kind: "file" }));
    expect(u.pathname).toBe("/v1_1/demo/raw/download");
    expect(u.searchParams.get("expires_at")).toBe("1300");
    expect(u.searchParams.get("type")).toBe("authenticated");
    expect(u.searchParams.get("format")).toBeNull();
    const sig = await signParams({ expires_at: 1300, public_id: "blog/abc", timestamp: 1000, type: "authenticated" }, "topsecret123");
    expect(u.searchParams.get("signature")).toBe(sig);
    const img = new URL(await privateDownloadUrl(cfg(), { publicId: "blog/abc", kind: "image" }));
    expect(img.searchParams.get("format")).toBe("jpg");
  });
});
