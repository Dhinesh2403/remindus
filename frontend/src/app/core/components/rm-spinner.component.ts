// src/app/core/components/rm-spinner.component.ts
import { Component, Input } from '@angular/core';

/**
 * Brand-blue animated spinner: two counter-rotating arcs with a comet dot and
 * a pulsing core. Use inline for content loading; RmLoaderComponent wraps it
 * for the global blocking overlay.
 */
@Component({
  selector: 'rm-spinner',
  standalone: true,
  template: `
    <span class="sp" role="progressbar" aria-label="Loading"
          [style.width.px]="size" [style.height.px]="size">
      <span class="ring a"></span>
      <span class="ring b"></span>
      <span class="core"></span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .sp { position: relative; display: inline-block; }
    .ring { position: absolute; border-radius: 50%; border: 3px solid transparent; }
    .ring.a { inset: 0; border-top-color: var(--rm-purple, #3D5AF1); border-right-color: var(--rm-purple, #3D5AF1); animation: rmSpSpin .85s cubic-bezier(.55,.15,.45,.85) infinite; }
    .ring.a::after { content: ''; position: absolute; top: -2px; right: 12%; width: 7px; height: 7px; border-radius: 50%; background: var(--rm-purple, #3D5AF1); box-shadow: 0 0 8px rgba(61,90,241,.75); }
    .ring.b { inset: 17%; border-bottom-color: #8B9CFF; border-left-color: rgba(139,156,255,.45); animation: rmSpSpin 1.3s linear infinite reverse; }
    .core { position: absolute; inset: 40%; border-radius: 50%; background: var(--rm-purple, #3D5AF1); animation: rmSpPulse 1.1s ease-in-out infinite; }
    @keyframes rmSpSpin { to { transform: rotate(360deg); } }
    @keyframes rmSpPulse { 0%, 100% { transform: scale(.7); opacity: .55; } 50% { transform: scale(1.15); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .ring.a { animation-duration: 1.6s; }
      .ring.b, .core { animation: none; }
    }
  `],
})
export class RmSpinnerComponent {
  @Input() size = 44;
}
