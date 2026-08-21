import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships native binaries; bundling it breaks the server build.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Stone photographs come straight off a phone camera.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
