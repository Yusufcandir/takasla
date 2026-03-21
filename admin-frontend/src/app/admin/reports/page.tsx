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

  useEffect(() => {
    adminApi.getReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        <div className="space-y-3">
          {filtered.map((report) => {
            const reason = REASON_LABELS[report.reason] || { label: report.reason, color: 'bg-slate-100 text-slate-700' };
            const isExpanded = expandedId === report.id;
            const listingImage = report.listing?.images?.[0];

            return (
              <div key={report.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${report.status !== 'pending' ? 'opacity-70' : ''}`}>
                {/* Report header row */}
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Listing thumbnail */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {listingImage ? (
                          <img
                            src={getImageUrl(listingImage.url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
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
                          {report.listing?.title || `Listing ${report.listingId.slice(0, 8)}...`}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewingReport(report);
                            setReviewNotes('');
                            setReviewError('');
                            setConfirmBan(false);
                          }}
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

                {/* Expanded listing preview */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                    <div className="flex gap-4">
                      {/* Listing images */}
                      {report.listing?.images && report.listing.images.length > 0 && (
                        <div className="flex gap-2 flex-shrink-0">
                          {report.listing.images.slice(0, 3).map((img) => (
                            <div key={img.id} className="w-20 h-20 rounded-lg overflow-hidden bg-slate-200">
                              <img
                                src={getImageUrl(img.url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {report.listing.images.length > 3 && (
                            <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-medium">
                              +{report.listing.images.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Listing details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 mb-1">
                          {report.listing?.title || 'Unknown listing'}
                        </h4>
                        {report.listing?.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-2">{report.listing.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {report.listing?.category && (
                            <span>Category: <span className="font-medium text-slate-700">{report.listing.category.name}</span></span>
                          )}
                          {report.listing?.condition && (
                            <span>Condition: <span className="font-medium text-slate-700">{report.listing.condition.replace('_', ' ')}</span></span>
                          )}
                          {report.listing?.declaredValue && (
                            <span>Value: <span className="font-medium text-slate-700">{report.listing.declaredValue} {report.listing.currency}</span></span>
                          )}
                          <span>Status: <span className="font-medium text-slate-700">{report.listing?.status || 'N/A'}</span></span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Seller: <span className="font-mono text-slate-600">{report.listing?.userId?.slice(0, 16) || report.listingId.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>

                    {/* Report description */}
                    {report.description && (
                      <div className="mt-3 bg-white rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Reporter&apos;s description:</p>
                        <p className="text-sm text-slate-700">{report.description}</p>
                      </div>
                    )}

                    {/* Admin notes (if resolved) */}
                    {report.adminNotes && (
                      <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                        <span className="font-medium">Admin notes:</span> {report.adminNotes}
                      </div>
                    )}
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
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Take Action on Report</h3>

            {/* Listing summary */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 mb-4">
              {reviewingReport.listing?.images?.[0] && (
                <img
                  src={getImageUrl(reviewingReport.listing.images[0].url)}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {reviewingReport.listing?.title || `Listing ${reviewingReport.listingId.slice(0, 8)}...`}
                </p>
                <p className="text-xs text-slate-500">
                  Seller: <span className="font-mono">{reviewingReport.listing?.userId?.slice(0, 12) || '?'}...</span>
                </p>
              </div>
            </div>

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

              {/* Delete listing & warn user */}
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

              {/* Delete listing & ban user */}
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
