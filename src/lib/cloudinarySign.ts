// Cloudinary signed-API স্বাক্ষর — pure (Web Crypto; নতুন dependency নেই; P6-২)।
// নিয়ম (signature_version 1): খালি নয় এমন param (file/api_key/resource_type/cloud_name বাদে) key-অনুযায়ী সাজিয়ে `k=v&k=v` + API secret ⇒ SHA-1 hex।
export type SignParams = Record<string, string | number | boolean | undefined | null>;

export function stringToSign(params: SignParams): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("&");
}

export async function sha1Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const signParams = (params: SignParams, secret: string): Promise<string> =>
  sha1Hex(stringToSign(params) + secret);
