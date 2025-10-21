import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  webpack: (config, { isServer }) => {
    // sql.js has Node.js-specific code that shouldn't be bundled for the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    // platform-desktop uses better-sqlite3 (Node.js native module)
    // It's only imported dynamically in Electron, so ignore it on the server
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("@arc/platform-desktop");
      }
    }

    return config;
  },
};

export default nextConfig;
