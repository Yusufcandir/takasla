#!/usr/bin/env node
/**
 * Comprehensive Trade Scenario Tester
 * Tests all possible trade flow paths to find bugs/logic errors
 */

const API = 'http://localhost:80/api';
const USERS = {
  A: { email: 'yusufcandir30@gmail.com', password: '123456', id: '01d672ab-9463-4cef-873e-a77a2c72abda' },
  B: { email: 'yusuf.cnd2002@gmail.com', password: '123456', id: 'ee86e2c8-1e9c-48e2-b268-957c1787062c' },
};
const ADMIN = { email: 'admin@exchange.com', password: 'admin123' };

const ADDRESS_A = {
  name: 'Test User A', street: 'Test Street 1', city: 'Istanbul', state: 'Istanbul',
  postalCode: '34000', country: 'Turkey', phone: '+905001234567', district: 'Kadikoy',
  countryCode: 'TR', stateCode: '34', cityCode: '34',
};
const ADDRESS_B = {
  name: 'Test User B', street: 'Test Street 2', city: 'Ankara', state: 'Ankara',
  postalCode: '06000', country: 'Turkey', phone: '+905009876543', district: 'Cankaya',
  countryCode: 'TR', stateCode: '06', cityCode: '06',
};

let tokenA, tokenB, tokenAdmin;
let tokenAExp = 0, tokenBExp = 0, tokenAdminExp = 0;
let centerIds = [];
let categoryId = null; // Will be fetched at startup
let results = [];
let scenarioNum = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(endpoint, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(`${API}${endpoint}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

function authReq(token, endpoint, opts = {}) {
  return req(endpoint, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
}

async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } });
  if (!r.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.accessToken;
}

// Smart token management — only re-login when token is about to expire (4 min lifetime)
const TOKEN_LIFETIME = 4 * 60 * 1000; // 4 minutes (JWT has 5 min, refresh before expiry)

async function ensureTokenA() {
  if (!tokenA || Date.now() > tokenAExp) {
    tokenA = await login(USERS.A.email, USERS.A.password);
    tokenAExp = Date.now() + TOKEN_LIFETIME;
  }
  return tokenA;
}

async function ensureTokenB() {
  if (!tokenB || Date.now() > tokenBExp) {
    tokenB = await login(USERS.B.email, USERS.B.password);
    tokenBExp = Date.now() + TOKEN_LIFETIME;
  }
  return tokenB;
}

async function ensureTokenAdmin() {
  if (!tokenAdmin || Date.now() > tokenAdminExp) {
    tokenAdmin = await login(ADMIN.email, ADMIN.password);
    tokenAdminExp = Date.now() + TOKEN_LIFETIME;
  }
  return tokenAdmin;
}

async function ensureAllTokens() {
  await ensureTokenA();
  await ensureTokenB();
  await ensureTokenAdmin();
}

// Create a listing for a user
async function createListing(token, title) {
  const r = await authReq(token, '/listings', {
    method: 'POST',
    body: {
      title,
      description: `Test listing for scenario: ${title}. This is a test item.`,
      currency: 'TRY',
      condition: 'good',
      categoryId: categoryId,
      imageUrls: ['https://via.placeholder.com/400x300.png?text=TestItem'],
    },
  });
  if (!r.ok) throw new Error(`Create listing failed: ${JSON.stringify(r.data)}`);
  return r.data.id;
}

// Create an offer (B offers their listing for A's listing)
async function createOffer(tokenOfferer, listingId, offeredListingId, listingOwnerId) {
  const r = await authReq(tokenOfferer, '/offers', {
    method: 'POST',
    body: { listingId, offeredListingId, listingOwnerId, message: 'Test offer' },
  });
  if (!r.ok) throw new Error(`Create offer failed: ${JSON.stringify(r.data)}`);
  return r.data.id;
}

// Accept an offer
async function acceptOffer(token, offerId) {
  const r = await authReq(token, `/offers/${offerId}/accept`, { method: 'POST', body: {} });
  if (!r.ok) throw new Error(`Accept offer failed: ${JSON.stringify(r.data)}`);
  return r.data;
}

// Find trade created from offer (GET /trades returns user's trades)
async function findTradeByOffer(token) {
  const r = await authReq(token, '/trades');
  if (!r.ok) throw new Error(`Get trades failed: ${JSON.stringify(r.data)}`);
  const trades = r.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return trades[0];
}

// Helper: create a trade (listing pair + offer + accept)
async function createTrade(scenarioName) {
  await ensureAllTokens();
  const listA = await createListing(tokenA, `A-${scenarioName}-${Date.now()}`);
  const listB = await createListing(tokenB, `B-${scenarioName}-${Date.now()}`);
  const offerId = await createOffer(tokenB, listA, listB, USERS.A.id);
  await acceptOffer(tokenA, offerId);

  // Poll for the new trade to appear (must be in ACCEPTED state with our listing IDs)
  let trade = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const r = await authReq(tokenB, '/trades');
    if (r.ok && Array.isArray(r.data)) {
      // Debug: log first iteration to see what we get
      if (i === 0) {
        const accepted = r.data.filter(t => t.state === 'ACCEPTED');
        console.log(`  [debug] Looking for listA=${listA.slice(0,8)}, listB=${listB.slice(0,8)} among ${accepted.length} ACCEPTED trades`);
      }
      trade = r.data.find(t =>
        t.state === 'ACCEPTED' &&
        ((t.listingAId === listA && t.listingBId === listB) || (t.listingAId === listB && t.listingBId === listA))
      );
      if (trade) break;
    }
  }
  if (!trade) throw new Error('Trade not found after accepting offer (timed out)');
  console.log(`  [setup] Trade ${trade.id.slice(0, 8)}... created in state ${trade.state}`);
  return { tradeId: trade.id, listA, listB };
}

// Lock items
async function lockItems(tradeId) {
  await ensureTokenA();
  return authReq(tokenA, `/trades/${tradeId}/lock`, { method: 'POST', body: {} });
}

// Submit proof
async function submitProof(token, tradeId) {
  const items = [
    { type: 'video', url: '/fake/video.mp4', hash: `hash_${Date.now()}_${Math.random()}` },
    { type: 'photo', url: '/fake/photo.jpg', hash: `hash_${Date.now()}_${Math.random()}` },
  ];
  return authReq(token, `/trades/${tradeId}/submit-proof`, { method: 'POST', body: { items, metadata: {} } });
}

// Admin: begin verification
async function beginVerification(tradeId) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/trades/${tradeId}/begin-verification`, { method: 'POST', body: {} });
}

