// src/app/settings/settings.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonIcon, IonToggle,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline, colorPaletteOutline, notificationsOutline,
  shieldOutline, lockClosedOutline, logOutOutline,
  chevronForwardOutline, mailOutline, phonePortraitOutline,
  logoWhatsapp, sunnyOutline, moonOutline, desktopOutline,
  trashOutline, starOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

type ThemeMode = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonIcon, IonToggle,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="settings-header">
          <div class="settings-title">Settings</div>
          <div class="settings-sub">Customize your RemindMe experience</div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="settings-content">

      <!-- Profile section -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="person-outline"></ion-icon>
          Profile
        </div>
        <div class="profile-row" (click)="editProfile()">
          <div class="profile-avatar">
            @if (user()?.avatar) {
              <img [src]="user()?.avatar" [alt]="user()?.name" class="avatar-img" />
            } @else {
              <ion-icon name="person-outline" style="font-size:26px;color:white"></ion-icon>
            }
          </div>
          <div class="profile-info">
            <div class="profile-name">{{ user()?.name ?? 'Loading...' }}</div>
            <div class="profile-email">{{ user()?.email }}</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </div>

        @if (user()?.isPremium) {
          <div class="premium-banner">
            <span>⭐</span>
            <span>Premium Member</span>
          </div>
        } @else {
          <div class="upgrade-banner" (click)="goToPremium()">
            <span>✨ Upgrade to Premium</span>
            <span class="upgrade-arrow">→</span>
          </div>
        }
      </div>

      <!-- Appearance -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="color-palette-outline"></ion-icon>
          Appearance
        </div>
        <div class="theme-options">
          <button
            class="theme-btn"
            [class.active]="activeTheme() === 'light'"
            (click)="setTheme('light')"
          >
            <ion-icon name="sunny-outline"></ion-icon>
            Light
          </button>
          <button
            class="theme-btn"
            [class.active]="activeTheme() === 'dark'"
            (click)="setTheme('dark')"
          >
            <ion-icon name="moon-outline"></ion-icon>
            Dark
          </button>
          <button
            class="theme-btn"
            [class.active]="activeTheme() === 'system'"
            (click)="setTheme('system')"
          >
            <ion-icon name="desktop-outline"></ion-icon>
            System
          </button>
        </div>
      </div>

      <!-- Notification preferences -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="notifications-outline"></ion-icon>
          Notification Preferences
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6">
            <ion-icon name="mail-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Email Notifications</div>
            <div class="row-sub">Receive reminders via email</div>
          </div>
          <button
            class="toggle"
            [class.toggle-on]="notifPrefs().email"
            (click)="toggleNotif('email')"
          ></button>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(124,58,237,0.12);color:#7C3AED">
            <ion-icon name="phone-portrait-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Push Notifications</div>
            <div class="row-sub">Browser and mobile alerts</div>
          </div>
          <button
            class="toggle"
            [class.toggle-on]="notifPrefs().push"
            (click)="toggleNotif('push')"
          ></button>
        </div>

        <div class="settings-row premium-row">
          <div class="row-icon" style="background:rgba(22,163,74,0.12);color:#16A34A">
            <ion-icon name="logo-whatsapp"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">WhatsApp Notifications</div>
            <div class="row-sub">Premium feature</div>
          </div>
          <span class="premium-badge">Premium</span>
          <button
            class="toggle"
            [class.toggle-on]="notifPrefs().whatsapp && user()?.isPremium"
            [disabled]="!user()?.isPremium"
            (click)="user()?.isPremium && toggleNotif('whatsapp')"
          ></button>
        </div>
      </div>

      <!-- Privacy & Security -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="shield-outline"></ion-icon>
          Privacy & Security
        </div>

        <div class="settings-row" (click)="changePassword()">
          <div class="row-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">
            <ion-icon name="lock-closed-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Change Password</div>
            <div class="row-sub">Update your credentials</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B">
            <ion-icon name="shield-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Two-Factor Auth</div>
            <div class="row-sub">Extra security layer</div>
          </div>
          <button
            class="toggle"
            [class.toggle-on]="twoFAEnabled()"
            (click)="toggle2FA()"
          ></button>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="settings-section danger-section">
        <div class="settings-row" (click)="logout()">
          <div class="row-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">
            <ion-icon name="log-out-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title" style="color:#EF4444">Sign Out</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </div>

        <div class="settings-row" (click)="deleteAccount()">
          <div class="row-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">
            <ion-icon name="trash-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title" style="color:#EF4444">Delete Account</div>
            <div class="row-sub">This action cannot be undone</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </div>
      </div>

      <!-- App version -->
      <div class="app-version">RemindMe Buddy v1.0.0</div>
      <div style="height:24px"></div>

    </ion-content>
  `,
  styles: [`
    .settings-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-bg); }
    .settings-header { padding: 20px 16px 4px; }
    .settings-title { font-size: 28px; font-weight: 900; color: var(--rm-text-primary); }
    .settings-sub { font-size: 13px; color: var(--rm-text-secondary); margin-top: 4px; }

    .settings-section { background: var(--rm-card); border-radius: 20px; margin: 12px 16px 0; box-shadow: var(--rm-shadow-sm); overflow: hidden; }
    .section-label { font-size: 14px; font-weight: 800; color: var(--rm-text-secondary); padding: 16px 16px 8px; display: flex; align-items: center; gap: 8px; }
    .section-label ion-icon { font-size: 17px; color: var(--rm-purple); }

    /* Profile */
    .profile-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px 16px; cursor: pointer; }
    .profile-avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,var(--rm-purple),#9333EA); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .profile-info { flex: 1; }
    .profile-name { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); }
    .profile-email { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .premium-banner { display: flex; align-items: center; gap: 8px; padding: 10px 16px 14px; font-size: 13px; font-weight: 700; color: #D97706; }
    .upgrade-banner { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 14px; font-size: 13px; font-weight: 700; color: var(--rm-purple); cursor: pointer; background: var(--rm-purple-light); border-top: 1px solid var(--rm-border); }

    /* Appearance */
    .theme-options { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 8px 16px 16px; }
    .theme-btn { padding: 14px 8px; border-radius: 14px; border: 2px solid var(--rm-border); background: var(--rm-surface); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--rm-text-secondary); font-weight: 600; transition: all .2s; font-family: inherit; }
    .theme-btn ion-icon { font-size: 22px; }
    .theme-btn.active { border-color: var(--rm-purple); color: var(--rm-purple); background: var(--rm-purple-light); }

    /* Rows */
    .settings-row { display: flex; align-items: center; padding: 14px 16px; border-top: 1px solid var(--rm-border); gap: 12px; cursor: pointer; }
    .row-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .row-icon ion-icon { font-size: 18px; }
    .row-text { flex: 1; }
    .row-title { font-size: 14px; font-weight: 600; color: var(--rm-text-primary); }
    .row-sub { font-size: 12px; color: var(--rm-text-muted); margin-top: 1px; }
    .chevron { color: var(--rm-text-muted); font-size: 16px; }

    /* Toggle */
    .toggle { width: 46px; height: 26px; border-radius: 13px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; background: #D1D5DB; }
    .toggle::after { content: ''; width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: left .2s; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
    .toggle.toggle-on { background: var(--rm-purple); }
    .toggle.toggle-on::after { left: 23px; }
    .toggle:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Premium row */
    .premium-row { background: rgba(22,163,74,0.08); }
    .premium-badge { padding: 4px 10px; background: #F59E0B; color: white; border-radius: 20px; font-size: 11px; font-weight: 700; flex-shrink: 0; }

    /* Danger */
    .danger-section { margin-top: 12px; }

    /* App version */
    .app-version { text-align: center; font-size: 12px; color: var(--rm-text-muted); padding: 16px; }
  `],
})
export class SettingsComponent implements OnInit {
  private authService  = inject(AuthService);
  private themeService = inject(ThemeService);
  private alertCtrl   = inject(AlertController);
  private toastCtrl   = inject(ToastController);

  user        = this.authService.currentUser;
  activeTheme = signal<ThemeMode>('light');
  twoFAEnabled = signal(false);
  notifPrefs   = signal({ email: true, push: true, sms: false, whatsapp: false });

  constructor() {
    addIcons({
      personOutline, colorPaletteOutline, notificationsOutline,
      shieldOutline, lockClosedOutline, logOutOutline,
      chevronForwardOutline, mailOutline, phonePortraitOutline,
      logoWhatsapp, sunnyOutline, moonOutline, desktopOutline,
      trashOutline, starOutline,
    });
  }

  ngOnInit() {
    const saved = localStorage.getItem('rm_theme') as ThemeMode ?? 'light';
    this.activeTheme.set(saved);
    const prefs = this.user()?.notifPrefs;
    if (prefs) this.notifPrefs.set({ email: prefs.email || true, push: prefs.push || true, sms: prefs.sms || false, whatsapp: prefs.whatsapp || false });
  }

  setTheme(mode: ThemeMode) {
    this.activeTheme.set(mode);
    this.themeService.apply(mode);
    localStorage.setItem('rm_theme', mode);
  }

  toggleNotif(key: 'email' | 'push' | 'sms' | 'whatsapp') {
    this.notifPrefs.update(p => ({ ...p, [key]: !p[key] }));
    // TODO: call UserService.updateNotifPrefs(this.notifPrefs())
  }

  toggle2FA() { this.twoFAEnabled.update(v => !v); }

  editProfile() {
    // Navigate to profile edit page
    console.log('Edit profile');
  }

  goToPremium() {
    // Navigate to premium upgrade
    console.log('Go to premium');
  }

  async changePassword() {
    const alert = await this.alertCtrl.create({
      header: 'Change Password',
      inputs: [
        { name: 'current',  type: 'password', placeholder: 'Current password' },
        { name: 'newPass',  type: 'password', placeholder: 'New password (min 8 chars)' },
        { name: 'confirm',  type: 'password', placeholder: 'Confirm new password' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: async (data) => {
            if (data.newPass !== data.confirm) {
              const t = await this.toastCtrl.create({ message: 'Passwords do not match', duration: 2000, color: 'danger', position: 'top' });
              t.present(); return false;
            }
            // TODO: call UserService.changePassword(data.current, data.newPass)
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign Out', role: 'destructive', handler: () => this.authService.logout() },
      ],
    });
    await alert.present();
  }

  async deleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account',
      message: 'This will permanently delete all your data. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            // TODO: call UserService.deleteAccount() then logout
            console.log('Delete account');
          },
        },
      ],
    });
    await alert.present();
  }
}
