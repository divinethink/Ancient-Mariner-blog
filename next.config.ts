import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workers.dev-এ next/image optimizer নেই; ছবি-optimization Cloudinary-র (P6)
  images: { unoptimized: true },
  // browser-এ Firebase Auth-এর projectId (secret নয়) — CI-র FIREBASE_PROJECT_ID থেকে build-সময়ে inline
  env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "" },
};

export default nextConfig;
