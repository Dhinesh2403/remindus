// src/app/app.component.ts
import { Component, inject, OnInit, effect } from '@angular/core';
import { IonApp, IonRouterOutlet }   from '@ionic/angular/standalone';
import { AuthService }    from './core/services/auth.service';
import { ThemeService }   from './core/services/theme.service';
import { PushService }    from './core/services/push.service';
import { FriendService }  from './core/services/friend.service';
import { ChatService }    from './core/services/chat.service';
import { BadgeService }   from './core/services/badge.service';

@Component({
  selector:    'app-root',
  standalone:  true,
  imports:     [IonApp, IonRouterOutlet],
  template:    `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  private authService   = inject(AuthService);
  private themeService  = inject(ThemeService);
  private pushService   = inject(PushService);
  private friendService = inject(FriendService);
  private chatService   = inject(ChatService);
  private badgeService  = inject(BadgeService);

  private pushInitialised = false;

  constructor() {
    // Runs whenever isAuthenticated changes — covers both app-boot restore and fresh login
    effect(() => {
      if (this.authService.isAuthenticated() && !this.pushInitialised) {
        this.pushInitialised = true;
        this.pushService.init();
        this.chatService.init();
        // Prime the pending-request count so the app-icon badge is correct on boot.
        this.friendService.getFriends().subscribe({ error: () => {} });
      }
      if (!this.authService.isAuthenticated()) {
        this.pushInitialised = false;
        this.chatService.reset();
        this.badgeService.clear();
      }
    });

    // Mirror pending friend-requests + unread chat messages onto the app-icon badge.
    effect(() => {
      this.badgeService.set(this.friendService.pendingCount() + this.chatService.totalUnread());
    });
  }

  ngOnInit(): void {
    this.themeService.init();
    this.authService.restoreSession();
  }
}
