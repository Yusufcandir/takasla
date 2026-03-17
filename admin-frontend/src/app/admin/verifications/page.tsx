'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { Trade } from '@/types';

const RISK_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  PROOF_SUBMITTED: { bg: 'bg-orange-50', text: 'text-orange-700' },
  UNDER_VERIFICATION: { bg: 'bg-purple-50', text: 'text-purple-700' },
  VERIFIED: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  AWAITING_SHIPMENT: { bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_TRANSIT: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  DELIVERED: { bg: 'bg-teal-50', text: 'text-teal-700' },
  DISPUTE_OPEN: { bg: 'bg-red-50', text: 'text-red-700' },
};
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700' },
};

export default function VerificationQueuePage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getAllTrades()
      .then((all) => {
        const activeStates = ['PROOF_SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED', 'DISPUTE_OPEN'];
        const pending = all
          .filter((t) => activeStates.includes(t.state))
          .sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9));
        setTrades(pending);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-64 mb-6" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Verification Queue</h1>
        <span className="badge-amber">{trades.length} pending</span>
      </div>

      {trades.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-emerald-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-slate-500">No trades awaiting verification</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => {
            const stateStyle = STATE_COLORS[trade.state] || { bg: 'bg-slate-50', text: 'text-slate-700' };
            const riskStyle = RISK_COLORS[trade.riskLevel] || RISK_COLORS.LOW;
            return (
              <Link key={trade.id} href={`/admin/verifications/${trade.id}`} className="card-hover flex items-center justify-between px-5 py-4 block">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${riskStyle.bg}`}>
                    <span className={`text-xs font-bold ${riskStyle.text}`}>{trade.riskLevel[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Trade #{trade.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{trade.partyAId.slice(0, 8)}... vs {trade.partyBId.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stateStyle.bg} ${stateStyle.text}`}>{trade.state.replace(/_/g, ' ')}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${riskStyle.bg} ${riskStyle.text}`}>{trade.riskLevel}</span>
                  <span className="text-xs text-slate-400">{new Date(trade.createdAt).toLocaleDateString()}</span>
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
