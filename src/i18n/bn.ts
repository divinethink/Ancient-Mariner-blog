// UI-টেক্সট কেন্দ্রীয় ফাইলে (Checklist P0c)। নতুন স্ট্রিং এখানে যোগ হবে, কম্পোনেন্টে হার্ডকোড নয়।
export const bn = {
  siteName: "Ancient Mariner",
  comingSoon: "শীঘ্রই আসছে।",
  skipToContent: "মূল লেখায় যান",
  error: {
    title: "কিছু একটা ঠিক হয়নি",
    body: "পেজটি দেখাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    retry: "আবার চেষ্টা করুন",
  },
  auth: {
    signIn: "Google দিয়ে সাইন-ইন",
    signingIn: "সাইন-ইন হচ্ছে…",
    notOwner: "এই অ্যাকাউন্টে অ্যাক্সেস নেই।",
    tryOther: "অন্য অ্যাকাউন্টে চেষ্টা করুন",
    failed: "সাইন-ইন করা যায়নি। আবার চেষ্টা করুন।",
    checking: "যাচাই হচ্ছে…",
    sessionLost: "সেশন মেলেনি — আবার সাইন-ইন করুন।",
    signOut: "সাইন-আউট",
    signOutFailed: "সাইন-আউট করা যায়নি। নেট দেখে আবার চেষ্টা করুন।",
    confirmDiscard: "সংরক্ষণহীন লেখা মুছে যাবে — নিশ্চিত?",
  },
  dashboard: { library: "লাইব্রেরি", soon: "লেখার ঘর শীঘ্রই আসছে।" },
} as const;
