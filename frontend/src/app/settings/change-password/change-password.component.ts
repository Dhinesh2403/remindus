// src/app/settings/change-password/change-password.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type Field = 'current' | 'newPass' | 'confirm';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="cp-content">
      <!-- Hero -->
      <div class="cp-hero">
        <button class="cp-back" (click)="cancel()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="cp-hero-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/></svg>
        </div>
        <div class="cp-title">Change Password</div>
        <div class="cp-sub">Keep your account secure</div>
      </div>

      <!-- Form -->
      <div class="cp-form">
        <div class="cp-section-label">UPDATE YOUR CREDENTIALS</div>

        <!-- Current -->
        <div class="cp-field">
          <label>Current password</label>
          <div class="cp-input-wrap">
            <input class="cp-input" [type]="show().current ? 'text' : 'password'"
              [(ngModel)]="current" autocomplete="current-password" placeholder="Enter current password" />
            <button type="button" class="cp-eye" (click)="toggleShow('current')" [attr.aria-label]="show().current ? 'Hide password' : 'Show password'">
              <svg *ngIf="!show().current" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
              <svg *ngIf="show().current" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.9 5.2A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.1 6.2A17 17 0 002 12s3.5 7 10 7a9.3 9.3 0 003.5-.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <!-- New -->
        <div class="cp-field">
          <label>New password</label>
          <div class="cp-input-wrap">
            <input class="cp-input" [type]="show().newPass ? 'text' : 'password'"
              [(ngModel)]="newPass" autocomplete="new-password" placeholder="At least 8 characters" />
            <button type="button" class="cp-eye" (click)="toggleShow('newPass')" [attr.aria-label]="show().newPass ? 'Hide password' : 'Show password'">
              <svg *ngIf="!show().newPass" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
              <svg *ngIf="show().newPass" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.9 5.2A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.1 6.2A17 17 0 002 12s3.5 7 10 7a9.3 9.3 0 003.5-.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>

          @if (newPass) {
            <div class="cp-strength">
              <div class="cp-strength-track">
                <div class="cp-strength-fill" [class]="'lvl-' + strength().level" [style.width.%]="strength().pct"></div>
              </div>
              <span class="cp-strength-label" [class]="'lvl-' + strength().level">{{ strength().label }}</span>
            </div>
          }
        </div>

        <!-- Confirm -->
        <div class="cp-field">
          <label>Confirm new password</label>
          <div class="cp-input-wrap" [class.mismatch]="confirm && confirm !== newPass">
            <input class="cp-input" [type]="show().confirm ? 'text' : 'password'"
              [(ngModel)]="confirm" autocomplete="new-password" placeholder="Re-enter new password" />
            <button type="button" class="cp-eye" (click)="toggleShow('confirm')" [attr.aria-label]="show().confirm ? 'Hide password' : 'Show password'">
              <svg *ngIf="!show().confirm" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
              <svg *ngIf="show().confirm" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.9 5.2A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.1 6.2A17 17 0 002 12s3.5 7 10 7a9.3 9.3 0 003.5-.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          @if (confirm && confirm !== newPass) {
            <div class="cp-hint error">Passwords don’t match</div>
          }
        </div>

        <div class="cp-actions">
          <button class="cp-cancel" (click)="cancel()">Cancel</button>
          <button class="cp-save" [disabled]="!canSubmit()" (click)="submit()">
            {{ saving() ? 'Updating…' : 'Update password' }}
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .cp-content { --background: var(--rm-bg); }
    .cp-hero { background: linear-gradient(160deg,#3D5AF1,#2A3FCC); padding: calc(env(safe-area-inset-top) + 14px) 16px 30px; display: flex; flex-direction: column; align-items: center; position: relative; }
    .cp-back { position: absolute; top: calc(env(safe-area-inset-top) + 14px); left: 16px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .cp-hero-icon { width: 68px; height: 68px; border-radius: 20px; border: 1px solid rgba(255,255,255,.30); background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; color: #fff; margin: 6px 0 14px; }
    .cp-title { font-size: 22px; font-weight: 900; color: #fff; font-family: 'Nunito', sans-serif; }
    .cp-sub   { font-size: 14px; color: rgba(255,255,255,.78); margin-top: 4px; }
    .cp-form { padding: 22px 16px; }
    .cp-section-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; color: var(--rm-text-muted); margin-bottom: 16px; }
    .cp-field { margin-bottom: 16px; }
    .cp-field label { font-size: 13px; font-weight: 600; color: var(--rm-text-secondary); display: block; margin-bottom: 6px; }
    .cp-input-wrap { position: relative; display: flex; align-items: center; }
    .cp-input-wrap.mismatch .cp-input { border-color: #EF4444; }
    .cp-input { width: 100%; height: 52px; padding: 0 48px 0 16px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: var(--rm-surface); font-size: 15px; color: var(--rm-text-primary); font-family: inherit; outline: none; transition: border-color .15s ease; }
    .cp-input:focus { border-color: var(--rm-purple); }
    .cp-eye { position: absolute; right: 8px; width: 36px; height: 36px; border: none; background: transparent; color: var(--rm-text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 10px; }
    .cp-eye:active { background: var(--rm-border); }
    .cp-strength { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .cp-strength-track { flex: 1; height: 6px; border-radius: 3px; background: var(--rm-border); overflow: hidden; }
    .cp-strength-fill { height: 100%; border-radius: 3px; transition: width .25s ease, background .25s ease; }
    .cp-strength-fill.lvl-weak   { background: #EF4444; }
    .cp-strength-fill.lvl-fair   { background: #F59E0B; }
    .cp-strength-fill.lvl-good   { background: #3B82F6; }
    .cp-strength-fill.lvl-strong { background: #16A34A; }
    .cp-strength-label { font-size: 12px; font-weight: 700; min-width: 48px; text-align: right; }
    .cp-strength-label.lvl-weak   { color: #EF4444; }
    .cp-strength-label.lvl-fair   { color: #F59E0B; }
    .cp-strength-label.lvl-good   { color: #3B82F6; }
    .cp-strength-label.lvl-strong { color: #16A34A; }
    .cp-hint { font-size: 12px; margin-top: 7px; }
    .cp-hint.error { color: #EF4444; }
    .cp-actions { display: flex; gap: 12px; margin-top: 26px; }
    .cp-cancel { flex: 1; height: 52px; border-radius: 14px; border: 1.5px solid var(--rm-border); background: transparent; font-size: 15px; font-weight: 700; color: var(--rm-text-primary); cursor: pointer; font-family: inherit; }
    .cp-save   { flex: 2; height: 52px; border-radius: 14px; border: none; background: var(--rm-purple); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity .15s ease; }
    .cp-save:disabled { opacity: .45; }
  `],
})
export class ChangePasswordComponent {
  protected nav     = inject(Router);
  private http      = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  current = '';
  newPass = '';
  confirm = '';
  readonly saving = signal(false);
  readonly show   = signal({ current: false, newPass: false, confirm: false });

  readonly strength = computed(() => {
    const p = this.newPass;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { level: 'weak',   label: 'Weak',   pct: 25 };
    if (score === 2) return { level: 'fair',   label: 'Fair',   pct: 50 };
    if (score === 3) return { level: 'good',   label: 'Good',   pct: 75 };
    return { level: 'strong', label: 'Strong', pct: 100 };
  });

  readonly canSubmit = computed(() =>
    !this.saving() &&
    this.current.length > 0 &&
    this.newPass.length >= 8 &&
    this.confirm === this.newPass
  );

  toggleShow(field: Field) {
    this.show.update(s => ({ ...s, [field]: !s[field] }));
  }

  cancel() {
    this.nav.navigate(['/app/settings']);
  }

  submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.http.patch<{ success: boolean; message: string }>(
      `${environment.apiUrl}/users/me/password`,
      { currentPassword: this.current, newPassword: this.newPass },
    ).subscribe({
      next: async () => {
        this.saving.set(false);
        await this.toast('Password updated successfully', 'success');
        this.nav.navigate(['/app/settings']);
      },
      error: async (err) => {
        this.saving.set(false);
        await this.toast(err?.error?.message || 'Could not update password', 'danger');
      },
    });
  }

  private async toast(message: string, color: 'success' | 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}
