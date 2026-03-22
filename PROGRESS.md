# Exchange Platform — Development Progress

## Phase 1 — Foundation (COMPLETE)

### Infrastructure & Monorepo Setup
- [x] pnpm workspace configuration (`pnpm-workspace.yaml`)
- [x] Root `package.json` with monorepo scripts
- [x] Shared TypeScript base config (`tsconfig.base.json`)
- [x] Environment template (`.env.example`) and `.env` (localhost dev)
- [x] `.gitignore`

### Shared Packages
- [x] `packages/shared-types` — All enums (TradeState, RiskLevel, Role, OfferStatus, ListingStatus, DisputeStatus, CertificateStatus, SagaState), event interfaces, DTOs, RabbitMQ constants (all routing keys + queue names)
- [x] `packages/common` — DatabaseModule, RabbitMQModule + Service (with `ensureConnected()` lazy-init fix), OutboxModule + Entity + Service, RedisModule, JwtAuthGuard (handles `@Roles()` + `@Public()`), CurrentUser decorator, IdempotencyGuard, HealthModule

### All 9 Microservices Scaffolded
- [x] **api-gateway** (port 3000) — HTTP proxy, JWT validation middleware, rate limiting
- [x] **auth-service** (port 3001) — Registration, login, JWT + refresh tokens, `user.registered` event, `POST /auth/register/moderator` (dev endpoint)
- [x] **user-service** (port 3002) — Profile entity, trust score entity, profile CRUD, `GET /profiles/:userId/trust` endpoint, subscribes to auth events for auto-profile creation
- [x] **listing-service** (port 3003) — Listing + image + category entities, CRUD with pagination, category seeding on boot, subscribes to `trade.locked` / `trade.completed` / `trade.cancelled` to update listing status
- [x] **offer-service** (port 3004) — Offer + counter-offer entities, create/accept/reject/cancel/counter flow, idempotency guard, publishes `offer.accepted`
- [x] **trade-service** (port 3005) — Full core service (see Phase 2)
- [x] **reputation-service** (port 3006) — Rating entity, trust score snapshots, whitewashing detection (see Phase 3)
- [x] **dispute-service** (port 3007) — Dispute + evidence + moderator action entities (see Phase 3)
- [x] **certificate-service** (port 3008) — Certificate entity, Merkle tree builder, blockchain anchoring (ethers.js v6 + Sepolia or simulation mode), MerkleAnchor.sol

### Docker & DevOps
- [x] `docker-compose.yml` — Full production setup (9 services + 8 PostgreSQL + Redis + RabbitMQ + frontend)
- [x] `docker-compose.dev.yml` — Infrastructure-only for local development
- [x] Dockerfile for every service (multi-stage builds)

### Frontend (Next.js 14 App Router)
- [x] Layout, landing page, navigation
- [x] Auth pages (login, register) with localStorage token management
- [x] Listings pages (browse, create, detail with offer CTA)
- [x] Trades pages (list with state badges, detail with state progression + event log)
- [x] Dashboard with stats overview
- [x] Typed API client (`lib/api.ts`) with auth token injection

### Build & Boot Fixes Applied
- [x] Resolved all TypeScript strict mode errors across 9 services + 2 shared packages
- [x] Fixed `incremental: true` + `deleteOutDir: true` conflict (removed `incremental` from `tsconfig.base.json`)
- [x] Fixed RabbitMQService race condition with `ensureConnected()` lazy-connect
- [x] Fixed `OutboxModule` missing from `TradesModule` and `SagaModule`
- [x] Created missing `TrustModule` in user-service
- [x] Fixed subscribe arg order in user-service `profiles.service.ts`
- [x] Fixed enum literal narrowing (`as SagaState`, `as AnchorStatus`) in certificate + saga services
- [x] Removed `output: 'standalone'` from `next.config.js` (Windows symlink issue)
- [x] Added `@types/uuid` to 6 services, fixed `jwt.sign expiresIn` type
- [x] Category auto-seeding via `CategoriesService.onModuleInit()` (10 default categories)

