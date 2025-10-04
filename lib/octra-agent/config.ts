/**
 * Configuration utilities for the Octra Agent
 * Centralizes configuration management and external server setup
 */

/**
 * Get the configuration for using only in-process MCP server
 * @returns Configuration options without external server
 */
export function getExternalServerConfig() {
  return {
    queryOptions: {
      includePartialMessages: true,
      allowedTools: ['get_context', 'propose_edits'],
      permissionMode: 'bypassPermissions' as const,
      // Point to dummy CLI file for serverless environments
      pathToClaudeCodeExecutable: process.env.NODE_ENV === 'production' 
        ? '/vercel/path0/node_modules/@anthropic-ai/claude-agent-sdk/cli.js'
        : undefined,
    }
  };
}

/**
 * Create MCP server configuration for the Agent SDK
 * @param tools - Array of tools to include
 * @returns MCP server configuration
 */
export function createMCPServerConfig(tools: unknown[]) {
  return {
    name: 'octra-tools',
    version: '1.0.0',
    tools,
  };
}
