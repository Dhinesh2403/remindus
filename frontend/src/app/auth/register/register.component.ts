// src/app/auth/register/register.component.ts
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { SocialAuthService } from '../../core/services/social-auth.service';

type Step = 'details' | 'otp' | 'password';

/**
 * Email signup, OTP-first:
 *   1. details   — name + email           → backend emails a 6-digit code
 *   2. otp       — verify the code         → backend returns a setup token
 *   3. password  — set a password          → account created + logged in
 *
 * Google sign-up is offered as a one-tap shortcut at the top of step 1.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private social = inject(SocialAuthService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  readonly step = signal<Step>('details');
  readonly busy = signal(false);               // start / verify / resend
  readonly isLoading = this.authService.isLoading; // final set-password call
  readonly showPassword = signal(false);

  private email = '';
  private setupToken = '';

  readonly stepTitle = computed(() => ({
    details:  'Create your account',
    otp:      'Verify your email',
    password: 'Set a password',
  }[this.step()]));

  readonly stepSub = computed(() => ({
    details:  'Tell us who you are to get started.',
    otp:      `Enter the 6-digit code we sent to ${this.email}.`,
    password: 'Last step — choose a password to secure your account.',
  }[this.step()]));

  detailsForm = this.fb.group({
    name:  ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm = this.fb.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  passwordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm:  ['', [Validators.required]],
  });

  get name(): AbstractControl { return this.detailsForm.get('name')!; }
  get emailCtrl(): AbstractControl { return this.detailsForm.get('email')!; }
  get otp(): AbstractControl { return this.otpForm.get('otp')!; }
  get password(): AbstractControl { return this.passwordForm.get('password')!; }
  get confirm(): AbstractControl { return this.passwordForm.get('confirm')!; }

  get passwordsMatch(): boolean {
    return this.password.value === this.confirm.value;
  }

  // ─── Step 1: name + email → send OTP ──────────────────────────────────────
  submitDetails(): void {
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    const { name, email } = this.detailsForm.value;
    this.authService.signupStart(name!, email!).subscribe({
      next: () => {
        this.busy.set(false);
        this.email = email!;
        this.step.set('otp');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.message || 'Could not start signup', 'danger');
      },
    });
  }

  // ─── Step 2: verify OTP → get setup token ─────────────────────────────────
  submitOtp(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.authService.signupVerify(this.email, this.otp.value!).subscribe({
      next: ({ setupToken }) => {
        this.busy.set(false);
        this.setupToken = setupToken;
        this.step.set('password');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.message || 'Invalid or expired code', 'danger');
      },
    });
  }

  // Pull a 6-digit code straight from the clipboard so users can paste the
  // code from their email in one tap instead of typing it.
  async pasteOtp(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const code = (text.match(/\d/g) || []).join('').slice(0, 6);
      if (code.length === 6) {
        this.otp.setValue(code);
        this.otp.markAsTouched();
        this.notify('Code pasted', 'success');
      } else {
        this.notify('No 6-digit code found on your clipboard', 'medium');
      }
    } catch {
      this.notify("Couldn't read the clipboard — please paste the code manually", 'medium');
    }
  }

  resendOtp(): void {
    this.busy.set(true);
    this.authService.signupResend(this.email).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify('A new code is on its way', 'success');
      },
      error: (err) => {
        this.busy.set(false);
        this.notify(err?.error?.message || 'Could not resend code', 'danger');
      },
    });
  }

  // ─── Step 3: set password → create account + log in ───────────────────────
  submitPassword(): void {
    if (this.passwordForm.invalid || !this.passwordsMatch) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.authService.signupSetPassword(this.setupToken, this.password.value!).subscribe({
      next: () => this.router.navigateByUrl('/onboarding'),
      error: (err) =>
        this.notify(err?.error?.message || 'Could not finish signup', 'danger'),
    });
  }

  async onGoogle(): Promise<void> {
    if (!this.social.isConfigured) {
      this.notify('Google sign-in is not configured yet', 'medium');
      return;
    }

    try {
      const cred = await this.social.signInWithGoogle();
      this.authService.googleLogin(cred).subscribe({
        error: (err) =>
          this.notify(err?.error?.message || 'Google sign-in failed', 'danger'),
      });
    } catch {
      this.notify('Google sign-in was cancelled', 'medium');
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  back(): void {
    if (this.step() === 'otp') this.step.set('details');
    else if (this.step() === 'password') this.step.set('otp');
  }

  private async notify(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
