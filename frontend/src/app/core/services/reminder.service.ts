// src/app/core/services/reminder.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';

export type ReminderType =
  | 'general'
  | 'birthday'
  | 'wedding'
  | 'medicine'
  | 'study'
  | 'bill'
  | 'work'
  | 'custom';

export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ReminderStatus = 'pending' | 'done' | 'snoozed' | 'missed';
export type NotificationType = 'push' | 'email' | 'sms' | 'whatsapp';

export interface AssignedUser {
  _id: string;
  name: string;
  avatar?: string;
}

export interface ReceivedReminder {
  _id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  type: ReminderType;
  repeatType: RepeatType;
  priority: Priority;
  status: ReminderStatus;
  sharedStatus?: string | null;
  userId: { _id: string; name: string; avatar?: string }; // populated sender
}

export interface Reminder {
  _id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  type: ReminderType;
  repeatType: RepeatType;
  priority: Priority;
  reminderWindowMinutes: number;
  notificationTypes: NotificationType[];
  status: ReminderStatus;
  sharedStatus?: string;
  assignedTo?: AssignedUser | string | null;
  assignedBy?: string | null;
  snoozeCount: number;
  snoozeUntil?: string;
  completedAt?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderDto {
  title: string;
  description?: string;
  date: string;
  time: string;
  type: ReminderType;
  repeatType?: RepeatType;
  priority?: Priority;
  reminderWindowMinutes?: number;
  notificationTypes?: NotificationType[];
  assignedTo?: string;
  nextFireAt?: string; // UTC ISO — computed from user's local date+time on the frontend
}

export interface ReminderFilters {
  status?: ReminderStatus;
  type?: ReminderType;
  priority?: Priority;
  date?: string;       // 'today' | 'week' | 'month' | ISO date
  page?: number;
  limit?: number;
}

export interface PaginatedReminders {
  data: Reminder[];
  total: number;
  page: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  private readonly API = `${environment.apiUrl}/reminders`;

  // ─── Reactive state via Signals ──────────────────────────────────────────
  private _reminders         = signal<Reminder[]>([]);
  private _receivedReminders = signal<ReceivedReminder[]>([]);
  private _todayCount        = signal(0);
  private _upcomingCount     = signal(0);
  private _missedCount       = signal(0);

  readonly reminders         = this._reminders.asReadonly();
  readonly receivedReminders = this._receivedReminders.asReadonly();
  readonly todayCount        = this._todayCount.asReadonly();
  readonly upcomingCount     = this._upcomingCount.asReadonly();
  readonly missedCount       = this._missedCount.asReadonly();

  readonly completionRate = computed(() => {
    const all = this._reminders();
    if (!all.length) return 0;
    const done = all.filter((r) => r.status === 'done').length;
    return Math.round((done / all.length) * 100);
  });

  readonly reminderBadgeCount = computed(() => {
    const today = this.todayStr();
    const own      = this._reminders().filter(r =>
      r.status === 'pending' && !r.assignedTo && this.localDateStr(new Date(r.date)) === today
    ).length;
    const received = this._receivedReminders().filter(r =>
      r.status === 'pending' && this.localDateStr(new Date(r.date)) === today
    ).length;
    return own + received;
  });

  private localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private todayStr(): string {
    return this.localDateStr(new Date());
  }

