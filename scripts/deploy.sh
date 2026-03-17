#!/bin/bash
# =============================================================================
# Exchange Platform — Deploy Script
# Usage: bash scripts/deploy.sh --domain YOURNAME
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ---------- Parse arguments ----------
DOMAIN=""
SKIP_PULL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)    DOMAIN="$2"; shift 2 ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    *) err "Unknown argument: $1" ;;
  esac
done

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash scripts/deploy.sh --domain YOURNAME"
  echo ""
  echo "  --domain     Your DuckDNS subdomain (without .duckdns.org)"
  echo "  --skip-pull  Skip git pull (use local code as-is)"
  echo ""
  echo "Example: bash scripts/deploy.sh --domain secureexchange"
  exit 1
fi

MAIN_DOMAIN="${DOMAIN}.duckdns.org"
ADMIN_DOMAIN="${DOMAIN}-admin.duckdns.org"

echo "============================================"
echo "  Exchange Platform — Deploy"
echo "============================================"
echo "  Main:  https://${MAIN_DOMAIN}"
echo "  Admin: https://${ADMIN_DOMAIN}"
echo "============================================"
echo ""

# ---------- 1. Pull latest code ----------
if [ "$SKIP_PULL" = false ] && [ -d ".git" ]; then
  log "Pulling latest code..."
  git pull --ff-only || warn "Git pull failed — using current code"
fi

# ---------- 2. Check .env exists ----------
if [ ! -f ".env" ]; then
  err ".env file not found! Copy .env.production.example to .env and fill in your secrets."
fi
log ".env file found"

# ---------- 3. Generate Caddyfile from template ----------
log "Generating Caddyfile from Caddyfile.prod template..."
if [ ! -f "Caddyfile.prod" ]; then
  err "Caddyfile.prod not found!"
fi

sed -e "s/__DOMAIN__/${MAIN_DOMAIN}/g" \
    -e "s/__ADMIN_DOMAIN__/${ADMIN_DOMAIN}/g" \
    Caddyfile.prod > Caddyfile

log "Caddyfile generated for ${MAIN_DOMAIN}"

# ---------- 4. Build and start ----------
log "Building and starting all services (this takes 10-20 min on first run)..."
echo ""

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build 2>&1

echo ""
log "Build complete"

# ---------- 5. Wait for health checks ----------
log "Waiting for services to become healthy..."
sleep 10

HEALTHY=0
UNHEALTHY=0
for i in $(seq 1 30); do
  HEALTHY=$(docker compose ps --format json 2>/dev/null | grep -c '"healthy"' || echo "0")
  TOTAL=$(docker compose ps --format json 2>/dev/null | wc -l || echo "0")

  if [ "$HEALTHY" -ge 10 ]; then
    break
  fi

  echo "  Waiting... ($HEALTHY healthy, attempt $i/30)"
  sleep 10
done

# ---------- 6. Status ----------
echo ""
echo "============================================"
echo "  Service Status"
echo "============================================"
docker compose ps
echo ""

# Quick health check via curl
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  log "API Gateway responding (HTTP ${HTTP_CODE})"
else
  warn "API Gateway returned HTTP ${HTTP_CODE} — may still be starting"
fi

echo ""
echo "============================================"
echo -e "  ${GREEN}Deployment complete!${NC}"
echo "============================================"
echo ""
echo "Your app is live at:"
echo "  Main:  https://${MAIN_DOMAIN}"
echo "  Admin: https://${ADMIN_DOMAIN}"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f              # Follow all logs"
echo "  docker compose logs -f auth-service # Follow specific service"
echo "  docker compose ps                   # Check service status"
echo "  docker compose restart              # Restart all services"
echo "  bash scripts/deploy.sh --domain ${DOMAIN}  # Redeploy after changes"
echo ""
