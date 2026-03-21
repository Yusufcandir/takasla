'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
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

  const [reviewingReport, setReviewingReport] = useState<ListingReport | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'dismissed'>('reviewed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    adminApi.getReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async () => {
    if (!reviewingReport) return;
    setReviewSaving(true);
    setReviewError('');
    try {
      const updated = await adminApi.reviewReport(reviewingReport.id, reviewStatus, reviewNotes.trim() || undefined);
      setReports((prev) => prev.map((r) => (r.id === reviewingReport.id ? updated : r)));
      setReviewingReport(null);
      setReviewNotes('');
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to review report');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleArchiveListing = async () => {
    if (!reviewingReport) return;
    setArchiving(true);
    setReviewError('');
    try {
      await adminApi.archiveReportedListing(reviewingReport.id);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reviewingReport.id
            ? { ...r, status: 'reviewed' as const, adminNotes: 'Listing archived by admin' }
            : r,
        ),
      );
      setReviewingReport(null);
      setReviewNotes('');
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to archive listing');
    } finally {
      setArchiving(false);
    }
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
            return (
              <div key={report.id} className={`bg-white rounded-xl border border-slate-200 px-5 py-4 ${report.status !== 'pending' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      report.status === 'pending' ? 'bg-red-50' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-5 h-5 ${report.status === 'pending' ? 'text-red-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
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
                      {report.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{report.description}</p>
                      )}
                      {report.adminNotes && (
                        <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-2">
                          <span className="font-medium">Admin notes:</span> {report.adminNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    {report.listing && (
                      <a
                        href={`/listings/${report.listingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        View Listing
                      </a>
                    )}
                    {report.status === 'pending' && (
                      <button
                        onClick={() => {
                          setReviewingReport(report);
                          setReviewStatus('reviewed');
                          setReviewNotes('');
                          setReviewError('');
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
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
      {reviewingReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Review Report</h3>
            <p className="text-sm text-slate-500 mb-4">
              {reviewingReport.listing?.title || `Listing ${reviewingReport.listingId.slice(0, 8)}...`}
            </p>

            {reviewError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{reviewError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Reported Reason</label>
                <p className="text-sm text-slate-700">
                  {(REASON_LABELS[reviewingReport.reason] || { label: reviewingReport.reason }).label}
                </p>
                {reviewingReport.description && (
                  <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded px-3 py-2">{reviewingReport.description}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Action</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as 'reviewed' | 'dismissed')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="reviewed">Mark as Reviewed</option>
                  <option value="dismissed">Dismiss Report</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Admin Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about your decision..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <button
                    disabled={reviewSaving || archiving}
                    onClick={handleReview}
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {reviewSaving ? 'Saving...' : reviewStatus === 'dismissed' ? 'Dismiss Report' : 'Mark Reviewed'}
                  </button>
                  <button
                    onClick={() => { setReviewingReport(null); setReviewError(''); }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <button
                  disabled={reviewSaving || archiving}
                  onClick={handleArchiveListing}
                  className="w-full py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {archiving ? 'Archiving...' : 'Archive Listing & Resolve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
