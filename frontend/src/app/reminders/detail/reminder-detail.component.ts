// src/app/reminders/detail/reminder-detail.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonIcon, IonSpinner, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, timeOutline, trashOutline, createOutline } from 'ionicons/icons';
import { ReminderService, Reminder } from '../../core/services/reminder.service';

const CAT_COLOR: Record<string, string> = {
  birthday:'#EC4899',wedding:'#8B5CF6',medicine:'#EF4444',
  bill:'#3B82F6',study:'#10B981',work:'#F59E0B',general:'#6B7280',custom:'#7C3AED',
};
const CAT_EMOJI: Record<string, string> = {
  birthday:'🎂',wedding:'💍',medicine:'💊',bill:'💰',study:'📚',work:'💼',general:'📌',custom:'✨',
};

@Component({
  selector: 'app-reminder-detail',
  standalone: true,
  imports: [CommonModule, TimeAmPmPipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonSpinner],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/app/reminders" text=""></ion-back-button></ion-buttons>
        <ion-title>Reminder</ion-title>
        <ion-buttons slot="end">
          <button class="icon-btn" (click)="confirmDelete()"><ion-icon name="trash-outline" style="color:var(--rm-danger)"></ion-icon></button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="detail-content">
      @if (loading()) {
        <div class="loading-wrap"><ion-spinner name="crescent" color="primary"></ion-spinner></div>
      } @else if (reminder()) {
        <div class="detail-card" [style.border-top-color]="color()">
          <div class="detail-emoji">{{ emoji() }}</div>
          <h1 class="detail-title">{{ reminder()!.title }}</h1>
          @if (reminder()!.description) { <p class="detail-desc">{{ reminder()!.description }}</p> }
          <div class="detail-meta">
            <div class="meta-item"><span class="meta-icon">📅</span>{{ reminder()!.date | date:'MMMM d, y' }}</div>
            <div class="meta-item"><span class="meta-icon">⏰</span>{{ reminder()!.time | timeAmPm }}</div>
            <div class="meta-item"><span class="meta-icon">🔁</span>{{ reminder()!.repeatType }}</div>
            <div class="meta-item"><span class="meta-icon">⚡</span>{{ reminder()!.priority }}</div>
          </div>
          <div class="status-badge" [class]="'status-' + reminder()!.status">{{ reminder()!.status }}</div>
        </div>
        @if (reminder()!.status === 'pending' || reminder()!.status === 'snoozed') {
          <div class="action-buttons">
            <button class="btn-done-full" (click)="markDone()">
              <ion-icon name="checkmark-circle-outline"></ion-icon> Mark as Done
            </button>
            <button class="btn-snooze-full" (click)="snooze()">
              <ion-icon name="time-outline"></ion-icon> Snooze 30 min
            </button>
          </div>
        }
      }
    </ion-content>`,
  styles: [`
    .detail-content { --background:var(--rm-bg); }
    ion-toolbar { --background:var(--rm-card); }
    .icon-btn { background:none; border:none; padding:8px; cursor:pointer; font-size:20px; }
    .loading-wrap { display:flex; justify-content:center; padding:80px; }
    .detail-card { background:var(--rm-card); margin:16px; border-radius:20px; padding:24px; box-shadow:var(--rm-shadow-sm); border-top:4px solid #7C3AED; text-align:center; }
    .detail-emoji { font-size:56px; margin-bottom:12px; }
    .detail-title { font-size:22px; font-weight:800; color:var(--rm-text-primary); margin-bottom:8px; }
    .detail-desc { font-size:14px; color:var(--rm-text-muted); margin-bottom:16px; }
    .detail-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; text-align:left; }
    .meta-item { background:var(--rm-surface); padding:10px 12px; border-radius:12px; font-size:13px; color:var(--rm-text-secondary); display:flex; align-items:center; gap:6px; }
    .meta-icon { font-size:16px; }
    .status-badge { display:inline-block; padding:6px 16px; border-radius:20px; font-size:12px; font-weight:700; text-transform:capitalize; }
    .status-pending { background:rgba(59,130,246,0.12); color:#3B82F6; }
    .status-done    { background:rgba(16,185,129,0.12); color:#10B981; }
    .status-missed  { background:rgba(239,68,68,0.12);  color:#EF4444; }
    .status-snoozed { background:rgba(245,158,11,0.12); color:#F59E0B; }
    .action-buttons { padding:0 16px; display:flex; flex-direction:column; gap:10px; }
    .btn-done-full { padding:16px; background:rgba(16,185,129,0.12); color:#10B981; border:1.5px solid rgba(16,185,129,.25); border-radius:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
    .btn-snooze-full { padding:16px; background:rgba(59,130,246,0.12); color:#3B82F6; border:1.5px solid rgba(59,130,246,.25); border-radius:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
    ion-icon { font-size:20px; }
  `],
})
export class ReminderDetailComponent implements OnInit {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private reminderService = inject(ReminderService);
  private alertCtrl      = inject(AlertController);
  private toastCtrl      = inject(ToastController);

  loading  = signal(true);
  reminder = signal<Reminder | null>(null);

  color = () => CAT_COLOR[this.reminder()?.type ?? 'general'] ?? '#7C3AED';
  emoji = () => CAT_EMOJI[this.reminder()?.type ?? 'general'] ?? '📌';

  constructor() { addIcons({ checkmarkCircleOutline, timeOutline, trashOutline, createOutline }); }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.reminderService.getById(id).subscribe({
      next: r  => { this.reminder.set(r); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/app/reminders']); },
    });
  }

  markDone(): void {
    this.reminderService.markDone(this.reminder()!._id).subscribe(r => this.reminder.set(r));
  }

  snooze(): void {
    this.reminderService.snooze(this.reminder()!._id, 30).subscribe(r => this.reminder.set(r));
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Reminder',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => {
          this.reminderService.delete(this.reminder()!._id).subscribe(() => this.router.navigate(['/app/reminders']));
        }},
      ],
    });
    await alert.present();
  }
}
