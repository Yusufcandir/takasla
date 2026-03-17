'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { disputesApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Dispute } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-amber',
  under_review: 'badge-blue',
  resolved: 'badge-emerald',
  escalated: 'badge-red',
  closed: 'badge-slate',
};

export default function DisputesPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="skeleton h-8 w-48 mb-6" /></div>}>
      <DisputesContent />
    </Suspense>
  );
}

function DisputesContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [tradeIdInput, setTradeIdInput] = useState(searchParams.get('tradeId') || '');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tradeIdInput) {
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tradeIdInput.trim()) return;
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const results = await disputesApi.getByTrade(tradeIdInput.trim());
      setDisputes(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('disputes.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('disputes.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="card p-5 mb-8">
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">{t('disputes.trade_id_label')}</label>
            <input
              type="text"
              value={tradeIdInput}
              onChange={(e) => setTradeIdInput(e.target.value)}
              placeholder={t('disputes.trade_id_placeholder')}
              className="input font-mono text-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary shrink-0">
            {loading ? t('disputes.searching') : t('disputes.search')}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          {t('disputes.search_hint')}{' '}
          <Link href="/trades" className="text-navy-900 hover:underline">{t('disputes.search_hint_link')}</Link> {t('disputes.search_hint_suffix')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {searched && !loading && disputes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">{t('disputes.no_results')}</p>
        </div>
      )}

      {disputes.length > 0 && (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <Link
              key={dispute.id}
              href={`/disputes/${dispute.id}`}
              className="card-hover p-5 flex items-center justify-between block"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {t('disputes.trade_id_display', { id: dispute.tradeId.slice(0, 8) })}
                  </span>
                  <span className={STATUS_BADGE[dispute.status] || 'badge-slate'}>
                    {dispute.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {t('disputes.reason', { reason: dispute.reason.replace(/_/g, ' ') })}
                </p>
                {dispute.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {dispute.description}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-xs text-slate-400 block">
                  {new Date(dispute.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-xs text-slate-400">
                  {t('disputes.evidence_count', { count: dispute.evidence.length })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
