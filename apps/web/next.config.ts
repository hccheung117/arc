import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Prevent bundling of native modules for server-side code
  serverExternalPackages: ['@arc/platform-electron'],

  // Webpack config (used by default for production builds)
  // Turbopack for dev mode works without additional config due to dynamic imports
  webpack: (config, { isServer }) => {
    // Provide empty modules for Node.js APIs that shouldn't be bundled for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
