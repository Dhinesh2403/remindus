// src/app/core/services/logger.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { AppVersionService } from './app-version.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  stack?: string | null;
  context?: unknown;
  clientTime: string;
}

const DEVICE_ID_KEY = 'rm_device_id';
const MAX_BUFFER = 50;      // ring buffer cap
const FLUSH_MS   = 30_000;  // periodic flush

/**
 * Lightweight client logger + crash reporter. Buffers structured log entries,
 * captures uncaught errors (via the global ErrorHandler and window listeners),
 * and flushes batches to the backend (`POST /api/logs/device`) for the admin
 * dashboard. Only flushes while authenticated; flush failures are swallowed so
 * logging can never crash or recurse.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private http = inject(HttpClient);
  private tokenService = inject(TokenService);
  private appVersion = inject(AppVersionService);

  private readonly API = `${environment.apiUrl}/logs/device`;
  private readonly sessionId = this.genId();
  private buffer: LogEntry[] = [];
  private flushing = false;
  private started = false;
  // After a failed flush, don't retry before this time. Prevents a burst of
  // errors (each of which requests a flush) from hammering /logs/device — the
  // periodic interval will pick the buffer back up once the cooldown passes.
  private cooldownUntil = 0;

  /** Wire up global capture + periodic/lifecycle flushing. Call once on boot. */
  init(): void {
    if (this.started) return;
    this.started = true;

    setInterval(() => this.flush(), FLUSH_MS);

    window.addEventListener('error', (e) => {
      this.error(e.message || 'window.onerror', { source: 'window' }, e.error?.stack);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = (e as PromiseRejectionEvent).reason;
      this.error(reason?.message || 'unhandledrejection', { source: 'promise' }, reason?.stack);
    });

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => { if (!isActive) this.flush(); });
    } else {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  debug(msg: string, ctx?: unknown): void { this.add('debug', msg, ctx); }
  info(msg: string, ctx?: unknown): void  { this.add('info',  msg, ctx); }
  warn(msg: string, ctx?: unknown): void  { this.add('warn',  msg, ctx); }
  error(msg: string, ctx?: unknown, stack?: string | null): void {
    this.add('error', msg, ctx, stack);
  }

  private add(level: LogLevel, message: string, context?: unknown, stack?: string | null): void {
    if (environment.enableLogging) {
      const fn = level === 'error' || level === 'fatal' ? 'error'
        : level === 'warn' ? 'warn' : 'log';
      // eslint-disable-next-line no-console
      console[fn](`[${level}] ${message}`, context ?? '');
    }

    this.buffer.push({ level, message, stack: stack ?? null, context, clientTime: new Date().toISOString() });
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();

    // Errors are worth uploading promptly.
    if (level === 'error' || level === 'fatal') this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (Date.now() < this.cooldownUntil) return; // backing off after a failure
    if (!this.tokenService.getAccessToken()) return; // only when logged in

    this.flushing = true;
    const batch = this.buffer.slice(0, MAX_BUFFER);
    const device = await this.deviceMeta();

    this.http.post(this.API, { device, logs: batch }, { headers: { 'X-Skip-Loading': '1' } }).subscribe({
      next: () => { this.buffer.splice(0, batch.length); this.cooldownUntil = 0; this.flushing = false; },
      // Keep the buffer for a later retry, but back off so repeated errors don't
      // flood the endpoint. NEVER log this failure (would recurse).
      error: () => { this.cooldownUntil = Date.now() + FLUSH_MS; this.flushing = false; },
    });
  }

  private async deviceMeta() {
    const info = await this.appVersion.getInfo();
    return {
      platform:    info.platform,
      appVersion:  info.versionName,
      appBuild:    info.build,
      osVersion:   navigator.userAgent?.slice(0, 120) ?? null,
      deviceModel: (navigator as unknown as { platform?: string }).platform ?? null,
      deviceId:    this.deviceId(),
      sessionId:   this.sessionId,
    };
  }

  private deviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = this.genId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  private genId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}
