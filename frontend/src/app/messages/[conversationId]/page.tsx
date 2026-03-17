'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { messagingApi, publicProfileApi, getImageUrl } from '@/lib/api';
import { isAuthenticated, getUserId } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Message, Profile, Conversation } from '@/types';

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const currentUserId = getUserId();
  const { t, locale } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.replace('/login');
      return;
    }

    // Load conversation data
    Promise.all([
      messagingApi.getMessages(conversationId),
      messagingApi.getConversations(),
    ]).then(async ([msgData, convos]) => {
      // Messages come newest-first from API, reverse for display
      setMessages([...(msgData.messages || [])].reverse());

      const convo = convos.find((c: Conversation) => c.id === conversationId);
      setConversation(convo || null);

      // Mark as read
      messagingApi.markAsRead(conversationId).catch(() => {});

      // Load other user's profile
      if (convo?.otherUserId) {
        publicProfileApi.getProfile(convo.otherUserId).then(setOtherProfile).catch(() => {});
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [conversationId]);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 5s
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(async () => {
      try {
        const data = await messagingApi.getMessages(conversationId);
        const reversed = [...(data.messages || [])].reverse();
        setMessages(reversed);
        messagingApi.markAsRead(conversationId).catch(() => {});
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const msg = await messagingApi.sendMessage(conversationId, content);
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      inputRef.current?.focus();
    } catch {}
    setSending(false);
  };

  function formatTime(dateStr: string) {
    const loc = locale === 'tr' ? 'tr-TR' : 'en-US';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `${t('chat.yesterday')} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString(loc, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
              <div className="skeleton h-10 w-48 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <Link href="/messages" className="text-slate-400 hover:text-slate-600 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {otherProfile?.avatarUrl ? (
          <img src={getImageUrl(otherProfile.avatarUrl)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">
              {otherProfile?.displayName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {otherProfile?.displayName || t('chat.unknown_user')}
          </h1>
          {otherProfile && (
            <Link href={`/profile/${conversation?.otherUserId}`} className="text-xs text-slate-500 hover:text-navy-900">
              {t('chat.view_profile')}
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-slate-400">{t('chat.empty')}</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isOwn ? 'order-last' : ''}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isOwn
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                <p className={`text-[10px] text-slate-400 mt-1 ${isOwn ? 'text-right' : ''}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 pt-3 border-t border-slate-200">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t('chat.placeholder')}
          className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          maxLength={2000}
          autoFocus
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 flex items-center justify-center transition-colors shrink-0"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
