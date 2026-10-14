// পুরনো পথ — আইকন এখন static ফাইল (scripts/build-site-icon.ts); ফাইলটি নিরাপদে মুছে ফেলা যায়
export const dynamic = "force-static";

export function GET() {
  return new Response(null, { status: 308, headers: { Location: "/icons/site-icon-apple.png" } });
}
