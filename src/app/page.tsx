import Link from "next/link";
import { readHello } from "@/data/helloRepo.server";

export const dynamic = "force-static";

export default async function Home() {
  const msg = await readHello();
  return (
    <main>
      <h1>P0a — Deploy যাচাই</h1>
      <p>Firestore REST থেকে পড়া: <b>{msg}</b></p>
      <Link href="/blog/পরীক্ষা" prefetch={false}>বাংলা slug পেজ →</Link>
    </main>
  );
}
