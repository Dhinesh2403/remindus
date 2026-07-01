// src/app/core/interceptors/auth.interceptor.ts
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject, switchMap, filter, take, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  // Skip auth header for public endpoints
  if (isPublicEndpoint(req.url)) {
    return next(req);
  }

  const accessToken = tokenService.getAccessToken();
  const authReq = accessToken ? addAuthHeader(req, accessToken) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return handle401Error(req, next, authService, tokenService);
      }
      return throwError(() => error);
    })
  );
};

function addAuthHeader(
  req: HttpRequest<unknown>,
  token: string
): HttpRequest<unknown> {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  });
}

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  tokenService: TokenService
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = tokenService.getRefreshToken();

    if (!refreshToken) {
      isRefreshing = false;
      authService.logout();
      return throwError(() => new Error('No refresh token'));
    }

    return authService.refreshAccessToken(refreshToken).pipe(
      switchMap((tokens) => {
        isRefreshing = false;
        tokenService.setTokens(tokens.accessToken, tokens.refreshToken);
        refreshTokenSubject.next(tokens.accessToken);
        return next(addAuthHeader(req, tokens.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      })
    );
  }

  // Queue subsequent requests while refreshing
  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(addAuthHeader(req, token)))
  );
}

function isPublicEndpoint(url: string): boolean {
  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-otp',
    '/auth/google',
    '/health',
    '/app/version-check',
    '/app/config',
  ];
  return publicPaths.some((path) => url.includes(path));
}
