# Takasla — Trust-Enhanced C2C Exchange Platform

A research-grade peer-to-peer item exchange platform for high-value goods (luxury watches, collectibles, rare electronics). Implements risk-based escrow workflows, AI-powered content moderation, blockchain certificate anchoring, and a microservice architecture with strong consistency guarantees.

**Live:** [takasla.duckdns.org](https://takasla.duckdns.org)

---

## Features

- **Risk-Based Escrow** — Automated risk scoring (category weight, reputation, dispute history) determines verification requirements, dispute windows, and shipping flows
- **AI Image Moderation** — Detects AI-generated/synthetic images in listings using SightEngine, flags for admin review
- **Blockchain Certificates** — Merkle tree anchoring on Ethereum Sepolia for immutable trade completion proofs (no personal data on-chain)
- **Trade State Machine** — 15+ states with typed transitions, guards, and side effects managing the full trade lifecycle
- **Fraud Detection** — Circular trading, rapid rating exchange, same-address detection, duplicate proof analysis
- **Multi-Carrier Shipping** — Geliver (Turkish domestic) + EasyPost (international) with webhook tracking
- **Real-Time Messaging** — User-to-user conversations with unread counts
- **KVKK Compliance** — Full Turkish data protection compliance: EXIF stripping, PII anonymization, user deletion cascade, data export

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Caddy (Auto-TLS)                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)  │  Admin Frontend (Next.js)  │  API Gateway │
├─────────────────────────────────────────────────────────────────┤
│                        API Gateway (NestJS)                      │
├─────────────────────────────────────────────────────────────────┤
│  auth  │  user  │  listing  │  offer  │  trade  │  reputation  │
│  dispute  │  certificate  │  shipping  │  payment  │  messaging │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (12 DBs)  │  RabbitMQ  │  Redis  │  Cloudflare R2  │
└─────────────────────────────────────────────────────────────────┘
```

### Services

| Service | Purpose |
|---------|---------|
| api-gateway | HTTP proxy, JWT validation, rate limiting |
| auth-service | Registration, login, JWT tokens, email verification, KVKK consent |
| user-service | Profiles, trust scores, avatars |
| listing-service | Listings, categories, images, Q&A, favorites, reports |
| offer-service | Create/accept/reject offers, counter-offers |
| trade-service | State machine, saga orchestration, risk assessment, escrow |
| reputation-service | Ratings, trust scores, fraud detection |
| dispute-service | Disputes, evidence, moderator actions |
| certificate-service | Certificates, Merkle trees, Sepolia anchoring |
| shipping-service | Multi-carrier shipping, webhook handlers |
| payment-service | Iyzico payments, listing boosts |
| messaging-service | Conversations, messages, unread counts |

---

## Tech Stack

**Backend:** NestJS (TypeScript), one service per domain
**Database:** PostgreSQL 16 (one DB per service), TypeORM
**Messaging:** RabbitMQ 3.13 (topic exchange, outbox pattern)
**Cache/Locking:** Redis 7 (distributed locks, idempotency)
**Blockchain:** Ethereum Sepolia, Solidity, ethers.js v6
**Storage:** Cloudflare R2 (S3-compatible)
**AI:** SightEngine API (AI-generated image detection)
**Shipping:** Geliver + EasyPost
**Payments:** Iyzico
**Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
**Proxy:** Caddy 2 (auto-TLS)
**Infrastructure:** Docker Compose, pnpm workspaces monorepo

---

## Consistency Patterns

- **Outbox Pattern** — Events written to DB in same transaction as state changes, then published
- **Saga Orchestration** — Sequential steps with compensating transactions on failure
- **Distributed Locking** — Redis `SET NX EX` for escrow lock operations
- **Idempotency Guard** — `X-Idempotency-Key` header prevents duplicate processing
- **Optimistic Locking** — Version column on trades table

---

## Trade Flow

```
INITIATED → ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION
→ VERIFIED → AWAITING_SHIPMENT → IN_TRANSIT → DELIVERED → COMPLETED
```

High-risk trades route through verification centers:
```
LOCKED → SHIPPING_TO_CENTER → AT_CENTER → CENTER_VERIFICATION
→ CENTER_VERIFIED → SHIPPING_TO_RECIPIENTS → DELIVERED → COMPLETED
```

---

## Risk Assessment

```
riskScore = (categoryWeight × 0.6) + (reputationPenalty × 0.25) + (disputeHistory × 0.15)

LOW    < 0.3  → 24h dispute window, basic verification
MEDIUM < 0.6  → Proof required, manual verification, 72h dispute window
HIGH   ≥ 0.6  → Expert review, 7-day dispute window, blockchain certificates
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, RabbitMQ)
docker-compose -f docker-compose.dev.yml up -d

# Build shared packages
pnpm --filter @exchange/shared-types build && pnpm --filter @exchange/common build

# Run all services in dev mode
pnpm dev
```

### Production

```bash
# Build and deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Project Structure

```
├── packages/
│   ├── shared-types/     # Enums, event interfaces, DTOs, constants
│   └── common/           # Reusable NestJS modules (DB, RabbitMQ, Redis, Storage, Auth)
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── listing-service/
│   ├── offer-service/
│   ├── trade-service/
│   ├── reputation-service/
│   ├── dispute-service/
│   ├── certificate-service/
│   ├── shipping-service/
│   ├── payment-service/
│   └── messaging-service/
├── frontend/             # User-facing Next.js app
├── admin-frontend/       # Admin panel Next.js app
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## License

This project is part of a Software Engineering graduation thesis at Mugla Sitki Kocman University.
