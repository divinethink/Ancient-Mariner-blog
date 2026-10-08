import { PageEditor } from "./PageEditor";

// slug নেই = নতুন পেজ; আছে = সম্পাদনা (Mockup §৭.১৬)
export default async function EditPageRoute({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  return <PageEditor slug={slug ? slug : undefined} />;
}
