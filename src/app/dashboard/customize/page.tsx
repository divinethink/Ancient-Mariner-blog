import Link from "next/link";
import { bn } from "@/i18n/bn";
import { BuildStatus } from "../BuildStatus";
import { CustomizeForm } from "./CustomizeForm";

// P9a-২/৩: সাইট সাজান — মেনু, footer, sidebar, Home (Mockup §৭.১৭); design P9b
export default function CustomizePage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-6 font-serif text-3xl font-bold">{bn.customize.title}</h1>
      <CustomizeForm />
      <div className="mt-10">
        <BuildStatus />
      </div>
    </>
  );
}
