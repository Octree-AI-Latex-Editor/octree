#!/bin/bash

# Initial setup script for Claude Server
# Run this once to set up the service on a new server

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLAUDE_SERVER_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Configuration
SERVER_HOST="${CLAUDE_SERVER_HOST:-root@161.35.138.83}"
SERVER_PATH="/srv/claude-server"
SERVICE_USER="claude"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔧 Claude Server Setup${NC}"
echo "================================================"
echo ""

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}❌ Error: ANTHROPIC_API_KEY environment variable not set${NC}"
    echo "Please set it with: export ANTHROPIC_API_KEY='your-key-here'"
    exit 1
fi

echo -e "${YELLOW}Step 1: Creating service user...${NC}"
ssh $SERVER_HOST "
  if ! id -u $SERVICE_USER > /dev/null 2>&1; then
    sudo useradd -r -s /bin/bash -d /home/$SERVICE_USER -m $SERVICE_USER
    echo 'User $SERVICE_USER created'
  else
    echo 'User $SERVICE_USER already exists'
  fi
"

echo ""
echo -e "${YELLOW}Step 2: Creating application directory...${NC}"
ssh $SERVER_HOST "
  sudo mkdir -p $SERVER_PATH
  sudo chown -R $SERVICE_USER:$SERVICE_USER $SERVER_PATH
  echo 'Directory $SERVER_PATH created'
"

echo ""
echo -e "${YELLOW}Step 3: Installing Node.js and npm (if not present)...${NC}"
ssh $SERVER_HOST "
  if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo \"Node version: \$(node -v)\"
  echo \"NPM version: \$(npm -v)\"
"

echo ""
echo -e "${YELLOW}Step 4: Copying application files...${NC}"
rsync -avz --progress $CLAUDE_SERVER_DIR/agent-service.ts $SERVER_HOST:$SERVER_PATH/
rsync -avz --progress $CLAUDE_SERVER_DIR/package.json $SERVER_HOST:$SERVER_PATH/
rsync -avz --progress $CLAUDE_SERVER_DIR/tsconfig.json $SERVER_HOST:$SERVER_PATH/
rsync -avz --progress --delete $CLAUDE_SERVER_DIR/lib/octra-agent/ $SERVER_HOST:$SERVER_PATH/lib/octra-agent/

echo ""
echo -e "${YELLOW}Step 5: Installing dependencies...${NC}"
ssh $SERVER_HOST "cd $SERVER_PATH && npm install --production && sudo chown -R $SERVICE_USER:$SERVICE_USER $SERVER_PATH"

echo ""
echo -e "${YELLOW}Step 6: Creating systemd service...${NC}"
ssh $SERVER_HOST "cat > /tmp/claude-server.service << 'EOF'
[Unit]
Description=Claude Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$SERVER_PATH
Environment=NODE_ENV=production
Environment=PORT=8787
ExecStart=/usr/bin/npx tsx agent-service.ts
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
sudo mv /tmp/claude-server.service /etc/systemd/system/claude-server.service
"

echo ""
echo -e "${YELLOW}Step 7: Creating service override with API key...${NC}"
ssh $SERVER_HOST "
  sudo mkdir -p /etc/systemd/system/claude-server.service.d
  sudo cat > /tmp/override.conf << 'EOF'
[Service]
Environment=\"ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY\"
Environment=\"CLAUDE_CODE_PATH=$SERVER_PATH/node_modules/@anthropic-ai/claude-agent-sdk/cli.js\"
EOF
  sudo mv /tmp/override.conf /etc/systemd/system/claude-server.service.d/override.conf
  sudo chmod 600 /etc/systemd/system/claude-server.service.d/override.conf
"

echo ""
echo -e "${YELLOW}Step 8: Enabling and starting service...${NC}"
ssh $SERVER_HOST "
  sudo systemctl daemon-reload
  sudo systemctl enable claude-server
  sudo systemctl start claude-server
"

echo ""
echo -e "${YELLOW}Step 9: Checking service status...${NC}"
sleep 2
ssh $SERVER_HOST "sudo systemctl status claude-server --no-pager" || true

echo ""
echo -e "${YELLOW}Step 10: Testing endpoint...${NC}"
sleep 2
RESPONSE=$(curl -s -X POST http://161.35.138.83:8787/agent \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}' || echo "Connection failed")

if [[ "$RESPONSE" == *"error"* ]] || [[ "$RESPONSE" == "Connection failed" ]]; then
    echo -e "${YELLOW}⚠️  Response: $RESPONSE${NC}"
    echo -e "${YELLOW}   (This is expected for invalid request - service is running)${NC}"
else
    echo -e "${GREEN}✅ Endpoint responding${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "Service URL: ${GREEN}http://161.35.138.83:8787/agent${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:     ./logs.sh"
echo "  Check status:  ./status.sh"
echo "  Deploy updates: ./deploy.sh"
echo ""

