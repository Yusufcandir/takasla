'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { setTokens, clearTokens } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notVerifiedEmail, setNotVerifiedEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotVerifiedEmail('');
    setResendMessage('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const savedLocale = localStorage.getItem('locale');
      clearTokens();
      if (savedLocale) localStorage.setItem('locale', savedLocale);
      setTokens(res.accessToken, res.refreshToken, res.userId);
      window.location.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      if (msg.toLowerCase().includes('not verified')) {
        setNotVerifiedEmail(email);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMessage('');
    try {
      await authApi.resendVerification(notVerifiedEmail);
      setResendMessage(t('auth.verification_resent'));
      setError('');
      setNotVerifiedEmail('');
    } catch (err: unknown) {
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-4">
            Tk
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('auth.login_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.login_subtitle')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
                {notVerifiedEmail && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="block mt-2 text-navy-900 font-medium hover:underline text-sm"
                  >
                    {t('auth.resend_verification')}
                  </button>
                )}
              </div>
            )}

            {resendMessage && (
              <div className={`text-sm rounded-lg px-4 py-3 ${resendMessage.includes('resent') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {resendMessage}
              </div>
            )}

            <div>
              <label className="label">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t('auth.email_placeholder')}
                required
              />
            </div>

            <div>
              <label className="label">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t('auth.password_placeholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('auth.signing_in')}
                </span>
              ) : (
                t('auth.sign_in')
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-navy-900 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
