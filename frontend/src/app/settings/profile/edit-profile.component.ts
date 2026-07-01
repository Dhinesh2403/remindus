// src/app/settings/profile/edit-profile.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="ep-content">
      <!-- Hero (read-only) -->
      <div class="ep-hero">
        <button class="ep-back" (click)="nav.navigate(['/app/settings/profile'])">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="ep-edit-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          Edit
        </button>
        <div class="ep-avatar">{{ initials() }}</div>
        <div class="ep-name">{{ user()?.name ?? 'User' }}</div>
        <div class="ep-email">{{ user()?.email }}</div>
      </div>

      <!-- Edit form -->
      <div class="ep-form">
        <div class="ep-section-label">EDIT PROFILE</div>
        <div class="ep-field">
          <label>Full name</label>
          <input class="ep-input" [(ngModel)]="name" />
        </div>
        <div class="ep-field">
          <label>Email address</label>
          <input class="ep-input" [(ngModel)]="email" type="email" [disabled]="true" />
        </div>
        <div class="ep-field">
          <label>Phone number</label>
          <input class="ep-input" [(ngModel)]="phone" type="tel" placeholder="+1 555 0142" />
        </div>

        <div class="ep-actions">
          <button class="ep-cancel" (click)="nav.navigate(['/app/settings/profile'])">Cancel</button>
          <button class="ep-save" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .ep-content { --background: var(--rm-bg); }
    .ep-hero { background: linear-gradient(160deg,#3D5AF1,#2A3FCC); padding: calc(env(safe-area-inset-top) + 14px) 16px 28px; display: flex; flex-direction: column; align-items: center; position: relative; }
    .ep-back { position: absolute; top: calc(env(safe-area-inset-top) + 14px); left: 16px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .ep-edit-icon { position: absolute; top: calc(env(safe-area-inset-top) + 14px); right: 16px; height: 34px; padding: 0 14px; border-radius: 17px; border: none; background: rgba(255,255,255,.18); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; }
    .ep-avatar { width: 84px; height: 84px; border-radius: 50%; border: 3px solid rgba(255,255,255,.35); background: rgba(255,255,255,.20); display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; color: #fff; margin-bottom: 12px; font-family: 'Nunito', sans-serif; }
    .ep-name  { font-size: 22px; font-weight: 900; color: #fff; font-family: 'Nunito', sans-serif; }
    .ep-email { font-size: 14px; color: rgba(255,255,255,.75); margin-top: 4px; }
    .ep-form { padding: 20px 16px; }
    .ep-section-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; color: var(--rm-text-muted); margin-bottom: 16px; }
    .ep-field { margin-bottom: 14px; }
    .ep-field label { font-size: 13px; font-weight: 600; color: var(--rm-text-secondary); display: block; margin-bottom: 6px; }
    .ep-input { width: 100%; height: 52px; padding: 0 16px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: var(--rm-surface); font-size: 15px; color: var(--rm-text-primary); font-family: inherit; outline: none; &:disabled { opacity: .6; } &:focus { border-color: var(--rm-purple); } }
    .ep-actions { display: flex; gap: 12px; margin-top: 24px; }
    .ep-cancel { flex: 1; height: 52px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: transparent; font-size: 15px; font-weight: 700; color: var(--rm-text-primary); cursor: pointer; font-family: inherit; }
    .ep-save   { flex: 2; height: 52px; border-radius: 14px; border: none; background: var(--rm-purple); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; &:disabled { opacity: .6; } }
  `],
})
export class EditProfileComponent {
  protected nav  = inject(Router);
  private auth   = inject(AuthService);
  private http   = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  readonly user  = this.auth.currentUser;
  name  = this.user()?.name ?? '';
  email = this.user()?.email ?? '';
  phone = (this.user() as any)?.phone ?? '';
  readonly saving = signal(false);

  initials(): string {
    return this.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.http.put<{ success: boolean; user: any }>(`${environment.apiUrl}/users/profile`, { name: this.name, phone: this.phone })
      .subscribe({
        next: async () => {
          this.saving.set(false);
          const t = await this.toastCtrl.create({ message: 'Profile updated', duration: 2000, color: 'success', position: 'top' });
          await t.present();
          this.nav.navigate(['/app/settings/profile']);
        },
        error: async () => {
          this.saving.set(false);
          const t = await this.toastCtrl.create({ message: 'Update failed', duration: 2000, color: 'danger', position: 'top' });
          await t.present();
        },
      });
  }
}
