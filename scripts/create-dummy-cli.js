#!/usr/bin/env node

/**
 * Create dummy CLI file for serverless environments
 * This script runs at build time to create the required CLI file
 */

const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
const dummyCliContent = `#!/usr/bin/env node
console.log("Dummy CLI for serverless environment");
process.exit(0);
`;

try {
  // Ensure the directory exists
  const dir = path.dirname(cliPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create the dummy CLI file
  fs.writeFileSync(cliPath, dummyCliContent);
  fs.chmodSync(cliPath, '755');
  
  console.log('✅ Created dummy CLI file at:', cliPath);
} catch (error) {
  console.error('❌ Failed to create dummy CLI file:', error);
  process.exit(1);
}
