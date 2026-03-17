 Context

 The platform currently ships items directly between users (peer-to-peer). This allows "ship a brick" scams — a scammer sends a
 wrong/fake item and keeps the correct item they received. The platform only holds platform fees in escrow, not item values, so
 refunding scam victims is limited.

 Solution: Convert to a StockX-style verification center model. Items ship to a physical verification center first, get authenticated
  by admin staff, and only then ship to the recipient. Items never go directly between users. This eliminates fake-item scams because
  items are inspected before delivery.

 Key user requirements:
 - Multiple verification centers around the country (stored in DB)
 - Users choose which center to ship to during the shipping step
 - Each item can go to a different center, verified by different admins
 - Do NOT ship item to recipient until BOTH items are verified at their centers
 - Applies to ALL shipping trades (local pickup remains direct)
 - Users pay for both shipping legs (to center + center to recipient)
 - Admin verification: approve/reject with photo evidence

 Current Flow (Direct P2P)

 VERIFIED → [set shipping, submit addresses, pay] → AWAITING_SHIPMENT → IN_TRANSIT → DELIVERED → COMPLETED
 - 2 shipments per trade: A→B, B→A
 - shipping.addresses_ready event triggers shipment creation in shipping-service

 New Flow (Center-Based)

 VERIFIED → [set shipping, select centers, submit addresses, pay]
   → SHIPPING_TO_CENTER         (both items shipping to their chosen centers)
   → AT_CENTER                  (both items arrived at centers)
   → CENTER_VERIFICATION        (admins inspecting items)
   → CENTER_VERIFIED            (BOTH items approved — hold gate)
   → SHIPPING_TO_RECIPIENTS     (items shipping from centers to recipients)
   → DELIVERED → COMPLETED
 - 4 shipments per trade: A→CenterX, B→CenterY (Leg 1), CenterX→B, CenterY→A (Leg 2)
 - Leg 2 shipments only created after BOTH items pass center verification

 ---
 Phase 1: Data Foundation [COMPLETED]

 1A. [x] New TradeState enum values — Added SHIPPING_TO_CENTER, AT_CENTER, CENTER_VERIFICATION, CENTER_VERIFIED, SHIPPING_TO_RECIPIENTS
 1B. [x] VerificationCenter entity — Created services/trade-service/src/centers/verification-center.entity.ts
 1C. [x] CenterVerification entity — Created services/trade-service/src/centers/center-verification.entity.ts
 1D. [x] Trade entity changes — Added centerAId, centerBId, itemAAtCenter, itemBAtCenter, itemACenterVerified, itemBCenterVerified
 1E. [x] Shipment entity changes — Added leg, centerId, legOrder columns
 1F. [x] Frontend type updates — Updated frontend/src/types/index.ts + admin-frontend/src/types/index.ts
 1G. [x] RabbitMQ constants — Added CENTER routing keys + TRADE_ON_CENTER, SHIPPING_ON_CENTER queues

 ---
 Phase 2: State Machine & Trade Service [COMPLETED]

 2A. [x] State machine transitions — Replaced direct shipping transitions with center-based flow in transitions.ts
 2B. [x] Trade service changes — Added selectCenter, handleItemAtCenter, handleCenterVerificationApproved/Rejected, handleLeg2InTransit/Delivered, checkAndPublishAddressesReady, leg-aware shipping event handling
 2C. [x] Shipping service changes — Leg-aware Leg 1 creation (user→center), Leg 2 creation via center.both_verified subscription, leg-aware checkAndNotify methods, center.item_received for Leg 1 delivery

 ---
 Phase 3: Centers Module (trade-service) [COMPLETED]

 3A. [x] Centers CRUD — CentersService with findAll, findById, create, update, deactivate + CentersController
 3B. [x] Center Verification endpoints — receive, approve, reject, pending list, upload photos
 3C. [x] API Gateway proxy — Added centers → trade-service:3005 in SERVICE_MAP
 3D. [x] Seed data — 4 Turkish cities (Istanbul Kadikoy, Istanbul Besiktas, Ankara Cankaya, Izmir Konak)

 ---
 Phase 4: Frontend Changes [COMPLETED]

 4A. [x] Trade detail page — Center selection UI with radio buttons, center verification status display, updated progress timeline with center states, leg-grouped shipment display (Leg 1: To Center, Leg 2: To Recipient)
 4B. [x] API client updates — Added centersApi.list(), centersApi.getById(), tradesApi.selectCenter()

 ---
 Phase 5: Admin Frontend Changes [COMPLETED]

 5A. [x] Center management page — admin-frontend/src/app/admin/centers/page.tsx (list, create, edit centers)
 5B. [x] Center verification queue — admin-frontend/src/app/admin/center-verifications/page.tsx (pending list with center names)
 5C. [x] Center verification detail — admin-frontend/src/app/admin/center-verifications/[id]/page.tsx (item info, mark received, approve, reject)
 5D. [x] Admin API client — Added centersApi + centerVerificationsApi to admin-frontend/src/lib/api.ts
 5E. [x] Admin nav — Added "Centers" and "Center Queue" links to layout.tsx

 ---
 Phase 6: Rejection Handling [COMPLETED]

 [x] Trade transitions to CANCELLED on center verification rejection
 [x] Rejection event published with trade/center details for shipping-service
 [x] Shipping-service subscribes to center.verification_rejected → creates return shipments (center → original sender)
 [x] Return shipments use leg='return', legOrder=3
 [x] Rejection reason and photos stored on CenterVerification entity

 ---
 Files Created

 [x] services/trade-service/src/centers/verification-center.entity.ts
 [x] services/trade-service/src/centers/center-verification.entity.ts
 [x] services/trade-service/src/centers/centers.module.ts
 [x] services/trade-service/src/centers/centers.service.ts
 [x] services/trade-service/src/centers/centers.controller.ts
 [x] admin-frontend/src/app/admin/centers/page.tsx
 [x] admin-frontend/src/app/admin/center-verifications/page.tsx
 [x] admin-frontend/src/app/admin/center-verifications/[id]/page.tsx

 Files Modified

 [x] packages/shared-types/src/enums/trade-state.enum.ts — Added 5 new states
 [x] packages/shared-types/src/constants/rabbitmq.constants.ts — Added center routing keys + queues
 [x] services/trade-service/src/trades/trade.entity.ts — Added center + verification tracking columns
 [x] services/trade-service/src/trades/trades.service.ts — Center selection, verification handlers, leg-aware shipping
 [x] services/trade-service/src/state-machine/transitions.ts — Replaced direct shipping transitions with center flow
 [x] services/trade-service/src/trades/trades.module.ts — Import CentersModule + center entities
 [x] services/trade-service/src/app.module.ts — Added center entities + CentersModule
 [x] services/shipping-service/src/shipments/shipment.entity.ts — Added leg, centerId, legOrder columns
 [x] services/shipping-service/src/shipments/shipments.service.ts — Leg-aware shipment creation, center address handling, return shipments
 [x] services/api-gateway/src/proxy/proxy.controller.ts — Added centers proxy route
 [x] frontend/src/types/index.ts — Added new states, center fields, shipment leg fields
 [x] frontend/src/app/trades/[id]/page.tsx — Center selection UI, updated timeline, leg-grouped shipments
 [x] frontend/src/lib/api.ts — Added centers + center selection API methods
 [x] admin-frontend/src/types/index.ts — Added new states, center fields, VerificationCenter/CenterVerification types
 [x] admin-frontend/src/lib/api.ts — Added center management + verification API methods
 [x] admin-frontend/src/app/layout.tsx — Added Centers + Center Queue nav links

 Implementation Order

 1. [x] Phase 1 (Data) → 2. [x] Phase 2 (State machine + services) → 3. [x] Phase 3 (Centers module) → 4. [x] Phase 4 (Frontend) → 5. [x] Phase 5 (Admin frontend) → 6. [x] Phase 6 (Rejection handling)

 ALL PHASES COMPLETE.