// Admin: verify
async function verifyTrade(tradeId) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/trades/${tradeId}/verify`, { method: 'POST', body: {} });
}

// Admin: reject verification
async function rejectVerification(tradeId, reason) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/trades/${tradeId}/reject-verification`, { method: 'POST', body: { reason } });
}

// Set shipping method
async function setShippingMethod(token, tradeId, method) {
  return authReq(token, `/trades/${tradeId}/set-shipping-method`, { method: 'POST', body: { method } });
}

// Submit address (wrapped in { address: ... } as SubmitAddressDto expects)
async function submitAddress(token, tradeId, address) {
  return authReq(token, `/trades/${tradeId}/submit-address`, { method: 'POST', body: { address } });
}

// Select center
async function selectCenter(token, tradeId, centerId) {
  return authReq(token, `/trades/${tradeId}/select-center`, { method: 'POST', body: { centerId } });
}

// Pay for a trade — payments are auto-created by payment-service on trade.verified event
// We just need to find the user's payment and call checkout (auto-completes in sim mode)
async function simulatePayment(token, tradeId, userId) {
  // Wait and poll for payment records to appear
  let payment = null;
  for (let i = 0; i < 10; i++) {
    const r = await authReq(token, `/payments/trade/${tradeId}`);
    if (r.ok && Array.isArray(r.data)) {
      payment = r.data.find(p => p.userId === userId && p.status === 'pending');
      if (payment) break;
    }
    await sleep(1000);
  }
  if (!payment) return { ok: false, data: 'No pending payment found for user' };
  // Call checkout (auto-completes in simulation mode)
  return authReq(token, `/payments/${payment.id}/checkout`, { method: 'POST', body: {} });
}

// Get trade state
async function getTradeState(token, tradeId) {
  const r = await authReq(token, `/trades/${tradeId}`);
  return r.ok ? r.data.state : `ERROR: ${JSON.stringify(r.data)}`;
}

