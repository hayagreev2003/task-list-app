import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // CSV import accepts files up to 1 MB; leave headroom for multipart overhead.
      // The 1 MB / 5,000-row app limit is enforced inside the action.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
