// src/app/core/services/badge.service.ts
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

/**
 * Drives the launcher app-icon badge count.
 *
 *  • Native (Android/iOS) → @capawesome/capacitor-badge.
 *  • Installed PWA / supported browsers → the W3C Badging API.
 *
 * Both paths are wrapped so a missing/unsupported platform is a silent no-op.
 */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  private nativeChecked = false;
  private nativeSupported = false;

  async set(count: number): Promise<void> {
    const n = Math.max(0, Math.floor(count || 0));

    if (Capacitor.isNativePlatform()) {
      try {
        if (!this.nativeChecked) {
          this.nativeChecked = true;
          this.nativeSupported = (await Badge.isSupported()).isSupported;
          if (this.nativeSupported) {
            // No-op if already granted; required on some launchers.
            await Badge.requestPermissions().catch(() => {});
          }
        }
        if (this.nativeSupported) {
          if (n > 0) await Badge.set({ count: n });
          else await Badge.clear();
        }
      } catch {
        /* ignore — badge is best-effort */
      }
      return;
    }

    // Web / PWA
    try {
      const nav = navigator as Navigator & {
        setAppBadge?: (n?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (n > 0) await nav.setAppBadge?.(n);
      else await nav.clearAppBadge?.();
    } catch {
      /* unsupported — ignore */
    }
  }

  clear(): Promise<void> {
    return this.set(0);
  }
}