**E2E verified:** register → create listings → make offer → accept → `trade.accepted` via RabbitMQ → trade created in trade-service → all 7 queues active with consumers

---

## Phase 2 — Full State Machine + Risk (COMPLETE)

### Trade State Machine
- [x] Full 15-transition state machine (`transitions.ts`) with typed guards and side effects
- [x] `INITIATED` start state changed to `ACCEPTED` when trade is created from an accepted offer (offer negotiation already happened in offer-service)
- [x] `cancel` transitions added from `LOCKED`, `PROOF_SUBMITTED`, `UNDER_VERIFICATION` (for timeout scheduler)
- [x] Removed time guard from `dispute_window_expired` (scheduler enforces timing; manual complete for admin)
- [x] `getAvailableTransitions()` returned on every `GET /trades/:id` response

### Trade Endpoints (all implemented)
| Endpoint | State Transition |
|---|---|
| `POST /trades/:id/lock` | `ACCEPTED → LOCKED` (Redis distributed lock + DB audit) |
| `POST /trades/:id/submit-proof` | `LOCKED → PROOF_SUBMITTED` (both parties, or LOW risk single party) |
| `POST /trades/:id/begin-verification` | `PROOF_SUBMITTED → UNDER_VERIFICATION` (MEDIUM/HIGH only) |
| `POST /trades/:id/verify` | `UNDER_VERIFICATION → VERIFIED` (sets `disputeWindowEnd`) |
| `POST /trades/:id/complete` | `VERIFIED → COMPLETED` (manual admin/scheduler) |
| `POST /trades/:id/dispute` | `VERIFIED → DISPUTE_OPEN` (with `reason`/`description`) |
| `POST /trades/:id/cancel` | any non-terminal → `CANCELLED` |
| `GET /trades/:id/events` | full event sourcing log |

### Risk Assessment (live HTTP calls)
- [x] `ExternalDataService` — HTTP calls to listing-service (`/listings/:id`, `/categories/:id`) and user-service (`/profiles/:userId/trust`), with graceful fallbacks
- [x] Risk formula: `(categoryWeight×0.3) + (valueScore×0.3) + (reputationPenalty×0.25) + (disputeHistory×0.15)`
- [x] Risk levels: LOW < 0.3, MEDIUM < 0.6, HIGH ≥ 0.6
- [x] LOW risk trades auto-verify after first proof submission (skip `UNDER_VERIFICATION`)

### Timeout Scheduler
- [x] `@Cron(EVERY_MINUTE)` polling on `timeout_at < NOW()` for all non-terminal trades
- [x] `VERIFIED` timeout → `completeTrade()` (dispute window expired)
- [x] All other states → `cancelTrade('system')` with system bypass on party-membership check

### Proof Packages
- [x] SHA-256 hash of combined item hashes stored as `packageHash`
- [x] Separate proof packages per party (partyA + partyB tracked with `proofASubmitted`/`proofBSubmitted`)

**E2E verified:**
- MEDIUM risk: `ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED → COMPLETED` ✓
- LOW risk: `ACCEPTED → LOCKED → VERIFIED → COMPLETED` (auto-verify on single proof) ✓

---

## Phase 3 — Escrow + Dispute + Reputation (COMPLETE)

### Outbox Publisher (Critical Fix)
- [x] `OutboxService` now implements `OnApplicationBootstrap` / `OnApplicationShutdown`
- [x] Polling starts automatically at **2-second intervals** in every service that imports `OutboxModule`
- [x] This enables all inter-service events: `trade.locked` → listing-service locks listings, `trade.completed` → reputation-service enables ratings, etc.

