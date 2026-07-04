// src/app/core/services/loading.service.ts
import { Injectable, signal } from '@angular/core';

/** Overlay only appears if a request outlives this grace period (ms). */
const SHOW_DELAY = 250;
/** Once shown, keep the overlay up at least this long (ms) to avoid flicker. */
const MIN_VISIBLE = 400;

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private count = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  /** True while any non-skipped request is in flight. */
  readonly active = signal(false);
  /** True while the global overlay should actually be rendered. */
  readonly visible = signal(false);

  show(): void {
    this.count++;
    this.active.set(true);
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    if (!this.visible() && !this.showTimer) {
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        if (this.count > 0) {
          this.shownAt = Date.now();
          this.visible.set(true);
        }
      }, SHOW_DELAY);
    }
  }

  hide(): void {
    this.count = Math.max(this.count - 1, 0);
    if (this.count > 0) return;
    this.active.set(false);
    if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null; }
    if (!this.visible() || this.hideTimer) return;
    const wait = Math.max(MIN_VISIBLE - (Date.now() - this.shownAt), 0);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.count === 0) this.visible.set(false);
    }, wait);
  }
}
