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
  chevronBackOutline,
  addOutline,
  closeOutline,
  bookmarkOutline,
  bookmark,
  searchOutline,
  checkmark,
} from 'ionicons/icons';
import { NoteService, Note, NoteCollaborator, NoteHue } from '../core/services/note.service';
import { AuthService } from '../core/services/auth.service';
import { FriendService, Friend } from '../core/services/friend.service';
import { FriendAvatarComponent } from '../core/components/friend-avatar.component';
import { HUES, HUE_KEYS } from '../core/constants/note-colors';

type Hue = NoteHue;
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
          <button class="circle-btn" (click)="back()">
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>
          <div class="hdr-titles">
            <div class="hdr-title">Notes</div>
            <div class="hdr-sub">Jot it down, keep it close</div>
          </div>
          <button class="circle-btn" (click)="openCompose()">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>
        <div class="search-row">
          <ion-icon name="search-outline"></ion-icon>
          <input class="search-input" placeholder="Search notes"
            [value]="searchTerm()" (input)="searchTerm.set($any($event.target).value)" />
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
              [style.background]="bg(n)" [style.borderTopColor]="n.color === 'none' ? 'transparent' : HUES[n.color].bar"
              (pointerdown)="onPointerDown($event, n, 'pinned')" (pointermove)="onPointerMove($event)"
              (pointerup)="onPointerUp($event, n)" (pointercancel)="onPointerCancel()">
              <div class="unread-dot" *ngIf="n.hasUnreadEdit"></div>
              <div class="collab-stack" *ngIf="othersOn(n).length">
                <app-friend-avatar *ngFor="let c of othersOn(n).slice(0,3)" class="collab-av"
                  [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="20"></app-friend-avatar>
                <span class="collab-more" *ngIf="othersOn(n).length > 3">+{{ othersOn(n).length - 3 }}</span>
              </div>
              <div class="note-title" *ngIf="n.title">{{ n.title }}</div>
              <div class="note-text">{{ n.text }}</div>
              <div class="note-foot">
                <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
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
            [style.background]="bg(n)" [style.borderTopColor]="n.color === 'none' ? 'transparent' : HUES[n.color].bar"
            (pointerdown)="onPointerDown($event, n, 'other')" (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp($event, n)" (pointercancel)="onPointerCancel()">
            <div class="unread-dot" *ngIf="n.hasUnreadEdit"></div>
            <div class="collab-stack" *ngIf="othersOn(n).length">
              <app-friend-avatar *ngFor="let c of othersOn(n).slice(0,3)" class="collab-av"
                [name]="c.name" [avatar]="c.avatar" [gender]="c.gender" [size]="20"></app-friend-avatar>
              <span class="collab-more" *ngIf="othersOn(n).length > 3">+{{ othersOn(n).length - 3 }}</span>
            </div>
            <div class="note-title" *ngIf="n.title">{{ n.title }}</div>
            <div class="note-text">{{ n.text }}</div>
            <div class="note-foot">
              <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
              <div class="note-acts">
                <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
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

            <div class="row">
              <div class="swatches">
                <div *ngFor="let k of HUE_KEYS" class="swatch-wrap" [class.selected]="draftColor() === k" (click)="draftColor.set(k)">
                  <div class="swatch" [style.background]="HUES[k].bar"></div>
                  <ion-icon *ngIf="draftColor() === k" name="checkmark" class="swatch-check"></ion-icon>
                </div>
              </div>
            </div>

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

    .page { --background: var(--rm-bg); }
    .hdr { background: linear-gradient(160deg, var(--rm-purple), #2E3FC0); padding: calc(env(safe-area-inset-top) + 14px) 20px 14px; animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 12px; }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; flex: none; }
    .circle-btn:active { transform: scale(.9); }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .hdr-titles { flex: 1; }
    .hdr-title { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.3px; }
    .hdr-sub { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.78); margin-top: 2px; }

    .search-row { display: flex; align-items: center; gap: 9px; background: rgba(255,255,255,.16); border-radius: 12px; padding: 9px 13px; margin-top: 14px; color: #fff; }
    .search-row ion-icon { font-size: 17px; color: rgba(255,255,255,.85); flex: none; }
    .search-input { flex: 1; border: none; background: none; outline: none; color: #fff; font-size: 14px; font-weight: 600; font-family: inherit; }
    .search-input::placeholder { color: rgba(255,255,255,.65); }

    .tabs-row { display: flex; gap: 8px; margin-top: 12px; background: rgba(255,255,255,.12); border-radius: 12px; padding: 4px; }
    .tab-btn { flex: 1; border: none; background: none; color: rgba(255,255,255,.75); font-size: 13px; font-weight: 700; padding: 8px 0; border-radius: 9px; cursor: pointer; }
    .tab-btn.active { background: #fff; color: var(--rm-purple); }

    .body { padding: 18px 20px calc(env(safe-area-inset-bottom) + 28px); }
    .empty { text-align: center; padding: 60px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .section-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .6px; text-transform: uppercase; margin-bottom: 11px; }

    .masonry { column-count: 2; column-gap: 12px; margin-bottom: 18px; }
    .note { position: relative; break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 12px; border-radius: 16px; padding: 14px; box-shadow: var(--rm-shadow-sm); border-top: 3px solid; animation: rmFadeUp .35s ease both; touch-action: pan-y; user-select: none; }
    .note.dragging { z-index: 10; opacity: .92; box-shadow: 0 8px 24px rgba(0,0,0,.22); transition: none; }
    .note-title { font-size: 14.5px; font-weight: 800; color: var(--rm-text-primary); margin-bottom: 4px; }
    .note-text { font-size: 14px; font-weight: 600; color: var(--rm-text-primary); line-height: 1.45; white-space: pre-wrap; }
    .note-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
    .note-date { font-size: 11px; font-weight: 700; color: var(--rm-text-muted); }
    .note-acts { display: flex; gap: 11px; align-items: center; font-size: 16px; color: var(--rm-text-muted); }
    .note-acts ion-icon { cursor: pointer; }

    .unread-dot { position: absolute; top: 10px; left: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--rm-danger); box-shadow: 0 0 0 2px var(--rm-card); }
    .collab-stack { position: absolute; top: 10px; right: 10px; display: flex; align-items: center; }
    .collab-av { margin-left: -8px; border: 2px solid var(--rm-card); border-radius: 50%; }
    .collab-av:first-child { margin-left: 0; }
    .collab-more { margin-left: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--rm-text-muted); color: #fff; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid var(--rm-card); }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 6px; }
    .sheet-title { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); }
    .sheet-body { padding: 14px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
    .title-input { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 12px; --padding-bottom: 12px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 700; font-size: 15px; }
    .ta { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 14px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .row { display: flex; align-items: center; justify-content: space-between; }
    .swatches { display: flex; gap: 11px; }
    .swatch-wrap { position: relative; width: 26px; height: 26px; cursor: pointer; }
    .swatch { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--rm-border); }
    .swatch-wrap.selected { box-shadow: 0 0 0 2px var(--rm-card), 0 0 0 4px var(--rm-purple); border-radius: 50%; }
    .swatch-check { position: absolute; inset: 0; margin: auto; font-size: 14px; color: #fff; filter: drop-shadow(0 0 1.5px rgba(0,0,0,.6)); }
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
  readonly HUES = HUES;
  readonly HUE_KEYS = HUE_KEYS;

  readonly notes = this.noteService.notes;
  readonly loading = signal(true);

  readonly composing = signal(false);
  readonly draft = signal('');
  readonly draftTitle = signal('');
  readonly draftColor = signal<Hue>('none');
  readonly composeFriends = signal<Friend[]>([]);
  readonly selectedFriendIds = signal<string[]>([]);

  readonly activeTab = signal<Tab>('mine');
  readonly myId = computed(() => this.authService.currentUser()?._id ?? '');

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
    addIcons({ chevronBackOutline, addOutline, closeOutline, bookmarkOutline, bookmark, searchOutline, checkmark });
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

  // Translucent tint of the bar colour — legible on both light and dark surfaces.
  bg(n: Note): string {
    if (n.color === 'none') return 'var(--rm-surface)';
    const style = getComputedStyle(document.documentElement);
    const hex = this.resolveColor(HUES[n.color].bar, style);
    const num = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},0.14)`;
  }

  private resolveColor(value: string, style: CSSStyleDeclaration): string {
    const match = /var\((--[\w-]+)\)/.exec(value);
    if (!match) return value;
    return style.getPropertyValue(match[1]).trim() || '#3D5AF1';
  }

  togglePin(n: Note): void {
    this.noteService.togglePin(n._id).subscribe();
  }

  openCompose(): void {
    this.draft.set('');
    this.draftTitle.set('');
    this.draftColor.set('none');
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
        color: this.draftColor(),
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
