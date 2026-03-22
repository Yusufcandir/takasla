
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Takasla — a research-grade C2C item exchange platform for high-value goods (luxury watches, collectibles, rare electronics). Implements risk-based escrow workflows, a trade state machine, blockchain hash anchoring, and microservice architecture with strong consistency guarantees.

This is both a working platform and a software engineering research prototype for evaluating trust-enhanced exchange mechanisms.

**Live at:** `https://takasla.duckdns.org` (user) + `https://takasla-admin.duckdns.org` (admin)

## Tech Stack

- **Backend:** NestJS (Node.js/TypeScript), one service per domain
- **Database:** PostgreSQL 16 (one DB per service), TypeORM with `synchronize: true` in dev, `false` in production
- **Message Broker:** RabbitMQ 3.13 (topic exchange `exchange.events`)
- **Cache/Locking:** Redis 7 (distributed locks via `SET NX EX`)
- **Blockchain:** Ethereum Sepolia (real on-chain anchoring via ethers.js v6, MerkleAnchor.sol deployed at `0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3`)
- **Object Storage:** Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`), falls back to local disk when unconfigured
- **Shipping:** Geliver (Turkish domestic carriers) + EasyPost (international, simulation mode)
- **Payments:** Iyzico (Turkish payment provider) or simulation mode when unconfigured
- **Frontend:** Next.js 14 (App Router, TypeScript) — two separate apps
- **Email:** Brevo HTTP API (primary) + Gmail SMTP (fallback) for verification and moderation notifications
- **AI Moderation:** SightEngine API for AI-generated image detection
- **Reverse Proxy:** Caddy 2 with auto-TLS (Let's Encrypt)
- **Infrastructure:** Docker, Docker Compose, pnpm workspaces monorepo
- **Hosting:** DigitalOcean droplet (4 vCPU, 8 GB RAM, Ubuntu 22.04)

## Commands

```bash
# Install all dependencies (from root)
pnpm install

# Build all packages and services
pnpm build

# Run all services in dev mode (watch)
pnpm dev

# Start only infrastructure (Postgres instances, Redis, RabbitMQ)
docker-compose -f docker-compose.dev.yml up -d

# Build a single service
pnpm --filter @exchange/trade-service build

# Run a single service in dev mode
pnpm --filter @exchange/auth-service dev

# Run tests for a single service
pnpm --filter @exchange/trade-service test

# Build shared packages first (required before services)
pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build

# Deploy to production server
git add -A && git commit -m "message" && git push
ssh root@134.209.198.150 "cd /opt/exchange && bash scripts/deploy.sh --domain takasla"

# Deploy without git pull (if already pulled)
ssh root@134.209.198.150 "cd /opt/exchange && bash scripts/deploy.sh --domain takasla --skip-pull"

# Manual blockchain anchoring (bypasses hourly cron)
curl -X POST https://takasla.duckdns.org/api/certificates/anchor

# Mark all existing users as verified (grandfather old accounts)
docker exec trading-postgres-auth-1 psql -U exchange -d auth_db -c "UPDATE users SET is_verified = true WHERE is_verified = false;"

