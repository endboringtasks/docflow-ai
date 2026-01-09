#!/bin/bash
# ===========================================
# Database Migration Script
# ===========================================
# Usage: ./scripts/migrate.sh [dev|qa|prod]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="${PROJECT_ROOT}/supabase/migrations"

ENV="${1:-dev}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Set container name based on environment
case "${ENV}" in
    dev)
        CONTAINER_NAME="dev-supabase-db"
        ;;
    qa)
        CONTAINER_NAME="qa-supabase-db"
        ;;
    prod)
        CONTAINER_NAME="prod-supabase-db"
        ;;
    *)
        echo -e "${RED}[ERROR] Unknown environment: ${ENV}${NC}"
        echo -e "Usage: $0 [dev|qa|prod]"
        exit 1
        ;;
esac

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Database Migration                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Environment: ${ENV}${NC}"
echo -e "${GREEN}Container:   ${CONTAINER_NAME}${NC}"
echo ""

# Check if container is running
if ! podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}[ERROR] Container ${CONTAINER_NAME} is not running${NC}"
    echo -e "${YELLOW}Start the environment first with:${NC}"
    echo -e "  cd environments/${ENV} && podman-compose up -d"
    exit 1
fi

# Check if migrations directory exists
if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
    echo -e "${RED}[ERROR] Migrations directory not found: ${MIGRATIONS_DIR}${NC}"
    exit 1
fi

# Count migrations
MIGRATION_COUNT=$(ls -1 "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | wc -l)
echo -e "${GREEN}Found ${MIGRATION_COUNT} migration files${NC}"

if [[ "${MIGRATION_COUNT}" -eq 0 ]]; then
    echo -e "${YELLOW}No migration files to apply${NC}"
    exit 0
fi

# Production confirmation
if [[ "${ENV}" == "prod" ]]; then
    echo ""
    echo -e "${RED}⚠️  WARNING: You are about to apply migrations to PRODUCTION${NC}"
    read -p "Type 'MIGRATE' to confirm: " confirm
    
    if [[ "${confirm}" != "MIGRATE" ]]; then
        echo -e "${RED}Migration cancelled${NC}"
        exit 1
    fi
fi

# Apply migrations
echo ""
echo -e "${GREEN}[*] Applying migrations...${NC}"

for migration in "${MIGRATIONS_DIR}"/*.sql; do
    filename=$(basename "${migration}")
    echo -e "${BLUE}  → ${filename}${NC}"
    
    if podman exec -i "${CONTAINER_NAME}" psql -U postgres -d postgres < "${migration}" 2>&1; then
        echo -e "${GREEN}    ✓ Applied${NC}"
    else
        echo -e "${RED}    ✗ Failed${NC}"
        echo -e "${RED}[ERROR] Migration failed: ${filename}${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Migrations Complete!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
