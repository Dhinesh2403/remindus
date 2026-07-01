// src/app/core/services/update.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppVersionService } from './app-version.service';
import { ConnectivityService } from './connectivity.service';

export interface VersionCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  latestBuild: number;
  updateUrl: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  message: string;
}

const SNOOZE_KEY = 'rm_update_snoozed_build';

/**
 * On boot (and on demand) asks the backend whether the installed build needs a
 * force / optional update, and whether the backend is in maintenance. Update
 * gating only applies on native builds; maintenance applies everywhere.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private http = inject(HttpClient);
  private appVersion = inject(AppVersionService);
  private connectivity = inject(ConnectivityService);

  private readonly API = `${environment.apiUrl}/app/version-check`;

  readonly result = signal<VersionCheckResult | null>(null);
  readonly forceUpdate = signal(false);
  readonly updateAvailable = signal(false);

  /**
   * Runs the version/maintenance check. Returns the result, or null if the
   * check itself failed (offline) — callers should treat null as "unknown / do
   * not block on update".
   */
  async check(): Promise<VersionCheckResult | null> {
    const info = await this.appVersion.getInfo();
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: VersionCheckResult }>(this.API, {
          platform: info.platform,
          versionCode: info.build,
          versionName: info.versionName,
        })
      );
      const data = res.data;
      this.result.set(data);

      // Maintenance blocks every platform.
      this.connectivity.setMaintenance(!!data.maintenanceMode, data.maintenanceMessage);

      // Update gating is native-only (the web PWA is always "latest").
      const native = Capacitor.isNativePlatform();
      this.forceUpdate.set(native && data.forceUpdate);
      this.updateAvailable.set(native && data.updateAvailable);

      return data;
    } catch {
      // Network/5xx — the error interceptor already flagged serverDown.
      return null;
    }
  }

  /** True if the user previously chose "Later" for this exact latest build. */
  isSnoozed(latestBuild: number): boolean {
    return localStorage.getItem(SNOOZE_KEY) === String(latestBuild);
  }

  snooze(latestBuild: number): void {
    localStorage.setItem(SNOOZE_KEY, String(latestBuild));
  }

  /** Open the store listing / update page. */
  async openStore(): Promise<void> {
    const url = this.result()?.updateUrl || environment.playStoreUrl;
    const appId = 'com.remindus.app';
    if (Capacitor.getPlatform() === 'android') {
      // Prefer the Play Store app via market:// then fall back to the web listing.
      try {
        window.open(`market://details?id=${appId}`, '_system');
        return;
      } catch {
        /* fall through */
      }
    }
    window.open(url, '_system');
  }
}
