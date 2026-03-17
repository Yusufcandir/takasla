# Production Deployment Guide

Deploy the Exchange Platform to Oracle Cloud Free Tier with DuckDNS subdomain and automatic HTTPS.

**What you get:**
- 4 ARM CPUs + 24GB RAM + 200GB disk — **free forever**
- HTTPS with auto-renewing Let's Encrypt certificates
- Two subdomains: `YOURNAME.duckdns.org` (user app) + `YOURNAME-admin.duckdns.org` (admin panel)

---

## Prerequisites

- A GitHub account (for hosting your code)
- A Google/GitHub account (for DuckDNS login)
- A credit card (Oracle requires it for signup, but **will never charge** for Always Free resources)

---

## Step 1: Set Up DuckDNS (5 minutes)

1. Go to [duckdns.org](https://www.duckdns.org/) and log in with GitHub or Google
2. Create **2 subdomains** — pick a name and create:
   - `YOURNAME` (e.g., `secureexchange` → `secureexchange.duckdns.org`)
   - `YOURNAME-admin` (e.g., `secureexchange-admin` → `secureexchange-admin.duckdns.org`)
3. Leave the IP blank for now (we'll set it after creating the server)
4. **Copy your DuckDNS token** from the top of the page (you'll need it later)

---

## Step 2: Create Oracle Cloud Account (10 minutes)

1. Go to [cloud.oracle.com](https://cloud.oracle.com/) → **Sign Up**
2. Fill in your details, add a credit card (for identity verification only)
3. Choose your **Home Region** — pick the closest one to your users:
   - Turkey: `Germany Central (Frankfurt)` or `Saudi Arabia West (Jeddah)`
   - Europe: `Germany Central (Frankfurt)` or `Netherlands Northwest (Amsterdam)`
4. Wait for account activation (usually instant, sometimes up to 30 min)

---

## Step 3: Create the ARM VM (10 minutes)

1. Go to **Compute → Instances → Create Instance**

2. **Name:** `exchange-server`

3. **Image:** Click **Edit** → Ubuntu → **Canonical Ubuntu 22.04** (aarch64)

4. **Shape:** Click **Change Shape**:
   - Shape series: **Ampere** (ARM-based)
   - Shape: **VM.Standard.A1.Flex**
   - OCPUs: **4** (max free)
   - Memory: **24 GB** (max free)
   

5. **Boot volume:** Scroll down → Check "Specify a custom boot volume size" → **200 GB**

6. **SSH Key:** Choose **Generate a key pair** → **Save Private Key** (download the `.key` file)
   - Keep this file safe! You need it to SSH into your server.

7. Click **Create** — wait for the instance to show `RUNNING` (1-2 minutes)

8. **Copy the Public IP** from the instance details page

9. **Update DuckDNS:** Go back to duckdns.org, enter the public IP for both subdomains, click **update ip**

---

## Step 4: Open Firewall Ports (5 minutes)

Oracle Cloud blocks ports 80/443 by default. You must open them:

1. From the instance page → Click the **Virtual Cloud Network** link (under Primary VNIC)
2. Click **Security Lists** → **Default Security List**
3. Click **Add Ingress Rules** and add these two rules:

| Source CIDR    | Protocol | Destination Port | Description |
|---------------|----------|-----------------|-------------|
| `0.0.0.0/0`  | TCP      | `80`            | HTTP        |
| `0.0.0.0/0`  | TCP      | `443`           | HTTPS       |

4. Click **Add Ingress Rules**

---

## Step 5: Push Code to GitHub (5 minutes)

On your **Windows machine** (where the code is):

```bash
# Create a private repo on github.com first, then:
cd /c/Users/yusuf/Masaüstü/trading

# Initialize git (if not already done)
git init -b main
git add -A
git commit -m "Initial commit — Exchange Platform"

# Add your GitHub repo as remote
git remote add origin https://github.com/YOURUSER/trading.git
git push -u origin main
```

> **Important:** `.env` is in `.gitignore` so your secrets won't be pushed.

---

## Step 6: Set Up the Server (15 minutes)

### 6a. SSH into the server

```bash
# On Windows (Git Bash / WSL / PowerShell):
# First, fix key permissions (required on Linux/Mac):
chmod 400 /path/to/your-key.key

ssh -i /path/to/your-key.key ubuntu@YOUR_SERVER_IP
```

### 6b. Upload and run the setup script

Open a **second terminal** on your Windows machine:
```bash
scp -i /path/to/your-key.key scripts/setup-server.sh ubuntu@YOUR_SERVER_IP:/tmp/
```

Back in the **SSH terminal**:
```bash
sudo bash /tmp/setup-server.sh \
  --duckdns-token YOUR_DUCKDNS_TOKEN \
  --domain YOURNAME
```

This installs Docker, creates swap, sets up firewall, and configures DuckDNS auto-update.

### 6c. Log out and back in (for Docker group permissions)

```bash
exit
ssh -i /path/to/your-key.key ubuntu@YOUR_SERVER_IP
```

---

## Step 7: Clone and Configure (10 minutes)

### 7a. Clone the repo

```bash
cd /opt/exchange
git clone https://github.com/YOURUSER/trading.git .
```

### 7b. Create production environment

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
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail App Password (16 chars) |
| `AUTH_DB_PASSWORD` through `PAYMENT_DB_PASSWORD` | Run for each: `openssl rand -base64 24` |
| `RABBITMQ_PASSWORD` | Run: `openssl rand -base64 24` |

The rest can be left blank (shipping, blockchain, R2, Stripe will use simulation/fallback mode).

Save and exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 8: Deploy! (15-20 minutes first time)

```bash
bash scripts/deploy.sh --domain YOURNAME
```

This will:
1. Generate the Caddyfile from the production template
2. Build all 16 Docker containers (takes ~15 min on first build, ARM is slower)
3. Start everything
4. Wait for health checks
5. Show you the status

---

## Step 9: Verify

1. Open `https://YOURNAME.duckdns.org` in your browser
   - You should see the Exchange Platform with a valid HTTPS certificate
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
cd /opt/exchange
bash scripts/deploy.sh --domain YOURNAME
```

Only changed services will be rebuilt (Docker layer caching).

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

# Check disk usage
df -h
docker system df

# Clean up old Docker images
docker image prune -f
```

---

## Troubleshooting

### "Certificate provisioning" errors
Caddy needs ports 80 and 443 open for Let's Encrypt HTTP-01 challenge. Double-check:
- Oracle security list allows 80 and 443
- iptables allows 80 and 443 (`sudo iptables -L INPUT -n`)
- DuckDNS points to the correct IP (`ping YOURNAME.duckdns.org`)

### Services keep restarting
Check logs: `docker compose logs --tail=50 SERVICE_NAME`
Common causes:
- Database not ready yet (services retry automatically)
- Missing environment variables in .env
- Wrong database password

### Out of memory
Check memory: `free -h`
The 4GB swap should prevent OOM, but if it happens:
```bash
docker compose logs --tail=20  # Find which service crashed
docker stats --no-stream        # See memory usage per container
```

### DuckDNS IP not updating
```bash
cat /opt/duckdns/duck.log  # Should say "OK"
curl -s ifconfig.me         # Your server's public IP
```

### Cannot SSH after firewall setup
If you accidentally locked yourself out, use the **Oracle Cloud Console**:
1. Instance → Console Connection → Create Cloud Shell Connection
2. Fix iptables from there

---

## Architecture Overview

```
Internet
  │
  ├── https://YOURNAME.duckdns.org
  │     │
  │     └── Caddy (auto-TLS)
  │           ├── /api/geo/* → frontend:4000 (Next.js API routes)
  │           ├── /api/*     → api-gateway:3000
  │           └── /*         → frontend:4000
  │
  └── https://YOURNAME-admin.duckdns.org
        │
        └── Caddy (auto-TLS)
              └── /* → admin-frontend:4001

Internal (Docker network):
  api-gateway:3000 ──→ auth-service:3001
                   ──→ user-service:3002
                   ──→ listing-service:3003
                   ──→ ... (11 services total)

  Each service ──→ its own PostgreSQL database
  All services ──→ RabbitMQ (events)
  trade-service ──→ Redis (distributed locks)
```

---

## Cost

| Resource | Cost |
|----------|------|
| Oracle Cloud ARM VM (4 OCPU, 24GB RAM, 200GB) | **Free forever** |
| DuckDNS subdomain | **Free** |
| Let's Encrypt TLS certificate | **Free** |
| **Total** | **$0/month** |

Optional paid add-ons if you want them later:
- Real domain name (e.g., .com): ~$10/year
- Cloudflare R2 storage: Free up to 10GB
- Stripe payments: 2.9% + 30¢ per transaction
