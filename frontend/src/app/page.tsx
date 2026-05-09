'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import { listingsApi, getImageUrl, api } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing, Profile } from '@/types';

const conditionKeyMap: Record<string, string> = {
  new: 'common.condition_new',
  like_new: 'common.condition_like_new',
  good: 'common.condition_good',
  fair: 'common.condition_fair',
  poor: 'common.condition_poor',
};

/* ───────────────────────── Authenticated Home ───────────────────────── */

function AuthenticatedHome({
  profile,
  recentListings,
  activeTrades,
  pendingOffers,
  searchQuery,
  setSearchQuery,
}: {
  profile: Profile | null;
  recentListings: Listing[];
  activeTrades: number;
  pendingOffers: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const { t, locale } = useTranslation();
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      window.location.href = '/listings?search=' + encodeURIComponent(searchQuery.trim());
    }
  };

  return (
    <div>
      {/* Welcome Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-900">
              {profile?.displayName
                ? t('home.welcome_back', { name: profile.displayName })
                : t('home.welcome_back_generic')}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {t('home.active_trades')}: {activeTrades}
              </span>
              <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-medium px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                {t('home.pending_offers')}: {pendingOffers}
              </span>
              <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                {t('home.messages')}: 0
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder={t('home.search_placeholder')}
            className="w-full text-lg py-3.5 pl-12 pr-4 border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white placeholder-slate-400 transition-shadow"
          />
        </div>
      </section>

      {/* Recent Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">{t('home.recent_listings')}</h2>
          <Link href="/listings" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors">
            {t('home.view_all')} &rarr;
          </Link>
        </div>

        {recentListings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {recentListings.map((listing) => {
              const thumb = listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url;
              return (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="block bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {thumb ? (
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={getImageUrl(thumb)}
                        alt={listing.title}
                        className="w-full h-full object-cover" loading="lazy" decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                      <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 mb-1">
                      {listing.title}
                    </h3>
                    <div className="flex items-end justify-between">
                      {listing.category?.name && (
                        <span className="text-xs font-medium text-slate-600">{t(`category.${listing.category.name}`)}</span>
                      )}
                      {listing.condition && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {t(conditionKeyMap[listing.condition] || listing.condition)}
                        </span>
                      )}
                    </div>
                    {listing.location && (
                      <p className="text-xs text-slate-400 mt-1.5 truncate">{listing.location}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200/60">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-slate-500 text-sm">{t('home.no_listings')}</p>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-4">
        <div className="grid md:grid-cols-3 gap-5">
          {/* Create Listing */}
          <Link
            href="/listings/create"
            className="block bg-white rounded-xl border border-slate-200/60 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{t('home.quick_create_listing')}</h3>
            <p className="text-slate-500 text-sm">{t('home.quick_create_listing_desc')}</p>
          </Link>

          {/* My Trades */}
          <Link
            href="/trades"
            className="block bg-white rounded-xl border border-slate-200/60 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{t('home.quick_my_trades')}</h3>
            <p className="text-slate-500 text-sm">{t('home.quick_my_trades_desc')}</p>
          </Link>

          {/* Messages */}
          <Link
            href="/messages"
            className="block bg-white rounded-xl border border-slate-200/60 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{t('home.quick_messages')}</h3>
            <p className="text-slate-500 text-sm">{t('home.quick_messages_desc')}</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────── Marketing Home ───────────────────────────── */

function MarketingHome({ spotlightListings }: { spotlightListings: Listing[] }) {
  const { t } = useTranslation();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-slow" />
              <span className="text-emerald-400 text-sm font-medium">Blockchain-anchored trust</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Trade high-value goods
              <span className="text-emerald-400"> with confidence</span>
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
              Risk-based escrow, proof verification, and blockchain-anchored certificates
              ensure trust in every exchange. From luxury watches to rare collectibles.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/listings"
                className="btn-lg bg-emerald-500 text-white hover:bg-emerald-400 px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              >
                Browse Listings
              </Link>
              <Link
                href="/register"
                className="btn-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 py-3.5 rounded-xl text-base font-semibold transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Spotlight Listings */}
      {spotlightListings.length > 0 && (
        <section className="bg-gradient-to-b from-amber-50/50 to-transparent border-b border-amber-100/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Spotlight</h2>
              <span className="text-sm text-amber-600 font-medium">Featured items</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {spotlightListings.map((listing) => {
                const thumb = listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url;
                return (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="card-hover block overflow-hidden ring-2 ring-amber-200 rounded-xl"
                  >
                    {thumb ? (
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <img src={getImageUrl(thumb)} alt={listing.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 flex-1 mr-2">
                          {listing.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                          Spotlight
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        {listing.category?.name && (
                          <span className="text-xs font-medium text-slate-600">{t(`category.${listing.category.name}`)}</span>
                        )}
                        {listing.condition && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {listing.condition.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Three simple steps to a secure, verified exchange
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div className="hidden md:block flex-1 h-px bg-slate-200" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">List & Offer</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              List your item with photos and details. Browse others and make trade offers.
              Our risk engine evaluates each potential exchange automatically.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div className="hidden md:block flex-1 h-px bg-slate-200" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Lock & Verify</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Both parties lock their items into escrow. Submit proof photos and documentation.
              Higher-risk trades get additional verification steps.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Complete & Certify</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Trade completes with a dispute window for safety. Blockchain-anchored certificates
              prove authenticity. Your trust score grows with each successful exchange.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Built for Trust</h2>
            <p className="mt-3 text-slate-500 max-w-lg mx-auto">
              Every feature designed to make high-value exchanges safe
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Risk Assessment</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Automatic risk scoring based on item value, category, and user reputation. Higher risk means more verification.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Process Escrow</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Multi-stage workflow ensures both parties follow through. Items are locked, proofs verified, before trade completes.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Blockchain Certificates</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Merkle tree hash anchoring on Ethereum Sepolia. Tamper-proof certificates prove trade authenticity forever.
              </p>
            </div>

            <div className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">Dispute Resolution</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Structured dispute process with evidence upload and moderator review. Fair outcomes with clear timelines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-navy-900 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to trade with confidence?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Join the platform where every exchange is protected by risk-based escrow and blockchain verification.
            </p>
            <Link
              href="/register"
              className="inline-flex bg-emerald-500 text-white hover:bg-emerald-400 px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-500/25"
            >
              Create Your Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────── Main Page ──────────────────────────────── */

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [activeTrades, setActiveTrades] = useState(0);
  const [pendingOffers, setPendingOffers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightListings, setSpotlightListings] = useState<Listing[]>([]);

  useEffect(() => {
    const loggedIn = isAuthenticated();
    setAuthed(loggedIn);

    if (loggedIn) {
      // Fetch profile
      api.get<Profile>('/profiles/me').then(setProfile).catch(() => {});
      // Fetch recent listings
      listingsApi.getAll(1, 8).then((data) => setRecentListings(data.items)).catch(() => {});
      // Count active trades
      api.get<any[]>('/trades').then((trades) => {
        setActiveTrades(
          trades.filter(
            (t) => !['COMPLETED', 'CANCELLED', 'REVOKED'].includes(t.state),
          ).length,
        );
      }).catch(() => {});
      // Count pending offers
      api.get<{ sent: any[]; received: any[] }>('/offers/my').then((data) => {
        setPendingOffers(
          data.received.filter((o) => o.status === 'pending').length,
        );
      }).catch(() => {});
    } else {
      // For logged-out: load spotlight
      listingsApi.getSpotlight().then(setSpotlightListings).catch(() => {});
    }
  }, []);

  if (authed) {
    return (
      <AuthenticatedHome
        profile={profile}
        recentListings={recentListings}
        activeTrades={activeTrades}
        pendingOffers={pendingOffers}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  }

  return <MarketingHome spotlightListings={spotlightListings} />;
}
