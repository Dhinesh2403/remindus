// src/app/layouts/main-layout/main-layout.component.ts
import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonBadge } from '@ionic/angular/standalone';
import { FriendService } from '../../core/services/friend.service';
import { ReminderService } from '../../core/services/reminder.service';
import { ChatService } from '../../core/services/chat.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonTabs, IonTabBar, IonTabButton, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="home" href="/app/home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 12L12 3l9 9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 21V12h6v9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 10v11h14V10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="tab-label">Home</span>
        </ion-tab-button>

        <ion-tab-button tab="calendar" href="/app/calendar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.9"/>
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          </svg>
          <span class="tab-label">Calendar</span>
        </ion-tab-button>

        <ion-tab-button tab="reminders" href="/app/reminders">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 3a6 6 0 016 6c0 5 2 6 2 6H4s2-1 2-6a6 6 0 016-6z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
            <path d="M10.5 19a1.7 1.7 0 003 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          </svg>
          @if (reminderBadgeCount() > 0) {
            <ion-badge color="danger">{{ reminderBadgeCount() }}</ion-badge>
          }
          <span class="tab-label">Reminders</span>
        </ion-tab-button>

        <ion-tab-button tab="friends" href="/app/friends">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.9"/>
            <path d="M3 20a6 6 0 0112 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
            <circle cx="17.5" cy="8" r="2.8" stroke="currentColor" stroke-width="1.9"/>
            <path d="M16.5 14.5a5 5 0 015 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          </svg>
          @if (friendsBadge() > 0) {
            <ion-badge color="danger">{{ friendsBadge() }}</ion-badge>
          }
          <span class="tab-label">Friends</span>
        </ion-tab-button>

        <ion-tab-button tab="settings" href="/app/settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.9"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.9"/>
          </svg>
          <span class="tab-label">Settings</span>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      --background: var(--rm-card);
      --border: 1px solid var(--rm-border);
      height: 68px;
      padding-bottom: env(safe-area-inset-bottom);
      padding-top: 4px;
    }
    ion-tab-button {
      --color: var(--rm-text-muted);
      --color-selected: var(--rm-purple);
      --ripple-color: transparent;
    }
    ion-tab-button svg { transition: stroke .18s; }
    ion-tab-button.tab-selected svg { stroke: var(--rm-purple); }
    .tab-label {
      font-size: 10.5px;
      font-weight: 600;
      margin-top: 3px;
      font-family: 'DM Sans', sans-serif;
    }
    ion-badge {
      position: absolute;
      top: 4px;
      right: 12px;
      font-size: 10px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 9px;
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  private friendService   = inject(FriendService);
  private reminderService = inject(ReminderService);
  private chatService     = inject(ChatService);

  readonly reminderBadgeCount = this.reminderService.reminderBadgeCount;
  readonly friendsBadge = computed(() =>
    this.friendService.pendingCount() + this.chatService.totalUnread()
  );

  ngOnInit() {
    this.friendService.getFriends().subscribe();
    this.reminderService.getAll({ limit: 100 }).subscribe();
    this.reminderService.getReceived().subscribe();
  }
}
