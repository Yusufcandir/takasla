'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { centerVerificationsApi, centersApi } from '@/lib/api';
import type { CenterVerification, VerificationCenter } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  item_received: 'bg-blue-50 text-blue-700',
  inspecting: 'bg-purple-50 text-purple-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function CenterVerificationsPage() {
  const [verifications, setVerifications] = useState<CenterVerification[]>([]);
  const [centers, setCenters] = useState<VerificationCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [v, c] = await Promise.all([
        centerVerificationsApi.getPending(),
        centersApi.list(),
      ]);
      setVerifications(v);
      setCenters(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load verifications');
    }
    setLoading(false);
  }

  function getCenterName(centerId: string): string {
    const center = centers.find(c => c.id === centerId);
    return center ? center.name : centerId.slice(0, 8);
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto p-6"><p className="text-slate-500">Loading verification queue...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Center Verification Queue</h1>
        <button onClick={loadData} className="text-sm text-amber-600 hover:text-amber-800 font-medium">Refresh</button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {verifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-400">
          No pending verifications
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Trade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Party</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Center</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Received</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map(v => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.tradeId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-medium">Party {v.party}</td>
                  <td className="px-4 py-3 text-slate-600">{getCenterName(v.centerId)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] || 'bg-slate-100 text-slate-600'}`}>
                      {v.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {v.receivedAt ? new Date(v.receivedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/center-verifications/${v.id}`}
                      className="text-xs font-medium text-amber-600 hover:text-amber-800">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