# Add a new column to production DB (since synchronize: false)
docker exec trading-postgres-auth-1 psql -U exchange -d auth_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS new_col TYPE;"
```

## Architecture

### Monorepo Structure (pnpm workspaces)

- `packages/shared-types` — Enums (TradeState, RiskLevel, etc.), event interfaces (BaseEvent + domain events), DTOs, RabbitMQ constants (routing keys, queue names)
- `packages/common` — Reusable NestJS modules: DatabaseModule, RabbitMQModule/Service, OutboxModule/Entity/Service, RedisModule, StorageModule/Service (Cloudflare R2 + local fallback, EXIF stripping via sharp), JwtAuthGuard, CurrentUser decorator, IdempotencyGuard, HealthModule, SightEngineModule/Service
- `services/*` — 12 independent NestJS microservices
- `frontend/` — Next.js 14 App Router — **user-facing app** (port 4000)
- `admin-frontend/` — Next.js 14 App Router — **admin-only app** (port 4001, completely separate codebase)

### Microservices (each owns its own PostgreSQL database)

| Service | Port | DB | Purpose |
|---------|------|-----|---------|
| api-gateway | 3000 | none | HTTP proxy, JWT validation, rate limiting (1000/min) |
| auth-service | 3001 | auth_db | Registration, login, JWT + refresh tokens, email verification, KVKK consent, banned emails, user deletion cascade |
| user-service | 3002 | user_db | Profiles, trust scores, saved addresses, avatar uploads (R2) |
| listing-service | 3003 | listing_db | Item listings, categories, image uploads (R2 + SightEngine AI check), Q&A, favorites, reports, boost/spotlight |
| offer-service | 3004 | offer_db | Create/accept/reject offers, counter-offers |
| trade-service | 3005 | trade_db | **CORE** — state machine, saga, risk, escrow, proof uploads (R2 + SightEngine), EXIF fraud detection |
| reputation-service | 3006 | reputation_db | Ratings, trust score calculation, whitewash detection, fraud flags |
| dispute-service | 3007 | dispute_db | Disputes, evidence, moderator actions, SLA tracking |
| certificate-service | 3008 | certificate_db | Certificates, Merkle trees, real Sepolia anchoring |
| shipping-service | 3009 | shipping_db | Multi-carrier shipping (Geliver domestic + EasyPost international) |
| payment-service | 3010 | payment_db | Iyzico payments, listing boost payments, simulation mode |
| messaging-service | 3011 | messaging_db | User-to-user conversations, messages, unread counts |

### Frontend Apps (Two Completely Separate Next.js Apps)

| App | Port | Purpose |
|-----|------|---------|
| `frontend/` | 4000 | User-facing — listings, offers, trades, disputes, profile, dashboard, legal pages (KVKK, privacy, terms) |
| `admin-frontend/` | 4001 | Admin-only — amber theme, verifications, disputes, user management, fraud flags, listing reports, centers |

Each has its own `Dockerfile`, `package.json`, and routing. They share no code. The user frontend has dark navy nav; the admin frontend has amber nav. They both talk to the same API gateway at port 3000.

### Auth Service — Email Verification Flow

Registration requires email confirmation before login is allowed:

1. `POST /auth/register` — creates user (`isVerified: false`, `consentedAt`, `consentVersion`), validates KVKK + terms consent, saves `VerificationTokenEntity` (UUID, 24h expiry), sends email via Brevo, returns `{ message, userId }` (no tokens)
2. `GET /auth/verify-email?token=xxx` — validates token, marks user verified, returns tokens (auto-login)
3. `POST /auth/resend-verification` — creates new token, sends new email
4. `POST /auth/login` — rejects with 401 if `isVerified: false`

**Email config** (in `.env` and `docker-compose.yml` auth-service env):
```
BREVO_API_KEY=xkeysib-xxx        # Primary email provider (Brevo HTTP API)
SMTP_USER=your-gmail@gmail.com   # Fallback (Gmail SMTP)
SMTP_PASS=your-16-char-app-password
FRONTEND_URL=https://takasla.duckdns.org   # Used to build the verify link in the email
```

### Auth Service — Key Entities

- `UserEntity` (`users`) — email, passwordHash, role, `isVerified` (bool, default false), `consentedAt` (timestamptz), `consentVersion` (varchar)
- `RefreshTokenEntity` (`refresh_tokens`) — tokenHash, userId, expiresAt, revoked
- `VerificationTokenEntity` (`verification_tokens`) — token (UUID), userId, expiresAt, used (bool)
- `BannedEmailEntity` (`banned_emails`) — email (unique), bannedAt, reason

### KVKK Compliance (Turkish Data Protection)

- **Legal pages:** `/kvkk` (Aydinlatma Metni), `/privacy` (Gizlilik Politikasi), `/terms` (Kullanim Kosullari)
- **Registration consent:** Two separate checkboxes (KVKK acknowledgment + Terms acceptance), stored as `consentedAt`/`consentVersion`
- **Data export:** `GET /auth/my-data` — returns all user data as JSON (Article 11 right of access)
- **User deletion cascade:** `auth.user.deleted` RabbitMQ event triggers cleanup in every service via `src/cleanup/user-cleanup.listener.ts`
- **EXIF stripping:** `sharp` strips GPS/metadata from all uploaded images before R2 storage (StorageService)
- **Data retention schedulers:** Weekly token cleanup (auth), monthly PII anonymization in old trades/disputes (>2 years)
- **Banned emails:** When a user is banned, their email is added to `banned_emails` to prevent re-registration

### Cleanup Modules (User Deletion + Data Retention)

Every service has `src/cleanup/cleanup.module.ts` registered in `app.module.ts`:

| Service | Cleanup Action |
|---------|---------------|
| user-service | Delete profile, addresses, avatar from R2 |
| listing-service | Archive listings (ListingStatus.ARCHIVED), delete favorites/reports/questions |
| offer-service | Delete all offers by user |
| trade-service | Anonymize addresses in completed trades |
| reputation-service | Delete trust score, anonymize ratings |
| dispute-service | Anonymize user in disputes |
| shipping-service | Anonymize address fields |
| payment-service | Anonymize PII (keep records for audit) |

Data retention schedulers (cron jobs):
- auth-service: weekly — clean expired/revoked refresh tokens and used verification tokens
- trade-service: monthly — anonymize addresses in trades completed >2 years ago
- dispute-service: monthly — anonymize PII in disputes resolved >2 years ago

### Trade State Machine (trade-service is the heart)

States: `INITIATED → OFFERED → ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED → AWAITING_SHIPMENT → IN_TRANSIT → DELIVERED → COMPLETED`
Branch states: `DISPUTE_OPEN`, `CANCELLED`, `REVOKED`
Center flow: `SHIPPING_TO_CENTER → AT_CENTER → CENTER_VERIFICATION → CENTER_VERIFIED → SHIPPING_TO_RECIPIENTS`

Defined in `services/trade-service/src/state-machine/transitions.ts` as a typed transition table with guards and side effects. The state machine is risk-level-dependent:

- **LOW risk:** 24h dispute window, no blockchain anchoring
- **MEDIUM risk:** proof required, manual verification, 72h dispute window
- **HIGH risk:** structured proof checklist, mandatory expert review, 7-day dispute window, blockchain-anchored certificates, center verification

### Risk Assessment Formula

Located in `services/trade-service/src/risk/risk-assessor.service.ts`:
```
riskScore = (categoryWeight * 0.6) + (reputationPenalty * 0.25) + (disputeHistory * 0.15)
LOW < 0.3, MEDIUM < 0.6, HIGH >= 0.6
```

### Event-Driven Communication

All inter-service communication goes through RabbitMQ topic exchange `exchange.events`. Routing keys and queue bindings are defined in `packages/shared-types/src/constants/rabbitmq.constants.ts`. Key flows:

- `offer.accepted` → trade-service creates trade
- `trade.locked` → listing-service locks both listings
- `trade.verified` → certificate-service issues certificates
- `payment.succeeded` → trade-service records party payment (skips boost payments with no tradeId)
- `shipping.label_created` / `shipping.in_transit` / `shipping.delivered` → trade-service advances shipping states
- `trade.completed` → listing-service marks traded, reputation-service enables ratings
- `dispute.resolved` → trade-service transitions to COMPLETED or REVOKED
- `payment.boost.succeeded` → listing-service activates featured/spotlight boost
- `auth.user.registered` → user-service creates profile
- `auth.user.deleted` → ALL services clean up user data (KVKK cascade)
- `moderation.*` → auth-service sends notification emails

### Consistency Patterns

- **Outbox pattern:** `packages/common/src/outbox/` — events are written to an `outbox` table in the same DB transaction as state changes, then published by a polling process (2s interval)
- **Saga orchestration:** `services/trade-service/src/saga/` — `TradeSagaOrchestrator` executes steps sequentially with compensating transactions on failure
- **Distributed locking:** `services/trade-service/src/escrow/lock.service.ts` — Redis `SET NX EX` + DB audit trail
- **Idempotency:** `packages/common/src/idempotency/` — `X-Idempotency-Key` header guard via Redis
- **Optimistic locking:** `@VersionColumn()` on trades table

### Blockchain Layer

- `certificate-service/src/merkle/` — Daily cron builds Merkle tree from unanchored certificates
- `certificate-service/src/blockchain/` — Anchors Merkle root to Sepolia via ethers.js (falls back to simulation mode if no config)
- `certificate-service/src/blockchain/contracts/MerkleAnchor.sol` — Simple Solidity contract deployed at `0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3` on Sepolia
- `scripts/deploy-merkle-anchor.ts` — Compiles and deploys the contract (requires Sepolia ETH + Infura RPC)
- `POST /certificates/anchor` — Manual trigger for build + anchor (public endpoint, bypasses cron schedule)
- NO personal data is ever written on-chain, only hashes

### Shipping Service

- `services/shipping-service/src/carriers/` — Multi-carrier provider abstraction
- **CarrierProviderService** routes by origin/destination: Turkey→Turkey uses Geliver, international uses EasyPost
- **GeliverProvider** — Geliver SDK (ESM-only, loaded via dynamic import), supports Yurtiçi/Aras/MNG/PTT/Sürat/HepsiJet
- **EasyPostProvider** — Simulation mode with realistic rates for FedEx/UPS/DHL (real API integration TODO)
- Dual webhook handlers with signature verification: `POST /shipments/webhook` (EasyPost), `POST /shipments/webhook/geliver`
- `GELIVER_TEST_MODE=true` creates test shipments that auto-advance status

### Payment Service

- Iyzico integration with full simulation mode when `IYZICO_API_KEY` not configured
- `POST /payments/create-boost` — Creates listing boost payments (featured: 7d, spotlight: 30d)
- `POST /payments/:id/checkout` — Creates checkout session (auto-completes in simulation mode)
- `POST /payments/:id/simulate-payment` — Dev-only endpoint for testing without Iyzico
- Publishes `payment.succeeded` (with tradeId for trade payments, null for boost payments) and `payment.boost.succeeded`

### File Storage (Cloudflare R2)

- `packages/common/src/storage/` — `StorageModule.forRoot()` (global), `StorageService`
- Uses `@aws-sdk/client-s3` pointed at R2's S3-compatible endpoint: `https://{accountId}.r2.cloudflarestorage.com`
- Falls back to local disk (`uploads-fallback/`) when R2 env vars absent
- **EXIF stripping:** All images are piped through `sharp().rotate().toBuffer()` before upload to strip GPS/metadata (KVKK privacy)
- Three services use it: listing-service (images), trade-service (proofs), user-service (avatars)
- Upload returns `{ key, url }` — URL is absolute R2 public URL when cloud-enabled, empty for local fallback
- Old images stored in Docker volumes still served via fallback endpoints (`GET /uploads/:filename`)

### AI Image Detection (SightEngine)

- `packages/common/src/sightengine/` — `SightEngineModule`, `SightEngineService`
- Detects AI-generated/synthetic images in listing uploads and trade proof submissions
- Configured via `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET`
- Falls back to no-op if credentials not set

### Frontend — User App (`frontend/`)

- `frontend/src/app/` — App Router pages: auth (login/register/verify-email), listings, trades, disputes, dashboard, profile, certificates, messages, favorites, legal pages (KVKK/privacy/terms)
- `frontend/src/lib/api.ts` — Typed API client with auth token injection + auto token refresh on 401
- `frontend/src/lib/auth.ts` — Token management (localStorage). `clearTokens()` calls `localStorage.clear()` to fully wipe session. All auth redirects use `window.location.replace()` to prevent back-button stale state.
- `frontend/src/locales/` — `en.json` + `tr.json` (~44KB each) for bilingual UI

### Frontend — Admin App (`admin-frontend/`)

- `admin-frontend/src/app/` — Admin pages: login, dashboard, verifications (list + detail), disputes (list + detail), users, fraud-flags, listing reports, centers, center-verifications, trades
- `admin-frontend/src/lib/api.ts` — Admin-only API client (no user-facing APIs)
- Amber color theme throughout. No user nav links. No shared code with user frontend.

## Production Deployment

### Server
- **DigitalOcean droplet:** `134.209.198.150` (4 vCPU, 8 GB RAM, 160 GB disk, Ubuntu 22.04)
- **SSH:** `ssh root@134.209.198.150`
- **Project path:** `/opt/exchange`
- **Domains:** `takasla.duckdns.org` (user) + `takasla-admin.duckdns.org` (admin) via DuckDNS + Caddy auto-TLS

### Deploy workflow
```bash
# Local: commit and push
git add -A && git commit -m "changes" && git push

# Server: deploy (pulls, builds, restarts)
ssh root@134.209.198.150 "cd /opt/exchange && bash scripts/deploy.sh --domain takasla"
```

### Production caveats
- `TYPEORM_SYNCHRONIZE=false` in production (set in `docker-compose.prod.yml`)
- **New entity columns require manual ALTER TABLE** — TypeORM won't auto-create them in production
- `docker-compose.prod.yml` also sets memory limits (256-512M per service)
- Both user and admin Caddy domains need `/api/*` routing to `api-gateway:3000`

## Adding a New Service

1. Create `services/new-service/` with package.json (`@exchange/new-service`), tsconfig.json, nest-cli.json, Dockerfile
2. Add entities, controllers, services, modules following existing patterns
3. Import `DatabaseModule.forRoot()`, `RabbitMQModule.forRoot()`, `HealthModule` in app.module
4. If the service handles file uploads: import `StorageModule.forRoot()` and inject `StorageService`
5. Add `src/cleanup/cleanup.module.ts` with `UserCleanupListener` subscribing to `auth.user.deleted` (KVKK requirement)
6. Add service + postgres instance to `docker-compose.yml` and `docker-compose.dev.yml`
7. Add R2 env vars to docker-compose.yml if service handles uploads
8. Add REDIS_HOST/REDIS_PORT env vars if service uses Redis
9. Add proxy route in `services/api-gateway/src/proxy/proxy.controller.ts` SERVICE_MAP

## Key Conventions

- Every entity uses UUID primary keys (`gen_random_uuid()`)
- All timestamps are `TIMESTAMPTZ` columns
- Event payloads extend `BaseEvent` (eventId, timestamp, correlationId, idempotencyKey)
- Services subscribe to events in `onModuleInit()`
- State changes in trade-service always go through the state machine (`TradeStateMachine.transition()`)
- The outbox table must be included in any service that publishes events transactionally
- `clearTokens()` in frontend calls `localStorage.clear()` — do not change back to individual key removal
- All post-auth redirects use `window.location.replace()` not `window.location.href`
- File uploads use `memoryStorage()` (multer) → `StorageService.upload()` → R2 or local fallback
- ESM-only packages in NestJS (CommonJS): use `new Function('specifier', 'return import(specifier)')` to bypass TypeScript's `import()` → `require()` transform (e.g., `@geliver/sdk`)
- `NEXT_PUBLIC_API_URL` is baked into Next.js at build time — if local IP changes, `.env` must be updated and frontends rebuilt (`docker-compose up -d --build frontend admin-frontend`)
- Every service must have a `src/cleanup/` module for KVKK user deletion cascade
- Production DB changes: always use `ALTER TABLE` manually since `synchronize: false`
