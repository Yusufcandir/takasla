'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isModeratorOrAdmin } from '@/lib/auth';
import { disputesApi, adminApi, getImageUrl } from '@/lib/api';
import type { Dispute } from '@/types';

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const disputeId = params.id as string;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  const [outcome, setOutcome] = useState<'completed' | 'revoked'>('completed');
  const [outcomeType, setOutcomeType] = useState<string>('seller_wins');
  const [compensationAction, setCompensationAction] = useState<string>('no_refund');
  const [compensationAmount, setCompensationAmount] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [resolveSuccess, setResolveSuccess] = useState(false);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    disputesApi.getById(disputeId)
      .then(setDispute)
      .finally(() => setLoading(false));
  }, [disputeId]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution.trim()) { setResolveError('Please provide a resolution.'); return; }
    setResolveError('');
    setResolving(true);
    try {
      const data: {
        resolution: string;
        outcome: 'completed' | 'revoked';
        outcomeType: string;
        compensationAction: string;
        compensationAmount?: number;
      } = { resolution, outcome, outcomeType, compensationAction };
      if (compensationAction === 'partial_refund' && compensationAmount) {
        data.compensationAmount = parseFloat(compensationAmount);
      }
      const updated = await adminApi.resolveDispute(disputeId, data);
      setDispute(updated);
      setResolveSuccess(true);
    } catch (err: unknown) {
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  };

  // SLA status helper
  const getSlaStatus = () => {
    if (!dispute?.slaDeadline) return null;
    const deadline = new Date(dispute.slaDeadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return { label: 'SLA Breached', color: 'bg-red-50 text-red-700 border-red-200' };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 12) return { label: `SLA: ${hours}h remaining`, color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: `SLA: ${hours}h remaining`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-96 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Dispute not found</h2>
        <Link href="/admin/disputes" className="btn-primary mt-4">Back to Disputes</Link>
      </div>
    );
  }

  const isResolved = dispute.status === 'resolved' || dispute.status === 'closed';
  const slaStatus = getSlaStatus();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/disputes" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Dispute #{dispute.id.slice(0, 8)}</h1>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
          dispute.status === 'escalated' ? 'bg-amber-50 text-amber-700' :
          isResolved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>{dispute.status}</span>
        {slaStatus && (
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${slaStatus.color}`}>
            {slaStatus.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Details */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Dispute Details</h2></div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">Trade</span>
                <Link href={`/admin/verifications/${dispute.tradeId}`} className="text-sm text-blue-600 hover:underline font-mono">{dispute.tradeId.slice(0, 12)}...</Link>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">Opened By</span>
                <span className="text-sm font-mono text-slate-700">{dispute.openedBy.slice(0, 12)}...</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">Reason</span>
                <span className="badge-amber">{dispute.reason.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">Opened</span>
                <span className="text-sm text-slate-700">{new Date(dispute.createdAt).toLocaleString()}</span>
              </div>
              {dispute.slaDeadline && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">SLA Deadline</span>
                  <span className="text-sm text-slate-700">{new Date(dispute.slaDeadline).toLocaleString()}</span>
                </div>
              )}
              {dispute.escalatedAt && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">Escalated At</span>
                  <span className="text-sm text-amber-700 font-medium">{new Date(dispute.escalatedAt).toLocaleString()}</span>
                </div>
              )}
              {dispute.description && (
                <div className="px-5 py-3">
                  <span className="text-sm text-slate-500 block mb-1">Description</span>
                  <p className="text-sm text-slate-700">{dispute.description}</p>
                </div>
              )}
              {dispute.resolution && (
                <div className="px-5 py-3">
                  <span className="text-sm text-slate-500 block mb-1">Resolution</span>
                  <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{dispute.resolution}</p>
                </div>
              )}
            </div>
          </div>

          {/* Outcome Details (when resolved) */}
          {isResolved && dispute.outcomeType && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Outcome Details</h2></div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">Outcome</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    dispute.outcomeType === 'buyer_wins' ? 'bg-blue-50 text-blue-700' :
                    dispute.outcomeType === 'seller_wins' ? 'bg-emerald-50 text-emerald-700' :
                    dispute.outcomeType === 'split' ? 'bg-purple-50 text-purple-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>{dispute.outcomeType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">Compensation</span>
                  <span className="text-sm font-medium text-slate-700">{dispute.compensationAction?.replace(/_/g, ' ')}</span>
                </div>
                {dispute.compensationAmount != null && dispute.compensationAmount > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-slate-500">Amount</span>
                    <span className="text-sm font-semibold text-slate-900">${Number(dispute.compensationAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Appeal Status */}
          {dispute.appealStatus && dispute.appealStatus !== 'none' && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900">Appeal</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    dispute.appealStatus === 'pending' ? 'bg-amber-50 text-amber-700' :
                    dispute.appealStatus === 'upheld' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-red-50 text-red-700'
                  }`}>{dispute.appealStatus}</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {dispute.appealedBy && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-slate-500">Appealed By</span>
                    <span className="text-sm font-mono text-slate-700">{dispute.appealedBy.slice(0, 12)}...</span>
                  </div>
                )}
                {dispute.appealReason && (
                  <div className="px-5 py-3">
                    <span className="text-sm text-slate-500 block mb-1">Appeal Reason</span>
                    <p className="text-sm text-slate-700">{dispute.appealReason}</p>
                  </div>
                )}
                {dispute.appealDeadline && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-slate-500">Appeal Deadline</span>
                    <span className="text-sm text-slate-700">{new Date(dispute.appealDeadline).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Evidence ({dispute.evidence?.length || 0})</h2></div>
            {!dispute.evidence || dispute.evidence.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No evidence submitted</div>
            ) : (
              <div className="p-5 space-y-4">
                {dispute.evidence.map((ev) => (
                  <div key={ev.id} className="bg-slate-50 rounded-lg overflow-hidden">
                    {ev.type === 'photo' && <img src={getImageUrl(ev.url)} alt="Evidence" className="w-full max-h-64 object-contain bg-white" />}
                    {ev.type === 'video' && <video src={getImageUrl(ev.url)} controls className="w-full max-h-64 bg-black" />}
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${ev.type === 'photo' ? 'bg-blue-50 text-blue-700' : ev.type === 'video' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{ev.type}</span>
                        <span className="text-xs text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                      {ev.description && <p className="text-sm text-slate-600 mt-1">{ev.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Resolution Form */}
        <div className="space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Resolution</h2></div>
            <div className="p-5">
              {resolveSuccess || isResolved ? (
                <div className="text-center py-4">
                  <svg className="w-10 h-10 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-emerald-700 font-medium">Dispute resolved</p>
                  {dispute.resolvedAt && <p className="text-xs text-slate-400 mt-1">{new Date(dispute.resolvedAt).toLocaleString()}</p>}
                  {dispute.outcomeType && (
                    <p className="text-xs text-slate-500 mt-2">
                      Outcome: {dispute.outcomeType.replace(/_/g, ' ')} &middot; {dispute.compensationAction?.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleResolve} className="space-y-4">
                  {resolveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{resolveError}</div>}

                  <div>
                    <label className="label">Outcome Type</label>
                    <select
                      value={outcomeType}
                      onChange={(e) => {
                        setOutcomeType(e.target.value);
                        if (e.target.value === 'buyer_wins') {
                          setOutcome('revoked');
                          setCompensationAction('full_refund');
                        } else if (e.target.value === 'seller_wins') {
                          setOutcome('completed');
                          setCompensationAction('no_refund');
                        } else if (e.target.value === 'split') {
                          setOutcome('revoked');
                          setCompensationAction('partial_refund');
                        }
                      }}
                      className="input"
                    >
                      <option value="buyer_wins">Buyer Wins (refund buyer)</option>
                      <option value="seller_wins">Seller Wins (complete trade)</option>
                      <option value="split">Split (partial refund)</option>
                      <option value="escalated">Escalate to Senior</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Trade Outcome</label>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'completed' | 'revoked')} className="input">
                      <option value="completed">Complete Trade</option>
                      <option value="revoked">Revoke Trade</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Compensation Action</label>
                    <select value={compensationAction} onChange={(e) => setCompensationAction(e.target.value)} className="input">
                      <option value="no_refund">No Refund</option>
                      <option value="full_refund">Full Refund</option>
                      <option value="partial_refund">Partial Refund</option>
                      <option value="re_ship">Re-Ship</option>
                    </select>
                  </div>

                  {compensationAction === 'partial_refund' && (
                    <div>
                      <label className="label">Refund Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={compensationAmount}
                        onChange={(e) => setCompensationAmount(e.target.value)}
                        placeholder="0.00"
                        className="input"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="label">Resolution Notes</label>
                    <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} placeholder="Explain your decision..." className="input min-h-[100px] resize-y" required />
                  </div>

                  <button type="submit" disabled={resolving} className="btn-emerald w-full">
                    {resolving ? 'Resolving...' : 'Resolve Dispute'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* SLA Info card */}
          {slaStatus && !isResolved && (
            <div className={`card p-4 border ${slaStatus.color}`}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">{slaStatus.label}</p>
                  {dispute.slaDeadline && (
                    <p className="text-xs opacity-80">Deadline: {new Date(dispute.slaDeadline).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Link href={`/admin/verifications/${dispute.tradeId}`} className="btn-secondary w-full text-center block">View Trade Details</Link>
        </div>
      </div>
    </div>
  );
}
