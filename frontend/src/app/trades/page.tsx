'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { tradesApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Trade } from '@/types';

const STATE_BADGE: Record<string, string> = {
  INITIATED: 'badge-slate',
  OFFERED: 'badge-blue',
  ACCEPTED: 'badge-emerald',
  LOCKED: 'badge-amber',
  PROOF_SUBMITTED: 'badge-amber',
  UNDER_VERIFICATION: 'badge-blue',
  VERIFIED: 'badge-emerald',
  DISPUTE_OPEN: 'badge-red',
  COMPLETED: 'badge-emerald',
  CANCELLED: 'badge-slate',
  REVOKED: 'badge-red',
};

const RISK_BADGE: Record<string, string> = {
  LOW: 'badge-emerald',
  MEDIUM: 'badge-amber',
  HIGH: 'badge-red',
};

export default function TradesPage() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFilter = (['all', 'active', 'completed'] as const).includes(searchParams.get('filter') as any)
    ? (searchParams.get('filter') as 'all' | 'active' | 'completed')
    : 'all';
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>(initialFilter);

  useEffect(() => {
    tradesApi
      .getMyTrades()
      .then(setTrades)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = trades.filter((t) => {
    if (filter === 'active') return !['COMPLETED', 'CANCELLED', 'REVOKED'].includes(t.state);
    if (filter === 'completed') return ['COMPLETED', 'CANCELLED', 'REVOKED'].includes(t.state);
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('trades.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('trades.subtitle', { count: trades.length })}</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-soft'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(`trades.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 flex items-center justify-between">
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('trades.empty_title')}</h3>
          <p className="text-slate-500 text-sm mb-6">{t('trades.empty_desc')}</p>
          <Link href="/listings" className="btn-primary">{t('trades.browse')}</Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((trade) => (
            <Link key={trade.id} href={`/trades/${trade.id}`} className="card-hover p-5 flex items-center justify-between block">
              <div className="flex items-center gap-4">
                {/* State indicator dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  trade.state === 'COMPLETED' ? 'bg-emerald-500'
                    : trade.state === 'CANCELLED' || trade.state === 'REVOKED' ? 'bg-slate-400'
                    : trade.state === 'DISPUTE_OPEN' ? 'bg-red-500'
                    : 'bg-amber-500 animate-pulse'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {t('trades.trade_id', { id: trade.id.slice(0, 8) })}
                    </span>
                    <span className={RISK_BADGE[trade.riskLevel] || 'badge-slate'}>
                      {trade.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400">
                      {new Date(trade.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {trade.riskScore !== undefined && trade.riskScore !== null && (
                      <span className="text-xs text-slate-400">
                        {t('trades.risk_score', { score: (trade.riskScore * 100).toFixed(0) })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={STATE_BADGE[trade.state] || 'badge-slate'}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${
                    trade.state === 'COMPLETED' ? 'bg-emerald-500'
                      : trade.state === 'CANCELLED' || trade.state === 'REVOKED' ? 'bg-slate-400'
                      : trade.state === 'DISPUTE_OPEN' ? 'bg-red-500'
                      : 'bg-current'
                  }`} />
                  {t(`state.${trade.state}`)}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
