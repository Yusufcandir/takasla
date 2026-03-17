'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import type { ShippingAddress } from '@/types';

interface GeoCountry {
  name: string;
  isoCode: string;
  phoneCode: string;
  flag: string;
}

interface GeoState {
  name: string;
  isoCode: string;
  countryCode: string;
}

interface GeoCity {
  name: string;
  stateCode: string;
  countryCode: string;
}

interface GeoDistrict {
  name: string;
}

interface GeoNeighbourhood {
  name: string;
}

function isValidTurkishPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // +905XXXXXXXXX (13 chars), 05XXXXXXXXX (11 chars), 5XXXXXXXXX (10 chars), 905XXXXXXXXX (12 chars)
  return /^(\+90|90|0)?5\d{9}$/.test(cleaned);
}

export function validateAddress(addr: ShippingAddress): string | null {
  if (!addr.name || addr.name.trim().length < 4) return 'Full name must be at least 4 characters.';
  if (!addr.countryCode) return 'Please select a country.';
  if (!addr.city) return 'Please select a city/province.';
  if (!addr.street || addr.street.trim().length < 3) return 'Please enter a street address.';
  if (!addr.phone) return 'Please enter a phone number.';
  if (addr.countryCode === 'TR' && !isValidTurkishPhone(addr.phone)) {
    return 'Please enter a valid Turkish phone number (e.g. +90 553 123 4567).';
  }
  if (addr.countryCode === 'TR' && !addr.district) return 'Please select a district (ilce).';
  return null;
}

interface AddressFormProps {
  value: ShippingAddress;
  onChange: (address: ShippingAddress) => void;
  label?: string;
  onLabelChange?: (label: string) => void;
  isDefault?: boolean;
  onIsDefaultChange?: (isDefault: boolean) => void;
  showMetaFields?: boolean;
}

