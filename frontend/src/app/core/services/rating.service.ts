// src/app/core/services/rating.service.ts
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';

const OPEN_COUNT_KEY = 'rm_open_count';
const RATED_KEY      = 'rm_rated';
const SNOOZE_KEY     = 'rm_rate_snoozed_until';

const RATE_PROMPT_AFTER = 5;               // qualifying opens before we ask
const SNOOZE_DAYS       = 7;               // "Later" delays the next ask
const APP_ID            = 'com.remindus.app';

/**
 * Nudges happy users to rate the app on the Play Store, without nagging.
 * Counts app opens; after a threshold it shows a one-time prompt. "Rate now"
 * deep-links to the store; "Later" snoozes; "No thanks" never asks again.
 *
 * Optional native upgrade: install @capacitor-community/in-app-review to show
 * Google's in-app review card instead of leaving the app (see openStore()).
 */
@Injectable({ providedIn: 'root' })
export class RatingService {
  private alertCtrl = inject(AlertController);

  /** Call once per app launch (after the user is authenticated). */
  registerOpen(): void {
    const count = this.getCount() + 1;
    localStorage.setItem(OPEN_COUNT_KEY, String(count));
  }

  /** Show the prompt if the user is eligible. Safe to call on every boot. */
  async maybeAsk(): Promise<void> {
    if (!this.isEligible()) return;
    await this.showPrompt();
  }

  /** Force the prompt (e.g. from a Settings → "Rate Remindus" row). */
  async promptNow(): Promise<void> {
    await this.showPrompt();
  }

  private isEligible(): boolean {
    if (localStorage.getItem(RATED_KEY) === 'true') return false;
    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snoozedUntil && Date.now() < snoozedUntil) return false;
    return this.getCount() >= RATE_PROMPT_AFTER;
  }

  private async showPrompt(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Enjoying Remindus?',
      message: 'Would you mind rating us on the Play Store? It really helps!',
      buttons: [
        { text: 'No thanks', role: 'cancel', handler: () => this.markRated() },
        { text: 'Later', handler: () => this.snooze() },
        { text: 'Rate now', handler: () => { this.markRated(); this.openStore(); } },
      ],
    });
    await alert.present();
  }

  private openStore(): void {
    if (Capacitor.getPlatform() === 'android') {
      try {
        window.open(`market://details?id=${APP_ID}`, '_system');
        return;
      } catch {
        /* fall through */
      }
    }
    window.open(environment.playStoreUrl, '_system');
  }

  private markRated(): void {
    localStorage.setItem(RATED_KEY, 'true');
  }

  private snooze(): void {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
  }

  private getCount(): number {
    return Number(localStorage.getItem(OPEN_COUNT_KEY) || 0);
  }
}
