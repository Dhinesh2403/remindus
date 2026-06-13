// src/app/core/services/reminder.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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
  private _reminders = signal<Reminder[]>([]);
  private _todayCount = signal(0);
  private _upcomingCount = signal(0);
  private _missedCount = signal(0);

  readonly reminders = this._reminders.asReadonly();
  readonly todayCount = this._todayCount.asReadonly();
  readonly upcomingCount = this._upcomingCount.asReadonly();
  readonly missedCount = this._missedCount.asReadonly();

  readonly completionRate = computed(() => {
    const all = this._reminders();
    if (!all.length) return 0;
    const done = all.filter((r) => r.status === 'done').length;
    return Math.round((done / all.length) * 100);
  });

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
    return this.http.post<Reminder>(this.API, dto).pipe(
      tap((reminder) => {
        this._reminders.update((prev) => [reminder, ...prev]);
      })
    );
  }

  update(id: string, dto: Partial<CreateReminderDto>): Observable<Reminder> {
    return this.http.put<Reminder>(`${this.API}/${id}`, dto).pipe(
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
      .patch<Reminder>(`${this.API}/${id}/done`, {})
      .pipe(tap((updated) => this.updateInList(updated)));
  }

  snooze(id: string, minutes = 30): Observable<Reminder> {
    return this.http
      .patch<Reminder>(`${this.API}/${id}/snooze`, { minutes })
      .pipe(tap((updated) => this.updateInList(updated)));
  }

  // ─── Assign to friend ─────────────────────────────────────────────────────
  assignToFriend(
    id: string,
    friendId: string
  ): Observable<Reminder> {
    return this.http
      .patch<Reminder>(`${this.API}/${id}/assign`, { friendId })
      .pipe(tap((updated) => this.updateInList(updated)));
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

    this.socketService
      .on<Reminder>('reminder:assigned')
      .subscribe((reminder) => {
        this._reminders.update((prev) => [reminder, ...prev]);
      });
  }

  private updateInList(updated: Reminder): void {
    this._reminders.update((prev) =>
      prev.map((r) => (r._id === updated._id ? updated : r))
    );
  }
}