// Get full trade
async function getTrade(token, tradeId) {
  const r = await authReq(token, `/trades/${tradeId}`);
  return r.ok ? r.data : null;
}

// Cancel trade
async function cancelTrade(token, tradeId) {
  return authReq(token, `/trades/${tradeId}/cancel`, { method: 'POST', body: {} });
}

// Confirm receipt
async function confirmReceipt(token, tradeId) {
  return authReq(token, `/trades/${tradeId}/confirm-receipt`, { method: 'POST', body: {} });
}

// Open dispute
async function openDispute(token, tradeId, reason, description) {
  return authReq(token, `/trades/${tradeId}/dispute`, { method: 'POST', body: { reason, description } });
}

// Confirm local pickup
async function confirmLocalPickup(token, tradeId) {
  return authReq(token, `/trades/${tradeId}/confirm-local-pickup`, { method: 'POST', body: {} });
}

// Get shipments
async function getShipments(token, tradeId) {
  const r = await authReq(token, `/shipments/trade/${tradeId}`);
  return r.ok ? r.data : [];
}

// Buy label for shipment
async function buyLabel(token, shipmentId) {
  const ratesR = await authReq(token, `/shipments/${shipmentId}/rates`);
  if (!ratesR.ok || !ratesR.data.length) return { ok: false, data: 'No rates' };
  const rateId = ratesR.data[0].id;
  return authReq(token, `/shipments/${shipmentId}/buy-label`, { method: 'POST', body: { rateId } });
}

// Simulate shipment progress
async function simulateShipment(token, shipmentId) {
  return authReq(token, `/shipments/${shipmentId}/simulate-progress`, { method: 'POST', body: {} });
}

// Get center verifications for a trade
async function getCenterVerifications(tradeId) {
  await ensureTokenAdmin();
  const r = await authReq(tokenAdmin, `/centers/verifications/by-trade/${tradeId}`);
  return r.ok ? r.data : [];
}

// Admin: mark center verification received
async function markCenterReceived(verificationId) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/centers/verifications/${verificationId}/receive`, { method: 'POST', body: {} });
}

// Admin: approve center verification
async function approveCenterVerification(verificationId) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/centers/verifications/${verificationId}/approve`, {
    method: 'POST', body: { notes: 'Test approved', photoUrls: ['https://via.placeholder.com/400x300.png?text=Verified'] },
  });
}

// Admin: reject center verification
async function rejectCenterVerification(verificationId, reason) {
  await ensureTokenAdmin();
  return authReq(tokenAdmin, `/centers/verifications/${verificationId}/reject`, {
    method: 'POST', body: { reason, photoUrls: ['https://via.placeholder.com/400x300.png?text=Rejected'] },
  });
}

// ============================================================
// COMPOSITE DRIVERS
// ============================================================

// Drive trade from ACCEPTED to VERIFIED
async function driveToVerified(tradeId) {
  await ensureAllTokens();

  let r = await lockItems(tradeId);
  if (!r.ok) return { ok: false, step: 'lock', error: r.data };

  r = await submitProof(tokenA, tradeId);
  if (!r.ok) return { ok: false, step: 'proofA', error: r.data };

  r = await submitProof(tokenB, tradeId);
  if (!r.ok) return { ok: false, step: 'proofB', error: r.data };

  r = await beginVerification(tradeId);
  if (!r.ok) return { ok: false, step: 'beginVerification', error: r.data };

  r = await verifyTrade(tradeId);
  if (!r.ok) return { ok: false, step: 'verify', error: r.data };

  return { ok: true };
}

