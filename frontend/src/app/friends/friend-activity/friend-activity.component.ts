// src/app/friends/friend-activity/friend-activity.component.ts
// Shared activity with one friend (docs/screens/remindus (16).png):
// hero header with Message/Assign, stats, All/Tasks/Reminders tabs, the list
// of everything assigned between the two of you. Assign opens a small
// Task/Reminder chooser that hands off to the full create pages with this
// friend pre-selected (?assignTo=<friendId>).
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, ToastController, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, chatbubbleEllipsesOutline, checkboxOutline,
  notificationsOutline, personRemoveOutline, closeOutline, addOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import {
  FriendService, Friend, SharedReminder, SharedTask, SharedStatus,
} from '../../core/services/friend.service';
import { FriendAvatarComponent } from '../../core/components/friend-avatar.component';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';

type Tab = 'all' | 'task' | 'reminder';

interface ActivityItem {
  kind:      'task' | 'reminder';
  id:        string;
  title:     string;
  dateLabel: string;   // "Jul 3 · 9:00 AM" / "No due date"
  byMe:      boolean;  // assigned by the current user
  toMe:      boolean;  // assigned to the current user
  statusKey: string;   // css suffix
  statusLabel: string;
  createdAt: number;
  reminder?: SharedReminder;
  task?:     SharedTask;
}

