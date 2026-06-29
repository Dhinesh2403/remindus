// src/app/reminders/list/reminder-list.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonFab, IonFabButton, IonIcon,
  IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem,
  IonSkeletonText,
  AlertController, ToastController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, checkmarkCircleOutline, timeOutline,
  trashOutline, personOutline, arrowDownOutline,
  playSkipForwardOutline,
} from 'ionicons/icons';
import {
  ReminderService, Reminder, ReceivedReminder,
  ReminderType, AssignedUser,
} from '../../core/services/reminder.service';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';

const CATEGORY_META: Record<ReminderType, { emoji: string; color: string; label: string }> = {
  birthday: { emoji: '🎂', color: '#EC4899', label: 'Birthday' },
  wedding:  { emoji: '💍', color: '#8B5CF6', label: 'Wedding' },
  medicine: { emoji: '💊', color: '#EF4444', label: 'Medicine' },
  bill:     { emoji: '💰', color: '#3B82F6', label: 'Bill' },
  study:    { emoji: '📚', color: '#10B981', label: 'Study' },
  work:     { emoji: '💼', color: '#F59E0B', label: 'Work' },
  general:  { emoji: '📌', color: '#6B7280', label: 'General' },
  custom:   { emoji: '✨', color: '#3D5AF1', label: 'Custom' },
};

const REMINDER_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: '#F59E0B' },
  done:     { label: 'Done',     color: '#10B981' },
  snoozed:  { label: 'Snoozed',  color: '#3B82F6' },
  missed:   { label: 'Missed',   color: '#EF4444' },
};

