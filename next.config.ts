import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  logging: {
    incomingRequests: { ignore: [/\/access(?:\?|$)/] },
    serverFunctions: false,
  },
};

export default nextConfig;
