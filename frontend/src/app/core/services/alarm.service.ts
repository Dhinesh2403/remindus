// src/app/core/services/alarm.service.ts
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  ScheduleOptions,
  Weekday,
} from '@capacitor/local-notifications';

export interface AlarmSchedule {
  id: number;          // numeric id required by Capacitor
  hour: number;        // 0-23
  minute: number;      // 0-59
  label: string;
  days: boolean[];     // [Mon..Sun] length 7
}

/**
 * Wraps Capacitor LocalNotifications for Quick Alarms.
 * On web (no native runtime) it degrades gracefully to a no-op so the UI
 * still works during development / PWA preview.
 */
@Injectable({ providedIn: 'root' })
export class AlarmService {
  private get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Ask for OS permission. Returns true if granted (always true on web). */
  async ensurePermission(): Promise<boolean> {
    if (!this.isNative) return true;
    const check = await LocalNotifications.checkPermissions();
    if (check.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  }

  /**
   * Schedule an alarm. If `days` has any true value the alarm repeats weekly
   * on those weekdays; otherwise it fires once at the next matching time.
   */
  async schedule(alarm: AlarmSchedule): Promise<void> {
    if (!this.isNative) return;
    const granted = await this.ensurePermission();
    if (!granted) throw new Error('Notification permission denied');

    // Map our Mon-first array to Capacitor's Weekday enum (Sunday = 1).
    const capWeekdays: Weekday[] = [];
    const map: Weekday[] = [
      Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday,
      Weekday.Thursday, Weekday.Friday, Weekday.Saturday, Weekday.Sunday,
    ];
    alarm.days.forEach((on, i) => { if (on) capWeekdays.push(map[i]); });

    const options: ScheduleOptions = { notifications: [] };

    if (capWeekdays.length > 0) {
      // One repeating notification per selected weekday.
      capWeekdays.forEach((wd, idx) => {
        options.notifications.push({
          id: alarm.id * 10 + idx,
          title: alarm.label || 'Alarm',
          body: this.formatTime(alarm.hour, alarm.minute),
          schedule: {
            on: { weekday: wd, hour: alarm.hour, minute: alarm.minute },
            allowWhileIdle: true,
          },
          sound: 'beep.wav',
          smallIcon: 'ic_stat_icon',
        });
      });
    } else {
      // One-shot at the next occurrence of the given time.
      const at = this.nextOccurrence(alarm.hour, alarm.minute);
      options.notifications.push({
        id: alarm.id,
        title: alarm.label || 'Alarm',
        body: this.formatTime(alarm.hour, alarm.minute),
        schedule: { at, allowWhileIdle: true },
        sound: 'beep.wav',
        smallIcon: 'ic_stat_icon',
      });
    }

    await LocalNotifications.schedule(options);
  }

  /** Cancel every notification associated with an alarm id. */
  async cancel(alarmId: number): Promise<void> {
    if (!this.isNative) return;
    const ids = [{ id: alarmId }];
    for (let i = 0; i < 7; i++) ids.push({ id: alarmId * 10 + i });
    await LocalNotifications.cancel({ notifications: ids });
  }

  private nextOccurrence(hour: number, minute: number): Date {
    const now  = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  private formatTime(h: number, m: number): string {
    const period = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${m.toString().padStart(2, '0')} ${period}`;
  }
}
