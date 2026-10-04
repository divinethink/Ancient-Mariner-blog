import { describe, expect, it } from "vitest";
import { buildAppCsp } from "./csp";

describe("buildAppCsp", () => {
  const csp = buildAppCsp("N0NCE", "proj");
  it("nonce আছে, strict-dynamic/unsafe-eval নেই", () => {
    expect(csp).toContain("script-src 'self' 'nonce-N0NCE'");
    expect(csp).not.toContain("strict-dynamic");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("Firebase authDomain ও framing-নিষেধ", () => {
    expect(csp).toContain("frame-src https://proj.firebaseapp.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
