'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { Trade, Dispute } from '@/types';

export default function AdminDashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    Promise.allSettled([
      adminApi.getAllTrades(),
      adminApi.getOpenDisputes(),
    ]).then(([tradesRes, disputesRes]) => {
      if (tradesRes.status === 'fulfilled') setTrades(tradesRes.value);
      if (disputesRes.status === 'fulfilled') setDisputes(disputesRes.value);
      setLoading(false);
    });
  }, []);

  const pendingVerification = trades.filter(
    (t) => t.state === 'PROOF_SUBMITTED' || t.state === 'UNDER_VERIFICATION',
  ).length;
  const activeTrades = trades.filter(
    (t) => !['COMPLETED', 'CANCELLED', 'REVOKED'].includes(t.state),
  ).length;
  const completedTrades = trades.filter((t) => t.state === 'COMPLETED').length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Manage verifications, disputes, and users</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/verifications" className="card-hover p-5 block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pendingVerification}</p>
              <p className="text-xs text-slate-500">Pending Verification</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/disputes" className="card-hover p-5 block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{disputes.length}</p>
              <p className="text-xs text-slate-500">Open Disputes</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/trades?filter=active" className="card-hover p-5 block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeTrades}</p>
              <p className="text-xs text-slate-500">Active Trades</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/trades?filter=completed" className="card-hover p-5 block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{completedTrades}</p>
              <p className="text-xs text-slate-500">Completed Trades</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/verifications" className="card-hover p-6 block">
          <h3 className="font-semibold text-slate-900 mb-1">Verification Queue</h3>
          <p className="text-sm text-slate-500 mb-3">Review submitted proof and verify trades</p>
          {pendingVerification > 0 ? <span className="badge-amber">{pendingVerification} awaiting review</span> : <span className="badge-emerald">All clear</span>}
        </Link>
        <Link href="/admin/disputes" className="card-hover p-6 block">
          <h3 className="font-semibold text-slate-900 mb-1">Dispute Resolution</h3>
          <p className="text-sm text-slate-500 mb-3">Resolve open disputes between parties</p>
          {disputes.length > 0 ? <span className="badge-red">{disputes.length} open</span> : <span className="badge-emerald">No open disputes</span>}
        </Link>
        <Link href="/admin/users" className="card-hover p-6 block">
          <h3 className="font-semibold text-slate-900 mb-1">User Management</h3>
          <p className="text-sm text-slate-500 mb-3">View and manage all registered accounts</p>
          <span className="badge-slate">Manage users</span>
        </Link>
      </div>
    </div>
  );
}
