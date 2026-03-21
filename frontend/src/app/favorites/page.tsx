'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { favoritesApi, getImageUrl } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing } from '@/types';

const CONDITION_LABELS: Record<string, string> = {
  new: 'common.condition_new',
  like_new: 'common.condition_like_new',
  good: 'common.condition_good',
  fair: 'common.condition_fair',
  poor: 'common.condition_poor',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'badge-emerald',
  locked: 'badge-amber',
  traded: 'badge-blue',
  archived: 'badge-slate',
};

export default function FavoritesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.replace('/login');
      return;
    }
    loadFavorites();
  }, []);

  async function loadFavorites() {
    try {
      const data = await favoritesApi.getMyFavorites();
      setFavorites(data);
    } catch {
      // failed to load
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfavorite(e: React.MouseEvent, listingId: string) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic removal
    setFavorites((prev) => prev.filter((l) => l.id !== listingId));
    try {
      await favoritesApi.toggle(listingId);
    } catch {
      // Re-fetch on error
      loadFavorites();
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-2" />
          <div className="h-5 bg-slate-200 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-[4/3] bg-slate-200 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('favorites.title')}</h1>
        <p className="text-slate-500 mt-1">
          {t('favorites.subtitle', { count: favorites.length })}
        </p>
      </div>

      {/* Empty state */}
      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">{t('favorites.empty_title')}</h2>
          <p className="text-slate-500 mb-6">{t('favorites.empty_desc')}</p>
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
          >
            {t('favorites.browse')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {favorites.map((listing) => {
            const thumb = listing.images?.[0]?.url;
            return (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="card-hover block overflow-hidden relative group"
              >
                {/* Unfavorite button */}
                <button
                  onClick={(e) => handleUnfavorite(e, listing.id)}
                  className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-colors"
                  title={t('favorites.remove')}
                >
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>

                {/* Thumbnail */}
                {thumb ? (
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img src={getImageUrl(thumb)} alt={listing.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 flex-1 mr-2">
                      {listing.title}
                    </h3>
                    <span className={STATUS_STYLES[listing.status] || 'badge-slate'}>
                      {t(`common.status_${listing.status}`)}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      {listing.category?.name && (
                        <span className="text-xs font-medium text-slate-600">
                          {t(`category.${listing.category.name}`)}
                        </span>
                      )}
                    </div>
                    {listing.condition && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {t(CONDITION_LABELS[listing.condition] || listing.condition)}
                      </span>
                    )}
                  </div>

                  {(listing.category || listing.location) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {listing.category && (
                        <span className="text-xs text-slate-400">{t(`category.${listing.category.name}`)}</span>
                      )}
                      {listing.location && (
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {listing.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
