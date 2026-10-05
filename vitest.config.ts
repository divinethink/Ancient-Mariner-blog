import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // শুধু src: tests/rules-এ Emulator লাগে, সেগুলো `npm run test:rules` (vitest.rules.config.ts) চালায়
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
