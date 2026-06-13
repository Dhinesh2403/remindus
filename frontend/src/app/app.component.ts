// src/app/app.component.ts
import { Component, inject, OnInit, effect } from '@angular/core';
import { IonApp, IonRouterOutlet }   from '@ionic/angular/standalone';
import { AuthService }    from './core/services/auth.service';
import { ThemeService }   from './core/services/theme.service';
import { PushService }    from './core/services/push.service';

@Component({
  selector:    'app-root',
  standalone:  true,
  imports:     [IonApp, IonRouterOutlet],
  template:    `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  private authService  = inject(AuthService);
  private themeService = inject(ThemeService);
  private pushService  = inject(PushService);

  private pushInitialised = false;

  constructor() {
    // Runs whenever isAuthenticated changes — covers both app-boot restore and fresh login
    effect(() => {
      if (this.authService.isAuthenticated() && !this.pushInitialised) {
        this.pushInitialised = true;
        this.pushService.init();
      }
      if (!this.authService.isAuthenticated()) {
        this.pushInitialised = false;
      }
    });
  }

  ngOnInit(): void {
    this.themeService.init();
    this.authService.restoreSession();
  }
}
