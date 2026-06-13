// src/app/app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet }   from '@ionic/angular/standalone';
import { AuthService }    from './core/services/auth.service';
import { ThemeService }   from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';
import { PushService }    from './core/services/push.service';

@Component({
  selector:    'app-root',
  standalone:  true,
  imports:     [IonApp, IonRouterOutlet],
  template:    `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  private authService         = inject(AuthService);
  private themeService        = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private pushService         = inject(PushService);

  ngOnInit(): void {
    // Restore theme preference
    this.themeService.init();

    // Restore auth session from stored tokens
    this.authService.restoreSession();

    // Register FCM token once user is authenticated
    if (this.authService.isAuthenticated()) {
      this.pushService.init();
    }
  }
}
