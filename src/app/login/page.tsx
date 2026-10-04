import { bn } from "@/i18n/bn";
import { safeNext } from "@/lib/session";
import { LoginForm } from "./LoginForm";

// nonce-CSP পেতে dynamic রেন্ডার বাধ্যতামূলক (static হলে inline script ব্লক হতো)
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-6 font-serif text-3xl font-bold">{bn.siteName}</h1>
      <LoginForm next={safeNext(next)} />
    </>
  );
}
