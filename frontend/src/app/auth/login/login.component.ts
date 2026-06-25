// src/app/auth/login/login.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { SocialAuthService } from '../../core/services/social-auth.service';
import { SafeHtmlPipe } from '../../core/pipes/safe-html.pipe';

interface LoginBadge { icon: string; label: string; color: string; }
interface LoginFeature { icon: string; title: string; body: string; color: string; soft: string; }
interface LoginAvatar { initials: string; color: string; }

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SafeHtmlPipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private social = inject(SocialAuthService);
  private toastCtrl = inject(ToastController);

  readonly isLoading = this.authService.isLoading;

  // Hides the marketing block and reveals the email/password form
  readonly showForm = signal(false);
  readonly showPassword = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  get email(): AbstractControl { return this.form.get('email')!; }
  get password(): AbstractControl { return this.form.get('password')!; }

  // ─── Static marketing content (mirrors the design) ────────────────────────
  readonly badges: LoginBadge[] = [
    {
      label: '4.9 rating', color: '#E0A92B',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 5.5L20 9.3l-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.8z"/></svg>`,
    },
    {
      label: 'Private', color: 'var(--sc-accent)',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
    },
    {
      label: 'Free to start', color: '#1AA06D',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
  ];

  readonly features: LoginFeature[] = [
    {
      title: 'Smart reminders', body: 'Habits, meds & bills — right on time.',
      color: 'var(--sc-accent)', soft: 'var(--sc-accent-soft)',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4a5 5 0 015 5c0 4 1.6 5 1.6 5H5.4S7 13 7 9a5 5 0 015-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.5 18a1.7 1.7 0 003 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    },
    {
      title: 'Share with friends', body: 'Assign tasks and keep lists in sync.',
      color: '#1AA06D', soft: 'var(--sc-success-soft)',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19a5.5 5.5 0 0111 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="17" cy="8" r="2.6" stroke="currentColor" stroke-width="1.7"/><path d="M16 13.5a5 5 0 014.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    },
    {
      title: 'Plan over chat', body: 'Turn a message into a task instantly.',
      color: '#E08A2B', soft: 'var(--sc-warn-soft)',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    },
  ];

  readonly avatars: LoginAvatar[] = [
    { initials: 'MI', color: '#E0699B' },
    { initials: 'DC', color: '#3DA3C9' },
    { initials: 'SK', color: '#7B61D8' },
    { initials: '+',  color: '#3257EE' },
  ];

  revealForm(): void {
    this.showForm.set(true);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  // Google sign-in. Web uses Google Identity Services (returns an access token);
  // native uses the Capacitor plugin (returns an ID token). The backend verifies
  // either. Requires environment.googleClientId on web.
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
      // User cancelled the Google chooser, or sign-in isn't fully set up.
      this.notify('Google sign-in was cancelled', 'medium');
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showForm.set(true);
      return;
    }

    const { email, password } = this.form.value;
    this.authService.login({ email: email!, password: password! }).subscribe({
      error: (err) =>
        this.notify(err?.error?.message || 'Login failed. Please try again.', 'danger'),
    });
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
