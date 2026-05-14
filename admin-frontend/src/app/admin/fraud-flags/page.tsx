'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi, listingsApi, tradesApi, getImageUrl } from '@/lib/api';
import type { FraudFlag, Listing, Trade } from '@/types';

const FLAG_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  circular_trading: { label: 'Circular Trading', color: 'bg-amber-50 text-amber-700' },
  rapid_rating_exchange: { label: 'Rapid Rating Exchange', color: 'bg-purple-50 text-purple-700' },
  same_address: { label: 'Same Address', color: 'bg-blue-50 text-blue-700' },
  velocity_abuse: { label: 'Velocity Abuse', color: 'bg-red-50 text-red-700' },
  duplicate_proof: { label: 'Duplicate Proof', color: 'bg-orange-50 text-orange-700' },
  ai_generated_image: { label: 'AI-Generated Image', color: 'bg-pink-50 text-pink-700' },
};

type ReviewAction = 'dismiss' | 'archive_listing' | 'warn_user' | 'ban_user';

export default function AdminFraudFlagsPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('unreviewed');

  // Expanded card state — shows detail inline
  const [expandedFlagId, setExpandedFlagId] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review state (inline, not modal)
  const [reviewingFlagId, setReviewingFlagId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<ReviewAction>('dismiss');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [warningInfo, setWarningInfo] = useState<{ count: number; reports: { listingTitle: string; reason: string; createdAt: string }[] } | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getFraudFlags()
      .then(setFlags)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load fraud flags'))
      .finally(() => setLoading(false));
  }, []);

  const expandFlag = useCallback(async (flag: FraudFlag) => {
    if (expandedFlagId === flag.id) {
      setExpandedFlagId(null);
      setDetailListing(null);
      setDetailTrade(null);
      setReviewingFlagId(null);
      return;
    }

    setExpandedFlagId(flag.id);
    setDetailListing(null);
    setDetailTrade(null);
    setDetailLoading(true);
    setReviewingFlagId(null);

    const evidence = flag.evidence as Record<string, unknown>;
    const listingId = evidence?.listingId as string | undefined;
    const relatedTradeId = evidence?.relatedTradeId as string | undefined;
    const tradeIds = evidence?.tradeIds as string[] | undefined;

    try {
      if (listingId) {
        const listing = await listingsApi.getById(listingId).catch(() => null);
        setDetailListing(listing);
      }
      const tradeId = relatedTradeId || (tradeIds && tradeIds[0]);
      if (tradeId) {
        const trade = await tradesApi.getById(tradeId).catch(() => null);
        setDetailTrade(trade);
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  }, [expandedFlagId]);

  const openReviewPanel = async (flag: FraudFlag) => {
    setReviewingFlagId(flag.id);
    setReviewNotes('');
    setReviewAction('dismiss');
    setReviewError('');
    setConfirmBan(false);
    setWarningInfo(null);
    try {
      const info = await adminApi.getWarningCount(flag.userId);
      setWarningInfo(info);
    } catch { /* ignore */ }
  };

  const handleReview = async (flag: FraudFlag) => {
    if (!reviewNotes.trim() && reviewAction !== 'dismiss') {
      setReviewError('Please add review notes.');
      return;
    }
    if (reviewAction === 'ban_user' && !confirmBan) {
      setConfirmBan(true);
      return;
    }

    setReviewSaving(true);
    setReviewError('');
    try {
      const listingId = (flag.evidence as Record<string, unknown>)?.listingId as string | undefined;
      if (reviewAction === 'archive_listing' && listingId) await adminApi.archiveListing(listingId);
      if (reviewAction === 'warn_user' && listingId) await adminApi.archiveListing(listingId);
      if (reviewAction === 'ban_user') {
        if (listingId) await adminApi.archiveListing(listingId).catch(() => {});
        await adminApi.banUser(flag.userId);
      }

      const notes = reviewNotes.trim() || `Action: ${reviewAction}`;
      const updated = await adminApi.reviewFraudFlag(flag.id, notes);
      setFlags(prev => prev.map(f => f.id === flag.id ? updated : f));
      setReviewingFlagId(null);
      setExpandedFlagId(null);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to process action');
    } finally {
      setReviewSaving(false);
      setConfirmBan(false);
    }
  };

  const filtered = flags.filter(f => {
    if (filter === 'unreviewed') return !f.reviewed;
    if (filter === 'reviewed') return f.reviewed;
    return true;
  });

  const unreviewedCount = flags.filter(f => !f.reviewed).length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Fraud Flags</h1>
        {unreviewedCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            {unreviewedCount} unreviewed
          </span>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['unreviewed', 'all', 'reviewed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab
                ? 'bg-amber-200 text-amber-900'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'unreviewed' ? `Unreviewed (${unreviewedCount})` :
             tab === 'reviewed' ? `Reviewed (${flags.length - unreviewedCount})` :
             `All (${flags.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-emerald-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-slate-500">{filter === 'unreviewed' ? 'No unreviewed fraud flags' : 'No fraud flags'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((flag) => {
            const style = FLAG_TYPE_STYLES[flag.flagType] || { label: flag.flagType, color: 'bg-slate-100 text-slate-700' };
            const evidence = flag.evidence as Record<string, unknown>;
            const flaggedImages = evidence?.flaggedImages as Array<{ url: string; aiScore: number }> | undefined;
            const isExpanded = expandedFlagId === flag.id;

            return (
              <div key={flag.id} className={`card overflow-hidden ${flag.reviewed ? 'opacity-70' : ''}`}>
                {/* Card header — always visible, clickable */}
                <div
                  onClick={() => expandFlag(flag)}
                  className={`px-5 py-4 ${!flag.reviewed ? 'cursor-pointer hover:bg-slate-50' : 'cursor-pointer hover:bg-slate-50/50'} transition-colors`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${flag.reviewed ? 'bg-slate-100' : 'bg-red-50'}`}>
                        <svg className={`w-5 h-5 ${flag.reviewed ? 'text-slate-400' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.color}`}>{style.label}</span>
                          {flag.reviewed && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Reviewed</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">
                          User: <span className="font-mono">{flag.userId.slice(0, 12)}...</span>
                          {flag.relatedUserId && (
                            <> &middot; Related: <span className="font-mono">{flag.relatedUserId.slice(0, 12)}...</span></>
                          )}
                        </p>
                        {flag.description && (
                          <p className="text-sm text-slate-600 mt-1">{flag.description}</p>
                        )}
                        {flag.reviewNotes && (
                          <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-2">
                            <span className="font-medium">Review notes:</span> {flag.reviewNotes}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{new Date(flag.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/50">
                    {detailLoading ? (
                      <div className="px-5 py-8 text-center">
                        <div className="skeleton h-6 w-32 mx-auto mb-3" />
                        <div className="skeleton h-4 w-48 mx-auto" />
                      </div>
                    ) : (
                      <div className="px-5 py-5 space-y-5">
                        {/* Listing detail */}
                        {detailListing && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                              Listing Details
                            </h4>
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <div className="flex gap-4">
                                {/* Listing images */}
                                {detailListing.images && detailListing.images.length > 0 && (
                                  <div className="flex gap-2 flex-shrink-0">
                                    {detailListing.images.slice(0, 4).map((img, i) => (
                                      <button key={img.id || i} onClick={() => setLightboxUrl(getImageUrl(img.url))} className="relative">
                                        <img
                                          src={getImageUrl(img.url)}
                                          alt=""
                                          className="w-20 h-20 rounded-lg object-cover border border-slate-200 hover:border-amber-400 transition-colors cursor-pointer"
                                        />
                                        {/* AI score overlay if this image was flagged */}
                                        {flaggedImages?.find(fi => fi.url === img.url) && (
                                          <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-pink-600 text-white rounded-full px-1">
                                            {(flaggedImages.find(fi => fi.url === img.url)!.aiScore * 100).toFixed(0)}%
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                    {detailListing.images.length > 4 && (
                                      <div className="w-20 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                                        +{detailListing.images.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Listing info */}
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-sm font-medium text-slate-900 truncate">{detailListing.title}</h5>
                                  {detailListing.description && (
                                    <p className="text-xs text-slate-600 mt-1 line-clamp-3">{detailListing.description}</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {detailListing.category && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{detailListing.category.name}</span>
                                    )}
                                    {detailListing.condition && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{detailListing.condition.replace('_', ' ')}</span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded ${detailListing.status === 'active' ? 'bg-emerald-50 text-emerald-700' : detailListing.status === 'archived' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {detailListing.status}
                                    </span>
                                  </div>
                                  {detailListing.location && (
                                    <p className="text-xs text-slate-500 mt-1.5">{detailListing.location}</p>
                                  )}
                                  <p className="text-xs text-slate-400 mt-1">ID: <span className="font-mono">{detailListing.id}</span></p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Flagged images (when no listing loaded but images exist in evidence) */}
                        {!detailListing && flaggedImages && flaggedImages.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-3">Flagged Images</h4>
                            <div className="flex gap-2">
                              {flaggedImages.map((img, i) => (
                                <button key={i} onClick={() => setLightboxUrl(getImageUrl(img.url))} className="relative">
                                  <img
                                    src={getImageUrl(img.url)}
                                    alt=""
                                    className="w-20 h-20 rounded-lg object-cover border border-pink-200 hover:border-pink-400 transition-colors cursor-pointer"
                                  />
                                  <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-pink-600 text-white rounded-full px-1">
                                    {(img.aiScore * 100).toFixed(0)}%
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Trade detail */}
                        {detailTrade && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                              Related Trade
                            </h4>
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  detailTrade.state === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                                  detailTrade.state === 'CANCELLED' || detailTrade.state === 'REVOKED' ? 'bg-red-50 text-red-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>{detailTrade.state}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  detailTrade.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700' :
                                  detailTrade.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                                  'bg-emerald-50 text-emerald-700'
                                }`}>{detailTrade.riskLevel} risk</span>
                              </div>
                              <div className="text-xs text-slate-600 space-y-1">
                                <p>Party A: <span className="font-mono">{detailTrade.partyAId.slice(0, 12)}...</span></p>
                                <p>Party B: <span className="font-mono">{detailTrade.partyBId.slice(0, 12)}...</span></p>
                                <p className="text-slate-400">Created: {new Date(detailTrade.createdAt).toLocaleString()}</p>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">ID: <span className="font-mono">{detailTrade.id}</span></p>
                            </div>
                          </div>
                        )}

                        {/* Raw evidence (for types without listing/trade) */}
                        {!detailListing && !detailTrade && !flaggedImages && evidence && Object.keys(evidence).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-3">Evidence</h4>
                            <div className="bg-white rounded-lg border border-slate-200 p-4 text-xs text-slate-600 font-mono space-y-1">
                              {Object.entries(evidence).map(([key, val]) => (
                                <div key={key}><span className="text-slate-400">{key}:</span> {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No detail found */}
                        {!detailLoading && !detailListing && !detailTrade && !flaggedImages && (!evidence || Object.keys(evidence).length === 0) && (
                          <p className="text-sm text-slate-500 text-center py-4">No additional details available for this flag.</p>
                        )}

                        {/* Review panel (inline) */}
                        {!flag.reviewed && (
                          <div className="border-t border-slate-200 pt-4">
                            {reviewingFlagId !== flag.id ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openReviewPanel(flag); }}
                                className="btn-secondary btn-sm"
                              >
                                Take Action
                              </button>
                            ) : (
                              <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-900">Take Action</h4>

                                {reviewError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{reviewError}</div>}

                                {/* Warning history */}
                                {warningInfo && (
                                  <div className={`rounded-lg px-4 py-3 text-sm ${warningInfo.count > 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                                    {warningInfo.count === 0 ? (
                                      <p className="font-medium">No previous warnings for this user</p>
                                    ) : (
                                      <>
                                        <p className="font-medium">{warningInfo.count} previous warning(s)</p>
                                        {warningInfo.reports.map((r, i) => (
                                          <p key={i} className="text-xs mt-1">&bull; {r.listingTitle} &mdash; {r.reason} ({new Date(r.createdAt).toLocaleDateString()})</p>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Action selection */}
                                <div>
                                  <label className="label mb-2">Action</label>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button type="button" onClick={() => { setReviewAction('dismiss'); setConfirmBan(false); }}
                                      className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'dismiss' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                      <div className="font-medium">Dismiss</div>
                                      <div className="text-xs opacity-75">No action needed</div>
                                    </button>
                                    <button type="button" onClick={() => { setReviewAction('archive_listing'); setConfirmBan(false); }}
                                      className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'archive_listing' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                      <div className="font-medium">Delete Listing</div>
                                      <div className="text-xs opacity-75">Archive the listing</div>
                                    </button>
                                    <button type="button" onClick={() => { setReviewAction('warn_user'); setConfirmBan(false); }}
                                      className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'warn_user' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                      <div className="font-medium">Delete & Warn</div>
                                      <div className="text-xs opacity-75">Archive + warn user</div>
                                    </button>
                                    <button type="button" onClick={() => { setReviewAction('ban_user'); setConfirmBan(false); }}
                                      className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'ban_user' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                      <div className="font-medium">Delete & Ban</div>
                                      <div className="text-xs opacity-75">Archive + ban permanently</div>
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="label">Review Notes</label>
                                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3}
                                    placeholder="Describe your findings and actions taken..." className="input min-h-[80px] resize-y" />
                                </div>

                                {confirmBan && (
                                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                                    <p className="font-medium">Are you sure?</p>
                                    <p className="text-xs mt-1">This will permanently ban this user&apos;s email. Click the button again to confirm.</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-3">
                                  <button disabled={reviewSaving} onClick={() => handleReview(flag)}
                                    className={`text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50 ${
                                      reviewAction === 'ban_user' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                      reviewAction === 'warn_user' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                                      reviewAction === 'archive_listing' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                                      'btn-emerald'
                                    }`}>
                                    {reviewSaving ? 'Processing...' :
                                     confirmBan ? 'Confirm Ban' :
                                     reviewAction === 'dismiss' ? 'Dismiss Flag' :
                                     reviewAction === 'archive_listing' ? 'Delete Listing' :
                                     reviewAction === 'warn_user' ? 'Delete & Warn User' :
                                     'Delete & Ban User'}
                                  </button>
                                  <button onClick={() => setReviewingFlagId(null)} className="btn-secondary" disabled={reviewSaving}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
