// পড়ার সময় (Arch §১৭ P4a): ceil(wordCount / ২০০) মিনিট; শব্দ থাকলে কমপক্ষে ১।
export const WORDS_PER_MINUTE = 200;

export function readingMinutes(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}
