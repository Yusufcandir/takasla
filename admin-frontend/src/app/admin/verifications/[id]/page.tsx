'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isModeratorOrAdmin } from '@/lib/auth';
import { tradesApi, adminApi, listingsApi, shippingApi, getImageUrl } from '@/lib/api';
import type { Trade, TradeEvent, ProofPackage, Listing, Shipment } from '@/types';

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-red-50 text-red-700',
};

function decodeTextProof(url: string): string {
  try {
    const b64 = url.replace('text://', '');
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return url;
  }
}

export default function VerificationDetailPage() {
  const params = useParams();
  const tradeId = params.id as string;

  const [trade, setTrade] = useState<(Trade & { availableActions?: string[] }) | null>(null);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [proofPackages, setProofPackages] = useState<ProofPackage[]>([]);
  const [listingA, setListingA] = useState<Listing | null>(null);
  const [listingB, setListingB] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(() => {
    Promise.all([
      tradesApi.getById(tradeId),
      tradesApi.getEvents(tradeId).catch(() => [] as TradeEvent[]),
      adminApi.getProofPackages(tradeId).catch(() => [] as ProofPackage[]),
    ]).then(([t, e, p]) => {
      setTrade(t);
      setEvents(e);
      setProofPackages(p);
      if (t.listingAId) listingsApi.getById(t.listingAId).then(setListingA).catch(() => {});
      if (t.listingBId) listingsApi.getById(t.listingBId).then(setListingB).catch(() => {});
      shippingApi.getByTrade(tradeId).then(setShipments).catch(() => setShipments([]));
    }).finally(() => setLoading(false));
  }, [tradeId]);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    loadData();
  }, [loadData]);

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionError('');
    setActionLoading(true);
    try {
      await action();
      loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) { setActionError('Please provide a reason for rejection.'); return; }
    await handleAction(() => adminApi.rejectVerification(tradeId, rejectReason));
    setShowRejectForm(false);
    setRejectReason('');
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-96 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Trade not found</h2>
        <Link href="/admin/verifications" className="btn-primary mt-4">Back to Queue</Link>
      </div>
    );
  }

  const proofA = proofPackages.find((p) => p.userId === trade.partyAId);
  const proofB = proofPackages.find((p) => p.userId === trade.partyBId);

  const renderProofItems = (proof: ProofPackage | undefined, label: string) => (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-3">{label}</h4>
      {!proof ? (
        <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400">No proof submitted yet</div>
      ) : (
        <div className="space-y-3">
          {proof.items.map((item, i) => (
            <div key={i} className="bg-slate-50 rounded-lg overflow-hidden">
              {item.type === 'photo' && <img src={getImageUrl(item.url)} alt={`Proof ${i + 1}`} className="w-full max-h-72 object-contain bg-white" />}
              {item.type === 'video' && <video src={getImageUrl(item.url)} controls className="w-full max-h-72 bg-black" />}
              {item.type === 'text' && <div className="p-3 bg-slate-50"><pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{decodeTextProof(item.url)}</pre></div>}
              <div className="px-3 py-2 flex items-center justify-between border-t border-slate-100">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${item.type === 'photo' ? 'bg-blue-50 text-blue-700' : item.type === 'video' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{item.type}</span>
                {item.hash && <span className="text-[10px] text-slate-400 font-mono">{item.hash.slice(0, 16)}...</span>}
              </div>
            </div>
          ))}
          <div className="text-xs text-slate-400">
            Submitted: {new Date(proof.submittedAt).toLocaleString()}
            {proof.packageHash && <> &middot; Package hash: <span className="font-mono">{proof.packageHash.slice(0, 16)}...</span></>}
          </div>
        </div>
      )}
    </div>
  );

  const renderListing = (listing: Listing | null, label: string) => (
    <div>
      <h4 className="text-xs font-medium text-slate-500 mb-2">{label}</h4>
      {listing ? (
        <div className="bg-slate-50 rounded-lg p-3">
          {listing.images && listing.images.length > 0 && <img src={getImageUrl(listing.images[0].url)} alt={listing.title} className="w-full h-32 object-cover rounded-md mb-2" />}
          <p className="text-sm font-medium text-slate-900">{listing.title}</p>
          <p className="text-xs text-slate-500">{listing.condition}{listing.category?.name ? ` · ${listing.category.name}` : ''}</p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-400">Loading...</div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/verifications" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Review Trade #{trade.id.slice(0, 8)}</h1>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${RISK_STYLES[trade.riskLevel] || ''}`}>{trade.riskLevel} RISK</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Trade Details</h2></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {renderListing(listingA, `Party A: ${trade.partyAId.slice(0, 12)}...`)}
              {renderListing(listingB, `Party B: ${trade.partyBId.slice(0, 12)}...`)}
            </div>
            <div className="px-5 pb-4 flex items-center gap-3 text-xs text-slate-500">
              <span>Risk Score: {trade.riskScore != null ? `${(Number(trade.riskScore) * 100).toFixed(0)}%` : 'N/A'}</span>
              <span>&middot;</span>
              <span>State: {trade.state.replace(/_/g, ' ')}</span>
              <span>&middot;</span>
              <span>Created: {new Date(trade.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Submitted Proof</h2></div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderProofItems(proofA, 'Party A Proof')}
              {renderProofItems(proofB, 'Party B Proof')}
            </div>
          </div>

          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Event Log</h2></div>
            {events.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No events</div>
            ) : (
              <div className="p-3 space-y-1">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{event.eventType}</span>
                        {event.fromState && <span className="text-xs text-slate-400 ml-2">{event.fromState} &rarr; {event.toState}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Moderator Actions</h2></div>
            <div className="p-5 space-y-3">
              {actionError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{actionError}</div>}

              {trade.state === 'PROOF_SUBMITTED' && (
                <button disabled={actionLoading} onClick={() => handleAction(() => tradesApi.beginVerification(tradeId))} className="btn-primary w-full">
                  {actionLoading ? 'Processing...' : 'Begin Verification'}
                </button>
              )}

              {trade.state === 'UNDER_VERIFICATION' && (
                <>
                  <button disabled={actionLoading} onClick={() => handleAction(() => tradesApi.verify(tradeId))} className="btn-emerald w-full">
                    {actionLoading ? 'Approving...' : 'Approve & Verify'}
                  </button>
                  {!showRejectForm ? (
                    <button onClick={() => setShowRejectForm(true)} className="btn-secondary w-full text-red-600 hover:text-red-700 hover:border-red-200">Reject & Request Resubmission</button>
                  ) : (
                    <form onSubmit={handleReject} className="space-y-3 pt-2 border-t border-slate-100">
                      <label className="label">Rejection Reason</label>
                      <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Explain why the proof is insufficient..." className="input min-h-[80px] resize-y" required />
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={actionLoading} className="btn-danger btn-sm flex-1">{actionLoading ? 'Rejecting...' : 'Confirm Reject'}</button>
                        <button type="button" onClick={() => { setShowRejectForm(false); setRejectReason(''); }} className="btn-secondary btn-sm">Cancel</button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {trade.state === 'VERIFIED' && <div className="text-sm text-emerald-600 text-center py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-200">Verified &mdash; awaiting shipping method selection</div>}
              {trade.state === 'AWAITING_SHIPMENT' && <div className="text-sm text-blue-600 text-center py-3 px-3 bg-blue-50 rounded-lg border border-blue-200">Awaiting shipment &mdash; labels purchased, waiting for carrier pickup</div>}
              {trade.state === 'IN_TRANSIT' && <div className="text-sm text-indigo-600 text-center py-3 px-3 bg-indigo-50 rounded-lg border border-indigo-200">Items are in transit</div>}
              {trade.state === 'DELIVERED' && <div className="text-sm text-emerald-600 text-center py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-200">Items delivered &mdash; dispute window active</div>}
              {['COMPLETED', 'CANCELLED', 'REVOKED'].includes(trade.state) && <div className="text-sm text-slate-500 text-center py-3">This trade has reached a final state.</div>}
              {trade.state === 'LOCKED' && <div className="text-sm text-amber-600 text-center py-3 px-3 bg-amber-50 rounded-lg border border-amber-200">Waiting for both parties to submit proof</div>}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Proof Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Party A</span>
                <span className={trade.proofASubmitted ? 'badge-emerald' : 'badge-slate'}>{trade.proofASubmitted ? 'Submitted' : 'Pending'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Party B</span>
                <span className={trade.proofBSubmitted ? 'badge-emerald' : 'badge-slate'}>{trade.proofBSubmitted ? 'Submitted' : 'Pending'}</span>
              </div>
            </div>
          </div>

          {trade.shippingMethod && (
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Shipping Info</h3>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Method</span>
                  <span className="font-medium text-slate-700">{trade.shippingMethod === 'local_pickup' ? 'Local Pickup' : 'Carrier Shipping'}</span>
                </div>
                {trade.shippingMethod === 'local_pickup' && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Party A Confirmed</span>
                      <span className={trade.partyALocalPickupConfirmed ? 'badge-emerald' : 'badge-slate'}>{trade.partyALocalPickupConfirmed ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Party B Confirmed</span>
                      <span className={trade.partyBLocalPickupConfirmed ? 'badge-emerald' : 'badge-slate'}>{trade.partyBLocalPickupConfirmed ? 'Yes' : 'No'}</span>
                    </div>
                  </>
                )}
                {trade.shippingMethod === 'shipping' && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Party A Address</span>
                      <span className={trade.partyAAddressSubmitted ? 'badge-emerald' : 'badge-slate'}>{trade.partyAAddressSubmitted ? 'Submitted' : 'Pending'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Party B Address</span>
                      <span className={trade.partyBAddressSubmitted ? 'badge-emerald' : 'badge-slate'}>{trade.partyBAddressSubmitted ? 'Submitted' : 'Pending'}</span>
                    </div>
                  </>
                )}
              </div>
              {shipments.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  {shipments.map((s) => {
                    const isFromA = s.senderId === trade.partyAId;
                    const statusColors: Record<string, string> = {
                      PENDING: 'bg-slate-100 text-slate-600',
                      LABEL_CREATED: 'bg-blue-50 text-blue-700',
                      IN_TRANSIT: 'bg-indigo-50 text-indigo-700',
                      OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
                      DELIVERED: 'bg-emerald-50 text-emerald-700',
                      FAILED: 'bg-red-50 text-red-700',
                      RETURNED: 'bg-orange-50 text-orange-700',
                      CANCELLED: 'bg-slate-100 text-slate-500',
                    };
                    return (
                      <div key={s.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">{isFromA ? 'A → B' : 'B → A'}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          {s.carrierName && <div>Carrier: <span className="text-slate-700">{s.carrierName}</span>{s.serviceLevel ? ` (${s.serviceLevel})` : ''}</div>}
                          {s.trackingNumber && (
                            <div>Tracking: <span className="font-mono text-slate-700">{s.trackingNumber}</span></div>
                          )}
                          {s.barcode && (
                            <div>Barcode: <span className="font-mono font-bold text-slate-900">{s.barcode}</span></div>
                          )}
                          {s.providerType && (
                            <div>Provider: <span className="text-slate-700 capitalize">{s.providerType}</span></div>
                          )}
                          {s.trackingUrl && (
                            <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">Track Package</a>
                          )}
                          {s.cost != null && <div>Cost: <span className="text-slate-700">{s.currency === 'TRY' ? '₺' : '$'}{Number(s.cost).toFixed(2)} {s.currency}</span></div>}
                          {s.estimatedDeliveryDate && <div>Est. Delivery: <span className="text-slate-700">{new Date(s.estimatedDeliveryDate).toLocaleDateString()}</span></div>}
                          {s.shippedAt && <div>Shipped: <span className="text-slate-700">{new Date(s.shippedAt).toLocaleString()}</span></div>}
                          {s.deliveredAt && <div>Delivered: <span className="text-slate-700">{new Date(s.deliveredAt).toLocaleString()}</span></div>}
                        </div>
                        {s.events && s.events.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                            {s.events.slice(0, 5).map((ev) => (
                              <div key={ev.id} className="flex items-start gap-2 text-[10px]">
                                <div className="w-1 h-1 rounded-full bg-slate-300 mt-1 shrink-0" />
                                <div className="flex-1">
                                  <span className="text-slate-600">{ev.message}</span>
                                  {ev.location && <span className="text-slate-400 ml-1">({ev.location})</span>}
                                </div>
                                <span className="text-slate-400 shrink-0">{new Date(ev.occurredAt).toLocaleString()}</span>
                              </div>
                            ))}
                            {s.events.length > 5 && <div className="text-[10px] text-slate-400 text-center">+{s.events.length - 5} more events</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
