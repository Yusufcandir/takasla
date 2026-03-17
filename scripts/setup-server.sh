#!/bin/bash
# =============================================================================
# Oracle Cloud ARM VM Setup Script
# Run once after first SSH into the server:
#   sudo bash setup-server.sh --duckdns-token YOUR_TOKEN --domain YOURNAME
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
DUCKDNS_TOKEN=""
DUCKDNS_DOMAIN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --duckdns-token) DUCKDNS_TOKEN="$2"; shift 2 ;;
    --domain)        DUCKDNS_DOMAIN="$2"; shift 2 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

if [ -z "$DUCKDNS_TOKEN" ] || [ -z "$DUCKDNS_DOMAIN" ]; then
  echo "Usage: sudo bash setup-server.sh --duckdns-token YOUR_TOKEN --domain YOURNAME"
  echo ""
  echo "  --duckdns-token   Your DuckDNS token (from duckdns.org)"
  echo "  --domain          Your DuckDNS subdomain name (without .duckdns.org)"
  echo ""
  echo "Example: sudo bash setup-server.sh --duckdns-token abc123 --domain secureexchange"
  exit 1
fi

# ---------- Must be root ----------
if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo bash setup-server.sh ..."
fi

echo "============================================"
echo "  Exchange Platform — Server Setup"
echo "============================================"
echo ""

# ---------- 1. System update ----------
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ---------- 2. Install Docker ----------
if command -v docker &> /dev/null; then
  log "Docker already installed: $(docker --version)"
else
  log "Installing Docker..."
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  log "Docker installed: $(docker --version)"
fi

# Allow ubuntu user to run docker without sudo
usermod -aG docker ubuntu 2>/dev/null || true

# ---------- 3. Create swap (4GB) ----------
if swapon --show | grep -q '/swapfile'; then
  log "Swap already configured"
else
  log "Creating 4GB swap file..."
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Optimize swap behavior
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  log "Swap enabled (4GB)"
fi

# ---------- 4. Install fail2ban ----------
if command -v fail2ban-client &> /dev/null; then
  log "fail2ban already installed"
else
  log "Installing fail2ban..."
  apt-get install -y -qq fail2ban
  cat > /etc/fail2ban/jail.local <<'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
JAIL
  systemctl enable fail2ban
  systemctl restart fail2ban
  log "fail2ban configured (5 retries, 1h ban)"
fi

# ---------- 5. Configure iptables firewall ----------
log "Configuring iptables firewall..."
apt-get install -y -qq iptables-persistent

# Flush existing rules
iptables -F INPUT
iptables -F OUTPUT
iptables -F FORWARD

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (22), HTTP (80), HTTPS (443)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow ICMP (ping)
iptables -A INPUT -p icmp -j ACCEPT

# Save rules
netfilter-persistent save
log "Firewall configured (ports 22, 80, 443 open)"

# ---------- 6. Set up DuckDNS cron ----------
log "Setting up DuckDNS IP update cron..."
DUCKDNS_DIR="/opt/duckdns"
mkdir -p "$DUCKDNS_DIR"

cat > "$DUCKDNS_DIR/update.sh" <<EOF
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN},${DUCKDNS_DOMAIN}-admin&token=${DUCKDNS_TOKEN}&ip=" | curl -k -o ${DUCKDNS_DIR}/duck.log -K -
EOF
chmod 700 "$DUCKDNS_DIR/update.sh"

# Run every 5 minutes
(crontab -l 2>/dev/null | grep -v duckdns; echo "*/5 * * * * ${DUCKDNS_DIR}/update.sh >/dev/null 2>&1") | crontab -

# Run once now
bash "$DUCKDNS_DIR/update.sh"
log "DuckDNS configured: ${DUCKDNS_DOMAIN}.duckdns.org + ${DUCKDNS_DOMAIN}-admin.duckdns.org"

# ---------- 7. Create app directory ----------
APP_DIR="/opt/exchange"
mkdir -p "$APP_DIR"
chown ubuntu:ubuntu "$APP_DIR"
log "App directory created: $APP_DIR"

# ---------- 8. Install git ----------
if ! command -v git &> /dev/null; then
  apt-get install -y -qq git
fi
log "Git available: $(git --version)"

# ---------- Done ----------
echo ""
echo "============================================"
echo -e "  ${GREEN}Server setup complete!${NC}"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Log out and back in (for docker group):"
echo "     exit && ssh -i key.pem ubuntu@$(curl -s ifconfig.me)"
echo ""
echo "  2. Clone your repo:"
echo "     cd /opt/exchange"
echo "     git clone https://github.com/YOURUSER/trading.git ."
echo ""
echo "  3. Configure production env:"
echo "     cp .env.production.example .env"
echo "     nano .env   # fill in your secrets"
echo ""
echo "  4. Deploy:"
echo "     bash scripts/deploy.sh --domain ${DUCKDNS_DOMAIN}"
echo ""
echo "Your domains:"
echo "  Main:  https://${DUCKDNS_DOMAIN}.duckdns.org"
echo "  Admin: https://${DUCKDNS_DOMAIN}-admin.duckdns.org"
echo ""
