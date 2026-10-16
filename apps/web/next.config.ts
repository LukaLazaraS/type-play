import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live: a self-contained server bundle for the Docker image (deploy/server/web.Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
