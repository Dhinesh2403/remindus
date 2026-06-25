// src/app/onboarding/onboarding.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SafeHtmlPipe } from '../core/pipes/safe-html.pipe';

interface OnboardItem {
  icon: string;   // inline SVG markup
  title: string;
  body: string;
}

/**
 * First-run intro shown once after the user signs in. "Get started" marks the
 * intro as seen and enters the app.
 *
 * TODO(db): the "seen onboarding" flag is kept in localStorage for now and
 * should move to the user profile so it follows the account across devices.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [SafeHtmlPipe],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private router = inject(Router);

  readonly items: OnboardItem[] = [
    {
      title: 'Never miss a beat',
      body: 'Daily habits, medicines, monthly bills & one-off tasks — all in one calm place.',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
               <path d="M12 4a5 5 0 015 5c0 4 1.6 5 1.6 5H5.4S7 13 7 9a5 5 0 015-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
               <path d="M10.5 18a1.7 1.7 0 003 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
             </svg>`,
    },
    {
      title: 'Share with friends',
      body: 'Connect by Ref ID, assign reminders, and keep shared lists in sync.',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
               <circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/>
               <path d="M3.5 19a5.5 5.5 0 0111 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
               <circle cx="17" cy="8" r="2.6" stroke="currentColor" stroke-width="1.7"/>
               <path d="M16 13.5a5 5 0 014.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
             </svg>`,
    },
    {
      title: 'Plan over chat',
      body: 'Turn a message into a task or reminder right inside your conversations.',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
               <path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
             </svg>`,
    },
  ];

  enterApp(): void {
    localStorage.setItem('sc_onboarded', '1');
    this.router.navigateByUrl('/app/home');
  }
}
