// src/app/core/services/token.service.ts
import { Injectable } from '@angular/core';

const ACCESS_KEY  = 'rm_access_token';
const REFRESH_KEY = 'rm_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  getAccessToken():  string | null { return localStorage.getItem(ACCESS_KEY); }
  getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY); }

  setTokens(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY,  access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch { return false; }
  }

  /**
   * A session is alive as long as the (long-lived) refresh token is valid —
   * the auth interceptor transparently mints a fresh access token from it.
   * The short-lived access token expiring (every 15m) must NOT log the user out.
   */
  hasValidSession(): boolean {
    const access = this.getAccessToken();
    if (access && this.isTokenValid(access)) return true;

    const refresh = this.getRefreshToken();
    return !!refresh && this.isTokenValid(refresh);
  }
}
