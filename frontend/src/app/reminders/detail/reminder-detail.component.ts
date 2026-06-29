// src/app/reminders/detail/reminder-detail.component.ts
import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonIcon, IonSpinner, AlertController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, trashOutline, createOutline,
  refreshOutline, playSkipForwardOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ReminderService, Reminder, ReminderStatus } from '../../core/services/reminder.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';

const CAT_COLOR: Record<string, string> = {
  birthday:'#EC4899',wedding:'#8B5CF6',medicine:'#EF4444',
  bill:'#3B82F6',study:'#10B981',work:'#F59E0B',general:'#6B7280',custom:'#3D5AF1',
};
const CAT_EMOJI: Record<string, string> = {
  birthday:'🎂',wedding:'💍',medicine:'💊',bill:'💰',study:'📚',work:'💼',general:'📌',custom:'✨',
};
const SHARED_STATUS_META: Record<string, { label: string; color: string }> = {
  sent:         { label: 'Sent',         color: '#3B82F6' },
  received:     { label: 'Received',     color: '#F59E0B' },
  acknowledged: { label: 'Acknowledged', color: '#06B6D4' },
  processing:   { label: 'In Progress',  color: '#8B5CF6' },
  skipped:      { label: 'Skipped',      color: '#9CA3AF' },
  completed:    { label: 'Completed',    color: '#10B981' },
};

