import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds the static site for GitHub Pages (folder `out/`).
// NEXT_PUBLIC_BASE_PATH is "/Datedly-AI" on Pages, empty locally.
const isExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" as const, trailingSlash: true } : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
