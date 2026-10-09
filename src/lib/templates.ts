// লেখার ছাঁচ (P7b-২): বিল্ট-ইন চারটি (কোডে, pure) + নিজের সেভ-করা (`templates` collection)। SDK/UI-মুক্ত।
import { EMPTY_DOC, type DocNode } from "./editorDoc";

export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATES_PAGE = 50;
export const BUILTIN_IDS = ["diary", "travel", "story", "poem"] as const;
export type BuiltinId = (typeof BUILTIN_IDS)[number];

export type TemplateDef = { ref: string; name: string; title: string; doc: DocNode };

const h2 = (text: string): DocNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const p = (): DocNode => ({ type: "paragraph" });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

/** `today` = দেখানোর তারিখ-লেবেল (call-site সাইট-timezone-এ বানায়; এখানে ঘড়ি নেই) */
export function builtinTemplates(today: string): TemplateDef[] {
  return [
    {
      ref: "b:diary",
      name: "আজকের ডায়েরি",
      title: `ডায়েরি — ${today}`,
      doc: doc(h2("আজ যা ঘটল"), p(), h2("যা ভাবছি"), p(), h2("কাল"), p()),
    },
    {
      ref: "b:travel",
      name: "ভ্রমণ",
      title: "",
      doc: doc(h2("কোথায় গিয়েছিলাম"), p(), h2("যা দেখলাম"), p(), h2("মনে রাখার মতো"), p()),
    },
    {
      ref: "b:story",
      name: "গল্প",
      title: "",
      doc: doc(h2("শুরু"), p(), h2("মাঝখান"), p(), h2("শেষ"), p()),
    },
    { ref: "b:poem", name: "কবিতা", title: "", doc: doc(p(), p()) },
  ];
}

export type TplRef = { kind: "builtin"; id: BuiltinId } | { kind: "user"; id: string };

/** URL-এর `tpl` (`b:diary` | `u:<id>`) → যাচাই-করা ref; অচেনা/অবৈধ → null (খালি লেখা) */
export function parseTplParam(raw: string | null | undefined): TplRef | null {
  if (!raw) return null;
  const [k, id] = raw.split(":");
  if (k === "b" && (BUILTIN_IDS as readonly string[]).includes(id ?? ""))
    return { kind: "builtin", id: id as BuiltinId };
  if (k === "u" && /^[A-Za-z0-9]{1,40}$/.test(id ?? "")) return { kind: "user", id: id as string };
  return null;
}

/** বিল্ট-ইন ref → ছাঁচ; না মিললে খালি doc */
export function builtinFor(id: BuiltinId, today: string): TemplateDef {
  return (
    builtinTemplates(today).find((t) => t.ref === `b:${id}`) ?? {
      ref: `b:${id}`,
      name: id,
      title: "",
      doc: EMPTY_DOC,
    }
  );
}

/** ছাঁচের নাম যাচাই: ট্রিম করা, ১–৬০ অক্ষর; অবৈধ হলে null */
export function cleanTemplateName(raw: string | null | undefined): string | null {
  const n = (raw ?? "").trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= TEMPLATE_NAME_MAX ? n : null;
}
