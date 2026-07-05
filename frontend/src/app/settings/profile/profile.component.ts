// src/app/settings/profile/profile.component.ts
import { Component, inject, computed, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';

/**
 * Single, self-contained Profile screen: view + edit in one place.
 *
 * Replaces the old Settings → Profile → Edit-Profile chain (three screens, three
 * "Edit" buttons, and an Edit page that couldn't even change the photo). The
 * avatar uploads to Cloudinary via AuthService.uploadAvatar (same flow Settings
 * uses); name/phone save via AuthService.updateProfile.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  protected nav = inject(Router);
  private auth  = inject(AuthService);
  private toastCtrl = inject(ToastController);

  readonly user = this.auth.currentUser;
  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  });

  // ── Edit state ──────────────────────────────────────────────────────────
  readonly editing        = signal(false);
  readonly saving         = signal(false);
  readonly uploadingPhoto = signal(false);
  name  = '';
  phone = '';

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  startEdit(): void {
    this.name  = this.user()?.name ?? '';
    this.phone = this.user()?.phone ?? '';
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    const name = this.name.trim();
    if (!name) { this.toast('Name cannot be empty', 'danger'); return; }
    this.saving.set(true);
    this.auth.updateProfile({ name, phone: this.phone.trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.toast('Profile updated', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.toast('Update failed', 'danger');
      },
    });
  }

  // ── Photo upload (Cloudinary) ───────────────────────────────────────────
  pickPhoto(): void {
    if (this.uploadingPhoto()) return;
    this.photoInput?.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) { this.toast('Please choose an image file', 'danger'); return; }
    if (file.size > 5 * 1024 * 1024)     { this.toast('Image must be under 5 MB', 'danger'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadingPhoto.set(true);
      this.auth.uploadAvatar(reader.result as string).subscribe({
        next: () => {
          this.uploadingPhoto.set(false);
          this.toast('Profile photo updated!', 'success');
        },
        error: (err) => {
          this.uploadingPhoto.set(false);
          this.toast(err?.error?.message || 'Upload failed', 'danger');
        },
      });
    };
    reader.onerror = () => this.toast('Could not read that image', 'danger');
    reader.readAsDataURL(file);
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'top' });
    await t.present();
  }
}
