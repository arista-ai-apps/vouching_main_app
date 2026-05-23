import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone mode for better Netlify compatibility
  output: "standalone",
  // Compress optimized images
  images: {
    unoptimized: true, // Required for Netlify static export
  },
  // Ensure proper ISR configuration
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60 seconds
    pagesBufferLength: 5,
  },
};

export default nextConfig;
