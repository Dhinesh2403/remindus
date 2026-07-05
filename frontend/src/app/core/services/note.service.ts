// src/app/core/services/note.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';

export type NoteHue = 'none' | 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface NoteCollaborator {
  _id: string;
  name: string;
  avatar?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
}

export interface Note {
  _id: string;
  title: string;
  text: string;
  color: NoteHue;
  pinned: boolean;
  order: number;
  userId: NoteCollaborator;
  collaborators: NoteCollaborator[];
  hasUnreadEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDto {
  title?: string;
  text: string;
  color?: NoteHue;
  collaboratorIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class NoteService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private authService = inject(AuthService);
  private readonly API = `${environment.apiUrl}/notes`;

  private _notes = signal<Note[]>([]);
  readonly notes = this._notes.asReadonly();

  constructor() {
    this.listenToSocketEvents();
  }

  getAll(): Observable<Note[]> {
    return this.http
      .get<{ data: Note[] }>(this.API)
      .pipe(
        // Notes saved before collaborators/order/title existed may come back without
        // them (older/un-updated backends) — normalize so the template's
        // unguarded n.collaborators.length/slice() never sees undefined.
        map((r) =>
          r.data.map((n) => ({
            ...n,
            title: n.title ?? '',
            collaborators: n.collaborators || [],
            order: n.order ?? 0,
            hasUnreadEdit: n.hasUnreadEdit ?? false,
          }))
        ),
        tap((data) => this._notes.set(this.sortNotes(data)))
      );
  }

  create(dto: CreateNoteDto): Observable<Note> {
    return this.http.post<{ data: Note }>(this.API, dto).pipe(
      map((r) => r.data),
      tap((created) => this._notes.update((list) => this.sortNotes([created, ...list])))
    );
  }

  update(id: string, dto: Partial<CreateNoteDto & { pinned: boolean }>): Observable<Note> {
    return this.http
      .put<{ data: Note }>(`${this.API}/${id}`, dto)
      .pipe(map((r) => r.data), tap((updated) => this.upsertSorted(updated)));
  }

  togglePin(id: string): Observable<Note> {
    return this.http
      .patch<{ data: Note }>(`${this.API}/${id}/pin`, {})
      .pipe(map((r) => r.data), tap((updated) => this.upsertSorted(updated)));
  }

  markViewed(id: string): Observable<Note> {
    return this.http
      .patch<{ data: Note }>(`${this.API}/${id}/view`, {})
      .pipe(map((r) => r.data), tap((updated) => this.upsertSorted(updated)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`).pipe(
      tap(() => this._notes.update((list) => list.filter((n) => n._id !== id)))
    );
  }

  share(id: string, friendId: string): Observable<Note> {
    return this.http
      .post<{ data: Note }>(`${this.API}/${id}/share`, { friendId })
      .pipe(map((r) => r.data), tap((updated) => this.upsertSorted(updated)));
  }

  unshare(id: string, friendId: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}/share/${friendId}`).pipe(
      tap(() => {
        this._notes.update((list) =>
          list.map((n) =>
            n._id === id ? { ...n, collaborators: n.collaborators.filter((c) => c._id !== friendId) } : n
          )
        );
      })
    );
  }

  reorder(id: string, order: number): Observable<Note> {
    return this.http
      .patch<{ data: Note }>(`${this.API}/${id}/order`, { order })
      .pipe(map((r) => r.data), tap((updated) => this.upsertSorted(updated)));
  }

  // ─── Real-time socket updates (for edits made by collaborators elsewhere) ──
  private listenToSocketEvents(): void {
    this.socketService.on<{ note: Note }>('note:created').subscribe(({ note }) => {
      this._notes.update((list) =>
        list.some((n) => n._id === note._id) ? list : this.sortNotes([note, ...list])
      );
    });

    this.socketService.on<{ note: Note }>('note:updated').subscribe(({ note }) => {
      this.upsertSorted(note);
    });

    this.socketService.on<{ note: Note }>('note:shared').subscribe(({ note }) => {
      this._notes.update((list) =>
        list.some((n) => n._id === note._id)
          ? this.sortNotes(list.map((n) => (n._id === note._id ? note : n)))
          : this.sortNotes([note, ...list])
      );
    });

    this.socketService
      .on<{ noteId: string; friendId: string }>('note:unshared')
      .subscribe(({ noteId, friendId }) => {
        const myId = this.authService.currentUser()?._id;
        if (friendId === myId) {
          // I was the one removed — the note no longer belongs in my list.
          this._notes.update((list) => list.filter((n) => n._id !== noteId));
          return;
        }
        this._notes.update((list) =>
          list.map((n) =>
            n._id === noteId
              ? { ...n, collaborators: n.collaborators.filter((c) => c._id !== friendId) }
              : n
          )
        );
      });

    this.socketService
      .on<{ noteId: string }>('note:deleted')
      .subscribe(({ noteId }) => {
        this._notes.update((list) => list.filter((n) => n._id !== noteId));
      });

    this.socketService
      .on<{ noteId: string; order: number }>('note:reordered')
      .subscribe(({ noteId, order }) => {
        this._notes.update((list) =>
          this.sortNotes(list.map((n) => (n._id === noteId ? { ...n, order } : n)))
        );
      });

    // Clears the unread badge on this user's other devices when one of them views the note.
    this.socketService.on<{ noteId: string }>('note:viewed').subscribe(({ noteId }) => {
      this._notes.update((list) =>
        list.map((n) => (n._id === noteId ? { ...n, hasUnreadEdit: false } : n))
      );
    });
  }

  private upsertSorted(updated: Note): void {
    this._notes.update((list) =>
      this.sortNotes(
        list.some((n) => n._id === updated._id)
          ? list.map((n) => (n._id === updated._id ? updated : n))
          : [updated, ...list]
      )
    );
  }

  // Canonical display order — mirrors the backend's `{ pinned: -1, order: -1 }`
  // sort so every local mutation (pin, reorder, share) stays visually stable
  // without waiting on a full re-fetch.
  private sortNotes(list: Note[]): Note[] {
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.order - a.order;
    });
  }
}
