// src/app/core/services/activity.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Activity {
  _id: string;
  title: string;
  dayKey: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  color: string;
  type: string;
  note: string;
  cat: string;
  done: boolean;
}

export interface CreateActivityDto {
  title: string;
  dayKey: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  color?: string;
  type?: string;
  note?: string;
  cat?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/activities`;

  getByDate(dayKey: string): Observable<Activity[]> {
    const params = new HttpParams().set('date', dayKey);
    return this.http.get<{ data: Activity[] }>(this.API, { params }).pipe(map((r) => r.data));
  }

  create(dto: CreateActivityDto): Observable<Activity> {
    return this.http.post<{ data: Activity }>(this.API, dto).pipe(map((r) => r.data));
  }

  update(id: string, dto: Partial<CreateActivityDto & { done: boolean }>): Observable<Activity> {
    return this.http.put<{ data: Activity }>(`${this.API}/${id}`, dto).pipe(map((r) => r.data));
  }

  toggleDone(id: string): Observable<Activity> {
    return this.http.patch<{ data: Activity }>(`${this.API}/${id}/toggle`, {}).pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
