import type { NextConfig } from "next";

const demoRun = process.env.SA_DEMO_RUN;
const demoProfile = demoRun === "1" ? "demo" : (demoRun ?? "");
const nextConfig: NextConfig = {
  ...(/^demo(?:-[a-z0-9][a-z0-9-]{0,24})?$/.test(demoProfile) && {
    distDir: `.local/${demoProfile}/next`,
    typescript: { tsconfigPath: `.local/${demoProfile}/tsconfig.json` },
  }),
  /* config options here */
  poweredByHeader: false,
  logging: {
    incomingRequests: { ignore: [/\/access(?:\?|$)/] },
    serverFunctions: false,
  },
};

export default nextConfig;
