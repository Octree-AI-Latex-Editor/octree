#!/bin/bash

# ============================================================================
# LaTeX Compilation Server - Deployment Script
# ============================================================================
# This script deploys and manages the LaTeX compilation server on DigitalOcean
#
# Usage:
#   ./deploy.sh analyze    - Analyze current server setup
#   ./deploy.sh deploy     - Deploy/update the server
#   ./deploy.sh restart    - Restart the service
#   ./deploy.sh logs       - View recent logs
#   ./deploy.sh test       - Test the compilation endpoint
#   ./deploy.sh monitor    - Monitor server health
# ============================================================================

set -e

# Configuration
SERVER_IP="142.93.195.236"
SERVER_USER="root"
SERVER_DIR="/opt/latex-service"
SERVICE_NAME="latex-compile"
PORT=3001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
}

# Function to check SSH connection
check_ssh() {
    log_info "Checking SSH connection to $SERVER_IP..."
    
    if ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_IP" echo "SSH connection successful" >/dev/null 2>&1; then
        log_success "SSH connection established"
        return 0
    else
        log_error "SSH connection failed"
        log_info "Make sure you have SSH access configured:"
        echo "  ssh-copy-id $SERVER_USER@$SERVER_IP"
        exit 1
    fi
}

# Function to analyze server
analyze_server() {
    log_info "Analyzing server setup..."
    
    ssh "$SERVER_USER@$SERVER_IP" bash << 'ENDSSH'
        echo "================================================"
        echo "  System Information"
        echo "================================================"
        echo "OS: $(lsb_release -d | cut -f2)"
        echo "Kernel: $(uname -r)"
        echo "CPU: $(nproc) cores"
        echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
        echo "Disk Usage:"
        df -h / | tail -1
        echo ""
        
        echo "================================================"
        echo "  LaTeX Installation"
        echo "================================================"
        if command -v pdflatex >/dev/null 2>&1; then
            echo "pdflatex: $(which pdflatex)"
            echo "Version: $(pdflatex --version | head -1)"
        else
            echo "❌ pdflatex not found"
        fi
        echo ""
        
        echo "================================================"
        echo "  Node.js Installation"
        echo "================================================"
        if command -v node >/dev/null 2>&1; then
            echo "node: $(which node)"
            echo "Version: $(node --version)"
            echo "npm: $(npm --version)"
        else
            echo "❌ Node.js not found"
        fi
        echo ""
        
        echo "================================================"
        echo "  Service Status"
        echo "================================================"
        if systemctl is-active --quiet latex-compile 2>/dev/null; then
            echo "✓ latex-compile service is running"
            systemctl status latex-compile --no-pager | grep -E "Active:|Memory:|CPU:"
        elif [ -f /etc/systemd/system/latex-compile.service ]; then
            echo "⚠ latex-compile service exists but is not running"
        else
            echo "❌ latex-compile service not configured"
        fi
        echo ""
        
        echo "================================================"
        echo "  Current Installation"
        echo "================================================"
        if [ -d "/opt/latex-service" ]; then
            echo "Directory: /opt/latex-service"
            ls -lah /opt/latex-service/
            
            if [ -f "/opt/latex-service/package.json" ]; then
                echo ""
                echo "Dependencies:"
                cat /opt/latex-service/package.json | grep -A 10 "dependencies"
            fi
        else
            echo "❌ /opt/latex-service directory not found"
        fi
        echo ""
        
        echo "================================================"
        echo "  Network & Firewall"
        echo "================================================"
        echo "Open ports:"
        if command -v ss >/dev/null 2>&1; then
            ss -tulpn | grep LISTEN | grep -E ":3001|:80|:443" || echo "No services listening on standard ports"
        fi
        
        echo ""
        echo "Firewall status:"
        if command -v ufw >/dev/null 2>&1; then
            ufw status | head -10
        else
            echo "ufw not installed"
        fi
        echo ""
        
        echo "================================================"
        echo "  Recent Logs (last 20 lines)"
        echo "================================================"
        if [ -f "/var/log/latex-compile.log" ]; then
            tail -20 /var/log/latex-compile.log
        elif journalctl -u latex-compile -n 20 --no-pager >/dev/null 2>&1; then
            journalctl -u latex-compile -n 20 --no-pager
        else
            echo "No logs found"
        fi
ENDSSH
    
    log_success "Analysis complete"
}

