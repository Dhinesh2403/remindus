// src/app/core/services/note.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type NoteHue = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface Note {
  _id: string;
  text: string;
  color: NoteHue;
  pinned: boolean;
  priority: 'normal' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDto {
  text: string;
  color?: NoteHue;
  priority?: 'normal' | 'high';
}

@Injectable({ providedIn: 'root' })
export class NoteService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/notes`;

  getAll(): Observable<Note[]> {
    return this.http.get<{ data: Note[] }>(this.API).pipe(map((r) => r.data));
  }

  create(dto: CreateNoteDto): Observable<Note> {
    return this.http.post<{ data: Note }>(this.API, dto).pipe(map((r) => r.data));
  }

  update(id: string, dto: Partial<CreateNoteDto & { pinned: boolean }>): Observable<Note> {
    return this.http.put<{ data: Note }>(`${this.API}/${id}`, dto).pipe(map((r) => r.data));
  }

  togglePin(id: string): Observable<Note> {
    return this.http.patch<{ data: Note }>(`${this.API}/${id}/pin`, {}).pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
