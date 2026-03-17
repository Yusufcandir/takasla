'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isAuthenticated, getUserId } from '@/lib/auth';
import { tradesApi, offersApi, listingsApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Trade } from '@/types';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ trades: 0, activeTrades: 0, listings: 0, offersSent: 0, offersReceived: 0 });
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = getUserId();

  useEffect(() => {
    if (!isAuthenticated()) { window.location.replace('/login'); return; }
    if (!currentUserId) return;

    Promise.allSettled([
      tradesApi.getMyTrades(),
      listingsApi.getAll(),
      offersApi.getMyOffers(),
    ]).then(([trades, listings, offers]) => {
      const tradeList = trades.status === 'fulfilled' ? trades.value as Trade[] : [];
      const activeCount = tradeList.filter((t) => !['COMPLETED', 'CANCELLED', 'REVOKED'].includes(t.state)).length;

      setStats({
        trades: tradeList.length,
        activeTrades: activeCount,
        listings: listings.status === 'fulfilled' ? (listings.value as { total: number }).total : 0,
        offersSent: offers.status === 'fulfilled' ? (offers.value as { sent: unknown[] }).sent.length : 0,
        offersReceived: offers.status === 'fulfilled' ? (offers.value as { received: unknown[] }).received.length : 0,
      });
      setRecentTrades(tradeList.slice(0, 5));
      setLoading(false);
    });
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="skeleton h-8 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-8 w-12 mb-2" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const STATE_DOT: Record<string, string> = {
    COMPLETED: 'bg-emerald-500',
    CANCELLED: 'bg-slate-400',
    REVOKED: 'bg-red-500',
    DISPUTE_OPEN: 'bg-red-500',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/trades" className="card-hover p-5 block">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900">{stats.activeTrades}</span>
          <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.active_trades')}</p>
        </Link>

        <Link href="/listings" className="card-hover p-5 block">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900">{stats.listings}</span>
          <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.listings')}</p>
        </Link>

        <Link href="/offers" className="card-hover p-5 block">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900">{stats.offersSent}</span>
          <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.offers_sent')}</p>
        </Link>

        <Link href="/offers" className="card-hover p-5 block">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900">{stats.offersReceived}</span>
          <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.offers_received')}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Trades */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t('dashboard.recent_trades')}</h2>
            <Link href="/trades" className="text-xs text-navy-900 hover:underline">{t('dashboard.view_all')}</Link>
          </div>
          {recentTrades.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              {t('dashboard.no_trades')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTrades.map((trade) => (
                <Link
                  key={trade.id}
                  href={`/trades/${trade.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${STATE_DOT[trade.state] || 'bg-amber-500 animate-pulse'}`} />
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {t('dashboard.trade_id', { id: trade.id.slice(0, 8) })}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">{trade.riskLevel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {t(`state.${trade.state}`)}
                    </span>
                    <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">{t('dashboard.quick_actions')}</h2>
          </div>
          <div className="p-4 space-y-2">
            <Link href="/listings/create" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 block">{t('dashboard.action_create')}</span>
                <span className="text-xs text-slate-400">{t('dashboard.action_create_desc')}</span>
              </div>
            </Link>
            <Link href="/listings" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 block">{t('dashboard.action_browse')}</span>
                <span className="text-xs text-slate-400">{t('dashboard.action_browse_desc')}</span>
              </div>
            </Link>
            <Link href="/offers" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 block">{t('dashboard.action_offers')}</span>
                <span className="text-xs text-slate-400">{t('dashboard.action_offers_desc')}</span>
              </div>
            </Link>
            <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700 block">{t('dashboard.action_profile')}</span>
                <span className="text-xs text-slate-400">{t('dashboard.action_profile_desc')}</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
