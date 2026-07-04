// src/app/core/services/time.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const OFFSET_KEY  = 'rm_clock_offset_ms';
const SKIP_LOADER = { headers: { 'X-Skip-Loading': '1' } };

/**
 * Trusted wall-clock.
 *
 * The device clock can be wrong — the user set it by hand, it drifted, or
 * auto-time is off — which would make our "now + 5 min" preloads and the UTC
 * `nextFireAt` we send the server point at the wrong instant. So instead of
 * trusting `Date.now()` we reconcile a one-time offset against the server's
 * clock (`GET /api/health` → `timestamp`) and apply it everywhere we need "now".
 *
 * We only correct the *instant*, not the zone: times are still rendered in the
 * device's IANA timezone. A zone offset stays reliable even when the clock
 * value is wrong, and it matches where the user physically is.
 */
@Injectable({ providedIn: 'root' })
export class TimeService {
  private http = inject(HttpClient);

  /**
   * ms to add to `Date.now()` to reach trusted server time. Persisted so a
   * wrong device clock is corrected from the very first render — before the
   * first `sync()` of the launch resolves — using the last known offset.
   */
  private offsetMs = this.loadOffset();

  /** true once we've reconciled with the server at least once this launch. */
  readonly synced = signal(false);

  // ── Trusted now ──────────────────────────────────────────────────────────
  /** Trusted "now" as epoch ms (device clock corrected by the server offset). */
  nowMs(): number { return Date.now() + this.offsetMs; }

  /** Trusted "now" as a fresh Date (safe for callers to mutate). */
  now(): Date { return new Date(this.nowMs()); }

  /**
   * Trusted now + `minutes`, split into the strings the create forms bind to:
   * `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` in the device timezone.
   */
  plusMinutes(minutes: number): { date: string; time: string } {
    const d = new Date(this.nowMs() + minutes * 60_000);
    return { date: this.dateStr(d), time: this.timeStr(d) };
  }

  /** 'YYYY-MM-DD' for a Date (device-local), defaulting to trusted now. */
  dateStr(d: Date = this.now()): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** 'HH:mm' (24h) for a Date (device-local), defaulting to trusted now. */
  timeStr(d: Date = this.now()): string {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ── Sync ─────────────────────────────────────────────────────────────────
  /**
   * Reconcile the offset against server time. Latency-corrected single-sample
   * estimate (SNTP-style): assume the server stamped its clock halfway through
   * the round-trip. Safe to call repeatedly (boot + every foreground resume);
   * never throws — on failure the last known offset is kept.
   */
  async sync(): Promise<void> {
    const t0 = Date.now();
    try {
      const res = await firstValueFrom(
        this.http.get<{ timestamp?: string }>(`${environment.apiUrl}/health`, SKIP_LOADER),
      );
      const serverMs = res?.timestamp ? new Date(res.timestamp).getTime() : NaN;
      if (!Number.isFinite(serverMs)) return;

      const t1  = Date.now();
      const rtt = t1 - t0;
      this.offsetMs = Math.round(serverMs + rtt / 2 - t1);
      localStorage.setItem(OFFSET_KEY, String(this.offsetMs));
      this.synced.set(true);
    } catch {
      /* offline or /health down — keep the cached offset */
    }
  }

  private loadOffset(): number {
    const raw = Number(localStorage.getItem(OFFSET_KEY));
    return Number.isFinite(raw) ? raw : 0;
  }
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
