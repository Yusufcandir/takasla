'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { isAuthenticated, clearTokens, getUserId } from '@/lib/auth';
import { api, getImageUrl } from '@/lib/api';
import { LanguageProvider, useTranslation } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

interface UserProfile {
  displayName: string;
  avatarUrl?: string;
  email?: string;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="description" content="A trust-enhanced item-to-item exchange platform with risk-based escrow" />
      </head>
      <body className="bg-slate-50 text-slate-900">
        <LanguageProvider>
          <LayoutInner>{children}</LayoutInner>
        </LanguageProvider>
      </body>
    </html>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<UserProfile>('/profiles/me');
      setProfile(data);
    } catch {
      // Profile fetch failed — user may not have a profile yet
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get<{ count: number }>('/conversations/unread-count');
      setUnreadCount(data.count);
    } catch {
      // Messaging service may not exist yet
    }
  }, []);

  // Check auth state and fetch user data on mount + pathname change
  useEffect(() => {
    const authenticated = isAuthenticated();
    setAuthed(authenticated);

    if (authenticated) {
      fetchProfile();
      fetchUnreadCount();
    } else {
      setProfile(null);
      setUnreadCount(0);
    }
  }, [pathname, fetchProfile, fetchUnreadCount]);

  // Poll unread count every 30 seconds when authenticated
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [authed, fetchUnreadCount]);

  // Click-outside handler for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on pathname change
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    const savedLocale = localStorage.getItem('locale');
    clearTokens();
    if (savedLocale) localStorage.setItem('locale', savedLocale);
    setAuthed(false);
    setProfile(null);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    window.location.replace('/login');
  };

  const userId = getUserId();
  const displayInitial = profile?.displayName?.charAt(0)?.toUpperCase() || 'U';

  const isLinkActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  return (
    <>
      <title>{t('nav.page_title')}</title>
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-navy-900/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left section: Logo + Nav links */}
            <div className="flex items-center gap-6">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-emerald-400 transition-colors">
                  Tk
                </div>
                <span className="text-white font-semibold text-lg tracking-tight hidden sm:block">
                  {t('nav.logo_text')}
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1">
                {authed ? (
                  <>
                    <Link
                      href="/listings"
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isLinkActive('/listings')
                          ? 'text-white bg-white/10'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t('nav.listings')}
                    </Link>
                    <Link
                      href="/trades"
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isLinkActive('/trades')
                          ? 'text-white bg-white/10'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t('nav.trades')}
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/listings"
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isLinkActive('/listings')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.browse_listings')}
                  </Link>
                )}
              </nav>
            </div>

            {/* Right section */}
            <div className="hidden md:flex items-center gap-3">
              <LanguageToggle />
              {authed ? (
                <>
                  {/* Create Listing button */}
                  <Link
                    href="/listings/create"
                    className="bg-emerald-500 text-white hover:bg-emerald-400 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {t('nav.create_listing')}
                  </Link>

                  {/* Messages icon */}
                  <Link
                    href="/messages"
                    className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    title={t('nav.messages')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* Avatar dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {profile?.avatarUrl ? (
                        <img
                          src={getImageUrl(profile.avatarUrl)}
                          alt={profile.displayName || 'Avatar'}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-semibold">
                          {displayInitial}
                        </div>
                      )}
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {dropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                        {/* User info header */}
                        <div className="px-4 py-3 border-b border-slate-100">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {profile?.displayName || 'User'}
                          </p>
                          {profile?.email && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {profile.email}
                            </p>
                          )}
                        </div>

                        {/* Menu items */}
                        <div className="py-1">
                          <Link
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            {t('nav.my_profile')}
                          </Link>
                          <Link
                            href={userId ? `/listings?userId=${userId}` : '/listings'}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                            {t('nav.my_listings')}
                          </Link>
                          <Link
                            href="/offers"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            {t('nav.my_offers')}
                          </Link>
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                            {t('nav.dashboard')}
                          </Link>
                          <Link
                            href="/favorites"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                            </svg>
                            {t('nav.favorites')}
                          </Link>
                          <Link
                            href="/disputes"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            {t('nav.disputes')}
                          </Link>
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-slate-100 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            {t('nav.sign_out')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-colors font-medium"
                  >
                    {t('nav.sign_in')}
                  </Link>
                  <Link
                    href="/register"
                    className="bg-emerald-500 text-white hover:bg-emerald-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('nav.get_started')}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-300 hover:text-white p-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-navy-900 border-t border-white/5 animate-slide-down">
            <div className="px-4 py-3 space-y-1">
              {/* Language toggle mobile */}
              <div className="pb-2 flex items-center gap-2 px-3">
                <LanguageToggle />
              </div>

              {/* Navigation section */}
              <div className="pb-2">
                <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t('nav.navigation')}
                </p>
                <Link
                  href="/listings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-sm font-medium rounded-md ${
                    isLinkActive('/listings')
                      ? 'text-white bg-white/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('nav.listings')}
                </Link>
                {authed && (
                  <>
                    <Link
                      href="/trades"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 text-sm font-medium rounded-md ${
                        isLinkActive('/trades')
                          ? 'text-white bg-white/10'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t('nav.trades')}
                    </Link>
                    <Link
                      href="/messages"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                        isLinkActive('/messages')
                          ? 'text-white bg-white/10'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t('nav.messages')}
                      {unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1.5">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </>
                )}
              </div>

              {/* Create section */}
              {authed && (
                <div className="pb-2 border-t border-white/10 pt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t('nav.create')}
                  </p>
                  <Link
                    href="/listings/create"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-400 rounded-md hover:bg-white/5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {t('nav.create_listing')}
                  </Link>
                </div>
              )}

              {/* Account section */}
              {authed && (
                <div className="pb-2 border-t border-white/10 pt-2">
                  <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t('nav.account')}
                  </p>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-medium rounded-md ${
                      isLinkActive('/profile')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.my_profile')}
                  </Link>
                  <Link
                    href={userId ? `/listings?userId=${userId}` : '/listings'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-md hover:bg-white/5"
                  >
                    {t('nav.my_listings')}
                  </Link>
                  <Link
                    href="/offers"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-medium rounded-md ${
                      isLinkActive('/offers')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.my_offers')}
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-medium rounded-md ${
                      isLinkActive('/dashboard')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    href="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-medium rounded-md ${
                      isLinkActive('/favorites')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.favorites')}
                  </Link>
                  <Link
                    href="/disputes"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 text-sm font-medium rounded-md ${
                      isLinkActive('/disputes')
                        ? 'text-white bg-white/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t('nav.disputes')}
                  </Link>
                </div>
              )}

              {/* Auth section */}
              <div className="border-t border-white/10 pt-2">
                {authed ? (
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 text-sm text-red-400 font-medium rounded-md hover:bg-white/5"
                  >
                    {t('nav.sign_out')}
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-slate-300 hover:text-white rounded-md hover:bg-white/5 font-medium"
                    >
                      {t('nav.sign_in')}
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-emerald-400 font-medium rounded-md hover:bg-white/5"
                    >
                      {t('nav.get_started')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-white font-bold text-xs">
                Tk
              </div>
              <span className="text-slate-400 text-sm">{t('footer.tagline')}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-slate-500 text-xs">{t('footer.features')}</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
