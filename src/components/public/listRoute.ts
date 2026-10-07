// /blog, /category|tag|series/[slug] route-গুলোর সাধারণ সহায়ক (build-সময়ে; Worker-এ নয়)।
import type { Metadata } from "next";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import type { ScopeKind } from "@/lib/publicLists";
import { buildSeo } from "@/lib/seo";

// Next বাংলা param encoded দেয়; slug-এ '%' অসম্ভব, তাই decode idempotent
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export async function findScope(kind: ScopeKind, rawSlug?: string) {
  const scopes = await getPublicScopes();
  const slug = rawSlug === undefined ? undefined : decode(rawSlug);
  return scopes.find((s) => s.kind === kind && (slug === undefined || s.term?.slug === slug));
}

export async function scopeParams(kind: ScopeKind) {
  return (await getPublicScopes()).filter((s) => s.kind === kind && s.term).map((s) => ({ slug: s.term!.slug }));
}

export async function scopeMetadata(kind: ScopeKind, rawSlug?: string): Promise<Metadata> {
  const [scope, settings] = await Promise.all([findScope(kind, rawSlug), getPublicSettings()]);
  if (!scope) return {};
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  const name = scope.term?.name ?? bn.public.blog;
  return buildSeo({
    siteUrl,
    siteName: settings.siteTitle,
    title: `${name} — ${settings.siteTitle}`,
    description: scope.term?.description || (scope.kind === "blog" ? settings.tagline : undefined),
    path: scope.path,
    allowIndexing: settings.allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}
