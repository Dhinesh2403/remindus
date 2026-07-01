// src/app/core/services/task.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Task {
  _id: string;
  title: string;
  notes?: string;
  status: 'active' | 'done';
  dueDate?: string;
  startTime?: string;
  estimatedMin?: number;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  subtasks?: { _id?: string; title: string; done: boolean }[];
  reminderType?: 'notification' | 'alarm' | 'none';
  repeat?: string;
  assignedTo?: string;
  createdAt?: string;
}

type ApiOne  = { success: boolean; data: Task };
type ApiList = { success: boolean; data: Task[] };

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tasks`;

  readonly tasks = signal<Task[]>([]);

  loadTasks(params?: { status?: string; category?: string; priority?: string }): Observable<ApiList> {
    return this.http.get<ApiList>(this.base, { params: params as any }).pipe(
      tap(res => this.tasks.set(res.data ?? []))
    );
  }

  createTask(data: Partial<Task>): Observable<ApiOne> {
    return this.http.post<ApiOne>(this.base, data).pipe(
      tap(res => this.tasks.update(t => [res.data, ...t]))
    );
  }

  updateTask(id: string, data: Partial<Task>): Observable<ApiOne> {
    return this.http.put<ApiOne>(`${this.base}/${id}`, data).pipe(
      tap(res => this.tasks.update(t => t.map(x => x._id === id ? res.data : x)))
    );
  }

  toggleDone(id: string): Observable<ApiOne> {
    return this.http.patch<ApiOne>(`${this.base}/${id}/toggle`, {}).pipe(
      tap(res => this.tasks.update(t => t.map(x => x._id === id ? res.data : x)))
    );
  }

  deleteTask(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/${id}`).pipe(
      tap(() => this.tasks.update(t => t.filter(x => x._id !== id)))
    );
  }

  getTask(id: string): Observable<ApiOne> {
    return this.http.get<ApiOne>(`${this.base}/${id}`);
  }
}
