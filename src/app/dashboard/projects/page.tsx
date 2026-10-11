import { bn } from "@/i18n/bn";
import { ProjectList } from "./ProjectList";

// `?pick=1` = ⊕ → "নতুন অধ্যায়": প্রজেক্ট বাছলে সরাসরি নতুন-অধ্যায় editor
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ pick?: string }> }) {
  const { pick } = await searchParams;
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{pick === "1" ? bn.projects.pickTitle : bn.projects.title}</h1>
      <ProjectList pick={pick === "1"} />
    </>
  );
}
