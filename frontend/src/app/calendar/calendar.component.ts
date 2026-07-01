// src/app/calendar/calendar.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAmPmPipe } from '../core/pipes/time-ampm.pipe';
import {
  IonContent, IonHeader, IonToolbar, IonIcon, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { ReminderService, Reminder, ReceivedReminder, ReminderType, RepeatType } from '../core/services/reminder.service';

interface CalReminder {
  _id:          string;
  title:        string;
  date:         string;  // original date (used for repeat origin)
  time:         string;
  type:         ReminderType;
  repeatType:   RepeatType;
  status:       string;
  sharedStatus: string | null | undefined;
  isReceived:   boolean;
  fromName?:    string;
}

interface CalendarDay {
  date:        Date;
  day:         number;
  isToday:     boolean;
  isSelected:  boolean;
  isOtherMonth:boolean;
  reminders:   CalReminder[];
}

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const CAT_COLOR: Record<string, string> = {
  birthday: '#EC4899', wedding: '#8B5CF6', medicine: '#EF4444',
  bill: '#3B82F6', study: '#10B981', work: '#F59E0B',
  general: '#6B7280', custom: '#3D5AF1',
};
const CAT_EMOJI: Record<string, string> = {
  birthday: '🎂', wedding: '💍', medicine: '💊',
  bill: '💰', study: '📚', work: '💼',
  general: '📌', custom: '✨',
};
const SHARED_COLOR: Record<string, string> = {
  sent: '#3B82F6', received: '#F59E0B', acknowledged: '#06B6D4',
  processing: '#8B5CF6', skipped: '#9CA3AF', completed: '#10B981',
};
const SHARED_LABEL: Record<string, string> = {
  sent: 'Sent', received: 'Received', acknowledged: 'Acknowledged',
  processing: 'In Progress', skipped: 'Skipped', completed: 'Completed',
};
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', done: '#10B981', snoozed: '#3B82F6', missed: '#EF4444',
};

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule, TimeAmPmPipe,
    IonContent, IonHeader, IonToolbar, IonIcon,
    IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="cal-header-inner">
          <div>
            <div class="cal-title">Calendar</div>
            <div class="cal-subtitle">{{ currentMonthLabel() }}</div>
          </div>
          <div class="view-toggle">
            <button class="view-toggle-btn" [class.active]="viewMode() === 'month'" (click)="viewMode.set('month')">Month</button>
            <button class="view-toggle-btn" [class.active]="viewMode() === 'week'"  (click)="viewMode.set('week')">Week</button>
          </div>
          <button class="btn-today" (click)="goToday()">Today</button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="cal-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- ── WEEK VIEW ── -->
      @if (viewMode() === 'week') {
        <div class="week-header">
          <button class="nav-btn" (click)="prevWeek()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div class="month-label">{{ currentMonthLabel() }}</div>
          <button class="nav-btn" (click)="nextWeek()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="week-days-row">
          @for (d of weekDays(); track d.date.toISOString()) {
            <div class="week-day-col" [class.wk-selected]="d.isSelected" [class.wk-today]="d.isToday" (click)="selected.set(d.date)">
              <div class="wk-dow">{{ d.weekday }}</div>
              <div class="wk-num">{{ d.num }}</div>
              @if (d.reminders.length > 0) {
                <div class="wk-dot"></div>
              }
            </div>
          }
        </div>
        <!-- Time slots -->
        <div class="week-slots">
          @for (h of hours; track h) {
            <div class="slot-row">
              <div class="slot-hour">{{ formatHour(h) }}</div>
              <div class="slot-line">
                @for (r of selectedDayReminders(); track r._id) {
                  @if (getHour(r.time) === h) {
                    <div class="slot-event" [style.background]="getCatColor(r.type) + '22'" [style.border-left-color]="getCatColor(r.type)">
                      {{ r.title }}
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ── MONTH VIEW ── -->
      @if (viewMode() === 'month') {

      <!-- Month navigator -->
      <div class="month-nav">
        <button class="nav-btn" (click)="prevMonth()">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <div class="month-label">{{ currentMonthLabel() }}</div>
        <button class="nav-btn" (click)="nextMonth()">
          <ion-icon name="chevron-forward-outline"></ion-icon>
        </button>
      </div>

      <!-- Day-of-week headers -->
      <div class="dow-row">
        @for (d of dowLabels; track d) {
          <div class="dow-cell">{{ d }}</div>
        }
      </div>

      <!-- Calendar days grid -->
      <div class="days-grid">
        @for (day of calDays(); track day.date.toISOString()) {
          <div
            class="day-cell"
            [class.other-month]="day.isOtherMonth"
            [class.is-today]="day.isToday"
            [class.is-selected]="day.isSelected"
            (click)="selectDay(day)"
          >
            <span class="day-num">{{ day.day }}</span>
            @if (day.reminders.length > 0 && !day.isToday) {
              <div class="dots-row">
                @for (r of day.reminders.slice(0,3); track r._id) {
                  <span class="dot" [style.background]="getCatColor(r.type)"></span>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Selected day events -->
      <div class="events-section">
        <div class="events-title">
          {{ selectedDateLabel() }}
          @if (selectedDayReminders().length > 0) {
            <span class="events-count">{{ selectedDayReminders().length }}</span>
          }
        </div>

        @if (selectedDayReminders().length === 0) {
          <div class="no-events">
            <span class="no-events-emoji">✨</span>
            <p>No reminders on this day</p>
          </div>
        } @else {
          <div class="events-list">
            @for (r of selectedDayReminders(); track r._id) {
              <div class="event-card" [style.border-left-color]="getCatColor(r.type)" [class.event-done]="r.status === 'done'">
                <span class="event-emoji">{{ getCatEmoji(r.type) }}</span>
                <div class="event-info">
                  <div class="event-title">{{ r.title }}</div>
                  <div class="event-time">
                    {{ r.time | timeAmPm }}
                    @if (r.isReceived && r.fromName) {
                      <span class="event-from"> · from {{ r.fromName }}</span>
                    }
                  </div>
                </div>
                <div class="event-right">
                  @if (r.sharedStatus) {
                    <span class="event-status-chip"
                      [style.background]="getSharedColor(r.sharedStatus) + '22'"
                      [style.color]="getSharedColor(r.sharedStatus)"
                    >{{ getSharedLabel(r.sharedStatus) }}</span>
                  } @else {
                    <span class="event-status-chip"
                      [style.background]="getStatusColor(r.status) + '22'"
                      [style.color]="getStatusColor(r.status)"
                    >{{ r.status }}</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
      } <!-- end @if month -->

    </ion-content>
  `,
  styles: [`
    .cal-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); }
    .cal-header-inner { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 16px 16px; }
    .cal-title { font-size: 28px; font-weight: 900; color: var(--rm-text-primary); }
    .cal-subtitle { font-size: 14px; color: var(--rm-text-muted); margin-top: 2px; }
    .btn-today { padding: 8px 18px; background: var(--rm-purple-light); color: var(--rm-purple); border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }

    /* Month nav */
    .month-nav { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--rm-card); }
    .month-label { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); }
    .nav-btn { width: 36px; height: 36px; border: 1.5px solid var(--rm-border); border-radius: 10px; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--rm-text-secondary); }
    .nav-btn ion-icon { font-size: 16px; }

    /* Day grid */
    .dow-row { display: grid; grid-template-columns: repeat(7,1fr); padding: 8px 12px 0; background: var(--rm-card); }
    .dow-cell { text-align: center; font-size: 11px; color: var(--rm-text-muted); font-weight: 700; padding: 4px 0; }
    .days-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; padding: 4px 12px 16px; background: var(--rm-card); border-radius: 0 0 24px 24px; box-shadow: var(--rm-shadow-md); }
    .day-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 12px; cursor: pointer; border: 1.5px solid var(--rm-border); position: relative; transition: all .15s; }
    .day-cell:active { transform: scale(0.92); }
    .day-cell.other-month { border-color: transparent; }
    .day-cell.other-month .day-num { color: var(--rm-text-muted); opacity: 0.4; }
    .day-cell.is-today { background: var(--rm-purple); border-color: var(--rm-purple); }
    .day-cell.is-today .day-num { color: white; font-weight: 800; }
    .day-cell.is-selected:not(.is-today) { background: var(--rm-purple-light); border-color: var(--rm-purple); }
    .day-cell:hover:not(.is-today):not(.other-month) { background: var(--rm-purple-light); }
    .day-num { font-size: 13px; font-weight: 500; color: var(--rm-text-primary); }
    .dots-row { display: flex; gap: 2px; position: absolute; bottom: 3px; }
    .dot { width: 5px; height: 5px; border-radius: 50%; }

    /* Events */
    .events-section { padding: 16px; }
    .events-title { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .events-count { background: var(--rm-purple); color: white; border-radius: 20px; padding: 2px 9px; font-size: 12px; font-weight: 700; }
    .no-events { text-align: center; padding: 32px 0; }
    .no-events-emoji { font-size: 40px; display: block; margin-bottom: 8px; }
    .no-events p { font-size: 14px; color: var(--rm-text-muted); }
    .events-list { display: flex; flex-direction: column; gap: 10px; }
    .event-card { background: var(--rm-card); border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; box-shadow: var(--rm-shadow-sm); border-left: 4px solid var(--rm-border); }
    .event-card.event-done { opacity: 0.6; }
    .event-emoji { font-size: 22px; flex-shrink: 0; }
    .event-info { flex: 1; min-width: 0; }
    .event-title { font-size: 14px; font-weight: 700; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .event-time { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .event-from { font-style: italic; }
    .event-right { flex-shrink: 0; }
    .event-status-chip { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: capitalize; white-space: nowrap; }

    /* View toggle */
    .view-toggle { display: flex; background: var(--rm-surface); border-radius: 10px; padding: 3px; gap: 2px; }
    .view-toggle-btn { height: 30px; padding: 0 14px; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--rm-text-secondary); background: transparent; cursor: pointer; font-family: inherit; }
    .view-toggle-btn.active { background: var(--rm-card); color: var(--rm-purple); box-shadow: 0 1px 4px rgba(0,0,0,.1); }

    /* Week view */
    .week-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--rm-card); }
    .week-days-row { display: flex; background: var(--rm-card); padding: 0 12px 12px; border-radius: 0 0 20px 20px; box-shadow: var(--rm-shadow-md); }
    .week-day-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 12px; cursor: pointer; }
    .week-day-col.wk-today .wk-num { background: var(--rm-purple); color: #fff; }
    .week-day-col.wk-selected:not(.wk-today) .wk-num { background: var(--rm-purple-light); color: var(--rm-purple); }
    .wk-dow { font-size: 10px; font-weight: 700; color: var(--rm-text-muted); }
    .wk-num { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--rm-text-primary); }
    .wk-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--rm-purple); }

    .week-slots { padding: 12px 0; }
    .slot-row { display: flex; align-items: flex-start; min-height: 56px; }
    .slot-hour { width: 52px; flex-shrink: 0; text-align: right; padding-right: 10px; font-size: 11px; color: var(--rm-text-muted); padding-top: 4px; }
    .slot-line { flex: 1; border-top: 1px solid var(--rm-border); padding: 4px 12px 4px 8px; min-height: 48px; position: relative; }
    .slot-event { border-left: 3px solid; border-radius: 8px; padding: 4px 8px; font-size: 12px; font-weight: 600; color: var(--rm-text-primary); margin-bottom: 4px; }
  `],
})
export class CalendarComponent implements OnInit {
  private reminderService = inject(ReminderService);

  dowLabels = DOW;
  today     = new Date();
  viewDate  = signal(new Date());
  selected  = signal(new Date());
  viewMode  = signal<'month' | 'week'>('month');

  private toCalReminder = (r: Reminder): CalReminder => ({
    _id:          r._id,
    title:        r.title,
    date:         r.date,
    time:         r.time,
    type:         r.type,
    repeatType:   r.repeatType ?? 'none',
    status:       r.status,
    sharedStatus: r.sharedStatus,
    isReceived:   false,
  });

  private toCalReceived = (r: ReceivedReminder): CalReminder => ({
    _id:          r._id,
    title:        r.title,
    date:         r.date,
    time:         r.time,
    type:         r.type,
    repeatType:   r.repeatType ?? 'none',
    status:       r.status,
    sharedStatus: r.sharedStatus,
    isReceived:   true,
    fromName:     (r.userId as { name: string })?.name,
  });

  readonly allReminders = computed((): CalReminder[] => [
    ...this.reminderService.reminders().map(r => this.toCalReminder(r)),
    ...this.reminderService.receivedReminders().map(r => this.toCalReceived(r)),
  ]);

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }

  ngOnInit() {
    this.reminderService.getAll({ limit: 100 }).subscribe();
    this.reminderService.getReceived().subscribe();
  }

  doRefresh(event: CustomEvent) {
    Promise.all([
      this.reminderService.getAll({ limit: 100 }).toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => (event.target as HTMLIonRefresherElement).complete());
  }

  readonly currentMonthLabel = computed(() => {
    const d = this.viewDate();
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  readonly selectedDateLabel = computed(() => {
    const s = this.selected();
    const t = this.today;
    if (s.toDateString() === t.toDateString()) return "Today's Reminders";
    return s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  readonly calDays = computed((): CalendarDay[] => {
    const v   = this.viewDate();
    const sel = this.selected();
    const rem = this.allReminders();
    const year  = v.getFullYear();
    const month = v.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(this.buildDay(new Date(year, month - 1, prevLast - i), rem, sel, true));
    }
    for (let i = 1; i <= lastDate; i++) {
      days.push(this.buildDay(new Date(year, month, i), rem, sel, false));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(this.buildDay(new Date(year, month + 1, i), rem, sel, true));
    }
    return days;
  });

  readonly selectedDayReminders = computed(() => {
    const sel = this.selected();
    return this.allReminders()
      .filter(r => this.reminderOccursOn(r, sel))
      .sort((a, b) => a.time.localeCompare(b.time));
  });

  private reminderOccursOn(r: CalReminder, date: Date): boolean {
    const origin = new Date(r.date);
    // Never show before the reminder was originally created
    if (date < new Date(origin.getFullYear(), origin.getMonth(), origin.getDate())) return false;
    switch (r.repeatType) {
      case 'yearly':
        return date.getMonth() === origin.getMonth() && date.getDate() === origin.getDate();
      case 'monthly':
        return date.getDate() === origin.getDate();
      case 'weekly':
        return date.getDay() === origin.getDay();
      case 'daily':
        return true;
      default:
        return date.toDateString() === origin.toDateString();
    }
  }

  private buildDay(date: Date, reminders: CalReminder[], selected: Date, isOtherMonth: boolean): CalendarDay {
    return {
      date,
      day: date.getDate(),
      isToday:      date.toDateString() === this.today.toDateString(),
      isSelected:   date.toDateString() === selected.toDateString(),
      isOtherMonth,
      reminders: reminders.filter(r => this.reminderOccursOn(r, date)),
    };
  }

  selectDay(day: CalendarDay) { this.selected.set(day.date); }

  prevMonth() {
    this.viewDate.update(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  nextMonth() {
    this.viewDate.update(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  goToday() {
    this.viewDate.set(new Date());
    this.selected.set(new Date());
  }

  getCatColor(type: string): string { return CAT_COLOR[type] ?? '#6B7280'; }
  getCatEmoji(type: string): string { return CAT_EMOJI[type] ?? '📌'; }
  getSharedColor(s?: string | null): string { return SHARED_COLOR[s ?? ''] ?? '#9CA3AF'; }
  getSharedLabel(s?: string | null): string { return SHARED_LABEL[s ?? ''] ?? (s ?? ''); }
  getStatusColor(s?: string | null): string { return STATUS_COLOR[s ?? ''] ?? '#9CA3AF'; }

  // ── Week view ────────────────────────────────────────────────────────────
  readonly hours = Array.from({ length: 17 }, (_, i) => i + 7); // 7am–11pm

  readonly weekDays = computed(() => {
    const sel = this.selected();
    const startOfWeek = new Date(sel);
    startOfWeek.setDate(sel.getDate() - sel.getDay());
    const rem = this.allReminders();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        date:     d,
        weekday:  DOW[d.getDay()].slice(0, 3),
        num:      d.getDate(),
        isToday:  d.toDateString() === this.today.toDateString(),
        isSelected: d.toDateString() === sel.toDateString(),
        reminders: rem.filter(r => this.reminderOccursOn(r, d)),
      };
    });
  });

  prevWeek(): void {
    this.selected.update(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  }
  nextWeek(): void {
    this.selected.update(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  }

  formatHour(h: number): string {
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  getHour(time: string): number {
    return parseInt(time?.split(':')[0] ?? '0', 10);
  }
}
