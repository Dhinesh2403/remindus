// src/app/core/services/friend.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/friends`;

  getFriends(): Observable<{ friends: Friend[]; pending: PendingRequest[] }> {
    return this.http.get<{ friends: Friend[]; pending: PendingRequest[] }>(this.API);
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
