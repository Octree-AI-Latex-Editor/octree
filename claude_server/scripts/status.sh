#!/bin/bash

# Check the status of the Claude Server

SERVER_HOST="${CLAUDE_SERVER_HOST:-root@161.35.138.83}"

echo "🔍 Checking Claude Server Status..."
echo ""

# Service status
echo "=== Service Status ==="
ssh $SERVER_HOST 'sudo systemctl status claude-server --no-pager' || true

echo ""
echo "=== Process Info ==="
ssh $SERVER_HOST 'ps aux | grep -E "agent-service|tsx" | grep -v grep'

echo ""
echo "=== Port Status ==="
ssh $SERVER_HOST 'ss -tlnp | grep 8787'

echo ""
echo "=== Memory Usage ==="
ssh $SERVER_HOST 'free -h'

echo ""
echo "=== Disk Usage ==="
ssh $SERVER_HOST 'df -h | grep -E "Filesystem|/dev/vda1"'

echo ""
echo "=== Endpoint Test ==="
RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://161.35.138.83:8787/agent \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}' 2>&1 || echo "Connection failed")

echo "$RESPONSE"

echo ""
echo "=== Recent Logs (last 10 lines) ==="
ssh $SERVER_HOST 'sudo journalctl -u claude-server -n 10 --no-pager'

