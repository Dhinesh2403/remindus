// src/app/core/components/rm-date-field.component.ts
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

/**
 * Shared themed date picker field. Shows a formatted value and opens the
 * native date dialog (system calendar on Android) via a hidden input.
 * Value format: "YYYY-MM-DD".
 */
@Component({
  selector: 'rm-date-field',
  standalone: true,
  template: `
    <button type="button" class="fld" (click)="open()">
      <span class="fld-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      </span>
      <span class="fld-body">
        <span class="fld-label">{{ label }}</span>
        <span class="fld-value" [class.empty]="!value">{{ display }}</span>
      </span>
      <input #native class="fld-native" type="date" [value]="value"
             (change)="onPick($event)" (input)="onPick($event)" tabindex="-1" aria-hidden="true" />
    </button>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .fld { position: relative; width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--rm-field-bg, var(--rm-surface)); border: 1.5px solid var(--rm-border); border-radius: 14px; cursor: pointer; font-family: inherit; text-align: left; }
    .fld:active { transform: scale(.985); }
    .fld-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(59,130,246,.12); color: #3B82F6; }
    .fld-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .fld-label { font-size: 11px; font-weight: 700; color: var(--rm-text-muted); letter-spacing: .4px; text-transform: uppercase; }
    .fld-value { font-size: var(--rm-field-value-size, 14.5px); font-weight: 700; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fld-value.empty { color: var(--rm-text-muted); font-weight: 600; }
    .fld-native { position: absolute; inset: 0; opacity: 0; pointer-events: none; border: 0; }
  `],
})
export class RmDateFieldComponent {
  @Input() label = 'Date';
  @Input() value = '';
  @Input() placeholder = 'Pick a date';
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild('native') native?: ElementRef<HTMLInputElement>;

  get display(): string {
    if (!this.value) return this.placeholder;
    const d = new Date(`${this.value}T00:00:00`);
    if (isNaN(d.getTime())) return this.placeholder;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  open(): void {
    const el = this.native?.nativeElement;
    if (!el) return;
    el.focus();
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* focus() already done */ }
  }

  onPick(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    if (v !== this.value) { this.value = v; this.valueChange.emit(v); }
  }
}
