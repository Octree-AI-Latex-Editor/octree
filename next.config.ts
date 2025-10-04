import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Disable CSS optimization to avoid Lightning CSS issues
    optimizeCss: false,
  },
  // Ensure proper module resolution for Lightning CSS
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure Lightning CSS binaries are properly resolved on server
      config.externals = config.externals || [];
      config.externals.push({
        'lightningcss': 'lightningcss',
      });
    }
    return config;
  },
};

export default nextConfig;
