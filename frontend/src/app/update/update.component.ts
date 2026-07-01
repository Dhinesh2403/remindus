// src/app/update/update.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { rocketOutline, cloudDownloadOutline } from 'ionicons/icons';
import { UpdateService } from '../core/services/update.service';

/**
 * Full-screen update prompt. In FORCE mode there is no way to dismiss it (the
 * app shell bounces the user back here if they try to leave). In optional mode a
 * "Maybe later" button snoozes this build and returns to the app.
 */
@Component({
  selector: 'app-update',
  standalone: true,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content class="update-content">
      <div class="update-wrap">
        <div class="update-badge">
          <ion-icon name="rocket-outline"></ion-icon>
        </div>

        <h1 class="update-title">
          {{ force() ? 'Update required' : 'Update available' }}
        </h1>

        <p class="update-msg">
          {{ result()?.message ?? 'A new version of RemindUs is available.' }}
        </p>

        @if (result()?.latestVersion) {
          <div class="update-ver">Latest version: v{{ result()?.latestVersion }}</div>
        }

        <button class="btn-primary" (click)="update()">
          <ion-icon name="cloud-download-outline"></ion-icon>
          Update now
        </button>

        @if (!force()) {
          <button class="btn-ghost" (click)="later()">Maybe later</button>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .update-content { --background: #3D5AF1; }
    .update-wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px 28px; color: #fff; }
    .update-badge { width: 92px; height: 92px; border-radius: 26px; background: rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; }
    .update-badge ion-icon { font-size: 46px; color: #fff; }
    .update-title { font-size: 26px; font-weight: 800; margin: 0 0 12px; }
    .update-msg { font-size: 15px; line-height: 1.5; opacity: 0.92; margin: 0 0 8px; max-width: 320px; }
    .update-ver { font-size: 13px; opacity: 0.8; margin-bottom: 28px; }
    .btn-primary { width: 100%; max-width: 320px; height: 52px; border: none; border-radius: 14px; background: #fff; color: #3D5AF1; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
    .btn-primary ion-icon { font-size: 20px; }
    .btn-ghost { width: 100%; max-width: 320px; height: 48px; border: none; background: transparent; color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 600; margin-top: 12px; }
  `],
})
export class UpdateComponent {
  private updateService = inject(UpdateService);
  private router = inject(Router);

  readonly force = this.updateService.forceUpdate;
  readonly result = this.updateService.result;

  constructor() {
    addIcons({ rocketOutline, cloudDownloadOutline });
  }

  update(): void {
    this.updateService.openStore();
  }

  later(): void {
    const build = this.result()?.latestBuild;
    if (build) this.updateService.snooze(build);
    this.router.navigate(['/app/home']);
  }
}
