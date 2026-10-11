// প্রজেক্ট/অধ্যায়ের dashboard-পথ ও ছোট pure নিয়ম (UI-মুক্ত; P14a-২)।

export const projectPath = (projectId: string): string => `/dashboard/projects/${projectId}`;
export const chapterPath = (projectId: string, chapterId: string): string => `${projectPath(projectId)}/chapters/${chapterId}`;
/** `?new=1` = id আগে বানানো; প্রথম সংরক্ষণে create (retry-নিরাপদ) */
export const newChapterPath = (projectId: string, chapterId: string): string => `${chapterPath(projectId, chapterId)}?new=1`;

/** প্রজেক্ট Public না হলে অধ্যায়ের 'Public' বন্ধ (rules-এও আটকায়; এটা UI-র আগাম-নিষেধ) */
export const canChapterBePublic = (projectVisibility: string): boolean => projectVisibility === "public";
