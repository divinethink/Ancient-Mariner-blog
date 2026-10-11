import { notFound } from "next/navigation";
import { isValidPostId } from "@/lib/id";
import { ProjectDetail } from "./ProjectDetail";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidPostId(projectId)) notFound();
  return <ProjectDetail projectId={projectId} />;
}
