'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { setTokens, clearTokens } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';

function VerifyEmailContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(t('auth.verify_no_token'));
      return;
    }

    authApi.verifyEmail(token)
      .then((res) => {
        const savedLocale = localStorage.getItem('locale');
        clearTokens();
        if (savedLocale) localStorage.setItem('locale', savedLocale);
        setTokens(res.accessToken, res.refreshToken, res.userId);
        setStatus('success');
        setTimeout(() => window.location.replace('/dashboard'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : t('auth.verify_error_title'));
      });
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="card p-6 text-center">
          {status === 'loading' && (
            <>
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="animate-spin w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{t('auth.verify_loading_title')}</h2>
              <p className="text-sm text-slate-500">{t('auth.verify_loading_desc')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{t('auth.verify_success_title')}</h2>
              <p className="text-sm text-slate-500">{t('auth.verify_success_desc')}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{t('auth.verify_error_title')}</h2>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Link href="/login" className="btn-primary inline-block">
                {t('auth.verify_go_to_sign_in')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="card p-6 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="animate-spin w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
