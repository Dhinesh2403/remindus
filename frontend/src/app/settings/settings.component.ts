// src/app/settings/settings.component.ts
import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
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
  trashOutline, starOutline, cameraOutline, keyOutline,
  copyOutline, shareSocialOutline, notificationsOffOutline,
  alarmOutline, chatbubbleEllipsesOutline, personAddOutline,
  sparklesOutline, informationCircleOutline, cloudDownloadOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { ShareService } from '../core/services/share.service';
import { RatingService } from '../core/services/rating.service';
import { UpdateService } from '../core/services/update.service';
import { AppVersionService } from '../core/services/app-version.service';

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
          <div class="settings-sub">Customize your RemindUs experience</div>
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
        <div class="profile-row">
          <div class="profile-avatar" (click)="pickPhoto()">
            @if (user()?.avatar) {
              <img [src]="user()?.avatar" [alt]="user()?.name" class="avatar-img" />
            } @else {
              <ion-icon name="person-outline" style="font-size:26px;color:white"></ion-icon>
            }
            <div class="avatar-cam">
              @if (uploadingPhoto()) {
                <div class="cam-spinner"></div>
              } @else {
                <ion-icon name="camera-outline"></ion-icon>
              }
            </div>
          </div>
          <div class="profile-info">
            <div class="profile-name">{{ user()?.name ?? 'Loading...' }}</div>
            <div class="profile-email">{{ user()?.email }}</div>
          </div>
        </div>
        <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoSelected($event)" />

        <!-- Shareable friend code -->
        <div class="friendcode-row">
          <div class="row-icon" style="background:rgba(61,90,241,0.12);color:#3D5AF1">
            <ion-icon name="key-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Your Friend Code</div>
            <div class="row-code">{{ user()?.refId ?? '••••••••' }}</div>
          </div>
          <button class="code-btn" (click)="copyCode()" [disabled]="!user()?.refId" title="Copy">
            <ion-icon name="copy-outline"></ion-icon>
          </button>
          <button class="code-btn" (click)="shareCode()" [disabled]="!user()?.refId" title="Share">
            <ion-icon name="share-social-outline"></ion-icon>
          </button>
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

        <div class="settings-row premium-row">
          <div class="row-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6">
            <ion-icon name="mail-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Email Notifications</div>
            <div class="row-sub">Premium feature</div>
          </div>
          <span class="premium-badge">Premium</span>
          <button
            class="toggle"
            [class.toggle-on]="notifPrefs().email && user()?.isPremium"
            [disabled]="!user()?.isPremium"
            (click)="user()?.isPremium && toggleNotif('email')"
          ></button>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(61,90,241,0.12);color:#3D5AF1">
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

      <!-- Notification types — silence whole categories -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="notifications-off-outline"></ion-icon>
          What You Get Notified About
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(61,90,241,0.12);color:#3D5AF1">
            <ion-icon name="alarm-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Reminders</div>
            <div class="row-sub">Due, assigned & status updates</div>
          </div>
          <button class="toggle" [class.toggle-on]="notifTypes().reminders"
            (click)="toggleType('reminders')"></button>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6">
            <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Chat Messages</div>
            <div class="row-sub">New messages from friends</div>
          </div>
          <button class="toggle" [class.toggle-on]="notifTypes().chat"
            (click)="toggleType('chat')"></button>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(234,88,12,0.12);color:#EA580C">
            <ion-icon name="person-add-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Friend Requests</div>
            <div class="row-sub">Requests & acceptances</div>
          </div>
          <button class="toggle" [class.toggle-on]="notifTypes().friendRequests"
            (click)="toggleType('friendRequests')"></button>
        </div>

        <div class="settings-row">
          <div class="row-icon" style="background:rgba(107,114,128,0.12);color:#6B7280">
            <ion-icon name="sparkles-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Other & Future Updates</div>
            <div class="row-sub">System and upcoming features</div>
          </div>
          <button class="toggle" [class.toggle-on]="notifTypes().other"
            (click)="toggleType('other')"></button>
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

      <!-- About -->
      <div class="settings-section">
        <div class="section-label">
          <ion-icon name="information-circle-outline"></ion-icon>
          About
        </div>

        <div class="settings-row" (click)="rateApp()">
          <div class="row-icon" style="background:rgba(245,158,11,0.14);color:#F59E0B">
            <ion-icon name="star-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Rate RemindUs</div>
            <div class="row-sub">Enjoying the app? Leave a review</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </div>

        <div class="settings-row" (click)="checkUpdates()">
          <div class="row-icon" style="background:rgba(61,90,241,0.12);color:#3D5AF1">
            <ion-icon name="cloud-download-outline"></ion-icon>
          </div>
          <div class="row-text">
            <div class="row-title">Check for updates</div>
            <div class="row-sub">{{ checkingUpdate() ? 'Checking…' : 'Version ' + appVersionLabel() }}</div>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
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
      <div class="app-version">RemindUs v{{ appVersionLabel() }}</div>
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
    .profile-avatar { position: relative; width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,var(--rm-purple),#5B7CFF); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; cursor: pointer; }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-cam { position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--rm-purple); border: 2px solid var(--rm-card); display: flex; align-items: center; justify-content: center; }
    .avatar-cam ion-icon { font-size: 11px; color: #fff; }
    .cam-spinner { width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* Friend code */
    .friendcode-row { display: flex; align-items: center; padding: 14px 16px; border-top: 1px solid var(--rm-border); gap: 12px; }
    .row-code { font-size: 16px; font-weight: 800; color: var(--rm-purple); letter-spacing: 2px; font-family: 'Courier New', monospace; margin-top: 2px; }
    .code-btn { width: 36px; height: 36px; border: none; border-radius: 10px; background: var(--rm-surface); color: var(--rm-purple); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
    .code-btn ion-icon { font-size: 17px; pointer-events: none; }
    .code-btn:disabled { opacity: 0.5; }
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
  private shareService = inject(ShareService);
  private ratingService = inject(RatingService);
  private updateService = inject(UpdateService);
  private appVersion    = inject(AppVersionService);
  private alertCtrl   = inject(AlertController);
  private toastCtrl   = inject(ToastController);

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  user          = this.authService.currentUser;
  activeTheme   = signal<ThemeMode>('light');
  twoFAEnabled  = signal(false);
  uploadingPhoto = signal(false);
  appVersionLabel = signal('1.0.0');
  checkingUpdate  = signal(false);
  notifPrefs    = signal({ email: true, push: true, sms: false, whatsapp: false });
  notifTypes    = signal({ reminders: true, chat: true, friendRequests: true, other: true });

  constructor() {
    addIcons({
      personOutline, colorPaletteOutline, notificationsOutline,
      shieldOutline, lockClosedOutline, logOutOutline,
      chevronForwardOutline, mailOutline, phonePortraitOutline,
      logoWhatsapp, sunnyOutline, moonOutline, desktopOutline,
      trashOutline, starOutline, cameraOutline, keyOutline,
      copyOutline, shareSocialOutline, notificationsOffOutline,
      alarmOutline, chatbubbleEllipsesOutline, personAddOutline,
      sparklesOutline, informationCircleOutline, cloudDownloadOutline,
    });
  }

  ngOnInit() {
    this.appVersion.getInfo().then((i) => this.appVersionLabel.set(i.versionName));
    const saved = localStorage.getItem('rm_theme') as ThemeMode ?? 'light';
    this.activeTheme.set(saved);
    const prefs = this.user()?.notifPrefs;
    if (prefs) this.notifPrefs.set({ email: prefs.email ?? true, push: prefs.push ?? true, sms: prefs.sms ?? false, whatsapp: prefs.whatsapp ?? false });
    const types = this.user()?.notifTypes;
    if (types) this.notifTypes.set({
      reminders:      types.reminders ?? true,
      chat:           types.chat ?? true,
      friendRequests: types.friendRequests ?? true,
      other:          types.other ?? true,
    });
  }

  setTheme(mode: ThemeMode) {
    this.activeTheme.set(mode);
    this.themeService.apply(mode);
    localStorage.setItem('rm_theme', mode);
  }

  toggleNotif(key: 'email' | 'push' | 'sms' | 'whatsapp') {
    this.notifPrefs.update(p => ({ ...p, [key]: !p[key] }));
    this.authService.updateNotifPrefs({ notifPrefs: this.notifPrefs() }).subscribe({
      error: () => {
        // Revert on failure so the UI stays truthful.
        this.notifPrefs.update(p => ({ ...p, [key]: !p[key] }));
        this.showToast('Could not save preference', 'danger');
      },
    });
  }

  toggleType(key: 'reminders' | 'chat' | 'friendRequests' | 'other') {
    this.notifTypes.update(t => ({ ...t, [key]: !t[key] }));
    this.authService.updateNotifPrefs({ notifTypes: this.notifTypes() }).subscribe({
      error: () => {
        this.notifTypes.update(t => ({ ...t, [key]: !t[key] }));
        this.showToast('Could not save preference', 'danger');
      },
    });
  }

  toggle2FA() { this.twoFAEnabled.update(v => !v); }

  pickPhoto() {
    if (this.uploadingPhoto()) return;
    this.photoInput?.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';   // allow re-picking the same file later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Please choose an image file', 'danger');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image must be under 5 MB', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      this.uploadingPhoto.set(true);
      this.authService.uploadAvatar(dataUri).subscribe({
        next: () => {
          this.uploadingPhoto.set(false);
          this.showToast('Profile photo updated!', 'success');
        },
        error: (err) => {
          this.uploadingPhoto.set(false);
          this.showToast(err?.error?.message || 'Upload failed', 'danger');
        },
      });
    };
    reader.onerror = () => this.showToast('Could not read that image', 'danger');
    reader.readAsDataURL(file);
  }

  async copyCode() {
    const code = this.user()?.refId;
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    this.showToast('Friend code copied!', 'success');
  }

  async shareCode() {
    const code = this.user()?.refId;
    if (!code) return;
    const outcome = await this.shareService.shareRefId(code);
    if (outcome === 'failed') return;
    this.showToast(outcome === 'copied' ? 'Invite copied to clipboard!' : 'Thanks for sharing!', 'success');
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'top' });
    t.present();
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

  // ─── About ────────────────────────────────────────────────────────────────
  rateApp() {
    this.ratingService.promptNow();
  }

  async checkUpdates() {
    if (this.checkingUpdate()) return;
    this.checkingUpdate.set(true);
    const res = await this.updateService.check();
    this.checkingUpdate.set(false);

    if (!res) {
      const t = await this.toastCtrl.create({ message: 'Couldn\'t reach the server. Try again later.', duration: 2500, color: 'dark' });
      await t.present();
      return;
    }
    if (res.updateAvailable || res.forceUpdate) {
      const alert = await this.alertCtrl.create({
        header: 'Update available',
        message: res.message,
        buttons: [
          { text: 'Later', role: 'cancel' },
          { text: 'Update', handler: () => this.updateService.openStore() },
        ],
      });
      await alert.present();
    } else {
      const t = await this.toastCtrl.create({ message: 'You\'re on the latest version 🎉', duration: 2000, color: 'success' });
      await t.present();
    }
  }
}