export default function AddressForm({ value, onChange, label, onLabelChange, isDefault, onIsDefaultChange, showMetaFields }: AddressFormProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [districts, setDistricts] = useState<GeoDistrict[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<GeoNeighbourhood[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingNeighbourhoods, setLoadingNeighbourhoods] = useState(false);

  const isTurkey = value.countryCode === 'TR';

  // Load countries on mount
  useEffect(() => {
    fetch('/api/geo/countries')
      .then((r) => r.json())
      .then(setCountries)
      .catch(() => {})
      .finally(() => setLoadingCountries(false));
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!value.countryCode) {
      setStates([]);
      return;
    }
    setLoadingStates(true);
    fetch(`/api/geo/states?countryCode=${value.countryCode}`)
      .then((r) => r.json())
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [value.countryCode]);

  // Load cities when state changes (non-Turkey)
  useEffect(() => {
    if (!value.countryCode || !value.stateCode || isTurkey) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    fetch(`/api/geo/cities?countryCode=${value.countryCode}&stateCode=${value.stateCode}`)
      .then((r) => r.json())
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [value.countryCode, value.stateCode, isTurkey]);

  // Load districts when Turkish province is selected
  useEffect(() => {
    if (!isTurkey || !value.cityCode) {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    fetch(`/api/geo/turkey/districts?cityCode=${value.cityCode}`)
      .then((r) => r.json())
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [isTurkey, value.cityCode]);

  // Load neighbourhoods when Turkish district is selected
  useEffect(() => {
    if (!isTurkey || !value.cityCode || !value.district) {
      setNeighbourhoods([]);
      return;
    }
    setLoadingNeighbourhoods(true);
    fetch(`/api/geo/turkey/neighbourhoods?cityCode=${value.cityCode}&district=${encodeURIComponent(value.district)}`)
      .then((r) => r.json())
      .then(setNeighbourhoods)
      .catch(() => setNeighbourhoods([]))
      .finally(() => setLoadingNeighbourhoods(false));
  }, [isTurkey, value.cityCode, value.district]);

  const update = (partial: Partial<ShippingAddress>) => {
    onChange({ ...value, ...partial });
  };

  const handleCountryChange = (isoCode: string) => {
    const country = countries.find((c) => c.isoCode === isoCode);
    update({
      country: country?.name || '',
      countryCode: isoCode || undefined,
      state: '',
      stateCode: undefined,
      city: '',
      cityCode: undefined,
      district: '',
      neighbourhood: '',
      postalCode: '',
      phone: country?.phoneCode ? `+${country.phoneCode}` : '',
    });
  };

  const handleStateChange = (stateIsoCode: string) => {
    const state = states.find((s) => s.isoCode === stateIsoCode);
    const isTR = value.countryCode === 'TR';

    update({
      state: state?.name || '',
      stateCode: stateIsoCode || undefined,
      // For Turkey, province IS the city (il = city), and stateIsoCode is the plate code
      city: isTR ? (state?.name || '') : '',
      cityCode: isTR ? stateIsoCode : undefined,
      district: '',
      neighbourhood: '',
    });
  };

  const handleCityChange = (cityName: string) => {
    update({
      city: cityName,
      district: '',
      neighbourhood: '',
    });
  };

  const handleDistrictChange = (districtName: string) => {
    update({
      district: districtName,
      neighbourhood: '',
    });
  };

  const handleNeighbourhoodChange = (neighbourhoodName: string) => {
    update({ neighbourhood: neighbourhoodName });
  };

  return (
    <div className="space-y-3">
      {/* Address Label */}
      {showMetaFields && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t('address.label')}</label>
          <input
            type="text"
            placeholder={t('address.label_placeholder')}
            value={label || ''}
            onChange={(e) => onLabelChange?.(e.target.value)}
            className="input"
          />
        </div>
      )}

      {/* Full Name */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.full_name')}</label>
        <input
          type="text"
          placeholder={t('address.name_placeholder')}
          value={value.name}
          onChange={(e) => update({ name: e.target.value })}
          className="input"
        />
        {value.name.length > 0 && value.name.length < 4 && (
          <p className="text-xs text-red-500 mt-1">{t('address.name_error')}</p>
        )}
      </div>

      {/* Country */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.country')}</label>
        {loadingCountries ? (
          <div className="input bg-slate-50 text-slate-400 flex items-center">{t('address.loading_countries')}</div>
        ) : (
          <select
            value={value.countryCode || ''}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="input"
          >
            <option value="">{t('address.select_country')}</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* State / Province (or Turkish Il) */}
      {value.countryCode && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            {isTurkey ? t('address.province_tr') : t('address.state')}
          </label>
          {loadingStates ? (
            <div className="input bg-slate-50 text-slate-400 flex items-center">{t('address.loading')}</div>
          ) : states.length > 0 ? (
            <select
              value={value.stateCode || ''}
              onChange={(e) => handleStateChange(e.target.value)}
              className="input"
            >
              <option value="">{isTurkey ? t('address.select_province') : t('address.select_state')}</option>
              {states.map((s) => (
                <option key={s.isoCode} value={s.isoCode}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder={t('address.state')}
              value={value.state}
              onChange={(e) => update({ state: e.target.value })}
              className="input"
            />
          )}
        </div>
      )}

      {/* City — non-Turkey only (for Turkey, city = province) */}
      {value.stateCode && !isTurkey && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t('address.city')}</label>
          {loadingCities ? (
            <div className="input bg-slate-50 text-slate-400 flex items-center">{t('address.loading')}</div>
          ) : cities.length > 0 ? (
            <select
              value={value.city}
              onChange={(e) => handleCityChange(e.target.value)}
              className="input"
            >
              <option value="">{t('address.select_city')}</option>
              {cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder={t('address.city')}
              value={value.city}
              onChange={(e) => update({ city: e.target.value })}
              className="input"
            />
          )}
        </div>
      )}

      {/* District (Ilce) — Turkey only */}
      {isTurkey && value.cityCode && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t('address.district')}</label>
          {loadingDistricts ? (
            <div className="input bg-slate-50 text-slate-400 flex items-center">{t('address.loading_districts')}</div>
          ) : (
            <select
              value={value.district || ''}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="input"
            >
              <option value="">{t('address.select_district')}</option>
              {districts.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Neighbourhood (Mahalle) — Turkey only */}
      {isTurkey && value.district && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{t('address.neighbourhood')}</label>
          {loadingNeighbourhoods ? (
            <div className="input bg-slate-50 text-slate-400 flex items-center">{t('address.loading_neighbourhoods')}</div>
          ) : (
            <select
              value={value.neighbourhood || ''}
              onChange={(e) => handleNeighbourhoodChange(e.target.value)}
              className="input"
            >
              <option value="">{t('address.select_neighbourhood')}</option>
              {neighbourhoods.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Street Address */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.street')}</label>
        <input
          type="text"
          placeholder={t('address.street_placeholder')}
          value={value.street}
          onChange={(e) => update({ street: e.target.value })}
          className="input"
        />
      </div>

      {/* Postal Code */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.postal_code')}</label>
        <input
          type="text"
          placeholder={t('address.postal_code')}
          value={value.postalCode}
          onChange={(e) => update({ postalCode: e.target.value })}
          className="input"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.phone')}</label>
        <input
          type="tel"
          placeholder={isTurkey ? t('address.phone_placeholder_tr') : t('address.phone_placeholder')}
          value={value.phone}
          onChange={(e) => update({ phone: e.target.value })}
          className={`input ${value.phone && isTurkey && !isValidTurkishPhone(value.phone) ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
        />
        {value.phone && isTurkey && !isValidTurkishPhone(value.phone) && (
          <p className="text-xs text-red-500 mt-1">{t('address.phone_error')}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('address.email')}</label>
        <input
          type="email"
          placeholder={t('address.email_placeholder')}
          value={value.email || ''}
          onChange={(e) => update({ email: e.target.value })}
          className="input"
        />
      </div>

      {/* Default Address Checkbox */}
      {showMetaFields && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault || false}
            onChange={(e) => onIsDefaultChange?.(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">{t('address.default_checkbox')}</span>
        </label>
      )}
    </div>
  );
}
