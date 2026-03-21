'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { publicProfileApi, listingsApi, ratingsApi, messagingApi, getImageUrl } from '@/lib/api';
import { isAuthenticated, getUserId } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Profile, TrustScore, Listing, Rating } from '@/types';

const TRUST_COLOR: Record<string, string> = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' };
const TRUST_BG: Record<string, string> = { emerald: '#10B981', amber: '#F59E0B', red: '#EF4444' };

function TrustRing({ score }: { score: number }) {
  const s = Number(score) || 0;
  const clamped = Math.min(100, Math.max(0, s));
  const k = clamped >= 70 ? 'emerald' : clamped >= 40 ? 'amber' : 'red';
  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={TRUST_BG[k]} strokeWidth="3" strokeDasharray={`${clamped}, 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${TRUST_COLOR[k]}`}>{clamped.toFixed(0)}</span>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { t, locale } = useTranslation();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const currentUserId = getUserId();
  const isOwnProfile = currentUserId === userId;

  useEffect(() => {
    if (!userId) return;
    Promise.allSettled([
      publicProfileApi.getProfile(userId),
      publicProfileApi.getTrustScore(userId),
      listingsApi.getByUser(userId),
      ratingsApi.getByUser(userId),
    ]).then(([p, t, l, r]) => {
      if (p.status === 'fulfilled') setProfile(p.value);
      if (t.status === 'fulfilled') setTrust(t.value);
      if (l.status === 'fulfilled') setListings((l.value as Listing[]).filter((x) => x.status === 'active'));
      if (r.status === 'fulfilled') setRatings(r.value as Rating[]);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-6"><div className="flex gap-5"><div className="skeleton w-20 h-20 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-6 w-40" /><div className="skeleton h-4 w-24" /></div></div></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('public_profile.not_found')}</h2>
        <Link href="/listings" className="btn-primary">{t('public_profile.browse')}</Link>
      </div>
    );
  }

  const trustScore = Number(trust?.score ?? 0);
  const trustKey = trustScore >= 70 ? 'emerald' : trustScore >= 40 ? 'amber' : 'red';
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/listings" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('public_profile.back')}
      </Link>

      {/* Profile Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
              <span className="text-white text-2xl font-bold">{profile.displayName[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{profile.displayName}</h1>
            {profile.location && (
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {profile.location}
              </p>
            )}
            {profile.bio && <p className="text-sm text-slate-600 mt-2">{profile.bio}</p>}
            <p className="text-xs text-slate-400 mt-2">{t('public_profile.member_since', { date: new Date(profile.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long' }) })}</p>
            {!isOwnProfile && (
              <button
                onClick={async () => {
                  if (!isAuthenticated()) { window.location.href = '/login'; return; }
                  setStartingChat(true);
                  try {
                    const convo = await messagingApi.createConversation(userId);
                    window.location.href = `/messages/${convo.id}`;
                  } catch { setStartingChat(false); }
                }}
                disabled={startingChat}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {startingChat ? t('public_profile.opening') : t('public_profile.send_message')}
              </button>
            )}
          </div>
          {trust && <TrustRing score={trust.score} />}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{profile.totalTrades}</div>
          <div className="text-xs text-slate-500">{t('public_profile.total_trades')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{profile.completedTrades}</div>
          <div className="text-xs text-slate-500">{t('public_profile.completed')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className={`text-2xl font-bold ${TRUST_COLOR[trustKey]}`}>{trustScore.toFixed(0)}</div>
          <div className="text-xs text-slate-500">{t('public_profile.trust_score')}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
          <div className="text-xs text-slate-500">{t('public_profile.avg_rating')}</div>
        </div>
      </div>

      {/* Active Listings */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('public_profile.active_listings', { count: listings.length })}</h2>
        {listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l) => (
              <Link key={l.id} href={`/listings/${l.id}`} className="card-hover block overflow-hidden">
                <div className="aspect-[4/3] bg-slate-100">
                  {l.images?.[0]?.url ? (
                    <img src={getImageUrl(l.images[0].url)} alt={l.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-900 truncate">{l.title}</p>
                  {l.category?.name && <p className="text-xs text-slate-500 mt-0.5">{t(`category.${l.category.name}`)}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-slate-400">{t('public_profile.no_listings')}</div>
        )}
      </div>

      {/* Ratings */}
      {ratings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('public_profile.recent_ratings')}</h2>
          <div className="space-y-3">
            {ratings.slice(0, 10).map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className={`w-4 h-4 ${s <= r.score ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
                </div>
                {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
