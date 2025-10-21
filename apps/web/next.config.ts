import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Prevent bundling of native modules for server-side code
  serverExternalPackages: ['@arc/platform-electron'],

  // Webpack configuration for handling platform-specific modules
  webpack: (config, { isServer }) => {
    // Provide empty modules for Node.js APIs that shouldn't be bundled for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };

      // Prevent bundling of platform-electron for client-side
      // These are dynamically imported only in Electron context
      config.resolve.alias = {
        ...config.resolve.alias,
        '@arc/platform-electron/database/BetterSqlite3Database.js': false,
        '@arc/platform-electron/http/NodeFetchHTTP.js': false,
        '@arc/platform-electron/filesystem/ElectronFileSystem.js': false,
      };
    }

    return config;
  },
};

export default nextConfig;
