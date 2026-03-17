'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { offersApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Offer } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-amber',
  accepted: 'badge-emerald',
  rejected: 'badge-red',
  countered: 'badge-blue',
  expired: 'badge-slate',
  cancelled: 'badge-slate',
};

function OfferCard({
  offer,
  isReceived,
  onAccept,
  onReject,
}: {
  offer: Offer;
  isReceived: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  // Navigate to the listing the user is most interested in:
  // Received offers → show what's being offered to you
  // Sent offers → show the listing you made an offer on
  const cardHref = isReceived
    ? `/listings/${offer.offeredListingId}`
    : `/listings/${offer.listingId}`;

  return (
    <div
      className="card-hover p-5 cursor-pointer"
      onClick={() => router.push(cardHref)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900">
              {isReceived ? t('offers.incoming_offer') : t('offers.your_offer')}
            </span>
            <span className={STATUS_BADGE[offer.status] || 'badge-slate'}>
              {t(`common.status_${offer.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Link href={`/listings/${offer.listingId}`} className="hover:text-navy-900" onClick={(e) => e.stopPropagation()}>
              {t('offers.target', { id: offer.listingId.slice(0, 8) })}
            </Link>
            <span>&harr;</span>
            <Link href={`/listings/${offer.offeredListingId}`} className="hover:text-navy-900" onClick={(e) => e.stopPropagation()}>
              {t('offers.offered', { id: offer.offeredListingId.slice(0, 8) })}
            </Link>
          </div>
        </div>
      </div>

      {offer.message && (
        <div className="border-l-2 border-slate-200 pl-3 mb-3">
          <p className="text-sm text-slate-600">{offer.message}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {new Date(offer.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {offer.expiresAt && ` · ${t('offers.expires', { date: new Date(offer.expiresAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US') })}`}
        </span>

        {isReceived && offer.status === 'pending' && onAccept && onReject && (
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onAccept(offer.id); }} className="btn-emerald btn-sm">
              {t('offers.accept')}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onReject(offer.id); }} className="btn-secondary btn-sm text-red-600 hover:text-red-700">
              {t('offers.reject')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OffersPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState<Offer[]>([]);
  const [received, setReceived] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  useEffect(() => {
    offersApi
      .getMyOffers()
      .then((data) => {
        setSent(data.sent);
        setReceived(data.received);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load offers'))
      .finally(() => setLoading(false));
  }, []);

  const handleAccept = async (id: string) => {
    try {
      await offersApi.accept(id);
      setReceived((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'accepted' as const } : o)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept offer');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await offersApi.reject(id);
      setReceived((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'rejected' as const } : o)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject offer');
    }
  };

  const activeList = tab === 'received' ? received : sent;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('offers.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('offers.summary', { received: received.length, sent: sent.length })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('received')}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${
            tab === 'received' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('offers.tab_received', { count: received.length })}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${
            tab === 'sent' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('offers.tab_sent', { count: sent.length })}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-4 w-32 mb-2" />
              <div className="skeleton h-3 w-64 mb-4" />
              <div className="skeleton h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {!loading && activeList.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {tab === 'received' ? t('offers.empty_received') : t('offers.empty_sent')}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
          </p>
          <Link href="/listings" className="btn-primary">{t('offers.browse')}</Link>
        </div>
      )}

      {!loading && activeList.length > 0 && (
        <div className="space-y-3">
          {activeList.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              isReceived={tab === 'received'}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
