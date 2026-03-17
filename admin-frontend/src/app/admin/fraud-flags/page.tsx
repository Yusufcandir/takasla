'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { FraudFlag } from '@/types';

const FLAG_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  circular_trading: { label: 'Circular Trading', color: 'bg-amber-50 text-amber-700' },
  rapid_rating_exchange: { label: 'Rapid Rating Exchange', color: 'bg-purple-50 text-purple-700' },
  same_address: { label: 'Same Address', color: 'bg-blue-50 text-blue-700' },
  velocity_abuse: { label: 'Velocity Abuse', color: 'bg-red-50 text-red-700' },
};

export default function AdminFraudFlagsPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('unreviewed');

  // Review modal state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getFraudFlags()
      .then(setFlags)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load fraud flags'))
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (flagId: string) => {
    if (!reviewNotes.trim()) { setReviewError('Please add review notes.'); return; }
    setReviewSaving(true);
    setReviewError('');
    try {
      const updated = await adminApi.reviewFraudFlag(flagId, reviewNotes);
      setFlags(prev => prev.map(f => f.id === flagId ? updated : f));
      setReviewingId(null);
      setReviewNotes('');
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Failed to review flag');
    } finally {
      setReviewSaving(false);
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
                      {/* Evidence details */}
                      {flag.evidence && Object.keys(flag.evidence).length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded px-3 py-2 font-mono">
                          {Object.entries(flag.evidence).map(([key, val]) => (
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
                        onClick={() => { setReviewingId(flag.id); setReviewNotes(''); setReviewError(''); }}
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
      {reviewingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Review Fraud Flag</h3>
            {reviewError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{reviewError}</div>}
            <div className="space-y-4">
              <div>
                <label className="label">Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  placeholder="Describe your findings and actions taken..."
                  className="input min-h-[100px] resize-y"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  disabled={reviewSaving}
                  onClick={() => handleReview(reviewingId)}
                  className="btn-emerald flex-1"
                >
                  {reviewSaving ? 'Saving...' : 'Mark as Reviewed'}
                </button>
                <button onClick={() => { setReviewingId(null); setReviewError(''); }} className="btn-secondary">
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
