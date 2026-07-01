// src/app/settings/notifications-settings/notifications-settings.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';

@Component({
  selector: 'app-notifications-settings',
  standalone: true,
  imports: [CommonModule, IonContent, IonToggle],
  template: `
    <ion-content class="ns-content">
      <div class="ns-header">
        <button class="ns-back" (click)="nav.navigate(['/app/settings'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <h1 class="ns-title">Notifications &amp; Sounds</h1>
      </div>
      <div class="ns-list">
        @for (item of settings(); track item.key) {
          <div class="ns-item">
            <div class="ns-item-body">
              <div class="ns-item-title">{{ item.title }}</div>
              <div class="ns-item-sub">{{ item.sub }}</div>
            </div>
            <ion-toggle [checked]="item.on" (ionChange)="toggle(item.key)"></ion-toggle>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .ns-content { --background: var(--rm-bg); }
    .ns-header { display: flex; align-items: center; gap: 14px; padding: calc(env(safe-area-inset-top) + 14px) 16px 14px; background: var(--rm-card); border-bottom: 1px solid var(--rm-border); }
    .ns-back { width: 36px; height: 36px; border-radius: 10px; border: none; background: var(--rm-surface); display: flex; align-items: center; justify-content: center; color: var(--rm-text-primary); cursor: pointer; }
    .ns-title { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); margin: 0; font-family: 'Nunito', sans-serif; }
    .ns-list { padding: 16px; display: flex; flex-direction: column; gap: 0; background: var(--rm-card); border-radius: 16px; margin: 16px; box-shadow: var(--rm-shadow-sm); }
    .ns-item { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--rm-border); }
    .ns-item:last-child { border-bottom: none; }
    .ns-item-body { flex: 1; }
    .ns-item-title { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); }
    .ns-item-sub   { font-size: 12.5px; color: var(--rm-text-muted); margin-top: 3px; }
  `],
})
export class NotificationsSettingsComponent {
  protected nav = inject(Router);
  readonly settings = signal([
    { key: 'push',         title: 'Push notifications', sub: 'Master switch for all alerts', on: true },
    { key: 'reminders',   title: 'Reminder alerts',     sub: 'Get notified at the set time',  on: true },
    { key: 'sound',       title: 'Sound',               sub: '',                              on: true },
    { key: 'vibration',   title: 'Vibration',           sub: '',                              on: true },
    { key: 'daily',       title: 'Daily summary',       sub: 'A morning digest at 8:00 AM',   on: true },
    { key: 'quiet',       title: 'Quiet hours',         sub: 'Mute 10:00 PM – 7:00 AM',       on: false },
  ]);

  toggle(key: string): void {
    this.settings.update(s => s.map(i => i.key === key ? { ...i, on: !i.on } : i));
  }
}
