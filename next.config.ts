import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.streeteasy.com" },
      { protocol: "https", hostname: "streeteasy.com" },
      // StreetEasy is owned by Zillow — listing photos are served from Zillow's CDN
      { protocol: "https", hostname: "*.zillowstatic.com" },
      { protocol: "https", hostname: "zillowstatic.com" },
    ],
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
