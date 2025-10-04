import path from 'path';
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
      // Prefer explicit path via env var, else fall back to bundled dummy stub in prod
      // to prevent the SDK from throwing when it probes for a CLI.
      pathToClaudeCodeExecutable:
        process.env.CLAUDE_CODE_PATH ||
        (process.env.NODE_ENV === 'production'
          ? path.join(process.cwd(), 'lib', 'octra-agent', 'claude-code-dummy.js')
          : undefined),
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
