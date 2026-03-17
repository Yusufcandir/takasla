'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { Dispute } from '@/types';

const REASON_COLORS: Record<string, string> = {
  item_mismatch: 'badge-amber', not_received: 'badge-red', damaged: 'badge-red', counterfeit: 'badge-red', other: 'badge-slate',
};

function getSlaIndicator(dispute: Dispute): { label: string; color: string } | null {
  if (!dispute.slaDeadline) return null;
  const diff = new Date(dispute.slaDeadline).getTime() - Date.now();
  if (diff <= 0) return { label: 'SLA Breached', color: 'bg-red-100 text-red-700' };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 12) return { label: `${hours}h left`, color: 'bg-amber-100 text-amber-700' };
  return { label: `${hours}h left`, color: 'bg-emerald-100 text-emerald-700' };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getOpenDisputes()
      .then(setDisputes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load disputes'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl mb-3" />)}
      </div>
    );
  }

  // Sort: SLA breached first, then by deadline ascending
  const sorted = [...disputes].sort((a, b) => {
    const aDeadline = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
    const bDeadline = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
    return aDeadline - bDeadline;
  });

  const breachedCount = disputes.filter(d => d.slaDeadline && new Date(d.slaDeadline).getTime() < Date.now()).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Open Disputes</h1>
        <span className="badge-red">{disputes.length} open</span>
        {breachedCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
            {breachedCount} SLA breached
          </span>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {disputes.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-emerald-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-slate-500">No open disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((dispute) => {
            const sla = getSlaIndicator(dispute);
            return (
              <Link key={dispute.id} href={`/admin/disputes/${dispute.id}`} className="card-hover flex items-center justify-between px-5 py-4 block">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    dispute.status === 'escalated' ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    {dispute.status === 'escalated' ? (
                      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">Dispute #{dispute.id.slice(0, 8)}</p>
                      {dispute.status === 'escalated' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ESCALATED</span>
                      )}
                      {dispute.appealStatus === 'pending' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">APPEAL</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Trade: {dispute.tradeId.slice(0, 8)}... &middot; {dispute.evidence?.length || 0} evidence items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sla && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sla.color}`}>{sla.label}</span>
                  )}
                  <span className={REASON_COLORS[dispute.reason] || 'badge-slate'}>{dispute.reason.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-400">{new Date(dispute.createdAt).toLocaleDateString()}</span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
