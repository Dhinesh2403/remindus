// src/app/reminders/create/reminder-create.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonButton, IonIcon, IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import {
  ReminderService, CreateReminderDto,
  ReminderType, RepeatType, Priority, NotificationType,
} from '../../core/services/reminder.service';
import { AuthService } from '../../core/services/auth.service';

interface CategoryOption { type: ReminderType; emoji: string; label: string; color: string }
interface RepeatOption   { value: RepeatType; label: string }
interface PriorityOption { value: Priority; label: string; color: string }

@Component({
  selector: 'app-reminder-create',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonIcon, IonSpinner,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/app/reminders" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>New Reminder</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="submit()" [disabled]="form.invalid || saving()">
            @if (saving()) {
              <ion-spinner name="crescent" style="width:18px;height:18px"></ion-spinner>
            } @else {
              <ion-icon name="checkmark-outline" slot="icon-only" style="color:var(--rm-purple)"></ion-icon>
            }
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="create-content">
      <form [formGroup]="form" class="create-form">

        <!-- Title -->
        <div class="form-section">
          <label class="form-label">Title *</label>
          <input
            formControlName="title"
            class="form-input"
            placeholder="e.g. Mom's Birthday"
            maxlength="100"
          />
          @if (f['title'].invalid && f['title'].touched) {
            <span class="field-error">Title is required</span>
          }
        </div>

        <!-- Description -->
        <div class="form-section">
          <label class="form-label">Description</label>
          <textarea
            formControlName="description"
            class="form-input form-textarea"
            placeholder="Optional details..."
            rows="3"
          ></textarea>
        </div>

        <!-- Category -->
        <div class="form-section">
          <label class="form-label">Category</label>
          <div class="category-grid">
            @for (cat of categories; track cat.type) {
              <div
                class="cat-chip"
                [class.active]="f['type'].value === cat.type"
                [style.border-color]="f['type'].value === cat.type ? cat.color : 'transparent'"
                [style.background]="f['type'].value === cat.type ? cat.color + '18' : 'var(--rm-surface)'"
                (click)="form.get('type')?.setValue(cat.type)"
              >
                <span class="cat-emoji">{{ cat.emoji }}</span>
                <span class="cat-label" [style.color]="f['type'].value === cat.type ? cat.color : 'var(--rm-text-secondary)'">
                  {{ cat.label }}
                </span>
              </div>
            }
          </div>
        </div>

        <!-- Date & Time -->
        <div class="form-row">
          <div class="form-section half">
            <label class="form-label">Date *</label>
            <input formControlName="date" type="date" class="form-input" />
          </div>
          <div class="form-section half">
            <label class="form-label">Time *</label>
            <input formControlName="time" type="time" class="form-input" />
          </div>
        </div>

        <!-- Priority -->
        <div class="form-section">
          <label class="form-label">Priority</label>
          <div class="priority-row">
            @for (p of priorities; track p.value) {
              <div
                class="priority-chip"
                [class.active]="f['priority'].value === p.value"
                [style.border-color]="f['priority'].value === p.value ? p.color : 'var(--rm-border)'"
                [style.background]="f['priority'].value === p.value ? p.color + '18' : 'var(--rm-surface)'"
                [style.color]="f['priority'].value === p.value ? p.color : 'var(--rm-text-secondary)'"
                (click)="form.get('priority')?.setValue(p.value)"
              >{{ p.label }}</div>
            }
          </div>
        </div>

        <!-- Repeat -->
        <div class="form-section">
          <label class="form-label">Repeat</label>
          <select formControlName="repeatType" class="form-input form-select">
            @for (r of repeats; track r.value) {
              <option [value]="r.value">{{ r.label }}</option>
            }
          </select>
        </div>

        <!-- Reminder Window -->
        <div class="form-section">
          <label class="form-label">Remind me before</label>
          <select formControlName="reminderWindowMinutes" class="form-input form-select">
            <option [value]="0">At the scheduled time</option>
            <option [value]="5">5 minutes before</option>
            <option [value]="10">10 minutes before</option>
            <option [value]="15">15 minutes before</option>
            <option [value]="30">30 minutes before</option>
            <option [value]="60">1 hour before</option>
            <option [value]="1440">1 day before</option>
          </select>
        </div>

        <!-- Notification Types -->
        <div class="form-section">
          <label class="form-label">Notify via</label>
          <div class="notif-row">
            @for (n of notifTypes; track n.value) {
              <div
                class="notif-chip"
                [class.active]="isNotifSelected(n.value)"
                (click)="toggleNotif(n.value)"
              >
                <span>{{ n.emoji }}</span>
                <span>{{ n.label }}</span>
                @if (n.premium) {
                  <span class="premium-pill">PRO</span>
                }
              </div>
            }
          </div>
        </div>

        <!-- Save button -->
        <button
          type="button"
          class="btn-save"
          [disabled]="form.invalid || saving()"
          (click)="submit()"
        >
          @if (saving()) {
            <ion-spinner name="crescent" style="width:18px;height:18px;color:white"></ion-spinner>
          } @else {
            Save Reminder
          }
        </button>

      </form>
    </ion-content>
  `,
  styles: [`
    .create-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); }
    .create-form { padding: 16px; padding-bottom: 48px; }
    .form-section { margin-bottom: 20px; }
    .form-row { display: flex; gap: 12px; }
    .form-section.half { flex: 1; margin-bottom: 20px; }
    .form-label { font-size: 13px; font-weight: 600; color: var(--rm-text-primary); display: block; margin-bottom: 8px; }
    .form-input { width: 100%; padding: 13px 14px; border: 1.5px solid var(--rm-border); border-radius: var(--rm-radius-md); font-size: 14px; outline: none; background: var(--rm-surface); transition: border-color 0.2s; font-family: inherit; color: var(--rm-text-primary); }
    .form-input:focus { border-color: var(--rm-purple); }
    .form-textarea { resize: none; line-height: 1.5; }
    .form-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
    .field-error { font-size: 12px; color: var(--rm-danger); margin-top: 4px; display: block; }
    .category-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .cat-chip { border-radius: 14px; padding: 10px 4px; border: 2px solid transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.15s; }
    .cat-chip:active { transform: scale(0.95); }
    .cat-emoji { font-size: 22px; }
    .cat-label { font-size: 11px; font-weight: 600; text-align: center; }
    .priority-row { display: flex; gap: 8px; }
    .priority-chip { flex: 1; padding: 10px 4px; border: 2px solid var(--rm-border); border-radius: 12px; cursor: pointer; text-align: center; font-size: 13px; font-weight: 600; transition: all 0.15s; }
    .notif-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .notif-chip { padding: 10px 14px; border: 2px solid var(--rm-border); border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--rm-text-secondary); background: var(--rm-surface); transition: all 0.15s; }
    .notif-chip.active { border-color: var(--rm-purple); color: var(--rm-purple); background: var(--rm-purple-light); }
    .premium-pill { background: #F59E0B; color: white; border-radius: 20px; padding: 2px 6px; font-size: 10px; font-weight: 700; }
    .btn-save { width: 100%; padding: 16px; background: linear-gradient(135deg, var(--rm-purple), #9333EA); color: white; border: none; border-radius: var(--rm-radius-md); font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; font-family: inherit; box-shadow: 0 4px 16px rgba(124,58,237,0.35); }
    .btn-save:disabled { opacity: 0.65; }
  `],
})
export class ReminderCreateComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private reminderService = inject(ReminderService);
  private toastCtrl = inject(ToastController);
  private authService = inject(AuthService);

  saving = signal(false);

  categories: CategoryOption[] = [
    { type: 'birthday', emoji: '🎂', label: 'Birthday', color: '#EC4899' },
    { type: 'wedding',  emoji: '💍', label: 'Wedding',  color: '#8B5CF6' },
    { type: 'medicine', emoji: '💊', label: 'Medicine', color: '#EF4444' },
    { type: 'bill',     emoji: '💰', label: 'Bill',     color: '#3B82F6' },
    { type: 'study',    emoji: '📚', label: 'Study',    color: '#10B981' },
    { type: 'work',     emoji: '💼', label: 'Work',     color: '#F59E0B' },
    { type: 'general',  emoji: '📌', label: 'General',  color: '#6B7280' },
    { type: 'custom',   emoji: '✨', label: 'Custom',   color: '#7C3AED' },
  ];

  repeats: RepeatOption[] = [
    { value: 'none',    label: 'Does not repeat' },
    { value: 'daily',   label: 'Every day' },
    { value: 'weekly',  label: 'Every week' },
    { value: 'monthly', label: 'Every month' },
    { value: 'yearly',  label: 'Every year' },
  ];

  priorities: PriorityOption[] = [
    { value: 'low',    label: 'Low',    color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high',   label: 'High',   color: '#F97316' },
    { value: 'urgent', label: 'Urgent', color: '#EF4444' },
  ];

  notifTypes = [
    { value: 'push' as NotificationType,     emoji: '🔔', label: 'Push',      premium: false },
    { value: 'email' as NotificationType,    emoji: '📧', label: 'Email',     premium: true  },
    { value: 'sms' as NotificationType,      emoji: '💬', label: 'SMS',       premium: true  },
    { value: 'whatsapp' as NotificationType, emoji: '📱', label: 'WhatsApp',  premium: true  },
  ];

  selectedNotifs = signal<NotificationType[]>(['push']);

  form = this.fb.group({
    title:                  ['', [Validators.required, Validators.maxLength(100)]],
    description:            [''],
    type:                   ['general' as ReminderType],
    date:                   [this.todayStr(), Validators.required],
    time:                   [this.defaultTimeStr(), Validators.required],
    repeatType:             ['none' as RepeatType],
    priority:               ['medium' as Priority],
    reminderWindowMinutes:  [0],
  });

  get f() { return this.form.controls; }

  constructor() {
    addIcons({ checkmarkOutline, closeOutline });
  }

  isNotifSelected(v: NotificationType): boolean {
    return this.selectedNotifs().includes(v);
  }

  async toggleNotif(v: NotificationType): Promise<void> {
    const channel = this.notifTypes.find((n) => n.value === v);
    // Premium-only channels (email, sms, whatsapp) require an active subscription
    if (channel?.premium && !this.authService.isPremium() && !this.isNotifSelected(v)) {
      const toast = await this.toastCtrl.create({
        message: `${channel.label} notifications are a Premium feature`,
        duration: 2500,
        color: 'warning',
        position: 'top',
        buttons: [{ text: 'Upgrade', handler: () => this.router.navigate(['/app/premium']) }],
      });
      toast.present();
      return;
    }
    this.selectedNotifs.update((prev) =>
      prev.includes(v) ? prev.filter((n) => n !== v) : [...prev, v]
    );
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const { date, time, reminderWindowMinutes, ...rest } = this.form.value as any;

    // Combine user's local date+time and subtract the reminder window to get the exact fire moment
    const localFireDt = new Date(`${date}T${time}`);
    const window = Number(reminderWindowMinutes) || 0;
    const nextFireAt = new Date(localFireDt.getTime() - window * 60_000);

    const dto: CreateReminderDto = {
      ...rest,
      date,
      time,
      reminderWindowMinutes: window,
      nextFireAt: nextFireAt.toISOString(),
      notificationTypes: this.selectedNotifs(),
    };

    this.reminderService.create(dto).subscribe({
      next: async () => {
        this.saving.set(false);
        const toast = await this.toastCtrl.create({
          message: '🎉 Reminder created!',
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
        this.router.navigate(['/app/reminders']);
      },
      error: async () => {
        this.saving.set(false);
        const toast = await this.toastCtrl.create({
          message: 'Failed to create reminder. Try again.',
          duration: 3000,
          color: 'danger',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  private todayStr(): string {
    const d = new Date();
    // Use local date (not UTC) so IST users see today's date, not yesterday
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private defaultTimeStr(): string {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0); // default to next full hour
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  }
}
