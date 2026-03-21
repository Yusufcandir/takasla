'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi, getImageUrl } from '@/lib/api';
import type { FraudFlag } from '@/types';

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

  // Review modal state
  const [reviewingFlag, setReviewingFlag] = useState<FraudFlag | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<ReviewAction>('dismiss');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Warning count for selected user
  const [warningInfo, setWarningInfo] = useState<{ count: number; reports: { listingTitle: string; reason: string; createdAt: string }[] } | null>(null);

  // Ban confirmation
  const [confirmBan, setConfirmBan] = useState(false);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getFraudFlags()
      .then(setFlags)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load fraud flags'))
      .finally(() => setLoading(false));
  }, []);

  const openReview = async (flag: FraudFlag) => {
    setReviewingFlag(flag);
    setReviewNotes('');
    setReviewAction('dismiss');
    setReviewError('');
    setConfirmBan(false);
    setWarningInfo(null);
    // Load warning history
    try {
      const info = await adminApi.getWarningCount(flag.userId);
      setWarningInfo(info);
    } catch { /* ignore */ }
  };

  const handleReview = async () => {
    if (!reviewingFlag) return;
    if (!reviewNotes.trim() && reviewAction !== 'dismiss') {
      setReviewError('Please add review notes.');
      return;
    }

    // Ban requires double-click confirmation
    if (reviewAction === 'ban_user' && !confirmBan) {
      setConfirmBan(true);
      return;
    }

    setReviewSaving(true);
    setReviewError('');
    try {
      const listingId = (reviewingFlag.evidence as Record<string, unknown>)?.listingId as string | undefined;

      if (reviewAction === 'archive_listing' && listingId) {
        await adminApi.archiveListing(listingId);
      }

      if (reviewAction === 'warn_user' && listingId) {
        await adminApi.archiveListing(listingId);
      }

      if (reviewAction === 'ban_user') {
        if (listingId) {
          await adminApi.archiveListing(listingId).catch(() => {});
        }
        await adminApi.banUser(reviewingFlag.userId);
      }

      const notes = reviewNotes.trim() || `Action: ${reviewAction}`;
      const updated = await adminApi.reviewFraudFlag(reviewingFlag.id, notes);
      setFlags(prev => prev.map(f => f.id === reviewingFlag.id ? updated : f));
      setReviewingFlag(null);
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
            const listingId = evidence?.listingId as string | undefined;
            const flaggedImages = evidence?.flaggedImages as Array<{ url: string; aiScore: number }> | undefined;

            return (
              <div key={flag.id} className={`card px-5 py-4 ${flag.reviewed ? 'opacity-70' : ''}`}>
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

                      {/* Show flagged images for AI detection */}
                      {flaggedImages && flaggedImages.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {flaggedImages.map((img, i) => (
                            <div key={i} className="relative">
                              <img
                                src={getImageUrl(img.url)}
                                alt=""
                                className="w-16 h-16 rounded-lg object-cover border border-pink-200"
                              />
                              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-pink-600 text-white rounded-full px-1">
                                {(img.aiScore * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show listing link if available */}
                      {listingId && (
                        <p className="text-xs text-slate-500 mt-1">
                          Listing: <span className="font-mono">{listingId.slice(0, 12)}...</span>
                        </p>
                      )}

                      {/* Non-image evidence */}
                      {evidence && !flaggedImages && Object.keys(evidence).length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded px-3 py-2 font-mono">
                          {Object.entries(evidence).map(([key, val]) => (
                            <div key={key}>{key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                          ))}
                        </div>
                      )}

                      {flag.reviewNotes && (
                        <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-2">
                          <span className="font-medium">Review notes:</span> {flag.reviewNotes}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{new Date(flag.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {!flag.reviewed && (
                      <button
                        onClick={() => openReview(flag)}
                        className="btn-secondary btn-sm"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewingFlag && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Review Fraud Flag</h3>
            <p className="text-sm text-slate-500 mb-4">
              {(FLAG_TYPE_STYLES[reviewingFlag.flagType] || { label: reviewingFlag.flagType }).label}
              {' '}&middot;{' '}
              User: <span className="font-mono">{reviewingFlag.userId.slice(0, 12)}...</span>
            </p>

            {reviewError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{reviewError}</div>}

            {/* Warning history */}
            {warningInfo && (
              <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${warningInfo.count > 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
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

            <div className="space-y-4">
              {/* Action selection */}
              <div>
                <label className="label mb-2">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setReviewAction('dismiss'); setConfirmBan(false); }}
                    className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'dismiss' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium">Dismiss</div>
                    <div className="text-xs opacity-75">No action needed</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReviewAction('archive_listing'); setConfirmBan(false); }}
                    className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'archive_listing' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium">Delete Listing</div>
                    <div className="text-xs opacity-75">Archive the listing</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReviewAction('warn_user'); setConfirmBan(false); }}
                    className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'warn_user' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium">Delete & Warn</div>
                    <div className="text-xs opacity-75">Archive listing + warn user</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReviewAction('ban_user'); setConfirmBan(false); }}
                    className={`px-3 py-2 text-sm rounded-lg border text-left ${reviewAction === 'ban_user' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium">Delete & Ban</div>
                    <div className="text-xs opacity-75">Archive + ban user permanently</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe your findings and actions taken..."
                  className="input min-h-[80px] resize-y"
                />
              </div>

              {/* Ban confirmation warning */}
              {confirmBan && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <p className="font-medium">Are you sure?</p>
                  <p className="text-xs mt-1">This will permanently ban this user&apos;s email. Click the button again to confirm.</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  disabled={reviewSaving}
                  onClick={handleReview}
                  className={`flex-1 text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50 ${
                    reviewAction === 'ban_user'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : reviewAction === 'warn_user'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : reviewAction === 'archive_listing'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'btn-emerald'
                  }`}
                >
                  {reviewSaving ? 'Processing...' :
                   confirmBan ? 'Confirm Ban' :
                   reviewAction === 'dismiss' ? 'Dismiss Flag' :
                   reviewAction === 'archive_listing' ? 'Delete Listing' :
                   reviewAction === 'warn_user' ? 'Delete & Warn User' :
                   'Delete & Ban User'}
                </button>
                <button
                  onClick={() => { setReviewingFlag(null); setReviewError(''); setConfirmBan(false); }}
                  className="btn-secondary"
                  disabled={reviewSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
