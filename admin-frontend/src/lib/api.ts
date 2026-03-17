import type { Trade, TradeEvent, Dispute, Evidence, Listing, ProofPackage, UserSummary, Shipment, FraudFlag, VerificationCenter, CenterVerification } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const API_HOST = API_URL.replace(/\/api$/, '');

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
      if (retry.status === 204) return undefined as T;
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

const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; userId: string }>('/auth/login', { email, password }),
};

export const tradesApi = {
  getById: (id: string) => api.get<Trade & { availableActions: string[] }>(`/trades/${id}`),
  getEvents: (id: string) => api.get<TradeEvent[]>(`/trades/${id}/events`),
  beginVerification: (id: string) => api.post<Trade>(`/trades/${id}/begin-verification`, {}),
  verify: (id: string) => api.post<Trade>(`/trades/${id}/verify`, {}),
};

export const listingsApi = {
  getById: (id: string) => api.get<Listing>(`/listings/${id}`),
};

export const disputesApi = {
  getById: (id: string) => api.get<Dispute>(`/disputes/${id}`),
};

export const shippingApi = {
  getByTrade: (tradeId: string) => api.get<Shipment[]>(`/shipments/trade/${tradeId}`),
};

export const adminApi = {
  getAllTrades: (state?: string, riskLevel?: string) => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (riskLevel) params.set('riskLevel', riskLevel);
    const qs = params.toString();
    return api.get<Trade[]>(`/trades/all${qs ? `?${qs}` : ''}`);
  },
  getProofPackages: (tradeId: string) =>
    api.get<ProofPackage[]>(`/trades/${tradeId}/proof-packages`),
  rejectVerification: (tradeId: string, reason: string) =>
    api.post<Trade>(`/trades/${tradeId}/reject-verification`, { reason }),
  getOpenDisputes: () =>
    api.get<Dispute[]>('/disputes/open'),
  resolveDispute: (
    disputeId: string,
    data: {
      resolution: string;
      outcome: 'completed' | 'revoked';
      outcomeType: string;
      compensationAction: string;
      compensationAmount?: number;
    },
  ) => api.post<Dispute>(`/disputes/${disputeId}/resolve`, data),
  getUsers: () => api.get<UserSummary[]>('/auth/users'),
  deleteUser: (userId: string) => api.delete<void>(`/auth/users/${userId}`),
  getFraudFlags: () => api.get<FraudFlag[]>('/fraud-flags'),
  getFraudFlagsByUser: (userId: string) => api.get<FraudFlag[]>(`/fraud-flags/user/${userId}`),
  reviewFraudFlag: (flagId: string, notes: string) =>
    api.post<FraudFlag>(`/fraud-flags/${flagId}/review`, { notes }),
};

export const centersApi = {
  list: () => api.get<VerificationCenter[]>('/centers'),
  listAll: () => api.get<VerificationCenter[]>('/centers/all'),
  getById: (id: string) => api.get<VerificationCenter>(`/centers/${id}`),
  create: (data: Partial<VerificationCenter>) => api.post<VerificationCenter>('/centers', data),
  update: (id: string, data: Partial<VerificationCenter>) => api.patch<VerificationCenter>(`/centers/${id}`, data),
};

export const centerVerificationsApi = {
  getPending: () => api.get<CenterVerification[]>('/centers/verifications/pending'),
  getByTrade: (tradeId: string) => api.get<CenterVerification[]>(`/centers/verifications/by-trade/${tradeId}`),
  getById: (id: string) => api.get<CenterVerification>(`/centers/verifications/${id}`),
  markReceived: (id: string) => api.post<CenterVerification>(`/centers/verifications/${id}/receive`, {}),
  approve: (id: string, notes?: string, photoUrls?: string[]) =>
    api.post<CenterVerification>(`/centers/verifications/${id}/approve`, { notes, photoUrls }),
  reject: (id: string, reason: string, photoUrls?: string[]) =>
    api.post<CenterVerification>(`/centers/verifications/${id}/reject`, { reason, photoUrls }),
  uploadPhotos: async (files: File[]): Promise<string[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_URL}/centers/verifications/upload-photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Upload failed');
    }
    return res.json();
  },
};
