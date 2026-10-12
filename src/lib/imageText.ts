// ছবির টেক্সট-রূপ (P6-গ২, pure): export/কপিতে ছবি embed না হলে `[ছবি: ক্যাপশন]` (ক্যাপশন না থাকলে alt, দুটোই না থাকলে `[ছবি]`)।
// এক জায়গায় রাখা — serialize (কপি/Markdown), docHtml (HTML export) ও exportDocx (Word) একই নিয়ম মানে।
type Attrs = Record<string, unknown> | undefined;

const line = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** ক্যাপশন, না থাকলে alt, না থাকলে "" (এক লাইনে) */
export function imageLabel(attrs: Attrs): string {
  return line(attrs?.caption) || line(attrs?.alt);
}

export function imagePlaceholder(attrs: Attrs): string {
  const l = imageLabel(attrs);
  return l ? `[ছবি: ${l}]` : "[ছবি]";
}

export const imageAlt = (attrs: Attrs): string => line(attrs?.alt);
export const imageCaption = (attrs: Attrs): string => line(attrs?.caption);
