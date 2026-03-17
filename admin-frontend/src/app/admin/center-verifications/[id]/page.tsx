'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { centerVerificationsApi, centersApi, listingsApi, tradesApi } from '@/lib/api';
import { getImageUrl } from '@/lib/api';
import type { CenterVerification, VerificationCenter, Listing, Trade } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  item_received: 'bg-blue-50 text-blue-700 border-blue-200',
  inspecting: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const LISTING_STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  locked: 'bg-amber-50 text-amber-700',
  traded: 'bg-blue-50 text-blue-700',
  archived: 'bg-slate-100 text-slate-600',
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export default function CenterVerificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [verification, setVerification] = useState<CenterVerification | null>(null);
  const [center, setCenter] = useState<VerificationCenter | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [trade, setTrade] = useState<(Trade & { availableActions: string[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showListingModal, setShowListingModal] = useState(false);

  // Photo upload state
  const [approveFiles, setApproveFiles] = useState<File[]>([]);
  const [rejectFiles, setRejectFiles] = useState<File[]>([]);
  const [approvePreviews, setApprovePreviews] = useState<string[]>([]);
  const [rejectPreviews, setRejectPreviews] = useState<string[]>([]);
  const approveInputRef = useRef<HTMLInputElement>(null);
  const rejectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const v = await centerVerificationsApi.getById(id);
      setVerification(v);

      const [c, l, t] = await Promise.all([
        centersApi.getById(v.centerId),
        listingsApi.getById(v.listingId).catch(() => null),
        tradesApi.getById(v.tradeId).catch(() => null),
      ]);
      setCenter(c);
      setListing(l);
      setTrade(t);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load verification');
    }
    setLoading(false);
  }

  function handleFileSelect(files: FileList | null, target: 'approve' | 'reject') {
    if (!files) return;
    const newFiles = Array.from(files);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    if (target === 'approve') {
      setApproveFiles(prev => [...prev, ...newFiles]);
      setApprovePreviews(prev => [...prev, ...previews]);
    } else {
      setRejectFiles(prev => [...prev, ...newFiles]);
      setRejectPreviews(prev => [...prev, ...previews]);
    }
  }

  function removeFile(index: number, target: 'approve' | 'reject') {
    if (target === 'approve') {
      URL.revokeObjectURL(approvePreviews[index]);
      setApproveFiles(prev => prev.filter((_, i) => i !== index));
      setApprovePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(rejectPreviews[index]);
      setRejectFiles(prev => prev.filter((_, i) => i !== index));
      setRejectPreviews(prev => prev.filter((_, i) => i !== index));
    }
  }

  async function handleMarkReceived() {
    setActionLoading(true);
    setError('');
    try {
      const updated = await centerVerificationsApi.markReceived(id);
      setVerification(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark received');
    }
    setActionLoading(false);
  }

  async function handleApprove() {
    if (approveFiles.length === 0) {
      setError('Please upload at least one photo as verification evidence');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const photoUrls = await centerVerificationsApi.uploadPhotos(approveFiles);
      const updated = await centerVerificationsApi.approve(id, notes || undefined, photoUrls);
      setVerification(updated);
      setApproveFiles([]);
      setApprovePreviews([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
    setActionLoading(false);
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError('Rejection reason is required');
      return;
    }
    if (rejectFiles.length === 0) {
      setError('Please upload at least one photo as evidence for rejection');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const photoUrls = await centerVerificationsApi.uploadPhotos(rejectFiles);
      const updated = await centerVerificationsApi.reject(id, rejectReason, photoUrls);
      setVerification(updated);
      setRejectFiles([]);
      setRejectPreviews([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
    setActionLoading(false);
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-slate-500">Loading verification...</p></div>;
  }

  if (!verification) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-red-600">{error || 'Verification not found'}</p></div>;
  }

  const listingThumb = listing?.images?.[0]?.url;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <button onClick={() => router.push('/admin/center-verifications')} className="text-sm text-amber-600 hover:text-amber-800">
        &larr; Back to Queue
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Center Verification Detail</h1>
        <span className={`text-sm px-3 py-1 rounded-full border ${STATUS_COLORS[verification.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          {verification.status.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Verification Info</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">ID</dt><dd className="font-mono text-xs">{verification.id.slice(0, 12)}...</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Trade</dt><dd className="font-mono text-xs">{verification.tradeId.slice(0, 12)}...</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Party</dt><dd className="font-medium">Party {verification.party}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd>{new Date(verification.createdAt).toLocaleString()}</dd></div>
            {verification.receivedAt && (
              <div className="flex justify-between"><dt className="text-slate-500">Received</dt><dd>{new Date(verification.receivedAt).toLocaleString()}</dd></div>
            )}
            {verification.verifiedAt && (
              <div className="flex justify-between"><dt className="text-slate-500">Verified</dt><dd>{new Date(verification.verifiedAt).toLocaleString()}</dd></div>
            )}
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Center</h3>
          {center ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium">{center.name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Code</dt><dd className="font-mono text-xs">{center.code}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Location</dt><dd>{center.city}, {center.district}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Contact</dt><dd>{center.contactName}</dd></div>
            </dl>
          ) : (
            <p className="text-slate-400 text-sm">Center not found</p>
          )}
        </div>
      </div>

      {/* Listing Card (clickable, same style as frontend listing cards) */}
      {listing && (
        <div
          onClick={() => setShowListingModal(true)}
          className="bg-white border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
        >
          <h3 className="text-xs font-semibold text-slate-500 uppercase px-5 pt-4 pb-2">Item Details</h3>
          <div className="flex">
            {/* Thumbnail */}
            <div className="w-40 h-32 flex-shrink-0 bg-slate-100 overflow-hidden ml-5 mb-4 rounded-lg">
              {listingThumb ? (
                <img src={getImageUrl(listingThumb)} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 px-5 pb-4 pt-1">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900 text-sm line-clamp-1 flex-1 mr-2">{listing.title}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${LISTING_STATUS_STYLES[listing.status] || 'bg-slate-100 text-slate-600'}`}>
                  {listing.status}
                </span>
              </div>
              {listing.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-2">{listing.description}</p>
              )}
              <div className="flex items-center gap-3">
                {listing.category?.name && (
                  <span className="text-xs font-medium text-slate-600">{listing.category.name}</span>
                )}
                {listing.condition && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {CONDITION_LABELS[listing.condition] || listing.condition}
                  </span>
                )}
              </div>
              {listing.location && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.location}
                </div>
              )}
              <p className="text-xs text-amber-600 mt-2 font-medium">Click to view full details &rarr;</p>
            </div>
          </div>
        </div>
      )}

      {/* Listing Detail Modal */}
      {showListingModal && listing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowListingModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Listing Details</h2>
              <button onClick={() => setShowListingModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Gallery */}
            {listing.images && listing.images.length > 0 && (
              <div className="px-6 pt-4">
                <div className="grid grid-cols-3 gap-2">
                  {listing.images.map(img => (
                    <div key={img.id} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                      <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-xl font-bold text-slate-900">{listing.title}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full ${LISTING_STATUS_STYLES[listing.status] || 'bg-slate-100 text-slate-600'}`}>
                  {listing.status}
                </span>
              </div>

              {listing.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{listing.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {listing.category?.name && (
                  <div>
                    <span className="text-slate-400 text-xs uppercase font-semibold">Category</span>
                    <p className="text-slate-700 mt-0.5">{listing.category.name}</p>
                  </div>
                )}
                {listing.condition && (
                  <div>
                    <span className="text-slate-400 text-xs uppercase font-semibold">Condition</span>
                    <p className="text-slate-700 mt-0.5">{CONDITION_LABELS[listing.condition] || listing.condition}</p>
                  </div>
                )}
                {listing.location && (
                  <div>
                    <span className="text-slate-400 text-xs uppercase font-semibold">Location</span>
                    <p className="text-slate-700 mt-0.5">{listing.location}</p>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 text-xs uppercase font-semibold">Listed</span>
                  <p className="text-slate-700 mt-0.5">{new Date(listing.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Photos (from previous actions) */}
      {verification.photoUrls && verification.photoUrls.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Verification Photos</h3>
          <div className="flex gap-3 flex-wrap">
            {verification.photoUrls.map((url, i) => (
              <img key={i} src={getImageUrl(url)} alt={`Verification photo ${i + 1}`} className="w-32 h-32 rounded-lg object-cover border border-slate-200" />
            ))}
          </div>
        </div>
      )}

      {/* Admin Notes / Rejection */}
      {verification.notes && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Admin Notes</h3>
          <p className="text-sm text-slate-700">{verification.notes}</p>
        </div>
      )}
      {verification.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-red-500 uppercase mb-2">Rejection Reason</h3>
          <p className="text-sm text-red-700">{verification.rejectionReason}</p>
        </div>
      )}

      {/* Actions */}
      {verification.status === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Action: Mark Item Received</h3>
          <p className="text-sm text-slate-600 mb-4">Confirm that this item has physically arrived at the verification center.</p>
          <button
            disabled={actionLoading}
            onClick={handleMarkReceived}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Mark as Received'}
          </button>
        </div>
      )}

      {(verification.status === 'item_received' || verification.status === 'inspecting') && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-6">
          {/* Approve Section */}
          <div>
            <h3 className="text-xs font-semibold text-emerald-600 uppercase mb-3">Approve Item</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes about the item condition..."
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3"
              rows={2}
            />

            {/* Photo Upload for Approve */}
            <div className="mb-3">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Verification Photos (required)</label>
              <input
                ref={approveInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFileSelect(e.target.files, 'approve')}
              />
              <div className="flex flex-wrap gap-2 items-start">
                {approvePreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                    <button
                      onClick={() => removeFile(i, 'approve')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => approveInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] mt-0.5">Photo</span>
                </button>
              </div>
            </div>

            <button
              disabled={actionLoading || approveFiles.length === 0}
              onClick={handleApprove}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Uploading & Approving...' : 'Approve Item'}
            </button>
          </div>

          <hr className="border-slate-200" />

          {/* Reject Section */}
          <div>
            <h3 className="text-xs font-semibold text-red-500 uppercase mb-3">Reject Item</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              className="w-full border border-red-300 rounded-md px-3 py-2 text-sm mb-3"
              rows={2}
            />

            {/* Photo Upload for Reject */}
            <div className="mb-3">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Evidence Photos (required)</label>
              <input
                ref={rejectInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFileSelect(e.target.files, 'reject')}
              />
              <div className="flex flex-wrap gap-2 items-start">
                {rejectPreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                    <button
                      onClick={() => removeFile(i, 'reject')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => rejectInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-red-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-red-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] mt-0.5">Photo</span>
                </button>
              </div>
            </div>

            <button
              disabled={actionLoading || !rejectReason.trim() || rejectFiles.length === 0}
              onClick={handleReject}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Uploading & Rejecting...' : 'Reject Item'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
