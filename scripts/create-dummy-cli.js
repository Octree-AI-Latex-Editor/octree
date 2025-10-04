#!/usr/bin/env node

/**
 * Create dummy CLI file for serverless environments
 * This script runs at build time to create the required CLI file
 */

const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');

try {
  // If the SDK already ships a CLI, do nothing (don't overwrite)
  if (fs.existsSync(cliPath)) {
    console.log('✅ Claude Agent SDK CLI found, no-op:', cliPath);
    process.exit(0);
  }
  console.log('ℹ️ Claude Agent SDK CLI not found, skipping creation.');
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to create dummy CLI file:', error);
  process.exit(1);
}
