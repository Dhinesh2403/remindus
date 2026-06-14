// src/app/core/services/socket.service.ts
import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export type SocketEvent =
  | 'reminder:due'
  | 'reminder:assigned'
  | 'reminder:received'
  | 'reminder:response'
  | 'reminder:sharedStatus'
  | 'friend:request'
  | 'friend:accepted'
  | 'notification:new';

export interface SocketPayload<T = unknown> {
  event: SocketEvent;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private events$ = new Subject<SocketPayload>();

  readonly isConnected = signal(false);

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      if (environment.enableLogging) {
        console.log('[Socket] Connected:', this.socket?.id);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
    });

    // Register all typed events
    const events: SocketEvent[] = [
      'reminder:due',
      'reminder:assigned',
      'reminder:received',
      'reminder:response',
      'reminder:sharedStatus',
      'friend:request',
      'friend:accepted',
      'notification:new',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        this.events$.next({ event, data });
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected.set(false);
  }

  /** Listen to a specific socket event as an Observable */
  on<T>(event: SocketEvent): Observable<T> {
    return new Observable((subscriber) => {
      const sub = this.events$.subscribe((payload) => {
        if (payload.event === event) {
          subscriber.next(payload.data as T);
        }
      });
      return () => sub.unsubscribe();
    });
  }

  /** Emit an event to the server */
  emit<T>(event: string, data?: T): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot emit — not connected');
      return;
    }
    this.socket.emit(event, data);
  }
}
