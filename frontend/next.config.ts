import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images - unoptimized for Netlify CDN
  images: {
    unoptimized: true,
  },
  // Ensure proper ISR configuration
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
