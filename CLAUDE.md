
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Secure Goods Exchange Platform — a research-grade C2C item exchange system for high-value goods (luxury watches, collectibles, rare electronics). Implements risk-based escrow workflows, a trade state machine, blockchain hash anchoring, and microservice architecture with strong consistency guarantees.

This is both a working platform and a software engineering research prototype for evaluating trust-enhanced exchange mechanisms.

## Tech Stack

- **Backend:** NestJS (Node.js/TypeScript), one service per domain
- **Database:** PostgreSQL (one DB per service), TypeORM with `synchronize: true` in dev
- **Message Broker:** RabbitMQ (topic exchange `exchange.events`)
- **Cache/Locking:** Redis (distributed locks via `SET NX EX`)
- **Blockchain:** Ethereum Sepolia (real on-chain anchoring via ethers.js v6, MerkleAnchor.sol deployed at `0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3`)
- **Object Storage:** Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`), falls back to local disk when unconfigured
- **Shipping:** Geliver (Turkish domestic carriers) + EasyPost (international, simulation mode)
- **Payments:** Stripe (or simulation mode when unconfigured)
- **Frontend:** Next.js 14 (App Router, TypeScript) — two separate apps
- **Email:** Nodemailer + Gmail SMTP (`smtp.gmail.com:587`) for email verification
- **Infrastructure:** Docker, Docker Compose, pnpm workspaces monorepo

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

# Start everything including services (production containers)
docker-compose up -d

# Build a single service
pnpm --filter @exchange/trade-service build

# Run a single service in dev mode
pnpm --filter @exchange/auth-service dev

# Run tests for a single service
pnpm --filter @exchange/trade-service test

# Build shared packages first (required before services)
pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build

# Rebuild only auth-service + frontends after auth/email changes
docker-compose up -d --build auth-service frontend admin-frontend

# Rebuild frontends after IP change (NEXT_PUBLIC_API_URL is baked at build time)
docker-compose up -d --build frontend admin-frontend

# Rebuild services that handle file uploads after R2 config changes
docker-compose up -d --build listing-service trade-service user-service

# Manual blockchain anchoring (bypasses hourly cron)
curl -X POST http://localhost:3000/api/certificates/anchor

# Mark all existing users as verified (run after adding email verification to grandfather old accounts)
docker exec trading-postgres-auth-1 psql -U exchange -d auth_db -c "UPDATE users SET is_verified = true WHERE is_verified = false;"
```

## Architecture

### Monorepo Structure (pnpm workspaces)

- `packages/shared-types` — Enums (TradeState, RiskLevel, etc.), event interfaces (BaseEvent + domain events), DTOs, RabbitMQ constants (routing keys, queue names)
- `packages/common` — Reusable NestJS modules: DatabaseModule, RabbitMQModule/Service, OutboxModule/Entity/Service, RedisModule, StorageModule/Service (Cloudflare R2 + local fallback), JwtAuthGuard, CurrentUser decorator, IdempotencyGuard, HealthModule
- `services/*` — 11 independent NestJS microservices
- `frontend/` — Next.js 14 App Router — **user-facing app** (port 4000)
- `admin-frontend/` — Next.js 14 App Router — **admin-only app** (port 4001, completely separate codebase)

### Microservices (each owns its own PostgreSQL database)

| Service | Port | DB | Purpose |
|---------|------|-----|---------|
| api-gateway | 3000 | none | HTTP proxy, JWT validation, rate limiting |
| auth-service | 3001 | auth_db | Registration, login, JWT + refresh tokens, email verification |
| user-service | 3002 | user_db | Profiles, trust scores, saved addresses, avatar uploads (R2) |
| listing-service | 3003 | listing_db | Item listings, categories, image uploads (R2), Q&A, favorites, boost/spotlight |
| offer-service | 3004 | offer_db | Create/accept/reject offers, counter-offers |
| trade-service | 3005 | trade_db | **CORE** — state machine, saga, risk, escrow, proof uploads (R2) |
| reputation-service | 3006 | reputation_db | Ratings, trust score calculation, whitewash detection |
| dispute-service | 3007 | dispute_db | Disputes, evidence, moderator actions |
| certificate-service | 3008 | certificate_db | Certificates, Merkle trees, real Sepolia anchoring |
| shipping-service | 3009 | shipping_db | Multi-carrier shipping (Geliver domestic + EasyPost international) |
| payment-service | 3010 | payment_db | Stripe payments, listing boost payments, simulation mode |

### Frontend Apps (Two Completely Separate Next.js Apps)

| App | Port | Purpose |
|-----|------|---------|
| `frontend/` | 4000 | User-facing — listings, offers, trades, disputes, profile, dashboard |
| `admin-frontend/` | 4001 | Admin-only — amber theme, verifications queue, disputes, user management |

Each has its own `Dockerfile`, `package.json`, and routing. They share no code. The user frontend has dark navy nav; the admin frontend has amber nav. They both talk to the same API gateway at port 3000.

