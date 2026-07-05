// src/app/notes/editor/note-editor.component.ts
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonModal,
  IonInput,
  IonTextarea,
  IonSpinner,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  bookmarkOutline,
  bookmark,
  trashOutline,
  checkmark,
  personAddOutline,
  closeOutline,
  closeCircle,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { NoteService, Note } from '../../core/services/note.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { FriendService, Friend } from '../../core/services/friend.service';
import { FriendAvatarComponent } from '../../core/components/friend-avatar.component';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonTextarea, IonSpinner, FriendAvatarComponent],
  template: `
    <ion-content [scrollY]="true" class="page">
      <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>

      <ng-container *ngIf="!loading() && note() as n">
        <div class="hdr">
          <div class="hdr-row">
            <button class="icon-btn" (click)="back()">
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>
            <div class="hdr-spacer"></div>
            <button class="icon-btn" (click)="togglePin()">
              <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'"></ion-icon>
            </button>
            <button class="icon-btn" *ngIf="isOwner()" (click)="openShareSheet()">
              <ion-icon name="person-add-outline"></ion-icon>
            </button>
            <button class="icon-btn" *ngIf="isOwner()" (click)="confirmDelete()">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </div>

          <div class="collab-row" *ngIf="n.collaborators.length">
            <div class="collab-stack">
              <app-friend-avatar *ngFor="let c of n.collaborators" class="collab-av"
                [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="26"></app-friend-avatar>
            </div>
            <span class="collab-label">Shared with {{ collabNames() }}</span>
          </div>
        </div>

        <div class="body">
          <ion-input class="title-input" placeholder="Title (optional)"
            [value]="titleDraft()" (ionInput)="onTitleInput($any($event.target).value)"></ion-input>
          <ion-textarea class="ta" placeholder="Type a note…" [autoGrow]="true"
            [value]="textDraft()" (ionInput)="onTextInput($any($event.target).value)"></ion-textarea>

          <div class="shared-list" *ngIf="n.collaborators.length">
            <div class="field-label">Shared with</div>
            <div class="shared-row" *ngFor="let c of n.collaborators">
              <app-friend-avatar [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="32"></app-friend-avatar>
              <span class="shared-name">{{ c.name }}</span>
              <ion-icon *ngIf="isOwner()" name="close-circle" class="shared-remove" (click)="removeCollaborator(c._id)"></ion-icon>
            </div>
          </div>
        </div>
      </ng-container>
    </ion-content>

    <!-- Share sheet -->
    <ion-modal [isOpen]="sharing()" (didDismiss)="sharing.set(false)" [initialBreakpoint]="0.6" [breakpoints]="[0, 0.6]">
      <ng-template>
        <div class="sheet">
          <div class="sheet-hdr">
            <div class="sheet-title">Share Note</div>
            <button class="circle-btn dark" (click)="sharing.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="sheet-body">
            <div class="empty-friends" *ngIf="shareCandidates().length === 0">
              No more friends to share with.
            </div>
            <div class="friend-row" *ngFor="let f of shareCandidates()" (click)="addCollaborator(f._id)">
              <app-friend-avatar [name]="f.name" [avatar]="f.avatar" [gender]="f.gender" [size]="38"></app-friend-avatar>
              <span class="friend-name">{{ f.name }}</span>
            </div>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .page { --background: var(--rm-bg); }
    .loading { display: flex; justify-content: center; padding: 80px 0; }

    .hdr { background: var(--rm-bg); padding: calc(env(safe-area-inset-top) + 14px) 12px 12px; }
    .hdr-row { display: flex; align-items: center; gap: 2px; }
    .hdr-spacer { flex: 1; }
    .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: none; color: var(--rm-text-secondary); display: flex; align-items: center; justify-content: center; font-size: 21px; cursor: pointer; flex: none; }
    .icon-btn:active { background: var(--rm-surface); }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; flex: none; }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }

    .collab-row { display: flex; align-items: center; gap: 10px; margin: 10px 8px 0; }
    .collab-stack { display: flex; }
    .collab-av { margin-left: -8px; border: 2px solid var(--rm-bg); border-radius: 50%; }
    .collab-av:first-child { margin-left: 0; }
    .collab-label { font-size: 12.5px; font-weight: 600; color: var(--rm-text-secondary); }

    .body { min-height: calc(100% - 96px); padding: 8px 20px 20px; display: flex; flex-direction: column; gap: 20px; }
    .title-input { --color: var(--rm-text-primary); font-size: 18px; font-weight: 800; }
    .ta { --color: var(--rm-text-primary); font-size: 15.5px; font-weight: 600; line-height: 1.5; }

    .field-label { font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 10px; }
    .shared-list { border-top: 1px solid var(--rm-border); padding-top: 16px; }
    .shared-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .shared-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--rm-text-primary); }
    .shared-remove { font-size: 20px; color: var(--rm-text-muted); cursor: pointer; }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 6px; }
    .sheet-title { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); }
    .sheet-body { padding: 14px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
    .empty-friends { text-align: center; padding: 30px 0; color: var(--rm-text-muted); font-size: 14px; font-weight: 600; }
    .friend-row { display: flex; align-items: center; gap: 14px; padding: 10px 4px; cursor: pointer; border-radius: 12px; }
    .friend-row:active { background: var(--rm-surface); }
    .friend-name { font-size: 14.5px; font-weight: 600; color: var(--rm-text-primary); }
  `],
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private noteService = inject(NoteService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private friendService = inject(FriendService);
  private alertCtrl = inject(AlertController);

  private id = '';
  private tab: 'mine' | 'shared' = 'mine';
  private socketSubs: Subscription[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private lastLocalEditAt = 0;

  readonly loading = signal(true);
  readonly note = signal<Note | null>(null);
  readonly titleDraft = signal('');
  readonly textDraft = signal('');
  readonly sharing = signal(false);
  readonly friends = signal<Friend[]>([]);

  readonly isOwner = computed(() => {
    const n = this.note();
    const me = this.authService.currentUser()?._id;
    return !!n && !!me && n.userId._id === me;
  });

  readonly collabNames = computed(() =>
    this.note()?.collaborators.map((c) => c.name).join(', ') ?? ''
  );

  readonly shareCandidates = computed(() => {
    const n = this.note();
    if (!n) return [];
    const collabIds = new Set(n.collaborators.map((c) => c._id));
    return this.friends().filter((f) => !collabIds.has(f._id) && f._id !== n.userId._id);
  });

  constructor() {
    addIcons({ chevronBackOutline, bookmarkOutline, bookmark, trashOutline, checkmark, personAddOutline, closeOutline, closeCircle });
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')!;
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'shared' || tabParam === 'mine') this.tab = tabParam;

    const existing = this.noteService.notes().find((n) => n._id === this.id);
    if (existing) {
      this.applyIncoming(existing);
      this.loading.set(false);
      this.noteService.markViewed(this.id).subscribe();
    } else {
      this.noteService.getAll().subscribe({
        next: () => {
          const found = this.noteService.notes().find((n) => n._id === this.id);
          this.loading.set(false);
          if (found) {
            this.applyIncoming(found);
            this.noteService.markViewed(this.id).subscribe();
          } else {
            this.router.navigate(['/app/notes']);
          }
        },
        error: () => {
          this.loading.set(false);
          this.router.navigate(['/app/notes']);
        },
      });
    }

    this.socketSubs.push(
      this.socketService.on<{ note: Note }>('note:updated').subscribe(({ note }) => {
        if (note._id === this.id) this.applyIncoming(note);
      }),
      this.socketService.on<{ note: Note }>('note:shared').subscribe(({ note }) => {
        if (note._id === this.id) this.applyIncoming(note);
      }),
      this.socketService
        .on<{ noteId: string; friendId: string }>('note:unshared')
        .subscribe(({ noteId, friendId }) => {
          if (noteId !== this.id) return;
          const myId = this.authService.currentUser()?._id;
          if (friendId === myId) {
            this.router.navigate(['/app/notes']);
            return;
          }
          this.note.update((n) =>
            n ? { ...n, collaborators: n.collaborators.filter((c) => c._id !== friendId) } : n
          );
        }),
      this.socketService.on<{ noteId: string }>('note:deleted').subscribe(({ noteId }) => {
        if (noteId === this.id) this.router.navigate(['/app/notes']);
      })
    );
  }

  ngOnDestroy(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
    clearTimeout(this.saveTimer);
  }

  private applyIncoming(n: Note): void {
    const typingRecently = Date.now() - this.lastLocalEditAt < 1000;
    this.note.set(n);
    if (!typingRecently) {
      this.textDraft.set(n.text);
      this.titleDraft.set(n.title);
    }
  }

  onTitleInput(value: string): void {
    this.titleDraft.set(value);
    this.lastLocalEditAt = Date.now();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 600);
  }

  onTextInput(value: string): void {
    this.textDraft.set(value);
    this.lastLocalEditAt = Date.now();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 600);
  }

  private flushSave(): void {
    const text = this.textDraft().trim();
    if (!text || !this.note()) return;
    this.noteService.update(this.id, { text: this.textDraft(), title: this.titleDraft().trim() }).subscribe();
  }

  togglePin(): void {
    this.noteService.togglePin(this.id).subscribe();
  }

  back(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flushSave();
    }
    this.router.navigate(['/app/notes'], { queryParams: { tab: this.tab } });
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Note',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () =>
            this.noteService
              .delete(this.id)
              .subscribe(() => this.router.navigate(['/app/notes'], { queryParams: { tab: this.tab } })),
        },
      ],
    });
    await alert.present();
  }

  openShareSheet(): void {
    this.sharing.set(true);
    this.friendService.getFriends().subscribe(({ friends }) => this.friends.set(friends));
  }

  addCollaborator(friendId: string): void {
    this.noteService.share(this.id, friendId).subscribe(() => this.sharing.set(false));
  }

  removeCollaborator(friendId: string): void {
    this.noteService.unshare(this.id, friendId).subscribe();
  }
}
