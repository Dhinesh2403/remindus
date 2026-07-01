// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { SocketService } from './socket.service';
import { GoogleCredential } from './social-auth.service';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  refId?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  isPremium: boolean;
  streak: number;
  completionRate: number;
  role: 'user' | 'admin';
  createdAt: string;
  notifPrefs?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  notifTypes?: {
    reminders: boolean;
    chat: boolean;
    friendRequests: boolean;
    other: boolean;
  };
}

export interface NotifPrefsUpdate {
  notifPrefs?: Partial<{ email: boolean; push: boolean; sms: boolean; whatsapp: boolean }>;
  notifTypes?: Partial<{ reminders: boolean; chat: boolean; friendRequests: boolean; other: boolean }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private tokenService = inject(TokenService);
  private socketService = inject(SocketService);

  private readonly API = `${environment.apiUrl}/auth`;

  // ─── Angular Signals for reactive state ──────────────────────────────────
  private _currentUser = signal<User | null>(null);
  private _isLoading = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly isPremium = computed(() => this._currentUser()?.isPremium ?? false);

  // ─── Login ────────────────────────────────────────────────────────────────
  login(payload: LoginPayload): Observable<{ user: User; tokens: AuthTokens }> {
    this._isLoading.set(true);
    return this.http
      .post<{ user: User; tokens: AuthTokens }>(`${this.API}/login`, payload)
      .pipe(
        tap(({ user, tokens }) => {
          this.setSession(user, tokens);
          this._isLoading.set(false);
        }),
        catchError((err) => {
          this._isLoading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  // Accepts either an ID token (native) or an access token (web/GIS); the
  // backend verifies whichever is present. First-time Google users are sent to
  // a one-time set-password screen; returning users go straight to the app.
  googleLogin(
    cred: GoogleCredential
  ): Observable<{ user: User; tokens: AuthTokens; needsPassword?: boolean }> {
    this._isLoading.set(true);
    return this.http
      .post<{ user: User; tokens: AuthTokens; needsPassword?: boolean }>(
        `${this.API}/google`,
        cred
      )
      .pipe(
        tap(({ user, tokens, needsPassword }) => {
          this.applySession(user, tokens);
          this._isLoading.set(false);
          this.router.navigate([needsPassword ? '/set-password' : '/app/home']);
        }),
        catchError((err) => {
          this._isLoading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ─── First-time password setup (Google accounts) ──────────────────────────
  // Lets a Google user add a password so they can also sign in with email.
  setInitialPassword(password: string, name?: string): Observable<{ user: User }> {
    this._isLoading.set(true);
    return this.http
      .post<{ user: User }>(`${this.API}/set-password`, { password, name })
      .pipe(
        tap(({ user }) => {
          this._currentUser.set(user);
          this._isLoading.set(false);
          this.router.navigate(['/app/home']);
        }),
        catchError((err) => {
          this._isLoading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ─── Email signup (OTP-first): start → verify → set-password ──────────────
  signupStart(name: string, email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/signup/start`, {
      name,
      email,
    });
  }

  signupResend(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/signup/resend`, {
      email,
    });
  }

  signupVerify(email: string, otp: string): Observable<{ setupToken: string }> {
    return this.http.post<{ setupToken: string }>(`${this.API}/signup/verify`, {
      email,
      otp,
    });
  }

  signupSetPassword(
    setupToken: string,
    password: string
  ): Observable<{ user: User; tokens: AuthTokens }> {
    this._isLoading.set(true);
    return this.http
      .post<{ user: User; tokens: AuthTokens }>(
        `${this.API}/signup/set-password`,
        { setupToken, password }
      )
      .pipe(
        tap(({ user, tokens }) => {
          this.setSession(user, tokens);
          this._isLoading.set(false);
        }),
        catchError((err) => {
          this._isLoading.set(false);
          return throwError(() => err);
        })
      );
  }

  // ─── Refresh access token ─────────────────────────────────────────────────
  refreshAccessToken(
    refreshToken: string
  ): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.API}/refresh`, { refreshToken });
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  verifyOtp(email: string, otp: string): Observable<{ verified: boolean }> {
    return this.http.post<{ verified: boolean }>(`${this.API}/verify-otp`, {
      email,
      otp,
    });
  }

  // ─── Forgot / Reset password ──────────────────────────────────────────────
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.API}/forgot-password`,
      { email }
    );
  }

  resetPassword(
    token: string,
    password: string
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/reset-password`, {
      token,
      password,
    });
  }

  // ─── Get current user profile ─────────────────────────────────────────────
  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.API}/me`).pipe(
      tap((user) => this._currentUser.set(user))
    );
  }

  // ─── Upload / change profile photo ────────────────────────────────────────
  // Sends a base64 data-URI to the backend (which stores it on Cloudinary) and
  // patches the cached user with the returned URL.
  uploadAvatar(image: string): Observable<{ avatar: string; user: User }> {
    return this.http
      .post<{ avatar: string; user: User }>(
        `${environment.apiUrl}/users/me/avatar`,
        { image }
      )
      .pipe(
        tap(({ user }) => this._currentUser.set(user))
      );
  }

  // ─── Update notification preferences (channels and/or per-type switches) ───
  updateNotifPrefs(
    update: NotifPrefsUpdate
  ): Observable<{ notifPrefs: User['notifPrefs']; notifTypes: User['notifTypes'] }> {
    return this.http
      .put<{ notifPrefs: User['notifPrefs']; notifTypes: User['notifTypes'] }>(
        `${environment.apiUrl}/users/me/notif-prefs`,
        update
      )
      .pipe(
        tap(({ notifPrefs, notifTypes }) => {
          const current = this._currentUser();
          if (current) this._currentUser.set({ ...current, notifPrefs, notifTypes });
        })
      );
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  logout(): void {
    const refreshToken = this.tokenService.getRefreshToken();
    if (refreshToken) {
      // Fire and forget — don't wait for server response
      this.http
        .post(`${this.API}/logout`, { refreshToken })
        .subscribe({ error: () => {} });
    }

    this.tokenService.clearTokens();
    this._currentUser.set(null);
    this.socketService.disconnect();
    this.router.navigate(['/auth/login']);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────
  // Persist tokens + user and open the socket, without navigating — callers
  // that need a different destination (e.g. first-time set-password) navigate
  // themselves.
  private applySession(user: User, tokens: AuthTokens): void {
    this.tokenService.setTokens(tokens.accessToken, tokens.refreshToken);
    this._currentUser.set(user);
    this.socketService.connect(tokens.accessToken);
  }

  private setSession(user: User, tokens: AuthTokens): void {
    this.applySession(user, tokens);
    this.router.navigate(['/app/home']);
  }

  /**
   * Called on app boot to restore session from localStorage
   */
  restoreSession(): void {
    const accessToken = this.tokenService.getAccessToken();
    if (!accessToken) return;

    this.fetchCurrentUser().subscribe({
      next: (user) => {
        this._currentUser.set(user);
        this.socketService.connect(accessToken);
      },
      error: () => {
        // Token invalid or expired — clear and redirect
        this.tokenService.clearTokens();
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