### Dispute Service (Fully Wired)
- [x] `onModuleInit` handler creates a real `DisputeEntity` record when `trade.dispute_opened` fires (idempotent — skips duplicates)
- [x] Fixed `@Get('open')` controller ordering (static routes before `:id` to avoid routing collision)
- [x] Full dispute lifecycle: open → evidence upload → moderator action → resolve
- [x] Resolution publishes `dispute.resolved` → trade-service picks up and transitions to `COMPLETED` or `REVOKED`
- [x] Trade `openDispute` accepts and forwards `reason`/`description` in outbox payload

### Reputation Service (Fully Wired)
- [x] `CompletedTradeEntity` — records `tradeId`, `partyAId`, `partyBId`, `riskLevel` when `trade.completed` fires
- [x] `submitRating()` validates: trade must be in `completed_trades`, rater must be a party to the trade
- [x] Trust score recalculated after each rating (algorithm: base 20pts + rating 40pts + volume 20pts + consistency 20pts − whitewash penalty)

### Auth Service — Moderator Support

- [x] `POST /auth/register/moderator` (dev endpoint) — creates a `role: 'moderator'` account
- [x] `UsersService.create()` accepts optional `role` parameter
- [x] `JwtAuthGuard` enforces `@Roles()` metadata, `JwtPayload` carries role in token

