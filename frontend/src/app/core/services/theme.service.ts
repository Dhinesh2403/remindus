// src/app/core/services/theme.service.ts
import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _mode = signal<ThemeMode>('light');
  readonly mode = this._mode.asReadonly();

  apply(mode: ThemeMode): void {
    this._mode.set(mode);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark      = mode === 'dark' || (mode === 'system' && prefersDark);

    document.body.classList.toggle('dark-theme',  isDark);
    document.body.classList.toggle('light-theme', !isDark);

    // Sync status bar style and colour with the active theme (native only)
    if (Capacitor.isNativePlatform()) {
      if (isDark) {
        // Dark theme — purple bar, white icons
        StatusBar.setStyle({ style: Style.Light });
        StatusBar.setBackgroundColor({ color: '#2A3FCC' });
      } else {
        // Light theme — white bar, dark icons
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#ffffff' });
      }
    }
  }

  init(): void {
    const saved = (localStorage.getItem('rm_theme') as ThemeMode) ?? 'light';
    this.apply(saved);
  }
}
