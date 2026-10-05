// firestore.rules.tpl → firestore.rules (OWNER_UID env থেকে, enum-তালিকা lib/enums.ts থেকে)
// `--test`: শুধু emulator boot-এর জন্য নকল uid (npm run test:rules); deploy কখনো এই মোডে না
import { readFileSync, writeFileSync } from "node:fs";
import { renderRules } from "../src/lib/renderRules";

const TEST_UID = "testOwnerUid1234567890"; // tests/rules/firestore.rules.test.ts-এর সাথে মিল
const uid = process.argv.includes("--test") ? TEST_UID : (process.env.OWNER_UID ?? "");
const out = renderRules(readFileSync("firestore.rules.tpl", "utf8"), uid);
writeFileSync("firestore.rules", out);
console.log("✅ firestore.rules তৈরি");
