'use client';

import { useState, useEffect } from 'react';
import { centersApi } from '@/lib/api';
import type { VerificationCenter } from '@/types';

export default function CentersPage() {
  const [centers, setCenters] = useState<VerificationCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '', code: '', city: '', district: '', street: '',
    postalCode: '', country: 'TR', phone: '', email: '',
    contactName: '', operatingHours: 'Mon-Sat 09:00-18:00',
  });

  useEffect(() => {
    loadCenters();
  }, []);

  async function loadCenters() {
    try {
      const data = await centersApi.listAll();
      setCenters(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load centers');
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      name: '', code: '', city: '', district: '', street: '',
      postalCode: '', country: 'TR', phone: '', email: '',
      contactName: '', operatingHours: 'Mon-Sat 09:00-18:00',
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(center: VerificationCenter) {
    setFormData({
      name: center.name, code: center.code, city: center.city,
      district: center.district, street: center.street,
      postalCode: center.postalCode, country: center.country,
      phone: center.phone, email: center.email,
      contactName: center.contactName, operatingHours: center.operatingHours,
    });
    setEditingId(center.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await centersApi.update(editingId, formData);
      } else {
        await centersApi.create(formData);
      }
      resetForm();
      await loadCenters();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save center');
    }
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto p-6"><p className="text-slate-500">Loading centers...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Verification Centers</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
        >
          + Add Center
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">{editingId ? 'Edit Center' : 'New Center'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
              <input value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="IST-KDK" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input value={formData.city} onChange={e => setFormData(p => ({...p, city: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">District</label>
              <input value={formData.district} onChange={e => setFormData(p => ({...p, district: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Street Address</label>
              <input value={formData.street} onChange={e => setFormData(p => ({...p, street: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Postal Code</label>
              <input value={formData.postalCode} onChange={e => setFormData(p => ({...p, postalCode: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <input value={formData.country} onChange={e => setFormData(p => ({...p, country: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input value={formData.contactName} onChange={e => setFormData(p => ({...p, contactName: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Operating Hours</label>
              <input value={formData.operatingHours} onChange={e => setFormData(p => ({...p, operatingHours: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors">
              {editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">City</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {centers.map(center => (
              <tr key={center.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{center.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{center.name}</td>
                <td className="px-4 py-3 text-slate-600">{center.city}, {center.district}</td>
                <td className="px-4 py-3 text-slate-600">{center.contactName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${center.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {center.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(center)} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Edit</button>
                </td>
              </tr>
            ))}
            {centers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No centers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
