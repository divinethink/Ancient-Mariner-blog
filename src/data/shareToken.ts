// Share token: র‍্যান্ডম ৩২ বাইট (base64url) ও তার SHA-256 hex (= `shareLinks` doc-ID)। WebCrypto — ব্রাউজার ও Worker দুটোতেই।
// token শুধু owner-কে একবার দেখানো হয়; কোথাও সংরক্ষিত নয়, তাই DB leak হলেও লিংক বানানো যায় না।
export function generateShareToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashShareToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
