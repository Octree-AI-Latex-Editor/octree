#!/bin/bash

# View live logs from the Claude Server

SERVER_HOST="${CLAUDE_SERVER_HOST:-root@161.35.138.83}"

echo "📜 Streaming logs from Claude Server..."
echo "Press Ctrl+C to exit"
echo ""

ssh $SERVER_HOST 'sudo journalctl -u claude-server -f --no-pager'

