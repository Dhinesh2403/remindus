// src/app/core/services/habit.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Habit {
  _id: string;
  name: string;
  goal: string;
  color: string;
  streak: number;
  best: number;
  week: boolean[];
}

export interface CreateHabitDto {
  name: string;
  goal?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class HabitService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/habits`;

  getAll(): Observable<Habit[]> {
    return this.http.get<{ data: Habit[] }>(this.API).pipe(map((r) => r.data));
  }

  create(dto: CreateHabitDto): Observable<Habit> {
    return this.http.post<{ data: Habit }>(this.API, dto).pipe(map((r) => r.data));
  }

  update(id: string, dto: Partial<CreateHabitDto>): Observable<Habit> {
    return this.http.put<{ data: Habit }>(`${this.API}/${id}`, dto).pipe(map((r) => r.data));
  }

  toggleToday(id: string): Observable<Habit> {
    return this.http.patch<{ data: Habit }>(`${this.API}/${id}/toggle`, {}).pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
