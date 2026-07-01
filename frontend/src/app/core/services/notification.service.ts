// src/app/core/services/notification.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';

export interface AppNotification {
  _id:       string;
  type:      string;
  title:     string;
  message:   string;
  data:      Record<string, unknown>;
  isRead:    boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http   = inject(HttpClient);
  private socket = inject(SocketService);
  private readonly API = `${environment.apiUrl}/notifications`;

  private _notifications = signal<AppNotification[]>([]);
  private _unreadCount   = signal(0);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount   = this._unreadCount.asReadonly();

  constructor() {
    this.socket.on<AppNotification>('notification:new').subscribe(n => {
      this._notifications.update(prev => [n, ...prev]);
      this._unreadCount.update(c => c + 1);
    });
  }

  getAll(): Observable<{ data: AppNotification[]; total: number }> {
    return this.http.get<{ data: AppNotification[]; total: number }>(this.API).pipe(
      tap(({ data }) => {
        this._notifications.set(data);
        this._unreadCount.set(data.filter(n => !n.isRead).length);
      })
    );
  }

  markRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.API}/${id}/read`, {}).pipe(
      tap(() => {
        this._notifications.update(ns =>
          ns.map(n => n._id === id ? { ...n, isRead: true } : n)
        );
        this._unreadCount.update(c => Math.max(c - 1, 0));
      })
    );
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${this.API}/read-all`, {}).pipe(
      tap(() => {
        this._notifications.update(ns => ns.map(n => ({ ...n, isRead: true })));
        this._unreadCount.set(0);
      })
    );
  }
}
