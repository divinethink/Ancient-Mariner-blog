import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Firestore rules-test — Emulator-এর ভেতরে চলে (npm run test:rules)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // সব ফাইল একই Emulator project-এ চলে ও beforeEach-এ clearFirestore করে — ফাইল সমান্তরালে চললে একে অন্যের ডেটা মুছে ফেলে (এলোমেলো ব্যর্থতা); তাই ফাইল একটার পর একটা
  test: { include: ["tests/rules/**/*.test.ts"], testTimeout: 20000, hookTimeout: 30000, fileParallelism: false,
    // ইচ্ছাকৃত 'permission denied' পরীক্ষার Firestore-SDK stderr লগ ভরে দেয় ও আসল ব্যর্থতা চাপা দেয় — শুধু সেগুলো লুকানো; test-ফল/error অক্ষত
    onConsoleLog: (log, type) => !(type === "stderr" && log.includes("GrpcConnection RPC")),
  },
});
