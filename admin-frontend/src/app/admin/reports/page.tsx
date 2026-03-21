'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi, getImageUrl } from '@/lib/api';
import type { ListingReport } from '@/types';

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  inappropriate_content: { label: 'Inappropriate Content', color: 'bg-red-50 text-red-700' },
  fraud_scam: { label: 'Fraud / Scam', color: 'bg-red-50 text-red-700' },
  wrong_category: { label: 'Wrong Category', color: 'bg-amber-50 text-amber-700' },
  duplicate: { label: 'Duplicate', color: 'bg-blue-50 text-blue-700' },
  prohibited_item: { label: 'Prohibited Item', color: 'bg-red-50 text-red-700' },
  other: { label: 'Other', color: 'bg-slate-100 text-slate-700' },
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  reviewed: 'bg-emerald-50 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-600',
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

interface WarningData {
  count: number;
  reports: { listingId: string; listingTitle: string; reason: string; adminNotes?: string; createdAt: string }[];
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all' | 'reviewed' | 'dismissed'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [reviewingReport, setReviewingReport] = useState<ListingReport | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);

  const [warningData, setWarningData] = useState<WarningData | null>(null);
  const [warningLoading, setWarningLoading] = useState(false);

  useEffect(() => {
    adminApi.getReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openActionModal = async (report: ListingReport) => {
    setReviewingReport(report);
    setReviewNotes('');
    setReviewError('');
    setConfirmBan(false);
    setWarningData(null);

    const sellerId = report.listing?.userId;
    if (sellerId) {
      setWarningLoading(true);
      try {
        const data = await adminApi.getWarningCount(sellerId);
        setWarningData(data);
      } catch {
        // ignore
      } finally {
        setWarningLoading(false);
      }
    }
  };

  const handleDismiss = async () => {
    if (!reviewingReport) return;
    setActionInProgress('dismiss');
    setReviewError('');
    try {
      const updated = await adminApi.reviewReport(reviewingReport.id, 'dismissed', reviewNotes.trim() || 'Report dismissed by admin');
      setReports((prev) => prev.map((r) => (r.id === reviewingReport.id ? updated : r)));
      closeModal();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to dismiss report');
    } finally {
      setActionInProgress('');
    }
  };

  const handleDeleteAndWarn = async () => {
    if (!reviewingReport) return;
    setActionInProgress('warn');
    setReviewError('');
    try {
      await adminApi.archiveReportedListing(reviewingReport.id);
      const notes = reviewNotes.trim() || 'Listing deleted — user warned';
      const updated = await adminApi.reviewReport(reviewingReport.id, 'reviewed', notes);
      setReports((prev) => prev.map((r) => (r.id === reviewingReport.id ? updated : r)));
      closeModal();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to delete listing');
    } finally {
      setActionInProgress('');
    }
  };

  const handleDeleteAndBan = async () => {
    if (!reviewingReport) return;
    if (!confirmBan) {
      setConfirmBan(true);
      return;
    }
    setActionInProgress('ban');
    setReviewError('');
    try {
      await adminApi.archiveReportedListing(reviewingReport.id);
      const listingOwnerId = reviewingReport.listing?.userId;
      if (listingOwnerId) {
        await adminApi.deleteUser(listingOwnerId);
      }
      const notes = reviewNotes.trim() || 'Listing deleted — user banned';
      const updated = await adminApi.reviewReport(reviewingReport.id, 'reviewed', notes);
      setReports((prev) => prev.map((r) => (r.id === reviewingReport.id ? updated : r)));
      closeModal();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setActionInProgress('');
    }
  };

  const closeModal = () => {
    setReviewingReport(null);
    setReviewNotes('');
    setReviewError('');
    setConfirmBan(false);
    setWarningData(null);
  };

  const filtered = reports.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'reviewed') return r.status === 'reviewed';
    if (filter === 'dismissed') return r.status === 'dismissed';
    return true;
  });

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-6" />
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Listing Reports</h1>
        {pendingCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['pending', 'all', 'reviewed', 'dismissed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab ? 'bg-amber-200 text-amber-900' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'pending'
              ? `Pending (${pendingCount})`
              : tab === 'reviewed'
              ? `Reviewed (${reports.filter((r) => r.status === 'reviewed').length})`
              : tab === 'dismissed'
              ? `Dismissed (${reports.filter((r) => r.status === 'dismissed').length})`
              : `All (${reports.length})`}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="w-12 h-12 text-emerald-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500">{filter === 'pending' ? 'No pending reports' : 'No reports found'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => {
            const reason = REASON_LABELS[report.reason] || { label: report.reason, color: 'bg-slate-100 text-slate-700' };
            const isExpanded = expandedId === report.id;
            const listing = report.listing;
            const images = listing?.images || [];
            const firstImage = images[0];

            return (
              <div key={report.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${report.status !== 'pending' ? 'opacity-70' : ''}`}>
                {/* Report header — click to expand */}
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {firstImage ? (
                          <img src={getImageUrl(firstImage.url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reason.color}`}>{reason.label}</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_STYLES[report.status]}`}>{report.status}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {listing?.title || `Listing ${report.listingId.slice(0, 8)}...`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Reporter: <span className="font-mono">{report.userId.slice(0, 12)}...</span>
                          {' '}&middot;{' '}
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {report.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openActionModal(report); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                        >
                          Take Action
                        </button>
                      )}
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded — Full listing card (matches user frontend) */}
                {isExpanded && listing && (
                  <div className="border-t border-slate-200">
                    {/* Image gallery */}
                    {images.length > 0 && (
                      <div className="bg-slate-50">
                        <div className="aspect-[16/7] overflow-hidden">
                          <img
                            src={getImageUrl(images[0].url)}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {images.length > 1 && (
                          <div className="flex gap-1.5 p-3 overflow-x-auto">
                            {images.map((img) => (
                              <div key={img.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                                <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="px-5 py-4">
                      {/* Title + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-lg font-bold text-slate-900">{listing.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                          listing.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          listing.status === 'locked' ? 'bg-amber-50 text-amber-700' :
                          listing.status === 'traded' ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {listing.status}
                        </span>
                      </div>

                      {/* Description */}
                      {listing.description && (
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">{listing.description}</p>
                      )}

                      {/* Details grid — matches user frontend listing detail card */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 mb-4">
                        {listing.category?.name && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">Category</span>
                            <span className="text-sm font-semibold text-slate-900">{listing.category.name}</span>
                          </div>
                        )}
                        {listing.condition && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">Condition</span>
                            <span className="text-sm font-medium text-slate-700">{CONDITION_LABELS[listing.condition] || listing.condition}</span>
                          </div>
                        )}
                        {listing.declaredValue !== undefined && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">Declared Value</span>
                            <span className="text-sm font-semibold text-slate-900">{Number(listing.declaredValue).toLocaleString()} {listing.currency}</span>
                          </div>
                        )}
                        {listing.location && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-slate-500">Location</span>
                            <span className="text-sm text-slate-700 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {listing.location}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm text-slate-500">Listed</span>
                          <span className="text-sm text-slate-700">{new Date(listing.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm text-slate-500">Seller</span>
                          <span className="text-sm font-mono text-slate-700">{listing.userId.slice(0, 16)}...</span>
                        </div>
                      </div>

                      {/* Reporter&apos;s description */}
                      {report.description && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Reporter&apos;s description</p>
                          <p className="text-sm text-red-800">{report.description}</p>
                        </div>
                      )}

                      {/* Admin notes (if already resolved) */}
                      {report.adminNotes && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Admin notes</p>
                          <p className="text-sm text-emerald-800">{report.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      {reviewingReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Take Action on Report</h3>

            {/* Listing summary in modal */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
              <div className="flex gap-3">
                {reviewingReport.listing?.images?.[0] && (
                  <img
                    src={getImageUrl(reviewingReport.listing.images[0].url)}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 mb-0.5">
                    {reviewingReport.listing?.title || `Listing ${reviewingReport.listingId.slice(0, 8)}...`}
                  </h4>
                  {reviewingReport.listing?.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-1">{reviewingReport.listing.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {reviewingReport.listing?.category?.name && (
                      <span>{reviewingReport.listing.category.name}</span>
                    )}
                    {reviewingReport.listing?.condition && (
                      <span>{CONDITION_LABELS[reviewingReport.listing.condition] || reviewingReport.listing.condition}</span>
                    )}
                    {reviewingReport.listing?.declaredValue !== undefined && (
                      <span>{Number(reviewingReport.listing.declaredValue).toLocaleString()} {reviewingReport.listing.currency}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Seller: <span className="font-mono">{reviewingReport.listing?.userId?.slice(0, 16) || '?'}...</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Warning history banner */}
            {warningLoading && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span className="text-sm text-slate-500">Checking user history...</span>
              </div>
            )}
            {!warningLoading && warningData && warningData.count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm font-bold text-red-800">
                    This user has {warningData.count} previous warning{warningData.count > 1 ? 's' : ''}!
                  </span>
                </div>
                <div className="space-y-1">
                  {warningData.reports.slice(0, 5).map((w, i) => (
                    <div key={i} className="text-xs text-red-700 flex items-center gap-2">
                      <span className="font-mono text-red-400">{new Date(w.createdAt).toLocaleDateString()}</span>
                      <span className="truncate">&ldquo;{w.listingTitle}&rdquo; — {REASON_LABELS[w.reason]?.label || w.reason}</span>
                    </div>
                  ))}
                  {warningData.reports.length > 5 && (
                    <p className="text-xs text-red-500 font-medium">...and {warningData.reports.length - 5} more</p>
                  )}
                </div>
              </div>
            )}
            {!warningLoading && warningData && warningData.count === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-emerald-700">No previous warnings for this user</span>
              </div>
            )}

            {/* Report reason */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Reported Reason</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(REASON_LABELS[reviewingReport.reason] || { color: 'bg-slate-100 text-slate-700' }).color}`}>
                  {(REASON_LABELS[reviewingReport.reason] || { label: reviewingReport.reason }).label}
                </span>
              </div>
              {reviewingReport.description && (
                <p className="text-xs text-slate-600 mt-2 bg-slate-50 rounded-lg px-3 py-2">{reviewingReport.description}</p>
              )}
            </div>

            {reviewError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{reviewError}</div>
            )}

            {/* Admin notes */}
            <div className="mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Admin Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                placeholder="Add notes about your decision..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {/* Dismiss */}
              <button
                disabled={!!actionInProgress}
                onClick={handleDismiss}
                className="w-full py-2.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionInProgress === 'dismiss' ? (
                  <span>Dismissing...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Dismiss Report (No Action Needed)
                  </>
                )}
              </button>

              {/* Delete listing & warn */}
              <button
                disabled={!!actionInProgress}
                onClick={handleDeleteAndWarn}
                className="w-full py-2.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionInProgress === 'warn' ? (
                  <span>Deleting listing...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Delete Listing &amp; Warn User
                  </>
                )}
              </button>

              {/* Delete listing & ban */}
              <button
                disabled={!!actionInProgress}
                onClick={handleDeleteAndBan}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  confirmBan
                    ? 'bg-red-700 text-white hover:bg-red-800 ring-2 ring-red-300'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {actionInProgress === 'ban' ? (
                  <span>Banning user...</span>
                ) : confirmBan ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Click Again to Confirm Ban
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Delete Listing &amp; Ban User
                  </>
                )}
              </button>

              {/* Cancel */}
              <button
                onClick={closeModal}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
