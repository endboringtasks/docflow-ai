#!/bin/bash
# ===========================================
# Production Deployment Script
# ===========================================
# Usage: ./scripts/prod-deploy.sh [--build] [--migrate] [--backup]
#
# ⚠️  WARNING: This script deploys to PRODUCTION
# Always backup before deploying!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROD_DIR="${PROJECT_ROOT}/environments/prod"

# Parse arguments
BUILD=false
MIGRATE=false
BACKUP=false

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
        --backup)
            BACKUP=true
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

echo -e "${RED}╔════════════════════════════════════════╗${NC}"
echo -e "${RED}║     PRODUCTION DEPLOYMENT              ║${NC}"
echo -e "${RED}╚════════════════════════════════════════╝${NC}"
echo ""

cd "${PROD_DIR}"

# Check if .env exists
if [[ ! -f .env ]]; then
    echo -e "${RED}[ERROR] .env file not found!${NC}"
    echo -e "${YELLOW}Please copy .env.prod to .env and configure it${NC}"
    exit 1
fi

# Confirmation prompt
echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION${NC}"
echo -e "${YELLOW}   This will affect live users!${NC}"
echo ""
read -p "Type 'DEPLOY' to confirm: " confirm

if [[ "${confirm}" != "DEPLOY" ]]; then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 1
fi

# Backup before deployment
if [[ "${BACKUP}" == true ]]; then
    echo -e "${GREEN}[*] Creating pre-deployment backup...${NC}"
    "${PROD_DIR}/backup.sh" full
fi

# Pull latest code
echo -e "${GREEN}[*] Pulling latest code...${NC}"
git pull origin main

# Build if requested
if [[ "${BUILD}" == true ]]; then
    echo -e "${GREEN}[*] Building containers...${NC}"
    podman-compose build --no-cache frontend supabase-edge-functions
fi

# Apply migrations if requested
if [[ "${MIGRATE}" == true ]]; then
    echo -e "${GREEN}[*] Applying database migrations...${NC}"
    "${SCRIPT_DIR}/migrate.sh" prod
fi

# Rolling deployment - update frontend first
echo -e "${GREEN}[*] Deploying frontend (rolling update)...${NC}"
podman-compose up -d --no-deps frontend

# Wait and verify
sleep 10

# Health check
echo -e "${GREEN}[*] Running health checks...${NC}"

# Check nginx
if curl -sf http://localhost/health > /dev/null; then
    echo -e "${GREEN}[✓] Frontend health check passed${NC}"
else
    echo -e "${RED}[✗] Frontend health check failed${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    podman-compose up -d --no-deps frontend
    exit 1
fi

# Update remaining services
echo -e "${GREEN}[*] Updating remaining services...${NC}"
podman-compose up -d

# Final health check
sleep 10

if curl -sf http://localhost/health > /dev/null; then
    echo -e "${GREEN}[✓] All health checks passed${NC}"
else
    echo -e "${RED}[✗] Health check failed after deployment${NC}"
    echo -e "${YELLOW}Please investigate immediately!${NC}"
    exit 1
fi

# Display status
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Production Deployment Complete!    ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}║  ✓ All services running                ║${NC}"
echo -e "${GREEN}║  ✓ Health checks passed                ║${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Monitor with:${NC}"
echo -e "  Logs:    podman-compose logs -f"
echo -e "  Status:  podman-compose ps"
echo -e "  Metrics: Check your monitoring dashboard"
