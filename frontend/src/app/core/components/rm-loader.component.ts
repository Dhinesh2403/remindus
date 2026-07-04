// src/app/core/components/rm-loader.component.ts
import { Component, inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { RmSpinnerComponent } from './rm-spinner.component';

/**
 * Global blocking loader overlay, rendered once in AppComponent. Appears only
 * when a server call outlives LoadingService's grace delay, so quick requests
 * never flash it.
 */
@Component({
  selector: 'rm-loader',
  standalone: true,
  imports: [RmSpinnerComponent],
  template: `
    @if (loading.visible()) {
      <div class="veil" aria-live="assertive" aria-busy="true">
        <div class="pod">
          <rm-spinner [size]="54"></rm-spinner>
        </div>
      </div>
    }
  `,
  styles: [`
    .veil { position: fixed; inset: 0; z-index: 60000; display: flex; align-items: center; justify-content: center; background: rgba(13,18,45,.34); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: rmVeilIn .18s ease both; }
    .pod { width: 96px; height: 96px; border-radius: 28px; background: var(--rm-card, #fff); box-shadow: 0 24px 60px rgba(13,18,45,.35); display: flex; align-items: center; justify-content: center; animation: rmPodIn .32s var(--rm-ease-spring, cubic-bezier(.34,1.56,.64,1)) both; }
    @keyframes rmVeilIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes rmPodIn { from { opacity: 0; transform: scale(.7) translateY(10px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .veil, .pod { animation: none; } }
  `],
})
export class RmLoaderComponent {
  protected loading = inject(LoadingService);
}
