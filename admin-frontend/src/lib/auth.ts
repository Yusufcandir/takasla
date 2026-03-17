export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
}

export function setTokens(accessToken: string, refreshToken: string, userId: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('userId', userId);
}

export function clearTokens(): void {
  localStorage.clear();
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function getRole(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function isModeratorOrAdmin(): boolean {
  const role = getRole();
  return role === 'moderator' || role === 'admin';
}
