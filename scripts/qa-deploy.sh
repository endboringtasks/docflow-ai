#!/bin/bash
# ===========================================
# QA Environment Deployment Script
# ===========================================
# Usage: ./scripts/qa-deploy.sh [--build] [--migrate]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
QA_DIR="${PROJECT_ROOT}/environments/qa"

# Parse arguments
BUILD=false
MIGRATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD=true
            shift
            ;;
        --migrate)
            MIGRATE=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Deploying QA Environment           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

cd "${QA_DIR}"

# Check if .env exists
if [[ ! -f .env ]]; then
    echo -e "${RED}[ERROR] .env file not found!${NC}"
    echo -e "${YELLOW}Please copy .env.qa to .env and configure it${NC}"
    exit 1
fi

# Pull latest code
echo -e "${GREEN}[*] Pulling latest code...${NC}"
git pull origin main || true

# Build if requested
if [[ "${BUILD}" == true ]]; then
    echo -e "${GREEN}[*] Building containers...${NC}"
    podman-compose build --no-cache frontend
fi

# Apply migrations if requested
if [[ "${MIGRATE}" == true ]]; then
    echo -e "${GREEN}[*] Applying database migrations...${NC}"
    "${SCRIPT_DIR}/migrate.sh" qa
fi

# Deploy
echo -e "${GREEN}[*] Starting/updating containers...${NC}"
podman-compose up -d

# Health check
echo -e "${GREEN}[*] Waiting for services...${NC}"
sleep 15

# Check nginx
if podman exec qa-nginx nginx -t &>/dev/null; then
    echo -e "${GREEN}[✓] Nginx configuration valid${NC}"
else
    echo -e "${RED}[✗] Nginx configuration error${NC}"
    podman logs qa-nginx --tail 20
fi

# Display status
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     QA Deployment Complete!            ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}║  Check your QA URL to verify           ║${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Commands:${NC}"
echo -e "  Logs:    podman-compose logs -f"
echo -e "  Status:  podman-compose ps"
echo -e "  Restart: podman-compose restart"
