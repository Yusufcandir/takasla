'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { tradesApi, certificatesApi, shippingApi, addressApi, paymentsApi, centersApi, getImageUrl } from '@/lib/api';
import { getUserId, isModeratorOrAdmin } from '@/lib/auth';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Trade, TradeEvent, Certificate, Shipment, ShippingRate, ShippingAddress, SavedAddress, Payment, VerificationCenter, CenterVerification } from '@/types';
import AddressForm, { validateAddress } from '@/components/AddressForm';

interface ProofEntry {
  type: 'photo' | 'video' | 'text';
  file?: File;
  preview?: string;
  textContent?: string;
  description: string;
}

// Timeline steps — risk-level-dependent
// HIGH risk: center-based verification flow
const TIMELINE_STEPS_CENTER = [
  { key: 'ACCEPTED', states: ['ACCEPTED'] },
  { key: 'LOCKED', states: ['LOCKED'] },
  { key: 'PROOF_SUBMITTED', states: ['PROOF_SUBMITTED', 'UNDER_VERIFICATION'] },
  { key: 'VERIFIED', states: ['VERIFIED'] },
  { key: 'SHIPPING_TO_CENTER', states: ['SHIPPING_TO_CENTER'] },
  { key: 'CENTER_VERIFICATION', states: ['AT_CENTER', 'CENTER_VERIFICATION'] },
  { key: 'SHIPPING_TO_RECIPIENTS', states: ['CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'] },
  { key: 'DELIVERED', states: ['DELIVERED'] },
  { key: 'COMPLETED', states: ['COMPLETED'] },
] as const;

// LOW/MEDIUM risk: direct shipping flow
const TIMELINE_STEPS_DIRECT = [
  { key: 'ACCEPTED', states: ['ACCEPTED'] },
  { key: 'LOCKED', states: ['LOCKED'] },
  { key: 'PROOF_SUBMITTED', states: ['PROOF_SUBMITTED', 'UNDER_VERIFICATION'] },
  { key: 'VERIFIED', states: ['VERIFIED'] },
  { key: 'IN_TRANSIT', states: ['IN_TRANSIT'] },
  { key: 'DELIVERED', states: ['DELIVERED'] },
  { key: 'COMPLETED', states: ['COMPLETED'] },
] as const;

function getTimelineSteps(riskLevel?: string) {
  return riskLevel === 'HIGH' ? TIMELINE_STEPS_CENTER : TIMELINE_STEPS_DIRECT;
}

// Flat list for index-based lookups (union of all possible states)
const ALL_TIMELINE_STATES = [...TIMELINE_STEPS_CENTER, ...TIMELINE_STEPS_DIRECT];
const TRADE_STATES: Trade['state'][] = [...new Set(ALL_TIMELINE_STATES.flatMap(s => s.states as unknown as Trade['state'][]))];

const STATE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  INITIATED: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  OFFERED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  ACCEPTED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  LOCKED: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  PROOF_SUBMITTED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  UNDER_VERIFICATION: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  VERIFIED: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  AWAITING_SHIPMENT: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  SHIPPING_TO_CENTER: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  AT_CENTER: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  CENTER_VERIFICATION: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  CENTER_VERIFIED: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  SHIPPING_TO_RECIPIENTS: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  IN_TRANSIT: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  DELIVERED: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  DISPUTE_OPEN: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  REVOKED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const RISK_BADGE_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
};

