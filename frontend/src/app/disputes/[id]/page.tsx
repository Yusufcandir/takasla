'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { disputesApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Dispute, Evidence } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-amber',
  under_review: 'badge-blue',
  resolved: 'badge-emerald',
  escalated: 'badge-red',
  closed: 'badge-slate',
};

const TYPE_ICONS: Record<string, string> = {
  photo: 'bg-blue-50 text-blue-600',
  video: 'bg-purple-50 text-purple-600',
  document: 'bg-amber-50 text-amber-600',
  text: 'bg-slate-100 text-slate-600',
};

const ACCEPT_BY_TYPE: Record<string, string> = {
  photo: 'image/*',
  video: 'video/*',
  document: '.pdf,.doc,.docx,.txt',
  text: '.txt,.pdf',
};

export default function DisputeDetailPage() {
  const { t, locale } = useTranslation();
  const params = useParams();
  const disputeId = params.id as string;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [evidenceType, setEvidenceType] = useState<Evidence['type']>('photo');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disputeId) return;
    disputesApi
      .getById(disputeId)
      .then(setDispute)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load dispute'))
      .finally(() => setLoading(false));
  }, [disputeId]);

  // Reset file when type changes (accept attribute changes)
  useEffect(() => {
    setEvidenceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [evidenceType]);

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile) return;
    setUploadError('');
    setUploadSuccess(false);
    setSubmitting(true);
    try {
      // Step 1: Upload file to get URL + hash
      const uploaded = await disputesApi.uploadEvidenceFiles([evidenceFile]);
      const { url, hash } = uploaded[0];

      // Step 2: Create evidence record with URL + hash
      const newEvidence = await disputesApi.uploadEvidence(disputeId, {
        type: evidenceType,
        url,
        description: evidenceDescription || undefined,
        fileHash: hash,
      });
      setDispute((prev) => prev ? { ...prev, evidence: [...prev.evidence, newEvidence] } : prev);
      setEvidenceFile(null);
      setEvidenceDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadSuccess(true);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload evidence');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-64 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dispute || error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-red-500">{error || t('dispute_detail.not_found')}</p>
        <Link href="/disputes" className="btn-primary mt-4">{t('dispute_detail.back')}</Link>
      </div>
    );
  }

  const isActive = ['open', 'under_review', 'escalated'].includes(dispute.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/disputes" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{t('dispute_detail.title')}</h1>
        <span className={STATUS_BADGE[dispute.status] || 'badge-slate'}>
          {dispute.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('dispute_detail.details')}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('dispute_detail.trade')}</span>
                <Link href={`/trades/${dispute.tradeId}`} className="text-sm font-mono text-navy-900 hover:underline">
                  {dispute.tradeId.slice(0, 12)}...
                </Link>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('dispute_detail.reason')}</span>
                <span className="text-sm font-medium text-slate-700 capitalize">
                  {dispute.reason.replace(/_/g, ' ')}
                </span>
              </div>
              {dispute.description && (
                <div className="px-5 py-3">
                  <span className="text-sm text-slate-500 block mb-1">{t('dispute_detail.description')}</span>
                  <p className="text-sm text-slate-700">{dispute.description}</p>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('dispute_detail.opened')}</span>
                <span className="text-sm text-slate-700">{new Date(dispute.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
              </div>
              {dispute.resolvedAt && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">{t('dispute_detail.resolved')}</span>
                  <span className="text-sm text-emerald-600">{new Date(dispute.resolvedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
                </div>
              )}
            </div>
            {dispute.resolution && (
              <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-100">
                <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">{t('dispute_detail.resolution')}</span>
                <p className="text-sm text-emerald-800 mt-1">{dispute.resolution}</p>
              </div>
            )}
          </div>

          {/* Evidence Timeline */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('dispute_detail.evidence_title', { count: dispute.evidence.length })}</h2>
            </div>
            {dispute.evidence.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                {t('dispute_detail.no_evidence')}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {dispute.evidence.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_ICONS[ev.type] || TYPE_ICONS.text}`}>
                      <span className="text-xs font-bold uppercase">{ev.type[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="badge-navy text-[10px]">{ev.type.toUpperCase()}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-navy-900 hover:underline break-all"
                        >
                          {ev.url.length > 60 ? ev.url.slice(0, 60) + '...' : ev.url}
                        </a>
                      )}
                      {ev.description && (
                        <p className="text-xs text-slate-500 mt-1">{ev.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload Panel */}
        <div>
          <div className={`card ${isActive ? 'border-emerald-200' : ''}`}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('dispute_detail.upload_title')}</h2>
            </div>
            <div className="p-5">
              {!isActive ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  {t('dispute_detail.dispute_closed', { status: dispute.status })}
                </p>
              ) : (
                <form onSubmit={handleUploadEvidence} className="space-y-4">
                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                      {uploadError}
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2">
                      {t('dispute_detail.evidence_success')}
                    </div>
                  )}
                  <div>
                    <label className="label">{t('dispute_detail.type')}</label>
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value as Evidence['type'])}
                      className="input"
                    >
                      <option value="photo">{t('dispute_detail.type_photo')}</option>
                      <option value="video">{t('dispute_detail.type_video')}</option>
                      <option value="document">{t('dispute_detail.type_document')}</option>
                      <option value="text">{t('dispute_detail.type_text')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('dispute_detail.file')}</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_BY_TYPE[evidenceType] || '*/*'}
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-navy-50 file:text-navy-900 hover:file:bg-navy-100 cursor-pointer"
                    />
                    {evidenceFile && (
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">{t('dispute_detail.evidence_desc')}</label>
                    <textarea
                      value={evidenceDescription}
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                      rows={3}
                      className="input min-h-[80px] resize-y"
                      placeholder={t('dispute_detail.evidence_desc_placeholder')}
                    />
                  </div>
                  <button type="submit" disabled={submitting || !evidenceFile} className="btn-primary w-full">
                    {submitting ? t('dispute_detail.uploading') : t('dispute_detail.upload_submit')}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
