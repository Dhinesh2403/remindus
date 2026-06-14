// src/app/layouts/main-layout/main-layout.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, home,
  calendarOutline, calendar,
  peopleOutline, people,
  notificationsOutline, notifications,
  settingsOutline, settings,
} from 'ionicons/icons';
import { FriendService } from '../../core/services/friend.service';
import { ReminderService } from '../../core/services/reminder.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonBadge,
  ],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="home" href="/app/home">
          <ion-icon name="home-outline"></ion-icon>
          <span class="tab-label">Home</span>
        </ion-tab-button>

        <ion-tab-button tab="calendar" href="/app/calendar">
          <ion-icon name="calendar-outline"></ion-icon>
          <span class="tab-label">Calendar</span>
        </ion-tab-button>

        <ion-tab-button tab="friends" href="/app/friends">
          <ion-icon name="people-outline"></ion-icon>
          @if (pendingCount() > 0) {
            <ion-badge color="danger">{{ pendingCount() }}</ion-badge>
          }
          <span class="tab-label">Friends</span>
        </ion-tab-button>

        <ion-tab-button tab="reminders" href="/app/reminders">
          <ion-icon name="notifications-outline"></ion-icon>
          @if (reminderBadgeCount() > 0) {
            <ion-badge color="danger">{{ reminderBadgeCount() }}</ion-badge>
          }
          <span class="tab-label">Reminders</span>
        </ion-tab-button>

        <ion-tab-button tab="settings" href="/app/settings">
          <ion-icon name="settings-outline"></ion-icon>
          <span class="tab-label">Settings</span>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      --background: var(--rm-card);
      --border: 1px solid var(--rm-border);
      height: 72px;
      padding-bottom: env(safe-area-inset-bottom);
    }
    ion-tab-button {
      --color: var(--rm-text-muted);
      --color-selected: var(--rm-purple);
      --ripple-color: var(--rm-purple-light);
      font-size: 11px;
      font-weight: 500;
    }
    ion-tab-button.tab-selected {
      background: var(--rm-purple-light);
      border-radius: 12px;
    }
    ion-icon { font-size: 22px; }
    .tab-label { font-size: 11px; margin-top: 2px; }
    ion-badge {
      position: absolute;
      top: 6px;
      right: 18px;
      font-size: 10px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  private friendService   = inject(FriendService);
  private reminderService = inject(ReminderService);

  readonly pendingCount       = this.friendService.pendingCount;
  readonly reminderBadgeCount = this.reminderService.reminderBadgeCount;

  constructor() {
    addIcons({
      homeOutline, home,
      calendarOutline, calendar,
      peopleOutline, people,
      notificationsOutline, notifications,
      settingsOutline, settings,
    });
  }

  ngOnInit() {
    this.friendService.getFriends().subscribe();
    // Pre-load reminder counts so the badge is visible before the Reminders tab is opened
    this.reminderService.getAll({ limit: 100 }).subscribe();
    this.reminderService.getReceived().subscribe();
  }
}
