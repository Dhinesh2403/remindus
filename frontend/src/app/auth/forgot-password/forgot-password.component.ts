// src/app/auth/forgot-password/forgot-password.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mailOutline, arrowBackOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
  template: `
    <ion-content class="login-content">
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">
            <ion-icon name="mail-outline" style="font-size:32px;color:white"></ion-icon>
          </div>
          <h1 class="login-title">Forgot Password?</h1>
          <p class="login-sub">Enter your email and we'll send a reset link</p>

          @if (!sent()) {
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <div class="form-group">
                <label class="form-label">Email</label>
                <div class="input-wrap">
                  <ion-icon name="mail-outline" class="input-icon"></ion-icon>
                  <input formControlName="email" class="form-input" type="email" placeholder="your@email.com" />
                </div>
              </div>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || loading()">
                @if (loading()) { <ion-spinner name="crescent" style="width:18px;height:18px;color:white"></ion-spinner> }
                @else { Send Reset Link }
              </button>
            </form>
          } @else {
            <div class="success-box">
              <div style="font-size:48px;text-align:center;margin-bottom:12px">📧</div>
              <p style="text-align:center;color:var(--rm-text-secondary)">Check your email for a password reset link. It expires in 1 hour.</p>
            </div>
          }

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
    .form-group { margin-bottom:16px; }
    .form-label { font-size:13px; font-weight:600; color:var(--rm-text-primary); display:block; margin-bottom:6px; }
    .input-wrap { position:relative; }
    .input-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--rm-text-muted); }
    .form-input { width:100%; padding:14px 16px 14px 44px; border:1.5px solid var(--rm-border); border-radius:14px; font-size:14px; outline:none; background:var(--rm-surface); color:var(--rm-text-primary); font-family:inherit; }
    .form-input:focus { border-color:var(--rm-purple); }
    .btn-primary { width:100%; padding:16px; background:linear-gradient(135deg,var(--rm-purple),#5B7CFF); color:white; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; margin-bottom:16px; }
    .btn-primary:disabled { opacity:.65; }
    .success-box { background:var(--rm-purple-light); border-radius:16px; padding:24px; margin-bottom:16px; }
    .login-footer { text-align:center; font-size:13px; }
    .login-footer a { color:var(--rm-purple); font-weight:700; text-decoration:none; }
  `],
})
export class ForgotPasswordComponent {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastCtrl  = inject(ToastController);

  loading = signal(false);
  sent    = signal(false);

  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });

  constructor() { addIcons({ mailOutline, arrowBackOutline }); }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.authService.forgotPassword(this.form.value.email!).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: () => { this.loading.set(false); this.sent.set(true); }, // always show success
    });
  }
}