@Component({
  selector: 'app-reminder-detail',
  standalone: true,
  imports: [
    CommonModule, TimeAmPmPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonIcon, IonSpinner,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/app/reminders" text=""></ion-back-button></ion-buttons>
        <ion-title>Reminder</ion-title>
        @if (!isRecipient()) {
          <ion-buttons slot="end">
            <button class="icon-btn" (click)="confirmDelete()">
              <ion-icon name="trash-outline" style="color:var(--rm-danger)"></ion-icon>
            </button>
          </ion-buttons>
        }
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

          @if (isRecipient()) {
            <!-- Recipient view -->
            <div class="from-row">
              <span class="meta-icon">👤</span>
              <span class="from-text">From <strong>{{ senderName() }}</strong></span>
            </div>
            <div
              class="shared-status-chip"
              [style.background]="sharedStatusColor() + '22'"
              [style.color]="sharedStatusColor()"
              [style.border-color]="sharedStatusColor() + '55'"
            >{{ sharedStatusLabel() }}</div>
          } @else {
            <!-- Sender view -->
            <div class="status-badge" [class]="'status-' + reminder()!.status">{{ reminder()!.status }}</div>
            @if (reminder()!.sharedStatus) {
              <div class="friend-status-row">
                <span class="friend-status-label">Friend's status:</span>
                <div
                  class="shared-status-chip small"
                  [style.background]="sharedStatusColor() + '22'"
                  [style.color]="sharedStatusColor()"
                  [style.border-color]="sharedStatusColor() + '55'"
                >{{ sharedStatusLabel() }}</div>
              </div>
            }
          }
        </div>

        @if (isRecipient()) {
          @if (reminder()!.sharedStatus !== 'completed' && reminder()!.sharedStatus !== 'skipped') {
            <div class="action-buttons">
              <button class="btn-done-full" (click)="markComplete()">
                <ion-icon name="checkmark-circle-outline"></ion-icon><span>Mark as Complete</span>
              </button>
              <button class="btn-status-full" (click)="changeStatus()">
                <ion-icon name="refresh-outline"></ion-icon><span>Update Status</span>
              </button>
              <button class="btn-skip-full" (click)="skipReminder()">
                <ion-icon name="play-skip-forward-outline"></ion-icon><span>Skip</span>
              </button>
            </div>
          } @else {
            <div class="done-banner">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <span>You {{ reminder()!.sharedStatus === 'skipped' ? 'skipped' : 'completed' }} this reminder</span>
            </div>
          }
        } @else if (reminder()!.status === 'done') {
          <div class="done-banner">
            <ion-icon name="checkmark-circle-outline"></ion-icon><span>Reminder completed</span>
          </div>
        } @else {
          <div class="action-buttons">
            <button class="btn-done-full" (click)="markDone()">
              <ion-icon name="checkmark-circle-outline"></ion-icon><span>Mark as Done</span>
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

    /* Light mode (default) — explicit colors so text never depends on var resolution */
    .detail-card { background:#FFFFFF; margin:16px; border-radius:20px; padding:24px; box-shadow:0 1px 6px rgba(0,0,0,0.08); border-top:4px solid #3D5AF1; text-align:center; }
    .detail-emoji { font-size:56px; margin-bottom:12px; }
    .detail-title { font-size:22px; font-weight:800; color:#1F2937; margin-bottom:8px; }
    .detail-desc { font-size:14px; color:#6B7280; margin-bottom:16px; }
    .detail-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; text-align:left; }
    .meta-item { background:#F3F4F6; padding:10px 12px; border-radius:12px; font-size:13px; color:#374151; display:flex; align-items:center; gap:6px; text-transform:capitalize; }
    .meta-icon { font-size:16px; }

    /* Dark mode — via OS preference */
    @media (prefers-color-scheme: dark) {
      .detail-card { background:#1A1A2E; box-shadow:0 1px 6px rgba(0,0,0,0.4); }
      .detail-title { color:#F9FAFB; }
      .detail-desc { color:#9CA3AF; }
      .meta-item { background:#16213E; color:#D1D5DB; }
      .from-row, .from-text { color:#9CA3AF; }
      .friend-status-label { color:#6B7280; }
    }

    .status-badge { display:inline-block; padding:6px 16px; border-radius:20px; font-size:12px; font-weight:700; text-transform:capitalize; margin-top:4px; }
    .status-pending { background:rgba(59,130,246,0.12); color:#3B82F6; }
    .status-done    { background:rgba(16,185,129,0.12); color:#10B981; }
    .status-missed  { background:rgba(239,68,68,0.12);  color:#EF4444; }
    .status-snoozed { background:rgba(245,158,11,0.12); color:#F59E0B; }

    .from-row { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:10px; font-size:13px; color:#6B7280; }
    .from-text { font-size:13px; color:#6B7280; }

    .shared-status-chip { display:inline-block; padding:6px 18px; border-radius:20px; font-size:13px; font-weight:700; text-transform:capitalize; border:1px solid; margin-top:4px; }
    .shared-status-chip.small { font-size:11px; padding:3px 10px; }

    .friend-status-row { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; }
    .friend-status-label { font-size:12px; color:#9CA3AF; }

    /* Dark mode — class toggle fallback (in case theme is forced via .dark-theme) */
    :host-context(.dark-theme) .detail-card { background:#1A1A2E; box-shadow:0 1px 6px rgba(0,0,0,0.4); }
    :host-context(.dark-theme) .detail-title { color:#F9FAFB; }
    :host-context(.dark-theme) .detail-desc { color:#9CA3AF; }
    :host-context(.dark-theme) .meta-item { background:#16213E; color:#D1D5DB; }
    :host-context(.dark-theme) .from-row,
    :host-context(.dark-theme) .from-text { color:#9CA3AF; }
    :host-context(.dark-theme) .friend-status-label { color:#6B7280; }

    .done-banner { margin:0 16px; padding:16px; background:rgba(16,185,129,0.1); color:#10B981; border:1.5px solid rgba(16,185,129,.25); border-radius:16px; font-size:15px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; }
    .action-buttons { padding:0 16px; display:flex; flex-direction:column; gap:10px; margin-top:4px; }
    .btn-done-full { padding:16px; background:rgba(16,185,129,0.12); color:#10B981; border:1.5px solid rgba(16,185,129,.25); border-radius:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
.btn-status-full { padding:16px; background:rgba(139,92,246,0.12); color:#8B5CF6; border:1.5px solid rgba(139,92,246,.25); border-radius:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
    .btn-skip-full { padding:16px; background:rgba(156,163,175,0.12); color:#9CA3AF; border:1.5px solid rgba(156,163,175,.25); border-radius:16px; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
    ion-icon { font-size:20px; }
  `],
})
export class ReminderDetailComponent implements OnInit, OnDestroy {
  private route            = inject(ActivatedRoute);
  private router           = inject(Router);
  private reminderService  = inject(ReminderService);
  private authService      = inject(AuthService);
  private socketService    = inject(SocketService);
  private alertCtrl        = inject(AlertController);
  private actionSheetCtrl  = inject(ActionSheetController);

  private socketSub: Subscription | undefined;

  loading  = signal(true);
  reminder = signal<Reminder | null>(null);

  color = () => CAT_COLOR[this.reminder()?.type ?? 'general'] ?? '#3D5AF1';
  emoji = () => CAT_EMOJI[this.reminder()?.type ?? 'general'] ?? '📌';

  /** True when the currently logged-in user is the recipient (assignedTo), not the creator */
  isRecipient = computed(() => {
    const r = this.reminder();
    const u = this.authService.currentUser();
    if (!r || !u) return false;
    return !!r.assignedBy && r.assignedBy !== u._id;
  });

  senderName = computed(() => {
    const r = this.reminder();
    if (!r) return '';
    // userId is populated by getById — cast to access name
    const userId = r.userId as unknown as { _id: string; name: string };
    return userId?.name ?? 'Friend';
  });

  sharedStatusLabel = computed(() => {
    const r = this.reminder();
    if (!r?.sharedStatus) return '';
    return SHARED_STATUS_META[r.sharedStatus]?.label ?? r.sharedStatus;
  });

  sharedStatusColor = computed(() => {
    const r = this.reminder();
    if (!r?.sharedStatus) return '#9CA3AF';
    return SHARED_STATUS_META[r.sharedStatus]?.color ?? '#9CA3AF';
  });

  constructor() {
    addIcons({ checkmarkCircleOutline, trashOutline, createOutline, refreshOutline, playSkipForwardOutline });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.reminderService.getById(id).subscribe({
      next: r  => { this.reminder.set(r); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/app/reminders']); },
    });

    this.socketSub = this.socketService
      .on<{ _id: string; sharedStatus: string; status: string }>('reminder:sharedStatus')
      .subscribe(({ _id, sharedStatus, status }) => {
        if (this.reminder()?._id === _id) {
          this.reminder.update(r => r
            ? { ...r, sharedStatus: sharedStatus ?? undefined, ...(status ? { status: status as ReminderStatus } : {}) }
            : r
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.socketSub?.unsubscribe();
  }

  // ── Own reminder actions ──────────────────────────────────────────────────
  markDone(): void {
    this.reminderService.markDone(this.reminder()!._id).subscribe(r => this.reminder.set(r));
  }

  // ── Received reminder actions ─────────────────────────────────────────────
  markComplete(): void {
    this.reminderService.updateSharedStatus(this.reminder()!._id, 'completed').subscribe(r => {
      this.reminder.update(prev => prev ? { ...prev, sharedStatus: r.sharedStatus ?? undefined, status: r.status } : prev);
    });
  }

  skipReminder(): void {
    this.reminderService.updateSharedStatus(this.reminder()!._id, 'skipped').subscribe(r => {
      this.reminder.update(prev => prev ? { ...prev, sharedStatus: r.sharedStatus ?? undefined, status: r.status } : prev);
    });
  }

  async changeStatus(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: this.reminder()!.title,
      subHeader: 'Update your progress',
      buttons: [
        { text: '👀 Acknowledged', data: 'acknowledged' },
        { text: '🔄 In Progress',  data: 'processing'   },
        { text: '✅ Completed',    data: 'completed'    },
        { text: '⏭️ Skip',        data: 'skipped'      },
        { text: 'Cancel',          role: 'cancel'       },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss();
    if (!data) return;
    this.reminderService.updateSharedStatus(this.reminder()!._id, data).subscribe(r => {
      this.reminder.update(prev => prev ? { ...prev, sharedStatus: r.sharedStatus ?? undefined, status: r.status } : prev);
    });
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
