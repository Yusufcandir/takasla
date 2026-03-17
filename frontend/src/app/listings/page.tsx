'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listingsApi, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  active: 'badge-emerald',
  locked: 'badge-amber',
  traded: 'badge-blue',
  archived: 'badge-slate',
};

const CONDITION_KEYS: Record<string, string> = {
  new: 'common.condition_new',
  like_new: 'common.condition_like_new',
  good: 'common.condition_good',
  fair: 'common.condition_fair',
  poor: 'common.condition_poor',
};

const STATUS_KEYS: Record<string, string> = {
  active: 'common.status_active',
  locked: 'common.status_locked',
  traded: 'common.status_traded',
  archived: 'common.status_archived',
};

function ListingsContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const { t, locale } = useTranslation();

  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    if (userId) {
      listingsApi
        .getByUser(userId)
        .then((data) => {
          setListings(data);
          setTotal(data.length);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      listingsApi
        .getAll(page, limit)
        .then((data) => {
          setListings(data.items);
          setTotal(data.total);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [page, userId]);

  const filtered = search
    ? listings.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : listings;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{userId ? t('listings.title_my') : t('listings.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{userId ? t('listings.subtitle_my', { total }) : t('listings.subtitle', { total })}</p>
        </div>
        <Link href="/listings/create" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('listings.create_listing')}
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('listings.search_placeholder')}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton aspect-[4/3]" />
              <div className="p-4 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('listings.empty_title')}</h3>
          <p className="text-slate-500 text-sm mb-6">
            {search ? t('listings.empty_search_hint') : t('listings.empty_default_hint')}
          </p>
          <Link href="/listings/create" className="btn-primary">
            {t('listings.create_listing')}
          </Link>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((listing) => {
              const thumb = listing.images?.[0]?.url;
              return (
              <Link key={listing.id} href={`/listings/${listing.id}`} className={`card-hover block overflow-hidden ${listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil) > new Date() ? 'ring-2 ring-amber-200' : ''}`}>
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
                    {listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil) > new Date() && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 mr-1">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        {listing.isSpotlight ? t('common.spotlight') : t('common.featured')}
                      </span>
                    )}
                    <span className={STATUS_STYLES[listing.status] || 'badge-slate'}>
                      {listing.status}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    {listing.category?.name && (
                      <span className="text-xs font-medium text-slate-600">{listing.category.name}</span>
                    )}
                    {listing.condition && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {t('condition.' + listing.condition) || listing.condition}
                      </span>
                    )}
                  </div>

                  {(listing.category || listing.location) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {listing.category && (
                        <span className="text-xs text-slate-400">{listing.category.name}</span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-slate-500 px-3">
                {t('common.page_of', { page, totalPages })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary btn-sm"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="skeleton h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton aspect-[4/3]" />
              <div className="p-4 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <ListingsContent />
    </Suspense>
  );
}
