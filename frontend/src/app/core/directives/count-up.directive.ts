// src/app/core/directives/count-up.directive.ts
import { Directive, ElementRef, effect, inject, input, OnDestroy } from '@angular/core';

/**
 * Animates the host element's text from its previous value to the new one.
 * Usage: <strong [rmCountUp]="todayCount()"></strong>
 */
@Directive({
  selector: '[rmCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnDestroy {
  readonly rmCountUp = input.required<number>();

  private el = inject(ElementRef<HTMLElement>);
  private rafId = 0;
  private shown = 0;

  constructor() {
    effect(() => {
      const target = this.rmCountUp() ?? 0;
      this.animateTo(target);
    });
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.rafId);
    const from = this.shown;
    if (from === target) {
      this.render(target);
      return;
    }
    const duration = 650;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.render(Math.round(from + (target - from) * eased));
      if (t < 1) this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private render(value: number): void {
    this.shown = value;
    this.el.nativeElement.textContent = String(value);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
