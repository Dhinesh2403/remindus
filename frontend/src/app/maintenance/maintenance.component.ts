// src/app/maintenance/maintenance.component.ts
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { constructOutline, refreshOutline } from 'ionicons/icons';
import { UpdateService } from '../core/services/update.service';
import { ConnectivityService } from '../core/services/connectivity.service';
import { AuthService } from '../core/services/auth.service';

/**
 * Shown when the backend is unreachable (server down) or in planned
 * maintenance. "Retry" re-probes the backend; on success it restores the
 * session and returns the user to the app — the user is never silently logged
 * out just because the server was down.
 */
@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content class="mnt-content">
      <div class="mnt-wrap">
        <div class="mnt-badge">
          <ion-icon name="construct-outline"></ion-icon>
        </div>

        <h1 class="mnt-title">
          {{ connectivity.maintenance() ? 'Under maintenance' : 'Server unreachable' }}
        </h1>

        <p class="mnt-msg">
          {{ message() ?? defaultMsg() }}
        </p>

        <button class="btn-primary" (click)="retry()" [disabled]="retrying()">
          <ion-icon name="refresh-outline"></ion-icon>
          {{ retrying() ? 'Checking…' : 'Retry' }}
        </button>
      </div>
    </ion-content>
  `,
  styles: [`
    .mnt-content { --background: var(--rm-bg, #F5F6FA); }
    .mnt-wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px 28px; }
    .mnt-badge { width: 92px; height: 92px; border-radius: 26px; background: rgba(61,90,241,0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; }
    .mnt-badge ion-icon { font-size: 46px; color: #3D5AF1; }
    .mnt-title { font-size: 24px; font-weight: 800; margin: 0 0 12px; color: var(--rm-text, #1A1D2E); }
    .mnt-msg { font-size: 15px; line-height: 1.5; color: var(--rm-text-secondary, #5A6072); margin: 0 0 28px; max-width: 320px; }
    .btn-primary { width: 100%; max-width: 320px; height: 52px; border: none; border-radius: 14px; background: #3D5AF1; color: #fff; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary[disabled] { opacity: 0.6; }
    .btn-primary ion-icon { font-size: 20px; }
  `],
})
export class MaintenanceComponent {
  private updateService = inject(UpdateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  protected connectivity = inject(ConnectivityService);

  readonly retrying = signal(false);
  readonly message = this.connectivity.maintenanceMessage;

  constructor() {
    addIcons({ constructOutline, refreshOutline });
  }

  defaultMsg(): string {
    return this.connectivity.maintenance()
      ? 'We are performing scheduled maintenance. Please try again shortly.'
      : 'Please check your internet connection and try again.';
  }

  async retry(): Promise<void> {
    this.retrying.set(true);
    const res = await this.updateService.check();
    this.retrying.set(false);

    // Still offline (the request itself failed).
    if (!res) {
      const t = await this.toastCtrl.create({ message: 'Still unable to connect.', duration: 2000, color: 'dark' });
      await t.present();
      return;
    }
    // Still in maintenance.
    if (res.maintenanceMode) return;

    // Back online — clear the block, restore the session, return to the app.
    this.connectivity.markServerUp();
    this.connectivity.setMaintenance(false);
    this.authService.restoreSession();
    this.router.navigate([this.authService.isAuthenticated() ? '/app/home' : '/auth/login']);
  }
}
