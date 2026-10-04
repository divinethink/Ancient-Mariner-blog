// firestore.rules.tpl → firestore.rules (OWNER_UID env থেকে, enum-তালিকা lib/enums.ts থেকে)
import { readFileSync, writeFileSync } from "node:fs";
import { renderRules } from "../src/lib/renderRules";

const uid = process.env.OWNER_UID ?? "";
const out = renderRules(readFileSync("firestore.rules.tpl", "utf8"), uid);
writeFileSync("firestore.rules", out);
console.log("✅ firestore.rules তৈরি");
