// src/app/app.component.ts
import { Component, inject, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet, AlertController } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { AuthService }    from './core/services/auth.service';
import { ThemeService }   from './core/services/theme.service';
import { PushService }    from './core/services/push.service';
import { FriendService }  from './core/services/friend.service';
import { ChatService }    from './core/services/chat.service';
import { BadgeService }   from './core/services/badge.service';
import { LoggerService }  from './core/services/logger.service';
import { UpdateService }  from './core/services/update.service';
import { RatingService }  from './core/services/rating.service';
import { ConnectivityService } from './core/services/connectivity.service';

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
  private logger        = inject(LoggerService);
  private updateService = inject(UpdateService);
  private ratingService = inject(RatingService);
  private connectivity  = inject(ConnectivityService);
  private router        = inject(Router);
  private alertCtrl     = inject(AlertController);

  private pushInitialised = false;
  private ratingAsked = false;

  constructor() {
    // Runs whenever isAuthenticated changes — covers both app-boot restore and fresh login
    effect(() => {
      if (this.authService.isAuthenticated() && !this.pushInitialised) {
        this.pushInitialised = true;
        this.pushService.init();
        this.chatService.init();
        // Prime the pending-request count so the app-icon badge is correct on boot.
        this.friendService.getFriends().subscribe({ error: () => {} });
        // Gently ask happy, returning users to rate the app (throttled internally).
        if (!this.ratingAsked) {
          this.ratingAsked = true;
          setTimeout(() => this.ratingService.maybeAsk(), 4000);
        }
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

    // Gate the app behind the force-update / maintenance screens when required.
    // Re-runs whenever those signals change; reads the current URL to avoid
    // redundant navigations.
    effect(() => {
      const force   = this.updateService.forceUpdate();
      const blocked = this.connectivity.isBlocked();
      const url = this.router.url;

      if (force && !url.startsWith('/update')) {
        this.router.navigate(['/update']);
      } else if (blocked && !url.startsWith('/maintenance') && !url.startsWith('/update')) {
        this.router.navigate(['/maintenance']);
      }
    });
  }

  ngOnInit(): void {
    this.themeService.init();
    this.logger.init();
    this.ratingService.registerOpen();
    this.runLifecycleChecks();
    this.authService.restoreSession();
  }

  /** Boot-time version + maintenance check. Blocking screens are handled by the effect above. */
  private async runLifecycleChecks(): Promise<void> {
    const res = await this.updateService.check();
    if (!res) return; // offline — maintenance routing handled via connectivity signals

    // Optional (non-forced) update → a dismissible prompt, respecting "Later".
    if (Capacitor.isNativePlatform() && res.updateAvailable && !res.forceUpdate
        && !this.updateService.isSnoozed(res.latestBuild)) {
      this.presentOptionalUpdate(res.latestBuild);
    }
  }

  private async presentOptionalUpdate(latestBuild: number): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Update available',
      message: this.updateService.result()?.message ?? 'A new version of RemindUs is available.',
      buttons: [
        { text: 'Later', role: 'cancel', handler: () => this.updateService.snooze(latestBuild) },
        { text: 'Update', handler: () => this.updateService.openStore() },
      ],
    });
    await alert.present();
  }
}
