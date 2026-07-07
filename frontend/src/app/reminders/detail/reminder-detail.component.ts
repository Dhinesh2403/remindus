// src/app/reminders/detail/reminder-detail.component.ts
import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons,
  IonBackButton, IonIcon, IonSpinner, AlertController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, checkmarkCircleOutline, trashOutline, chevronForwardOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ReminderService, Reminder, ReminderStatus } from '../../core/services/reminder.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { FriendAvatarComponent, AvatarGender } from '../../core/components/friend-avatar.component';

const CAT_COLOR: Record<string, string> = {
  birthday:'#EC4899',wedding:'#8B5CF6',medicine:'#EF4444',
  bill:'#3B82F6',study:'#10B981',work:'#F59E0B',general:'#6B7280',custom:'#3D5AF1',
  personal:'#3D5AF1',health:'#10B981',finance:'#F97316',family:'#EF4444',travel:'#8B5CF6',shopping:'#14B8A6',
};
const PRIORITY_COLOR: Record<string, string> = {
  low:'#10B981', medium:'#F59E0B', high:'#F97316', urgent:'#EF4444',
};
const REPEAT_LABEL: Record<string, string> = {
  none:'Does not repeat', daily:'Daily', weekly:'Weekly',
  weekdays:'Weekdays', monthly:'Monthly', yearly:'Yearly',
};
const SHARED_STATUS_META: Record<string, { label: string; color: string }> = {
  sent:         { label: 'Sent',         color: '#3B82F6' },
  received:     { label: 'Received',     color: '#F59E0B' },
  acknowledged: { label: 'Acknowledged', color: '#06B6D4' },
  processing:   { label: 'In Progress',  color: '#8B5CF6' },
  skipped:      { label: 'Skipped',      color: '#9CA3AF' },
  completed:    { label: 'Completed',    color: '#10B981' },
};

/** Populated user ref (creator or assignee) as returned by GET /reminders/:id */
interface PersonRef {
  _id: string;
  name: string;
  avatar?: string;
  gender?: AvatarGender;
}