export default function TradeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const tradeId = params.id as string;
  const currentUserId = getUserId();
  const isMod = isModeratorOrAdmin();
  const paymentStatus = searchParams.get('payment');

  const [trade, setTrade] = useState<(Trade & { availableActions?: string[] }) | null>(null);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [showProofForm, setShowProofForm] = useState(false);
  const [proofEntries, setProofEntries] = useState<ProofEntry[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('item_mismatch');
  const [disputeDescription, setDisputeDescription] = useState('');

  // Shipping state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '', street: '', city: '', state: '', postalCode: '', country: '', phone: '',
    district: '', neighbourhood: '', email: '', countryCode: '', stateCode: '', cityCode: '',
  });

  // Saved addresses for trade address selector
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState<ShippingAddress>({
    name: '', street: '', city: '', state: '', postalCode: '', country: '', phone: '',
    district: '', neighbourhood: '', email: '', countryCode: '', stateCode: '', cityCode: '',
  });
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressIsDefault, setNewAddressIsDefault] = useState(false);
  const [newAddressSaving, setNewAddressSaving] = useState(false);
  const [newAddressError, setNewAddressError] = useState('');

  // Payment state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Verification center state
  const [centers, setCenters] = useState<VerificationCenter[]>([]);
  const [centerVerifications, setCenterVerifications] = useState<CenterVerification[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [centerLoading, setCenterLoading] = useState(false);

  const loadTrade = useCallback(() => {
    if (!tradeId) return;
    Promise.all([
      tradesApi.getById(tradeId),
      tradesApi.getEvents(tradeId).catch(() => [] as TradeEvent[]),
    ])
      .then(([tradeData, eventsData]) => {
        setTrade(tradeData);
        setEvents(eventsData);
        const shippingStates = ['VERIFIED', 'COMPLETED', 'DELIVERED', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'];
        if (shippingStates.includes(tradeData.state)) {
          certificatesApi.getByTradeId(tradeId).then(setCertificates).catch(() => {});
          paymentsApi.getByTrade(tradeId).then(setPayments).catch(() => {});
          shippingApi.getByTrade(tradeId).then((s) => {
            setShipments(s);
            if (tradeData.partyAAddressSubmitted && tradeData.partyBAddressSubmitted && s.length === 0) {
              setTimeout(() => {
                shippingApi.getByTrade(tradeId).then(setShipments).catch(() => {});
              }, 2000);
            }
          }).catch(() => {});
          // Load center verifications for center-related states
          if (['SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS', 'DELIVERED'].includes(tradeData.state)) {
            centersApi.getVerificationsByTrade(tradeId).then(setCenterVerifications).catch(() => {});
          }
        }
      })
      .finally(() => setLoading(false));
  }, [tradeId]);

  useEffect(() => { loadTrade(); }, [loadTrade]);

  // Load saved addresses and verification centers for address selection
  useEffect(() => {
    if (trade?.state === 'VERIFIED' && trade.shippingMethod === 'shipping') {
      addressApi.getAll().then((addrs) => {
        setSavedAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.isDefault);
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        else if (addrs.length > 0) setSelectedAddressId(addrs[0].id);
      }).catch(() => {});
      centersApi.list().then(setCenters).catch(() => {});
    }
  }, [trade?.state, trade?.shippingMethod]);

  useEffect(() => {
    if (!tradeId) return;
    const interval = setInterval(() => {
      if (trade && !['COMPLETED', 'CANCELLED', 'REVOKED'].includes(trade.state)) {
        tradesApi.getById(tradeId).then((d) => {
          setTrade(d);
          if (['VERIFIED', 'COMPLETED', 'DELIVERED'].includes(d.state)) {
            certificatesApi.getByTradeId(tradeId).then(setCertificates).catch(() => {});
          }
          // Refresh shipments during shipping states
          const shipStates = ['VERIFIED', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED', 'SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'];
          if (shipStates.includes(d.state) && d.shippingMethod === 'shipping') {
            shippingApi.getByTrade(tradeId).then(setShipments).catch(() => {});
          }
          // Refresh payments during relevant states
          if (shipStates.includes(d.state)) {
            paymentsApi.getByTrade(tradeId).then(setPayments).catch(() => {});
          }
          // Refresh center verifications
          if (['SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'].includes(d.state)) {
            centersApi.getVerificationsByTrade(tradeId).then(setCenterVerifications).catch(() => {});
          }
        }).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [tradeId, trade]);

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionError('');
    setActionLoading(true);
    try {
      await action();
      loadTrade();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('trade_detail.action_failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proofEntries.length === 0) { setActionError(t('trade_detail.proof_empty_error')); return; }

    setUploadProgress(t('trade_detail.uploading_files'));
    try {
      // Collect all files that need uploading
      const filesToUpload = proofEntries.filter(e => e.file).map(e => e.file!);
      let uploadedFiles: { url: string; hash: string; originalName: string }[] = [];

      if (filesToUpload.length > 0) {
        setUploadProgress(t('trade_detail.uploading_n_files', { count: filesToUpload.length }));
        uploadedFiles = await tradesApi.uploadProofFiles(filesToUpload);
      }

      // Build proof items array
      let fileIndex = 0;
      const items = proofEntries.map((entry) => {
        if (entry.type === 'text') {
          // For text entries, the content IS the proof — hash it client-side
          const content = entry.textContent || '';
          return { type: 'text', url: `text://${btoa(unescape(encodeURIComponent(content)))}`, hash: '' };
        } else {
          // Photo or video — use uploaded file
          const uploaded = uploadedFiles[fileIndex++];
          return { type: entry.type, url: uploaded.url, hash: uploaded.hash };
        }
      });

      // Check video requirement: at least one video must be included
      const hasVideo = proofEntries.some(e => e.type === 'video');
      if (!hasVideo) {
        setActionError(t('trade_detail.video_required'));
        return;
      }

      setUploadProgress(t('trade_detail.submitting_proof'));
      await handleAction(() => tradesApi.submitProof(tradeId, items, { uploadResults: uploadedFiles }));
      setShowProofForm(false);
      setProofEntries([]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('trade_detail.proof_submit_failed'));
    } finally {
      setUploadProgress('');
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAction(() => tradesApi.openDispute(tradeId, disputeReason, disputeDescription));
    setShowDisputeModal(false);
  };

  const addProofEntry = (type: 'photo' | 'video' | 'text') => {
    setProofEntries((prev) => [...prev, { type, description: '' }]);
  };
  const removeProofEntry = (i: number) => {
    setProofEntries((prev) => {
      const entry = prev[i];
      if (entry.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };
  const handleFileSelect = (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setProofEntries((prev) => prev.map((entry, idx) => {
      if (idx !== index) return entry;
      if (entry.preview) URL.revokeObjectURL(entry.preview);
      return { ...entry, file, preview: URL.createObjectURL(file) };
    }));
  };

  const isDisputeWindowOpen = (): boolean => {
    if (!trade?.disputeWindowEnd) return true;
    return new Date(trade.disputeWindowEnd) > new Date();
  };

  // Countdown timer for dispute window
  const [countdownText, setCountdownText] = useState('');
  useEffect(() => {
    if (!trade?.disputeWindowEnd || !['DELIVERED'].includes(trade.state)) return;
    const update = () => {
      const end = new Date(trade.disputeWindowEnd!).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) { setCountdownText(t('trade_detail.window_expired')); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      setCountdownText(
        days > 0
          ? `${days}d ${hours}h ${minutes}m`
          : hours > 0
            ? `${hours}h ${minutes}m`
            : `${minutes}m`
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [trade?.disputeWindowEnd, trade?.state, t]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-6 w-48 mb-6" />
        <div className="skeleton h-16 w-full rounded-xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-64 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('trade_detail.not_found')}</h2>
        <Link href="/trades" className="btn-primary mt-4">{t('trade_detail.back')}</Link>
      </div>
    );
  }

  const timelineSteps = getTimelineSteps(trade.riskLevel);
  const currentStepIndex = timelineSteps.findIndex(s => (s.states as readonly string[]).includes(trade.state));
  const currentIndex = currentStepIndex; // for timeline display
  const isBranchState = ['DISPUTE_OPEN', 'CANCELLED', 'REVOKED'].includes(trade.state);
  const isTerminal = ['COMPLETED', 'CANCELLED', 'REVOKED'].includes(trade.state);
  const stateStyle = STATE_COLORS[trade.state] || STATE_COLORS.INITIATED;
  const riskBadgeStyle = RISK_BADGE_STYLES[trade.riskLevel] || RISK_BADGE_STYLES.LOW;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/trades" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{t('trade_detail.title', { id: trade.id.slice(0, 8) })}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${stateStyle.bg} ${stateStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stateStyle.dot}`} />
              {t(`state.${trade.state}`)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${riskBadgeStyle}`}>
              {t(`common.risk_${trade.riskLevel.toLowerCase()}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment return banner */}
      {paymentStatus === 'success' && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          {t('trade_detail.payment_success')}
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
          {t('trade_detail.payment_cancelled')}
        </div>
      )}

      {/* ========== STATE TIMELINE ========== */}
      <div className="card p-5 mb-8 overflow-x-auto">
        <div className="flex items-center" style={{ minWidth: `${timelineSteps.length * 80}px` }}>
          {timelineSteps.map((step, i) => {
            const isStepActive = (step.states as readonly string[]).includes(trade.state);
            const isPast = !isBranchState && i < currentIndex;
            const isCurrent = isStepActive;
            const isPastOrCurrent = isPast || isCurrent;

            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                {/* Step */}
                <div className="flex flex-col items-center shrink-0 w-16 sm:w-auto">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-navy-900 text-white ring-4 ring-navy-900/10'
                        : isPast
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isPast && !isCurrent ? (
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-[9px] sm:text-[10px] mt-1 sm:mt-1.5 text-center w-16 sm:max-w-[72px] leading-tight ${
                    isCurrent ? 'text-navy-900 font-semibold' : isPast ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {t(`state.${step.key}`)}
                  </span>
                </div>

                {/* Connector line */}
                {i < timelineSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 sm:mx-1 mt-[-16px] rounded min-w-[8px] ${
                    isPastOrCurrent && i < currentIndex ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Branch state indicator */}
        {isBranchState && (
          <div className={`mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 ${stateStyle.text}`}>
            <span className={`w-2 h-2 rounded-full ${stateStyle.dot}`} />
            <span className="text-sm font-medium">{t(`state.${trade.state}`)}</span>
            {trade.state === 'DISPUTE_OPEN' && (
              <span className="text-xs text-slate-400 ml-2">{t('trade_detail.dispute_notice')}</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========== TRADE INFO ========== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('trade_detail.details')}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('trade_detail.party_a')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-700">{trade.partyAId.slice(0, 12)}...</span>
                  {trade.partyAId === currentUserId && <span className="badge-emerald">{t('trade_detail.you')}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('trade_detail.party_b')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-700">{trade.partyBId.slice(0, 12)}...</span>
                  {trade.partyBId === currentUserId && <span className="badge-emerald">{t('trade_detail.you')}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('trade_detail.risk_score')}</span>
                <span className="text-sm font-medium text-slate-700">
                  {trade.riskScore != null ? `${(trade.riskScore * 100).toFixed(0)}%` : t('trade_detail.risk_na')}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('trade_detail.proof_status')}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${trade.proofASubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {trade.proofASubmitted ? t('trade_detail.proof_a_submitted') : t('trade_detail.proof_a_pending')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${trade.proofBSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {trade.proofBSubmitted ? t('trade_detail.proof_b_submitted') : t('trade_detail.proof_b_pending')}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{t('trade_detail.created')}</span>
                <span className="text-sm text-slate-700">{new Date(trade.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
              </div>
              {trade.lockedAt && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">{t('trade_detail.locked_at')}</span>
                  <span className="text-sm text-slate-700">{new Date(trade.lockedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
                </div>
              )}
              {trade.disputeWindowEnd && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">{t('trade_detail.dispute_window_ends')}</span>
                  <span className={`text-sm font-medium ${isDisputeWindowOpen() ? 'text-amber-600' : 'text-slate-500'}`}>
                    {new Date(trade.disputeWindowEnd).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                  </span>
                </div>
              )}
              {trade.completedAt && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-500">{t('trade_detail.completed_at')}</span>
                  <span className="text-sm text-emerald-600 font-medium">{new Date(trade.completedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Certificates */}
          {certificates.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">{t('trade_detail.certificates')}</h2>
              </div>
              <div className="p-3 space-y-2">
                {certificates.map((cert) => (
                  <Link
                    key={cert.id}
                    href={`/certificates/${cert.certificateId}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <span className="font-mono text-sm font-medium text-slate-700">{cert.certificateId}</span>
                    </div>
                    <span className={cert.status === 'active' ? 'badge-emerald' : 'badge-slate'}>
                      {cert.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Shipping Section */}
          {trade.shippingMethod === 'shipping' && ['VERIFIED', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'].includes(trade.state) && (trade.state !== 'VERIFIED' || (trade.partyAPaid && trade.partyBPaid)) && (
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">{t('trade_detail.shipping')}</h2>
              </div>
              <div className="p-5 space-y-5">

                {/* Center Selection — only for HIGH risk trades */}
                {trade.state === 'VERIFIED' && trade.shippingMethod === 'shipping' && trade.riskLevel === 'HIGH' && !(currentUserId === trade.partyAId ? trade.centerAId : trade.centerBId) && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-1">{t('trade_detail.select_center_title')}</h3>
                    <p className="text-xs text-slate-500 mb-3">{t('trade_detail.select_center_desc')}</p>
                    {centers.length > 0 ? (
                      <div className="space-y-2">
                        {centers.map((center) => (
                          <label
                            key={center.id}
                            className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                              selectedCenterId === center.id
                                ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="center"
                                checked={selectedCenterId === center.id}
                                onChange={() => setSelectedCenterId(center.id)}
                                className="mt-1 w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{center.name}</p>
                                <p className="text-xs text-slate-500">
                                  {center.street}, {center.district}, {center.city} {center.postalCode}
                                </p>
                                {center.operatingHours && (
                                  <p className="text-xs text-slate-400 mt-0.5">{center.operatingHours}</p>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                        <button
                          disabled={centerLoading || !selectedCenterId}
                          onClick={async () => {
                            setCenterLoading(true);
                            setActionError('');
                            try {
                              await tradesApi.selectCenter(tradeId, selectedCenterId);
                              loadTrade();
                            } catch (err: unknown) {
                              setActionError(err instanceof Error ? err.message : 'Failed to select center');
                            }
                            setCenterLoading(false);
                          }}
                          className="btn-primary mt-2 w-full"
                        >
                          {centerLoading ? t('trade_detail.selecting_center') : t('trade_detail.select_center_btn')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Loading verification centers...</p>
                    )}
                  </div>
                )}

                {/* Center selected, waiting for other party */}
                {trade.state === 'VERIFIED' && (currentUserId === trade.partyAId ? trade.centerAId : trade.centerBId) && !(trade.centerAId && trade.centerBId) && (
                  <div className="text-sm text-purple-600 text-center py-3 px-3 bg-purple-50 rounded-lg border border-purple-200">
                    {t('trade_detail.center_selected_waiting')}
                  </div>
                )}

                {/* Center Verification Status — shown during center states */}
                {['SHIPPING_TO_CENTER', 'AT_CENTER', 'CENTER_VERIFICATION', 'CENTER_VERIFIED', 'SHIPPING_TO_RECIPIENTS'].includes(trade.state) && (
                  <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                    <h3 className="text-sm font-semibold text-purple-900 mb-3">
                      {trade.state === 'SHIPPING_TO_CENTER' && t('trade_detail.shipping_to_center')}
                      {trade.state === 'AT_CENTER' && t('trade_detail.at_center')}
                      {trade.state === 'CENTER_VERIFICATION' && t('trade_detail.center_verification')}
                      {trade.state === 'CENTER_VERIFIED' && t('trade_detail.center_verified')}
                      {trade.state === 'SHIPPING_TO_RECIPIENTS' && t('trade_detail.shipping_to_recipients')}
                    </h3>
                    {centerVerifications.length > 0 && (
                      <div className="space-y-2">
                        {centerVerifications.map((cv) => (
                          <div key={cv.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-purple-100">
                            <div>
                              <span className="text-sm font-medium text-slate-700">
                                {t('trade_detail.item_party', { party: cv.party })}
                              </span>
                              <span className="text-xs text-slate-500 ml-2">
                                {cv.status === 'pending' && t('trade_detail.cv_awaiting')}
                                {cv.status === 'item_received' && t('trade_detail.cv_received')}
                                {cv.status === 'inspecting' && t('trade_detail.cv_inspecting')}
                                {cv.status === 'approved' && t('trade_detail.cv_approved')}
                                {cv.status === 'rejected' && t('trade_detail.cv_rejected')}
                              </span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              cv.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              cv.status === 'rejected' ? 'bg-red-50 text-red-700' :
                              cv.status === 'item_received' || cv.status === 'inspecting' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {cv.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Address Selection — show if user hasn't submitted their address yet */}
                {trade.state === 'VERIFIED' && !(currentUserId === trade.partyAId ? trade.partyAAddressSubmitted : trade.partyBAddressSubmitted) && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">{t('trade_detail.select_address')}</h3>

                    {savedAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {savedAddresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                              selectedAddressId === addr.id
                                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="address"
                                checked={selectedAddressId === addr.id}
                                onChange={() => setSelectedAddressId(addr.id)}
                                className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {addr.label && <span className="text-sm font-semibold text-slate-900">{addr.label}</span>}
                                  {addr.isDefault && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{t('trade_detail.default_badge')}</span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-700">{addr.name}</p>
                                <p className="text-xs text-slate-500">
                                  {addr.street}
                                  {addr.neighbourhood ? `, ${addr.neighbourhood}` : ''}
                                  {addr.district ? `, ${addr.district}` : ''}
                                  , {addr.city}
                                  {addr.state && addr.state !== addr.city ? `, ${addr.state}` : ''}
                                  {addr.postalCode ? ` ${addr.postalCode}` : ''}
                                  , {addr.country}
                                </p>
                                <p className="text-xs text-slate-400">{addr.phone}</p>
                              </div>
                            </div>
                          </label>
                        ))}

                        <button
                          onClick={() => setShowNewAddressModal(true)}
                          className="w-full border-2 border-dashed border-slate-300 rounded-lg p-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {t('trade_detail.add_new_address')}
                        </button>

                        <button
                          disabled={actionLoading || !selectedAddressId}
                          onClick={() => {
                            const addr = savedAddresses.find((a) => a.id === selectedAddressId);
                            if (!addr) return;
                            const addressData: ShippingAddress = {
                              name: addr.name, street: addr.street, city: addr.city, state: addr.state,
                              postalCode: addr.postalCode, country: addr.country, phone: addr.phone,
                              district: addr.district, neighbourhood: addr.neighbourhood, email: addr.email,
                              countryCode: addr.countryCode, stateCode: addr.stateCode, cityCode: addr.cityCode,
                            };
                            handleAction(() => tradesApi.submitAddress(tradeId, addressData));
                          }}
                          className="btn-primary mt-2 w-full"
                        >
                          {t('trade_detail.submit_address')}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                        <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm text-slate-500 mb-3">{t('trade_detail.no_addresses')}</p>
                        <button
                          onClick={() => setShowNewAddressModal(true)}
                          className="btn-primary text-sm"
                        >
                          {t('trade_detail.add_first_address')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Waiting for other party's address */}
                {trade.state === 'VERIFIED' && (currentUserId === trade.partyAId ? trade.partyAAddressSubmitted : trade.partyBAddressSubmitted) && !(trade.partyAAddressSubmitted && trade.partyBAddressSubmitted) && (
                  <div className="text-sm text-amber-600 text-center py-3 px-3 bg-amber-50 rounded-lg border border-amber-200">
                    {t('trade_detail.address_waiting')}
                  </div>
                )}

                {/* Shipments list with rates, labels, tracking — grouped by leg */}
                {shipments.length > 0 && (
                  <div className="space-y-4">
                    {/* Leg 1 header */}
                    {shipments.some(s => s.leg === 'to_center') && (
                      <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wider">{t('trade_detail.leg1_header')}</h4>
                    )}
                    {/* Leg 2 header — show between leg groups */}
                    {shipments.map((shipment, idx) => {
                      const isMyShipment = shipment.senderId === currentUserId;
                      const showLeg2Header = shipment.leg === 'to_recipient' && !shipments.slice(0, idx).some(s => s.leg === 'to_recipient');
                      return (
                        <div key={shipment.id}>
                          {showLeg2Header && (
                            <h4 className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-2 mt-2">{t('trade_detail.leg2_header')}</h4>
                          )}
                          <div className="border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">
                                  {shipment.leg === 'to_center'
                                    ? (isMyShipment ? t('trade_detail.ship_item_to_center') : t('trade_detail.ship_other_to_center'))
                                    : shipment.leg === 'to_recipient'
                                    ? (shipment.recipientId === currentUserId ? t('trade_detail.ship_item_to_you') : t('trade_detail.ship_item_to_other'))
                                    : (isMyShipment ? t('trade_detail.your_shipment') : t('trade_detail.incoming_shipment'))
                                  }
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  shipment.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                                  shipment.status === 'IN_TRANSIT' || shipment.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-50 text-blue-700' :
                                  shipment.status === 'LABEL_CREATED' ? 'bg-indigo-50 text-indigo-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {shipment.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              {shipment.carrierName && (
                                <span className="text-xs text-slate-500">{shipment.carrierName}</span>
                              )}
                            </div>

                            {/* Tracking number + Track button */}
                            {shipment.trackingNumber && (
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-slate-500">{t('trade_detail.tracking')} <span className="font-mono text-slate-700">{shipment.trackingNumber}</span></span>
                                {shipment.trackingUrl && !shipment.trackingNumber.startsWith('SIM') ? (
                                  <a
                                    href={shipment.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {t('trade_detail.track_shipment')}
                                  </a>
                                ) : shipment.trackingNumber.startsWith('SIM') ? (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">{t('trade_detail.simulated')}</span>
                                ) : null}
                              </div>
                            )}

                            {/* Get Rates — only for sender's PENDING shipment */}
                            {isMyShipment && shipment.status === 'PENDING' && (
                              <div className="mt-3">
                                <button
                                  disabled={ratesLoading}
                                  onClick={async () => {
                                    setRatesLoading(true);
                                    setActionError('');
                                    try {
                                      const r = await shippingApi.getRates(shipment.id);
                                      setRates(r);
                                      if (r.length === 0) {
                                        setActionError(t('trade_detail.no_rates'));
                                      }
                                    } catch (err: unknown) {
                                      setActionError(err instanceof Error ? err.message : t('trade_detail.rates_error'));
                                    }
                                    setRatesLoading(false);
                                  }}
                                  className="btn-secondary btn-sm w-full"
                                >
                                  {ratesLoading ? t('trade_detail.loading_rates') : t('trade_detail.get_rates')}
                                </button>

                                {rates.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    <p className="text-xs text-slate-500 font-medium">{t('trade_detail.select_carrier')}</p>
                                    {rates.map((rate) => (
                                      <label
                                        key={rate.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                          selectedRateId === rate.id
                                            ? 'border-navy-900 bg-navy-900/5'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="radio"
                                            name="rate"
                                            value={rate.id}
                                            checked={selectedRateId === rate.id}
                                            onChange={() => setSelectedRateId(rate.id)}
                                            className="accent-navy-900"
                                          />
                                          <div>
                                            <p className="text-sm font-medium text-slate-700">{rate.service}</p>
                                            <p className="text-xs text-slate-500">{rate.carrier} &middot; {rate.estimatedDays} day{rate.estimatedDays !== 1 ? 's' : ''}</p>
                                          </div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-900">{rate.rate.toFixed(2)} {rate.currency === 'TRY' ? '₺' : 'TL'}</span>
                                      </label>
                                    ))}
                                    <button
                                      disabled={!selectedRateId || actionLoading}
                                      onClick={() => handleAction(async () => {
                                        await shippingApi.buyLabel(shipment.id, selectedRateId);
                                        setRates([]);
                                        setSelectedRateId('');
                                        const updated = await shippingApi.getByTrade(tradeId);
                                        setShipments(updated);
                                      })}
                                      className="btn-emerald w-full mt-2"
                                    >
                                      {t('trade_detail.purchase_label')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Label purchased — show carrier info + print label */}
                            {isMyShipment && shipment.status === 'LABEL_CREATED' && (
                              <div className="mt-3 space-y-2">
                                <div className="text-sm text-indigo-600 py-2 px-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                  <p className="font-medium mb-1">{t('trade_detail.label_ready')}</p>
                                  <p>{t('trade_detail.label_take_package', { carrier: shipment.carrierName || 'carrier' })}</p>
                                  {shipment.barcode && (
                                    <p className="mt-1">{t('trade_detail.label_barcode', { barcode: shipment.barcode })}</p>
                                  )}
                                </div>
                                {shipment.labelUrl && (
                                  <a
                                    href={shipment.labelUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary btn-sm w-full text-center inline-block"
                                  >
                                    {t('trade_detail.print_label')}
                                  </a>
                                )}
                                {shipment.providerType === 'simulation' && (
                                  <button
                                    disabled={actionLoading}
                                    onClick={() => handleAction(async () => {
                                      await shippingApi.simulateProgress(shipment.id);
                                      const updated = await shippingApi.getByTrade(tradeId);
                                      setShipments(updated);
                                    })}
                                    className="btn-secondary btn-sm w-full"
                                  >
                                    {t('trade_detail.simulate_deliver')}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* In transit — simulate only in simulation mode */}
                            {isMyShipment && (shipment.status === 'IN_TRANSIT' || shipment.status === 'OUT_FOR_DELIVERY') && shipment.providerType === 'simulation' && (
                              <div className="mt-3">
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleAction(async () => {
                                    await shippingApi.simulateProgress(shipment.id);
                                    const updated = await shippingApi.getByTrade(tradeId);
                                    setShipments(updated);
                                  })}
                                  className="btn-secondary btn-sm w-full"
                                >
                                  {t('trade_detail.simulate_deliver')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Log */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('trade_detail.event_log')}</h2>
            </div>
            {events.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{t('trade_detail.no_events')}</div>
            ) : (
              <div className="p-3 space-y-1">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t(`event.${event.eventType}`)}</span>
                        {event.fromState && (
                          <span className="text-xs text-slate-400 ml-2">
                            {t(`state.${event.fromState}`)} → {t(`state.${event.toState}`)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(event.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== ACTIONS PANEL ========== */}
        <div className="space-y-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{t('trade_detail.actions')}</h2>
            </div>
            <div className="p-5 space-y-3">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  {actionError}
                </div>
              )}

              {trade.state === 'ACCEPTED' && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction(() => tradesApi.lockItems(tradeId))}
                  className="btn-emerald w-full"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('trade_detail.lock_items')}
                </button>
              )}

              {trade.state === 'LOCKED' && (
                <button
                  onClick={() => setShowProofForm((v) => !v)}
                  className="btn-emerald w-full"
                >
                  {showProofForm ? t('trade_detail.cancel_proof') : t('trade_detail.submit_proof')}
                </button>
              )}

              {trade.state === 'PROOF_SUBMITTED' && (
                isMod ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(() => tradesApi.beginVerification(tradeId))}
                    className="btn-primary w-full"
                  >
                    {t('trade_detail.begin_verification')}
                  </button>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-3 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    {t('trade_detail.awaiting_verification')}
                  </div>
                )
              )}

              {trade.state === 'UNDER_VERIFICATION' && (
                isMod ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(() => tradesApi.verify(tradeId))}
                    className="btn-emerald w-full"
                  >
                    {t('trade_detail.mark_verified')}
                  </button>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-3 px-3 bg-purple-50 rounded-lg border border-purple-200">
                    {t('trade_detail.under_review')}
                  </div>
                )
              )}

              {/* Payment Section — shown in VERIFIED state */}
              {trade.state === 'VERIFIED' && payments.length > 0 && (() => {
                const myFeePayment = payments.find(p => p.userId === currentUserId && p.type === 'trade_fee');
                const otherFeePayment = payments.find(p => p.userId !== currentUserId && p.type === 'trade_fee');
                const myInsurancePayment = payments.find(p => p.userId === currentUserId && p.type === 'trade_insurance');
                const bothPaid = trade.partyAPaid && trade.partyBPaid;
                const isInsurable = trade.riskLevel === 'MEDIUM' || trade.riskLevel === 'HIGH';
                const insurancePrice = trade.riskLevel === 'HIGH' ? 1000 : 300;
                const isMyPartyInsured = currentUserId === trade.partyAId ? trade.partyAInsured : trade.partyBInsured;

                return (
                  <>
                  {/* Transaction Fee Card */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <h4 className="text-sm font-semibold text-slate-800">{t('trade_detail.transaction_fee')}</h4>
                      {bothPaid && (
                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {t('trade_detail.both_paid')}
                        </span>
                      )}
                    </div>

                    {myFeePayment && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{t('trade_detail.your_fee')}</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {Number(myFeePayment.amount).toFixed(2)} {myFeePayment.currency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{t('trade_detail.status')}</span>
                          {myFeePayment.status === 'succeeded' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              {t('trade_detail.paid')}
                            </span>
                          ) : myFeePayment.status === 'refunded' ? (
                            <span className="text-xs font-medium text-amber-700">{t('trade_detail.refunded')}</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">{t('trade_detail.pending')}</span>
                          )}
                        </div>

                        {myFeePayment.status !== 'succeeded' && myFeePayment.status !== 'refunded' && (
                          <button
                            disabled={paymentLoading}
                            onClick={async () => {
                              setPaymentLoading(true);
                              setActionError('');
                              try {
                                const result = await paymentsApi.createCheckout(myFeePayment.id);
                                if ('simulated' in result) {
                                  loadTrade();
                                } else if ('checkoutUrl' in result) {
                                  window.location.href = (result as { checkoutUrl: string }).checkoutUrl;
                                }
                              } catch (err: unknown) {
                                setActionError(err instanceof Error ? err.message : 'Payment failed');
                              } finally {
                                setPaymentLoading(false);
                              }
                            }}
                            className="w-full py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {paymentLoading ? t('trade_detail.processing') : t('trade_detail.pay_now')}
                          </button>
                        )}
                      </div>
                    )}

                    {otherFeePayment && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500">{t('trade_detail.other_party')}</span>
                        {otherFeePayment.status === 'succeeded' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {t('trade_detail.paid')}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">{t('trade_detail.pending')}</span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-400">
                      {t('trade_detail.fee_note')}
                    </p>
                  </div>

                  {/* Insurance Card — only for MEDIUM and HIGH risk */}
                  {isInsurable && (
                    <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <h4 className="text-sm font-semibold text-slate-800">{t('trade_detail.insurance')}</h4>
                        {isMyPartyInsured && (
                          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {t('trade_detail.insured')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">{t('trade_detail.insurance_desc')}</p>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{t('trade_detail.insurance_price')}</span>
                        <span className="text-sm font-semibold text-slate-900">{insurancePrice.toFixed(2)} TRY</span>
                      </div>

                      {/* Insurance already paid */}
                      {myInsurancePayment && myInsurancePayment.status === 'succeeded' && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{t('trade_detail.status')}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {t('trade_detail.paid')}
                          </span>
                        </div>
                      )}

                      {/* Insurance pending — pay button + cancel link */}
                      {myInsurancePayment && myInsurancePayment.status !== 'succeeded' && myInsurancePayment.status !== 'refunded' && (
                        <div className="space-y-2">
                          <button
                            disabled={paymentLoading}
                            onClick={async () => {
                              setPaymentLoading(true);
                              setActionError('');
                              try {
                                const result = await paymentsApi.createCheckout(myInsurancePayment.id);
                                if ('simulated' in result) {
                                  loadTrade();
                                } else if ('checkoutUrl' in result) {
                                  window.location.href = (result as { checkoutUrl: string }).checkoutUrl;
                                }
                              } catch (err: unknown) {
                                setActionError(err instanceof Error ? err.message : 'Payment failed');
                              } finally {
                                setPaymentLoading(false);
                              }
                            }}
                            className="w-full py-2 px-4 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {paymentLoading ? t('trade_detail.processing') : t('trade_detail.pay_now')}
                          </button>
                          <button
                            disabled={paymentLoading}
                            onClick={async () => {
                              setPaymentLoading(true);
                              setActionError('');
                              try {
                                await paymentsApi.cancelInsurance(myInsurancePayment.id);
                                loadTrade();
                              } catch (err: unknown) {
                                setActionError(err instanceof Error ? err.message : 'Failed to cancel insurance');
                              } finally {
                                setPaymentLoading(false);
                              }
                            }}
                            className="w-full text-center text-xs text-slate-500 hover:text-red-600 transition-colors"
                          >
                            {t('trade_detail.remove_insurance')}
                          </button>
                        </div>
                      )}

                      {/* No insurance yet — add button */}
                      {!myInsurancePayment && !isMyPartyInsured && (
                        <button
                          disabled={paymentLoading}
                          onClick={async () => {
                            setPaymentLoading(true);
                            setActionError('');
                            try {
                              await paymentsApi.createInsurance(trade.id, trade.riskLevel);
                              loadTrade();
                            } catch (err: unknown) {
                              setActionError(err instanceof Error ? err.message : 'Failed to add insurance');
                            } finally {
                              setPaymentLoading(false);
                            }
                          }}
                          className="w-full py-2 px-4 bg-amber-50 text-amber-700 border border-amber-300 text-sm font-medium rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        >
                          {t('trade_detail.add_insurance')}
                        </button>
                      )}

                      <p className="text-xs text-slate-400">
                        {t('trade_detail.insurance_note')}
                      </p>
                    </div>
                  )}
                  </>
                );
              })()}

              {trade.state === 'VERIFIED' && !trade.shippingMethod && trade.partyAPaid && trade.partyBPaid && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-medium">{t('trade_detail.choose_delivery')}</p>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(() => tradesApi.setShippingMethod(tradeId, 'shipping'))}
                    className="btn-primary w-full"
                  >
                    {t('trade_detail.ship_carrier')}
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(() => tradesApi.setShippingMethod(tradeId, 'local_pickup'))}
                    className="btn-secondary w-full"
                  >
                    {t('trade_detail.local_pickup')}
                  </button>
                </div>
              )}

              {trade.state === 'VERIFIED' && trade.shippingMethod === 'local_pickup' && trade.partyAPaid && trade.partyBPaid && (
                <div className="space-y-2">
                  {(currentUserId === trade.partyAId ? trade.partyALocalPickupConfirmed : trade.partyBLocalPickupConfirmed) ? (
                    <div className="text-sm text-emerald-600 text-center py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      {t('trade_detail.confirmed_waiting')}
                    </div>
                  ) : (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleAction(() => tradesApi.confirmLocalPickup(tradeId))}
                      className="btn-emerald w-full"
                    >
                      {t('trade_detail.confirm_exchange')}
                    </button>
                  )}
                </div>
              )}

              {trade.state === 'VERIFIED' && trade.shippingMethod === 'shipping' && trade.partyAPaid && trade.partyBPaid && !(trade.partyAAddressSubmitted && trade.partyBAddressSubmitted) && (
                <div className="text-sm text-indigo-600 text-center py-3 px-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  {(currentUserId === trade.partyAId ? trade.partyAAddressSubmitted : trade.partyBAddressSubmitted)
                    ? t('trade_detail.waiting_address')
                    : t('trade_detail.submit_address_prompt')}
                </div>
              )}

              {trade.state === 'VERIFIED' && trade.shippingMethod === 'shipping' && trade.partyAPaid && trade.partyBPaid && trade.partyAAddressSubmitted && trade.partyBAddressSubmitted && (
                <div className="text-sm text-blue-600 text-center py-3 px-3 bg-blue-50 rounded-lg border border-blue-200">
                  {t('trade_detail.both_addresses')}
                </div>
              )}

              {(trade.state === 'AWAITING_SHIPMENT' || trade.state === 'IN_TRANSIT') && (
                <div className="text-sm text-blue-600 text-center py-3 px-3 bg-blue-50 rounded-lg border border-blue-200">
                  {trade.state === 'AWAITING_SHIPMENT'
                    ? t('trade_detail.both_labels')
                    : t('trade_detail.items_in_transit')}
                </div>
              )}

              {trade.state === 'DELIVERED' && isDisputeWindowOpen() && (
                <div className="space-y-3">
                  <div className="text-sm text-cyan-600 text-center py-3 px-3 bg-cyan-50 rounded-lg border border-cyan-200">
                    {t('trade_detail.delivered_dispute', { date: trade.disputeWindowEnd ? new Date(trade.disputeWindowEnd).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US') : t('trade_detail.risk_na') })}
                  </div>
                  {/* Countdown timer */}
                  {countdownText && (
                    <div className="flex items-center justify-center gap-2 py-2 px-3 bg-amber-50 rounded-lg border border-amber-200">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-amber-700">
                        {t('trade_detail.inspection_remaining', { time: countdownText })}
                      </span>
                    </div>
                  )}
                  {/* Confirm Receipt button */}
                  {(() => {
                    const myConfirmed = currentUserId === trade.partyAId ? trade.partyAConfirmedReceipt : trade.partyBConfirmedReceipt;
                    const otherConfirmed = currentUserId === trade.partyAId ? trade.partyBConfirmedReceipt : trade.partyAConfirmedReceipt;
                    if (myConfirmed) {
                      return (
                        <div className="text-sm text-emerald-600 text-center py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('trade_detail.receipt_confirmed_waiting')}
                        </div>
                      );
                    }
                    return (
                      <>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleAction(() => tradesApi.confirmReceipt(tradeId))}
                          className="btn-emerald w-full"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('trade_detail.confirm_receipt')}
                        </button>
                        <p className="text-xs text-slate-400 text-center">
                          {t('trade_detail.confirm_receipt_note')}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}

              {['VERIFIED', 'IN_TRANSIT', 'DELIVERED'].includes(trade.state) && isDisputeWindowOpen() && (
                <button onClick={() => setShowDisputeModal(true)} className="btn-danger w-full">
                  {t('trade_detail.open_dispute')}
                </button>
              )}

              {['INITIATED', 'OFFERED', 'ACCEPTED'].includes(trade.state) && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction(() => tradesApi.cancel(tradeId))}
                  className="btn-secondary w-full text-red-600 hover:text-red-700 hover:border-red-200"
                >
                  {t('trade_detail.cancel_trade')}
                </button>
              )}

              {isTerminal && (
                <p className="text-sm text-slate-400 text-center py-2">
                  {t('trade_detail.final_state')}
                </p>
              )}

              {trade.state === 'DISPUTE_OPEN' && (
                <Link href={`/disputes?tradeId=${trade.id}`} className="btn-secondary w-full text-center">
                  {t('trade_detail.view_dispute')}
                </Link>
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-slate-700 mb-3">{t('trade_detail.risk_breakdown')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{t('trade_detail.risk_level')}</span>
                <span className={`font-medium ${
                  trade.riskLevel === 'LOW' ? 'text-emerald-600' : trade.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'
                }`}>{trade.riskLevel}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    trade.riskLevel === 'LOW' ? 'bg-emerald-500' : trade.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(trade.riskScore || 0) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {trade.riskLevel === 'LOW'
                  ? t('trade_detail.risk_low_desc')
                  : trade.riskLevel === 'MEDIUM'
                    ? t('trade_detail.risk_medium_desc')
                    : t('trade_detail.risk_high_desc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== PROOF FORM ========== */}
      {showProofForm && trade.state === 'LOCKED' && (
        <div className="card mt-6 p-6 border-emerald-200">
          <h3 className="font-semibold text-slate-900 mb-1">{t('trade_detail.submit_proof_title')}</h3>
          <p className="text-sm text-slate-500 mb-3">
            {t('trade_detail.submit_proof_desc')}
          </p>
          {/* Video requirement notice */}
          <div className="flex items-start gap-2.5 p-3 mb-5 bg-amber-50 rounded-lg border border-amber-200">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">{t('trade_detail.video_required_title')}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t('trade_detail.video_required_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmitProof} className="space-y-4">
            {proofEntries.map((entry, index) => (
              <div key={index} className="card p-4 relative">
                <button
                  type="button"
                  onClick={() => removeProofEntry(index)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-xs"
                >
                  x
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    entry.type === 'photo' ? 'bg-blue-50 text-blue-700' :
                    entry.type === 'video' ? 'bg-purple-50 text-purple-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {entry.type === 'photo' ? t('trade_detail.proof_photo') : entry.type === 'video' ? t('trade_detail.proof_video') : t('trade_detail.proof_text')}
                  </span>
                </div>

                {entry.type === 'text' ? (
                  <textarea
                    placeholder={t('trade_detail.proof_text_placeholder')}
                    value={entry.textContent || ''}
                    onChange={(e) => setProofEntries(prev => prev.map((p, i) => i === index ? { ...p, textContent: e.target.value } : p))}
                    rows={4}
                    className="input min-h-[100px] resize-y"
                  />
                ) : (
                  <div>
                    {entry.preview ? (
                      <div className="relative mb-2">
                        {entry.type === 'photo' ? (
                          <img src={entry.preview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg bg-slate-50" />
                        ) : (
                          <video src={entry.preview} controls className="w-full max-h-64 rounded-lg bg-black" />
                        )}
                        <button
                          type="button"
                          onClick={() => setProofEntries(prev => prev.map((p, i) => {
                            if (i !== index) return p;
                            if (p.preview) URL.revokeObjectURL(p.preview);
                            return { ...p, file: undefined, preview: undefined };
                          }))}
                          className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80"
                        >
                          {t('common.change')}
                        </button>
                        <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                          {entry.file?.name} ({((entry.file?.size || 0) / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                        <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {entry.type === 'photo' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          )}
                        </svg>
                        <span className="text-sm text-slate-500">
                          {entry.type === 'photo' ? t('trade_detail.click_upload_photo') : t('trade_detail.click_upload_video')}
                        </span>
                        <span className="text-xs text-slate-400 mt-1">
                          {entry.type === 'photo' ? t('trade_detail.photo_formats') : t('trade_detail.video_formats')}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept={entry.type === 'photo' ? 'image/*' : 'video/*'}
                          onChange={(e) => handleFileSelect(index, e.target.files)}
                        />
                      </label>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  placeholder={t('trade_detail.proof_desc_optional')}
                  value={entry.description}
                  onChange={(e) => setProofEntries(prev => prev.map((p, i) => i === index ? { ...p, description: e.target.value } : p))}
                  className="input mt-2"
                />
              </div>
            ))}

            {/* Add buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => addProofEntry('photo')} className="btn-secondary btn-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('trade_detail.add_photo')}
              </button>
              <button type="button" onClick={() => addProofEntry('video')} className="btn-secondary btn-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('trade_detail.add_video')}
              </button>
              <button type="button" onClick={() => addProofEntry('text')} className="btn-secondary btn-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('trade_detail.add_text_note')}
              </button>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={actionLoading || !!uploadProgress || proofEntries.length === 0}
                className="btn-emerald"
              >
                {uploadProgress || (actionLoading ? t('trade_detail.submitting') : t('trade_detail.submit_proof_btn'))}
              </button>
              {proofEntries.length === 0 && (
                <span className="text-xs text-slate-400">{t('trade_detail.proof_hint')}</span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ========== DISPUTE MODAL ========== */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 animate-slide-up shadow-modal">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('trade_detail.open_dispute')}</h3>
            <form onSubmit={handleOpenDispute} className="space-y-4">
              <div>
                <label className="label">{t('trade_detail.dispute_reason')}</label>
                <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="input">
                  <option value="item_mismatch">{t('trade_detail.reason_mismatch')}</option>
                  <option value="not_received">{t('trade_detail.reason_not_received')}</option>
                  <option value="damaged">{t('trade_detail.reason_damaged')}</option>
                  <option value="counterfeit">{t('trade_detail.reason_counterfeit')}</option>
                  <option value="other">{t('trade_detail.reason_other')}</option>
                </select>
              </div>
              <div>
                <label className="label">{t('trade_detail.dispute_description')}</label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  rows={4}
                  placeholder={t('trade_detail.dispute_desc_placeholder')}
                  className="input min-h-[100px] resize-y"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDisputeModal(false)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={actionLoading} className="btn-danger">
                  {actionLoading ? t('trade_detail.opening_dispute') : t('trade_detail.open_dispute')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Address Modal (for trade page) */}
      {showNewAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t('trade_detail.add_new_address')}</h3>
              <button onClick={() => setShowNewAddressModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <AddressForm
                value={newAddressForm}
                onChange={setNewAddressForm}
                showMetaFields
                label={newAddressLabel}
                onLabelChange={setNewAddressLabel}
                isDefault={newAddressIsDefault}
                onIsDefaultChange={setNewAddressIsDefault}
              />
              {newAddressError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {newAddressError}
                </div>
              )}
              <div className="flex gap-3 mt-3">
                <button
                  disabled={newAddressSaving}
                  onClick={async () => {
                    const validationError = validateAddress(newAddressForm);
                    if (validationError) {
                      setNewAddressError(validationError);
                      return;
                    }
                    setNewAddressError('');
                    setNewAddressSaving(true);
                    try {
                      const created = await addressApi.create({
                        label: newAddressLabel,
                        isDefault: newAddressIsDefault,
                        ...newAddressForm,
                      } as SavedAddress);
                      setSavedAddresses((prev) => [...prev, created]);
                      setSelectedAddressId(created.id);
                      setShowNewAddressModal(false);
                      setNewAddressForm({
                        name: '', street: '', city: '', state: '', postalCode: '', country: '', phone: '',
                        district: '', neighbourhood: '', email: '', countryCode: '', stateCode: '', cityCode: '',
                      });
                      setNewAddressLabel('');
                      setNewAddressIsDefault(false);
                      setNewAddressError('');
                    } catch (err: unknown) {
                      setNewAddressError(err instanceof Error ? err.message : t('trade_detail.address_save_failed'));
                    }
                    setNewAddressSaving(false);
                  }}
                  className="btn-primary flex-1"
                >
                  {newAddressSaving ? t('trade_detail.saving_address') : t('trade_detail.save_address')}
                </button>
                <button onClick={() => { setShowNewAddressModal(false); setNewAddressError(''); }} className="btn-secondary">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
