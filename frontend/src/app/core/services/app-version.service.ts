// src/app/core/services/app-version.service.ts
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';

export interface AppVersionInfo {
  /** Human version string, e.g. "1.2.0" (Android versionName). */
  versionName: string;
  /** Integer build, e.g. 5 (Android versionCode). The value we gate updates on. */
  build: number;
  /** android | ios | web */
  platform: string;
}

/**
 * Single source of the *installed* app version at runtime.
 * On native it reads the real package version via @capacitor/app; on web it
 * falls back to the compiled-in environment constants.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private cached: AppVersionInfo | null = null;

  get platform(): string {
    return Capacitor.getPlatform();
  }

  async getInfo(): Promise<AppVersionInfo> {
    if (this.cached) return this.cached;

    if (Capacitor.isNativePlatform()) {
      try {
        const info = await App.getInfo();
        this.cached = {
          versionName: info.version,
          build: Number(info.build) || environment.appBuild,
          platform: this.platform,
        };
        return this.cached;
      } catch {
        // fall through to web fallback
      }
    }

    this.cached = {
      versionName: environment.appVersion,
      build: environment.appBuild,
      platform: this.platform,
    };
    return this.cached;
  }
}
