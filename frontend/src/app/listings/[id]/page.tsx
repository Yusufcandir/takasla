'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listingsApi, publicProfileApi, questionsApi, favoritesApi, paymentsApi, messagingApi, reportsApi, getImageUrl, QAQuestion } from '@/lib/api';
import { getUserId, isAuthenticated } from '@/lib/auth';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing, Profile, TrustScore } from '@/types';

const STATUS_STYLES: Record<string, string> = { active: 'badge-emerald', locked: 'badge-amber', traded: 'badge-blue', archived: 'badge-slate' };

const TRUST_COLOR: Record<string, string> = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' };
const TRUST_BG: Record<string, string> = { emerald: '#10B981', amber: '#F59E0B', red: '#EF4444' };

type Question = QAQuestion;

function TrustRing({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Number(score)));
  const colorKey = clamped >= 70 ? 'emerald' : clamped >= 40 ? 'amber' : 'red';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={TRUST_BG[colorKey]} strokeWidth="3" strokeDasharray={`${clamped}, 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${TRUST_COLOR[colorKey]}`}>{clamped.toFixed(0)}</span>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const listingId = params.id as string;
  const currentUserId = getUserId();
  const authed = isAuthenticated();
  const boostStatus = searchParams.get('boost');

  const [listing, setListing] = useState<Listing | null>(null);
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null);
  const [sellerTrust, setSellerTrust] = useState<TrustScore | null>(null);
  const [sellerListings, setSellerListings] = useState<Listing[]>([]);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [askerProfiles, setAskerProfiles] = useState<Record<string, Profile>>({});
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Q&A state
  const [newQuestion, setNewQuestion] = useState('');
  const [submittingQ, setSubmittingQ] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [submittingA, setSubmittingA] = useState(false);

  // Threaded Q&A state
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [threadReplies, setThreadReplies] = useState<Record<string, Question[]>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Boost state
  const [boosting, setBoosting] = useState(false);
  const [boostError, setBoostError] = useState('');

  // Share/report/delete state
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (!listingId) return;
    listingsApi.getById(listingId).then(async (l) => {
      setListing(l);
      setLoading(false);

      // Load everything in parallel
      const promises: Promise<void>[] = [];

      // Seller profile + trust
      promises.push(
        publicProfileApi.getProfile(l.userId).then(setSellerProfile).catch(() => {}),
        publicProfileApi.getTrustScore(l.userId).then(setSellerTrust).catch(() => {}),
      );

      // Seller's other listings
      promises.push(
        listingsApi.getByUser(l.userId).then((all) => {
          setSellerListings(all.filter((x) => x.id !== listingId && x.status === 'active').slice(0, 6));
        }).catch(() => {}),
      );

      // Similar listings
      if (l.categoryId) {
        promises.push(
          api_get_category(l.categoryId).then((items) => {
            setSimilarListings(items.filter((x: Listing) => x.id !== listingId).slice(0, 4));
          }).catch(() => {}),
        );
      }

      // Q&A + asker profiles
      promises.push(
        questionsApi.getAll(listingId).then(async (qs) => {
          setQuestions(qs);
          const allIds: string[] = qs.map((q) => q.askerId);
          qs.forEach((q) => { if (q.firstReply) allIds.push(q.firstReply.askerId); });
          const uniqueAskerIds = [...new Set(allIds)];
          const profiles: Record<string, Profile> = {};
          await Promise.allSettled(
            uniqueAskerIds.map((id) =>
              publicProfileApi.getProfile(id).then((p) => { profiles[id] = p; })
            ),
          );
          setAskerProfiles(profiles);
        }).catch(() => {}),
      );

      // Favorites
      promises.push(favoritesApi.getCount(listingId).then((r) => setFavoriteCount(r.count)).catch(() => {}));
      if (currentUserId) {
        promises.push(favoritesApi.check(listingId, currentUserId).then((r) => setFavorited(r.favorited)).catch(() => {}));
        promises.push(reportsApi.check(listingId).then((r) => setReported(r.reported)).catch(() => {}));
      }

      await Promise.allSettled(promises);
    }).catch(() => setLoading(false));
  }, [listingId, currentUserId]);

  const handleToggleFavorite = async () => {
    if (!authed) { window.location.href = '/login'; return; }
    try {
      const res = await favoritesApi.toggle(listingId);
      setFavorited(res.favorited);
      setFavoriteCount((c) => c + (res.favorited ? 1 : -1));
    } catch {}
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setSubmittingQ(true);
    try {
      await questionsApi.ask(listingId, newQuestion.trim());
      setNewQuestion('');
      const updated = await questionsApi.getAll(listingId);
      setQuestions(updated);
    } catch {}
    setSubmittingQ(false);
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!answerText.trim()) return;
    setSubmittingA(true);
    try {
      await questionsApi.answer(listingId, questionId, answerText.trim());
      const updated = await questionsApi.getAll(listingId);
      setQuestions(updated);
      setAnsweringId(null);
      setAnswerText('');
    } catch {}
    setSubmittingA(false);
  };

  const fetchProfilesForReplies = async (replies: Question[]) => {
    const newIds = replies.map((r) => r.askerId).filter((id) => !askerProfiles[id]);
    const uniqueIds = [...new Set(newIds)];
    if (uniqueIds.length > 0) {
      const profiles: Record<string, Profile> = {};
      await Promise.allSettled(
        uniqueIds.map((id) => publicProfileApi.getProfile(id).then((p) => { profiles[id] = p; })),
      );
      setAskerProfiles((prev) => ({ ...prev, ...profiles }));
    }
  };

  const handleExpandThread = async (questionId: string) => {
    if (!expandedThreads[questionId]) {
      try {
        const replies = await questionsApi.getThread(listingId, questionId);
        setThreadReplies((prev) => ({ ...prev, [questionId]: replies }));
        await fetchProfilesForReplies(replies);
      } catch {}
    }
    setExpandedThreads((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleReply = async (questionId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await questionsApi.reply(listingId, questionId, replyText.trim());
      const [replies, updated] = await Promise.all([
        questionsApi.getThread(listingId, questionId),
        questionsApi.getAll(listingId),
      ]);
      setThreadReplies((prev) => ({ ...prev, [questionId]: replies }));
      setQuestions(updated);
      await fetchProfilesForReplies(replies);
      setReplyText('');
      setReplyingToId(null);
      setExpandedThreads((prev) => ({ ...prev, [questionId]: true }));
    } catch {}
    setSubmittingReply(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReport = async () => {
    if (!authed) { window.location.replace('/login'); return; }
    if (!reportReason) { setReportError(t('report.error_no_reason')); return; }
    setSubmittingReport(true);
    setReportError('');
    try {
      await reportsApi.create(listingId, reportReason, reportDescription.trim() || undefined);
      setReported(true);
      setReportSuccess(true);
      setTimeout(() => { setShowReportModal(false); setReportSuccess(false); }, 2000);
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : t('report.error_generic'));
    }
    setSubmittingReport(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await listingsApi.delete(listingId);
      window.location.href = '/listings';
    } catch { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleBoost = async (tier: 'featured' | 'spotlight') => {
    setBoosting(true);
    setBoostError('');
    try {
      const result = await listingsApi.boost(listingId, tier);
      const checkout = await paymentsApi.createCheckout(result.paymentId);
      if ('simulated' in checkout) {
        // Simulation mode — reload to show updated boost status
        window.location.replace(`/listings/${listingId}?boost=success`);
      } else if ('checkoutUrl' in checkout) {
        window.location.href = (checkout as { checkoutUrl: string }).checkoutUrl;
      }
    } catch (err: unknown) {
      setBoostError(err instanceof Error ? err.message : 'Boost failed');
    }
    setBoosting(false);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2"><div className="skeleton aspect-[4/3] rounded-xl mb-4" /></div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('listing_detail.not_found')}</h2>
        <Link href="/listings" className="btn-primary">{t('listing_detail.not_found_cta')}</Link>
      </div>
    );
  }

  const isOwner = listing.userId === currentUserId;
  const images = listing.images ?? [];
  const trustScore = Number(sellerTrust?.score ?? 0);
  const trustKey = trustScore >= 70 ? 'emerald' : trustScore >= 40 ? 'amber' : 'red';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <Link href="/listings" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('listing_detail.back')}
      </Link>

      {/* Boost status banners */}
      {boostStatus === 'success' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          {t('listing_detail.boost_success')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Images + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div>
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mb-2">
                <img src={getImageUrl(images[activeImage].url)} alt={listing.title} className="w-full h-full object-cover" />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={img.id} onClick={() => setActiveImage(i)}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === activeImage ? 'border-navy-900' : 'border-slate-200 hover:border-slate-400'}`}>
                      <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title + status */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{listing.title}</h1>
              <div className="flex items-center gap-2 shrink-0">
                {listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil) > new Date() && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    {listing.isSpotlight ? t('listing_detail.spotlight_active') : t('listing_detail.featured_active')}
                  </span>
                )}
                <span className={STATUS_STYLES[listing.status] || 'badge-slate'}>{t(`common.status_${listing.status}`)}</span>
              </div>
            </div>

            {/* Authenticity badges */}
            {(listing.hasOriginalPackaging || listing.hasPurchaseReceipt || listing.hasCertificateOfAuthenticity) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {listing.hasOriginalPackaging && <span className="badge-emerald">{t('listing_detail.original_packaging')}</span>}
                {listing.hasPurchaseReceipt && <span className="badge-emerald">{t('listing_detail.receipt')}</span>}
                {listing.hasCertificateOfAuthenticity && <span className="badge-emerald">{t('listing_detail.certificate_auth')}</span>}
              </div>
            )}
          </div>

          {listing.description && (
            <p className="text-slate-600 leading-relaxed">{listing.description}</p>
          )}

          {/* Details card */}
          <div className="card divide-y divide-slate-100">
            {listing.category?.name && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.category')}</span>
                <span className="text-sm font-semibold text-slate-900">{t(`category.${listing.category.name}`)}</span>
              </div>
            )}
            {listing.priceFlexibility && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.price')}</span>
                <span className="text-sm font-medium text-slate-700">{t(`common.flexibility_${listing.priceFlexibility}`)}</span>
              </div>
            )}
            {listing.condition && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.condition_label')}</span>
                <span className="text-sm font-medium text-slate-700">{t(`common.condition_${listing.condition}`)}</span>
              </div>
            )}
            {listing.category && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.category')}</span>
                <span className="badge-navy">{t(`category.${listing.category.name}`)}</span>
              </div>
            )}
            {listing.shippingOption && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.delivery')}</span>
                <span className="text-sm text-slate-700">{listing.shippingOption === 'local_pickup' ? t('common.shipping_local') : listing.shippingOption === 'shipping' ? t('common.shipping_shipping') : t('common.shipping_both')}</span>
              </div>
            )}
            {listing.location && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.location')}</span>
                <span className="text-sm text-slate-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.location}
                </span>
              </div>
            )}
            {(listing.minExchangeValue || listing.maxExchangeValue) && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-500">{t('listing_detail.accepts_offers')}</span>
                <span className="text-sm text-slate-700">
                  {listing.minExchangeValue ? `${Number(listing.minExchangeValue).toLocaleString()} TL` : t('listing_detail.any')}
                  {' – '}
                  {listing.maxExchangeValue ? `${Number(listing.maxExchangeValue).toLocaleString()} TL` : t('listing_detail.any')}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-slate-500">{t('listing_detail.listed')}</span>
              <span className="text-sm text-slate-700">
                {new Date(listing.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Q&A Section */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('listing_detail.qa_title')}</h2>
            {questions.length > 0 ? (
              <div className="space-y-4 mb-4">
                {questions.map((q) => {
                  const asker = askerProfiles[q.askerId];
                  const isExpanded = expandedThreads[q.id];
                  const replies = threadReplies[q.id] || [];
                  const canReply = authed && (currentUserId === q.askerId || isOwner);

                  const renderReplyBubble = (reply: Question) => {
                    const replyAuthor = askerProfiles[reply.askerId];
                    const isSeller = reply.askerId === listing.userId;
                    return (
                      <div key={reply.id} className="flex items-start gap-2 mt-2">
                        <Link href={`/profile/${reply.askerId}`} className="shrink-0 mt-0.5">
                          {replyAuthor?.avatarUrl ? (
                            <img src={replyAuthor.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-slate-500">{replyAuthor?.displayName?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                          )}
                        </Link>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${reply.askerId}`} className="text-xs font-semibold text-slate-900 hover:underline">
                              {replyAuthor?.displayName || t('listing_detail.qa_anonymous')}
                            </Link>
                            {isSeller && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{t('listing_detail.seller')}</span>}
                            <span className="text-[10px] text-slate-400">{new Date(reply.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <p className="text-sm text-slate-700 mt-0.5">{reply.question}</p>
                        </div>
                      </div>
                    );
                  };

                  return (
                  <div key={q.id} className="card p-4">
                    {/* Root question */}
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${q.askerId}`} className="shrink-0 mt-0.5">
                        {asker?.avatarUrl ? (
                          <img src={asker.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-500">{asker?.displayName?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                        )}
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/profile/${q.askerId}`} className="text-sm font-semibold text-slate-900 hover:underline">{asker?.displayName || t('listing_detail.qa_anonymous')}</Link>
                          <span className="text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="text-sm text-slate-700 mt-0.5">{q.question}</p>

                        {/* Legacy answer (backward compat) */}
                        {q.answer && !q.replyCount && (
                          <div className="mt-3 pl-3 border-l-2 border-emerald-300">
                            <p className="text-sm text-slate-700">{q.answer}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              <Link href={`/profile/${listing.userId}`} className="font-medium hover:underline text-slate-500">{sellerProfile?.displayName || t('listing_detail.qa_seller_answered')}</Link>
                              {' — '}{t('listing_detail.qa_seller_answered')}
                            </p>
                          </div>
                        )}

                        {/* Threaded replies */}
                        {q.replyCount > 0 && (
                          <div className="mt-3 pl-3 border-l-2 border-slate-200">
                            {!isExpanded ? (
                              <>
                                {/* Show first reply preview */}
                                {q.firstReply && renderReplyBubble(q.firstReply)}
                                {q.replyCount > 1 && (
                                  <button onClick={() => handleExpandThread(q.id)} className="text-xs text-navy-900 hover:underline mt-2 font-medium">
                                    {t('listing_detail.qa_see_all').replace('{count}', String(q.replyCount))}
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Show all replies */}
                                {replies.map(renderReplyBubble)}
                                <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [q.id]: false }))} className="text-xs text-slate-500 hover:underline mt-2">
                                  {t('listing_detail.qa_collapse')}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Reply input */}
                        {canReply && (
                          <div className="mt-2">
                            {replyingToId === q.id ? (
                              <div className="space-y-2">
                                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input text-sm" placeholder={t('listing_detail.qa_reply_placeholder')} rows={2} />
                                <div className="flex gap-2">
                                  <button onClick={() => handleReply(q.id)} disabled={submittingReply || !replyText.trim()} className="btn-emerald btn-sm">
                                    {submittingReply ? t('listing_detail.qa_replying') : t('listing_detail.qa_post_reply')}
                                  </button>
                                  <button onClick={() => { setReplyingToId(null); setReplyText(''); }} className="btn-secondary btn-sm">{t('listing_detail.qa_cancel')}</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setReplyingToId(q.id); setReplyText(''); }} className="text-xs text-navy-900 hover:underline mt-1">{t('listing_detail.qa_reply')}</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-4">{t('listing_detail.qa_empty')}</p>
            )}
            {authed && !isOwner && (
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <input type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder={t('listing_detail.qa_ask_placeholder')} className="input flex-1 text-sm" />
                <button type="submit" disabled={submittingQ || !newQuestion.trim()} className="btn-secondary btn-sm shrink-0">{t('listing_detail.qa_ask')}</button>
              </form>
            )}
            {!authed && <p className="text-sm text-slate-400"><Link href="/login" className="text-navy-900 hover:underline">{t('listing_detail.qa_sign_in')}</Link></p>}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-4">
          {/* Action Card */}
          <div className="card p-5">
            {isOwner ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="status-dot-green" />
                  <span className="text-sm font-medium text-slate-700">{t('listing_detail.your_listing')}</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">{t('listing_detail.your_listing_desc')}</p>
                <Link href="/offers" className="btn-secondary w-full text-center block mb-2">{t('listing_detail.view_offers')}</Link>

                {/* Boost Section */}
                {listing.status === 'active' && (
                  listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil) > new Date() ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        <span className="text-sm font-medium text-amber-800">
                          {listing.isSpotlight ? t('listing_detail.spotlight_active') : t('listing_detail.featured_active')}
                        </span>
                      </div>
                      <p className="text-xs text-amber-600">
                        {t('listing_detail.until', { date: new Date(listing.featuredUntil).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US') })}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {boostError && (
                        <div className="text-xs text-red-600 bg-red-50 rounded p-2">{boostError}</div>
                      )}
                      <button
                        disabled={boosting}
                        onClick={() => handleBoost('featured')}
                        className="w-full py-2 px-4 text-sm font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        {boosting ? t('listing_detail.boost_processing') : t('listing_detail.boost_featured')}
                      </button>
                      <button
                        disabled={boosting}
                        onClick={() => handleBoost('spotlight')}
                        className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        {boosting ? t('listing_detail.boost_processing') : t('listing_detail.boost_spotlight')}
                      </button>
                    </div>
                  )
                )}

                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                    {t('listing_detail.delete_listing')}
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-red-700 mb-2">{t('listing_detail.delete_confirm')}</p>
                    <div className="flex gap-2">
                      <button onClick={handleDelete} disabled={deleting}
                        className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                        {deleting ? t('listing_detail.delete_deleting') : t('listing_detail.delete_yes')}
                      </button>
                      <button onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        {t('listing_detail.delete_cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-4">
                  {listing.category?.name && (
                    <div className="text-sm font-semibold text-slate-700 mb-1">{t(`category.${listing.category.name}`)}</div>
                  )}
                  {listing.priceFlexibility && (
                    <span className="text-xs text-slate-500">{t(`common.flexibility_${listing.priceFlexibility}`)}</span>
                  )}
                </div>
                <Link href={`/offers/create?listingId=${listing.id}&ownerId=${listing.userId}`} className="btn-primary w-full text-center block mb-3">
                  {t('listing_detail.make_offer')}
                </Link>
                <button
                  onClick={async () => {
                    if (!authed) { window.location.href = '/login'; return; }
                    setStartingChat(true);
                    try {
                      const convo = await messagingApi.createConversation(listing.userId);
                      window.location.href = `/messages/${convo.id}`;
                    } catch { setStartingChat(false); }
                  }}
                  disabled={startingChat}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors mb-3 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {startingChat ? t('listing_detail.message_opening') : t('listing_detail.message_seller')}
                </button>
                <button
                  onClick={handleToggleFavorite}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                    favorited ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <svg className={`w-4 h-4 ${favorited ? 'fill-red-500 text-red-500' : ''}`} fill={favorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {favorited ? t('listing_detail.saved') : t('listing_detail.save')} {favoriteCount > 0 && `(${favoriteCount})`}
                </button>
              </>
            )}

            {/* Share + Report */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied ? t('listing_detail.share_copied') : t('listing_detail.share')}
              </button>
              {!isOwner && (
                <button
                  onClick={() => {
                    if (!authed) { window.location.replace('/login'); return; }
                    if (reported) return;
                    setShowReportModal(true);
                    setReportReason('');
                    setReportDescription('');
                    setReportError('');
                    setReportSuccess(false);
                  }}
                  disabled={reported}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors ${
                    reported ? 'text-red-500 bg-red-50 cursor-default' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  {reported ? t('listing_detail.reported') : t('listing_detail.report')}
                </button>
              )}
            </div>
          </div>

          {/* Item ID */}
          <div className="px-4 py-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-400">{t('listing_detail.item_id')}</span>
            <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">{listing.id}</p>
          </div>

          {/* Seller Profile */}
          {sellerProfile && (
            <Link href={`/profile/${listing.userId}`} className="card-hover block p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('listing_detail.seller')}</h3>
              <div className="flex items-center gap-3 mb-3">
                {sellerProfile.avatarUrl ? (
                  <img src={sellerProfile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">{sellerProfile.displayName[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{sellerProfile.displayName}</p>
                  {sellerProfile.location && <p className="text-xs text-slate-400 truncate">{sellerProfile.location}</p>}
                </div>
                {sellerTrust && <TrustRing score={sellerTrust.score} />}
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                <div className="bg-slate-50 rounded-lg py-2">
                  <div className="font-bold text-slate-900 text-base">{sellerProfile.completedTrades}</div>
                  <div className="text-slate-500">{t('listing_detail.trades_label')}</div>
                </div>
                <div className="bg-slate-50 rounded-lg py-2">
                  <div className={`font-bold text-base ${TRUST_COLOR[trustKey]}`}>{trustScore.toFixed(0)}</div>
                  <div className="text-slate-500">{t('listing_detail.trust_score')}</div>
                </div>
              </div>
              {sellerProfile.bio && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{sellerProfile.bio}</p>}
              <span className="text-xs text-navy-900 hover:underline">{t('listing_detail.view_profile')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Seller's Other Listings */}
      {sellerListings.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('listing_detail.more_from_seller')}</h2>
            {sellerProfile && (
              <Link href={`/listings?seller=${listing.userId}`} className="text-sm text-navy-900 hover:underline">{t('listing_detail.see_all')}</Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {sellerListings.map((l) => (
              <Link key={l.id} href={`/listings/${l.id}`} className="card-hover block overflow-hidden">
                <div className="aspect-square bg-slate-100">
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
                <div className="p-2">
                  <p className="text-xs font-medium text-slate-900 truncate">{l.title}</p>
                  {l.category?.name && <p className="text-xs text-slate-500">{t(`category.${l.category.name}`)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Similar Listings */}
      {similarListings.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('listing_detail.similar_listings')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {similarListings.map((l) => (
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
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 shadow-xl">
            {reportSuccess ? (
              <div className="text-center py-6">
                <svg className="w-12 h-12 text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-slate-900">{t('report.success')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('report.success_desc')}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('report.title')}</h3>
                <p className="text-sm text-slate-500 mb-4">{t('report.subtitle')}</p>

                {reportError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{reportError}</div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">{t('report.reason_label')}</label>
                    <div className="space-y-2">
                      {[
                        { value: 'inappropriate_content', label: t('report.reason_inappropriate') },
                        { value: 'fraud_scam', label: t('report.reason_fraud') },
                        { value: 'wrong_category', label: t('report.reason_wrong_category') },
                        { value: 'duplicate', label: t('report.reason_duplicate') },
                        { value: 'prohibited_item', label: t('report.reason_prohibited') },
                        { value: 'other', label: t('report.reason_other') },
                      ].map((opt) => (
                        <label key={opt.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          reportReason === opt.value ? 'border-navy-900 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
                        }`}>
                          <input
                            type="radio"
                            name="reportReason"
                            value={opt.value}
                            checked={reportReason === opt.value}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="accent-navy-900"
                          />
                          <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      {t('report.description_label')} <span className="text-slate-400 font-normal">{t('report.optional')}</span>
                    </label>
                    <textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder={t('report.description_placeholder')}
                      rows={3}
                      maxLength={1000}
                      className="input text-sm resize-y"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleReport} disabled={submittingReport || !reportReason} className="btn-primary flex-1">
                      {submittingReport ? t('report.submitting') : t('report.submit')}
                    </button>
                    <button onClick={() => setShowReportModal(false)} className="btn-secondary">
                      {t('report.cancel')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper since we can't import directly inside useEffect
async function api_get_category(categoryId: string): Promise<Listing[]> {
  const { api } = await import('@/lib/api');
  return api.get<Listing[]>(`/listings/category/${categoryId}`);
}
