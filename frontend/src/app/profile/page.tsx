'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { profileApi, authApi, addressApi, getImageUrl } from '@/lib/api';
import { isAuthenticated, getUserId, clearTokens, getRole } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Profile, TrustScore, SavedAddress, ShippingAddress } from '@/types';
import AddressForm, { validateAddress } from '@/components/AddressForm';

const TRUST_COLOR_CLASSES: Record<string, string> = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

function TrustScoreWidget({ score }: { score: number }) {
  const { t } = useTranslation();
  const clamped = Math.min(100, Math.max(0, score));
  const colorKey = clamped >= 70 ? 'emerald' : clamped >= 40 ? 'amber' : 'red';
  const colorClass = TRUST_COLOR_CLASSES[colorKey];
  const strokeColor = colorKey === 'emerald' ? '#10B981' : colorKey === 'amber' ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray={`${clamped}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${colorClass}`}>{clamped.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-slate-700">{t('profile.trust_score')}</span>
        <div className={`text-xs ${colorClass}`}>
          {clamped >= 70 ? t('profile.trust_excellent') : clamped >= 40 ? t('profile.trust_average') : t('profile.trust_low')}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Address state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [addressForm, setAddressForm] = useState<ShippingAddress>({
    name: '', street: '', city: '', state: '', postalCode: '', country: '', phone: '',
    district: '', neighbourhood: '', email: '', countryCode: '', stateCode: '', cityCode: '',
  });
  const [addressLabel, setAddressLabel] = useState('');
  const [addressIsDefault, setAddressIsDefault] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');

  const currentUserId = getUserId();

  const loadAddresses = () => {
    addressApi.getAll().then(setAddresses).catch(() => {});
  };

  useEffect(() => {
    if (!isAuthenticated()) { window.location.replace('/login'); return; }
    Promise.allSettled([
      profileApi.getMyProfile(),
      currentUserId ? profileApi.getTrustScore(currentUserId) : Promise.reject('no userId'),
      addressApi.getAll(),
    ]).then(([profileResult, trustResult, addressResult]) => {
      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value;
        setProfile(p);
        setDisplayName(p.displayName);
        setBio(p.bio || '');
        setLocation(p.location || '');
        setAvatarUrl(p.avatarUrl || '');
      } else {
        setError('Failed to load profile');
      }
      if (trustResult.status === 'fulfilled') setTrustScore(trustResult.value);
      if (addressResult.status === 'fulfilled') setAddresses(addressResult.value);
    }).finally(() => setLoading(false));
  }, [currentUserId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const uploaded = await profileApi.uploadAvatar(avatarFile);
        finalAvatarUrl = uploaded.url;
      }
      const updated = await profileApi.updateProfile({
        displayName,
        bio: bio || undefined,
        location: location || undefined,
        avatarUrl: finalAvatarUrl || undefined,
      });
      setProfile(updated);
      setAvatarUrl(updated.avatarUrl || '');
      setAvatarFile(null);
      setAvatarPreview('');
      setEditMode(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount();
      const savedLocale = localStorage.getItem('locale');
      clearTokens();
      if (savedLocale) localStorage.setItem('locale', savedLocale);
      window.location.href = '/';
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setAvatarUrl(profile.avatarUrl || '');
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setEditMode(false);
    setSaveError('');
  };

  const openAddressModal = (addr?: SavedAddress) => {
    if (addr) {
      setEditingAddress(addr);
      setAddressLabel(addr.label);
      setAddressIsDefault(addr.isDefault);
      setAddressForm({
        name: addr.name, street: addr.street, city: addr.city, state: addr.state,
        postalCode: addr.postalCode, country: addr.country, phone: addr.phone,
        district: addr.district || '', neighbourhood: addr.neighbourhood || '',
        email: addr.email || '', countryCode: addr.countryCode || '',
        stateCode: addr.stateCode || '', cityCode: addr.cityCode || '',
      });
    } else {
      setEditingAddress(null);
      setAddressLabel('');
      setAddressIsDefault(false);
      setAddressForm({
        name: '', street: '', city: '', state: '', postalCode: '', country: '', phone: '',
        district: '', neighbourhood: '', email: '', countryCode: '', stateCode: '', cityCode: '',
      });
    }
    setAddressError('');
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    setAddressError('');
    const validationError = validateAddress(addressForm);
    if (validationError) {
      setAddressError(validationError);
      return;
    }
    setAddressSaving(true);
    try {
      const payload = {
        label: addressLabel,
        isDefault: addressIsDefault,
        ...addressForm,
      };
      if (editingAddress) {
        await addressApi.update(editingAddress.id, payload);
      } else {
        await addressApi.create(payload as SavedAddress);
      }
      loadAddresses();
      setShowAddressModal(false);
    } catch (err: unknown) {
      setAddressError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await addressApi.remove(id);
      loadAddresses();
    } catch { /* ignore */ }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressApi.setDefault(id);
      loadAddresses();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-6 w-40" />
              <div className="skeleton h-4 w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-red-500">{error || t('profile.not_found')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('profile.title')}</h1>
        {!editMode && (
          <button onClick={() => setEditMode(true)} className="btn-secondary">
            {t('profile.edit')}
          </button>
        )}
      </div>

      {!editMode ? (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="card p-6">
            <div className="flex items-start gap-5">
              {profile.avatarUrl ? (
                <img
                  src={getImageUrl(profile.avatarUrl)}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
                  <span className="text-white text-2xl font-bold">
                    {profile.displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">{profile.displayName}</h2>
                {(() => {
                  const role = getRole();
                  if (role === 'admin') return (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-1 bg-red-50 text-red-700 border border-red-200">{t('profile.role_admin')}</span>
                  );
                  if (role === 'moderator') return (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-1 bg-amber-50 text-amber-700 border border-amber-200">{t('profile.role_moderator')}</span>
                  );
                  return null;
                })()}
                {profile.location && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile.location}
                  </p>
                )}
                {profile.bio && <p className="text-sm text-slate-600 mt-2">{profile.bio}</p>}
              </div>
              {profile.totalTrades === 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-slate-500">{t('profile.new_user')}</span>
                </div>
              ) : trustScore ? (
                <TrustScoreWidget score={trustScore.score} />
              ) : null}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/trades" className="card p-5 text-center hover:shadow-md transition-shadow cursor-pointer">
              <span className="text-3xl font-bold text-slate-900">{profile.totalTrades}</span>
              <p className="text-sm text-slate-500 mt-1">{t('profile.total_trades')}</p>
            </Link>
            <Link href="/trades" className="card p-5 text-center hover:shadow-md transition-shadow cursor-pointer">
              <span className="text-3xl font-bold text-emerald-600">{profile.completedTrades}</span>
              <p className="text-sm text-slate-500 mt-1">{t('profile.completed')}</p>
            </Link>
          </div>

          {/* My Addresses */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{t('profile.addresses_title')}</h3>
              {addresses.length < 10 && (
                <button onClick={() => openAddressModal()} className="btn-secondary text-sm">
                  {t('profile.add_address')}
                </button>
              )}
            </div>
            {addresses.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-slate-500 mb-3">{t('profile.no_addresses')}</p>
                <button onClick={() => openAddressModal()} className="btn-primary text-sm">
                  {t('profile.add_first_address')}
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className={`border rounded-lg p-4 ${addr.isDefault ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {addr.label && <span className="text-sm font-semibold text-slate-900">{addr.label}</span>}
                          {addr.isDefault && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t('profile.default_badge')}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{addr.name}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {addr.street}
                          {addr.neighbourhood ? `, ${addr.neighbourhood}` : ''}
                        </p>
                        <p className="text-sm text-slate-500">
                          {addr.district ? `${addr.district}, ` : ''}
                          {addr.city}
                          {addr.state && addr.state !== addr.city ? `, ${addr.state}` : ''}
                          {addr.postalCode ? ` ${addr.postalCode}` : ''}
                        </p>
                        <p className="text-sm text-slate-500">{addr.country}</p>
                        <p className="text-xs text-slate-400 mt-1">{addr.phone}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-3 shrink-0">
                        {!addr.isDefault && (
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            {t('profile.set_default')}
                          </button>
                        )}
                        <button
                          onClick={() => openAddressModal(addr)}
                          className="text-xs text-slate-600 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
                        >
                          {t('profile.edit_address')}
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          {t('profile.delete_address')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Flags */}
          {trustScore?.riskFlags && trustScore.riskFlags.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-3">{t('profile.risk_flags')}</h3>
              <div className="flex flex-wrap gap-2">
                {trustScore.riskFlags.map((flag) => (
                  <span key={flag} className="badge-red">{flag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="flex gap-3">
            <Link href="/trades" className="btn-primary">{t('profile.my_trades')}</Link>
            <Link href={`/listings?userId=${currentUserId}`} className="btn-secondary">{t('profile.my_listings')}</Link>
            <button
              onClick={() => { const savedLocale = localStorage.getItem('locale'); clearTokens(); if (savedLocale) localStorage.setItem('locale', savedLocale); window.location.replace('/'); }}
              className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {t('profile.sign_out')}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-700 mb-1">{t('profile.danger_zone')}</h3>
            <p className="text-xs text-slate-500 mb-4">{t('profile.danger_desc')}</p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
                {deleteError}
              </div>
            )}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50 text-sm"
              >
                {t('profile.delete_account')}
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-1">{t('profile.delete_confirm_title')}</p>
                <p className="text-xs text-red-600 mb-4">{t('profile.delete_confirm_desc')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {deleting ? t('profile.deleting') : t('profile.delete_yes')}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                    disabled={deleting}
                    className="btn-secondary text-sm"
                  >
                    {t('profile.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('profile.edit_title')}</h3>
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {saveError}
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">{t('profile.display_name')}</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="label">{t('profile.bio')}</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input min-h-[80px] resize-y" />
            </div>
            <div>
              <label className="label">{t('profile.location')}</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{t('profile.photo')}</label>
              <div className="flex items-center gap-4">
                {(avatarPreview || avatarUrl) ? (
                  <img
                    src={avatarPreview || getImageUrl(avatarUrl)}
                    alt="Avatar preview"
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="btn-secondary text-sm"
                  >
                    {avatarUrl || avatarPreview ? t('profile.change_photo') : t('profile.upload_photo')}
                  </button>
                  {(avatarPreview || avatarUrl) && (
                    <button
                      type="button"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(''); setAvatarUrl(''); }}
                      className="text-xs text-red-500 hover:text-red-700 ml-2"
                    >
                      {t('profile.remove_photo')}
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                    if (avatarInputRef.current) avatarInputRef.current.value = '';
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-emerald">
                {saving ? t('profile.saving') : t('profile.save')}
              </button>
              <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                {t('profile.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editingAddress ? t('profile.address_modal_edit') : t('profile.address_modal_add')}
              </h3>
              <button onClick={() => setShowAddressModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {addressError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                  {addressError}
                </div>
              )}
              <AddressForm
                value={addressForm}
                onChange={setAddressForm}
                showMetaFields
                label={addressLabel}
                onLabelChange={setAddressLabel}
                isDefault={addressIsDefault}
                onIsDefaultChange={setAddressIsDefault}
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleSaveAddress}
                  disabled={addressSaving || addressForm.name.length < 4 || !addressForm.street || !addressForm.city || !addressForm.countryCode || !addressForm.phone}
                  className="btn-primary flex-1"
                >
                  {addressSaving ? t('profile.address_saving') : editingAddress ? t('profile.address_update') : t('profile.address_add')}
                </button>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="btn-secondary"
                >
                  {t('profile.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
