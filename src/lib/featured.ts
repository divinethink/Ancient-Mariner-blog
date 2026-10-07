// Home-এর featured লেখা বাছাই (Arch §১৭ P4b): owner-বাছা (`featured`) হলে সর্বশেষ `publishedAt`; একটাও না থাকলে সর্বশেষ published।
export type FeaturedCandidate = { id: string; featured?: boolean; publishedAt?: Date };

const time = (p: FeaturedCandidate): number => p.publishedAt?.getTime() ?? 0;

function latest(ps: readonly FeaturedCandidate[]): FeaturedCandidate | undefined {
  // সমান সময়ে আগেরটা (ইনপুট = build-ডেটার ক্রম, `publishedAt desc`)
  return ps.reduce<FeaturedCandidate | undefined>((m, p) => (!m || time(p) > time(m) ? p : m), undefined);
}

export function pickFeatured(posts: readonly FeaturedCandidate[]): string | undefined {
  return (latest(posts.filter((p) => p.featured === true)) ?? latest(posts))?.id;
}
