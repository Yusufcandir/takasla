'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAuthenticated, clearTokens } from '@/lib/auth';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/trades', label: 'Trades' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/centers', label: 'Centers' },
  { href: '/admin/center-verifications', label: 'Center Queue' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/fraud-flags', label: 'Fraud Flags' },
  { href: '/admin/users', label: 'Users' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, [pathname]);

  const handleLogout = () => {
    clearTokens();
    window.location.href = '/login';
  };

  const isLoginPage = pathname === '/login';

  return (
    <html lang="en">
      <head>
        <title>Admin Panel — Exchange</title>
        <meta name="description" content="Exchange platform administration" />
      </head>
      <body className="bg-slate-50 text-slate-900">
        {!isLoginPage && (
          <header className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-amber-900 text-sm uppercase tracking-wide">Admin Panel</span>
                </div>
                <nav className="flex items-center gap-1">
                  {NAV_LINKS.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/admin' && pathname?.startsWith(link.href + '/'));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          isActive
                            ? 'bg-amber-200 text-amber-900'
                            : 'text-amber-700 hover:bg-amber-100 hover:text-amber-900'
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
                {authed && (
                  <button
                    onClick={handleLogout}
                    className="text-sm text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-md hover:bg-amber-100 transition-colors"
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </header>
        )}
        <main className="min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </body>
    </html>
  );
}
