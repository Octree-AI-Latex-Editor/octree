import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure dummy Claude Code CLI is included in the serverless bundle
  // so the SDK doesn't error when probing for it.
  outputFileTracingIncludes: {
    'app/api/octra-agent/route': [
      './node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
    ],
  },
};

export default nextConfig;
