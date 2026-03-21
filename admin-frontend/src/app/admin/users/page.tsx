'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isModeratorOrAdmin } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { UserSummary } from '@/types';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  moderator: 'bg-amber-50 text-amber-700',
  user: 'bg-blue-50 text-blue-700',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBanId, setConfirmBanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [banning, setBanning] = useState(false);

  useEffect(() => {
    if (!isModeratorOrAdmin()) { window.location.href = '/login'; return; }
    adminApi.getUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (userId: string) => {
    setDeleting(true);
    try {
      await adminApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleBan = async (userId: string) => {
    setBanning(true);
    try {
      await adminApi.banUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmBanId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setBanning(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">User Management</h1>
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{users.length} accounts</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {users.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-slate-500">No users found</p></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="px-5 py-4">
                {confirmDeleteId === user.id ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">Delete {user.email}?</p>
                      <p className="text-xs text-slate-500">Account will be removed but they can re-register.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(user.id)} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="btn-secondary text-xs py-1.5">Cancel</button>
                    </div>
                  </div>
                ) : confirmBanId === user.id ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">Ban {user.email}?</p>
                      <p className="text-xs text-slate-500">Account will be deleted and this email will be permanently blocked from re-registering.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleBan(user.id)} disabled={banning} className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {banning ? 'Banning...' : 'Confirm Ban'}
                      </button>
                      <button onClick={() => setConfirmBanId(null)} disabled={banning} className="btn-secondary text-xs py-1.5">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">{user.email[0].toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.email}</p>
                        <p className="text-xs text-slate-400 font-mono">{user.id.slice(0, 12)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role] || 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                      <span className="text-xs text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</span>
                      <button onClick={() => { setConfirmBanId(user.id); setConfirmDeleteId(null); }} className="text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2 py-1 rounded">Ban</button>
                      <button onClick={() => { setConfirmDeleteId(user.id); setConfirmBanId(null); }} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
