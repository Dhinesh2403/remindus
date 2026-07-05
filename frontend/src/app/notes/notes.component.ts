// src/app/notes/notes.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonModal,
  IonInput,
  IonTextarea,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  menuOutline,
  addOutline,
  closeOutline,
  bookmarkOutline,
  bookmark,
  searchOutline,
  checkmark,
  gridOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { NoteService, Note, NoteCollaborator } from '../core/services/note.service';
import { AuthService } from '../core/services/auth.service';
import { FriendService, Friend } from '../core/services/friend.service';
import { FriendAvatarComponent } from '../core/components/friend-avatar.component';

type Section = 'pinned' | 'other';
type Tab = 'mine' | 'shared';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonTextarea, IonSpinner, FriendAvatarComponent],
  template: `
    <ion-content [scrollY]="true" class="page">
      <div class="hdr">
        <div class="hdr-row">
          <button class="icon-btn" (click)="back()">
            <ion-icon name="menu-outline"></ion-icon>
          </button>
          <div class="search-row">
            <ion-icon name="search-outline"></ion-icon>
            <input class="search-input" placeholder="Search notes"
              [value]="searchTerm()" (input)="searchTerm.set($any($event.target).value)" />
          </div>
          <button class="icon-btn">
            <ion-icon name="grid-outline"></ion-icon>
          </button>
          <button class="icon-btn">
            <ion-icon name="swap-vertical-outline"></ion-icon>
          </button>
          <button class="avatar-btn" (click)="openProfile()">
            <app-friend-avatar [name]="myName()" [avatar]="myAvatar()" [gender]="myGender()" [size]="34"></app-friend-avatar>
          </button>
        </div>
        <div class="tabs-row">
          <button class="tab-btn" [class.active]="activeTab() === 'mine'" (click)="activeTab.set('mine')">My Notes</button>
          <button class="tab-btn" [class.active]="activeTab() === 'shared'" (click)="activeTab.set('shared')">Shared</button>
        </div>
      </div>

      <div class="body">
        <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>
        <div class="empty" *ngIf="!loading() && tabNotes().length === 0">
          {{ activeTab() === 'shared' ? 'No shared notes yet.' : 'No notes yet. Tap + to jot one down.' }}
        </div>
        <div class="empty" *ngIf="!loading() && tabNotes().length > 0 && filteredNotes().length === 0">No notes match "{{ searchTerm() }}".</div>

        <!-- Pinned -->
        <ng-container *ngIf="displayedPinned().length">
          <div class="section-label"><ion-icon name="bookmark"></ion-icon> Pinned</div>
          <div class="masonry">
            <div class="note" *ngFor="let n of displayedPinned(); trackBy: trackNote"
              [attr.data-id]="n._id" [attr.data-section]="'pinned'"
              [class.dragging]="draggingId() === n._id"
              [style.transform]="draggingId() === n._id ? ('translate(' + dragDX() + 'px,' + dragDY() + 'px) scale(1.04)') : null"
              (pointerdown)="onPointerDown($event, n, 'pinned')" (pointermove)="onPointerMove($event)"
              (pointerup)="onPointerUp($event, n)" (pointercancel)="onPointerCancel()">
              <div class="unread-dot" *ngIf="n.hasUnreadEdit"></div>
              <div class="note-title" *ngIf="n.title">{{ n.title }}</div>
              <div class="note-text">{{ n.text }}</div>
              <div class="note-foot">
                <div class="note-foot-left">
                  <div class="collab-stack" *ngIf="othersOn(n).length">
                    <app-friend-avatar *ngFor="let c of othersOn(n).slice(0,3)" class="collab-av"
                      [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="20"></app-friend-avatar>
                    <span class="collab-more" *ngIf="othersOn(n).length > 3">+{{ othersOn(n).length - 3 }}</span>
                  </div>
                  <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
                </div>
                <div class="note-acts">
                  <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Others -->
        <div class="masonry" *ngIf="displayedOther().length">
          <div class="note" *ngFor="let n of displayedOther(); trackBy: trackNote"
            [attr.data-id]="n._id" [attr.data-section]="'other'"
            [class.dragging]="draggingId() === n._id"
            [style.transform]="draggingId() === n._id ? ('translate(' + dragDX() + 'px,' + dragDY() + 'px) scale(1.04)') : null"
            (pointerdown)="onPointerDown($event, n, 'other')" (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp($event, n)" (pointercancel)="onPointerCancel()">
            <div class="unread-dot" *ngIf="n.hasUnreadEdit"></div>
            <div class="note-title" *ngIf="n.title">{{ n.title }}</div>
            <div class="note-text">{{ n.text }}</div>
            <div class="note-foot">
              <div class="note-foot-left">
                <div class="collab-stack" *ngIf="othersOn(n).length">
                  <app-friend-avatar *ngFor="let c of othersOn(n).slice(0,3)" class="collab-av"
                    [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="20"></app-friend-avatar>
                  <span class="collab-more" *ngIf="othersOn(n).length > 3">+{{ othersOn(n).length - 3 }}</span>
                </div>
                <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
              </div>
              <div class="note-acts">
                <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="fab" (click)="openCompose()">
        <ion-icon name="add-outline"></ion-icon>
      </button>
    </ion-content>

    <!-- Compose sheet -->
    <ion-modal [isOpen]="composing()" (didDismiss)="composing.set(false)" [initialBreakpoint]="1" [breakpoints]="[0, 1]">
      <ng-template>
        <div class="sheet">
          <div class="sheet-hdr">
            <div class="sheet-title">New Note</div>
            <button class="circle-btn dark" (click)="composing.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="sheet-body">
            <ion-input class="title-input" placeholder="Title (optional)"
              [value]="draftTitle()" (ionInput)="draftTitle.set($any($event.target).value)"></ion-input>
            <ion-textarea class="ta" placeholder="Type a note…" [autoGrow]="true" [rows]="4"
              [value]="draft()" (ionInput)="draft.set($any($event.target).value)"></ion-textarea>

            <div class="share-section" *ngIf="composeFriends().length">
              <div class="field-label">Share with (optional)</div>
              <div class="friend-chip" *ngFor="let f of composeFriends()" [class.selected]="isSelected(f._id)" (click)="toggleSelected(f._id)">
                <app-friend-avatar [name]="f.name" [avatar]="f.avatar" [gender]="f.gender" [size]="28"></app-friend-avatar>
                <span class="friend-chip-name">{{ f.name }}</span>
                <ion-icon *ngIf="isSelected(f._id)" name="checkmark" class="friend-chip-check"></ion-icon>
              </div>
            </div>

            <button class="save-btn" (click)="save()">Save Note</button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    @keyframes rmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

    .page { --background: var(--rm-bg); position: relative; }
    .hdr { background: var(--rm-bg); padding: calc(env(safe-area-inset-top) + 14px) 16px 10px; animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 8px; }
    .icon-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: none; color: var(--rm-text-secondary); display: flex; align-items: center; justify-content: center; font-size: 21px; cursor: pointer; flex: none; }
    .icon-btn:active { background: var(--rm-surface); }
    .avatar-btn { border: none; background: none; padding: 0; margin-left: 2px; cursor: pointer; border-radius: 50%; flex: none; }

    .search-row { flex: 1; display: flex; align-items: center; gap: 9px; background: var(--rm-surface); border-radius: 24px; padding: 9px 16px; color: var(--rm-text-primary); }
    .search-row ion-icon { font-size: 17px; color: var(--rm-text-muted); flex: none; }
    .search-input { flex: 1; border: none; background: none; outline: none; color: var(--rm-text-primary); font-size: 14px; font-weight: 500; font-family: inherit; }
    .search-input::placeholder { color: var(--rm-text-muted); }

    .tabs-row { display: flex; gap: 8px; margin-top: 14px; background: var(--rm-surface); border-radius: 12px; padding: 4px; }
    .tab-btn { flex: 1; border: none; background: none; color: var(--rm-text-muted); font-size: 13px; font-weight: 700; padding: 8px 0; border-radius: 9px; cursor: pointer; }
    .tab-btn.active { background: var(--rm-card); color: var(--rm-purple); }

    .body { padding: 18px 16px calc(env(safe-area-inset-bottom) + 100px); }
    .empty { text-align: center; padding: 60px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .section-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .6px; text-transform: uppercase; margin-bottom: 11px; }

    .masonry { column-count: 2; column-gap: 12px; margin-bottom: 18px; }
    .note { position: relative; break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 12px; border-radius: 16px; padding: 14px; background: var(--rm-card); border: 1px solid var(--rm-border); animation: rmFadeUp .35s ease both; touch-action: pan-y; user-select: none; }
    .note.dragging { z-index: 10; opacity: .92; box-shadow: 0 8px 24px rgba(0,0,0,.35); transition: none; }
    .note-title { font-size: 14.5px; font-weight: 800; color: var(--rm-text-primary); margin-bottom: 4px; }
    .note-text { font-size: 14px; font-weight: 500; color: var(--rm-text-primary); line-height: 1.45; white-space: pre-wrap; }
    .note-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
    .note-foot-left { display: flex; align-items: center; gap: 8px; }
    .note-date { font-size: 11px; font-weight: 700; color: var(--rm-text-muted); }
    .note-acts { display: flex; gap: 11px; align-items: center; font-size: 16px; color: var(--rm-text-muted); }
    .note-acts ion-icon { cursor: pointer; }

    .unread-dot { position: absolute; top: 10px; right: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--rm-danger); box-shadow: 0 0 0 2px var(--rm-card); }
    .collab-stack { display: flex; align-items: center; }
    .collab-av { margin-left: -8px; border: 2px solid var(--rm-card); border-radius: 50%; }
    .collab-av:first-child { margin-left: 0; }
    .collab-more { margin-left: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--rm-text-muted); color: #fff; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid var(--rm-card); }

    .fab { position: fixed; right: 20px; bottom: calc(env(safe-area-inset-bottom) + 24px); width: 58px; height: 58px; border-radius: 50%; border: none; background: var(--rm-purple); color: #fff; font-size: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.35); z-index: 5; }
    .fab:active { transform: scale(.92); }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 6px; }
    .sheet-title { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); }
    .sheet-body { padding: 14px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; flex: none; }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .title-input { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 12px; --padding-bottom: 12px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 700; font-size: 15px; }
    .ta { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 14px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .save-btn { width: 100%; height: 52px; border-radius: 14px; border: none; background: var(--rm-purple); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }

    .share-section { border-top: 1px solid var(--rm-border); padding-top: 14px; display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 8px; }
    .friend-chip { display: flex; align-items: center; gap: 12px; padding: 9px 4px; cursor: pointer; border-radius: 12px; }
    .friend-chip:active { background: var(--rm-surface); }
    .friend-chip.selected { background: var(--rm-purple-light); }
    .friend-chip-name { flex: 1; font-size: 14px; font-weight: 600; color: var(--rm-text-primary); }
    .friend-chip-check { font-size: 17px; color: var(--rm-purple); }
  `],
})
export class NotesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private noteService = inject(NoteService);
  private authService = inject(AuthService);
  private friendService = inject(FriendService);

  readonly notes = this.noteService.notes;
  readonly loading = signal(true);

  readonly composing = signal(false);
  readonly draft = signal('');
  readonly draftTitle = signal('');
  readonly composeFriends = signal<Friend[]>([]);
  readonly selectedFriendIds = signal<string[]>([]);

  readonly activeTab = signal<Tab>('mine');
  readonly myId = computed(() => this.authService.currentUser()?._id ?? '');
  readonly myName = computed(() => this.authService.currentUser()?.name ?? '');
  readonly myAvatar = computed(() => this.authService.currentUser()?.avatar ?? null);
  readonly myGender = computed(() => this.authService.currentUser()?.gender ?? null);

  readonly searchTerm = signal('');
  readonly tabNotes = computed(() => {
    const notes = this.notes();
    return this.activeTab() === 'shared'
      ? notes.filter((n) => n.collaborators.length > 0)
      : notes.filter((n) => n.collaborators.length === 0);
  });
  readonly filteredNotes = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const all = this.tabNotes();
    return q ? all.filter((n) => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)) : all;
  });
  readonly pinnedNotes = computed(() => this.filteredNotes().filter((n) => n.pinned));
  readonly otherNotes = computed(() => this.filteredNotes().filter((n) => !n.pinned));

  // ─── Long-press drag reorder (native Pointer Events, no CDK) ──────────────
  readonly draggingId = signal<string | null>(null);
  readonly dragDX = signal(0);
  readonly dragDY = signal(0);
  private dragSection: Section | null = null;
  private dragWorkingIds = signal<string[] | null>(null);
  private longPressTimer: ReturnType<typeof setTimeout> | undefined;
  private pressActive = false;
  private pressMoved = false;
  private pressStartX = 0;
  private pressStartY = 0;
  private pressStartTime = 0;

  readonly displayedPinned = computed(() =>
    this.dragSection === 'pinned' && this.dragWorkingIds() ? this.reorderedFrom(this.dragWorkingIds()!) : this.pinnedNotes()
  );
  readonly displayedOther = computed(() =>
    this.dragSection === 'other' && this.dragWorkingIds() ? this.reorderedFrom(this.dragWorkingIds()!) : this.otherNotes()
  );

  constructor() {
    addIcons({ menuOutline, addOutline, closeOutline, bookmarkOutline, bookmark, searchOutline, checkmark, gridOutline, swapVerticalOutline });
  }

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'shared' || tab === 'mine') this.activeTab.set(tab);

    this.noteService.getAll().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  back(): void { this.router.navigate(['/app/dashboard']); }
  openProfile(): void { this.router.navigate(['/app/settings/profile']); }
  trackNote(_: number, n: Note): string { return n._id; }

  open(n: Note): void {
    this.router.navigate(['/app/notes', n._id], { queryParams: { tab: this.activeTab() } });
  }

  // Everyone attached to this note besides me — the owner if I'm a collaborator,
  // or my collaborators if I own it — so the Shared tab always shows "the other party".
  othersOn(n: Note): NoteCollaborator[] {
    const me = this.myId();
    return [n.userId, ...n.collaborators].filter((c) => c._id !== me);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  togglePin(n: Note): void {
    this.noteService.togglePin(n._id).subscribe();
  }

  openCompose(): void {
    this.draft.set('');
    this.draftTitle.set('');
    this.selectedFriendIds.set([]);
    this.composing.set(true);
    this.friendService.getFriends().subscribe(({ friends }) => this.composeFriends.set(friends));
  }

  toggleSelected(friendId: string): void {
    this.selectedFriendIds.update((ids) =>
      ids.includes(friendId) ? ids.filter((id) => id !== friendId) : [...ids, friendId]
    );
  }
  isSelected(friendId: string): boolean {
    return this.selectedFriendIds().includes(friendId);
  }

  save(): void {
    const text = this.draft().trim();
    if (!text) return;
    const title = this.draftTitle().trim();
    const collaboratorIds = this.selectedFriendIds();
    this.noteService
      .create({
        text,
        title: title || undefined,
        collaboratorIds: collaboratorIds.length ? collaboratorIds : undefined,
      })
      .subscribe(() => this.composing.set(false));
  }

  // ─── Drag reorder handlers ──────────────────────────────────────────────
  onPointerDown(ev: PointerEvent, n: Note, section: Section): void {
    if ((ev.target as HTMLElement).closest('.note-acts')) return;
    this.pressActive = true;
    this.pressMoved = false;
    this.pressStartX = ev.clientX;
    this.pressStartY = ev.clientY;
    this.pressStartTime = Date.now();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.longPressTimer = setTimeout(() => this.beginDrag(n, section), 450);
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.pressActive) return;
    const dx = ev.clientX - this.pressStartX;
    const dy = ev.clientY - this.pressStartY;
    if (!this.draggingId()) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this.pressMoved = true;
        clearTimeout(this.longPressTimer);
      }
      return;
    }
    // Once a drag is active, suppress the page's native vertical scroll so
    // dragging the card doesn't fight (or get cancelled by) scrolling.
    ev.preventDefault();
    this.dragDX.set(dx);
    this.dragDY.set(dy);
    this.updateDragTarget(ev.clientY);
  }

  onPointerUp(ev: PointerEvent, n: Note): void {
    if (!this.pressActive) return;
    clearTimeout(this.longPressTimer);
    if (this.draggingId()) {
      this.finishDrag();
    } else if (!this.pressMoved && Date.now() - this.pressStartTime < 450) {
      this.open(n);
    }
    this.pressActive = false;
  }

  onPointerCancel(): void {
    clearTimeout(this.longPressTimer);
    this.pressActive = false;
    this.draggingId.set(null);
    this.dragSection = null;
    this.dragWorkingIds.set(null);
    this.dragDX.set(0);
    this.dragDY.set(0);
  }

  private beginDrag(n: Note, section: Section): void {
    this.draggingId.set(n._id);
    this.dragSection = section;
    const list = section === 'pinned' ? this.pinnedNotes() : this.otherNotes();
    this.dragWorkingIds.set(list.map((x) => x._id));
    this.dragDX.set(0);
    this.dragDY.set(0);
  }

  private reorderedFrom(ids: string[]): Note[] {
    const byId = new Map(this.notes().map((n) => [n._id, n]));
    return ids.map((id) => byId.get(id)).filter((n): n is Note => !!n);
  }

  private updateDragTarget(pointerY: number): void {
    const ids = this.dragWorkingIds();
    const dragId = this.draggingId();
    if (!ids || !dragId) return;
    const cards = Array.from(
      document.querySelectorAll(`.note[data-section="${this.dragSection}"]`)
    ) as HTMLElement[];
    const currentIndex = ids.indexOf(dragId);
    let targetIndex = currentIndex;
    for (const card of cards) {
      const id = card.dataset['id'];
      if (!id || id === dragId) continue;
      const idx = ids.indexOf(id);
      if (idx === -1) continue;
      const rect = card.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (pointerY < mid && idx < targetIndex) targetIndex = idx;
      if (pointerY > mid && idx > targetIndex) targetIndex = idx;
    }
    if (targetIndex !== currentIndex) {
      const newIds = [...ids];
      newIds.splice(currentIndex, 1);
      newIds.splice(targetIndex, 0, dragId);
      this.dragWorkingIds.set(newIds);
    }
  }

  private finishDrag(): void {
    const ids = this.dragWorkingIds();
    const dragId = this.draggingId();
    if (ids && dragId) {
      const idx = ids.indexOf(dragId);
      const byId = new Map(this.notes().map((n) => [n._id, n]));
      const before = idx > 0 ? byId.get(ids[idx - 1]) : undefined;
      const after = idx < ids.length - 1 ? byId.get(ids[idx + 1]) : undefined;
      let newOrder: number;
      if (before && after) newOrder = (before.order + after.order) / 2;
      else if (before) newOrder = before.order - 1000;
      else if (after) newOrder = after.order + 1000;
      else newOrder = Date.now();
      this.noteService.reorder(dragId, newOrder).subscribe();
    }
    this.draggingId.set(null);
    this.dragSection = null;
    this.dragWorkingIds.set(null);
    this.dragDX.set(0);
    this.dragDY.set(0);
  }
}
