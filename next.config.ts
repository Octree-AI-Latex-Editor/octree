import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure dummy Claude Code CLI is included in the serverless bundle
  // so the SDK doesn't error when probing for it.
  outputFileTracingIncludes: {
    'app/api/octra-agent/route': [
      './lib/octra-agent/claude-code-dummy.js',
    ],
  },
};

export default nextConfig;
