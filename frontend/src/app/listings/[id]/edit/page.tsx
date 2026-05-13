'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { listingsApi, api, getImageUrl } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Listing } from '@/types';

interface Category {
  id: string;
  name: string;
  slug: string;
  riskWeight: number;
  baseFee?: number;
  feeCurrency?: string;
}

interface CountryItem { name: string; code: string; }
interface NominatimResult { display_name: string; place_id: string; name: string; address?: Record<string, string>; }

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
];

// Represents either an existing image (has a URL) or a newly added file
interface ImageSlot {
  type: 'existing' | 'new';
  url?: string; // for existing images
  file?: File;  // for new uploads
  preview: string;
}

export default function EditListingPage() {
  const params = useParams();
  const listingId = params.id as string;
  const { t, locale } = useTranslation();
  const currentUserId = getUserId();

  const [listing, setListing] = useState<Listing | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>('good');

  // Location cascading state
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
  const [showCountryList, setShowCountryList] = useState(false);

  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<NominatimResult[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [showCityList, setShowCityList] = useState(false);

  const [neighbourhoodSearch, setNeighbourhoodSearch] = useState('');
  const [neighbourhoodSuggestions, setNeighbourhoodSuggestions] = useState<NominatimResult[]>([]);
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState('');
  const [showNeighbourhoodList, setShowNeighbourhoodList] = useState(false);

  const [shippingOption, setShippingOption] = useState<'local_pickup' | 'shipping' | 'both'>('both');
  const [priceFlexibility, setPriceFlexibility] = useState<'fixed' | 'negotiable' | 'offers_only'>('negotiable');
  const [hasOriginalPackaging, setHasOriginalPackaging] = useState(false);
  const [hasPurchaseReceipt, setHasPurchaseReceipt] = useState(false);
  const [hasCertificateOfAuthenticity, setHasCertificateOfAuthenticity] = useState(false);
  const [minExchangeValue, setMinExchangeValue] = useState('');
  const [maxExchangeValue, setMaxExchangeValue] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Image state — mixed existing + new
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load listing + categories + countries on mount
  useEffect(() => {
    if (!listingId) return;

    const loadData = async () => {
      try {
        const [l, cats] = await Promise.all([
          listingsApi.getById(listingId),
          api.get<Category[]>('/categories'),
        ]);
        setListing(l);
        setCategories(cats);

        // Check ownership
        if (l.userId !== currentUserId) {
          window.location.replace(`/listings/${listingId}`);
          return;
        }

        // Check status
        if (l.status !== 'active') {
          window.location.replace(`/listings/${listingId}`);
          return;
        }

        // Populate form fields
        setTitle(l.title);
        setDescription(l.description || '');
        setCurrency(l.currency || 'TRY');
        setCategoryId(l.categoryId || '');
        setCondition((l.condition as any) || 'good');
        setShippingOption(l.shippingOption || 'both');
        setPriceFlexibility(l.priceFlexibility || 'negotiable');
        setHasOriginalPackaging(l.hasOriginalPackaging || false);
        setHasPurchaseReceipt(l.hasPurchaseReceipt || false);
        setHasCertificateOfAuthenticity(l.hasCertificateOfAuthenticity || false);
        setMinExchangeValue(l.minExchangeValue ? String(l.minExchangeValue) : '');
        setMaxExchangeValue(l.maxExchangeValue ? String(l.maxExchangeValue) : '');

        // Populate existing images
        if (l.images && l.images.length > 0) {
          const sorted = [...l.images].sort((a, b) => a.sortOrder - b.sortOrder);
          setImageSlots(sorted.map((img) => ({
            type: 'existing' as const,
            url: img.url,
            preview: getImageUrl(img.url),
          })));
        }

        // Parse location: "Neighbourhood, City, Country" format
        if (l.location) {
          const parts = l.location.split(',').map((s) => s.trim());
          if (parts.length >= 2) {
            const countryName = parts[parts.length - 1];
            const cityName = parts[parts.length - 2];
            const nbName = parts.length >= 3 ? parts[parts.length - 3] : '';

            // We'll set the country/city/neighbourhood as text values
            // The country picker needs to match by name
            setSelectedCity(cityName);
            if (nbName) setSelectedNeighbourhood(nbName);

            // Fetch countries and try to match
            fetch(`/api/geo/countries?locale=${locale}`)
              .then((r) => r.json())
              .then((data: { name: string; isoCode: string }[]) => {
                const sorted = data.map((c) => ({ name: c.name, code: c.isoCode })).sort((a, b) => a.name.localeCompare(b.name, locale));
                setCountries(sorted);
                const match = sorted.find((c) => c.name.toLowerCase() === countryName.toLowerCase());
                if (match) setSelectedCountry(match);
                else {
                  // Fuzzy match — try includes
                  const fuzzy = sorted.find((c) => c.name.toLowerCase().includes(countryName.toLowerCase()) || countryName.toLowerCase().includes(c.name.toLowerCase()));
                  if (fuzzy) setSelectedCountry(fuzzy);
                }
              })
              .catch(() => {});
          } else {
            // Single part location — just set as city
            setSelectedCity(parts[0]);
            fetch(`/api/geo/countries?locale=${locale}`)
              .then((r) => r.json())
              .then((data: { name: string; isoCode: string }[]) => {
                const sorted = data.map((c) => ({ name: c.name, code: c.isoCode })).sort((a, b) => a.name.localeCompare(b.name, locale));
                setCountries(sorted);
              })
              .catch(() => {});
          }
        } else {
          // No location — just load countries
          fetch(`/api/geo/countries?locale=${locale}`)
            .then((r) => r.json())
            .then((data: { name: string; isoCode: string }[]) => {
              const sorted = data.map((c) => ({ name: c.name, code: c.isoCode })).sort((a, b) => a.name.localeCompare(b.name, locale));
              setCountries(sorted);
            })
            .catch(() => {});
        }
      } catch {
        setError(t('edit_listing.load_error'));
      }
      setPageLoading(false);
    };

    loadData();
  }, [listingId, currentUserId, locale, t]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const estimatedRisk =
    selectedCategory
      ? selectedCategory.riskWeight > 0.5
        ? 'HIGH'
        : selectedCategory.riskWeight > 0.3
          ? 'MEDIUM'
          : 'LOW'
      : null;

  // Cascading location: Country -> City -> Neighbourhood
  const filteredCountries = countrySearch
    ? countries.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : countries;

  const handleSelectCountry = (c: CountryItem) => {
    setSelectedCountry(c);
    setCountrySearch('');
    setShowCountryList(false);
    setSelectedCity('');
    setCitySearch('');
    setCitySuggestions([]);
    setSelectedNeighbourhood('');
    setNeighbourhoodSearch('');
    setNeighbourhoodSuggestions([]);
  };

  const handleCitySearch = (query: string) => {
    setCitySearch(query);
    setShowCityList(true);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (query.length < 2) { setCitySuggestions([]); return; }
    cityDebounceRef.current = setTimeout(() => {
      const cc = selectedCountry?.code.toLowerCase() || '';
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=${cc}&format=json&limit=8&featuretype=city&addressdetails=1&accept-language=${locale}`)
        .then((r) => r.json())
        .then((data: NominatimResult[]) => setCitySuggestions(data))
        .catch(() => setCitySuggestions([]));
    }, 300);
  };

  const handleSelectCity = (r: NominatimResult) => {
    const cityName = r.address?.city || r.address?.town || r.address?.village || r.name || r.display_name.split(',')[0];
    setSelectedCity(cityName);
    setCitySearch('');
    setShowCityList(false);
    setCitySuggestions([]);
    setSelectedNeighbourhood('');
    setNeighbourhoodSearch('');
    setNeighbourhoodSuggestions([]);
  };

  const handleNeighbourhoodSearch = (query: string) => {
    setNeighbourhoodSearch(query);
    setShowNeighbourhoodList(true);
    if (nbDebounceRef.current) clearTimeout(nbDebounceRef.current);
    if (query.length < 2) { setNeighbourhoodSuggestions([]); return; }
    nbDebounceRef.current = setTimeout(() => {
      const cc = selectedCountry?.code.toLowerCase() || '';
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', ' + selectedCity)}&countrycodes=${cc}&format=json&limit=8&addressdetails=1&accept-language=${locale}`)
        .then((r) => r.json())
        .then((data: NominatimResult[]) => setNeighbourhoodSuggestions(data))
        .catch(() => setNeighbourhoodSuggestions([]));
    }, 300);
  };

  const handleSelectNeighbourhood = (r: NominatimResult) => {
    const nb = r.address?.neighbourhood || r.address?.suburb || r.address?.quarter || r.name || r.display_name.split(',')[0];
    setSelectedNeighbourhood(nb);
    setNeighbourhoodSearch('');
    setShowNeighbourhoodList(false);
    setNeighbourhoodSuggestions([]);
  };

  // Image management
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSlots((prev) => [...prev, {
          type: 'new',
          file,
          preview: ev.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag-to-reorder
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const newSlots = [...imageSlots];
    const [moved] = newSlots.splice(dragIndex, 1);
    newSlots.splice(dropIndex, 0, moved);
    setImageSlots(newSlots);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedCountry) {
      setError(t('create_listing.error_country'));
      return;
    }
    if (!selectedCity) {
      setError(t('create_listing.error_city'));
      return;
    }
    setLoading(true);
    try {
      // Upload new image files
      const newFiles = imageSlots.filter((s) => s.type === 'new' && s.file).map((s) => s.file!);
      let uploadedUrls: { url: string; aiScore?: number; thumbnailUrl?: string }[] = [];
      if (newFiles.length > 0) {
        setUploading(true);
        const uploaded = await listingsApi.uploadImages(newFiles);
        uploadedUrls = uploaded.map((u) => ({
          url: u.url,
          aiScore: u.aiScore,
          thumbnailUrl: (u as any).thumbnailUrl,
        }));
        setUploading(false);
      }

      // Build final image arrays in slot order
      const finalImageUrls: string[] = [];
      const finalThumbnailUrls: string[] = [];
      const finalAiScores: Record<string, number> = {};
      let newFileIndex = 0;

      for (const slot of imageSlots) {
        if (slot.type === 'existing' && slot.url) {
          finalImageUrls.push(slot.url);
          finalThumbnailUrls.push(''); // existing thumbnails are already stored
        } else if (slot.type === 'new') {
          const uploaded = uploadedUrls[newFileIndex++];
          if (uploaded) {
            finalImageUrls.push(uploaded.url);
            finalThumbnailUrls.push(uploaded.thumbnailUrl || '');
            if (uploaded.aiScore != null) finalAiScores[uploaded.url] = uploaded.aiScore;
          }
        }
      }

      const updateData: Record<string, any> = {
        title,
        description,
        currency,
        categoryId,
        condition,
        imageUrls: finalImageUrls,
        imageThumbnailUrls: finalThumbnailUrls.some(Boolean) ? finalThumbnailUrls : undefined,
        imageAiScores: Object.keys(finalAiScores).length > 0 ? finalAiScores : undefined,
        location: [selectedNeighbourhood, selectedCity, selectedCountry?.name].filter(Boolean).join(', ') || undefined,
        shippingOption,
        priceFlexibility,
        hasOriginalPackaging,
        hasPurchaseReceipt,
        hasCertificateOfAuthenticity,
        minExchangeValue: minExchangeValue ? parseFloat(minExchangeValue) : undefined,
        maxExchangeValue: maxExchangeValue ? parseFloat(maxExchangeValue) : undefined,
      };

      await listingsApi.update(listingId, updateData);
      window.location.href = `/listings/${listingId}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('edit_listing.update_error'));
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  if (pageLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-6 space-y-6">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('listing_detail.not_found')}</h2>
        <Link href="/listings" className="btn-primary">{t('listing_detail.not_found_cta')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <Link href={`/listings/${listingId}`} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('edit_listing.back')}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{t('edit_listing.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('edit_listing.subtitle')}</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Photos */}
          <div>
            <label className="label">{t('create_listing.photos')}</label>
            {imageSlots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                {imageSlots.map((slot, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`relative group aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                      dragOverIndex === i ? 'border-navy-900 scale-105' : 'border-slate-200'
                    } ${dragIndex === i ? 'opacity-50' : 'opacity-100'}`}
                  >
                    <img src={slot.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 bg-navy-900/80 text-white text-xs px-1.5 py-0.5 rounded">{t('create_listing.cover')}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/50 text-white text-xs px-1 py-0.5 rounded">{t('create_listing.drag_reorder')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {imageSlots.length > 0 ? t('create_listing.add_more') : t('create_listing.add_photos')}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            <p className="text-xs text-slate-400 mt-2">{t('create_listing.photos_hint')}</p>
          </div>

          {/* Title */}
          <div>
            <label className="label">{t('create_listing.title_label')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder={t('create_listing.title_placeholder')} required />
          </div>

          {/* Description */}
          <div>
            <label className="label">{t('create_listing.description_label')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[100px] resize-y" placeholder={t('create_listing.description_placeholder')} rows={4} />
          </div>

          {/* Category */}
          <div>
            <label className="label">{t('create_listing.category')}</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input" required>
              <option value="">{t('create_listing.select_category')}</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{t(`category.${cat.name}`)}</option>)}
            </select>
            {selectedCategory && selectedCategory.baseFee != null && (
              <p className="text-xs text-slate-500 mt-1.5">
                {t('create_listing.platform_fee_info', { fee: Number(selectedCategory.baseFee).toFixed(0), currency: selectedCategory.feeCurrency || 'TRY' })}
              </p>
            )}
          </div>

          {/* Condition */}
          <div>
            <label className="label">{t('create_listing.condition')}</label>
            <div className="grid grid-cols-5 gap-2">
              {(['new', 'like_new', 'good', 'fair', 'poor'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all ${condition === c ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {t('condition.' + c)}
                </button>
              ))}
            </div>
          </div>

          {/* Location — Cascading: Country -> City -> Neighbourhood */}
          <div>
            <label className="label">{t('create_listing.location')} <span className="text-red-500">*</span></label>
            <div className="space-y-3">
              {/* Step 1: Country */}
              <div className="relative">
                <label className="text-xs text-slate-500 mb-1 block">{t('create_listing.country')}</label>
                {selectedCountry ? (
                  <div className="flex items-center gap-2">
                    <div className="input flex-1 flex items-center justify-between bg-slate-50">
                      <span className="text-sm text-slate-900">{selectedCountry.name}</span>
                    </div>
                    <button type="button" onClick={() => { setSelectedCountry(null); setSelectedCity(''); setSelectedNeighbourhood(''); }}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 px-2 py-2">{t('create_listing.change')}</button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input type="text" value={countrySearch} onChange={(e) => { setCountrySearch(e.target.value); setShowCountryList(true); }}
                        onFocus={() => setShowCountryList(true)} onBlur={() => setTimeout(() => setShowCountryList(false), 150)}
                        className="input pl-10" placeholder={t('create_listing.search_country')} autoComplete="off" />
                    </div>
                    {showCountryList && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-elevated max-h-52 overflow-y-auto">
                        {filteredCountries.slice(0, 50).map((c) => (
                          <button key={c.code} type="button" onMouseDown={() => handleSelectCountry(c)}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                            {c.name}
                          </button>
                        ))}
                        {filteredCountries.length === 0 && <div className="px-4 py-3 text-sm text-slate-400">{t('create_listing.no_countries')}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 2: City */}
              {selectedCountry && (
                <div className="relative">
                  <label className="text-xs text-slate-500 mb-1 block">{t('create_listing.city')}</label>
                  {selectedCity ? (
                    <div className="flex items-center gap-2">
                      <div className="input flex-1 flex items-center bg-slate-50">
                        <span className="text-sm text-slate-900">{selectedCity}</span>
                      </div>
                      <button type="button" onClick={() => { setSelectedCity(''); setSelectedNeighbourhood(''); }}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0 px-2 py-2">{t('create_listing.change')}</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" value={citySearch} onChange={(e) => handleCitySearch(e.target.value)}
                          onFocus={() => setShowCityList(true)} onBlur={() => setTimeout(() => setShowCityList(false), 150)}
                          className="input pl-10" placeholder={t('create_listing.search_city', { country: selectedCountry.name })} autoComplete="off" />
                      </div>
                      {showCityList && citySuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-elevated max-h-52 overflow-y-auto">
                          {citySuggestions.map((s) => (
                            <button key={s.place_id} type="button" onMouseDown={() => handleSelectCity(s)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 truncate">
                              {s.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Neighbourhood */}
              {selectedCountry && selectedCity && (
                <div className="relative">
                  <label className="text-xs text-slate-500 mb-1 block">{t('create_listing.neighbourhood')} <span className="text-slate-400">{t('create_listing.neighbourhood_optional')}</span></label>
                  {selectedNeighbourhood ? (
                    <div className="flex items-center gap-2">
                      <div className="input flex-1 flex items-center bg-slate-50">
                        <span className="text-sm text-slate-900">{selectedNeighbourhood}</span>
                      </div>
                      <button type="button" onClick={() => setSelectedNeighbourhood('')}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0 px-2 py-2">{t('create_listing.change')}</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" value={neighbourhoodSearch} onChange={(e) => handleNeighbourhoodSearch(e.target.value)}
                          onFocus={() => setShowNeighbourhoodList(true)} onBlur={() => setTimeout(() => setShowNeighbourhoodList(false), 150)}
                          className="input pl-10" placeholder={t('create_listing.search_neighbourhood', { city: selectedCity })} autoComplete="off" />
                      </div>
                      {showNeighbourhoodList && neighbourhoodSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-elevated max-h-52 overflow-y-auto">
                          {neighbourhoodSuggestions.map((s) => (
                            <button key={s.place_id} type="button" onMouseDown={() => handleSelectNeighbourhood(s)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 truncate">
                              {s.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Location Summary */}
              {selectedCountry && selectedCity && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {[selectedNeighbourhood, selectedCity, selectedCountry.name].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Shipping Option */}
          <div>
            <label className="label">{t('create_listing.delivery')}</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'local_pickup', label: t('create_listing.local_pickup'), icon: '📍' },
                { value: 'shipping', label: t('create_listing.shipping'), icon: '📦' },
                { value: 'both', label: t('create_listing.both'), icon: '✓' },
              ] as const).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setShippingOption(opt.value)}
                  className={`py-2.5 px-3 text-sm font-medium rounded-lg border transition-all flex flex-col items-center gap-1 ${shippingOption === opt.value ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  <span>{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Flexibility */}
          <div>
            <label className="label">{t('create_listing.price_flex')}</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'fixed', label: t('create_listing.fixed'), desc: t('create_listing.fixed_desc') },
                { value: 'negotiable', label: t('create_listing.negotiable'), desc: t('create_listing.negotiable_desc') },
                { value: 'offers_only', label: t('create_listing.offers_only'), desc: t('create_listing.offers_only_desc') },
              ] as const).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPriceFlexibility(opt.value)}
                  className={`py-2.5 px-3 text-sm rounded-lg border transition-all text-left ${priceFlexibility === opt.value ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  <div className="font-medium text-xs">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${priceFlexibility === opt.value ? 'text-white/70' : 'text-slate-400'}`}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Authenticity */}
          <div>
            <label className="label">{t('create_listing.authenticity')}</label>
            <div className="space-y-2">
              {[
                { key: 'hasOriginalPackaging', label: t('create_listing.original_packaging'), value: hasOriginalPackaging, set: setHasOriginalPackaging },
                { key: 'hasPurchaseReceipt', label: t('create_listing.purchase_receipt'), value: hasPurchaseReceipt, set: setHasPurchaseReceipt },
                { key: 'hasCertificateOfAuthenticity', label: t('create_listing.certificate_auth'), value: hasCertificateOfAuthenticity, set: setHasCertificateOfAuthenticity },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <div onClick={() => item.set(!item.value)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${item.value ? 'bg-navy-900 border-navy-900' : 'border-slate-300 group-hover:border-slate-400'}`}>
                    {item.value && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Risk Estimate */}
          {estimatedRisk && (
            <div className={`rounded-lg px-4 py-3 text-sm border ${
              estimatedRisk === 'LOW' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : estimatedRisk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-red-50 text-red-700 border-red-200'}`}>
              <span className="font-medium">{t('create_listing.risk_level', { level: estimatedRisk })}</span>
              <span className="block text-xs mt-0.5 opacity-75">
                {estimatedRisk === 'LOW' ? t('create_listing.risk_low')
                : estimatedRisk === 'MEDIUM' ? t('create_listing.risk_medium')
                : t('create_listing.risk_high')}
              </span>
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {uploading ? t('create_listing.uploading') : loading ? t('edit_listing.saving') : t('edit_listing.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
