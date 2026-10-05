import Script from "next/script";
import { CF_BEACON_SRC, analyticsToken, beaconAttr } from "@/lib/analytics";

/** Cloudflare Web Analytics: শুধু পাবলিক পেজে; build-env `CF_ANALYTICS_TOKEN` বৈধ হলেই render (নইলে কিছুই নয়) */
export function Analytics() {
  const token = analyticsToken(process.env.CF_ANALYTICS_TOKEN);
  if (!token) return null;
  return <Script src={CF_BEACON_SRC} strategy="lazyOnload" data-cf-beacon={beaconAttr(token)} />;
}
