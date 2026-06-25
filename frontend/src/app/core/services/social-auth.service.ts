// src/app/core/services/social-auth.service.ts
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { environment } from '../../../environments/environment';

/** A Google credential the backend (`/auth/google`) can verify. */
export interface GoogleCredential {
  /** Google ID token — native (Android/iOS) sign-in. */
  idToken?: string;
  /** OAuth access token — web sign-in via Google Identity Services. */
  accessToken?: string;
}

/**
 * Google sign-in across platforms.
 *
 *  - Native (Android/iOS): the Capacitor Google Auth plugin returns an ID token.
 *  - Web: Google Identity Services (GIS) opens a first-party popup and returns
 *    an OAuth access token. We use GIS — not the legacy `gapi.auth2` iframe —
 *    because that iframe needs third-party cookies, which modern browsers block
 *    (the cause of the old `idpiframe_initialization_failed` / checkOrigin 500).
 *
 * The backend verifies whichever token it receives before issuing our session.
 *
 * Config needed before this works:
 *  - environment.googleClientId — OAuth *Web* client ID, with the app's origin
 *    (e.g. http://localhost:8100) listed under "Authorized JavaScript origins".
 *  - capacitor.config GoogleAuth.serverClientId — same Web client ID (Android).
 */
@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private gisScript?: Promise<void>;
  private tokenClient?: any;

  /** True once a client ID is available for the current platform. */
  get isConfigured(): boolean {
    return Capacitor.isNativePlatform() || !!environment.googleClientId;
  }

  async signInWithGoogle(): Promise<GoogleCredential> {
    if (!this.isConfigured) {
      throw new Error('Google sign-in is not configured');
    }
    return Capacitor.isNativePlatform() ? this.signInNative() : this.signInWeb();
  }

  // ── Native: Capacitor plugin → Google ID token ────────────────────────────
  private async signInNative(): Promise<GoogleCredential> {
    const user = await GoogleAuth.signIn();
    const idToken = user?.authentication?.idToken;
    if (!idToken) throw new Error('No Google ID token returned');
    return { idToken };
  }

  // ── Web: GIS popup → OAuth access token ───────────────────────────────────
  // initTokenClient opens a real popup window to accounts.google.com, where the
  // user is first-party — so it works without third-party cookies.
  private async signInWeb(): Promise<GoogleCredential> {
    await this.loadGis();
    const google = (window as any).google;

    if (!this.tokenClient) {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: 'openid email profile',
        callback: () => {}, // replaced per-request below
      });
    }

    return new Promise<GoogleCredential>((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp?.error || !resp?.access_token) {
          reject(new Error(resp?.error || 'Google sign-in failed'));
          return;
        }
        resolve({ accessToken: resp.access_token });
      };
      // Fired when the popup is closed/blocked before completing.
      this.tokenClient.error_callback = (err: any) =>
        reject(new Error(err?.type || 'Google sign-in was cancelled'));
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  /** Lazily inject the Google Identity Services script (web only). */
  private loadGis(): Promise<void> {
    if (this.gisScript) return this.gisScript;
    this.gisScript = new Promise<void>((resolve, reject) => {
      if ((window as any).google?.accounts?.oauth2) return resolve();

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
    return this.gisScript;
  }
}
