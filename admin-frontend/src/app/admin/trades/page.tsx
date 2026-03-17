'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { Trade } from '@/types';

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  ACCEPTED: { bg: 'bg-blue-50', text: 'text-blue-700' },
  LOCKED: { bg: 'bg-amber-50', text: 'text-amber-700' },
  PROOF_SUBMITTED: { bg: 'bg-orange-50', text: 'text-orange-700' },
  UNDER_VERIFICATION: { bg: 'bg-purple-50', text: 'text-purple-700' },
  VERIFIED: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  DISPUTE_OPEN: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500' },
  REVOKED: { bg: 'bg-red-50', text: 'text-red-700' },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700' },
};

const TERMINAL_STATES = ['COMPLETED', 'CANCELLED', 'REVOKED'];

type FilterType = 'all' | 'active' | 'completed' | 'cancelled';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled / Revoked' },
];

function filterTrades(trades: Trade[], filter: FilterType): Trade[] {
  switch (filter) {
    case 'active':
      return trades.filter((t) => !TERMINAL_STATES.includes(t.state));
    case 'completed':
      return trades.filter((t) => t.state === 'COMPLETED');
    case 'cancelled':
      return trades.filter((t) => t.state === 'CANCELLED' || t.state === 'REVOKED');
    default:
      return trades;
  }
}

function TradesContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';

  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getAllTrades()
      .then(setTrades)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterTrades(trades, filter);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">All Trades</h1>
        <span className="badge-slate">{filtered.length} trades</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-amber-100 text-amber-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-60">
              {filterTrades(trades, f.key).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          <p className="text-slate-500">No trades found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((trade) => {
            const stateStyle = STATE_COLORS[trade.state] || { bg: 'bg-slate-50', text: 'text-slate-700' };
            const riskStyle = RISK_COLORS[trade.riskLevel] || RISK_COLORS.LOW;
            return (
              <Link
                key={trade.id}
                href={`/admin/verifications/${trade.id}`}
                className="card-hover flex items-center justify-between px-5 py-4 block"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${riskStyle.bg}`}>
                    <span className={`text-xs font-bold ${riskStyle.text}`}>{trade.riskLevel[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Trade #{trade.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">
                      {trade.partyAId.slice(0, 8)}... vs {trade.partyBId.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stateStyle.bg} ${stateStyle.text}`}>
                    {trade.state.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${riskStyle.bg} ${riskStyle.text}`}>
                    {trade.riskLevel}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(trade.createdAt).toLocaleDateString()}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminTradesPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl mb-3" />)}
      </div>
    }>
      <TradesContent />
    </Suspense>
  );
}
