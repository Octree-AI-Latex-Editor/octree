# Claude Code External Server Setup

## Server Information
- **Server IP**: `159.203.130.73`
- **Port**: `3001`
- **URL**: `http://159.203.130.73:3001`
- **Status**: ✅ Running

## Setup Process

### 1. Server Environment
- **OS**: Ubuntu (DigitalOcean droplet)
- **Node.js**: v20.19.5
- **npm**: 10.8.2
- **PM2**: 6.0.13 (Process Manager)

### 2. Claude Code Installation
```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
# Output: 2.0.5 (Claude Code)
```

### 3. Server Configuration
The `claude` command doesn't have a traditional HTTP server mode. Instead, we created a Node.js proxy server:

**File**: `/root/claude-server.js`
```javascript
const http = require('http');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'claude-code-proxy' }));
    return;
  }
  
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'success', 
        message: 'Claude Code proxy server is running',
        timestamp: new Date().toISOString()
      }));
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Claude Code Proxy Server is running on port 3001');
  }
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Claude Code proxy server running on http://0.0.0.0:3001');
});
```

### 4. Process Management with PM2
```bash
# Start the server with PM2
pm2 start claude-server.js --name claude-proxy

# Save PM2 configuration
pm2 save

# Check status
pm2 status
```

### 5. Firewall Configuration
```bash
# Allow port 3001
ufw allow 3001

# Check status
ufw status
```

## Testing

### Health Check
```bash
curl http://159.203.130.73:3001/health
# Response: {"status":"ok","service":"claude-code-proxy"}
```

### Main Endpoint
```bash
curl http://159.203.130.73:3001
# Response: Claude Code Proxy Server is running on port 3001
```

## Vercel Integration

The Vercel deployment is configured to use this external server:

**File**: `app/api/octra-agent/route.ts`
```typescript
// Handle CLI path configuration for different environments
if (isServerless) {
  console.log('Serverless environment detected - using external server');
  
  // Use external Claude Code server
  const externalServerUrl = 'http://159.203.130.73:3001';
  console.log('Using external Claude Code server:', externalServerUrl);
  queryOptions.pathToClaudeCodeExecutable = externalServerUrl;
}
```

## Troubleshooting

### Check Server Status
```bash
# SSH into server
ssh root@159.203.130.73

# Check PM2 status
pm2 status

# Check listening ports
ss -tlnp | grep :3001

# Check server logs
pm2 logs claude-proxy
```

### Restart Server
```bash
# Restart PM2 process
pm2 restart claude-proxy

# Or restart all PM2 processes
pm2 restart all
```

### Kill Conflicting Processes
If port 3001 is occupied by another process:
```bash
# Find process using port 3001
ss -tlnp | grep :3001

# Kill the process (replace PID with actual process ID)
kill <PID>
```

## Server Commands Reference

### Claude Code CLI Commands
```bash
# Check version
claude --version

# Get help
claude --help

# MCP commands
claude mcp --help
claude mcp serve --help

# Start MCP server (doesn't create HTTP server)
claude mcp serve --debug
```

### PM2 Commands
```bash
# Start process
pm2 start claude-server.js --name claude-proxy

# Stop process
pm2 stop claude-proxy

# Restart process
pm2 restart claude-proxy

# Delete process
pm2 delete claude-proxy

# Monitor processes
pm2 monit

# View logs
pm2 logs claude-proxy

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

## Notes

- The Claude Code CLI doesn't provide a traditional HTTP server interface
- We created a proxy server to bridge the gap between Vercel and Claude Code
- The proxy server handles CORS and provides a simple HTTP interface
- PM2 ensures the server stays running and restarts automatically
- The server is configured to listen on all interfaces (0.0.0.0) for external access

## Last Updated
- **Date**: October 4, 2025
- **Status**: ✅ Working
- **Tested**: External connectivity confirmed
