// firestore.rules.tpl-এর placeholder বসানো (Arch §৪, §৯); বাকি placeholder থাকলে বা uid ফাঁকা হলে ব্যর্থ
import { PAGE_STATUS, POST_STATUS, POST_VISIBILITY } from "./enums";

const list = (a: readonly string[]) => `[${a.map((v) => `'${v}'`).join(", ")}]`;

export function renderRules(tpl: string, ownerUid: string): string {
  if (!/^[A-Za-z0-9]{10,}$/.test(ownerUid)) throw new Error("OWNER_UID ফাঁকা বা অবৈধ");
  const out = tpl
    .replaceAll("__OWNER_UID__", ownerUid)
    .replaceAll("__POST_STATUS__", list(POST_STATUS))
    .replaceAll("__POST_VISIBILITY__", list(POST_VISIBILITY))
    .replaceAll("__PAGE_STATUS__", list(PAGE_STATUS));
  const left = out.match(/__[A-Z_]+__/);
  if (left) throw new Error(`অবসমাপ্ত placeholder: ${left[0]}`);
  return out;
}
