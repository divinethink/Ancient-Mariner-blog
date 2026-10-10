// বাংলা-নিরাপদ text-fold (P8b থেকে আলাদা করা, P10a-২): private খোঁজ ও পাবলিক `/search` একই নিয়ম ব্যবহার করে। pure, SDK/UI-মুক্ত, কোনো ভারী import নেই।
export const MAX_TOKENS = 8;

const IGNORABLE = new RegExp("[\\u00AD\\u200B-\\u200D\\u2060\\uFEFF]", "u");

/** NFC → অদৃশ্য অক্ষর বাদ → lower-case। `map[i]` = folded i-তম code-unit-এর NFC-মূল অবস্থান। */
export function fold(src: string): { f: string; map: number[]; nfc: string } {
  const nfc = src.normalize("NFC");
  let f = "";
  const map: number[] = [];
  for (let i = 0; i < nfc.length;) {
    const ch = String.fromCodePoint(nfc.codePointAt(i) as number);
    if (!IGNORABLE.test(ch)) {
      const l = ch.toLowerCase();
      for (let k = 0; k < l.length; k++) map.push(i);
      f += l;
    }
    i += ch.length;
  }
  return { f, map, nfc };
}

export const foldOnly = (s: string): string => fold(s).f;

/** query → অনন্য folded শব্দ (সর্বোচ্চ MAX_TOKENS) */
export function tokenize(query: string): string[] {
  const out: string[] = [];
  for (const t of foldOnly(query).split(/\s+/u)) if (t && !out.includes(t)) out.push(t);
  return out.slice(0, MAX_TOKENS);
}
