import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Firestore rules-test — Emulator-এর ভেতরে চলে (npm run test:rules)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/rules/**/*.test.ts"], testTimeout: 20000, hookTimeout: 30000 },
});
