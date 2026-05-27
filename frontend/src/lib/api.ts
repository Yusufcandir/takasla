import type {
  Listing,
  Offer,
  Trade,
  TradeEvent,
  Certificate,
  Dispute,
  Evidence,
  Profile,
  TrustScore,
  Rating,
  UserSummary,
  Shipment,
  ShippingRate,
  ShipmentEvent,
  ShippingAddress,
  SavedAddress,
  Payment,
  Conversation,
  Message,
  VerificationCenter,
  CenterVerification,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const API_HOST = API_URL.replace(/\/api$/, '');

/** Converts a relative /api/... path to a full URL using the API host. */
export function getImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_HOST}${url}`;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('refreshToken');
  const userId = localStorage.getItem('userId');
  if (!refreshToken || !userId) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    // Clear stale tokens — caller decides whether to redirect
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Auto-refresh on 401 then retry once
  if (res.status === 401 && typeof window !== 'undefined') {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => { isRefreshing = false; refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retry = await fetch(`${API_URL}${endpoint}`, {
        method: options.method || 'GET',
        headers: retryHeaders,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (!retry.ok) {
        const error = await retry.json().catch(() => ({ message: retry.statusText }));
        throw new Error(error.message || `Request failed: ${retry.status}`);
      }
      return retry.json();
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// Auth
export const authApi = {
  register: (email: string, password: string, displayName: string, kvkkConsent = true, termsConsent = true) =>
    api.post<{ message: string; userId: string }>('/auth/register', {
      email,
      password,
      displayName,
      kvkkConsent,
      termsConsent,
    }),
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; userId: string }>('/auth/login', {
      email,
      password,
    }),
  verifyEmail: (token: string) =>
    api.get<{ accessToken: string; refreshToken: string; userId: string }>(`/auth/verify-email?token=${token}`),
  resendVerification: (email: string) =>
    api.post<{ message: string }>('/auth/resend-verification', { email }),
  refresh: (userId: string, refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      userId,
      refreshToken,
    }),
  deleteAccount: () => api.delete<void>('/auth/account'),
};

// Listings
export const listingsApi = {
  getAll: (page = 1, limit = 20, filters?: { categoryId?: string; condition?: string; sort?: string }) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.condition) params.set('condition', filters.condition);
    if (filters?.sort) params.set('sort', filters.sort);
    return api.get<{ items: Listing[]; total: number }>(`/listings?${params}`);
  },
  getById: (id: string) => api.get<Listing>(`/listings/${id}`),
  getByUser: (userId: string) => api.get<Listing[]>(`/listings/user/${userId}`),
  create: (data: {
    title: string;
    description: string;
    declaredValue?: number;
    currency?: string;
    categoryId: string;
    condition: string;
    imageUrls?: string[];
    location?: string;
    shippingOption?: string;
    priceFlexibility?: string;
    hasOriginalPackaging?: boolean;
    hasPurchaseReceipt?: boolean;
    hasCertificateOfAuthenticity?: boolean;
    minExchangeValue?: number;
    maxExchangeValue?: number;
    preferredCategories?: string[];
    imageAiScores?: Record<string, number>;
    imageThumbnailUrls?: string[];
  }) => api.post<Listing>('/listings', data),
  uploadImages: async (files: File[]): Promise<{ url: string; originalName: string; size: number; aiScore?: number }[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const formData = new FormData();
    const compressed = await Promise.all(files.map(compressImage));
    compressed.forEach((file) => formData.append('images', file));
    const res = await fetch(`${API_URL}/listings/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  update: (id: string, data: Partial<Listing>) => api.patch<Listing>(`/listings/${id}`, data),
  delete: (id: string) => api.delete<void>(`/listings/${id}`),
  getSpotlight: () => api.get<Listing[]>('/listings/spotlight'),
  boost: (id: string, tier: 'featured' | 'spotlight') =>
    api.post<{ paymentId: string; tier: string; amount: number }>(`/listings/${id}/boost`, { tier }),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get<import('@/types').Category[]>('/categories'),
};

