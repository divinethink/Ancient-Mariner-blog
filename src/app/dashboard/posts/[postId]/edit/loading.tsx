import { bn } from "@/i18n/bn";

// ট্যাপ করামাত্র দেখায় (সার্ভারের উত্তরের অপেক্ষায় স্ক্রিন জমে থাকে না); এটি থাকায় Next এই রুট আংশিক আগে-লোডও করতে পারে
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className="mb-3 text-muted">{bn.editor.loading}</p>
      <div className="min-h-[55vh] animate-pulse rounded-xl bg-line" aria-hidden />
    </div>
  );
}
