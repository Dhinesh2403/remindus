// src/app/calendar/calendar.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAmPmPipe } from '../core/pipes/time-ampm.pipe';
import {
  IonContent, IonHeader, IonToolbar, IonIcon, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { ReminderService, Reminder } from '../core/services/reminder.service';

interface CalendarDay {
  date:        Date;
  day:         number;
  isToday:     boolean;
  isSelected:  boolean;
  isOtherMonth:boolean;
  reminders:   Reminder[];
}

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const CAT_COLOR: Record<string, string> = {
  birthday: '#EC4899', wedding: '#8B5CF6', medicine: '#EF4444',
  bill: '#3B82F6', study: '#10B981', work: '#F59E0B',
  general: '#6B7280', custom: '#7C3AED',
};
const CAT_EMOJI: Record<string, string> = {
  birthday: '🎂', wedding: '💍', medicine: '💊',
  bill: '💰', study: '📚', work: '💼',
  general: '📌', custom: '✨',
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
          <button class="btn-today" (click)="goToday()">Today</button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="cal-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

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
              <div class="event-card" [style.border-left-color]="getCatColor(r.type)">
                <span class="event-emoji">{{ getCatEmoji(r.type) }}</span>
                <div class="event-info">
                  <div class="event-title">{{ r.title }}</div>
                  <div class="event-time">{{ r.time | timeAmPm }}</div>
                </div>
                <span
                  class="event-tag"
                  [style.background]="getCatColor(r.type) + '18'"
                  [style.color]="getCatColor(r.type)"
                >{{ r.type }}</span>
              </div>
            }
          </div>
        }
      </div>

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
    .event-emoji { font-size: 22px; flex-shrink: 0; }
    .event-info { flex: 1; }
    .event-title { font-size: 14px; font-weight: 700; color: var(--rm-text-primary); }
    .event-time { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .event-tag { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; flex-shrink: 0; }
  `],
})
export class CalendarComponent implements OnInit {
  private reminderService = inject(ReminderService);

  dowLabels = DOW;
  today     = new Date();
  viewDate  = signal(new Date());
  selected  = signal(new Date());
  reminders = this.reminderService.reminders;

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline });
  }

  ngOnInit() {
    this.reminderService.getAll({ limit: 100 }).subscribe();
  }

  doRefresh(event: CustomEvent) {
    this.reminderService.getAll({ limit: 100 }).subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
    });
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
    const rem = this.reminders();
    const year  = v.getFullYear();
    const month = v.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i);
      days.push(this.buildDay(d, rem, sel, true));
    }
    // Current month
    for (let i = 1; i <= lastDate; i++) {
      const d = new Date(year, month, i);
      days.push(this.buildDay(d, rem, sel, false));
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.buildDay(d, rem, sel, true));
    }
    return days;
  });

  readonly selectedDayReminders = computed(() => {
    const sel = this.selected();
    return this.reminders().filter(r => {
      const rd = new Date(r.date);
      return rd.toDateString() === sel.toDateString();
    }).sort((a, b) => a.time.localeCompare(b.time));
  });

  private buildDay(date: Date, reminders: Reminder[], selected: Date, isOtherMonth: boolean): CalendarDay {
    return {
      date,
      day: date.getDate(),
      isToday:      date.toDateString() === this.today.toDateString(),
      isSelected:   date.toDateString() === selected.toDateString(),
      isOtherMonth,
      reminders: reminders.filter(r => new Date(r.date).toDateString() === date.toDateString()),
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
}
