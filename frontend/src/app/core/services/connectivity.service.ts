// src/app/core/services/connectivity.service.ts
import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the backend is reachable / in maintenance. The error
 * interceptor flips `serverDown` on network (status 0) or 5xx failures; the
 * UpdateService flips `maintenance` when the remote config says so. The app
 * shell reacts by routing to /maintenance.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  /** True when the last core request failed to reach the server. */
  readonly serverDown = signal(false);
  /** True when the backend reports planned maintenance. */
  readonly maintenance = signal(false);
  /** Message to show on the maintenance screen. */
  readonly maintenanceMessage = signal<string | null>(null);

  /** Any reason the app should be blocked behind the maintenance screen. */
  isBlocked(): boolean {
    return this.serverDown() || this.maintenance();
  }

  markServerDown(): void {
    this.serverDown.set(true);
  }

  markServerUp(): void {
    this.serverDown.set(false);
  }

  setMaintenance(on: boolean, message?: string | null): void {
    this.maintenance.set(on);
    this.maintenanceMessage.set(on ? (message ?? null) : null);
    if (!on) this.serverDown.set(false);
  }
}
