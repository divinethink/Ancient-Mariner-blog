import { bn } from "@/i18n/bn";

export const dynamic = "force-static";

export default function Home() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold">{bn.siteName}</h1>
      <p className="text-muted">{bn.comingSoon}</p>
    </>
  );
}
