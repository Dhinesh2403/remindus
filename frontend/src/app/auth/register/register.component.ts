// src/app/auth/register/register.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent, IonIcon, IonSpinner, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
  template: `
    <ion-content class="login-content">
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo-wrap">
            <img src="assets/logo.svg" alt="RemindMe Buddy" class="login-logo-img" />
          </div>
          <h1 class="login-title">Create Account</h1>
          <p class="login-sub">Start holding yourself accountable</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <div class="input-wrap">
                <ion-icon name="person-outline" class="input-icon"></ion-icon>
                <input formControlName="name" class="form-input" type="text" placeholder="Alex Johnson" />
              </div>
              @if (f['name'].invalid && f['name'].touched) {
                <span class="field-error">Name is required</span>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <div class="input-wrap">
                <ion-icon name="mail-outline" class="input-icon"></ion-icon>
                <input formControlName="email" class="form-input" type="email" placeholder="your@email.com" />
              </div>
              @if (f['email'].invalid && f['email'].touched) {
                <span class="field-error">Enter a valid email</span>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="input-wrap">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <input formControlName="password" [type]="showPwd() ? 'text' : 'password'" class="form-input" placeholder="Min 8 characters" />
                <button type="button" class="password-toggle" (click)="togglePassword()">
                  <ion-icon [name]="showPwd() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                </button>
              </div>
              @if (f['password'].invalid && f['password'].touched) {
                <span class="field-error">Password must be at least 8 characters</span>
              }
            </div>
            <button type="submit" class="btn-primary" [disabled]="form.invalid || isLoading()">
              @if (isLoading()) { <ion-spinner name="crescent" style="width:18px;height:18px;color:white"></ion-spinner> }
              @else { Create Account }
            </button>
          </form>

          <p class="login-footer">Already have an account? <a routerLink="/auth/login">Sign in</a></p>
        </div>
      </div>
    </ion-content>`,
  styles: [`
    .login-content { --background: linear-gradient(160deg,#F0ECFF 0%,#E8F0FF 100%); }
    .login-bg { min-height:100%; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
    .login-card { background:var(--rm-card); border-radius:28px; padding:36px 24px; width:100%; max-width:340px; box-shadow:0 4px 16px rgba(124,58,237,0.1); }
    .login-logo-wrap { display:flex; justify-content:center; margin:0 auto 20px; }
    .login-logo-img { width:200px; height:auto; }
    .login-title { font-size:26px; font-weight:800; color:var(--rm-purple); text-align:center; margin-bottom:6px; }
    .login-sub { color:var(--rm-text-secondary); text-align:center; font-size:14px; margin-bottom:28px; }
    .form-group { margin-bottom:16px; }
    .form-label { font-size:13px; font-weight:600; color:var(--rm-text-primary); display:block; margin-bottom:6px; }
    .input-wrap { position:relative; }
    .input-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--rm-text-muted); }
    .form-input { width:100%; padding:14px 16px 14px 44px; border:1.5px solid var(--rm-border); border-radius:14px; font-size:14px; outline:none; background:var(--rm-surface); color:var(--rm-text-primary); font-family:inherit; }
    .form-input:focus { border-color:var(--rm-purple); background:var(--rm-surface); }
    .password-toggle { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--rm-text-muted); font-size:18px; }
    .field-error { font-size:12px; color:var(--rm-danger); margin-top:4px; display:block; }
    .btn-primary { width:100%; padding:16px; background:linear-gradient(135deg,var(--rm-purple),#9333EA); color:white; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; box-shadow:0 4px 16px rgba(124,58,237,0.35); margin-bottom:16px; }
    .btn-primary:disabled { opacity:.65; }
    .login-footer { text-align:center; font-size:13px; color:var(--rm-text-secondary); }
    .login-footer a { color:var(--rm-purple); font-weight:700; text-decoration:none; }
  `],
})
export class RegisterComponent {
  private fb        = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);

  showPwd   = signal(false);
  isLoading = this.authService.isLoading;

  form = this.fb.group({
    name:     ['', [Validators.required, Validators.maxLength(100)]],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  get f() { return this.form.controls; }

  constructor() { addIcons({ personOutline, mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline }); }

  togglePassword(): void {
    this.showPwd.update(v => !v);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { name, email, password } = this.form.value;
    this.authService.register({ name: name!, email: email!, password: password! }).subscribe({
      error: async (err) => {
        const t = await this.toastCtrl.create({ message: err?.error?.message || 'Registration failed', duration: 3000, color: 'danger', position: 'top' });
        t.present();
      },
    });
  }
}
