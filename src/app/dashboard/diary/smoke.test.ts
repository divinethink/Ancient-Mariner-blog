// JSX import করা যায় না (vitest শুধু .ts, JSX transform নেই) — তাই শুধু i18n-তথ্য যাচাই
import { describe, expect, it } from "vitest";
import { bn } from "@/i18n/bn";

describe("bn.diary", () => {
  it("সপ্তাহ ৭ দিন, বছর ১২ মাস", () => {
    expect(bn.diary.weekdays).toHaveLength(7);
    expect(bn.diary.months).toHaveLength(12);
  });
});
