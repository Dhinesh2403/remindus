// src/app/core/services/goal.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Milestone {
  _id?: string;
  t: string;
  done: boolean;
}

export interface Goal {
  _id: string;
  title: string;
  cat: string;
  color: string;
  target: string;
  milestones: Milestone[];
}

export interface CreateGoalDto {
  title: string;
  cat?: string;
  color?: string;
  target?: string;
  milestones?: { t: string; done?: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/goals`;

  getAll(): Observable<Goal[]> {
    return this.http.get<{ data: Goal[] }>(this.API).pipe(map((r) => r.data));
  }

  create(dto: CreateGoalDto): Observable<Goal> {
    return this.http.post<{ data: Goal }>(this.API, dto).pipe(map((r) => r.data));
  }

  update(id: string, dto: Partial<CreateGoalDto>): Observable<Goal> {
    return this.http.put<{ data: Goal }>(`${this.API}/${id}`, dto).pipe(map((r) => r.data));
  }

  toggleMilestone(id: string, index: number): Observable<Goal> {
    return this.http.patch<{ data: Goal }>(`${this.API}/${id}/milestone`, { index }).pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
