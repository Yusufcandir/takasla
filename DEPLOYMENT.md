# Production Deployment Guide

Deploy the Takasla Exchange Platform to a VPS with DuckDNS subdomain and automatic HTTPS.

**Current setup:**
- DigitalOcean droplet: `134.209.198.150` (4 vCPU, 8 GB RAM, Ubuntu 22.04)
- Domains: `takasla.duckdns.org` (user app) + `takasla-admin.duckdns.org` (admin panel)
- HTTPS with auto-renewing Let's Encrypt certificates via Caddy

---

## Prerequisites

- A VPS (DigitalOcean, Oracle Cloud, Hetzner, etc.) with Ubuntu 22.04
- A GitHub account (for hosting your code)
- A Google/GitHub account (for DuckDNS login)

---

## Step 1: Set Up DuckDNS (5 minutes)

1. Go to [duckdns.org](https://www.duckdns.org/) and log in with GitHub or Google
2. Create **2 subdomains** — pick a name and create:
   - `YOURNAME` (e.g., `takasla` → `takasla.duckdns.org`)
   - `YOURNAME-admin` (e.g., `takasla-admin` → `takasla-admin.duckdns.org`)
3. Leave the IP blank for now (we'll set it after creating the server)
4. **Copy your DuckDNS token** from the top of the page (you'll need it later)

---

## Step 2: Create a VPS

### Option A: DigitalOcean (recommended)

1. Go to [digitalocean.com](https://www.digitalocean.com/) → Create Droplet
2. **Image:** Ubuntu 22.04
3. **Plan:** 4 vCPU / 8 GB RAM (minimum for running all 29 containers)
4. **Region:** Amsterdam (or closest to your users)
5. **Authentication:** SSH key (recommended) or password
6. Click **Create Droplet** and copy the public IP

### Option B: Oracle Cloud Free Tier

1. Go to [cloud.oracle.com](https://cloud.oracle.com/) → Sign Up
2. Create a VM.Standard.A1.Flex (4 ARM CPUs, 24 GB RAM, 200 GB disk) — **free forever**
3. Open ports 80 and 443 in the Security List

### After creating the server

1. Update DuckDNS: enter the public IP for both subdomains, click **update ip**
2. SSH into the server: `ssh root@YOUR_SERVER_IP` (or `ubuntu@` for Oracle Cloud)

---

## Step 3: Set Up the Server (15 minutes)

### 3a. Upload and run the setup script

From your **local machine**:
```bash
scp scripts/setup-server.sh root@YOUR_SERVER_IP:/tmp/
```

On the **server**:
```bash
sudo bash /tmp/setup-server.sh \
  --duckdns-token YOUR_DUCKDNS_TOKEN \
  --domain YOURNAME
```

This installs Docker, creates swap, sets up firewall, and configures DuckDNS auto-update.

### 3b. Log out and back in (for Docker group permissions)

```bash
exit
ssh root@YOUR_SERVER_IP
```

---

## Step 4: Clone and Configure (10 minutes)

### 4a. Clone the repo

```bash
cd /opt/exchange
git clone https://github.com/YOURUSER/trading.git .
```

### 4b. Create production environment

```bash
cp .env.production.example .env
nano .env
```

Fill in these critical values:

| Variable | What to put |
|----------|------------|
| `NEXT_PUBLIC_API_URL` | `https://YOURNAME.duckdns.org/api` |
| `FRONTEND_URL` | `https://YOURNAME.duckdns.org` |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `BREVO_API_KEY` | Your Brevo (Sendinblue) API key for emails |
| `SMTP_USER` | Your Gmail address (fallback email) |
| `SMTP_PASS` | Your Gmail App Password (16 chars, fallback) |
| `AUTH_DB_PASSWORD` through `MESSAGING_DB_PASSWORD` | Run for each: `openssl rand -hex 16` |
| `RABBITMQ_PASSWORD` | Run: `openssl rand -hex 24` |

Optional (will use simulation/fallback mode if blank):
- `R2_*` — Cloudflare R2 for file storage (falls back to local disk)
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — AI image detection
- `SEPOLIA_RPC_URL` / `SEPOLIA_PRIVATE_KEY` — Blockchain anchoring
- `GELIVER_TOKEN` — Turkish domestic shipping
- `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` — Turkish payment provider

Save and exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 5: Deploy! (15-20 minutes first time)

```bash
bash scripts/deploy.sh --domain YOURNAME
```

This will:
1. Pull latest code from GitHub
2. Generate the Caddyfile from the production template
3. Build all Docker containers (takes ~15 min on first build)
4. Start everything with production overrides (memory limits, `synchronize: false`)
5. Wait for health checks
6. Show you the status

---

## Step 6: Verify

1. Open `https://YOURNAME.duckdns.org` in your browser
   - You should see Takasla with a valid HTTPS certificate
2. Open `https://YOURNAME-admin.duckdns.org`
   - You should see the admin panel
3. Register a new account, check that the verification email arrives
4. Create a listing to verify file uploads work

---

## Updating the App

After making code changes locally:

```bash
# On your Windows machine:
git add -A && git commit -m "your changes" && git push

# On the server:
ssh root@YOUR_SERVER_IP "cd /opt/exchange && bash scripts/deploy.sh --domain YOURNAME"
```

Only changed services will be rebuilt (Docker layer caching).

---

## Important: Production Database Changes

Production uses `TYPEORM_SYNCHRONIZE=false` (set in `docker-compose.prod.yml`). This means **new entity columns are NOT auto-created**. When you add a new column to an entity, you must manually add it to the database:

```bash
# Example: adding a column to the users table in auth_db
docker exec trading-postgres-auth-1 psql -U exchange -d auth_db \
  -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS new_column VARCHAR(100);"

# For each service's DB, the container name follows the pattern:
# trading-postgres-{service}-1
# The DB name follows: {service}_db
```

**Services and their DBs:**
| Container | DB |
|-----------|-----|
| `trading-postgres-auth-1` | `auth_db` |
| `trading-postgres-user-1` | `user_db` |
| `trading-postgres-listing-1` | `listing_db` |
| `trading-postgres-offer-1` | `offer_db` |
| `trading-postgres-trade-1` | `trade_db` |
| `trading-postgres-reputation-1` | `reputation_db` |
| `trading-postgres-dispute-1` | `dispute_db` |
| `trading-postgres-certificate-1` | `certificate_db` |
| `trading-postgres-shipping-1` | `shipping_db` |
| `trading-postgres-payment-1` | `payment_db` |
| `trading-postgres-messaging-1` | `messaging_db` |

---

## Useful Commands (on the server)

```bash
# View all service statuses
docker compose ps

# Follow logs for all services
docker compose logs -f

# Follow logs for a specific service
docker compose logs -f auth-service

# Restart a single service
docker compose restart auth-service

# Restart everything
docker compose restart

# Full rebuild (after major changes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run database backup manually
docker compose exec db-backup sh /backup.sh

# Check disk/memory usage
df -h
free -h
docker system df

# Clean up old Docker images
docker image prune -f
```

---

## Troubleshooting

### "Certificate provisioning" errors
Caddy needs ports 80 and 443 open for Let's Encrypt HTTP-01 challenge. Double-check:
- Firewall allows 80 and 443 (`sudo ufw status` or `sudo iptables -L INPUT -n`)
- DuckDNS points to the correct IP (`ping YOURNAME.duckdns.org`)

### Services keep restarting
Check logs: `docker compose logs --tail=50 SERVICE_NAME`
Common causes:
- Database not ready yet (services retry automatically)
- Missing environment variables in .env
- Wrong database password

### "Column does not exist" error
This happens when you add a new entity column but production has `synchronize: false`. Fix:
```bash
docker exec trading-postgres-{service}-1 psql -U exchange -d {service}_db \
  -c "ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;"
docker compose restart {service-name}
```

### Admin panel returns 404 on login
Make sure the `Caddyfile.prod` has `/api/*` routing for the admin domain:
```
__ADMIN_DOMAIN__ {
    handle /api/* {
        reverse_proxy api-gateway:3000
    }
    handle {
        reverse_proxy admin-frontend:4001
    }
}
```

### Out of memory
Check memory: `free -h`
```bash
docker compose logs --tail=20  # Find which service crashed
docker stats --no-stream        # See memory usage per container
```

### DuckDNS IP not updating
```bash
cat /opt/duckdns/duck.log  # Should say "OK"
curl -s ifconfig.me         # Your server's public IP
```

---

## Architecture Overview

```
Internet
  │
  ├── https://takasla.duckdns.org
  │     │
  │     └── Caddy (auto-TLS)
  │           ├── /api/geo/* → frontend:4000 (Next.js API routes)
  │           ├── /api/*     → api-gateway:3000
  │           └── /*         → frontend:4000
  │
  └── https://takasla-admin.duckdns.org
        │
        └── Caddy (auto-TLS)
              ├── /api/*     → api-gateway:3000
              └── /*         → admin-frontend:4001

Internal (Docker network):
  api-gateway:3000 ──→ auth-service:3001
                   ──→ user-service:3002
                   ──→ listing-service:3003
                   ──→ ... (12 services total)

  Each service ──→ its own PostgreSQL database
  All services ──→ RabbitMQ (events)
  Most services ──→ Redis (distributed locks, caching)
```

---

## Container Inventory (29 total)

| Category | Containers | Count |
|----------|-----------|-------|
| Services | api-gateway, auth, user, listing, offer, trade, reputation, dispute, certificate, shipping, payment, messaging | 12 |
| Frontends | frontend, admin-frontend | 2 |
| Databases | postgres-auth, postgres-user, ..., postgres-messaging | 11 |
| Infrastructure | redis, rabbitmq, caddy, db-backup | 4 |
| **Total** | | **29** |
