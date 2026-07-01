// src/app/quick-alarms/quick-alarms.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import { AlarmService } from '../core/services/alarm.service';

export interface QuickAlarm {
  id: string;
  hour: number;
  minute: number;
  label: string;
  days: boolean[];
  enabled: boolean;
}

const STORAGE_KEY = 'rm_quick_alarms';

@Component({
  selector: 'app-quick-alarms',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonToggle],
  templateUrl: './quick-alarms.component.html',
  styleUrl: './quick-alarms.component.scss',
})
export class QuickAlarmsComponent implements OnInit {
  protected nav      = inject(Router);
  private alarmSvc   = inject(AlarmService);
  readonly alarms    = signal<QuickAlarm[]>([]);
  readonly showForm  = signal(false);
  readonly toastMsg  = signal('');

  ngOnInit(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { this.alarms.set(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alarms()));
  }

  private numericId(id: string): number {
    // Derive a stable 31-bit numeric id from the string id for Capacitor.
    return Math.abs(parseInt(id, 10) % 2147483647) || 1;
  }

  readonly newAlarm = signal<Omit<QuickAlarm, 'id' | 'enabled'>>({
    hour: 6, minute: 0, label: 'Alarm',
    days: [true, true, true, true, true, false, false],
  });

  readonly dayLabels = ['M','T','W','T','F','S','S'];
  readonly isWeekdays = computed(() => {
    const d = this.newAlarm().days;
    return d[0] && d[1] && d[2] && d[3] && d[4] && !d[5] && !d[6];
  });

  toggleDay(i: number): void {
    this.newAlarm.update(a => {
      const days = [...a.days];
      days[i] = !days[i];
      return { ...a, days };
    });
  }

  async addAlarm(): Promise<void> {
    const a = this.newAlarm();
    const alarm: QuickAlarm = { ...a, id: Date.now().toString(), enabled: true };
    this.alarms.update(list => [...list, alarm]);
    this.persist();
    this.showForm.set(false);

    try {
      await this.alarmSvc.schedule({
        id: this.numericId(alarm.id),
        hour: alarm.hour, minute: alarm.minute,
        label: alarm.label, days: alarm.days,
      });
      this.toastMsg.set(`Alarm set for ${this.formatTime(a.hour, a.minute)}`);
    } catch {
      this.toastMsg.set('Enable notifications to activate alarms');
    }
    setTimeout(() => this.toastMsg.set(''), 3000);
  }

  async toggleAlarm(id: string): Promise<void> {
    this.alarms.update(list => list.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    this.persist();
    const alarm = this.alarms().find(a => a.id === id);
    if (!alarm) return;
    if (alarm.enabled) {
      await this.alarmSvc.schedule({
        id: this.numericId(alarm.id), hour: alarm.hour, minute: alarm.minute,
        label: alarm.label, days: alarm.days,
      }).catch(() => {});
    } else {
      await this.alarmSvc.cancel(this.numericId(alarm.id)).catch(() => {});
    }
  }

  async deleteAlarm(id: string): Promise<void> {
    await this.alarmSvc.cancel(this.numericId(id)).catch(() => {});
    this.alarms.update(list => list.filter(a => a.id !== id));
    this.persist();
  }

  adjustHour(delta: number): void {
    this.newAlarm.update(a => ({ ...a, hour: (a.hour + delta + 24) % 24 }));
  }

  adjustMinute(delta: number): void {
    this.newAlarm.update(a => ({ ...a, minute: (a.minute + delta + 60) % 60 }));
  }

  formatTime(h: number, m: number): string {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  daysLabel(days: boolean[]): string {
    const all    = days.every(Boolean);
    const wkdays = days.slice(0, 5).every(Boolean) && !days[5] && !days[6];
    const wkend  = !days.slice(0, 5).some(Boolean) && days[5] && days[6];
    if (all)    return 'Every day';
    if (wkdays) return 'Weekdays';
    if (wkend)  return 'Weekends';
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter((_, i) => days[i]).join(', ');
  }

  updateLabel(val: string): void {
    this.newAlarm.update(a => ({ ...a, label: val }));
  }
}
