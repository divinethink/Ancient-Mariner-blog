"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { newId } from "@/lib/id";

// আইডি এখনই বানিয়ে edit-এ পাঠানো — create retry-নিরাপদ (postRepo.create idempotent); লেখা শুরুর আগে কিছু সংরক্ষিত হয় না
export default function NewPostPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/posts/${newId()}/edit?new=1`);
  }, [router]);
  return null;
}
