import { bn } from "@/i18n/bn";

// ড্যাশবোর্ডের যেকোনো পাতা খোলার সময় সাথে সাথে দেখায় (সার্ভারের উত্তরের অপেক্ষায় স্ক্রিন জমে থাকে না); এটি থাকায় Next রুটগুলো আংশিক আগে-লোডও করতে পারে
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className="mb-3 text-muted">{bn.editor.loading}</p>
      <div className="min-h-[40vh] animate-pulse rounded-xl bg-line" aria-hidden />
    </div>
  );
}