// Drive from VERIFIED to SHIPPING_TO_CENTER
async function driveToShipping(tradeId) {
  await ensureAllTokens();

  let r = await setShippingMethod(tokenA, tradeId, 'shipping');
  if (!r.ok) return { ok: false, step: 'shippingMethod', error: r.data };

  r = await selectCenter(tokenA, tradeId, centerIds[0]);
  if (!r.ok) return { ok: false, step: 'selectCenterA', error: r.data };
  r = await selectCenter(tokenB, tradeId, centerIds[1]);
  if (!r.ok) return { ok: false, step: 'selectCenterB', error: r.data };

  r = await submitAddress(tokenA, tradeId, ADDRESS_A);
  if (!r.ok) return { ok: false, step: 'addressA', error: r.data };
  r = await submitAddress(tokenB, tradeId, ADDRESS_B);
  if (!r.ok) return { ok: false, step: 'addressB', error: r.data };

  r = await simulatePayment(tokenA, tradeId, USERS.A.id);
  if (!r.ok) return { ok: false, step: 'payA', error: r.data };
  r = await simulatePayment(tokenB, tradeId, USERS.B.id);
  if (!r.ok) return { ok: false, step: 'payB', error: r.data };

  await sleep(3000); // Wait for events
  return { ok: true };
}

// Drive Leg 1 shipments through to delivery
async function driveLeg1Delivery(tradeId) {
  await ensureTokenA();
  const shipments = await getShipments(tokenA, tradeId);
  const leg1 = shipments.filter(s => s.legOrder === 1 || s.leg === 'to_center');

  for (const s of leg1) {
    if (s.status === 'PENDING') {
      const br = await buyLabel(tokenA, s.id);
      if (!br.ok) return { ok: false, step: `buyLabel-${s.id}`, error: br.data };
    }
  }

  // Simulate progress: LABEL_CREATED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
  for (let step = 0; step < 3; step++) {
    const currentShipments = await getShipments(tokenA, tradeId);
    const activeLeg1 = currentShipments.filter(s => (s.legOrder === 1 || s.leg === 'to_center') && s.status !== 'DELIVERED');
    for (const s of activeLeg1) {
      await simulateShipment(tokenA, s.id);
    }
    await sleep(1500);
  }

  await sleep(2000);
  return { ok: true };
}

// Drive center verification (both approved)
async function driveCenterApproval(tradeId) {
  await sleep(2000);
  await ensureTokenAdmin();

  const verifications = await getCenterVerifications(tradeId);
  if (verifications.length === 0) {
    return { ok: false, step: 'getCenterVerifications', error: 'No center verification records found' };
  }

  for (const v of verifications) {
    if (v.status === 'pending') {
      const r = await markCenterReceived(v.id);
      if (!r.ok) return { ok: false, step: `markReceived-${v.id}`, error: r.data };
    }
  }

  await sleep(1000);
  const updated = await getCenterVerifications(tradeId);

  for (const v of updated) {
    if (v.status === 'item_received' || v.status === 'inspecting') {
      const r = await approveCenterVerification(v.id);
      if (!r.ok) return { ok: false, step: `approve-${v.id}`, error: r.data };
    }
  }

  await sleep(3000); // Wait for events
  return { ok: true };
}

// Drive Leg 2 shipments through to delivery
async function driveLeg2Delivery(tradeId) {
  await sleep(2000);
  await ensureTokenA();
  const shipments = await getShipments(tokenA, tradeId);
  const leg2 = shipments.filter(s => s.legOrder === 2 || s.leg === 'to_recipient');

  if (leg2.length === 0) {
    return { ok: false, step: 'findLeg2', error: 'No Leg 2 shipments found' };
  }

  for (const s of leg2) {
    if (s.status === 'PENDING') {
      const br = await buyLabel(tokenA, s.id);
      if (!br.ok) return { ok: false, step: `buyLabelLeg2-${s.id}`, error: br.data };
    }
  }

  for (let step = 0; step < 3; step++) {
    const currentShipments = await getShipments(tokenA, tradeId);
    const activeLeg2 = currentShipments.filter(s => (s.legOrder === 2 || s.leg === 'to_recipient') && s.status !== 'DELIVERED');
    for (const s of activeLeg2) {
      await simulateShipment(tokenA, s.id);
    }
    await sleep(1500);
  }

  await sleep(2000);
  return { ok: true };
}

// Drive local pickup flow to DELIVERED
async function driveLocalPickupToDelivered(tradeId) {
  await ensureAllTokens();
  await setShippingMethod(tokenA, tradeId, 'local_pickup');
  await simulatePayment(tokenA, tradeId, USERS.A.id);
  await simulatePayment(tokenB, tradeId, USERS.B.id);
  await sleep(3000); // Wait for payment events to be processed via RabbitMQ
  await confirmLocalPickup(tokenA, tradeId);
  await confirmLocalPickup(tokenB, tradeId);
  await sleep(3000); // Wait for local pickup completion (may be triggered by payment handler)
}

