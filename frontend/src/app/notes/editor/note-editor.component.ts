// src/app/notes/editor/note-editor.component.ts
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonModal,
  IonInput,
  IonTextarea,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  bookmarkOutline,
  bookmark,
  trashOutline,
  personAddOutline,
  personRemoveOutline,
  closeOutline,
  ellipsisVertical,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { NoteService, Note, NoteCollaborator } from '../../core/services/note.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { FriendService, Friend } from '../../core/services/friend.service';
import { FriendAvatarComponent } from '../../core/components/friend-avatar.component';

interface MenuItem {
  label: string;
  icon: string;
  destructive?: boolean;
  action: () => void;
}

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonTextarea, FriendAvatarComponent],
  template: `
    <ion-content [scrollY]="true" class="page">
      <ng-container *ngIf="!loading()">
        <div class="hdr">
          <div class="hdr-row">
            <button class="icon-btn" (click)="back()">
              <ion-icon name="chevron-back-outline"></ion-icon>
            </button>
            <div class="hdr-title" *ngIf="otherParty().length">
              <app-friend-avatar [name]="otherParty()[0].name" [avatar]="otherParty()[0].avatar"
                [gender]="otherParty()[0].gender" [size]="24"></app-friend-avatar>
              <span class="hdr-title-txt">Shared with {{ collabNames() }}</span>
            </div>
            <div class="hdr-title" *ngIf="!otherParty().length">
              <span class="hdr-heading">{{ isNew() ? 'New Note' : 'Note' }}</span>
            </div>
            <div class="hdr-spacer"></div>
            <button class="icon-btn" (click)="openMenu()">
              <ion-icon name="ellipsis-vertical"></ion-icon>
            </button>
          </div>
        </div>

        <div class="body">
          <ion-input class="title-input" placeholder="Title (optional)"
            [value]="titleDraft()" (ionInput)="onTitleInput($any($event.target).value)"></ion-input>
          <ion-textarea class="ta" placeholder="Type a note…" [autoGrow]="true"
            [value]="textDraft()" (ionInput)="onTextInput($any($event.target).value)"></ion-textarea>
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

    <!-- Note options — left-aligned iOS-style bottom sheet (tap outside to dismiss) -->
    <div class="opts-scrim" *ngIf="menuOpen()" (click)="menuOpen.set(false)">
      <div class="opts-sheet" (click)="$event.stopPropagation()">
        <div class="opts-grip"></div>
        <button class="opt-row" *ngFor="let it of menuItems()" [class.destructive]="it.destructive"
          (click)="runMenuItem(it)">
          <ion-icon [name]="it.icon"></ion-icon>
          <span class="opt-label">{{ it.label }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .page { --background: var(--rm-bg); }

    .hdr { background: var(--rm-bg); padding: calc(env(safe-area-inset-top) + 14px) 12px 12px; }
    .hdr-row { display: flex; align-items: center; gap: 6px; }
    .hdr-spacer { flex: 1; }
    .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: none; color: var(--rm-text-secondary); display: flex; align-items: center; justify-content: center; font-size: 21px; cursor: pointer; flex: none; }
    .icon-btn:active { background: var(--rm-surface); }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; flex: none; }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }

    .hdr-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .hdr-title-txt { font-size: 13.5px; font-weight: 600; color: var(--rm-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hdr-heading { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .body { min-height: calc(100% - 96px); padding: 8px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
    .title-input { --color: var(--rm-text-primary); font-size: 21px; font-weight: 800; line-height: 1.3; }
    .ta { --color: var(--rm-text-primary); font-size: 15.5px; font-weight: 600; line-height: 1.5; }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 6px; }
    .sheet-title { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); }
    .sheet-body { padding: 14px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
    .empty-friends { text-align: center; padding: 30px 0; color: var(--rm-text-muted); font-size: 14px; font-weight: 600; }
    .friend-row { display: flex; align-items: center; gap: 14px; padding: 10px 4px; cursor: pointer; border-radius: 12px; }
    .friend-row:active { background: var(--rm-surface); }
    .friend-name { font-size: 14.5px; font-weight: 600; color: var(--rm-text-primary); }

    /* Note options bottom sheet */
    @keyframes optsFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes optsUp { from { transform: translateY(100%); } to { transform: none; } }
    .opts-scrim { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; animation: optsFade .2s ease both; }
    .opts-sheet { width: 100%; background: var(--rm-card); border-radius: 22px 22px 0 0; padding: 6px 8px calc(env(safe-area-inset-bottom) + 14px); animation: optsUp .28s cubic-bezier(.32,.72,0,1) both; }
    .opts-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--rm-border); margin: 8px auto 6px; }
    .opt-row { display: flex; align-items: center; gap: 16px; width: 100%; border: none; background: none; padding: 15px 18px; border-radius: 14px; cursor: pointer; text-align: left; color: var(--rm-text-primary); font-family: inherit; }
    .opt-row:active { background: var(--rm-surface); }
    .opt-row ion-icon { font-size: 22px; color: var(--rm-text-secondary); flex: none; }
    .opt-label { font-size: 16px; font-weight: 600; }
    .opt-row.destructive { color: var(--rm-danger); }
    .opt-row.destructive ion-icon { color: var(--rm-danger); }
    @media (prefers-reduced-motion: reduce) { .opts-scrim, .opts-sheet { animation: none; } }
  `],
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
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
  private creating = false;

  readonly loading = signal(true);
  readonly note = signal<Note | null>(null);
  // True for a brand-new, not-yet-persisted note (route id === 'new').
  readonly isNew = signal(false);
  readonly titleDraft = signal('');
  readonly textDraft = signal('');
  readonly sharing = signal(false);
  readonly menuOpen = signal(false);
  readonly friends = signal<Friend[]>([]);
  // Friends chosen to share with before the note exists — applied as
  // collaborators the moment the first keystroke creates it.
  readonly pendingShareIds = signal<string[]>([]);

  // A brand-new unsaved note is always "yours"; otherwise compare ownership.
  readonly isOwner = computed(() => {
    const n = this.note();
    if (!n) return this.isNew();
    const me = this.authService.currentUser()?._id;
    return !!me && n.userId._id === me;
  });

  // Real collaborators once the note exists; before that, the pending picks
  // resolved against the loaded friends list so they still render as avatars.
  readonly collaborators = computed<NoteCollaborator[]>(() => {
    const n = this.note();
    if (n) return n.collaborators;
    const ids = new Set(this.pendingShareIds());
    return this.friends()
      .filter((f) => ids.has(f._id))
      .map((f) => ({ _id: f._id, name: f.name, avatar: f.avatar, gender: f.gender }));
  });

  // "The other party" for the header — the owner when I'm a collaborator, or my
  // collaborators when I own it — always excluding myself (mirrors the list's
  // othersOn()). The unshare menu still iterates collaborators() directly since
  // you only ever unshare people you shared *with*.
  readonly otherParty = computed<NoteCollaborator[]>(() => {
    const me = this.authService.currentUser()?._id;
    const n = this.note();
    const base = n ? [n.userId, ...n.collaborators] : this.collaborators();
    return base.filter((c) => c._id !== me);
  });

  readonly collabNames = computed(() => this.otherParty().map((c) => c.name).join(', '));

  readonly shareCandidates = computed(() => {
    const already = new Set(this.collaborators().map((c) => c._id));
    const ownerId = this.note()?.userId._id ?? this.authService.currentUser()?._id;
    return this.friends().filter((f) => !already.has(f._id) && f._id !== ownerId);
  });

  // Rows for the options bottom sheet. Owner sees pin / (share XOR unshare) /
  // delete; a collaborator (non-owner) only gets pin. Sharing is one-to-one, so
  // "Add people" only appears while the note is still private — once it's shared
  // the sole sharing action is "Unshare <name>".
  readonly menuItems = computed<MenuItem[]>(() => {
    const n = this.note();
    const items: MenuItem[] = [];

    if (n) {
      items.push({
        label: n.pinned ? 'Unpin' : 'Pin',
        icon: n.pinned ? 'bookmark' : 'bookmark-outline',
        action: () => this.togglePin(),
      });
    }

    if (this.isOwner()) {
      const collabs = this.collaborators();
      if (collabs.length === 0) {
        items.push({ label: 'Add people', icon: 'person-add-outline', action: () => this.openShareSheet() });
      } else {
        for (const c of collabs) {
          items.push({
            label: `Unshare ${c.name}`,
            icon: 'person-remove-outline',
            action: () => this.removeCollaborator(c._id),
          });
        }
      }
      if (n) {
        items.push({ label: 'Delete', icon: 'trash-outline', destructive: true, action: () => this.confirmDelete() });
      }
    }

    return items;
  });

  constructor() {
    addIcons({ chevronBackOutline, bookmarkOutline, bookmark, trashOutline, personAddOutline, personRemoveOutline, closeOutline, ellipsisVertical });
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')!;
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'shared' || tabParam === 'mine') this.tab = tabParam;

    if (this.id === 'new') {
      // Blank editor — the note is lazy-created on the first keystroke.
      this.isNew.set(true);
      this.loading.set(false);
    } else {
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
    if (!text) return; // an empty note is never persisted

    if (this.note()) {
      this.noteService
        .update(this.id, { text: this.textDraft(), title: this.titleDraft().trim() })
        .subscribe();
      return;
    }

    // Brand-new note: create it on the first non-empty content, then keep
    // editing the real record. Guard so a keystroke burst can't create twice.
    if (this.creating) return;
    this.creating = true;
    this.noteService
      .create({
        text: this.textDraft(),
        title: this.titleDraft().trim() || undefined,
        collaboratorIds: this.pendingShareIds().length ? this.pendingShareIds() : undefined,
      })
      .subscribe({
        next: (created) => {
          this.creating = false;
          this.id = created._id;
          this.isNew.set(false);
          this.note.set(created);
          this.pendingShareIds.set([]);
          // Swap the ':id=new' URL for the real id in place — no navigation, so
          // the textarea keeps focus while typing; Back/refresh now resolve.
          this.location.replaceState(`/app/notes/${created._id}`, `tab=${this.tab}`);
          // If the user kept typing during the create round-trip, save the delta.
          if (
            this.textDraft().trim() !== created.text ||
            this.titleDraft().trim() !== (created.title || '')
          ) {
            this.flushSave();
          }
        },
        error: () => {
          this.creating = false;
        },
      });
  }

  // 3-dot overflow menu — opens the left-aligned options bottom sheet.
  // Its rows come from menuItems(); tap outside to dismiss (no Cancel row).
  openMenu(): void {
    this.menuOpen.set(true);
  }

  runMenuItem(item: MenuItem): void {
    this.menuOpen.set(false);
    item.action();
  }

  togglePin(): void {
    if (!this.note()) return;
    // Apply the new pin state locally from the response instead of waiting on
    // the socket round-trip. The menu's Pin/Unpin row is now the only place pin
    // state surfaces in the editor, so a laggy/reconnecting mobile socket would
    // otherwise leave it stale and make re-taps double-toggle.
    this.noteService.togglePin(this.id).subscribe((updated) => this.note.set(updated));
  }

  back(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flushSave();
    }
    this.router.navigate(['/app/notes'], { queryParams: { tab: this.tab } });
  }

  async confirmDelete(): Promise<void> {
    if (!this.note()) return;
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
    if (this.note()) {
      // Reflect the new collaborator locally from the response so the options
      // menu flips from "Add people" to "Unshare …" immediately, without
      // depending on the socket round-trip.
      this.noteService.share(this.id, friendId).subscribe((updated) => {
        this.note.set(updated);
        this.sharing.set(false);
      });
    } else {
      // Not created yet — remember; applied (and notified) when the first
      // keystroke creates the note.
      this.pendingShareIds.update((ids) => (ids.includes(friendId) ? ids : [...ids, friendId]));
      this.sharing.set(false);
    }
  }

  removeCollaborator(friendId: string): void {
    if (this.note()) {
      // Drop the collaborator locally too (unshare() resolves to void) so the
      // menu returns to "Add people" right away rather than after the socket.
      this.noteService.unshare(this.id, friendId).subscribe(() =>
        this.note.update((n) =>
          n ? { ...n, collaborators: n.collaborators.filter((c) => c._id !== friendId) } : n
        )
      );
    } else {
      this.pendingShareIds.update((ids) => ids.filter((id) => id !== friendId));
    }
  }
}