const SHARED_STATUS_META: Record<string, { label: string; color: string }> = {
  sent:         { label: 'Sent',         color: '#3B82F6' },
  received:     { label: 'Received',     color: '#F59E0B' },
  acknowledged: { label: 'Acknowledged', color: '#06B6D4' },
  processing:   { label: 'Processing',   color: '#8B5CF6' },
  skipped:      { label: 'Skipped',      color: '#9CA3AF' },
  completed:    { label: 'Completed',    color: '#10B981' },
};

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonFab, IonFabButton, IonIcon,
    IonRefresher, IonRefresherContent,
    IonItemSliding, IonItemOptions, IonItemOption, IonItem,
    IonSkeletonText,
    TimeAmPmPipe,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Reminders</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="reminder-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Calendar date strip -->
      <div class="cal-strip">
        @for (day of calendarDays(); track day.dateStr) {
          <div
            class="cal-day"
            [class.cal-today]="day.isToday"
            [class.cal-selected]="day.dateStr === selectedDate()"
            (click)="toggleDay(day.dateStr)"
          >
            <span class="cal-weekday">{{ day.weekday }}</span>
            <span class="cal-num">{{ day.num }}</span>
            @if (day.hasMissed) {
              <span class="cal-dot dot-missed"></span>
            } @else if (day.hasPending) {
              <span class="cal-dot dot-pending"></span>
            } @else if (day.hasDone) {
              <span class="cal-dot dot-done"></span>
            }
          </div>
        }
      </div>

      <!-- Skeleton — only on very first load -->
      @if (isLoading()) {
        <div class="list-body">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width:44px;height:44px;border-radius:14px;flex-shrink:0"></ion-skeleton-text>
              <div style="flex:1;padding-left:12px">
                <ion-skeleton-text animated style="width:70%;height:16px;margin-bottom:8px;border-radius:4px"></ion-skeleton-text>
                <ion-skeleton-text animated style="width:45%;height:12px;border-radius:4px"></ion-skeleton-text>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="list-body">

          <!-- ── Mine section ── -->
          @if (mine().length > 0) {
            <div class="section-label">Mine</div>
            @for (r of mine(); track r._id) {
              <ion-item-sliding>

                <ion-item-options side="start">
                  <ion-item-option color="success" expandable (click)="markDone(r)">
                    <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card"
                    [class.done-card]="r.status === 'done'"
                    [class.missed-card]="r.status === 'missed'"
                    [style.border-left-color]="meta(r.type).color"
                    (click)="openDetail(r._id)"
                  >
                    <div class="card-row">
                      <span class="card-emoji">{{ meta(r.type).emoji }}</span>
                      <div class="card-mid">
                        <div class="card-title" [class.done-text]="r.status === 'done'">{{ r.title }}</div>
                        @if (r.description) {
                          <div class="card-desc">{{ r.description }}</div>
                        }
                        <div class="card-meta">
                          <ion-icon name="time-outline"></ion-icon>
                          {{ r.time | timeAmPm }}
                        </div>
                      </div>
                      <div class="card-right">
                        <div class="date-pill" [class.today-pill]="isToday(r.date) && r.status !== 'done'">
                          @if (isToday(r.date) && r.status !== 'done') {
                            <span class="today-label">TODAY</span>
                          } @else {
                            <span class="date-num">{{ dateNum(r.date) }}</span>
                            <span class="date-mon">{{ dateMon(r.date) }}</span>
                          }
                        </div>
                        <div
                          class="status-badge"
                          [style.background]="reminderStatusMeta(r.status).color + '22'"
                          [style.color]="reminderStatusMeta(r.status).color"
                        >{{ reminderStatusMeta(r.status).label }}</div>
                      </div>
                    </div>
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="danger" expandable (click)="confirmDelete(r)">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- ── Sent to Friends section ── -->
          @if (sentToFriends().length > 0) {
            <div class="section-label" [style.margin-top]="mine().length > 0 ? '20px' : '0'">
              Sent to Friends
            </div>
            @for (r of sentToFriends(); track r._id) {
              <ion-item-sliding>

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card friend-card"
                    [style.border-left-color]="meta(r.type).color"
                    (click)="openDetail(r._id)"
                  >
                    <div class="card-row">
                      <span class="card-emoji">{{ meta(r.type).emoji }}</span>
                      <div class="card-mid">
                        <div class="card-title">{{ r.title }}</div>
                        <div class="friend-row">
                          <ion-icon name="person-outline"></ion-icon>
                          <span class="friend-name">{{ assignedName(r) }}</span>
                        </div>
                        <div class="card-meta">
                          <ion-icon name="time-outline"></ion-icon>
                          {{ r.time | timeAmPm }}
                        </div>
                      </div>
                      <div class="card-right">
                        <div class="date-pill" [class.today-pill]="isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped'">
                          @if (isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                            <span class="today-label">TODAY</span>
                          } @else {
                            <span class="date-num">{{ dateNum(r.date) }}</span>
                            <span class="date-mon">{{ dateMon(r.date) }}</span>
                          }
                        </div>
                        <div
                          class="status-badge"
                          [style.background]="sharedStatusMeta(r.sharedStatus).color + '22'"
                          [style.color]="sharedStatusMeta(r.sharedStatus).color"
                        >{{ sharedStatusMeta(r.sharedStatus).label }}</div>
                      </div>
                    </div>
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="danger" expandable (click)="confirmDelete(r)">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- ── From Friends section ── -->
          @if (fromFriends().length > 0) {
            <div class="section-label from-label"
              [style.margin-top]="(mine().length > 0 || sentToFriends().length > 0) ? '20px' : '0'">
              <ion-icon name="arrow-down-outline" style="font-size:11px;margin-right:4px;vertical-align:middle"></ion-icon>
              From Friends
            </div>
            @for (r of fromFriends(); track r._id) {
              <ion-item-sliding>

                <ion-item-options side="start">
                  <ion-item-option color="success" expandable (click)="completeReceived(r)">
                    <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card from-card"
                    [class.done-card]="r.sharedStatus === 'completed'"
                    [style.border-left-color]="meta(r.type).color"
                  >
                    <div class="card-row">
                      <span class="card-emoji">{{ meta(r.type).emoji }}</span>
                      <div class="card-mid">
                        <div class="card-title" [class.done-text]="r.sharedStatus === 'completed'">{{ r.title }}</div>
                        <div class="friend-row from-friend-row">
                          <ion-icon name="person-outline"></ion-icon>
                          <span class="friend-name">{{ r.userId.name }}</span>
                        </div>
                        @if (r.description) {
                          <div class="card-desc">{{ r.description }}</div>
                        }
                        <div class="card-meta">
                          <ion-icon name="time-outline"></ion-icon>
                          {{ r.time | timeAmPm }}
                        </div>
                      </div>
                      <div class="card-right">
                        <div class="date-pill" [class.today-pill]="isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped'">
                          @if (isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                            <span class="today-label">TODAY</span>
                          } @else {
                            <span class="date-num">{{ dateNum(r.date) }}</span>
                            <span class="date-mon">{{ dateMon(r.date) }}</span>
                          }
                        </div>
                        <div
                          class="status-badge"
                          [style.background]="sharedStatusMeta(r.sharedStatus).color + '22'"
                          [style.color]="sharedStatusMeta(r.sharedStatus).color"
                        >{{ sharedStatusMeta(r.sharedStatus).label }}</div>
                      </div>
                    </div>
                    @if (r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                      <div class="from-action-strip" (click)="$event.stopPropagation()">
                        <button class="fas-btn fas-done"   (click)="completeReceived(r)">✅ Done</button>
                        <button class="fas-btn fas-update" (click)="changeReceivedStatus(r)">🔄 Status</button>
                        <button class="fas-btn fas-skip"   (click)="skipReceived(r)">⏭️ Skip</button>
                      </div>
                    }
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="warning" expandable (click)="skipReceived(r)">
                    <ion-icon slot="icon-only" name="play-skip-forward-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- Empty state -->
          @if (mine().length === 0 && sentToFriends().length === 0 && fromFriends().length === 0) {
            <div class="empty-state">
              <div class="empty-emoji">🔔</div>
              <h3>{{ selectedDate() ? 'No reminders on this day' : 'No reminders yet' }}</h3>
              <p>{{ selectedDate() ? 'Try another date or tap +' : 'Tap + to create your first reminder' }}</p>
            </div>
          }

        </div>
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button color="primary" (click)="router.navigate(['/app/reminders/create'])">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

    </ion-content>
  `,
  styles: [`
    .reminder-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); --color: var(--rm-text-primary); }

    /* ── Calendar strip ── */
    .cal-strip {
      display: flex;
      gap: 6px;
      padding: 14px 16px 10px;
      overflow-x: auto;
      scrollbar-width: none;
      background: var(--rm-card);
      border-bottom: 1px solid var(--rm-border);
    }
    .cal-strip::-webkit-scrollbar { display: none; }
    .cal-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 46px;
      padding: 8px 6px 6px;
      border-radius: 14px;
      cursor: pointer;
      gap: 3px;
      transition: background 0.15s;
    }
    .cal-weekday { font-size: 10px; font-weight: 600; color: var(--rm-text-muted); text-transform: uppercase; }
    .cal-num { font-size: 18px; font-weight: 800; color: var(--rm-text-primary); line-height: 1.1; }
    .cal-today .cal-num { color: var(--rm-purple); }
    .cal-today .cal-weekday { color: var(--rm-purple); }
    .cal-selected { background: var(--rm-purple); }
    .cal-selected .cal-weekday, .cal-selected .cal-num { color: #fff !important; }
    .cal-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-missed  { background: #EF4444; }
    .dot-pending { background: #F97316; }
    .dot-done    { background: #10B981; }
    .cal-selected .cal-dot { opacity: 0.85; }

    /* ── List body ── */
    .list-body { padding: 12px 16px 110px; display: flex; flex-direction: column; gap: 8px; }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--rm-text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 2px 6px;
      display: flex;
      align-items: center;
    }
    .from-label { color: #10B981; }

    /* ── Cards ── */
    .slide-item { --padding-start: 0; --inner-padding-end: 0; --background: transparent; }
    .rem-card {
      background: var(--rm-card);
      border-radius: 18px;
      padding: 14px;
      box-shadow: var(--rm-shadow-sm);
      border-left: 4px solid var(--rm-border);
      width: 100%;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .rem-card:active { opacity: 0.85; }
    .done-card   { opacity: 0.55; }
    .missed-card { opacity: 0.7; }
    .friend-card { border-left-style: dashed; }
    .from-card   { border-left-style: dotted; border-left-width: 4px; }

    .card-row { display: flex; align-items: flex-start; gap: 10px; }
    .card-emoji { font-size: 26px; flex-shrink: 0; }
    .card-mid { flex: 1; min-width: 0; }
    .card-title { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .done-text { text-decoration: line-through; color: var(--rm-text-muted); }
    .card-desc { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .friend-row { display: flex; align-items: center; gap: 3px; margin-top: 3px; color: var(--rm-purple); }
    .from-friend-row { color: #10B981; }
    .friend-name { font-size: 12px; font-weight: 600; }
    .friend-row ion-icon { font-size: 12px; }
    .card-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--rm-text-muted); margin-top: 4px; }
    .card-meta ion-icon { font-size: 13px; }

    /* ── Right column ── */
    .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .date-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--rm-purple-light);
      border-radius: 10px;
      padding: 4px 8px;
      min-width: 38px;
    }
    .date-num { font-size: 16px; font-weight: 800; color: var(--rm-purple); line-height: 1; }
    .date-mon { font-size: 10px; font-weight: 600; color: var(--rm-purple); text-transform: uppercase; }
    .today-pill { background: rgba(239,68,68,0.1); border: 1.5px solid rgba(239,68,68,0.3); }
    .today-label { font-size: 10px; font-weight: 800; color: #EF4444; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 0; }
    .status-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      white-space: nowrap;
      text-align: center;
    }
    .from-action-strip { display:flex; gap:6px; margin-top:10px; border-top:1px solid var(--rm-border); padding-top:8px; }
    .fas-btn { flex:1; padding:6px 4px; border:none; border-radius:10px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; }
    .fas-done   { background:rgba(16,185,129,0.12); color:#10B981; }
    .fas-update { background:rgba(139,92,246,0.12); color:#8B5CF6; }
    .fas-skip   { background:rgba(156,163,175,0.12); color:#6B7280; }

    /* ── Skeleton ── */
    .skeleton-card { display: flex; align-items: center; padding: 14px; background: var(--rm-card); border-radius: 18px; }

    /* ── Empty ── */
    .empty-state { text-align: center; padding: 70px 32px; }
    .empty-emoji { font-size: 56px; margin-bottom: 12px; }
    .empty-state h3 { font-size: 17px; font-weight: 700; color: var(--rm-text-primary); margin-bottom: 6px; }
    .empty-state p { font-size: 13px; color: var(--rm-text-muted); }

    ion-fab-button { --background: var(--rm-purple); --box-shadow: 0 6px 20px rgba(61,90,241,0.4); }
  `],
})
export class ReminderListComponent implements OnInit {
  protected router = inject(Router);
  private reminderService     = inject(ReminderService);
  private alertCtrl           = inject(AlertController);
  private toastCtrl           = inject(ToastController);
  private actionSheetCtrl     = inject(ActionSheetController);

  isLoading = signal(true);
  selectedDate = signal<string>('');

  readonly reminders         = this.reminderService.reminders;
  readonly receivedReminders = this.reminderService.receivedReminders;

  readonly calendarDays = computed(() => {
    const own      = this.reminders();
    const received = this.receivedReminders();
    const today    = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 3 + i);
      const dateStr = this.localDateStr(d);
      const dayOwn      = own.filter(r => this.localDateStr(new Date(r.date)) === dateStr);
      const dayReceived = received.filter(r => this.localDateStr(new Date(r.date)) === dateStr);
      const all         = [...dayOwn, ...dayReceived];
      return {
        dateStr,
        num:        d.getDate(),
        weekday:    d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        isToday:    i === 3,
        hasMissed:  all.some(r => r.status === 'missed'),
        hasPending: all.some(r => r.status === 'pending' || r.status === 'snoozed'),
        hasDone:    all.some(r => r.status === 'done'),
      };
    });
  });

  private readonly filteredOwn = computed(() => {
    const sel = this.selectedDate();
    const all = this.reminders();
    if (!sel) return all;
    return all.filter(r => this.localDateStr(new Date(r.date)) === sel);
  });

  private readonly filteredReceived = computed(() => {
    const sel = this.selectedDate();
    const all = this.receivedReminders();
    if (!sel) return all;
    return all.filter(r => this.localDateStr(new Date(r.date)) === sel);
  });

  private readonly todayDateStr = this.localDateStr(new Date());

  isToday(dateStr: string): boolean {
    return this.localDateStr(new Date(dateStr)) === this.todayDateStr;
  }

  // pending-today → pending-future → missed → done  (within each group: newest createdAt first)
  private sortOwn(items: Reminder[]): Reminder[] {
    return [...items].sort((a, b) => {
      const rank = (r: Reminder) => {
        const active = r.status === 'pending' || r.status === 'snoozed';
        if (active && this.isToday(r.date)) return 0;
        if (active)                           return 1;
        if (r.status === 'missed')            return 2;
        return 3;
      };
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      // Most recently created shows first within each group
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // active (not completed/skipped) → completed/skipped  (within each group: today first, then earliest)
  private sortReceived(items: ReceivedReminder[]): ReceivedReminder[] {
    const DONE = new Set(['completed', 'skipped']);
    return [...items].sort((a, b) => {
      const aDone = DONE.has(a.sharedStatus ?? '');
      const bDone = DONE.has(b.sharedStatus ?? '');
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!aDone) {
        const aToday = this.isToday(a.date), bToday = this.isToday(b.date);
        if (aToday !== bToday) return aToday ? -1 : 1;
      }
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    });
  }

  readonly mine = computed(() =>
    this.sortOwn(this.filteredOwn().filter(r => !r.assignedTo || typeof r.assignedTo !== 'object'))
  );

  readonly sentToFriends = computed(() =>
    this.sortOwn(this.filteredOwn().filter(r => r.assignedTo && typeof r.assignedTo === 'object'))
  );

  readonly fromFriends = computed(() => this.sortReceived(this.filteredReceived()));

  constructor() {
    addIcons({ addOutline, checkmarkCircleOutline, timeOutline, trashOutline, personOutline, arrowDownOutline, playSkipForwardOutline });
  }

  ngOnInit(): void {
    // Skip skeleton when data was already pre-loaded by the main layout
    const hasData = this.reminders().length > 0 || this.receivedReminders().length > 0;
    if (!hasData) this.isLoading.set(true);
    Promise.all([
      this.reminderService.getAll({ limit: 100 }).toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => this.isLoading.set(false));
  }

  // Fires every time this tab is entered — always do a silent background refresh
  ionViewWillEnter(): void {
    this.reminderService.getAll({ limit: 100 }).subscribe();
    this.reminderService.getReceived().subscribe();
  }

  doRefresh(event: CustomEvent): void {
    Promise.all([
      this.reminderService.getAll({ limit: 100 }).toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => (event.target as HTMLIonRefresherElement).complete());
  }

  toggleDay(dateStr: string): void {
    this.selectedDate.update(cur => cur === dateStr ? '' : dateStr);
  }

  openDetail(id: string): void {
    this.router.navigate(['/app/reminders', id]);
  }

  markDone(r: Reminder): void {
    this.reminderService.markDone(r._id).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `✅ "${r.title}" marked as done!`,
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  completeReceived(r: ReceivedReminder): void {
    this.reminderService.updateSharedStatus(r._id, 'completed').subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `✅ "${r.title}" marked as completed!`,
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  skipReceived(r: ReceivedReminder): void {
    this.reminderService.updateSharedStatus(r._id, 'skipped').subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `⏭️ "${r.title}" skipped.`,
          duration: 2000,
          color: 'warning',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  async changeReceivedStatus(r: ReceivedReminder): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: r.title,
      subHeader: 'Update your status on this reminder',
      buttons: [
        { text: '👀 Acknowledged',  data: 'acknowledged' },
        { text: '🔄 In Progress',   data: 'processing'   },
        { text: '✅ Completed',     data: 'completed'    },
        { text: '⏭️ Skip',         data: 'skipped'      },
        { text: 'Cancel',           role: 'cancel'       },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss();
    if (!data) return;
    this.reminderService.updateSharedStatus(r._id, data).subscribe();
  }

  async confirmDelete(r: Reminder): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Reminder',
      message: `Delete "${r.title}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.reminderService.delete(r._id).subscribe(),
        },
      ],
    });
    await alert.present();
  }

  meta(type: ReminderType) { return CATEGORY_META[type] ?? CATEGORY_META.general; }

  reminderStatusMeta(status: string) {
    return REMINDER_STATUS_META[status] ?? { label: status, color: '#9CA3AF' };
  }

  sharedStatusMeta(status?: string | null) {
    if (!status) return SHARED_STATUS_META['sent'];
    return SHARED_STATUS_META[status] ?? { label: status, color: '#9CA3AF' };
  }

  assignedName(r: Reminder): string {
    if (r.assignedTo && typeof r.assignedTo === 'object') {
      return (r.assignedTo as AssignedUser).name;
    }
    return 'Friend';
  }

  dateNum(isoDate: string): number {
    return new Date(isoDate).getDate();
  }

  dateMon(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short' });
  }

  private localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
