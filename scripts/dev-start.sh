#!/bin/bash
# ===========================================
# DEV Environment Start Script
# ===========================================
# Usage: ./scripts/dev-start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEV_DIR="${PROJECT_ROOT}/environments/dev"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Starting DEV Environment           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

cd "${DEV_DIR}"

# Check if .env exists
if [[ ! -f .env ]]; then
    echo -e "${YELLOW}[!] .env file not found. Creating from template...${NC}"
    cp .env.dev .env
    echo -e "${YELLOW}[!] Please edit ${DEV_DIR}/.env with your values${NC}"
fi

# Start containers
echo -e "${GREEN}[*] Starting containers with podman-compose...${NC}"
podman-compose up -d

# Wait for services to be healthy
echo -e "${GREEN}[*] Waiting for services to start...${NC}"
sleep 10

# Display access information
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     DEV Environment Ready!             ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}║  Frontend:      http://localhost:8080  ║${NC}"
echo -e "${GREEN}║  Supabase API:  http://localhost:54321 ║${NC}"
echo -e "${GREEN}║  Studio:        http://localhost:54323 ║${NC}"
echo -e "${GREEN}║  Email Testing: http://localhost:54324 ║${NC}"
echo -e "${GREEN}║  Database:      localhost:54322        ║${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Commands:${NC}"
echo -e "  Stop:    cd ${DEV_DIR} && podman-compose down"
echo -e "  Logs:    cd ${DEV_DIR} && podman-compose logs -f"
echo -e "  Restart: cd ${DEV_DIR} && podman-compose restart"
