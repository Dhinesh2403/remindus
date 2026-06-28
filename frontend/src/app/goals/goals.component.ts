// src/app/goals/goals.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import {
  IonContent,
  IonIcon,
  IonModal,
  IonInput,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  addOutline,
  checkmarkOutline,
  chevronDownOutline,
  closeOutline,
  removeOutline,
} from 'ionicons/icons';
import { GoalService, Goal } from '../core/services/goal.service';

const PALETTE = [
  '#3257EE', '#1AA06D', '#E0732B', '#7B61D8',
  '#E0544B', '#159C92', '#E0699B', '#C99A1E',
];
const CATS = ['Personal', 'Health', 'Work', 'Finance', 'Learning', 'Shared'];

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonSpinner],
  template: `
    <ion-content [scrollY]="true" class="page">
      <div class="hdr">
        <div class="hdr-row">
          <button class="circle-btn" (click)="back()">
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>
          <div class="hdr-titles">
            <div class="hdr-title">Goals</div>
            <div class="hdr-sub">Plan the big picture</div>
          </div>
          <button class="circle-btn" (click)="openAdd()">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>
      </div>

      <div class="body">
        <!-- Tabs -->
        <div class="tabs">
          <div class="tab" [class.active]="filter() === 'active'" (click)="filter.set('active')">
            Active <span>{{ activeGoals().length }}</span>
          </div>
          <div class="tab" [class.active]="filter() === 'done'" (click)="filter.set('done')">
            Completed <span>{{ doneGoals().length }}</span>
          </div>
        </div>

        <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>

        <div class="empty" *ngIf="!loading() && shownGoals().length === 0">
          {{ filter() === 'active' ? 'No active goals — tap + to set one.' : 'No completed goals yet. Keep going!' }}
        </div>

        <div class="cards">
          <div class="card" *ngFor="let g of shownGoals()">
            <div class="card-head" (click)="toggleOpen(g._id)">
              <div class="ring" [style.background]="ringBg(g)">
                <div class="ring-inner">{{ pct(g) }}</div>
              </div>
              <div class="card-meta">
                <div class="card-title">{{ g.title }}</div>
                <div class="card-tags">
                  <span class="cat" [style.color]="g.color" [style.background]="soft(g.color)">{{ g.cat }}</span>
                  <span class="ms">{{ doneCount(g) }} of {{ g.milestones.length }} milestones</span>
                </div>
              </div>
              <ion-icon
                name="chevron-down-outline"
                class="chev"
                [style.transform]="openId() === g._id ? 'rotate(180deg)' : 'none'"
              ></ion-icon>
            </div>

            <div class="bar"><div class="bar-fill" [style.width]="pct(g)" [style.background]="g.color"></div></div>
            <div class="target">Target · {{ g.target }}</div>

            <div class="milestones" *ngIf="openId() === g._id">
              <div class="mrow" *ngFor="let m of g.milestones; let i = index" (click)="toggleMs(g, i)">
                <div
                  class="mbox"
                  [style.background]="m.done ? g.color : 'transparent'"
                  [style.borderColor]="m.done ? g.color : 'var(--rm-border)'"
                >
                  <ion-icon *ngIf="m.done" name="checkmark-outline" style="color:#fff;font-size:13px"></ion-icon>
                </div>
                <span class="mtext" [class.done]="m.done">{{ m.t }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>

    <!-- Add Goal sheet -->
    <ion-modal [isOpen]="adding()" (didDismiss)="adding.set(false)" [initialBreakpoint]="1" [breakpoints]="[0, 1]">
      <ng-template>
        <div class="sheet">
          <div class="sheet-hdr">
            <div>
              <div class="sheet-title">New Goal</div>
              <div class="sheet-sub">Plan it, break it into steps</div>
            </div>
            <button class="circle-btn dark" (click)="adding.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <ion-content class="sheet-scroll">
            <div class="sheet-body">
              <ion-input class="field" [class.invalid]="!dTitle()" placeholder="Goal title *"
                [value]="dTitle()" (ionInput)="dTitle.set($any($event.target).value)"></ion-input>

              <div>
                <div class="field-label">Category</div>
                <div class="chips">
                  <button *ngFor="let c of CATS" class="chip" [class.on]="dCat() === c" (click)="dCat.set(c)">{{ c }}</button>
                </div>
              </div>

              <div>
                <div class="field-label">Color</div>
                <div class="swatches">
                  <div *ngFor="let c of PALETTE" class="swatch" [style.background]="c"
                    [style.borderColor]="dColor() === c ? c : 'transparent'" (click)="dColor.set(c)">
                    <ion-icon *ngIf="dColor() === c" name="checkmark-outline" style="color:#fff"></ion-icon>
                  </div>
                </div>
              </div>

              <ion-input class="field" placeholder="Target date — e.g. Dec 2026"
                [value]="dTarget()" (ionInput)="dTarget.set($any($event.target).value)"></ion-input>

              <div>
                <div class="field-label">Milestones</div>
                <div class="ms-list">
                  <div class="ms-input-row" *ngFor="let m of dMs(); let i = index">
                    <div class="ms-idx">{{ i + 1 }}</div>
                    <ion-input class="field flex" placeholder="Milestone step"
                      [value]="m" (ionInput)="updateMs(i, $any($event.target).value)"></ion-input>
                    <button class="ms-remove" *ngIf="dMs().length > 1" (click)="removeMs(i)">
                      <ion-icon name="remove-outline"></ion-icon>
                    </button>
                  </div>
                </div>
                <button class="add-ms" (click)="addMs()">
                  <ion-icon name="add-outline"></ion-icon> Add milestone
                </button>
              </div>

              <button class="save-btn" (click)="save()">
                <ion-icon name="checkmark-outline"></ion-icon> Create Goal
              </button>
            </div>
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    @keyframes rmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes rmExpand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

    .page { --background: var(--rm-bg); }
    .hdr { background: linear-gradient(160deg, #7B61D8, #5f47c0); padding: calc(env(safe-area-inset-top) + 14px) 20px 18px; animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 12px; }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; flex: none; }
    .circle-btn:active { transform: scale(.9); }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .hdr-titles { flex: 1; }
    .hdr-title { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.3px; }
    .hdr-sub { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.78); margin-top: 2px; }

    .body { padding: 18px 20px calc(env(safe-area-inset-bottom) + 28px); }
    .tabs { display: flex; gap: 6px; background: var(--rm-surface); border-radius: 14px; padding: 5px; margin-bottom: 16px; }
    .tab { flex: 1; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: var(--rm-text-secondary); cursor: pointer; transition: all .2s; }
    .tab.active { background: var(--rm-purple); color: #fff; }
    .tab span { opacity: .65; }

    .empty { text-align: center; padding: 70px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .cards { display: flex; flex-direction: column; gap: 13px; }
    .card { background: var(--rm-card); border: 1px solid var(--rm-border); border-radius: 20px; padding: 16px 17px; box-shadow: var(--rm-shadow-sm); animation: rmFadeUp .4s ease both; }
    .card-head { display: flex; align-items: center; gap: 13px; cursor: pointer; }
    .ring { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; }
    .ring-inner { width: 40px; height: 40px; border-radius: 50%; background: var(--rm-card); display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 800; color: var(--rm-text-primary); }
    .card-meta { flex: 1; min-width: 0; }
    .card-title { font-size: 15.5px; font-weight: 800; color: var(--rm-text-primary); line-height: 1.25; }
    .card-tags { display: flex; align-items: center; gap: 8px; margin-top: 7px; flex-wrap: wrap; }
    .cat { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 8px; }
    .ms { font-size: 12px; font-weight: 600; color: var(--rm-text-secondary); }
    .chev { color: var(--rm-text-muted); transition: transform .2s; flex: none; }
    .bar { height: 7px; border-radius: 4px; background: var(--rm-surface); margin-top: 14px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
    .target { font-size: 12px; font-weight: 600; color: var(--rm-text-muted); margin-top: 9px; }
    .milestones { margin-top: 14px; border-top: 1px solid var(--rm-border); padding-top: 13px; display: flex; flex-direction: column; gap: 12px; animation: rmExpand .25s ease both; }
    .mrow { display: flex; align-items: center; gap: 11px; cursor: pointer; }
    .mbox { width: 22px; height: 22px; border-radius: 7px; border: 2px solid; display: flex; align-items: center; justify-content: center; flex: none; }
    .mtext { font-size: 14px; font-weight: 600; color: var(--rm-text-primary); }
    .mtext.done { color: var(--rm-text-muted); text-decoration: line-through; }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { background: linear-gradient(160deg, #7B61D8, #5f47c0); padding: 22px; display: flex; align-items: flex-start; justify-content: space-between; flex: none; }
    .sheet-title { font-size: 22px; font-weight: 800; color: #fff; }
    .sheet-sub { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.78); margin-top: 2px; }
    .sheet-scroll { --background: var(--rm-card); flex: 1; }
    .sheet-body { padding: 20px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 18px; }
    .field { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .field.invalid { border-color: #7B61D8; }
    .field.flex { flex: 1; }
    .field-label { font-size: 13px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 10px; }
    .chips { display: flex; gap: 8px; overflow-x: auto; }
    .chip { flex: none; height: 38px; padding: 0 15px; border-radius: 12px; border: 1.5px solid var(--rm-border); background: var(--rm-surface); color: var(--rm-text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; }
    .chip.on { border-color: #7B61D8; background: rgba(123,97,216,.12); color: #7B61D8; }
    .swatches { display: flex; gap: 11px; flex-wrap: wrap; }
    .swatch { width: 38px; height: 38px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
    .ms-list { display: flex; flex-direction: column; gap: 9px; }
    .ms-input-row { display: flex; align-items: center; gap: 9px; }
    .ms-idx { width: 24px; height: 24px; border-radius: 7px; background: var(--rm-surface); border: 1px solid var(--rm-border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: var(--rm-text-secondary); flex: none; }
    .ms-remove { width: 40px; height: 40px; border-radius: 11px; border: 1px solid var(--rm-border); background: var(--rm-card); color: var(--rm-danger); display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
    .add-ms { margin-top: 11px; height: 44px; width: 100%; border-radius: 12px; border: 1.5px dashed var(--rm-border); background: transparent; color: #7B61D8; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .save-btn { width: 100%; height: 56px; border-radius: 16px; border: none; background: #7B61D8; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  `],
})
export class GoalsComponent implements OnInit {
  private location = inject(Location);
  private goalService = inject(GoalService);
  readonly PALETTE = PALETTE;
  readonly CATS = CATS;

  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);

  readonly filter = signal<'active' | 'done'>('active');
  readonly openId = signal<string | null>(null);

  readonly adding = signal(false);
  readonly dTitle = signal('');
  readonly dCat = signal('Personal');
  readonly dColor = signal('#7B61D8');
  readonly dTarget = signal('');
  readonly dMs = signal<string[]>(['']);

  readonly activeGoals = computed(() => this.goals().filter((g) => !this.allDone(g)));
  readonly doneGoals = computed(() => this.goals().filter((g) => this.allDone(g)));
  readonly shownGoals = computed(() => (this.filter() === 'active' ? this.activeGoals() : this.doneGoals()));

  constructor() {
    addIcons({ chevronBackOutline, addOutline, checkmarkOutline, chevronDownOutline, closeOutline, removeOutline });
  }

  ngOnInit(): void {
    this.goalService.getAll().subscribe({
      next: (data) => { this.goals.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  back(): void { this.location.back(); }

  allDone(g: Goal): boolean { return g.milestones.length > 0 && g.milestones.every((m) => m.done); }
  doneCount(g: Goal): number { return g.milestones.filter((m) => m.done).length; }
  pct(g: Goal): string {
    const t = g.milestones.length;
    return (t ? Math.round((this.doneCount(g) / t) * 100) : 0) + '%';
  }
  ringBg(g: Goal): string { return `conic-gradient(${g.color} ${this.pct(g)}, var(--rm-surface) 0)`; }
  soft(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.12)`;
  }

  toggleOpen(id: string): void { this.openId.update((o) => (o === id ? null : id)); }
  toggleMs(g: Goal, i: number): void {
    this.goalService.toggleMilestone(g._id, i).subscribe((updated) =>
      this.goals.update((list) => list.map((x) => (x._id === updated._id ? updated : x)))
    );
  }

  openAdd(): void {
    this.dTitle.set('');
    this.dCat.set('Personal');
    this.dColor.set('#7B61D8');
    this.dTarget.set('');
    this.dMs.set(['']);
    this.adding.set(true);
  }
  updateMs(i: number, val: string): void { this.dMs.update((a) => a.map((m, j) => (j === i ? val : m))); }
  addMs(): void { this.dMs.update((a) => [...a, '']); }
  removeMs(i: number): void { this.dMs.update((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a)); }

  save(): void {
    const title = this.dTitle().trim();
    if (!title) return;
    const ms = this.dMs().map((t) => t.trim()).filter(Boolean).map((t) => ({ t, done: false }));
    this.goalService
      .create({
        title,
        cat: this.dCat(),
        color: this.dColor(),
        target: this.dTarget().trim() || 'No target date',
        milestones: ms,
      })
      .subscribe((created) => {
        this.goals.update((list) => [...list, created]);
        this.filter.set('active');
        this.adding.set(false);
      });
  }
}
