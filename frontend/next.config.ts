import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images - unoptimized for Netlify CDN
  images: {
    unoptimized: true,
  },
  // Ensure proper ISR configuration
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60 seconds
    pagesBufferLength: 5,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
