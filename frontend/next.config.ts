import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Images - unoptimized for Netlify CDN
  images: {
    unoptimized: true,
  },
  // Ensure proper ISR configuration
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Tell Next.js NOT to bundle pdfjs-dist with webpack.
  // It must be loaded natively by Node.js on the server (not as a browser bundle).
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@next/swc-linux-x64-gnu/**/*',
      'node_modules/@next/swc-linux-x64-musl/**/*',
      'node_modules/@next/swc-win32-x64-msvc/**/*',
      'node_modules/@prisma/engines/**/*',
      'node_modules/typescript/**/*',
      'node_modules/playwright/**/*',
      'node_modules/playwright-core/**/*',
      'node_modules/@playwright/**/*',
      'node_modules/eslint/**/*',
      'node_modules/@eslint/**/*',
    ],
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
