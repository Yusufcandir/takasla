'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { messagingApi, publicProfileApi, getImageUrl } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Conversation, Profile } from '@/types';

export default function MessagesPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.replace('/login');
      return;
    }

    messagingApi.getConversations().then(async (convos) => {
      setConversations(convos);
      setLoading(false);

      // Fetch profiles for all other participants
      const userIds = [...new Set(convos.map((c) => c.otherUserId).filter(Boolean))] as string[];
      const profileResults = await Promise.allSettled(
        userIds.map((id) => publicProfileApi.getProfile(id))
      );
      const map: Record<string, Profile> = {};
      profileResults.forEach((r, i) => {
        if (r.status === 'fulfilled') map[userIds[i]] = r.value;
      });
      setProfiles(map);
    }).catch(() => setLoading(false));
  }, []);

  function formatTime(dateStr?: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('messages.just_now');
    if (diffMins < 60) return t('messages.minutes_ago', { mins: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('messages.hours_ago', { hours: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('messages.days_ago', { days: diffDays });
    return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-32 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('messages.title')}</h1>

      {conversations.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('messages.empty_title')}</h2>
          <p className="text-sm text-slate-500 mb-6">{t('messages.empty_desc')}</p>
          <Link href="/listings" className="btn-primary">{t('messages.browse')}</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => {
            const otherUser = convo.otherUserId ? profiles[convo.otherUserId] : null;
            const unread = convo.unreadCount || 0;

            return (
              <Link
                key={convo.id}
                href={`/messages/${convo.id}`}
                className={`card-hover flex items-center gap-3 p-4 ${unread > 0 ? 'bg-emerald-50/50 border-emerald-200' : ''}`}
              >
                {/* Avatar */}
                {otherUser?.avatarUrl ? (
                  <img src={getImageUrl(otherUser.avatarUrl)} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
                    <span className="text-white text-lg font-bold">
                      {otherUser?.displayName?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-900'}`}>
                      {otherUser?.displayName || t('messages.unknown_user')}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{formatTime(convo.lastMessageAt)}</span>
                  </div>
                  <p className={`text-sm truncate ${unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {convo.lastMessageContent || t('messages.no_messages')}
                  </p>
                </div>

                {/* Unread badge */}
                {unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