@Component({
  selector: 'app-friend-activity',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, FriendAvatarComponent],
  providers: [TimeAmPmPipe],
  template: `
    <ion-content class="fa-content">
      <!-- ── Hero header ─────────────────────────────────────────────── -->
      <div class="fa-hero">
        <div class="fa-hero-top">
          <button class="fa-back rm-press" (click)="goBack()">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="fa-hero-title">Shared Activity</div>
          <div class="fa-hero-spacer"></div>
        </div>

        <div class="fa-identity">
          <div class="fa-avatar-ring">
            <app-friend-avatar [name]="friendName()" [avatar]="friend()?.avatar" [gender]="friend()?.gender" [size]="58" />
            <span class="fa-dot" [class.online]="isOnline()"></span>
          </div>
          <div class="fa-who">
            <div class="fa-name">{{ friendName() }}</div>
            <div class="fa-presence">
              {{ isOnline() ? 'Active now' : presenceLabel() }}@if (friend()?.refId) {<span> · {{ friend()?.refId }}</span>}
            </div>
          </div>
        </div>

        <div class="fa-cta-row">
          <button class="fa-cta fa-cta-msg rm-press" (click)="openChat()">
            <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
            Message
          </button>
          <button class="fa-cta fa-cta-assign rm-press" (click)="openSheet()">
            <ion-icon name="checkbox-outline"></ion-icon>
            Assign
          </button>
        </div>
      </div>

      <!-- ── Stats ───────────────────────────────────────────────────── -->
      <div class="fa-stats">
        <div class="fa-stat">
          <div class="fa-stat-num">{{ items().length }}</div>
          <div class="fa-stat-lbl">Shared</div>
        </div>
        <div class="fa-stat">
          <div class="fa-stat-num orange">{{ pendingCount() }}</div>
          <div class="fa-stat-lbl">Pending</div>
        </div>
        <div class="fa-stat">
          <div class="fa-stat-num green">{{ completedCount() }}</div>
          <div class="fa-stat-lbl">Completed</div>
        </div>
      </div>

      <!-- ── Tabs ────────────────────────────────────────────────────── -->
      <div class="fa-tabs">
        <button class="fa-tab" [class.active]="tab() === 'all'" (click)="tab.set('all')">
          All <span class="fa-tab-n">{{ items().length }}</span>
        </button>
        <button class="fa-tab" [class.active]="tab() === 'task'" (click)="tab.set('task')">
          Tasks <span class="fa-tab-n">{{ taskCount() }}</span>
        </button>
        <button class="fa-tab" [class.active]="tab() === 'reminder'" (click)="tab.set('reminder')">
          Reminders <span class="fa-tab-n">{{ reminderCount() }}</span>
        </button>
      </div>

      <!-- ── Items ───────────────────────────────────────────────────── -->
      @if (loading()) {
        @for (i of [1,2,3]; track i) {
          <div class="fa-skel"></div>
        }
      } @else if (visibleItems().length === 0) {
        <div class="fa-empty">
          <div class="fa-empty-text">Nothing shared in this category yet.</div>
          <button class="fa-empty-cta" (click)="openSheet()">
            <ion-icon name="add-outline"></ion-icon>
            Assign {{ tab() === 'reminder' ? 'a reminder' : (tab() === 'task' ? 'a task' : 'something') }}
          </button>
        </div>
      } @else {
        <div class="fa-list">
          @for (item of visibleItems(); track item.kind + item.id) {
            <div class="fa-item">
              <div class="fa-item-head">
                <span class="fa-chip" [class.chip-task]="item.kind === 'task'" [class.chip-rem]="item.kind === 'reminder'">
                  <ion-icon [name]="item.kind === 'task' ? 'checkbox-outline' : 'notifications-outline'"></ion-icon>
                  {{ item.kind === 'task' ? 'Task' : 'Reminder' }}
                </span>
                <span class="fa-status" [class]="'fa-status status-' + item.statusKey">{{ item.statusLabel }}</span>
              </div>
              <div class="fa-item-title">{{ item.title }}</div>
              <div class="fa-item-meta">
                {{ item.dateLabel }} · {{ item.byMe ? 'assigned by you' : 'assigned by ' + firstName() }}
              </div>

              <!-- Reminder actions — only for reminders assigned to me and still open -->
              @if (item.kind === 'reminder' && item.toMe && item.statusKey !== 'completed' && item.statusKey !== 'skipped') {
                <div class="fa-actions">
                  <button class="fa-act act-start" (click)="setReminderStatus(item, 'processing')">▶ Start</button>
                  <button class="fa-act act-done" (click)="setReminderStatus(item, 'completed')">✅ Done</button>
                  <button class="fa-act act-snooze" (click)="snooze(item, 10)">⏰ 10 min</button>
                  <button class="fa-act act-snooze" (click)="snooze(item, 60)">⏰ 1 hr</button>
                  <button class="fa-act act-skip" (click)="setReminderStatus(item, 'skipped')">⏭ Skip</button>
                </div>
              }
              <!-- Task action — assignee can mark it done -->
              @if (item.kind === 'task' && item.toMe && item.statusKey === 'active') {
                <div class="fa-actions">
                  <button class="fa-act act-done" (click)="toggleTask(item)">✅ Mark done</button>
                </div>
              }
            </div>
          }
        </div>
      }

      <button class="fa-remove" (click)="confirmUnfriend()">
        <ion-icon name="person-remove-outline"></ion-icon>
        Remove friend
      </button>
      <div class="fa-bottom-space"></div>
    </ion-content>

    <!-- ── Assign chooser — hands off to the full create pages ──────── -->
    @if (sheetOpen()) {
      <div class="as-backdrop" (click)="closeSheet()"></div>
      <div class="as-sheet">
        <div class="as-grip"></div>
        <div class="as-head">
          <div class="as-title">Assign to {{ firstName() }}</div>
          <button class="as-close rm-press" (click)="closeSheet()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <div class="as-hint">What would you like to send {{ firstName() }}?</div>
        <div class="as-kind">
          <button class="as-kind-btn as-kind-lg rm-press" (click)="chooseAndAssign('task')">
            <ion-icon name="checkbox-outline"></ion-icon>
            Task
          </button>
          <button class="as-kind-btn as-kind-lg rm-press" (click)="chooseAndAssign('reminder')">
            <ion-icon name="notifications-outline"></ion-icon>
            Reminder
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host{display:block}
    .fa-content{--background:var(--rm-bg)}

    /* Hero */
    .fa-hero{background:linear-gradient(160deg,#4F7CF7 0%,#3D5AF1 70%,#2A3FCC 100%);padding:calc(env(safe-area-inset-top) + 10px) 16px 18px;border-radius:0 0 26px 26px}
    .fa-hero-top{display:flex;align-items:center;gap:10px}
    .fa-back{width:36px;height:36px;border:none;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:19px;flex-shrink:0}
    .fa-hero-title{flex:1;text-align:center;color:rgba(255,255,255,.9);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px}
    .fa-hero-spacer{width:36px;flex-shrink:0}
    .fa-identity{display:flex;align-items:center;gap:14px;margin-top:14px}
    .fa-avatar-ring{position:relative;flex-shrink:0;border:2.5px solid rgba(255,255,255,.85);border-radius:50%;padding:2px;background:rgba(255,255,255,.15)}
    .fa-dot{position:absolute;bottom:2px;right:2px;width:13px;height:13px;border-radius:50%;border:2.5px solid #3D5AF1;background:rgba(255,255,255,.45)}
    .fa-dot.online{background:#2CE08B}
    .fa-who{min-width:0}
    .fa-name{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fa-presence{color:rgba(255,255,255,.85);font-size:12.5px;font-weight:600;margin-top:2px}
    .fa-cta-row{display:flex;gap:12px;margin-top:16px}
    .fa-cta{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;border:none;border-radius:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}
    .fa-cta ion-icon{font-size:17px}
    .fa-cta-msg{background:#fff;color:var(--rm-purple);box-shadow:0 3px 12px rgba(0,0,0,.12)}
    .fa-cta-assign{background:rgba(255,255,255,.16);color:#fff;border:1.5px solid rgba(255,255,255,.55)}

    /* Stats */
    .fa-stats{display:flex;gap:10px;margin:-1px 16px 0;padding-top:14px}
    .fa-stat{flex:1;background:var(--rm-card);border-radius:15px;box-shadow:var(--rm-shadow-sm);padding:13px 8px;text-align:center}
    .fa-stat-num{font-size:21px;font-weight:900;color:var(--rm-text-primary)}
    .fa-stat-num.orange{color:var(--rm-warning)}
    .fa-stat-num.green{color:var(--rm-success)}
    .fa-stat-lbl{font-size:10.5px;font-weight:700;color:var(--rm-text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px}

    /* Tabs */
    .fa-tabs{display:flex;gap:4px;margin:14px 16px 12px;background:var(--rm-surface);border-radius:13px;padding:4px}
    .fa-tab{flex:1;padding:9px 4px;border:none;border-radius:10px;background:transparent;color:var(--rm-text-secondary);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
    .fa-tab.active{background:var(--rm-card);color:var(--rm-text-primary);box-shadow:var(--rm-shadow-sm)}
    .fa-tab-n{font-size:11.5px;font-weight:800;color:var(--rm-purple);margin-left:2px}

    /* Items */
    .fa-list{display:flex;flex-direction:column;gap:10px;margin:0 16px}
    .fa-item{background:var(--rm-card);border-radius:15px;box-shadow:var(--rm-shadow-sm);padding:13px 14px}
    .fa-item-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .fa-chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;padding:4px 9px;border-radius:8px}
    .fa-chip ion-icon{font-size:13px}
    .chip-task{background:var(--rm-purple-light);color:var(--rm-purple)}
    .chip-rem{background:rgba(245,158,11,.13);color:#D97706}
    .fa-status{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0}
    .status-sent{background:rgba(234,179,8,.15);color:#B45309}
    .status-received{background:rgba(59,130,246,.15);color:#1D4ED8}
    .status-acknowledged{background:rgba(61,90,241,.15);color:var(--rm-purple)}
    .status-processing{background:rgba(234,88,12,.15);color:#C2410C}
    .status-skipped{background:rgba(107,114,128,.15);color:#6B7280}
    .status-completed{background:rgba(16,185,129,.15);color:#047857}
    .status-active{background:rgba(59,130,246,.15);color:#1D4ED8}
    .status-missed{background:rgba(239,68,68,.15);color:#B91C1C}
    .fa-item-title{font-size:15px;font-weight:700;color:var(--rm-text-primary);margin-top:9px;line-height:1.35}
    .fa-item-meta{font-size:12px;color:var(--rm-text-muted);margin-top:3px}
    .fa-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
    .fa-act{padding:7px 11px;border:none;border-radius:9px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
    .act-start{background:rgba(61,90,241,.12);color:var(--rm-purple)}
    .act-done{background:rgba(16,185,129,.12);color:#047857}
    .act-snooze{background:rgba(234,179,8,.12);color:#B45309}
    .act-skip{background:rgba(107,114,128,.12);color:#6B7280}

    /* Skeleton / empty */
    .fa-skel{height:92px;border-radius:15px;background:var(--rm-surface);margin:0 16px 10px;animation:faPulse 1.5s ease-in-out infinite}
    @keyframes faPulse{0%,100%{opacity:1}50%{opacity:.5}}
    .fa-empty{text-align:center;padding:44px 32px}
    .fa-empty-text{font-size:14px;color:var(--rm-text-muted)}
    .fa-empty-cta{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:11px 20px;background:var(--rm-purple-light);color:var(--rm-purple);border:none;border-radius:12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}

    /* Remove friend */
    .fa-remove{display:flex;align-items:center;justify-content:center;gap:6px;margin:22px 16px 0;width:calc(100% - 32px);padding:12px;background:rgba(239,68,68,.08);color:#EF4444;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
    .fa-remove ion-icon{font-size:16px}
    .fa-bottom-space{height:36px}

    /* Assign sheet */
    .as-backdrop{position:fixed;inset:0;background:rgba(15,15,26,.45);backdrop-filter:blur(2px);z-index:900;animation:asFade .25s ease}
    @keyframes asFade{from{opacity:0}to{opacity:1}}
    .as-sheet{position:fixed;left:0;right:0;bottom:0;z-index:901;background:var(--rm-card);border-radius:24px 24px 0 0;padding:14px 20px calc(env(safe-area-inset-bottom) + 22px);box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:asUp .4s var(--rm-ease-out)}
    @keyframes asUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .as-grip{width:40px;height:4px;border-radius:2px;background:var(--rm-border);margin:0 auto 14px}
    .as-head{display:flex;align-items:center;justify-content:space-between}
    .as-title{font-size:19px;font-weight:800;color:var(--rm-text-primary)}
    .as-close{width:32px;height:32px;border:none;border-radius:50%;background:var(--rm-surface);color:var(--rm-text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px}
    .as-hint{margin-top:14px;font-size:13px;font-weight:600;color:var(--rm-text-muted)}
    .as-kind{display:flex;gap:10px;margin-top:12px;margin-bottom:6px}
    .as-kind-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:1.5px solid var(--rm-border);border-radius:13px;background:var(--rm-card);color:var(--rm-text-secondary);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
    .as-kind-btn ion-icon{font-size:17px}
    .as-kind-lg{flex-direction:column;gap:9px;padding:20px 13px;font-size:15px;font-weight:800;color:var(--rm-text-primary)}
    .as-kind-lg ion-icon{font-size:26px;color:var(--rm-purple)}
    .as-kind-lg:active{border-color:var(--rm-purple);background:var(--rm-purple-light)}
  `],
})
export class FriendActivityComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private chatService   = inject(ChatService);
  private authService   = inject(AuthService);
  private socketService = inject(SocketService);
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private toastCtrl     = inject(ToastController);
  private alertCtrl     = inject(AlertController);
  private timeAmPm      = inject(TimeAmPmPipe);

  protected friendId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly friend    = signal<Friend | null>(null);
  readonly reminders = signal<SharedReminder[]>([]);
  readonly tasks     = signal<SharedTask[]>([]);
  readonly loading   = signal(true);
  readonly tab       = signal<Tab>('all');

  // Assign chooser
  readonly sheetOpen = signal(false);

  private currentUserId = computed(() => this.authService.currentUser()?._id ?? '');
  private subs: Subscription[] = [];

  constructor() {
    addIcons({ arrowBackOutline, chatbubbleEllipsesOutline, checkboxOutline,
               notificationsOutline, personRemoveOutline, closeOutline, addOutline });
  }

  ngOnInit(): void {
    // Live status updates while the page is open — set up once, kept for the
    // lifetime of this (kept-alive) instance so re-entries still get updates.
    this.subs.push(
      this.socketService.on<{ _id: string; sharedStatus: SharedStatus }>('reminder:sharedStatus')
        .subscribe(({ _id, sharedStatus }) => {
          this.reminders.update(list => list.map(r => r._id === _id ? { ...r, sharedStatus } : r));
        }),
      this.socketService.on<{ _id: string; status: 'active' | 'done' }>('task:sharedStatus')
        .subscribe(({ _id, status }) => {
          this.tasks.update(list => list.map(t => t._id === _id ? { ...t, status } : t));
        }),
    );

    // ?assign=task|reminder → straight to the create page pre-set (from chat quick actions)
    const assign = this.route.snapshot.queryParamMap.get('assign');
    if (assign === 'task' || assign === 'reminder') {
      this.chooseAndAssign(assign);
    }
  }

  // Fires on every entry — including returning from the create page, where this
  // page is kept alive by IonicRouteStrategy so ngOnInit does NOT re-run. Always
  // refresh, and reveal the tab a just-assigned item landed on so it's visible.
  ionViewWillEnter(): void {
    this.loadFriend();
    this.loadActivity();

    const reveal = this.friendService.consumePendingActivityReveal();
    if (reveal && reveal.friendId === this.friendId) {
      this.tab.set(reveal.tab);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Data ────────────────────────────────────────────────────────────────
  private loadFriend(): void {
    this.friendService.getFriends().subscribe({
      next: ({ friends }) => this.friend.set(friends.find(f => f._id === this.friendId) ?? null),
    });
  }

  private loadActivity(): void {
    this.friendService.getSharedActivity(this.friendId).subscribe({
      next: ({ reminders, tasks }) => {
        this.reminders.set(reminders);
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Derived state ───────────────────────────────────────────────────────
  readonly items = computed<ActivityItem[]>(() => {
    const me = this.currentUserId();
    const reminderItems = this.reminders().map<ActivityItem>(r => {
      const key = r.sharedStatus ?? 'sent';
      return {
        kind: 'reminder',
        id: r._id,
        title: r.title,
        dateLabel: `${this.shortDate(r.date)} · ${this.timeAmPm.transform(r.time)}`,
        byMe: r.userId === me,
        toMe: r.assignedTo === me,
        statusKey: key,
        statusLabel: this.reminderStatusLabel(key),
        createdAt: r.createdAt ? Date.parse(r.createdAt) : 0,
        reminder: r,
      };
    });
    const taskItems = this.tasks().map<ActivityItem>(t => ({
      kind: 'task',
      id: t._id,
      title: t.title,
      dateLabel: t.dueDate
        ? this.shortDate(t.dueDate) + (t.startTime ? ` · ${this.timeAmPm.transform(t.startTime)}` : '')
        : 'No due date',
      byMe: t.userId === me,
      toMe: t.assignedTo === me,
      statusKey: t.status === 'done' ? 'completed' : 'active',
      statusLabel: t.status === 'done' ? '✅ Completed' : '🔵 Open',
      createdAt: t.createdAt ? Date.parse(t.createdAt) : 0,
      task: t,
    }));
    return [...reminderItems, ...taskItems].sort((a, b) => b.createdAt - a.createdAt);
  });

  readonly visibleItems  = computed(() => this.tab() === 'all' ? this.items() : this.items().filter(i => i.kind === this.tab()));
  readonly taskCount     = computed(() => this.items().filter(i => i.kind === 'task').length);
  readonly reminderCount = computed(() => this.items().filter(i => i.kind === 'reminder').length);
  readonly pendingCount  = computed(() => this.items().filter(i => i.statusKey !== 'completed' && i.statusKey !== 'skipped').length);
  readonly completedCount = computed(() => this.items().filter(i => i.statusKey === 'completed').length);

  friendName(): string { return this.friend()?.name ?? 'Friend'; }
  firstName():  string { return this.friendName().split(' ')[0]; }
  isOnline():   boolean { return this.chatService.isOnline(this.friendId); }

  presenceLabel(): string {
    const iso = this.friend()?.lastSeenAt;
    if (!iso) return 'Offline';
    const seen = new Date(iso);
    const mins = Math.floor((Date.now() - seen.getTime()) / 60000);
    if (mins < 1)   return 'Last seen just now';
    if (mins < 60)  return `Last seen ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last seen ${hours}h ago`;
    return `Last seen ${seen.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/app/friends']);
  }

  /** Message → back to the friends tab with the chat overlay open. */
  openChat(): void {
    this.router.navigate(['/app/friends'], { queryParams: { chat: this.friendId } });
  }

  // ── Item actions ────────────────────────────────────────────────────────
  setReminderStatus(item: ActivityItem, status: SharedStatus): void {
    this.friendService.updateSharedStatus(item.id, status).subscribe({
      next: () => {
        this.reminders.update(list => list.map(r => r._id === item.id ? { ...r, sharedStatus: status, status: status === 'completed' ? 'done' : r.status } : r));
      },
    });
  }

  snooze(item: ActivityItem, minutes: number): void {
    this.friendService.snoozeAssigned(item.id, minutes).subscribe({
      next: async () => {
        const label = minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;
        const t = await this.toastCtrl.create({
          message: `Snoozed for ${label}`, duration: 2000, color: 'warning', position: 'top',
        });
        t.present();
      },
    });
  }

  toggleTask(item: ActivityItem): void {
    this.friendService.toggleTask(item.id).subscribe({
      next: ({ data }) => {
        this.tasks.update(list => list.map(t => t._id === item.id ? { ...t, status: data.status } : t));
      },
    });
  }

  // ── Assign chooser ──────────────────────────────────────────────────────
  openSheet(): void {
    this.sheetOpen.set(true);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  /** Hand off to the full create page with this friend pre-selected. */
  chooseAndAssign(kind: 'task' | 'reminder'): void {
    this.sheetOpen.set(false);
    const path = kind === 'task' ? '/app/tasks/new' : '/app/reminders/create';
    this.router.navigate([path], { queryParams: { assignTo: this.friendId } });
  }

  // ── Remove friend ───────────────────────────────────────────────────────
  async confirmUnfriend(): Promise<void> {
    const friend = this.friend();
    if (!friend) return;
    const alert = await this.alertCtrl.create({
      header: 'Remove friend',
      message: `Remove ${friend.name} from your accountability buddies?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            this.friendService.remove(friend.friendshipId).subscribe({
              next: async () => {
                const toast = await this.toastCtrl.create({
                  message: `${friend.name} removed from friends`,
                  duration: 2500, color: 'medium', position: 'top',
                });
                toast.present();
                this.router.navigate(['/app/friends']);
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private reminderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      sent:         '📤 Sent',
      received:     '📬 Received',
      acknowledged: '👀 Acknowledged',
      processing:   '🔄 In Progress',
      skipped:      '⏭ Skipped',
      completed:    '✅ Completed',
    };
    return map[status] ?? '📤 Sent';
  }

  private shortDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