@Component({
  selector: 'app-reminder-detail',
  standalone: true,
  imports: [
    CommonModule, TimeAmPmPipe,
    IonContent, IonHeader, IonToolbar, IonButtons,
    IonBackButton, IonIcon, IonSpinner, FriendAvatarComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="det-bar">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/app/reminders" text="" icon="arrow-back-outline"></ion-back-button>
        </ion-buttons>
        <div class="det-bar-title">Reminder</div>
        @if (!isRecipient()) {
          <ion-buttons slot="end">
            <button class="det-bar-btn" (click)="confirmDelete()" aria-label="Delete reminder">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="det-content">
      @if (loading()) {
        <div class="loading-wrap"><ion-spinner name="crescent" color="primary"></ion-spinner></div>
      } @else if (reminder()) {
        <div class="det-page">

          <!-- ── Overview ─────────────────────────────────────────────── -->
          <div class="det-card det-overview">
            <div class="det-type" [style.color]="color()">{{ reminder()!.type | titlecase }}</div>
            <h1 class="det-title">{{ reminder()!.title }}</h1>
            @if (reminder()!.description) { <p class="det-desc">{{ reminder()!.description }}</p> }
            @if (isRecipient() && reminder()!.sharedStatus) {
              <span
                class="det-chip"
                [style.background]="sharedStatusColor() + '1A'"
                [style.color]="sharedStatusColor()"
              >{{ sharedStatusLabel() }}</span>
            } @else {
              <span class="det-chip" [class]="'status-' + reminder()!.status">{{ reminder()!.status }}</span>
            }
          </div>

          <!-- ── Details ──────────────────────────────────────────────── -->
          <div class="det-label">Details</div>
          <div class="det-card">
            <div class="det-row">
              <span class="det-k">Date</span>
              <span class="det-v">{{ reminder()!.date | date:'EEE, MMM d, yyyy' }}</span>
            </div>
            <div class="det-row">
              <span class="det-k">Time</span>
              <span class="det-v">{{ reminder()!.time | timeAmPm }}</span>
            </div>
            <div class="det-row">
              <span class="det-k">Repeat</span>
              <span class="det-v">{{ repeatLabel() }}</span>
            </div>
            <div class="det-row">
              <span class="det-k">Priority</span>
              <span class="det-v"><i class="det-dot" [style.background]="priorityColor()"></i>{{ reminder()!.priority | titlecase }}</span>
            </div>
          </div>

          <!-- ── Assignee / assigner ──────────────────────────────────── -->
          @if (person(); as p) {
            <div class="det-label">{{ isRecipient() ? 'Assigned by' : 'Assigned to' }}</div>
            <button class="det-card det-person rm-press" (click)="openFriendProfile()">
              <app-friend-avatar [name]="p.name" [avatar]="p.avatar" [gender]="p.gender" [size]="46" />
              <div class="det-person-info">
                <div class="det-person-name">{{ p.name }}</div>
                <div class="det-person-sub">View profile &amp; shared activity</div>
              </div>
              @if (!isRecipient() && reminder()!.sharedStatus) {
                <span
                  class="det-chip small"
                  [style.background]="sharedStatusColor() + '1A'"
                  [style.color]="sharedStatusColor()"
                >{{ sharedStatusLabel() }}</span>
              }
              <ion-icon name="chevron-forward-outline" class="det-chev"></ion-icon>
            </button>
          }

          <!-- ── Actions ──────────────────────────────────────────────── -->
          @if (isRecipient()) {
            @if (reminder()!.sharedStatus !== 'completed' && reminder()!.sharedStatus !== 'skipped') {
              <div class="det-actions">
                <button class="det-btn primary rm-press" (click)="markComplete()">Mark as Complete</button>
                <button class="det-btn secondary rm-press" (click)="changeStatus()">Update Status</button>
                <button class="det-btn ghost rm-press" (click)="skipReminder()">Skip this reminder</button>
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
            <div class="det-actions">
              <button class="det-btn primary rm-press" (click)="markDone()">Mark as Done</button>
            </div>
          }
        </div>
      }
    </ion-content>`,
  styles: [`
    /* ── Header — flat bar, hairline divider, left-aligned title ── */
    .det-bar {
      --background: var(--rm-card);
      --min-height: 56px;
      --padding-start: 10px; --padding-end: 10px;
      --padding-top: calc(env(safe-area-inset-top) + 8px); --padding-bottom: 8px;
      border-bottom: 1px solid var(--rm-border);
    }
    .det-bar-title { font-size: 17px; font-weight: 700; color: var(--rm-text-primary); margin-left: 6px; }
    .det-bar-btn {
      width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer; font-size: 20px; color: var(--rm-text-secondary);
    }
    ion-back-button { --color: var(--rm-text-primary); }

    .det-content { --background: var(--rm-bg); }
    .loading-wrap { display: flex; justify-content: center; padding: 80px; }
    .det-page { padding: 16px var(--rm-page-padding) 32px; }

    /* ── Cards ── */
    .det-card {
      background: var(--rm-card); border: 1px solid var(--rm-border);
      border-radius: var(--rm-radius-md); padding: 16px; margin-bottom: 8px;
    }
    .det-label {
      font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;
      color: var(--rm-text-muted); margin: 16px 4px 8px;
    }

    /* ── Overview ── */
    .det-overview { padding: 20px 16px; }
    .det-type { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .det-title { font-size: 21px; font-weight: 800; color: var(--rm-text-primary); margin: 0 0 6px; line-height: 1.3; }
    .det-desc { font-size: 14px; color: var(--rm-text-secondary); margin: 0 0 12px; line-height: 1.5; }
    .det-overview .det-chip { margin-top: 4px; }

    .det-chip {
      display: inline-block; padding: 5px 14px; border-radius: var(--rm-radius-full);
      font-size: 12px; font-weight: 700; text-transform: capitalize;
    }
    .det-chip.small { padding: 3px 10px; font-size: 11px; flex-shrink: 0; }
    .status-pending { background: rgba(59,130,246,0.12);  color: #3B82F6; }
    .status-done    { background: rgba(16,185,129,0.12);  color: #10B981; }
    .status-missed  { background: rgba(239,68,68,0.12);   color: #EF4444; }
    .status-snoozed { background: rgba(245,158,11,0.12);  color: #F59E0B; }

    /* ── Detail rows ── */
    .det-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 13px 0; border-bottom: 1px solid var(--rm-border);
    }
    .det-row:first-child { padding-top: 0; }
    .det-row:last-child { padding-bottom: 0; border-bottom: none; }
    .det-k { font-size: 13.5px; color: var(--rm-text-secondary); }
    .det-v { font-size: 13.5px; font-weight: 600; color: var(--rm-text-primary); display: flex; align-items: center; gap: 7px; }
    .det-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

    /* ── Person card ── */
    .det-person {
      width: 100%; display: flex; align-items: center; gap: 12px;
      text-align: left; cursor: pointer; font-family: inherit; padding: 13px 14px;
    }
    .det-person-info { flex: 1; min-width: 0; }
    .det-person-name {
      font-size: 15px; font-weight: 700; color: var(--rm-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .det-person-sub { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .det-chev { font-size: 17px; color: var(--rm-text-muted); flex-shrink: 0; }

    /* ── Actions ── */
    .det-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
    .det-btn {
      width: 100%; padding: 15px; border-radius: var(--rm-radius-md);
      font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; border: none;
    }
    .det-btn.primary { background: var(--rm-purple); color: #fff; }
    .det-btn.secondary { background: var(--rm-card); color: var(--rm-text-primary); border: 1px solid var(--rm-border); }
    .det-btn.ghost { background: transparent; color: var(--rm-text-secondary); padding: 10px; }

    .done-banner {
      margin-top: 20px; padding: 15px; background: rgba(16,185,129,0.1); color: #10B981;
      border: 1px solid rgba(16,185,129,.25); border-radius: var(--rm-radius-md);
      font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .done-banner ion-icon { font-size: 20px; }
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
  priorityColor = () => PRIORITY_COLOR[this.reminder()?.priority ?? 'medium'] ?? '#F59E0B';
  repeatLabel = () => REPEAT_LABEL[this.reminder()?.repeatType ?? 'none'] ?? this.reminder()?.repeatType;

  /** True when the currently logged-in user is the recipient (assignedTo), not the creator */
  isRecipient = computed(() => {
    const r = this.reminder();
    const u = this.authService.currentUser();
    if (!r || !u) return false;
    return !!r.assignedBy && r.assignedBy !== u._id;
  });

  /** The "other" user on a shared reminder: the sender for the recipient,
   *  the assignee for the creator. Both are populated by GET /reminders/:id. */
  person = computed<PersonRef | null>(() => {
    const r = this.reminder();
    if (!r) return null;
    const raw = this.isRecipient() ? (r.userId as unknown) : (r.assignedTo as unknown);
    return raw && typeof raw === 'object' ? (raw as PersonRef) : null;
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
    addIcons({ arrowBackOutline, checkmarkCircleOutline, trashOutline, chevronForwardOutline });
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

  /** Assignee/assigner card → their shared-activity page (friends module). */
  openFriendProfile(): void {
    const id = this.person()?._id;
    if (id) this.router.navigate(['/app/friends', id, 'activity']);
  }

  // ── Own reminder actions ──────────────────────────────────────────────────
  // Action endpoints return the reminder without populated user refs, so merge
  // status fields instead of replacing the signal (keeps the person card).
  markDone(): void {
    this.reminderService.markDone(this.reminder()!._id).subscribe(r => {
      this.reminder.update(prev => prev ? { ...prev, status: r.status, completedAt: r.completedAt } : prev);
    });
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
        { text: 'Acknowledged', data: 'acknowledged' },
        { text: 'In Progress',  data: 'processing'   },
        { text: 'Completed',    data: 'completed'    },
        { text: 'Skip',         data: 'skipped'      },
        { text: 'Cancel',       role: 'cancel'       },
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
