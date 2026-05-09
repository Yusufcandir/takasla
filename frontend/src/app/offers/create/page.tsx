'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listingsApi, offersApi, getImageUrl } from '@/lib/api';
import { isAuthenticated, getUserId } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing } from '@/types';

function CreateOfferContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const listingId = searchParams.get('listingId') || '';
  const ownerId = searchParams.get('ownerId') || '';

  const [targetListing, setTargetListing] = useState<Listing | null>(null);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { window.location.href = '/login'; return; }
    if (!listingId) { window.location.href = '/listings'; return; }

    const userId = getUserId();
    Promise.allSettled([
      listingsApi.getById(listingId),
      userId ? listingsApi.getByUser(userId) : Promise.reject('no user'),
    ]).then(([target, mine]) => {
      if (target.status === 'fulfilled') setTargetListing(target.value);
      else { setError('Could not load listing.'); }

      if (mine.status === 'fulfilled') {
        const active = (mine.value as Listing[]).filter((l) => l.status === 'active');
        setMyListings(active);
      }
    }).finally(() => setLoading(false));
  }, [listingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListingId) { setError(t('offers_create.error_no_listing')); return; }
    setError('');
    setSubmitting(true);
    try {
      await offersApi.create({
        listingId,
        offeredListingId: selectedListingId,
        listingOwnerId: ownerId,
        message: message || undefined,
      });
      window.location.href = '/offers';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send offer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-5 mb-6">
          <div className="skeleton h-4 w-2/3 mb-3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-5 skeleton h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <Link
          href={listingId ? `/listings/${listingId}` : '/listings'}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('offers_create.back')}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t('offers_create.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('offers_create.subtitle')}</p>
      </div>

      {/* Target Listing */}
      {targetListing && (
        <div className="card p-4 mb-6">
          <p className="text-xs text-slate-400 mb-2">{t('offers_create.offering_for')}</p>
          <div className="flex items-center gap-4">
            {targetListing.images?.[0]?.url && (
              <img
                src={getImageUrl(targetListing.images[0].url)}
                alt={targetListing.title}
                loading="lazy"
                decoding="async"
                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
              />
            )}
            <div>
              <p className="font-semibold text-slate-900 text-sm">{targetListing.title}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {targetListing.category?.name || ''}
                {targetListing.location && ` · ${targetListing.location}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Select your listing */}
        <div>
          <label className="label">{t('offers_create.your_listing')}</label>
          {myListings.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{t('offers_create.no_listings_title')}</h3>
              <p className="text-slate-500 text-sm mb-4">{t('offers_create.no_listings_desc')}</p>
              <Link href="/listings/create" className="btn-primary">
                {t('offers_create.create_first')}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myListings.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedListingId(l.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedListingId === l.id
                      ? 'border-navy-900 bg-navy-900/5'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {l.images?.[0]?.url ? (
                      <img
                        src={getImageUrl(l.images[0].url)}
                        alt={l.title}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{l.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {l.category?.name || ''}
                        {l.condition && ` · ${l.condition.replace('_', ' ')}`}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      selectedListingId === l.id
                        ? 'border-navy-900 bg-navy-900'
                        : 'border-slate-300'
                    }`}>
                      {selectedListingId === l.id && (
                        <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Optional message */}
        {myListings.length > 0 && (
          <div>
            <label className="label">{t('offers_create.message')} <span className="text-slate-400 font-normal">{t('offers_create.message_optional')}</span></label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input min-h-[80px] resize-y"
              placeholder={t('offers_create.message_placeholder')}
              rows={3}
            />
          </div>
        )}

        {myListings.length > 0 && (
          <button
            type="submit"
            disabled={submitting || !selectedListingId}
            className="btn-primary w-full"
          >
            {submitting ? t('offers_create.sending') : t('offers_create.submit')}
          </button>
        )}
      </form>
    </div>
  );
}

export default function CreateOfferPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
      </div>
    }>
      <CreateOfferContent />
    </Suspense>
  );
}