### Auth Service — Email Verification Flow

Registration now requires email confirmation before login is allowed:

1. `POST /auth/register` — creates user (`isVerified: false`), saves `VerificationTokenEntity` (UUID, 24h expiry), sends email via Gmail SMTP, returns `{ message, userId }` (no tokens)
2. `GET /auth/verify-email?token=xxx` — validates token, marks user verified, returns tokens (auto-login)
3. `POST /auth/resend-verification` — creates new token, sends new email
4. `POST /auth/login` — rejects with 401 if `isVerified: false`

**Email config** (in `.env` and `docker-compose.yml` auth-service env):
```
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password   # Gmail App Password, NOT your regular password
FRONTEND_URL=http://localhost:4000    # Used to build the verify link in the email
```

Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords. Free up to 500 emails/day.

### Auth Service — Key Entities

- `UserEntity` (`users`) — email, passwordHash, role, `isVerified` (bool, default false)
- `RefreshTokenEntity` (`refresh_tokens`) — tokenHash, userId, expiresAt, revoked
- `VerificationTokenEntity` (`verification_tokens`) — token (UUID), userId, expiresAt, used (bool)

### Trade State Machine (trade-service is the heart)

States: `INITIATED → OFFERED → ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED → AWAITING_SHIPMENT → IN_TRANSIT → DELIVERED → COMPLETED`
Branch states: `DISPUTE_OPEN`, `CANCELLED`, `REVOKED`

Defined in `services/trade-service/src/state-machine/transitions.ts` as a typed transition table with guards and side effects. The state machine is risk-level-dependent:

- **LOW risk:** proof optional, auto-verify, 24h dispute window, no blockchain anchoring
- **MEDIUM risk:** proof required, manual verification, 72h dispute window
- **HIGH risk:** structured proof checklist, mandatory expert review, 7-day dispute window, blockchain-anchored certificates

### Risk Assessment Formula

Located in `services/trade-service/src/risk/risk-assessor.service.ts`:
```
riskScore = (categoryWeight * 0.3) + (valueScore * 0.3) + (reputationPenalty * 0.25) + (disputeHistory * 0.15)
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

### Consistency Patterns

- **Outbox pattern:** `packages/common/src/outbox/` — events are written to an `outbox` table in the same DB transaction as state changes, then published by a polling process
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

- Stripe integration with full simulation mode when `STRIPE_SECRET_KEY` not configured
- `POST /payments/create-boost` — Creates listing boost payments (featured: 7d/$4.99, spotlight: 30d/$14.99)
- `POST /payments/:id/checkout` — Creates Stripe checkout session (auto-completes in simulation mode)
- `POST /payments/:id/simulate-payment` — Dev-only endpoint for testing without Stripe
- Publishes `payment.succeeded` (with tradeId for trade payments, null for boost payments) and `payment.boost.succeeded`

### File Storage (Cloudflare R2)

- `packages/common/src/storage/` — `StorageModule.forRoot()` (global), `StorageService`
- Uses `@aws-sdk/client-s3` pointed at R2's S3-compatible endpoint: `https://{accountId}.r2.cloudflarestorage.com`
- Falls back to local disk (`uploads-fallback/`) when R2 env vars absent
- Three services use it: listing-service (images), trade-service (proofs), user-service (avatars)
- Upload returns `{ key, url }` — URL is absolute R2 public URL when cloud-enabled, empty for local fallback
- Old images stored in Docker volumes still served via fallback endpoints (`GET /uploads/:filename`)

### Frontend — User App (`frontend/`)

- `frontend/src/app/` — App Router pages: auth (login/register/verify-email), listings, trades, disputes, dashboard, profile, certificates
- `frontend/src/lib/api.ts` — Typed API client with auth token injection + auto token refresh on 401
- `frontend/src/lib/auth.ts` — Token management (localStorage). `clearTokens()` calls `localStorage.clear()` to fully wipe session. All auth redirects use `window.location.replace()` to prevent back-button stale state.

### Frontend — Admin App (`admin-frontend/`)

- `admin-frontend/src/app/` — Admin pages: login, dashboard, verifications (list + detail), disputes (list + detail), users
- `admin-frontend/src/lib/api.ts` — Admin-only API client (no user-facing APIs)
- Amber color theme throughout. No user nav links. No shared code with user frontend.

## Adding a New Service

1. Create `services/new-service/` with package.json (`@exchange/new-service`), tsconfig.json, nest-cli.json, Dockerfile
2. Add entities, controllers, services, modules following existing patterns
3. Import `DatabaseModule.forRoot()`, `RabbitMQModule.forRoot()`, `HealthModule` in app.module
4. If the service handles file uploads: import `StorageModule.forRoot()` and inject `StorageService`
5. Add service + postgres instance to `docker-compose.yml` and `docker-compose.dev.yml`
6. Add R2 env vars to docker-compose.yml if service handles uploads
7. Add proxy route in `services/api-gateway/src/proxy/proxy.controller.ts` SERVICE_MAP

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
