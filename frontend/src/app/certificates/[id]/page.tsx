'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { certificatesApi } from '@/lib/api';
import { useTranslation } from '@/contexts/LanguageContext';

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-emerald',
  transferred: 'badge-blue',
  revoked: 'badge-red',
};

const ANCHOR_BADGE: Record<string, string> = {
  confirmed: 'badge-emerald',
  pending: 'badge-amber',
  failed: 'badge-red',
};

export default function CertificateViewerPage() {
  const params = useParams();
  const { t, locale } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cert, setCert] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [proof, setProof] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (params.id) {
      const certId = params.id as string;
      Promise.all([
        certificatesApi.getById(certId),
        certificatesApi.getMerkleProof(certId).catch(() => null),
      ])
        .then(([certData, proofData]) => {
          setCert(certData);
          setProof(proofData);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-64 mb-6" />
        <div className="skeleton h-64 rounded-xl mb-4" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-red-500 mb-4">{error || t('certificate.not_found')}</p>
        <Link href="/trades" className="btn-primary">{t('certificate.back')}</Link>
      </div>
    );
  }

  const isSimulated = proof?.txHash?.startsWith('0xSIM_');
  const isAnchored = proof?.anchored;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/trades/${cert.tradeId}`} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-mono">{cert.certificateId}</h1>
            <span className={STATUS_BADGE[cert.status] || 'badge-slate'}>
              {cert.status}
            </span>
          </div>
        </div>
      </div>

      {/* Certificate Details */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{t('certificate.details')}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            [t('certificate.trade_id'), cert.tradeId],
            [t('certificate.listing_id'), cert.listingId],
            [t('certificate.owner'), cert.ownerUserId],
            [t('certificate.issued_at'), new Date(cert.issuedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-mono text-slate-700 text-right break-all max-w-[60%]">{value}</span>
            </div>
          ))}
          <div className="px-5 py-3">
            <span className="text-sm text-slate-500 block mb-1">{t('certificate.proof_hash')}</span>
            <code className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded block break-all">
              {cert.proofHash}
            </code>
          </div>
        </div>
      </div>

      {/* Blockchain Anchor */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{t('certificate.blockchain')}</h2>
          {isAnchored && (
            <span className={ANCHOR_BADGE[proof.anchorStatus] || 'badge-slate'}>
              {proof.anchorStatus}
            </span>
          )}
        </div>
        <div className="p-5">
          {!isAnchored ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 font-medium mb-1">{t('certificate.pending_title')}</p>
              <p className="text-xs text-slate-400">
                {t('certificate.pending_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {isSimulated && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
                  {t('certificate.simulation')}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-xs text-slate-400 block mb-1">{t('certificate.network')}</span>
                  <span className="text-sm font-medium text-slate-700">{proof.network}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-xs text-slate-400 block mb-1">{t('certificate.block_number')}</span>
                  <span className="text-sm font-medium text-slate-700">{proof.blockNumber ?? '—'}</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-xs text-slate-400 block mb-1">{t('certificate.tx_hash')}</span>
                {!isSimulated ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${proof.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-navy-900 hover:underline break-all"
                  >
                    {proof.txHash}
                  </a>
                ) : (
                  <code className="text-sm font-mono text-slate-600 break-all">{proof.txHash}</code>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Technical Details (collapsible) */}
      {isAnchored && proof?.proof && (
        <div className="card">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <h2 className="font-semibold text-slate-900">{t('certificate.technical')}</h2>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${showTechnical ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTechnical && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1">{t('certificate.merkle_root')}</span>
                <code className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded block break-all">
                  {proof.merkleRoot}
                </code>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">{t('certificate.leaf_index')}</span>
                <span className="text-sm font-mono text-slate-700">{proof.leafIndex}</span>
              </div>

              {proof.proof.length > 0 && (
                <div>
                  <span className="text-xs text-slate-400 block mb-2">{t('certificate.merkle_proof')}</span>
                  <p className="text-xs text-slate-400 mb-3">
                    {t('certificate.merkle_proof_desc')}
                  </p>
                  <div className="space-y-1.5">
                    {proof.proof.map((step: { hash: string; direction: string }, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          step.direction === 'right'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {step.direction}
                        </span>
                        <code className="text-xs font-mono text-slate-600 break-all">{step.hash}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
