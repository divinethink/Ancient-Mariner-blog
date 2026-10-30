// সামঞ্জস্যপূর্ণ ইনলাইন SVG আইকন (নতুন প্যাকেজ নয়) — currentColor, 24px viewBox, stroke ১.৮; সজ্জা-মাত্র (aria-hidden)।
// UI-র লেবেল আলাদা টেক্সটে থাকে; আইকন-একা বাটনে ডাকার জায়গায় aria-label দিতে হবে।
const PATHS = {
  library: "M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2h6.5A1.5 1.5 0 0 1 20 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z",
  projects: "M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 18H20M8.5 8h7",
  plus: "M12 5v14M5 12h14",
  diary: "M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6zM6 4v16M9.5 8.5h5M9.5 12h5",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  inbox: "M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13h4.5a3.5 3.5 0 0 0 7 0H20",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  page: "M7 4h7l4 4v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 4v4h4M9 13h6M9 16h6",
  palette: "M12 4a8 8 0 1 0 0 16c1.4 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a3 3 0 0 0 3-3c0-4.4-3.6-8.5-8-8.5zM8 11h.01M11 8h.01M15 9h.01",
  image: "M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 16l4.5-4.5L13 16M14 13l2-2 4 4M9 9h.01",
  import: "M12 4v11M8 11l4 4 4-4M5 19h14",
  organize: "M4 5h7v6H4zM13 5h7v6h-7zM4 14h7v5H4zM13 14h7v5h-7z",
  chart: "M5 20V10M12 20V4M19 20v-7",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  comment: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  backup: "M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 0 8.5zM12 11v6M9.5 13.5L12 11l2.5 2.5",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 1.9 1.5a7.7 7.7 0 0 0 0 3l-1.9 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  chevron: "M9 6l6 6-6 6",
  globe: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 12h16M12 4c2.2 2.2 3.3 4.9 3.3 8S14.2 17.8 12 20c-2.2-2.2-3.3-4.9-3.3-8S9.8 6.2 12 4z",
  lock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3",
  mail: "M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6",
  fingerprint:
    "M6.5 9.5A6 6 0 0 1 12 6a6 6 0 0 1 5.5 3.5M5 13a7 7 0 0 1 .3-2M19 13a7 7 0 0 0-.3-2M12 10a3 3 0 0 0-3 3c0 2.2.5 4 1.5 5.5M12 10a3 3 0 0 1 3 3c0 1.2-.1 2.4-.4 3.5M12 13c0 2 .4 3.6 1.2 5M9 20c-.3-.6-.6-1.2-.8-1.8M15.5 20c.4-.7.7-1.4.9-2",
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  review: "M5 6h14M5 12h14M5 18h8M16.5 17.5l1.7 1.7 3-3.4",
  calendar: "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  /** active অবস্থায় একটু মোটা (নেভ) */
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
