import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListPage } from "@/components/public/ListPage";
import { findScope, scopeMetadata, scopeParams } from "@/components/public/listRoute";

// build-সময়ে শুধু লেখা-থাকা term-এর পেজ; অন্য slug = 404 (Arch §১৭ P4a)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => scopeParams("series");
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return scopeMetadata("series", (await params).slug);
}

export default async function Page({ params }: Props) {
  const scope = await findScope("series", (await params).slug);
  if (!scope) notFound();
  return <ListPage scope={scope} />;
}
