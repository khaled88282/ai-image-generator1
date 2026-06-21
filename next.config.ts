import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.freegen.app",
      },
      {
        protocol: "https",
        hostname: "imgsearch.com",
      },
      {
        protocol: "https",
        hostname: "aifnet-projects.b-cdn.net",
      },
    ],
  },
};

export default nextConfig;
