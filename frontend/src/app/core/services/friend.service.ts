// src/app/core/services/friend.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';

export interface Friend {
  _id:          string;
  friendshipId: string;
  name:         string;
  email:        string;
  username:     string;
  avatar?:      string;
  isOnline:     boolean;
  responseRate: number;
  sharedCount:  number;
  pendingCount: number;
}

export interface PendingRequest {
  _id:   string;
  name:  string;
  email: string;
}

export interface UserSearchResult {
  _id:   string;
  name:  string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class FriendService {
  private http   = inject(HttpClient);
  private socket = inject(SocketService);
  private readonly API = `${environment.apiUrl}/friends`;

  private _pendingCount = signal(0);
  readonly pendingCount = this._pendingCount.asReadonly();

  constructor() {
    // Increment badge in real-time when a friend request arrives via socket
    this.socket.on<{ type: string }>('notification:new').subscribe(n => {
      if (n.type === 'friend_request') {
        this._pendingCount.update(c => c + 1);
      }
    });
  }

  getFriends(): Observable<{ friends: Friend[]; pending: PendingRequest[] }> {
    return this.http.get<{ friends: Friend[]; pending: PendingRequest[] }>(this.API).pipe(
      tap(({ pending }) => this._pendingCount.set(pending.length))
    );
  }

  searchUsers(query: string): Observable<{ users: UserSearchResult[] }> {
    return this.http.get<{ users: UserSearchResult[] }>(`${this.API}/search`, {
      params: { q: query },
    });
  }

  sendRequest(query: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/request`, { query });
  }

  accept(friendshipId: string): Observable<void> {
    return this.http.patch<void>(`${this.API}/${friendshipId}/accept`, {});
  }

  reject(friendshipId: string): Observable<void> {
    return this.http.patch<void>(`${this.API}/${friendshipId}/reject`, {});
  }

  remove(friendshipId: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${friendshipId}`);
  }
}
