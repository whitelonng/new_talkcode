import { createMDX } from "fumadocs-mdx/next";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.talkcody.com",
        pathname: "/images/**",
      },
    ],
  },
  // Performance optimizations
  experimental: {
    // Enable optimized package imports for better tree-shaking
    optimizePackageImports: ["lucide-react"],
    // Inline critical CSS to reduce render-blocking
    optimizeCss: true,
  },
  // Configure Turbopack for monorepo support
  turbopack: {
    // Point to project root to resolve workspace packages
    resolveAlias: {
      '@talkcody/shared': '../packages/shared/src/index.ts',
      '@talkcody/shared/*': '../packages/shared/src/*',
    },
  },
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Target modern browsers to reduce polyfills
  // This reduces bundle size by ~14KB by not including polyfills for:
  // Array.prototype.at, Array.prototype.flat, Object.fromEntries, etc.
  // Transpile workspace packages for monorepo support
  transpilePackages: ['@talkcody/shared'],
};

export default withMDX(config);
