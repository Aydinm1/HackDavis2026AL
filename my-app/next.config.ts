import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 20,
      static: 60,
    },
  },
};

export default nextConfig;
