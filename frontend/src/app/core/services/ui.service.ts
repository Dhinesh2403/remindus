// src/app/core/services/ui.service.ts
import { Injectable, signal } from '@angular/core';

/**
 * Small cross-component UI coordination service.
 *
 * `overlayOpen` is raised by full-screen in-page overlays (e.g. the inline
 * chat in the Friends tab) so the main layout can hide the bottom tab bar even
 * though the route itself hasn't changed.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  /** A full-screen overlay is covering the current tab — hide the tab bar. */
  readonly overlayOpen = signal(false);
}
