import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  images: {
    remotePatterns: [
      // Product / category / store images uploaded through the backend live on R2.
      { protocol: "https", hostname: "pub-2b2f1ec06bd046e8a1cfdbd55e528441.r2.dev" },
      // Placeholder photography for the demo/empty-state content only.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, and needs scope "/".
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
