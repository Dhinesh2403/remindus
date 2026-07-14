// src/app/quick-alarms/quick-alarms.component.ts
import { Component, ElementRef, ViewChild, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import { AlarmService } from '../core/services/alarm.service';
import { RmDateTimeComponent } from '../core/components/rm-datetime.component';

export type AlarmCategory = 'wakeUp' | 'meeting' | 'workout' | 'study' | 'medicine' | 'water' | 'sleep' | 'other';
export type RepeatMode = 'never' | 'daily' | 'weekdays' | 'weekends' | 'custom';

export interface QuickAlarm {
  id: string;
  hour: number;
  minute: number;
  label: string;
  days: boolean[];
  enabled: boolean;
  description?: string;
  category?: AlarmCategory;
  repeatMode?: RepeatMode;
  customDate?: string;               // 'YYYY-MM-DD', only used when repeatMode === 'never'
  soundName?: 'default' | 'silent';
  vibration?: boolean;
  snoozeEnabled?: boolean;
  snoozeMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

type AlarmDraft = Omit<QuickAlarm, 'id' | 'enabled' | 'createdAt' | 'updatedAt'>;

interface CategoryDef {
  key: AlarmCategory;
  label: string;
  color: string;
  icon: string;          // single multi-subpath SVG "d" attribute
  presetHour?: number;    // Quick preset also nudges the time for time-of-day categories
  presetMinute?: number;
}

const STORAGE_KEY = 'rm_quick_alarms';

// Short embedded beep used for the in-app "Preview" button — no bundled
// native sound file is shipped, so this is the only sound we can honestly
// let the user audition before saving.
const PREVIEW_BEEP_DATA_URI =
  'data:audio/wav;base64,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';

// 8 categories double as "Quick Presets": one tap sets category + name (and,
// for the two time-of-day ones, a sensible default time).
const CATEGORIES: CategoryDef[] = [
  { key: 'wakeUp',   label: 'Wake Up',        color: '#F59E0B', presetHour: 6,  presetMinute: 30,
    icon: 'M3 18h18M7 18a5 5 0 0 1 10 0M12 8v3M6.5 10.5l2 2M17.5 10.5l-2 2' },
  { key: 'meeting',  label: 'Meeting',        color: '#3D5AF1',
    icon: 'M4 8h16v11H4V8zM9 8V6a3 3 0 0 1 6 0v2M4 13h16' },
  { key: 'workout',  label: 'Workout',        color: '#10B981',
    icon: 'M4 12h16M4 9v6M8 8v8M16 8v8M20 9v6' },
  { key: 'study',    label: 'Study',          color: '#8B5CF6',
    icon: 'M4 5h8a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4zM20 5h-8a3 3 0 0 0-3 3v11a3 3 0 0 1 3-3h8z' },
  { key: 'medicine', label: 'Medicine',       color: '#EF4444',
    icon: 'M5 13.5L13.5 5a4.95 4.95 0 1 1 7 7L11.5 20.5a4.95 4.95 0 1 1-7-7zM9 9l6 6' },
  { key: 'water',    label: 'Water Reminder', color: '#14B8A6',
    icon: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z' },
  { key: 'sleep',    label: 'Sleep',          color: '#6366F1', presetHour: 22, presetMinute: 30,
    icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  { key: 'other',    label: 'Other',          color: '#6B7280',
    icon: 'M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z' },
];

function defaultDraft(): AlarmDraft {
  return {
    hour: 6, minute: 0, label: 'Alarm',
    days: [true, true, true, true, true, false, false],
    description: '',
    category: 'other',
    repeatMode: 'weekdays',
    customDate: '',
    soundName: 'default',
    vibration: true,
    snoozeEnabled: false,
    snoozeMinutes: 10,
  };
}

@Component({
  selector: 'app-quick-alarms',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonToggle, RmDateTimeComponent],
  templateUrl: './quick-alarms.component.html',
  styleUrl: './quick-alarms.component.scss',
})
export class QuickAlarmsComponent implements OnInit {
  protected nav      = inject(Router);
  private alarmSvc   = inject(AlarmService);
  readonly alarms    = signal<QuickAlarm[]>([]);
  readonly showForm  = signal(false);
  readonly toastMsg  = signal('');

  readonly categories = CATEGORIES;
  readonly todayDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Header search — filters the existing alarm list below by label; does not
  // touch alarm creation/scheduling/storage.
  readonly searchOpen = signal(false);
  readonly searchTerm = signal('');
  @ViewChild('qaSearchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly filteredAlarms = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this.alarms();
    return q ? list.filter(a => a.label.toLowerCase().includes(q)) : list;
  });

  ngOnInit(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { this.alarms.set(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  toggleSearch(): void {
    this.searchOpen() ? this.closeSearch() : this.openSearch();
  }

  openSearch(): void {
    this.searchOpen.set(true);
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 60);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchTerm.set('');
  }

  onSearchBlur(): void {
    if (!this.searchTerm().trim()) this.searchOpen.set(false);
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alarms()));
  }

  private numericId(id: string): number {
    // Derive a stable 31-bit numeric id from the string id for Capacitor.
    return Math.abs(parseInt(id, 10) % 2147483647) || 1;
  }

  private flash(msg: string, ms = 3000): void {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), ms);
  }

  // ── Dashboard stats ─────────────────────────────────────────────────────
  readonly totalActive = computed(() => this.alarms().filter(a => a.enabled).length);

  private readonly nextAlarmEntry = computed(() => {
    const now = new Date();
    let best: { alarm: QuickAlarm; at: Date } | null = null;
    for (const a of this.alarms()) {
      if (!a.enabled) continue;
      const at = this.nextFireDate(a, now);
      if (at && (!best || at < best.at)) best = { alarm: a, at };
    }
    return best;
  });
  readonly nextAlarmId = computed(() => this.nextAlarmEntry()?.alarm.id ?? null);
  readonly nextAlarmLabel = computed(() => {
    const n = this.nextAlarmEntry();
    return n ? this.formatTime(n.alarm.hour, n.alarm.minute) : '--:--';
  });
  readonly todayCount = computed(() => {
    const now = new Date();
    return this.alarms().filter(a => {
      if (!a.enabled) return false;
      const at = this.nextFireDate(a, now);
      return !!at && this.midnight(at).getTime() === this.midnight(now).getTime();
    }).length;
  });
  readonly upcomingCount = computed(() => {
    const now = new Date();
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);
    return this.alarms().filter(a => {
      if (!a.enabled) return false;
      const at = this.nextFireDate(a, now);
      return !!at && at <= weekOut;
    }).length;
  });

  // ── Draft (Add / Edit sheet) ────────────────────────────────────────────
  readonly editingId = signal<string | null>(null);
  readonly newAlarm  = signal<AlarmDraft>(defaultDraft());

  readonly dayLabels = ['M','T','W','T','F','S','S'];

  openNewAlarmForm(): void {
    this.editingId.set(null);
    this.newAlarm.set(defaultDraft());
    this.showForm.set(true);
  }

  startEdit(alarm: QuickAlarm): void {
    this.editingId.set(alarm.id);
    this.newAlarm.set({
      hour: alarm.hour, minute: alarm.minute, label: alarm.label, days: [...alarm.days],
      description: alarm.description ?? '',
      category: alarm.category ?? 'other',
      repeatMode: alarm.repeatMode ?? this.deriveRepeatMode(alarm.days),
      customDate: alarm.customDate ?? '',
      soundName: alarm.soundName ?? 'default',
      vibration: alarm.vibration ?? true,
      snoozeEnabled: alarm.snoozeEnabled ?? false,
      snoozeMinutes: alarm.snoozeMinutes ?? 10,
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  toggleDay(i: number): void {
    this.newAlarm.update(a => {
      const days = [...a.days];
      days[i] = !days[i];
      return { ...a, days, repeatMode: 'custom' };
    });
  }

  setRepeatMode(mode: RepeatMode): void {
    this.newAlarm.update(a => {
      let days = a.days;
      let customDate = a.customDate;
      switch (mode) {
        case 'daily':    days = [true, true, true, true, true, true, true]; break;
        case 'weekdays': days = [true, true, true, true, true, false, false]; break;
        case 'weekends': days = [false, false, false, false, false, true, true]; break;
        case 'never':
          days = [false, false, false, false, false, false, false];
          if (!customDate) customDate = this.todayStr();
          break;
        case 'custom': break;
      }
      return { ...a, repeatMode: mode, days, customDate };
    });
  }

  setCustomDate(v: string): void {
    this.newAlarm.update(a => ({ ...a, customDate: v }));
  }

  applyPreset(key: AlarmCategory): void {
    const cat = this.categoryDef(key);
    this.newAlarm.update(a => ({
      ...a,
      category: key,
      label: cat.label,
      hour: cat.presetHour ?? a.hour,
      minute: cat.presetMinute ?? a.minute,
    }));
  }

  updateLabel(val: string): void {
    this.newAlarm.update(a => ({ ...a, label: val }));
  }

  updateDescription(val: string): void {
    this.newAlarm.update(a => ({ ...a, description: val }));
  }

  setSound(name: 'default' | 'silent'): void {
    this.newAlarm.update(a => ({ ...a, soundName: name }));
  }

  toggleVibration(): void {
    this.newAlarm.update(a => ({ ...a, vibration: !a.vibration }));
  }

  toggleSnooze(): void {
    this.newAlarm.update(a => ({ ...a, snoozeEnabled: !a.snoozeEnabled }));
  }

  adjustSnoozeMinutes(delta: number): void {
    this.newAlarm.update(a => ({
      ...a,
      snoozeMinutes: Math.min(60, Math.max(1, (a.snoozeMinutes ?? 10) + delta)),
    }));
  }

  previewSound(): void {
    if (this.newAlarm().soundName === 'silent') return;
    try { new Audio(PREVIEW_BEEP_DATA_URI).play().catch(() => {}); } catch { /* ignore */ }
  }

  /** Draft time as "HH:mm" for the shared time field. */
  timeValue(): string {
    const a = this.newAlarm();
    return `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`;
  }

  setTime(v: string): void {
    const [h, m] = v.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    this.newAlarm.update(a => ({ ...a, hour: h, minute: m }));
  }

  private validateDraft(): boolean {
    const a = this.newAlarm();
    if ((a.repeatMode ?? this.deriveRepeatMode(a.days)) === 'never') {
      if (!a.customDate) { this.flash('Pick a date for a one-time alarm'); return false; }
      if (!this.nextFireDate(a, new Date())) {
        this.flash('That time has already passed — pick a time in the future');
        return false;
      }
    }
    return true;
  }

  private buildSchedule(alarm: QuickAlarm) {
    const isOneTime = (alarm.repeatMode ?? this.deriveRepeatMode(alarm.days)) === 'never';
    let at: Date | undefined;
    if (isOneTime && alarm.customDate) {
      const [y, m, d] = alarm.customDate.split('-').map(Number);
      at = new Date(y, m - 1, d, alarm.hour, alarm.minute, 0, 0);
    }
    return {
      id: this.numericId(alarm.id), hour: alarm.hour, minute: alarm.minute,
      label: alarm.label, days: alarm.days,
      soundName: alarm.soundName ?? 'default', vibration: alarm.vibration ?? true,
      at,
    };
  }

  private async scheduleAlarm(alarm: QuickAlarm): Promise<void> {
    await this.alarmSvc.schedule(this.buildSchedule(alarm));
  }

  async addAlarm(): Promise<void> {
    if (!this.validateDraft()) return;
    const a = this.newAlarm();
    const now = new Date().toISOString();
    const alarm: QuickAlarm = { ...a, id: Date.now().toString(), enabled: true, createdAt: now, updatedAt: now };
    this.alarms.update(list => [...list, alarm]);
    this.persist();
    this.closeForm();

    try {
      await this.scheduleAlarm(alarm);
      this.flash(`Alarm set for ${this.formatTime(a.hour, a.minute)}`);
    } catch {
      this.flash('Enable notifications to activate alarms');
    }
  }

  async updateAlarm(): Promise<void> {
    if (!this.validateDraft()) return;
    const id = this.editingId();
    const existing = id ? this.alarms().find(x => x.id === id) : undefined;
    if (!id || !existing) return;

    const a = this.newAlarm();
    const updated: QuickAlarm = { ...existing, ...a, id, updatedAt: new Date().toISOString() };
    this.alarms.update(list => list.map(x => x.id === id ? updated : x));
    this.persist();
    this.closeForm();

    await this.alarmSvc.cancel(this.numericId(id)).catch(() => {});
    if (updated.enabled) {
      try {
        await this.scheduleAlarm(updated);
        this.flash('Alarm updated');
      } catch {
        this.flash('Enable notifications to activate alarms');
      }
    }
  }

  async duplicateAlarm(id: string): Promise<void> {
    const src = this.alarms().find(a => a.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const copy: QuickAlarm = { ...src, id: Date.now().toString(), label: `${src.label} (copy)`, createdAt: now, updatedAt: now };
    this.alarms.update(list => [...list, copy]);
    this.persist();
    if (copy.enabled) await this.scheduleAlarm(copy).catch(() => {});
    this.flash('Alarm duplicated');
  }

  async toggleAlarm(id: string): Promise<void> {
    this.alarms.update(list => list.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    this.persist();
    const alarm = this.alarms().find(a => a.id === id);
    if (!alarm) return;
    if (alarm.enabled) {
      await this.scheduleAlarm(alarm).catch(() => {});
    } else {
      await this.alarmSvc.cancel(this.numericId(alarm.id)).catch(() => {});
    }
  }

  async deleteAlarm(id: string): Promise<void> {
    await this.alarmSvc.cancel(this.numericId(id)).catch(() => {});
    this.alarms.update(list => list.filter(a => a.id !== id));
    this.persist();
  }

  // ── Category / preset lookups ───────────────────────────────────────────
  categoryDef(key?: AlarmCategory): CategoryDef {
    return this.categories.find(c => c.key === key) ?? this.categories[this.categories.length - 1];
  }

  // ── Countdown / next-trigger (shared by the draft sheet and each card) ──
  private nextFireDate(a: { hour: number; minute: number; days: boolean[]; repeatMode?: RepeatMode; customDate?: string }, now = new Date()): Date | null {
    const mode = a.repeatMode ?? this.deriveRepeatMode(a.days);
    if (mode === 'never') {
      if (!a.customDate) return null;
      const [y, m, d] = a.customDate.split('-').map(Number);
      const at = new Date(y, m - 1, d, a.hour, a.minute, 0, 0);
      return at > now ? at : null;
    }
    const anyDay = a.days.some(Boolean);
    for (let off = 0; off <= 7; off++) {
      const cand = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, a.hour, a.minute, 0, 0);
      if (cand <= now) continue;
      const dayIdx = (cand.getDay() + 6) % 7; // days[] is Monday-first
      if (anyDay && !a.days[dayIdx]) continue;
      return cand;
    }
    return null;
  }

  /** e.g. "in 8h 36m", "tomorrow in 12h 15m", "in 3 days". */
  firesInLabel(a: { hour: number; minute: number; days: boolean[]; repeatMode?: RepeatMode; customDate?: string }, now = new Date()): string {
    const at = this.nextFireDate(a, now);
    if (!at) return '';
    const mins = Math.round((at.getTime() - now.getTime()) / 60000);
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const minutes = mins % 60;
    if (days === 0) return hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
    if (days === 1) return hours > 0 ? `tomorrow in ${hours}h ${minutes}m` : 'tomorrow';
    return `in ${days} days`;
  }

  nextTriggerLabel(a: { hour: number; minute: number; days: boolean[]; repeatMode?: RepeatMode; customDate?: string }, now = new Date()): string {
    const at = this.nextFireDate(a, now);
    if (!at) return '—';
    return `${at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${this.formatTime(a.hour, a.minute)}`;
  }

  /** Draft time as of "now" — kept for the live "Alarm fires ..." row in the sheet. */
  draftFiresIn(): string {
    return this.firesInLabel(this.newAlarm());
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
    if (!days.some(Boolean)) return 'One time';
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter((_, i) => days[i]).join(', ');
  }

  repeatLabel(a: { repeatMode?: RepeatMode; days: boolean[] }): string {
    const mode = a.repeatMode ?? this.deriveRepeatMode(a.days);
    switch (mode) {
      case 'daily':    return 'Daily';
      case 'weekdays': return 'Weekdays';
      case 'weekends': return 'Weekends';
      case 'never':    return 'One time';
      default:         return this.daysLabel(a.days);
    }
  }

  private deriveRepeatMode(days: boolean[]): RepeatMode {
    if (days.every(Boolean)) return 'daily';
    if (days.slice(0, 5).every(Boolean) && !days[5] && !days[6]) return 'weekdays';
    if (!days.slice(0, 5).some(Boolean) && days[5] && days[6]) return 'weekends';
    if (!days.some(Boolean)) return 'never';
    return 'custom';
  }

  private midnight(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  todayStr(): string { return this.ymd(new Date()); }
  tomorrowStr(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.ymd(d);
  }
}
