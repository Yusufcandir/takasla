'use client';

import { useTranslation } from '@/contexts/LanguageContext';

export default function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-sm">
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-1 transition-colors ${
          locale === 'en'
            ? 'bg-white/20 text-white font-medium'
            : 'text-white/50 hover:text-white/80'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('tr')}
        className={`px-2 py-1 transition-colors ${
          locale === 'tr'
            ? 'bg-white/20 text-white font-medium'
            : 'text-white/50 hover:text-white/80'
        }`}
      >
        TR
      </button>
    </div>
  );
}
