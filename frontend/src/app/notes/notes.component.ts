// src/app/notes/notes.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
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
  trashOutline,
  bookmarkOutline,
  bookmark,
  starOutline,
} from 'ionicons/icons';
import { NoteService, Note, NoteHue } from '../core/services/note.service';

type Hue = NoteHue;

const HUES: Record<Hue, { bar: string }> = {
  yellow: { bar: '#E0B92B' },
  pink: { bar: '#E0699B' },
  blue: { bar: '#3257EE' },
  green: { bar: '#1AA06D' },
  purple: { bar: '#7B61D8' },
};
const HUE_KEYS: Hue[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonTextarea, IonSpinner],
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
      </div>

      <div class="body">
        <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>
        <div class="empty" *ngIf="!loading() && notes().length === 0">No notes yet. Tap + to jot one down.</div>

        <!-- High priority -->
        <ng-container *ngIf="highNotes().length">
          <div class="section-label hi">
            <ion-icon name="star-outline"></ion-icon> High Priority
          </div>
          <div class="masonry">
            <div class="note hi-note" *ngFor="let n of highNotes()"
              [style.background]="bg(n)" [style.borderTopColor]="HUES[n.color].bar">
              <div class="hi-badge">HIGH</div>
              <div class="note-text">{{ n.text }}</div>
              <div class="note-foot">
                <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
                <div class="note-acts">
                  <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
                  <ion-icon name="trash-outline" (click)="remove(n)"></ion-icon>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Pinned -->
        <ng-container *ngIf="pinnedNotes().length">
          <div class="section-label"><ion-icon name="bookmark"></ion-icon> Pinned</div>
          <div class="masonry">
            <div class="note" *ngFor="let n of pinnedNotes()"
              [style.background]="bg(n)" [style.borderTopColor]="HUES[n.color].bar">
              <div class="note-text">{{ n.text }}</div>
              <div class="note-foot">
                <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
                <div class="note-acts">
                  <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
                  <ion-icon name="trash-outline" (click)="remove(n)"></ion-icon>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Others -->
        <div class="masonry">
          <div class="note" *ngFor="let n of otherNotes()"
            [style.background]="bg(n)" [style.borderTopColor]="HUES[n.color].bar">
            <div class="note-text">{{ n.text }}</div>
            <div class="note-foot">
              <span class="note-date">{{ fmtDate(n.createdAt) }}</span>
              <div class="note-acts">
                <ion-icon [name]="n.pinned ? 'bookmark' : 'bookmark-outline'" (click)="togglePin(n)"></ion-icon>
                <ion-icon name="trash-outline" (click)="remove(n)"></ion-icon>
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
            <ion-textarea class="ta" placeholder="Type a note…" [autoGrow]="true" [rows]="4"
              [value]="draft()" (ionInput)="draft.set($any($event.target).value)"></ion-textarea>

            <div class="row">
              <div class="swatches">
                <div *ngFor="let k of HUE_KEYS" class="swatch" [style.background]="HUES[k].bar"
                  [style.borderColor]="draftColor() === k ? HUES[k].bar : 'transparent'" (click)="draftColor.set(k)"></div>
              </div>
            </div>

            <div class="field-label">Priority</div>
            <div class="pri-row">
              <button class="pri" [class.on]="draftPri() === 'normal'" (click)="draftPri.set('normal')">Normal</button>
              <button class="pri hi" [class.on]="draftPri() === 'high'" (click)="draftPri.set('high')">
                <ion-icon name="star-outline"></ion-icon> High
              </button>
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
    .hdr { background: linear-gradient(160deg, #C99A1E, #a87f12); padding: calc(env(safe-area-inset-top) + 14px) 20px 18px; animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 12px; }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; flex: none; }
    .circle-btn:active { transform: scale(.9); }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .hdr-titles { flex: 1; }
    .hdr-title { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.3px; }
    .hdr-sub { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.78); margin-top: 2px; }

    .body { padding: 18px 20px calc(env(safe-area-inset-bottom) + 28px); }
    .empty { text-align: center; padding: 60px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .section-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .6px; text-transform: uppercase; margin-bottom: 11px; }
    .section-label.hi { color: #E0544B; }

    .masonry { column-count: 2; column-gap: 12px; margin-bottom: 18px; }
    .note { break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 12px; border-radius: 16px; padding: 14px; box-shadow: var(--rm-shadow-sm); border-top: 3px solid; animation: rmFadeUp .35s ease both; }
    .hi-note { position: relative; box-shadow: 0 2px 12px rgba(224,84,75,.18); }
    .hi-badge { position: absolute; top: 10px; right: 10px; background: #E0544B; color: #fff; font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 8px; letter-spacing: .4px; }
    .note-text { font-size: 14px; font-weight: 600; color: var(--rm-text-primary); line-height: 1.45; white-space: pre-wrap; }
    .hi-note .note-text { padding-right: 40px; }
    .note-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
    .note-date { font-size: 11px; font-weight: 700; color: var(--rm-text-muted); }
    .note-acts { display: flex; gap: 11px; align-items: center; font-size: 16px; color: var(--rm-text-muted); }
    .note-acts ion-icon { cursor: pointer; }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 6px; }
    .sheet-title { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); }
    .sheet-body { padding: 14px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 16px; }
    .ta { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 14px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .row { display: flex; align-items: center; justify-content: space-between; }
    .swatches { display: flex; gap: 11px; }
    .swatch { width: 26px; height: 26px; border-radius: 50%; border: 3px solid; cursor: pointer; }
    .field-label { font-size: 13px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: -6px; }
    .pri-row { display: flex; gap: 8px; }
    .pri { flex: 1; height: 40px; border-radius: 12px; border: 1.5px solid var(--rm-border); background: var(--rm-surface); color: var(--rm-text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .pri.on { border-color: var(--rm-purple); background: var(--rm-purple-light); color: var(--rm-purple); }
    .pri.hi.on { border-color: #E0544B; background: rgba(224,84,75,.12); color: #E0544B; }
    .save-btn { width: 100%; height: 52px; border-radius: 14px; border: none; background: #C99A1E; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
  `],
})
export class NotesComponent implements OnInit {
  private location = inject(Location);
  private noteService = inject(NoteService);
  readonly HUES = HUES;
  readonly HUE_KEYS = HUE_KEYS;

  readonly notes = signal<Note[]>([]);
  readonly loading = signal(true);

  readonly composing = signal(false);
  readonly draft = signal('');
  readonly draftColor = signal<Hue>('yellow');
  readonly draftPri = signal<'normal' | 'high'>('normal');

  readonly highNotes = computed(() => this.notes().filter((n) => n.priority === 'high' && !n.pinned));
  readonly pinnedNotes = computed(() => this.notes().filter((n) => n.pinned));
  readonly otherNotes = computed(() => this.notes().filter((n) => !n.pinned && n.priority !== 'high'));

  constructor() {
    addIcons({ chevronBackOutline, addOutline, closeOutline, trashOutline, bookmarkOutline, bookmark, starOutline });
  }

  ngOnInit(): void {
    this.noteService.getAll().subscribe({
      next: (data) => { this.notes.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  back(): void { this.location.back(); }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Translucent tint of the bar colour — legible on both light and dark surfaces.
  bg(n: Note): string {
    const hex = HUES[n.color].bar;
    const num = parseInt(hex.slice(1), 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},0.14)`;
  }

  togglePin(n: Note): void {
    this.noteService.togglePin(n._id).subscribe((updated) =>
      this.notes.update((list) => list.map((x) => (x._id === updated._id ? updated : x)))
    );
  }
  remove(n: Note): void {
    this.noteService.delete(n._id).subscribe(() =>
      this.notes.update((list) => list.filter((x) => x._id !== n._id))
    );
  }

  openCompose(): void {
    this.draft.set('');
    this.draftColor.set('yellow');
    this.draftPri.set('normal');
    this.composing.set(true);
  }
  save(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.noteService
      .create({ text, color: this.draftColor(), priority: this.draftPri() })
      .subscribe((created) => {
        this.notes.update((list) => [created, ...list]);
        this.composing.set(false);
      });
  }
}
