// src/app/auth/set-password/set-password.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, personOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

/**
 * One-time password setup for accounts created via Google. Google sign-up is
 * passwordless; setting a password here lets the user also sign in with email.
 * Returning Google users never reach this screen — the backend only sets the
 * `needsPassword` flag on the first sign-in.
 */
@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonIcon, IonSpinner],
  template: `
    <ion-content class="login-content">
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">
            <ion-icon name="lock-closed-outline" style="font-size:30px;color:white"></ion-icon>
          </div>
          <h1 class="login-title">Set a password</h1>
          <p class="login-sub">
            You signed in with Google. Add a password so you can also log in with
            your email next time.
          </p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Name</label>
              <div class="input-wrap">
                <ion-icon name="person-outline" class="input-icon"></ion-icon>
                <input formControlName="name" class="form-input" type="text" placeholder="Your name" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <div class="input-wrap">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <input formControlName="password" class="form-input"
                       [type]="show() ? 'text' : 'password'" placeholder="At least 8 characters" />
                <button type="button" class="input-toggle" (click)="show.set(!show())">
                  <ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                </button>
              </div>
              @if (password.invalid && password.touched) {
                <span class="form-error">Password must be at least 8 characters</span>
              }
            </div>

            <div class="form-group">
              <label class="form-label">Confirm password</label>
              <div class="input-wrap">
                <ion-icon name="lock-closed-outline" class="input-icon"></ion-icon>
                <input formControlName="confirm" class="form-input"
                       [type]="show() ? 'text' : 'password'" placeholder="Re-enter password" />
              </div>
              @if (confirm.touched && !passwordsMatch) {
                <span class="form-error">Passwords don't match</span>
              }
            </div>

            <button type="submit" class="btn-primary"
                    [disabled]="form.invalid || !passwordsMatch || isLoading()">
              @if (isLoading()) {
                <ion-spinner name="crescent" style="width:18px;height:18px;color:white"></ion-spinner>
              } @else {
                Save &amp; continue
              }
            </button>
          </form>
        </div>
      </div>
    </ion-content>`,
  styles: [`
    .login-content { --background: linear-gradient(160deg,#F0ECFF 0%,#E8F0FF 100%); }
    .login-bg { min-height:100%; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
    .login-card { background:var(--rm-card); border-radius:28px; padding:36px 24px; width:100%; max-width:340px; box-shadow:0 4px 16px rgba(61,90,241,0.1); }
    .login-logo { width:64px; height:64px; background:var(--rm-purple); border-radius:20px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
    .login-title { font-size:24px; font-weight:800; color:var(--rm-purple); text-align:center; margin-bottom:6px; }
    .login-sub { color:var(--rm-text-secondary); text-align:center; font-size:14px; margin-bottom:28px; line-height:1.5; }
    .form-group { margin-bottom:16px; }
    .form-label { font-size:13px; font-weight:600; color:var(--rm-text-primary); display:block; margin-bottom:6px; }
    .input-wrap { position:relative; }
    .input-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--rm-text-muted); }
    .input-toggle { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--rm-text-muted); font-size:18px; cursor:pointer; display:flex; padding:4px; }
    .form-input { width:100%; padding:14px 40px 14px 44px; border:1.5px solid var(--rm-border); border-radius:14px; font-size:14px; outline:none; background:var(--rm-surface); color:var(--rm-text-primary); font-family:inherit; }
    .form-input:focus { border-color:var(--rm-purple); }
    .form-error { display:block; margin-top:6px; font-size:12px; color:#E5484D; }
    .btn-primary { width:100%; padding:16px; background:linear-gradient(135deg,var(--rm-purple),#5B7CFF); color:white; border:none; border-radius:14px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; margin-top:4px; }
    .btn-primary:disabled { opacity:.65; }
  `],
})
export class SetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);

  readonly isLoading = this.authService.isLoading;
  readonly show = signal(false);

  form = this.fb.group({
    name: [
      this.authService.currentUser()?.name ?? '',
      [Validators.required, Validators.maxLength(100)],
    ],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  get password(): AbstractControl { return this.form.get('password')!; }
  get confirm(): AbstractControl { return this.form.get('confirm')!; }
  get passwordsMatch(): boolean { return this.password.value === this.confirm.value; }

  constructor() {
    addIcons({ lockClosedOutline, personOutline, eyeOutline, eyeOffOutline });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.passwordsMatch) {
      this.form.markAllAsTouched();
      return;
    }
    this.authService
      .setInitialPassword(this.password.value!, this.form.value.name!)
      .subscribe({
        error: (err) =>
          this.notify(err?.error?.message || 'Could not set password', 'danger'),
      });
  }

  private async notify(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message, duration: 3000, color, position: 'top',
    });
    await toast.present();
  }
}