# Function to deploy server
deploy_server() {
    log_info "Deploying LaTeX compilation server..."
    
    # Create local temp directory for deployment files
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    # Copy files to temp directory
    cp optimized-server.js "$TEMP_DIR/server.js"
    cp run-latex.sh "$TEMP_DIR/"
    
    # Create package.json
    cat > "$TEMP_DIR/package.json" << 'EOF'
{
  "name": "latex-compilation-server",
  "version": "2.0.0",
  "description": "LaTeX to PDF compilation service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "pm2:start": "pm2 start server.js --name latex-compile",
    "pm2:restart": "pm2 restart latex-compile",
    "pm2:stop": "pm2 stop latex-compile",
    "pm2:logs": "pm2 logs latex-compile"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
    
    # Create systemd service file
    cat > "$TEMP_DIR/latex-compile.service" << EOF
[Unit]
Description=LaTeX Compilation Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SERVER_DIR
ExecStart=/usr/bin/node $SERVER_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/latex-compile.log
StandardError=append:/var/log/latex-compile-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

# Resource limits
LimitNOFILE=4096
MemoryLimit=1G

[Install]
WantedBy=multi-user.target
EOF
    
    # Upload files
    log_info "Uploading files to server..."
    ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $SERVER_DIR"
    scp -r "$TEMP_DIR"/* "$SERVER_USER@$SERVER_IP:$SERVER_DIR/"
    
    # Run deployment on server
    log_info "Installing dependencies and configuring service..."
    
    ssh "$SERVER_USER@$SERVER_IP" bash << ENDSSH
        set -e
        
        # Install Node.js if not present
        if ! command -v node >/dev/null 2>&1; then
            echo "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi
        
        # Install texlive if not present
        if ! command -v pdflatex >/dev/null 2>&1; then
            echo "Installing TeX Live (this may take a while)..."
            apt-get update
            apt-get install -y texlive-latex-base texlive-latex-extra texlive-fonts-recommended
        fi
        
        # Install dependencies
        cd $SERVER_DIR
        npm install --production
        
        # Make run-latex.sh executable
        chmod +x run-latex.sh
        
        # Configure systemd service
        cp latex-compile.service /etc/systemd/system/
        systemctl daemon-reload
        
        # Stop existing service if running
        systemctl stop latex-compile 2>/dev/null || true
        
        # Start service
        systemctl start latex-compile
        systemctl enable latex-compile
        
        # Configure firewall
        if command -v ufw >/dev/null 2>&1; then
            ufw allow $PORT/tcp || true
        fi
        
        echo "Deployment complete!"
        systemctl status latex-compile --no-pager
ENDSSH
    
    log_success "Deployment successful!"
    log_info "Service is running on http://$SERVER_IP:$PORT"
}

# Function to restart service
restart_service() {
    log_info "Restarting LaTeX compilation service..."
    
    ssh "$SERVER_USER@$SERVER_IP" "systemctl restart latex-compile"
    
    log_success "Service restarted"
    ssh "$SERVER_USER@$SERVER_IP" "systemctl status latex-compile --no-pager | head -15"
}

# Function to view logs
view_logs() {
    log_info "Viewing recent logs (Ctrl+C to exit)..."
    
    ssh "$SERVER_USER@$SERVER_IP" "journalctl -u latex-compile -f --no-pager"
}

# Function to test endpoint
test_endpoint() {
    log_info "Testing compilation endpoint..."
    
    # Create test LaTeX document
    TEST_TEX='\\documentclass{article}
\\begin{document}
\\section{Test Document}
This is a test of the LaTeX compilation service.
\\[
E = mc^2
\\]
\\end{document}'
    
    log_info "Sending test LaTeX document..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: text/plain" \
        --data "$TEST_TEX" \
        "http://$SERVER_IP:$PORT/compile" \
        -o /tmp/test-output.pdf)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        PDF_SIZE=$(wc -c < /tmp/test-output.pdf)
        log_success "Compilation successful! PDF size: $PDF_SIZE bytes"
        log_info "PDF saved to: /tmp/test-output.pdf"
    else
        log_error "Compilation failed with HTTP code: $HTTP_CODE"
        cat /tmp/test-output.pdf
    fi
}

# Function to monitor server health
monitor_health() {
    log_info "Monitoring server health (Ctrl+C to exit)..."
    
    while true; do
        clear
        echo "================================================"
        echo "  LaTeX Compilation Server - Health Monitor"
        echo "  Server: $SERVER_IP:$PORT"
        echo "  $(date)"
        echo "================================================"
        echo ""
        
        # Health endpoint
        HEALTH=$(curl -s "http://$SERVER_IP:$PORT/health" 2>&1 || echo '{"status":"error"}')
        echo "Health Check:"
        echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
        echo ""
        
        # Service status
        echo "Service Status:"
        ssh "$SERVER_USER@$SERVER_IP" "systemctl status latex-compile --no-pager | grep -E 'Active:|Memory:|CPU:'"
        echo ""
        
        # Recent errors
        echo "Recent Errors (last 5):"
        ssh "$SERVER_USER@$SERVER_IP" "journalctl -u latex-compile -n 5 --no-pager | grep -i error || echo 'No recent errors'"
        echo ""
        
        echo "Refreshing in 5 seconds..."
        sleep 5
    done
}

# Main script
case "${1:-help}" in
    analyze)
        check_ssh
        analyze_server
        ;;
    deploy)
        check_ssh
        deploy_server
        ;;
    restart)
        check_ssh
        restart_service
        ;;
    logs)
        check_ssh
        view_logs
        ;;
    test)
        test_endpoint
        ;;
    monitor)
        monitor_health
        ;;
    *)
        echo "LaTeX Compilation Server - Deployment Script"
        echo ""
        echo "Usage: $0 {analyze|deploy|restart|logs|test|monitor}"
        echo ""
        echo "Commands:"
        echo "  analyze  - Analyze current server setup and configuration"
        echo "  deploy   - Deploy or update the LaTeX compilation server"
        echo "  restart  - Restart the compilation service"
        echo "  logs     - View real-time logs (follow mode)"
        echo "  test     - Test the compilation endpoint with a sample document"
        echo "  monitor  - Monitor server health and status"
        echo ""
        echo "Example:"
        echo "  $0 analyze    # First, analyze the current setup"
        echo "  $0 deploy     # Then, deploy the service"
        echo "  $0 test       # Finally, test that it works"
        exit 1
        ;;
esac 