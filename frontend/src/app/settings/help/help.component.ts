// src/app/settings/help/help.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, IonContent],
  template: `
    <ion-content class="help-content">
      <div class="help-header">
        <button class="help-back" (click)="nav.navigate(['/app/settings'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <h1 class="help-title">Help &amp; Support</h1>
      </div>

      <div class="help-faq-label">FREQUENTLY ASKED</div>
      <div class="help-faq-list">
        @for (q of faqs(); track q.question) {
          <div class="help-faq-item" (click)="toggle(q)">
            <div class="help-faq-q">{{ q.question }}</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 [style.transform]="q.open ? 'rotate(180deg)' : 'none'"
                 style="transition: transform .2s; flex-shrink: 0">
              <path d="M6 9l6 6 6-6" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
            </svg>
            @if (q.open) {
              <p class="help-faq-a">{{ q.answer }}</p>
            }
          </div>
        }
      </div>

      <div class="help-actions">
        <button class="help-contact-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>
          Contact us
        </button>
        <button class="help-rate-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.5L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.8z" stroke="currentColor" stroke-width="1.7"/></svg>
          Rate app
        </button>
      </div>
      <div class="help-version">Remind · Version 2.4.0</div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .help-content { --background: var(--rm-bg); }
    .help-header { display: flex; align-items: center; gap: 14px; padding: calc(env(safe-area-inset-top) + 14px) 16px 14px; background: var(--rm-card); border-bottom: 1px solid var(--rm-border); }
    .help-back { width: 36px; height: 36px; border-radius: 10px; border: none; background: var(--rm-surface); display: flex; align-items: center; justify-content: center; color: var(--rm-text-primary); cursor: pointer; }
    .help-title { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); margin: 0; font-family: 'Nunito', sans-serif; }
    .help-faq-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; color: var(--rm-text-muted); padding: 20px 16px 8px; }
    .help-faq-list { margin: 0 16px; background: var(--rm-card); border-radius: 16px; overflow: hidden; box-shadow: var(--rm-shadow-sm); }
    .help-faq-item { padding: 16px; border-bottom: 1px solid var(--rm-border); cursor: pointer; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
    .help-faq-item:last-child { border-bottom: none; }
    .help-faq-q { flex: 1; font-size: 15px; font-weight: 600; color: var(--rm-text-primary); }
    .help-faq-a { width: 100%; font-size: 14px; color: var(--rm-text-secondary); line-height: 1.6; margin: 4px 0 0; }
    .help-actions { display: flex; gap: 12px; padding: 24px 16px 0; }
    .help-contact-btn { flex: 1; height: 50px; border-radius: 14px; border: none; background: var(--rm-purple); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .help-rate-btn    { flex: 1; height: 50px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: var(--rm-card); color: var(--rm-text-primary); font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .help-version { text-align: center; font-size: 12px; color: var(--rm-text-muted); padding: 16px; }
  `],
})
export class HelpComponent {
  protected nav = inject(Router);
  readonly faqs = signal([
    { question: 'How do I share a reminder with a friend?', answer: 'Open a reminder, tap "Assign to friend", then select from your friends list. They\'ll receive a notification instantly.', open: false },
    { question: 'Can I sync across devices?', answer: 'Yes! Your account automatically syncs across all devices. Just sign in with the same account.', open: false },
    { question: 'How do habit streaks work?', answer: 'Check off a habit every day to maintain your streak. Missing a day resets it, but your best streak is always saved.', open: false },
    { question: 'Is my data private?', answer: 'Absolutely. Your data is encrypted and never shared. We do not sell personal information to third parties.', open: false },
  ]);

  toggle(q: { question: string; answer: string; open: boolean }): void {
    this.faqs.update(list => list.map(i => i.question === q.question ? { ...i, open: !i.open } : i));
  }
}
