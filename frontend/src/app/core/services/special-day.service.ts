// src/app/core/services/special-day.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SpecialDayType = 'birthday' | 'anniversary' | 'event';

export interface SpecialDay {
  _id: string;
  name: string;
  type: SpecialDayType;
  month: number;
  day: number;
  note?: string;
  color?: string;
  year?: number | null;
  daysUntil?: number;
}

export interface CreateSpecialDayDto {
  name: string;
  type: SpecialDayType;
  month: number;
  day: number;
  year?: number | null;
  note?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class SpecialDayService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/special-days`;

  /** Shared store — the Special Days page and the calendar both read this. */
  readonly items = signal<SpecialDay[]>([]);

  getAll(): Observable<SpecialDay[]> {
    return this.http.get<{ success: boolean; data: SpecialDay[] }>(this.API).pipe(
      tap(r => this.items.set(r.data ?? [])),
      map(r => r.data ?? []),
    );
  }

  create(dto: CreateSpecialDayDto): Observable<SpecialDay> {
    return this.http.post<{ success: boolean; data: SpecialDay }>(this.API, dto).pipe(
      tap(r => this.items.update(list => [...list, r.data])),
      map(r => r.data),
    );
  }
}
