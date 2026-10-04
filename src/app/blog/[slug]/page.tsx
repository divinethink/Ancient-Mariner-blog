import { readHello } from "@/data/helloRepo.server";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "পরীক্ষা" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const msg = await readHello();
  return (
    <main>
      <h1>{decodeURIComponent(slug)}</h1>
      <p>static পেজ — Firestore: <b>{msg}</b></p>
    </main>
  );
}
