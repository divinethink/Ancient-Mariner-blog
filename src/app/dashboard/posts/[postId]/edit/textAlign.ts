// অনুচ্ছেদ/শিরোনামের অ্যালাইনমেন্ট (নিজস্ব ছোট extension — নতুন dependency নেই)।
// doc-এ attrs.textAlign (left|center|right); DOM-এ `data-align` (inline style নয় — CSP/CSS-token-বান্ধব); অবৈধ মান বাদ।
import { Extension } from "@tiptap/react";
import { isTextAlign } from "@/lib/editor-nodes";

export const TextAlign = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const v = el.getAttribute("data-align");
              return isTextAlign(v) ? v : null;
            },
            renderHTML: (a: Record<string, unknown>) => (isTextAlign(a.textAlign) ? { "data-align": a.textAlign } : {}),
          },
        },
      },
    ];
  },
});
