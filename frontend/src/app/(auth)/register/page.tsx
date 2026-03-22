'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(email, password, displayName);
      setRegisteredEmail(email);
      setRegistered(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await authApi.resendVerification(registeredEmail);
      setResendMessage(t('auth.resend_success'));
    } catch (err: unknown) {
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setResendLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="card p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t('auth.check_email_title')}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {t('auth.check_email_desc', { email: registeredEmail })}
            </p>
            {resendMessage && (
              <div className={`text-sm rounded-lg px-3 py-2 mb-4 ${resendMessage.includes('resent') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {resendMessage}
              </div>
            )}
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="btn-secondary text-sm w-full"
            >
              {resendLoading ? t('auth.resend_sending') : t('auth.resend_button')}
            </button>
          </div>
          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/login" className="text-navy-900 font-medium hover:underline">
              {t('auth.back_to_sign_in')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-4">
            Tk
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('auth.register_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.register_subtitle')}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="label">{t('auth.display_name')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
                placeholder={t('auth.display_name_placeholder')}
                required
              />
            </div>

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
                placeholder={t('auth.password_register_placeholder')}
                required
                minLength={8}
              />
            </div>

            {/* KVKK Consent Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={kvkkConsent}
                  onChange={(e) => setKvkkConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-navy-900 focus:ring-navy-900 shrink-0"
                />
                <span className="text-sm text-slate-600 leading-snug">
                  {t('auth.kvkk_consent')}{' '}
                  <a href="/kvkk" target="_blank" className="text-navy-900 font-medium hover:underline">
                    {t('auth.kvkk_consent_link')}
                  </a>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsConsent}
                  onChange={(e) => setTermsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-navy-900 focus:ring-navy-900 shrink-0"
                />
                <span className="text-sm text-slate-600 leading-snug">
                  {t('auth.terms_consent')}{' '}
                  <a href="/terms" target="_blank" className="text-navy-900 font-medium hover:underline">
                    {t('auth.terms_link')}
                  </a>
                  {' '}{t('auth.terms_consent_and')}{' '}
                  <a href="/privacy" target="_blank" className="text-navy-900 font-medium hover:underline">
                    {t('auth.privacy_link')}
                  </a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !kvkkConsent || !termsConsent}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('auth.creating_account')}
                </span>
              ) : (
                t('auth.create_account')
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          {t('auth.already_have_account')}{' '}
          <Link href="/login" className="text-navy-900 font-medium hover:underline">
            {t('auth.sign_in_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
