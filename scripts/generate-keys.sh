#!/bin/bash
# ===========================================
# Generate Supabase JWT Keys
# ===========================================
# Usage: ./scripts/generate-keys.sh [jwt-secret]
#
# This script generates ANON_KEY and SERVICE_ROLE_KEY
# based on your JWT_SECRET

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Supabase Key Generator             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get JWT secret
if [[ -n "$1" ]]; then
    JWT_SECRET="$1"
else
    echo -e "${YELLOW}Enter your JWT secret (min 32 characters):${NC}"
    read -s JWT_SECRET
    echo ""
fi

# Validate JWT secret length
if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo -e "${RED}[ERROR] JWT secret must be at least 32 characters${NC}"
    exit 1
fi

echo -e "${GREEN}[*] Generating keys...${NC}"
echo ""

# Check if Node.js is available
if command -v node &> /dev/null; then
    # Use Node.js to generate JWTs
    ANON_KEY=$(node -e "
const crypto = require('crypto');

function base64url(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(headerB64 + '.' + payloadB64)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return headerB64 + '.' + payloadB64 + '.' + signature;
}

const payload = {
    role: 'anon',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
};

console.log(sign(payload, '${JWT_SECRET}'));
")

    SERVICE_ROLE_KEY=$(node -e "
const crypto = require('crypto');

function base64url(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(headerB64 + '.' + payloadB64)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return headerB64 + '.' + payloadB64 + '.' + signature;
}

const payload = {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
};

console.log(sign(payload, '${JWT_SECRET}'));
")

else
    echo -e "${RED}[ERROR] Node.js is required to generate keys${NC}"
    echo -e "${YELLOW}Please install Node.js or use an online JWT generator${NC}"
    exit 1
fi

# Generate other secrets
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
WEBHOOK_SECRET=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}Generated Keys (copy these to your .env):${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}# JWT Secret (the one you provided)${NC}"
echo "JWT_SECRET=${JWT_SECRET}"
echo ""
echo -e "${BLUE}# Supabase API Keys${NC}"
echo "ANON_KEY=${ANON_KEY}"
echo ""
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
echo -e "${BLUE}# Additional Secrets (randomly generated)${NC}"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo ""
echo "TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}"
echo ""
echo "WEBHOOK_SECRET=${WEBHOOK_SECRET}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⚠️  Save these keys securely!${NC}"
echo -e "${YELLOW}⚠️  Never commit them to version control!${NC}"