// Profile (public)
export const publicProfileApi = {
  getProfile: (userId: string) => api.get<import('@/types').Profile>(`/profiles/${userId}`),
  getTrustScore: (userId: string) => api.get<import('@/types').TrustScore>(`/profiles/${userId}/trust`),
};

// Q&A
export type QAQuestion = { id: string; listingId: string; askerId: string; question: string; answer?: string; answeredAt?: string; createdAt: string; parentId?: string; replyCount: number; firstReply?: QAQuestion | null };
export const questionsApi = {
  getAll: (listingId: string) => api.get<QAQuestion[]>(`/listings/${listingId}/questions`),
  ask: (listingId: string, question: string) => api.post<{ id: string }>(`/listings/${listingId}/questions`, { question }),
  answer: (listingId: string, questionId: string, answer: string) => api.patch<{ id: string }>(`/listings/${listingId}/questions/${questionId}/answer`, { answer }),
  getThread: (listingId: string, questionId: string) => api.get<QAQuestion[]>(`/listings/${listingId}/questions/${questionId}/thread`),
  reply: (listingId: string, questionId: string, content: string) => api.post<{ id: string }>(`/listings/${listingId}/questions/${questionId}/replies`, { content }),
};

// Favorites
export const favoritesApi = {
  toggle: (listingId: string) => api.post<{ favorited: boolean }>(`/listings/${listingId}/favorite`, {}),
  getCount: (listingId: string) => api.get<{ count: number }>(`/listings/${listingId}/favorites/count`),
  check: (listingId: string, userId: string) => api.get<{ favorited: boolean }>(`/listings/${listingId}/favorites/check?userId=${userId}`),
  getMyFavorites: () => api.get<import('@/types').Listing[]>('/listings/my/favorites'),
};

// Reports
export const reportsApi = {
  create: (listingId: string, reason: string, description?: string) =>
    api.post<{ id: string }>(`/listings/${listingId}/report`, { reason, description }),
  check: (listingId: string) =>
    api.get<{ reported: boolean }>(`/listings/${listingId}/report/check`),
};

// Offers
export const offersApi = {
  create: (data: {
    listingId: string;
    offeredListingId: string;
    listingOwnerId: string;
    message?: string;
  }) => api.post<Offer>('/offers', data),
  accept: (id: string) => api.post<Offer>(`/offers/${id}/accept`, {}),
  reject: (id: string) => api.post<Offer>(`/offers/${id}/reject`, {}),
  cancel: (id: string) => api.post<Offer>(`/offers/${id}/cancel`, {}),
  getMyOffers: () => api.get<{ sent: Offer[]; received: Offer[] }>('/offers/my'),
  getPendingCount: () => api.get<{ count: number }>('/offers/pending-count'),
};

