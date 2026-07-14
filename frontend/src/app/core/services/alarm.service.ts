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
  soundName?: 'default' | 'silent';  // default: 'default'
  vibration?: boolean;               // default: true
  /** One-shot date to fire on (ignored if `days` has any weekday selected). */
  at?: Date;
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

  // Android 26+ ignores per-notification `sound` and instead uses whichever
  // channel the notification is posted to, and channel sound/vibration can't
  // be changed after the channel is first created. So instead of one channel
  // we create the 4 fixed sound x vibration combinations up front (idempotent
  // — createChannel just no-ops if the channel already exists) and pick the
  // matching one per alarm.
  private channelsReady = false;

  private async ensureChannels(): Promise<void> {
    if (!this.isNative || this.channelsReady) return;
    const combos: { id: string; sound: boolean; vibration: boolean }[] = [
      { id: 'rm_alarm_sound_vibrate',    sound: true,  vibration: true  },
      { id: 'rm_alarm_sound_novibrate',  sound: true,  vibration: false },
      { id: 'rm_alarm_silent_vibrate',   sound: false, vibration: true  },
      { id: 'rm_alarm_silent_novibrate', sound: false, vibration: false },
    ];
    for (const c of combos) {
      await LocalNotifications.createChannel({
        id: c.id,
        name: `Alarms (${c.sound ? 'sound' : 'silent'}, ${c.vibration ? 'vibrate' : 'no vibrate'})`,
        importance: 5,
        visibility: 1,
        sound: c.sound ? 'beep.wav' : undefined,
        vibration: c.vibration,
      }).catch(() => {});
    }
    this.channelsReady = true;
  }

  private channelId(soundName?: 'default' | 'silent', vibration = true): string {
    const silent = soundName === 'silent';
    return `rm_alarm_${silent ? 'silent' : 'sound'}_${vibration ? 'vibrate' : 'novibrate'}`;
  }

  /**
   * Schedule an alarm. If `days` has any true value the alarm repeats weekly
   * on those weekdays; otherwise it fires once at the next matching time.
   */
  async schedule(alarm: AlarmSchedule): Promise<void> {
    if (!this.isNative) return;
    const granted = await this.ensurePermission();
    if (!granted) throw new Error('Notification permission denied');
    await this.ensureChannels();
    const channelId = this.channelId(alarm.soundName, alarm.vibration ?? true);

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
          channelId,
          smallIcon: 'ic_stat_icon',
        });
      });
    } else {
      // One-shot at an explicit date if given, otherwise the next occurrence
      // of the given time (today or tomorrow).
      const at = alarm.at ?? this.nextOccurrence(alarm.hour, alarm.minute);
      options.notifications.push({
        id: alarm.id,
        title: alarm.label || 'Alarm',
        body: this.formatTime(alarm.hour, alarm.minute),
        schedule: { at, allowWhileIdle: true },
        sound: 'beep.wav',
        channelId,
        smallIcon: 'ic_stat_icon',
      });
    }

    await LocalNotifications.schedule(options);
  }

  /**
   * One-shot alarm at an exact date+time (used by Alarm-type reminders).
   * No-op on web; silently skips past dates.
   */
  async scheduleAt(id: number, title: string, at: Date): Promise<void> {
    if (!this.isNative) return;
    if (at.getTime() <= Date.now()) return;
    const granted = await this.ensurePermission();
    if (!granted) throw new Error('Notification permission denied');
    await this.ensureChannels();

    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: title || 'Alarm',
        body: this.formatTime(at.getHours(), at.getMinutes()),
        schedule: { at, allowWhileIdle: true },
        sound: 'beep.wav',
        channelId: this.channelId('default', true),
        smallIcon: 'ic_stat_icon',
      }],
    });
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
