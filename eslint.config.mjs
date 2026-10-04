// Architecture guardrails (Roadmap §৪, Checklist P0b): lib/ বিশুদ্ধ, firebase শুধু data/auth-এ, privileged শুধু server-entry-তে
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

const compat = {
  group: ["firebase/compat", "firebase/compat/*"],
  message: "firebase compat নিষিদ্ধ — modular SDK ব্যবহার করুন",
};
const firebase = {
  group: ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"],
  message: "firebase শুধু src/data, src/auth, src/firebaseConfig.ts-এ",
};
const privileged = {
  group: ["@/data/privileged", "@/data/privileged/*", "**/data/privileged", "**/data/privileged/*"],
  message: "data/privileged শুধু route handler/middleware/cron থেকে",
};
const libBanned = [
  {
    group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*"],
    message: "lib/ React/Next-মুক্ত থাকবে",
  },
  {
    group: ["@/data", "@/data/*", "@/auth", "@/auth/*", "**/data/*", "**/auth/*"],
    message: "lib/ data/auth-মুক্ত থাকবে",
  },
];
const rule = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

const config = [
  { ignores: [".next/**", ".open-next/**", "node_modules/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  { files: ["src/**/*.{ts,tsx}"], rules: rule(compat, firebase, privileged) },
  {
    files: ["src/data/**", "src/auth/**", "src/firebaseConfig.ts"],
    rules: rule(compat, privileged),
  },
  { files: ["src/data/privileged/**"], rules: rule(compat) },
  {
    files: ["src/app/**/route.ts", "src/middleware.ts", "src/cron/**"],
    rules: rule(compat, firebase),
  },
  { files: ["src/lib/**"], rules: rule(compat, firebase, privileged, ...libBanned) },
  prettier,
];

export default config;