// Trades
export const tradesApi = {
  getMyTrades: () => api.get<Trade[]>('/trades'),
  getById: (id: string) => api.get<Trade & { availableActions: string[] }>(`/trades/${id}`),
  getEvents: (id: string) => api.get<TradeEvent[]>(`/trades/${id}/events`),
  uploadProofFiles: async (files: File[]): Promise<{ url: string; originalName: string; size: number; mimeType: string; hash: string }[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const res = await fetch(`${API_URL}/trades/proof-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  submitProof: (id: string, items: Array<{ type: string; url: string; hash: string }>, metadata?: Record<string, unknown>) =>
    api.post<Trade>(`/trades/${id}/submit-proof`, { items, metadata }),
  confirmReceipt: (id: string) =>
    api.post<Trade>(`/trades/${id}/confirm-receipt`, {}),
  lockItems: (id: string) => api.post<Trade>(`/trades/${id}/lock`, {}),
  beginVerification: (id: string) => api.post<Trade>(`/trades/${id}/begin-verification`, {}),
  verify: (id: string) => api.post<Trade>(`/trades/${id}/verify`, {}),
  openDispute: (id: string, reason: string, description: string) =>
    api.post<Trade>(`/trades/${id}/dispute`, { reason, description }),
  cancel: (id: string) => api.post<Trade>(`/trades/${id}/cancel`, {}),
  setShippingMethod: (id: string, method: 'shipping' | 'local_pickup') =>
    api.post<Trade>(`/trades/${id}/set-shipping-method`, { method }),
  submitAddress: (id: string, address: ShippingAddress) =>
    api.post<Trade>(`/trades/${id}/submit-address`, { address }),
  confirmLocalPickup: (id: string) =>
    api.post<Trade>(`/trades/${id}/confirm-local-pickup`, {}),
  selectCenter: (id: string, centerId: string) =>
    api.post<Trade>(`/trades/${id}/select-center`, { centerId }),
};

// Disputes
export const disputesApi = {
  getByTrade: (tradeId: string) => api.get<Dispute[]>(`/disputes/trade/${tradeId}`),
  getById: (id: string) => api.get<Dispute>(`/disputes/${id}`),
  uploadEvidenceFiles: async (files: File[]): Promise<{ url: string; originalName: string; size: number; hash: string }[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const formData = new FormData();
    for (const file of files) {
      const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
      formData.append('files', compressed);
    }
    const res = await fetch(`${API_URL}/disputes/evidence-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  uploadEvidence: (
    id: string,
    data: { type: string; url?: string; description?: string; fileHash?: string },
  ) => api.post<Evidence>(`/disputes/${id}/evidence`, data),
  appeal: (id: string, reason: string) =>
    api.post<Dispute>(`/disputes/${id}/appeal`, { reason }),
};

// Profile (backend controller prefix is "profiles")
export const profileApi = {
  getMyProfile: () => api.get<Profile>('/profiles/me'),
  updateProfile: (
    data: Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'bio' | 'location'>>,
  ) => api.patch<Profile>('/profiles', data),
  getTrustScore: (userId: string) => api.get<TrustScore>(`/profiles/${userId}/trust`),
  uploadAvatar: async (file: File): Promise<{ url: string; originalName: string; size: number }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('avatar', compressed);
    const res = await fetch(`${API_URL}/profiles/upload-avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};

// Ratings
export const ratingsApi = {
  submit: (tradeId: string, ratedUserId: string, score: number, comment?: string) =>
    api.post<Rating>('/ratings', { tradeId, ratedUserId, score, comment }),
  getByUser: (userId: string) => api.get<Rating[]>(`/ratings/user/${userId}`),
  getByTrade: (tradeId: string) => api.get<Rating[]>(`/ratings/trade/${tradeId}`),
};

// Admin / Moderator
export const adminApi = {
  getAllTrades: (state?: string, riskLevel?: string) => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (riskLevel) params.set('riskLevel', riskLevel);
    const qs = params.toString();
    return api.get<Trade[]>(`/trades/all${qs ? `?${qs}` : ''}`);
  },
  getProofPackages: (tradeId: string) =>
    api.get<import('@/types').ProofPackage[]>(`/trades/${tradeId}/proof-packages`),
  rejectVerification: (tradeId: string, reason: string) =>
    api.post<Trade>(`/trades/${tradeId}/reject-verification`, { reason }),
  getOpenDisputes: () =>
    api.get<Dispute[]>('/disputes/open'),
  resolveDispute: (disputeId: string, resolution: string, outcome: 'completed' | 'revoked') =>
    api.post<Dispute>(`/disputes/${disputeId}/resolve`, { resolution, outcome }),
  getUsers: () => api.get<UserSummary[]>('/auth/users'),
  deleteUser: (userId: string) => api.delete<void>(`/auth/users/${userId}`),
};

// Addresses
export const addressApi = {
  getAll: () => api.get<SavedAddress[]>('/addresses'),
  create: (data: Omit<SavedAddress, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    api.post<SavedAddress>('/addresses', data),
  update: (id: string, data: Partial<SavedAddress>) =>
    api.patch<SavedAddress>(`/addresses/${id}`, data),
  remove: (id: string) => api.delete<void>(`/addresses/${id}`),
  setDefault: (id: string) => api.patch<SavedAddress>(`/addresses/${id}/default`, {}),
};

// Payments
export const paymentsApi = {
  getByTrade: (tradeId: string) => api.get<Payment[]>(`/payments/trade/${tradeId}`),
  getMyPayments: () => api.get<Payment[]>('/payments/my'),
  createCheckout: (paymentId: string) =>
    api.post<{ checkoutUrl: string } | { simulated: boolean }>(`/payments/${paymentId}/checkout`, {}),
  simulatePayment: (paymentId: string) =>
    api.post<{ success: boolean }>(`/payments/${paymentId}/simulate-payment`, {}),
  createInsurance: (tradeId: string, riskLevel: string) =>
    api.post<Payment>('/payments/insurance', { tradeId, riskLevel }),
  cancelInsurance: (paymentId: string) =>
    api.post<{ success: boolean }>(`/payments/${paymentId}/cancel-insurance`, {}),
};

// Shipping
export const shippingApi = {
  getByTrade: (tradeId: string) => api.get<Shipment[]>(`/shipments/trade/${tradeId}`),
  getRates: (shipmentId: string) => api.get<ShippingRate[]>(`/shipments/${shipmentId}/rates`),
  buyLabel: (shipmentId: string, rateId: string) =>
    api.post<Shipment>(`/shipments/${shipmentId}/buy-label`, { rateId }),
  getTracking: (shipmentId: string) => api.get<ShipmentEvent[]>(`/shipments/${shipmentId}/tracking`),
  createShipment: (data: {
    tradeId: string;
    recipientId: string;
    listingId?: string;
    senderAddress: ShippingAddress;
    recipientAddress: ShippingAddress;
  }) => api.post<Shipment>('/shipments', data),
  simulateProgress: (shipmentId: string) =>
    api.post<Shipment>(`/shipments/${shipmentId}/simulate-progress`, {}),
};

// Messaging
export const messagingApi = {
  createConversation: (participantId: string) =>
    api.post<Conversation>('/conversations', { participantId }),
  getConversations: () =>
    api.get<Conversation[]>('/conversations'),
  getUnreadCount: () =>
    api.get<{ count: number }>('/conversations/unread-count'),
  getMessages: (conversationId: string, page = 1, limit = 50) =>
    api.get<{ messages: Message[]; total: number }>(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (conversationId: string, content: string) =>
    api.post<Message>(`/conversations/${conversationId}/messages`, { content }),
  markAsRead: (conversationId: string) =>
    api.patch<{ success: boolean }>(`/conversations/${conversationId}/read`, {}),
};

// Verification Centers
export const centersApi = {
  list: () => api.get<VerificationCenter[]>('/centers'),
  getById: (id: string) => api.get<VerificationCenter>(`/centers/${id}`),
  getVerificationsByTrade: (tradeId: string) =>
    api.get<CenterVerification[]>(`/centers/verifications/by-trade/${tradeId}`),
};

// Certificates
export const certificatesApi = {
  getMyCertificates: () => api.get<Certificate[]>('/certificates'),
  getById: (id: string) => api.get<Certificate>(`/certificates/${id}`),
  getByTradeId: (tradeId: string) => api.get<Certificate[]>(`/certificates/trade/${tradeId}`),
  getMerkleProof: (id: string) =>
    api.get<{ proof: string[]; root: string; index: number }>(`/certificates/${id}/proof`),
  transfer: (id: string, toUserId: string) =>
    api.post<Certificate>(`/certificates/${id}/transfer`, { toUserId }),
};

// Compress images client-side before upload (max 1200px, JPEG 80%)
function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 200_000) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg',
        0.80,
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
