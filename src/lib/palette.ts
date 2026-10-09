// Command palette-এর matching (pure, SDK/UI-মুক্ত; P7a-২)। ক্রম: শুরুতে মিল > শব্দের শুরুতে মিল > ভেতরে মিল।

export type PaletteKind = "command" | "post";
export type PaletteItem = {
  id: string;
  kind: PaletteKind;
  label: string;
  /** অতিরিক্ত খোঁজ-শব্দ (যেমন ইংরেজি নাম) */
  keywords?: string;
};

export const PALETTE_LIMIT = 8;

/** NFC + lower-case + বাড়তি ফাঁকা বাদ */
export const norm = (s: string): string =>
  s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** ০ = শুরুতে, ১ = শব্দের শুরুতে, ২ = ভেতরে, -১ = মিল নেই */
export function matchRank(query: string, text: string): number {
  const q = norm(query);
  const t = norm(text);
  if (!q) return 0;
  if (t.startsWith(q)) return 0;
  if (t.includes(` ${q}`)) return 1;
  return t.includes(q) ? 2 : -1;
}

/** ফাঁকা query-তে সবাই (মূল ক্রমে); নইলে মিলগুলো rank → মূল ক্রমে। id-তে duplicate বাদ */
export function matchItems(
  query: string,
  items: readonly PaletteItem[],
  limit = PALETTE_LIMIT,
): PaletteItem[] {
  const seen = new Set<string>();
  const scored: { it: PaletteItem; r: number; i: number }[] = [];
  items.forEach((it, i) => {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const r = Math.min(
      ...[it.label, it.keywords ?? ""]
        .map((t) => (t ? matchRank(query, t) : -1))
        .filter((x) => x >= 0),
      9,
    );
    if (r < 9 || !norm(query)) scored.push({ it, r: r < 9 ? r : 0, i });
  });
  scored.sort((a, b) => a.r - b.r || a.i - b.i);
  return scored.slice(0, Math.max(0, limit)).map((s) => s.it);
}

/** কমান্ড আগে, তারপর লেখা; একই (kind,id) একবারই */
export function mergePalette(
  commands: readonly PaletteItem[],
  loaded: readonly PaletteItem[],
  remote: readonly PaletteItem[],
): PaletteItem[] {
  return [...commands, ...loaded, ...remote];
}

/** ↑/↓-এর সূচক (ঘুরে আসে); তালিকা ফাঁকা হলে -১ */
export function moveIndex(cur: number, delta: 1 | -1, len: number): number {
  if (len <= 0) return -1;
  return (cur + delta + len) % len;
}
