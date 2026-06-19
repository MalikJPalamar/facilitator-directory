import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages are shipped as TypeScript source.
  transpilePackages: ["@directory/contracts"],
};

export default config;
