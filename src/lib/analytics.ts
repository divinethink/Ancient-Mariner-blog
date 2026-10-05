// Cloudflare Web Analytics token-যাচাই (pure; P2c-৩)। token env-এ থাকলেই beacon render হয়; ভুল/খালি হলে কিছুই নয় (fail-closed)।
export const CF_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/** Cloudflare token = ৩২-হেক্স; অন্য কিছু হলে null (data-attribute-এ অনিরাপদ মান ঢোকা ঠেকায়) */
export function analyticsToken(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return /^[a-f0-9]{32}$/i.test(t) ? t : null;
}

export const beaconAttr = (token: string): string => JSON.stringify({ token });
