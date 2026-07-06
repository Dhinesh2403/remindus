// src/app/notes/notes.component.ts
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  addOutline,
  bookmarkOutline,
  bookmark,
  searchOutline,
  closeOutline,
  gridOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { NoteService, Note, NoteCollaborator } from '../core/services/note.service';
import { AuthService } from '../core/services/auth.service';
import { FriendAvatarComponent } from '../core/components/friend-avatar.component';

type Section = 'pinned' | 'other';
type Tab = 'mine' | 'shared';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, FriendAvatarComponent],
  template: `
    <ion-content [scrollY]="true" class="page">
      <div class="hdr">
        <div class="hdr-row">
          <button class="icon-btn" (click)="back()">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="title-block">
            <h1 class="page-title">Notes</h1>
            <p class="page-sub">Jot it down, keep it close</p>
          </div>
          <button class="icon-btn" [class.active]="searchOpen()" (click)="toggleSearch()" aria-label="Search notes">
            <ion-icon name="search-outline"></ion-icon>
          </button>
          <button class="icon-btn" (click)="newNote()" aria-label="New note">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>

        <!-- Search collapses to just the icon above; expands to a full bar on tap -->
        <div class="search-wrap" [class.open]="searchOpen()">
          <div class="search-row">
            <ion-icon name="search-outline"></ion-icon>
            <input #searchInput class="search-input" placeholder="Search notes"
              [value]="searchTerm()" (input)="searchTerm.set($any($event.target).value)"
              (keydown.escape)="closeSearch()" (blur)="onSearchBlur()" />
            <button class="clear-btn" (mousedown)="$event.preventDefault()" (click)="closeSearch()" aria-label="Close search">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
        </div>

        <div class="tabs-row">
          <button class="tab-btn" [class.active]="activeTab() === 'mine'" (click)="activeTab.set('mine')">My Notes</button>
          <button class="tab-btn" [class.active]="activeTab() === 'shared'" (click)="activeTab.set('shared')">Shared</button>
        </div>
      </div>

      <div class="body">
        <div class="empty" *ngIf="loaded() && tabNotes().length === 0">
          {{ activeTab() === 'shared' ? 'No shared notes yet.' : 'No notes yet. Tap + to jot one down.' }}
        </div>
        <div class="empty" *ngIf="loaded() && tabNotes().length > 0 && filteredNotes().length === 0">No notes match "{{ searchTerm() }}".</div>

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

      <button class="fab" (click)="newNote()">
        <ion-icon name="add-outline"></ion-icon>
      </button>
    </ion-content>
  `,
  styles: [`
    @keyframes rmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

    .page { --background: var(--rm-bg); position: relative; }
    .hdr { background: linear-gradient(160deg, #4259E8 0%, #5B73F6 100%); padding: calc(env(safe-area-inset-top) + 16px) 16px 16px; border-radius: 0 0 22px 22px; box-shadow: 0 6px 20px rgba(61,90,241,.28); animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 8px; }
    .title-block { flex: 1; min-width: 0; margin-left: 4px; }
    .page-title { margin: 0; color: #fff; font-size: 24px; font-weight: 800; line-height: 1.15; }
    .page-sub { margin: 2px 0 0; color: rgba(255,255,255,.82); font-size: 13px; font-weight: 500; }
    .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(255,255,255,.16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 21px; cursor: pointer; flex: none; transition: background .2s ease, transform .15s ease; }
    .icon-btn:active { transform: scale(.9); }
    .icon-btn.active { background: #fff; color: var(--rm-purple); }

    /* Collapsible search: max-height 0 → open, so the icon-only state has no bar */
    .search-wrap { max-height: 0; margin-top: 0; opacity: 0; overflow: hidden; transition: max-height .28s ease, margin-top .28s ease, opacity .2s ease; }
    .search-wrap.open { max-height: 52px; margin-top: 14px; opacity: 1; }
    .search-row { display: flex; align-items: center; gap: 9px; background: rgba(255,255,255,.18); border-radius: 24px; padding: 10px 14px; color: #fff; }
    .search-row > ion-icon { font-size: 17px; color: rgba(255,255,255,.85); flex: none; }
    .search-input { flex: 1; min-width: 0; border: none; background: none; outline: none; color: #fff; font-size: 14px; font-weight: 500; font-family: inherit; }
    .search-input::placeholder { color: rgba(255,255,255,.7); }
    .clear-btn { border: none; background: none; padding: 0; color: rgba(255,255,255,.85); font-size: 18px; display: flex; align-items: center; cursor: pointer; flex: none; }

    .tabs-row { display: flex; gap: 8px; margin-top: 14px; background: rgba(255,255,255,.14); border-radius: 12px; padding: 4px; }
    .tab-btn { flex: 1; border: none; background: none; color: rgba(255,255,255,.85); font-size: 13px; font-weight: 700; padding: 8px 0; border-radius: 9px; cursor: pointer; transition: background .2s ease, color .2s ease; }
    .tab-btn.active { background: #fff; color: var(--rm-purple); }

    .body { padding: 18px 16px calc(env(safe-area-inset-bottom) + 100px); }
    .empty { text-align: center; padding: 60px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }
    .section-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .6px; text-transform: uppercase; margin-bottom: 11px; }

    .masonry { column-count: 2; column-gap: 12px; margin-bottom: 18px; }
    .note { position: relative; break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 12px; border-radius: 16px; padding: 14px; background: var(--rm-card); border: 1px solid var(--rm-border); animation: rmFadeUp .35s ease both; touch-action: pan-y; user-select: none; }
    .note.dragging { z-index: 10; opacity: .92; box-shadow: 0 8px 24px rgba(0,0,0,.35); transition: none; }
    .note-title { font-size: 15.5px; font-weight: 800; color: var(--rm-text-primary); line-height: 1.3; margin-bottom: 5px; word-break: break-word; }
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
  `],
})
export class NotesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private noteService = inject(NoteService);
  private authService = inject(AuthService);

  readonly notes = this.noteService.notes;
  // Notes load silently in the background (no spinner). `loaded` only gates the
  // empty-state so it never flashes before the first fetch resolves; cached
  // notes from a previous visit render instantly regardless.
  readonly loaded = signal(false);

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

  readonly searchOpen = signal(false);
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({ arrowBackOutline, addOutline, bookmarkOutline, bookmark, searchOutline, closeOutline, gridOutline, swapVerticalOutline });
  }

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'shared' || tab === 'mine') this.activeTab.set(tab);

    this.noteService.getAll().subscribe({
      next: () => this.loaded.set(true),
      error: () => this.loaded.set(true),
    });
  }

  back(): void { this.blurActive(); this.router.navigate(['/app/dashboard']); }
  openProfile(): void { this.blurActive(); this.router.navigate(['/app/settings/profile']); }

  toggleSearch(): void {
    this.searchOpen() ? this.closeSearch() : this.openSearch();
  }

  openSearch(): void {
    this.searchOpen.set(true);
    // Focus once the field has expanded into view.
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 60);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchTerm.set('');
  }

  // Collapse back to just the icon when the field is left empty.
  onSearchBlur(): void {
    if (!this.searchTerm().trim()) this.searchOpen.set(false);
  }
  trackNote(_: number, n: Note): string { return n._id; }

  newNote(): void {
    this.blurActive();
    this.router.navigate(['/app/notes', 'new'], { queryParams: { tab: this.activeTab() } });
  }

  open(n: Note): void {
    this.blurActive();
    this.router.navigate(['/app/notes', n._id], { queryParams: { tab: this.activeTab() } });
  }

  // Ionic marks the leaving page aria-hidden="true" during the route transition;
  // if the tapped button still holds focus the browser warns that focus is
  // trapped inside an aria-hidden subtree. Drop focus before we navigate away.
  private blurActive(): void {
    (document.activeElement as HTMLElement | null)?.blur();
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

  // The card shows a bold, title-like heading + body text. Prefer the note's
  // own title; when it has none, treat the first line of the body as the
  // heading so every card reads with a title-like first line.
  noteHeading(n: Note): string {
    const title = (n.title ?? '').trim();
    if (title) return title;
    const text = (n.text ?? '').replace(/^\s+/, '');
    const nl = text.indexOf('\n');
    return nl === -1 ? text : text.slice(0, nl);
  }

  noteBody(n: Note): string {
    if ((n.title ?? '').trim()) return n.text ?? '';
    const text = (n.text ?? '').replace(/^\s+/, '');
    const nl = text.indexOf('\n');
    return nl === -1 ? '' : text.slice(nl + 1);
  }

  togglePin(n: Note): void {
    this.noteService.togglePin(n._id).subscribe();
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
