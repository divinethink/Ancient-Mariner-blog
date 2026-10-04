import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workers.dev-এ next/image optimizer নেই; ছবি-optimization Cloudinary-র (P6)
  images: { unoptimized: true },
};

export default nextConfig;
