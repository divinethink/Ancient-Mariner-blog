import { expect, it } from "vitest";
import { createLogger } from "./logger";

it("min level-এর নিচের লাইন বাদ; বাকিগুলো JSON", () => {
  const out: string[] = [];
  const log = createLogger("warn", (l) => out.push(l));
  log.info("বাদ");
  log.error("ধরা", { code: 7 });
  expect(out).toHaveLength(1);
  expect(JSON.parse(out[0])).toMatchObject({ level: "error", msg: "ধরা", code: 7 });
});