  constructor() {
    this.listenToSocketEvents();
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  getAll(filters?: ReminderFilters): Observable<PaginatedReminders> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params = params.set(k, String(v));
      });
    }
    return this.http
      .get<PaginatedReminders>(this.API, { params })
      .pipe(tap(({ data }) => this._reminders.set(data)));
  }

  getById(id: string): Observable<Reminder> {
    return this.http.get<Reminder>(`${this.API}/${id}`);
  }

  create(dto: CreateReminderDto): Observable<Reminder> {
    return this.http.post<{ data: Reminder }>(this.API, dto).pipe(
      map((res) => res.data),
      tap((reminder) => {
        this._reminders.update((prev) => [reminder, ...prev]);
      })
    );
  }

  update(id: string, dto: Partial<CreateReminderDto>): Observable<Reminder> {
    return this.http.put<{ data: Reminder }>(`${this.API}/${id}`, dto).pipe(
      map((res) => res.data),
      tap((updated) => {
        this._reminders.update((prev) =>
          prev.map((r) => (r._id === id ? updated : r))
        );
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      tap(() => {
        this._reminders.update((prev) => prev.filter((r) => r._id !== id));
      })
    );
  }

  // ─── Status actions ───────────────────────────────────────────────────────
  markDone(id: string): Observable<Reminder> {
    return this.http
      .patch<{ data: Reminder }>(`${this.API}/${id}/done`, {})
      .pipe(map((res) => res.data), tap((updated) => this.updateInList(updated)));
  }

  snooze(id: string, minutes = 30): Observable<Reminder> {
    return this.http
      .patch<{ data: Reminder }>(`${this.API}/${id}/snooze`, { minutes })
      .pipe(map((res) => res.data), tap((updated) => this.updateInList(updated)));
  }

  // ─── Reminders assigned to current user by friends ───────────────────────
  getReceived(): Observable<{ data: ReceivedReminder[] }> {
    return this.http
      .get<{ data: ReceivedReminder[] }>(`${this.API}/received`)
      .pipe(tap(({ data }) => this._receivedReminders.set(data)));
  }

  updateSharedStatus(id: string, status: string): Observable<ReceivedReminder> {
    return this.http
      .patch<{ success: boolean; data: ReceivedReminder }>(`${this.API}/${id}/shared-status`, { status })
      .pipe(tap(({ data }) => {
        this._receivedReminders.update(prev =>
          prev.map(r => r._id === id ? { ...r, sharedStatus: data.sharedStatus, status: data.status } : r)
        );
      }), map(({ data }) => data));
  }

  // ─── Assign to friend ─────────────────────────────────────────────────────
  assignToFriend(
    id: string,
    friendId: string
  ): Observable<Reminder> {
    return this.http
      .patch<{ data: Reminder }>(`${this.API}/${id}/assign`, { friendId })
      .pipe(map((res) => res.data), tap((updated) => this.updateInList(updated)));
  }

  // ─── Dashboard stats ──────────────────────────────────────────────────────
  loadStats(): Observable<{
    today: number;
    upcoming: number;
    missed: number;
  }> {
    return this.http
      .get<{ today: number; upcoming: number; missed: number }>(
        `${this.API}/stats/summary`
      )
      .pipe(
        tap(({ today, upcoming, missed }) => {
          this._todayCount.set(today);
          this._upcomingCount.set(upcoming);
          this._missedCount.set(missed);
        })
      );
  }

  // ─── Real-time socket updates ─────────────────────────────────────────────
  private listenToSocketEvents(): void {
    this.socketService.on<Reminder>('reminder:due').subscribe((reminder) => {
      this.updateInList(reminder);
    });

    // A friend assigned a reminder TO me → add to my received list immediately
    this.socketService
      .on<ReceivedReminder>('reminder:received')
      .subscribe((reminder) => {
        this._receivedReminders.update((prev) => [reminder, ...prev]);
      });

    // Friend updated the sharedStatus on a reminder I sent them → update sender's list in place
    this.socketService
      .on<{ _id: string; sharedStatus: string; status: string }>('reminder:sharedStatus')
      .subscribe(({ _id, sharedStatus, status }) => {
        this._reminders.update(prev =>
          prev.map(r => r._id === _id ? { ...r, sharedStatus, ...(status ? { status: status as ReminderStatus } : {}) } : r)
        );
        // Also update received list in case both sides use the same event
        this._receivedReminders.update(prev =>
          prev.map(r => r._id === _id ? { ...r, sharedStatus, ...(status ? { status: status as ReminderStatus } : {}) } : r)
        );
      });
  }

  private updateInList(updated: Reminder): void {
    this._reminders.update((prev) =>
      prev.map((r) => (r._id === updated._id ? updated : r))
    );
  }
}
