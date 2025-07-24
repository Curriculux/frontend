import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "10mb", // Increase the limit to 10 MB
  },
};

export default nextConfig;
