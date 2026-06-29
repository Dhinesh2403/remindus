// src/app/auth/otp/otp.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
  template: `
    <ion-content class="login-content">
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">
            <ion-icon name="shield-checkmark-outline" style="font-size:32px;color:white"></ion-icon>
          </div>
          <h1 class="login-title">Verify OTP</h1>
          <p class="login-sub">Enter the 6-digit code sent to your email</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">OTP Code</label>
              <input formControlName="otp" class="otp-input" type="text"
                     placeholder="000000" maxlength="6" inputmode="numeric" />
              @if (f['otp'].invalid && f['otp'].touched) {
                <span class="field-error">Enter the 6-digit code</span>
              }
            </div>
            <button type="submit" class="btn-primary" [disabled]="form.invalid || loading()">
              @if (loading()) { <ion-spinner name="crescent" style="width:18px;height:18px;color:white"></ion-spinner> }
              @else { Verify }
            </button>
          </form>

          <p class="login-footer"><a routerLink="/auth/login">← Back to Sign In</a></p>
        </div>
      </div>
    </ion-content>`,
  styles: [`
    .login-content { --background: linear-gradient(160deg,#F0ECFF 0%,#E8F0FF 100%); }
    .login-bg { min-height:100%; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
    .login-card { background:var(--rm-card); border-radius:28px; padding:36px 24px; width:100%; max-width:340px; box-shadow:0 4px 16px rgba(61,90,241,0.1); }
    .login-logo { width:64px; height:64px; background:var(--rm-purple); border-radius:20px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
    .login-title { font-size:24px; font-weight:800; color:var(--rm-purple); text-align:center; margin-bottom:6px; }
    .login-sub { color:var(--rm-text-secondary); text-align:center; font-size:14px; margin-bottom:28px; }
    .form-group { margin-bottom:20px; }
    .form-label { font-size:13px; font-weight:600; color:var(--rm-text-primary); display:block; margin-bottom:8px; }
    .otp-input { width:100%; padding:18px; border:1.5px solid var(--rm-border); border-radius:14px; font-size:28px; font-weight:800; text-align:center; letter-spacing:12px; outline:none; background:var(--rm-surface); font-family:inherit; color:var(--rm-purple); }
    .otp-input:focus { border-color:var(--rm-purple); background:var(--rm-surface); }
    .field-error { font-size:12px; color:var(--rm-danger); margin-top:4px; display:block; }
    .btn-primary { width:100%; padding:16px; background:linear-gradient(135deg,var(--rm-purple),#5B7CFF); color:white; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; margin-bottom:16px; }
    .btn-primary:disabled { opacity:.65; }
    .login-footer { text-align:center; font-size:13px; }
    .login-footer a { color:var(--rm-purple); font-weight:700; text-decoration:none; }
  `],
})
export class OtpComponent {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private toastCtrl  = inject(ToastController);

  loading = signal(false);
  form = this.fb.group({ otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]] });
  get f() { return this.form.controls; }

  constructor() { addIcons({ shieldCheckmarkOutline }); }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const email = localStorage.getItem('rm_pending_email') ?? '';
    this.authService.verifyOtp(email, this.form.value.otp!).subscribe({
      next: async () => {
        this.loading.set(false);
        const t = await this.toastCtrl.create({ message: '✅ Email verified!', duration: 2000, color: 'success', position: 'top' });
        t.present();
        this.router.navigate(['/app/home']);
      },
      error: async () => {
        this.loading.set(false);
        const t = await this.toastCtrl.create({ message: 'Invalid or expired OTP', duration: 3000, color: 'danger', position: 'top' });
        t.present();
      },
    });
  }
}