function report(name, expected, actual, passed, details = '') {
  scenarioNum++;
  const icon = passed ? '✅' : '❌';
  const line = `${icon} #${scenarioNum} ${name}: expected=${expected}, actual=${actual}${details ? ` | ${details}` : ''}`;
  console.log(line);
  results.push({ num: scenarioNum, name, expected, actual, passed, details });
}

// ============================================================
// SCENARIO RUNNERS
// ============================================================

async function scenario_cancelAccepted() {
  const name = 'Cancel in ACCEPTED state';
  try {
    const { tradeId } = await createTrade('cancelAccepted');
    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'ACCEPTED') { report(name, 'CANCELLED', state, false, 'Not in ACCEPTED'); return; }

    await cancelTrade(tokenA, tradeId);
    state = await getTradeState(tokenA, tradeId);
    report(name, 'CANCELLED', state, state === 'CANCELLED');
  } catch (e) {
    report(name, 'CANCELLED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_cancelLocked() {
  const name = 'Cancel in LOCKED state';
  try {
    const { tradeId } = await createTrade('cancelLocked');
    await lockItems(tradeId);

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'LOCKED') { report(name, 'CANCELLED', state, false, `Expected LOCKED, got ${state}`); return; }

    await cancelTrade(tokenA, tradeId);
    state = await getTradeState(tokenA, tradeId);
    report(name, 'CANCELLED', state, state === 'CANCELLED');
  } catch (e) {
    report(name, 'CANCELLED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_cancelProofSubmitted() {
  const name = 'Cancel in PROOF_SUBMITTED state';
  try {
    const { tradeId } = await createTrade('cancelProof');
    await lockItems(tradeId);
    await ensureAllTokens();
    await submitProof(tokenA, tradeId);
    await submitProof(tokenB, tradeId);

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'PROOF_SUBMITTED') { report(name, 'CANCELLED', state, false, `Expected PROOF_SUBMITTED, got ${state}`); return; }

    await cancelTrade(tokenA, tradeId);
    state = await getTradeState(tokenA, tradeId);
    report(name, 'CANCELLED', state, state === 'CANCELLED');
  } catch (e) {
    report(name, 'CANCELLED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyOneProof() {
  const name = 'Edge: only one party submits proof → stays LOCKED';
  try {
    const { tradeId } = await createTrade('oneProof');
    await lockItems(tradeId);
    await ensureTokenA();
    await submitProof(tokenA, tradeId);

    let state = await getTradeState(tokenA, tradeId);
    report(name, 'LOCKED', state, state === 'LOCKED');
  } catch (e) {
    report(name, 'LOCKED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_proofRejected() {
  const name = 'Proof rejected → back to LOCKED → resubmit → verify';
  try {
    const { tradeId } = await createTrade('proofRejected');
    await lockItems(tradeId);
    await ensureAllTokens();
    await submitProof(tokenA, tradeId);
    await submitProof(tokenB, tradeId);
    await beginVerification(tradeId);

    await rejectVerification(tradeId, 'Poor quality proof photos');
    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'LOCKED') { report(name, 'VERIFIED', state, false, `After rejection expected LOCKED, got ${state}`); return; }

    // Resubmit proof
    await submitProof(tokenA, tradeId);
    await submitProof(tokenB, tradeId);
    await beginVerification(tradeId);
    await verifyTrade(tradeId);

    state = await getTradeState(tokenA, tradeId);
    report(name, 'VERIFIED', state, state === 'VERIFIED');
  } catch (e) {
    report(name, 'VERIFIED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyOneAddress() {
  const name = 'Edge: only one party submits address → stays VERIFIED';
  try {
    const { tradeId } = await createTrade('oneAddr');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'VERIFIED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await ensureAllTokens();
    await setShippingMethod(tokenA, tradeId, 'shipping');
    await selectCenter(tokenA, tradeId, centerIds[0]);
    await selectCenter(tokenB, tradeId, centerIds[1]);
    await submitAddress(tokenA, tradeId, ADDRESS_A);
    // Only A submits address
    await sleep(1000);

    let state = await getTradeState(tokenA, tradeId);
    report(name, 'VERIFIED', state, state === 'VERIFIED');
  } catch (e) {
    report(name, 'VERIFIED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyOneCenter() {
  const name = 'Edge: only one party selects center → stays VERIFIED';
  try {
    const { tradeId } = await createTrade('oneCenter');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'VERIFIED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await ensureAllTokens();
    await setShippingMethod(tokenA, tradeId, 'shipping');
    await selectCenter(tokenA, tradeId, centerIds[0]);
    // Only A selects center
    await submitAddress(tokenA, tradeId, ADDRESS_A);
    await submitAddress(tokenB, tradeId, ADDRESS_B);
    await simulatePayment(tokenA, tradeId, USERS.A.id);
    await simulatePayment(tokenB, tradeId, USERS.B.id);
    await sleep(2000);

    let state = await getTradeState(tokenA, tradeId);
    report(name, 'VERIFIED', state, state === 'VERIFIED');
  } catch (e) {
    report(name, 'VERIFIED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyOnePays() {
  const name = 'Edge: only one party pays → stays VERIFIED';
  try {
    const { tradeId } = await createTrade('onePay');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'VERIFIED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await ensureAllTokens();
    await setShippingMethod(tokenA, tradeId, 'shipping');
    await selectCenter(tokenA, tradeId, centerIds[0]);
    await selectCenter(tokenB, tradeId, centerIds[1]);
    await submitAddress(tokenA, tradeId, ADDRESS_A);
    await submitAddress(tokenB, tradeId, ADDRESS_B);
    // Only A pays
    await simulatePayment(tokenA, tradeId, USERS.A.id);
    await sleep(2000);

    let state = await getTradeState(tokenA, tradeId);
    report(name, 'VERIFIED', state, state === 'VERIFIED');
  } catch (e) {
    report(name, 'VERIFIED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_localPickup() {
  const name = 'Local pickup flow → DELIVERED → COMPLETED';
  try {
    const { tradeId } = await createTrade('localPickup');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'COMPLETED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await driveLocalPickupToDelivered(tradeId);

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'DELIVERED') { report(name, 'COMPLETED', state, false, 'After local pickup, not DELIVERED'); return; }

    // Both confirm receipt
    await confirmReceipt(tokenA, tradeId);
    await confirmReceipt(tokenB, tradeId);

    state = await getTradeState(tokenA, tradeId);
    report(name, 'COMPLETED', state, state === 'COMPLETED');
  } catch (e) {
    report(name, 'COMPLETED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyOneReceipt() {
  const name = 'Edge: only one party confirms receipt → stays DELIVERED';
  try {
    const { tradeId } = await createTrade('oneReceipt');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'DELIVERED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await driveLocalPickupToDelivered(tradeId);

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'DELIVERED') { report(name, 'DELIVERED', state, false, 'Not DELIVERED after local pickup'); return; }

    // Only A confirms receipt
    await confirmReceipt(tokenA, tradeId);

    state = await getTradeState(tokenA, tradeId);
    report(name, 'DELIVERED', state, state === 'DELIVERED');
  } catch (e) {
    report(name, 'DELIVERED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_disputeDelivered() {
  const name = 'Dispute in DELIVERED → DISPUTE_OPEN';
  try {
    const { tradeId } = await createTrade('disputeDelivered');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'DISPUTE_OPEN', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    await driveLocalPickupToDelivered(tradeId);

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'DELIVERED') { report(name, 'DISPUTE_OPEN', state, false, 'Not DELIVERED'); return; }

    const dispR = await openDispute(tokenA, tradeId, 'item_mismatch', 'Item does not match description');
    if (!dispR.ok) { report(name, 'DISPUTE_OPEN', 'DISPUTE_FAILED', false, JSON.stringify(dispR.data).slice(0, 100)); return; }

    state = await getTradeState(tokenA, tradeId);
    report(name, 'DISPUTE_OPEN', state, state === 'DISPUTE_OPEN');
  } catch (e) {
    report(name, 'DISPUTE_OPEN', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_happyPath() {
  const name = 'Happy path: full shipping → COMPLETED';
  try {
    const { tradeId } = await createTrade('happy');

    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'COMPLETED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    const shipRes = await driveToShipping(tradeId);
    if (!shipRes.ok) { report(name, 'COMPLETED', `FAILED at ${shipRes.step}`, false, JSON.stringify(shipRes.error).slice(0, 100)); return; }

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'SHIPPING_TO_CENTER') { report(name, 'COMPLETED', state, false, `After shipping setup, expected SHIPPING_TO_CENTER got ${state}`); return; }

    const leg1Res = await driveLeg1Delivery(tradeId);
    if (!leg1Res.ok) { report(name, 'COMPLETED', `FAILED at ${leg1Res.step}`, false, JSON.stringify(leg1Res.error).slice(0, 100)); return; }

    state = await getTradeState(tokenA, tradeId);
    if (!['AT_CENTER', 'CENTER_VERIFICATION'].includes(state)) {
      report(name, 'COMPLETED', state, false, `After Leg 1 delivery, expected AT_CENTER/CENTER_VERIFICATION got ${state}`);
      return;
    }

    const centerRes = await driveCenterApproval(tradeId);
    if (!centerRes.ok) { report(name, 'COMPLETED', `FAILED at ${centerRes.step}`, false, JSON.stringify(centerRes.error).slice(0, 100)); return; }

    state = await getTradeState(tokenA, tradeId);
    if (!['CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'].includes(state)) {
      report(name, 'COMPLETED', state, false, `After center approval, expected CENTER_VERIFIED/SHIPPING_TO_RECIPIENTS got ${state}`);
      return;
    }

    const leg2Res = await driveLeg2Delivery(tradeId);
    if (!leg2Res.ok) { report(name, 'COMPLETED', `FAILED at ${leg2Res.step}`, false, JSON.stringify(leg2Res.error).slice(0, 100)); return; }

    state = await getTradeState(tokenA, tradeId);
    if (state !== 'DELIVERED') { report(name, 'COMPLETED', state, false, `After Leg 2 delivery, expected DELIVERED got ${state}`); return; }

    await confirmReceipt(tokenA, tradeId);
    await confirmReceipt(tokenB, tradeId);

    state = await getTradeState(tokenA, tradeId);
    report(name, 'COMPLETED', state, state === 'COMPLETED');
  } catch (e) {
    report(name, 'COMPLETED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_cancelShippingToCenter() {
  const name = 'Cancel in SHIPPING_TO_CENTER state';
  try {
    const { tradeId } = await createTrade('cancelShipping');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'CANCELLED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    const shipRes = await driveToShipping(tradeId);
    if (!shipRes.ok) { report(name, 'CANCELLED', `FAILED at ${shipRes.step}`, false, JSON.stringify(shipRes.error).slice(0, 100)); return; }

    let state = await getTradeState(tokenA, tradeId);
    if (state !== 'SHIPPING_TO_CENTER') { report(name, 'CANCELLED', state, false, `Expected SHIPPING_TO_CENTER`); return; }

    await cancelTrade(tokenA, tradeId);
    state = await getTradeState(tokenA, tradeId);
    report(name, 'CANCELLED', state, state === 'CANCELLED');
  } catch (e) {
    report(name, 'CANCELLED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_centerRejection() {
  const name = 'Center verification rejected → CANCELLED';
  try {
    const { tradeId } = await createTrade('centerReject');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'CANCELLED', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    const shipRes = await driveToShipping(tradeId);
    if (!shipRes.ok) { report(name, 'CANCELLED', `FAILED at ${shipRes.step}`, false, JSON.stringify(shipRes.error).slice(0, 100)); return; }

    const leg1Res = await driveLeg1Delivery(tradeId);
    if (!leg1Res.ok) { report(name, 'CANCELLED', `FAILED at ${leg1Res.step}`, false, JSON.stringify(leg1Res.error).slice(0, 100)); return; }

    await sleep(2000);

    const verifications = await getCenterVerifications(tradeId);
    if (verifications.length < 2) { report(name, 'CANCELLED', 'NO_VERIFICATIONS', false, `Found ${verifications.length} verifications`); return; }

    for (const v of verifications) {
      if (v.status === 'pending') await markCenterReceived(v.id);
    }
    await sleep(1000);

    const updated = await getCenterVerifications(tradeId);
    const toReject = updated.find(v => v.status === 'item_received');
    if (toReject) {
      await rejectCenterVerification(toReject.id, 'Item is counterfeit');
    }

    await sleep(2000);
    let state = await getTradeState(tokenA, tradeId);
    report(name, 'CANCELLED', state, state === 'CANCELLED');
  } catch (e) {
    report(name, 'CANCELLED', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

async function scenario_onlyCenterApproved() {
  const name = 'Edge: only one item approved at center → stays CENTER_VERIFICATION';
  try {
    const { tradeId } = await createTrade('oneApprove');
    const verRes = await driveToVerified(tradeId);
    if (!verRes.ok) { report(name, 'CENTER_VERIFICATION', `FAILED at ${verRes.step}`, false, JSON.stringify(verRes.error).slice(0, 100)); return; }

    const shipRes = await driveToShipping(tradeId);
    if (!shipRes.ok) { report(name, 'CENTER_VERIFICATION', `FAILED at ${shipRes.step}`, false, JSON.stringify(shipRes.error).slice(0, 100)); return; }

    const leg1Res = await driveLeg1Delivery(tradeId);
    if (!leg1Res.ok) { report(name, 'CENTER_VERIFICATION', `FAILED at ${leg1Res.step}`, false, JSON.stringify(leg1Res.error).slice(0, 100)); return; }

    await sleep(2000);

    const verifications = await getCenterVerifications(tradeId);
    if (verifications.length < 2) { report(name, 'CENTER_VERIFICATION', 'NO_VERIFICATIONS', false); return; }

    for (const v of verifications) {
      if (v.status === 'pending') await markCenterReceived(v.id);
    }
    await sleep(1000);

    // Only approve first item
    const updated = await getCenterVerifications(tradeId);
    const toApprove = updated.find(v => v.status === 'item_received');
    if (toApprove) {
      await approveCenterVerification(toApprove.id);
    }

    await sleep(2000);
    let state = await getTradeState(tokenA, tradeId);
    report(name, 'CENTER_VERIFICATION', state, state === 'CENTER_VERIFICATION');
  } catch (e) {
    report(name, 'CENTER_VERIFICATION', 'EXCEPTION', false, e.message.slice(0, 150));
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== Trade Scenario Tester ===\n');

  // Login all users once
  try {
    await ensureAllTokens();
    console.log('✓ Logged in as User A, User B, and Admin');
  } catch (e) {
    console.error('FATAL: Cannot login:', e.message);
    process.exit(1);
  }

  // Get categories
  const catR = await req('/categories');
  if (catR.ok && catR.data.length > 0) {
    // Use a low-risk category for faster tests (less verification burden)
    const lowRisk = catR.data.find(c => c.slug === 'books-media') || catR.data[0];
    categoryId = lowRisk.id;
    console.log(`✓ Using category: ${lowRisk.name} (risk: ${lowRisk.riskWeight})`);
  } else {
    console.error('FATAL: No categories available');
    process.exit(1);
  }

  // Get centers
  const centersR = await req('/centers');
  if (centersR.ok && centersR.data.length > 0) {
    centerIds = centersR.data.map(c => c.id);
    console.log(`✓ Found ${centerIds.length} centers`);
  } else {
    console.error('FATAL: No centers available');
    process.exit(1);
  }

  console.log('\n--- Running scenarios ---\n');

  // Simple scenarios first (fast)
  await scenario_cancelAccepted();
  await scenario_cancelLocked();
  await scenario_cancelProofSubmitted();
  await scenario_onlyOneProof();
  await scenario_proofRejected();

  // Edge cases requiring VERIFIED state
  await scenario_onlyOneAddress();
  await scenario_onlyOneCenter();
  await scenario_onlyOnePays();

  // Local pickup scenarios
  await scenario_localPickup();
  await scenario_onlyOneReceipt();
  await scenario_disputeDelivered();

  // Full shipping scenarios (take longest)
  await scenario_happyPath();
  await scenario_cancelShippingToCenter();
  await scenario_centerRejection();
  await scenario_onlyCenterApproved();

  // Summary
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n--- FAILURES ---');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ❌ #${r.num} ${r.name}: expected=${r.expected}, got=${r.actual} ${r.details || ''}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
