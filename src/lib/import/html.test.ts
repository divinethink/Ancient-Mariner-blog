import { describe, expect, it } from "vitest";
import { docToText } from "../editorDoc";
import { IMAGE_LABEL, htmlToDoc } from "./html";

// নমুনা: মালিকের আসল XML থেকে নেওয়া (সংক্ষিপ্ত)
const GUTENBERG =
  '<!-- wp:paragraph -->\n<p>- <strong>সাইফ আব্দুল্লাহ</strong>&nbsp;</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:list -->\n<ul><li>এক</li><li>দুই</li></ul>\n<!-- /wp:list -->\n\n<!-- wp:image -->\n<figure class="wp-block-image"><img src="https://hasantuhin.wordpress.com/a.jpg" alt="" /></figure>\n<!-- /wp:image -->';
const CLASSIC_POEM =
  '<img src="https://encrypted-tbn1.gstatic.com/images?q=tbn:A" alt="" />\n<div>\n\nবিপদ যেন\n\nহাত ধরে\nনিয়ে\n\n</div>\n<!--more-->\n<div>\n\nতোমায় একমুঠো\n\n</div>';
const STYLED_P = '<p dir="ltr" style="color:#37474f;font-size:medium;">একটি বিজয়\nআজো বেঁচে\nআছি</p>\n<p>দুই</p>';
const QUOTE = 'কষ্ট আর-\n<blockquote><em><b>"শালা দেশ,</b></em>\n<em><b>না ছাড়িলে</b></em></blockquote>\n\n\nউপখ্যানে\n\n<h4>শিরোনাম</h4>';

const types = (r: ReturnType<typeof htmlToDoc>) => (r.doc.content ?? []).map((n) => n.type);

describe("htmlToDoc", () => {
  it("Gutenberg comment সরে, তালিকা ঠিক, ছবি → লিংক-অনুচ্ছেদ ও গণনা", () => {
    const r = htmlToDoc(GUTENBERG);
    expect(types(r)).toEqual(["paragraph", "bulletList", "paragraph"]);
    const link = r.doc.content?.[2].content?.[0];
    expect(link?.text).toBe(IMAGE_LABEL);
    expect(link?.marks).toEqual([{ type: "link", attrs: { href: "https://hasantuhin.wordpress.com/a.jpg" } }]);
    expect(r.images).toEqual(["https://hasantuhin.wordpress.com/a.jpg"]);
    expect(r.dropped.img).toBe(1);
    expect(JSON.stringify(r.doc)).not.toContain("wp:");
  });
  it("&nbsp; ও trailing ফাঁকা বাদ; bold mark থাকে", () => {
    const p = htmlToDoc(GUTENBERG).doc.content?.[0];
    expect(p?.content?.map((n) => n.text)).toEqual(["- ", "সাইফ আব্দুল্লাহ"]);
    expect(p?.content?.[1].marks).toEqual([{ type: "bold" }]);
  });
  it("কাঁচা লেখা (wpautop): ফাঁকা-লাইন = অনুচ্ছেদ, একক newline = hardBreak, <!--more--> বাদ", () => {
    const r = htmlToDoc(CLASSIC_POEM);
    expect(types(r)).toEqual(["paragraph", "paragraph", "paragraph", "paragraph"]); // প্রথমটি ছবির লিংক
    expect(r.doc.content?.[0].content?.[0].text).toBe(IMAGE_LABEL);
    expect(r.doc.content?.[2].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(docToText(r.doc)).not.toContain("more");
  });
  it("inline style সরে; <p>-এর ভেতরের newline hardBreak", () => {
    const r = htmlToDoc(STYLED_P);
    expect(JSON.stringify(r.doc)).not.toContain("style");
    expect(r.doc.content?.[0].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text", "hardBreak", "text"]);
  });
  it("blockquote, heading (h4→H3), মিশ্র কাঁচা লেখা", () => {
    const r = htmlToDoc(QUOTE);
    expect(types(r)).toEqual(["paragraph", "blockquote", "paragraph", "heading"]);
    expect(r.doc.content?.[3].attrs).toEqual({ level: 3 });
    expect(r.doc.content?.[1].content?.[0].content?.[0].marks).toEqual([{ type: "italic" }, { type: "bold" }]);
  });
  it("অনিরাপদ লিংক (http://, javascript:) mark হারায়, টেক্সট থাকে ও গোনা হয়", () => {
    const r = htmlToDoc('<p><a href="http://">ক</a> <a href="javascript:x()">খ</a> <a href="https://e.com/a?b=1&amp;c=2">গ</a></p>');
    const kids = r.doc.content?.[0].content ?? [];
    expect(kids.map((n) => n.text).join("")).toBe("ক খ গ");
    expect(kids.filter((n) => n.marks?.length)).toHaveLength(1);
    expect(kids.find((n) => n.marks?.length)?.marks?.[0].attrs?.href).toBe("https://e.com/a?b=1&c=2");
    expect(r.dropped.unsafeLink).toBe(2);
  });
  it("script/iframe বাদ ও গোনা; খালি ইনপুটে অন্তত একটা paragraph", () => {
    const r = htmlToDoc("<script>alert(1)</script><iframe src='x'></iframe>");
    expect(r.dropped).toEqual({ script: 1, iframe: 1 });
    expect(types(r)).toEqual(["paragraph"]);
  });
  it("ভুল-নেস্টিং ও খোলা-থাকা <li> ভেঙে পড়ে না", () => {
    const r = htmlToDoc("<ul><li>এক<li>দুই</ul><p>শেষ");
    expect(types(r)).toEqual(["bulletList", "paragraph"]);
    expect(r.doc.content?.[0].content).toHaveLength(2);
  });
});
