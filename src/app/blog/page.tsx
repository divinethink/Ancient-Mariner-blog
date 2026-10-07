import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListPage } from "@/components/public/ListPage";
import { findScope, scopeMetadata } from "@/components/public/listRoute";

// build-সময়ে prerender (Arch §১২); প্রতি পেজ `postsPerPage`, বাকি [আরও দেখান] chunk
export const dynamic = "force-static";
export const generateMetadata = (): Promise<Metadata> => scopeMetadata("blog");

export default async function BlogIndex() {
  const scope = await findScope("blog");
  if (!scope) notFound();
  return <ListPage scope={scope} />;
}
