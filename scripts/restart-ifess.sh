#!/bin/bash
# ============================================
# IFESS Control Server - Restart Script (Unix/Linux/macOS)
# ============================================
# This script restarts the Main Dashboard server
# which serves as the IFESS Control Server
# ============================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${GREEN}============================================${NC}"
echo "   IFESS Control Server - Restart Script"
echo -e "${GREEN}============================================${NC}"
echo ""

# Check if Bun or Node is available
if command -v bun &> /dev/null; then
    RUNTIME="bun"
    echo -e "Runtime detected: ${GREEN}Bun${NC}"
elif command -v node &> /dev/null; then
    RUNTIME="node"
    echo -e "Runtime detected: ${GREEN}Node.js${NC}"
else
    echo -e "${RED}ERROR: Neither Bun nor Node.js is installed!${NC}"
    echo "Please install Bun or Node.js first."
    exit 1
fi

# Kill existing process on port 3001
echo ""
echo -e "${YELLOW}Killing existing processes on port 3001...${NC}"
if command -v lsof &> /dev/null; then
    # macOS/Linux with lsof
    PIDS=$(lsof -ti:3001 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping processes: $PIDS"
        kill -9 $PIDS 2>/dev/null
    fi
    # Also kill port 3100
    PIDS=$(lsof -ti:3100 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping Next.js processes: $PIDS"
        kill -9 $PIDS 2>/dev/null
    fi
elif command -v fuser &> /dev/null; then
    # Linux with fuser
    fuser -k 3001/tcp 2>/dev/null
    fuser -k 3100/tcp 2>/dev/null
fi

# Wait a moment for processes to terminate
sleep 2

echo ""
echo -e "${GREEN}============================================${NC}"
echo "   Starting IFESS Control Server..."
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Server will run on: ${YELLOW}http://localhost:3001${NC}"
echo -e "IFESS Control Panel: ${YELLOW}http://localhost:3001/ifess-control${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
cd "$(dirname "$0")/.." 2>/dev/null || cd ..

if [ "$RUNTIME" == "bun" ]; then
    bun run server_bun.js
else
    node server.js
fi
