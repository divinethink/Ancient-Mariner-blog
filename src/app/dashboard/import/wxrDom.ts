// WXR (WordPress export XML) → `WxrFile`: ব্রাউজারের DOMParser (UI/adapter স্তর; lib-এ DOM নেই — Arch §১৭ P3c)।
import type { WxrFile, WxrItem, WxrTerm } from "@/lib/import/plan";

const text = (el: Element, name: string): string => el.getElementsByTagName(name)[0]?.textContent ?? "";

export function parseWxr(xml: string): WxrFile {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const channel = doc.getElementsByTagName("channel")[0];
  if (doc.getElementsByTagName("parsererror").length > 0 || !channel) throw new Error("not-wxr");
  const items: WxrItem[] = [];
  for (const el of Array.from(channel.children)) {
    if (el.tagName !== "item") continue;
    const cats: WxrTerm[] = [];
    const tags: WxrTerm[] = [];
    for (const c of Array.from(el.children)) {
      if (c.tagName !== "category") continue;
      const term = { slug: c.getAttribute("nicename") ?? "", name: (c.textContent ?? "").trim() };
      const domain = c.getAttribute("domain");
      if (domain === "category") cats.push(term);
      else if (domain === "post_tag") tags.push(term);
    }
    items.push({
      wpId: text(el, "wp:post_id"),
      type: text(el, "wp:post_type"),
      status: text(el, "wp:status"),
      title: text(el, "title"),
      slug: text(el, "wp:post_name"),
      dateGmt: text(el, "wp:post_date_gmt"),
      link: text(el, "link"),
      content: text(el, "content:encoded"),
      categories: cats,
      tags,
    });
  }
  return { siteTitle: text(channel, "title").trim(), siteUrl: text(channel, "link").trim(), items };
}