### Fixed: `resolveFromDispute` Payload
- [x] `trade.completed` outbox payload now includes `partyAId`, `partyBId`, `listingAId`, `listingBId`, `riskLevel` (was missing; reputation-service couldn't validate party membership)

**E2E verified (full dispute lifecycle):**
```
ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED
→ DISPUTE_OPEN  (Alice opens dispute: item_mismatch)
→ dispute-service creates record automatically via RabbitMQ
→ Alice uploads evidence photo
→ Moderator adds review action
→ Moderator resolves → completed
→ COMPLETED  (trade-service picks up dispute.resolved)
→ Reputation-service enables ratings
→ Alice rates Bob 4/5, Bob rates Alice 3/5  ✓
→ Trust scores updated (Bob avg=4, Alice avg=3)  ✓
```
8 trade events in event log, all services communicating via RabbitMQ + outbox pattern ✓

---

## Phase 4 — Blockchain + Certificates (COMPLETE)

### Certificate Issuance (Fully Wired)
- [x] **`trade.verified` → certificate-service**: subscription already existed; fixed outbox payload to include `proofHashA`, `proofHashB`, `listingAId`, `listingBId` (was missing — certificates couldn't be issued)
- [x] **Certificate issuance**: `CERT-YYYY-NNNNNN` human-readable IDs, SHA-256 combined proof hash, idempotency guard (skips if already issued for trade), issues 2 certificates per MEDIUM/HIGH trade (one per party)
- [x] **Certificate counter persistence**: `certCounter` now initialized from DB on service startup (was in-memory only — would collide on restart)

### Merkle Tree & Blockchain Anchoring
- [x] **Merkle tree daily batch**: `@Cron(EVERY_DAY_AT_MIDNIGHT)` collects unanchored certificates, builds Merkle tree, stores root + leaves in DB, links each certificate to its leaf index
- [x] **Sepolia anchoring**: `@Cron(EVERY_HOUR)` anchors pending trees via ethers.js; `MerkleAnchor.sol` contract prevents duplicate anchoring
- [x] **Blockchain simulation mode**: falls back to fake `0xSIM_...` tx hash when `SEPOLIA_RPC_URL`/`SEPOLIA_PRIVATE_KEY` not configured

### Certificate API Endpoints
- [x] `GET /certificates` — list authenticated user's own certificates (by ownerUserId)
- [x] `GET /certificates/:id` — get certificate by certificateId
- [x] `GET /certificates/:id/proof` — Merkle inclusion proof with direction-annotated path, anchor details (txHash, blockNumber, network, anchorStatus)
- [x] `GET /certificates/:id/verify` — integrity check (proofHash, anchoring status, merkleTreeId, leafIndex)
- [x] `GET /certificates/trade/:tradeId` — all certificates for a trade
- [x] `POST /certificates/:id/transfer` — ownership transfer with audit trail (`ownership_transfers` table)
- [x] `POST /certificates/:id/revoke` — revoke certificate, sets `revokedAt`

### Frontend Certificate Viewer
- [x] **`/certificates/[id]` page**: certificate details (certificateId, status, tradeId, listingId, ownerUserId, issuedAt, proofHash), blockchain anchor section (status badge, merkleRoot, txHash with Etherscan link for real txs, blockNumber, network), Merkle inclusion proof path (direction-annotated steps)
- [x] **Trade detail page integration**: certificates section appears automatically when trade reaches VERIFIED or COMPLETED state, links to `/certificates/[id]`
- [x] **`certificatesApi` helper**: added to `frontend/src/lib/api.ts`

**E2E verified (build):** All three affected build targets pass with zero TypeScript errors:
- `@exchange/trade-service` build ✓
- `@exchange/certificate-service` build ✓
- `@exchange/frontend` build ✓ (10 pages including new `/certificates/[id]`)

**E2E runtime flow (MEDIUM/HIGH risk trade):**
```
POST /trades/:id/verify (moderator) → VERIFIED
  → outbox fires trade.verified { proofHashA, proofHashB, listingAId, listingBId, riskLevel, ... }
  → certificate-service receives event, issues 2 certificates (CERT-YYYY-NNNNNN)
GET /certificates/trade/:tradeId → both certificates listed
GET /certificates/:id → certificate details
[midnight cron] → Merkle tree built, each cert gets merkleTreeId + leafIndex
[hourly cron]   → blockchain anchored (simulation: fake 0xSIM_... hash)
GET /certificates/:id/proof → { anchored: true, merkleRoot, proof: [{hash, direction}], txHash, ... }
Frontend /trades/:id → shows "Certificates" section with links
Frontend /certificates/:id → full viewer with Merkle proof display
```

---

## Phase 5 — Admin Panel + Auth Hardening (COMPLETE)

### Separate Admin Frontend
- [x] **`admin-frontend/`** — Completely separate Next.js 14 app at port 4001 (zero shared code with user frontend)
- [x] Amber color theme, admin-only nav: Dashboard, Verifications, Disputes, Users
- [x] Admin pages: dashboard (stats), verifications queue (list + full detail with proof viewer), disputes (list + resolution form), user management (list + delete)
- [x] `admin-frontend/src/lib/api.ts` — admin-only API client (no user-facing APIs)
- [x] Own `Dockerfile`, `package.json`, pnpm workspace entry — independently deployable
- [x] `docker-compose.yml` updated: admin-frontend service uses `admin-frontend/Dockerfile`, port `4001:4001`
- [x] Root cause of original bug: browser cookies are port-agnostic (`localhost:4001` cookie visible on `localhost:4000`). Solved by complete codebase separation.

### User Frontend Cleanup
- [x] All `/admin/*` pages removed from `frontend/`
- [x] `frontend/src/middleware.ts` — reverted to simple passthrough (no admin logic)
- [x] `frontend/src/app/layout.tsx` — user-only dark navy nav (no admin references)
- [x] Login redirect restored to simple `window.location.replace('/dashboard')`

### Email Verification (Gmail SMTP)
- [x] **`VerificationTokenEntity`** (`verification_tokens` table) — token (UUID, unique), userId (FK), expiresAt (24h), used (bool)
- [x] **`EmailService`** (`services/auth-service/src/email/`) — nodemailer + Gmail SMTP (`smtp.gmail.com:587`). Falls back to console logging if `SMTP_USER`/`SMTP_PASS` not set.
- [x] **Registration changed**: no longer auto-logs in. Returns `{ message, userId }`, sends HTML verification email with link `{FRONTEND_URL}/verify-email?token={uuid}`
- [x] **Login enforces verification**: rejects with `401 'Email not verified...'` if `isVerified = false`
- [x] **`GET /auth/verify-email?token=xxx`** — validates + marks used + marks user verified + returns tokens (auto-login)
- [x] **`POST /auth/resend-verification`** — creates new token, sends new email
- [x] Gmail SMTP configured in `.env` (`SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL`), passed via `docker-compose.yml` env
- [x] 500 emails/day free limit — sufficient for verification use case

### Frontend Auth Pages
- [x] **`/register`** — after success shows "Check your email" card with resend button (no auto-login)
- [x] **`/verify-email?token=xxx`** — new page: calls backend, shows loading/success/error states, on success sets tokens and redirects to dashboard
- [x] **`/login`** — detects "not verified" error, shows "Resend verification email" button inline
- [x] **`authApi`** updated: `register()` return type changed to `{ message, userId }`, added `verifyEmail(token)` and `resendVerification(email)` methods

### Session Isolation Fix
- [x] **`clearTokens()`** now calls `localStorage.clear()` — wipes all cached per-user data (was only removing 3 keys)
- [x] **All auth redirects** use `window.location.replace()` instead of `window.location.href` — prevents back-button returning to stale authenticated pages
- [x] **Profile page `useEffect`** depends on `currentUserId` (extracted before effect) — re-fetches if account switches
- [x] **Dashboard page `useEffect`** same fix — depends on `currentUserId`

**E2E verified:**
```
Register new account → "Check your email" shown (not logged in)
→ Verification email arrives in Gmail inbox
→ Click link → /verify-email?token=xxx → verified + auto-logged in → /dashboard
→ Unverified login attempt → "Email not verified" + resend button
→ Existing accounts: grandfathered with SQL UPDATE users SET is_verified = true
```

---

## Phase 6 — Shipping & Payment Services (COMPLETE)

### Shipping Service (port 3009)
- [x] **Multi-carrier provider abstraction** — `CarrierProviderService` routes by origin/destination country
- [x] **GeliverProvider** — Turkish domestic carriers (Yurtiçi, Aras, MNG, PTT, Sürat, HepsiJet, Kolay Gelsin) via Geliver SDK
- [x] **EasyPostProvider** — International carriers (FedEx, UPS, DHL) in simulation mode with realistic rates
- [x] **ESM-only SDK handling** — `new Function('specifier', 'return import(specifier)')` pattern for `@geliver/sdk`
- [x] **Endpoints**: create shipment, get rates, buy label, tracking, simulate progress (dev), dual webhooks (Geliver + EasyPost)
- [x] **Trade flow integration** — shipping events (`label_created`, `in_transit`, `delivered`) drive trade state transitions via RabbitMQ
- [x] Docker: `postgres-shipping` (port 5441), service container on port 3009

### Payment Service (port 3010)
- [x] **Stripe integration** with full simulation mode when `STRIPE_SECRET_KEY` not configured
- [x] **Trade payments** — per-party payments with `partyAPaid`/`partyBPaid` tracking on trade entity
- [x] **Listing boost payments** — featured (7 days / $4.99) and spotlight (30 days / $14.99) tiers
- [x] **Endpoints**: create boost, checkout (Stripe or simulation), simulate payment (dev), webhook
- [x] **Event publishing**: `payment.succeeded` (with tradeId for trade payments) + `payment.boost.succeeded` (for listing boosts)
- [x] Docker: `postgres-payment` (port 5442), service container on port 3010

### Trade State Machine Extensions
- [x] **Shipping states**: `VERIFIED → AWAITING_SHIPMENT → IN_TRANSIT → DELIVERED → COMPLETED`
- [x] **Shipping method selection**: `POST /trades/:id/set-shipping-method` (shipping or local_pickup)
- [x] **Address submission**: `POST /trades/:id/submit-address` — both parties submit addresses
- [x] **Local pickup confirmation**: `POST /trades/:id/confirm-local-pickup`
- [x] **Payment event handling**: trade-service subscribes to `payment.succeeded`, skips boost payments (no tradeId)
- [x] **Catch-up logic**: if DELIVERED event arrives before IN_TRANSIT, fast-forwards through intermediate states

### Listing Boost Feature
- [x] **`POST /listings/:id/boost`** — triggers boost payment creation via HTTP call to payment-service
- [x] **`GET /listings/spotlight`** — returns spotlight-featured listings (sorted by featured_until)
- [x] **Featured sorting** — boosted listings appear first in browse results (in-memory sort after query)
- [x] **Boost activation** — listing-service subscribes to `payment.boost.succeeded`, sets `isFeatured`/`isSpotlight` + `featuredUntil`
- [x] **Boost config**: `BOOST_CONFIG = { featured: { days: 7, price: 4.99 }, spotlight: { days: 30, price: 14.99 } }`

### Frontend Updates
- [x] Trade detail page: full action buttons wired to API (lock, submit-proof, verify, dispute, cancel)
- [x] Proof submission form with file upload + SHA-256 hash
- [x] Dispute filing with reason selector
- [x] Shipping method selection + address submission modals
- [x] Payment flow (simulation mode)
- [x] Listing Q&A section, favorites, boost buttons

**E2E verified:**
```
Full shipping flow: VERIFIED → set shipping method → submit addresses → both parties pay
  → AWAITING_SHIPMENT → buy labels → IN_TRANSIT → DELIVERED → COMPLETED
Boost flow: POST /listings/:id/boost → payment created → simulate payment
  → payment.boost.succeeded → listing featured for 7/30 days
```

---

## Phase 7 — Real Blockchain Integration (COMPLETE)

### Sepolia Deployment
- [x] **MerkleAnchor.sol deployed** to Sepolia testnet at `0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3`
- [x] **Deployment script** — `scripts/deploy-merkle-anchor.ts` compiles with solc and deploys via ethers.js
- [x] **Real on-chain anchoring** — certificate-service connects to Sepolia via Infura RPC, signs transactions with deployer private key
- [x] **Manual anchor endpoint** — `POST /certificates/anchor` (public) triggers `buildAndAnchor()` immediately, bypassing cron schedule
- [x] **Circular dependency fix** — `forwardRef()` in CertificatesModule ↔ MerkleModule ↔ BlockchainModule

### Environment Configuration
```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/{YOUR_KEY}
SEPOLIA_PRIVATE_KEY={deployer_private_key_no_0x_prefix}
MERKLE_ANCHOR_CONTRACT_ADDRESS=0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3
```

**E2E verified:**
```
Admin verifies trade proofs → certificates issued
POST /certificates/anchor → Merkle tree built → root anchored to Sepolia
Real transaction: 0xe9811d230abf2d5e3145aeb5d05c6da1be35b50f66ab68141df9b3220386b505
Etherscan: https://sepolia.etherscan.io/address/0xCF72FE0b40c8bbf4be48B905c20f0d1A0BcD33F3
```

---

## Phase 8 — Cloudflare R2 Storage Migration (COMPLETE)

### Problem
All file uploads (listing images, avatars, trade proofs) were stored inside container filesystems. Container rebuild = all images lost. No backups, can't scale, dispute evidence could vanish.

### Solution — Cloudflare R2
- [x] **StorageModule** — `packages/common/src/storage/` — reusable NestJS module (`StorageModule.forRoot()`, global: true)
- [x] **StorageService** — `@aws-sdk/client-s3` pointed at R2's S3-compatible endpoint, with local disk fallback
- [x] **Three services migrated**: listing-service (images), trade-service (proofs), user-service (avatars)
- [x] **Multer changed**: `diskStorage` → `memoryStorage()` (files arrive as Buffer, upload to R2 directly)
- [x] **Upload returns absolute URLs**: `https://pub-xxx.r2.dev/listings/uuid.jpg` (or empty for local fallback)
- [x] **Backward compatible**: old relative URLs in DB still work via fallback serve endpoints that check Docker volumes
- [x] **Zero frontend code changes**: `getImageUrl()` already handles absolute vs relative URLs

### Environment Configuration
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=exchange-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

### Bug Fixes During Migration
- [x] **Trade-service payment event loop** — boost payments publish `payment.succeeded` with `tradeId: null`; trade-service handler now skips events without tradeId
- [x] **Trade event INSERT** — changed from `tradeId` (message param, potentially null) to `trade.id` (entity field, always valid)

**E2E verified:**
```
R2 env vars set → all 3 services log "R2 storage enabled"
R2 env vars absent → all 3 services log "falling back to local disk storage"
Upload listing image → URL returned as https://pub-xxx.r2.dev/listings/uuid.jpg
Old images in Docker volumes → still served via fallback endpoints
```

---

## Phase 9 — Branding, UX & Internationalization (COMPLETE)

### Branding
- [x] Renamed platform from "Exchange" to **Takasla**
- [x] Updated all logos, page titles, and branding references
- [x] Fixed remaining "Ex" logo on login/register pages

### UX Improvements
- [x] **Listing Q&A** — Threaded conversations with "See All" pattern, clickable seller profiles with avatars
- [x] **Image handling** — Smaller thumbnails with click-to-expand lightbox, frontend image compression before upload
- [x] **Mobile stepper** — Fixed mobile-friendly step progression in trade flow
- [x] **Volume mounts** — Fixed to match `uploads-fallback/` path convention

### Internationalization
- [x] Turkish + English translations (`frontend/src/locales/{en,tr}.json`, ~44KB each)
- [x] Translated statuses, events, categories, and UI strings
- [x] Language toggle component with localStorage persistence
- [x] Fixed missing `useTranslation` in MarketingHome component

---

## Phase 10 — Email Service Migration (COMPLETE)

### Gmail SMTP → Resend → Brevo
- [x] Initial email: Gmail SMTP via Nodemailer
- [x] Made verification email non-blocking to prevent registration hang
- [x] Switched to Resend HTTP API (better deliverability)
- [x] Switched to **Brevo HTTP API** (final, better free tier: 300 emails/day)
- [x] Auth-service `EmailService` uses Brevo as primary, SMTP as fallback
- [x] Falls back to console logging if neither configured

---

## Phase 11 — Listing Reports & Moderation (COMPLETE)

### Listing Report System
- [x] **ListingReportEntity** — users can report listings with reason + description
- [x] `POST /listings/:id/report` — submit a report (idempotent per user per listing)
- [x] Fixed `ReportReason` type casting in `createReport`
- [x] Registered `ListingReportEntity` in DatabaseModule entities

### Admin Moderation Panel
- [x] `/admin/reports` — listing reports page with inline previews and moderation actions
- [x] Full listing card preview and warning history in admin reports
- [x] Revamped admin reports page with action buttons (warn, suspend, delete listing, ban user)

---

## Phase 12 — AI Moderation & User Safety (COMPLETE)

### Banned Emails
- [x] **BannedEmailEntity** — stores banned user emails to prevent re-registration
- [x] Registration checks `banned_emails` table before creating account
- [x] Ban user action adds email to banned list

### SightEngine AI Detection
- [x] **SightEngineModule/Service** in `packages/common/src/sightengine/`
- [x] Detects AI-generated/synthetic images in listing uploads and trade proof submissions
- [x] Configured via `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET`
- [x] Falls back to no-op if credentials not set

### Moderation Actions & Email Notifications
- [x] Admin fraud flags page: moderation action buttons (warn, ban, clear flag)
- [x] Email notifications for ALL moderation actions (ban, warning, dispute resolution, fraud flags)
- [x] Uses Brevo HTTP API for notification emails

---

## Phase 13 — KVKK Compliance (COMPLETE)

### Legal Pages
- [x] `/kvkk` — KVKK Aydinlatma Metni (Data Processing Notice per Article 10)
- [x] `/privacy` — Gizlilik Politikasi (Privacy Policy)
- [x] `/terms` — Kullanim Kosullari (Terms of Service)
- [x] Footer links to all legal pages in `layout.tsx`

### Registration Consent
- [x] Two separate checkboxes at registration (KVKK Board Decision 2018/90):
  1. KVKK acknowledgment (mandatory, links to `/kvkk`)
  2. Terms + Privacy acceptance (mandatory, links to `/terms` and `/privacy`)
- [x] `consentedAt` (TIMESTAMPTZ) and `consentVersion` (VARCHAR) added to UserEntity
- [x] `kvkkConsent` + `termsConsent` fields in RegisterDto (must be `true`)
- [x] Backend validates both consents before creating user

### Data Rights (Article 11)
- [x] `GET /auth/my-data` — exports all user data as JSON (profiles, addresses, listings, trades)
- [x] User deletion cascade via `auth.user.deleted` RabbitMQ event → all services clean up

### User Deletion Cascade
- [x] Each service has `src/cleanup/user-cleanup.listener.ts`:
  - user-service: delete profile, addresses, avatar
  - listing-service: archive listings, delete favorites/reports/questions
  - offer-service: delete all offers
  - trade-service: anonymize addresses
  - reputation-service: delete trust score, anonymize ratings
  - dispute-service: anonymize disputes
  - shipping-service: anonymize shipments
  - payment-service: anonymize payments

### EXIF Stripping (Image Privacy)
- [x] `sharp` added to `@exchange/common`
- [x] `StorageService.upload()` strips EXIF/GPS metadata from images before R2 upload
- [x] Applied automatically to all uploads (listings, proofs, avatars) at storage layer

### Data Retention Schedulers
- [x] auth-service: weekly cleanup of expired/revoked tokens
- [x] trade-service: monthly anonymization of addresses in trades >2 years old
- [x] dispute-service: monthly anonymization of PII in disputes >2 years old

---

## Phase 14 — Production Deployment (COMPLETE)

### Server Setup
- [x] DigitalOcean droplet: `134.209.198.150` (4 vCPU, 8 GB RAM, Ubuntu 22.04)
- [x] DuckDNS domains: `takasla.duckdns.org` + `takasla-admin.duckdns.org`
- [x] Caddy reverse proxy with auto-TLS (Let's Encrypt)
- [x] All 29 containers running (12 services + 2 frontends + 11 postgres + redis + rabbitmq + caddy + db-backup)

### Deployment Workflow
- [x] `scripts/deploy.sh` — git pull, Caddyfile generation, Docker build, health checks
- [x] `scripts/setup-server.sh` — one-time server setup (Docker, swap, firewall, DuckDNS)
- [x] `docker-compose.prod.yml` — production overrides: `TYPEORM_SYNCHRONIZE=false`, memory limits
- [x] Automatic database backups every 6 hours via `db-backup` container

### Post-Deployment Fixes
- [x] Fixed: auth-service crash from missing `consented_at`/`consent_version` columns (manual ALTER TABLE)
- [x] Fixed: admin panel 404 — added `/api/*` proxy route to admin domain in Caddyfile.prod
- [x] Fixed: offer-service Redis connection errors — added missing REDIS_HOST/REDIS_PORT env vars

---

## What Comes Next

### Testing + Evaluation
- [ ] Unit tests — state machine (all transitions + guards)
- [ ] Unit tests — risk assessment formula boundary values
- [ ] Integration tests — happy paths (LOW, MEDIUM, HIGH risk full lifecycle)
- [ ] Integration tests — failure paths (saga compensation, idempotency, lock contention)
- [ ] Consistency tests — RabbitMQ downtime, outbox replay
- [ ] Metrics collection — trade completion rate, dispute rate, avg duration per risk level

### Quality & Production Readiness
- [ ] Request validation DTOs (class-validator) on all controller endpoints
- [ ] Swagger/OpenAPI documentation for each service
- [ ] Logging correlation IDs (trace across services)
- [ ] CI/CD pipeline (`.github/workflows/ci.yml`)
- [ ] Rate limiting per-user on trade endpoints
- [ ] EasyPost real API integration (currently simulation only)
- [ ] Real Iyzico integration (currently simulation only)
