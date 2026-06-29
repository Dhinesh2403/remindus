// src/app/habits/habits.component.ts
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
  flameOutline,
  closeOutline,
} from 'ionicons/icons';
import { HabitService, Habit } from '../core/services/habit.service';

const PALETTE = [
  '#3257EE', '#1AA06D', '#E0732B', '#7B61D8',
  '#E0544B', '#159C92', '#E0699B', '#C99A1E',
];

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonSpinner],
  template: `
    <ion-content [scrollY]="true" class="page">
      <!-- Gradient header -->
      <div class="hdr">
        <div class="hdr-row">
          <button class="circle-btn" (click)="back()">
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>
          <div class="hdr-titles">
            <div class="hdr-title">Habits</div>
            <div class="hdr-sub">Build streaks, one day at a time</div>
          </div>
          <button class="circle-btn" (click)="openAdd()">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>
      </div>

      <div class="body">
        <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>

        <ng-container *ngIf="!loading()">
        <!-- Summary -->
        <div class="summary">
          <div class="ring" [style.background]="ringBg()">
            <div class="ring-inner">
              <span class="ring-n">{{ doneToday() }}/{{ habits().length }}</span>
              <span class="ring-l">today</span>
            </div>
          </div>
          <div class="summary-stats">
            <div class="ss">
              <div class="ss-n">{{ habits().length }}</div>
              <div class="ss-l">Active habits</div>
            </div>
            <div class="ss-div"></div>
            <div class="ss">
              <div class="ss-n" style="color:#E0732B">{{ bestStreak() }}</div>
              <div class="ss-l">Best streak</div>
            </div>
          </div>
        </div>

        <!-- Habit cards -->
        <div class="cards">
          <div class="card" *ngFor="let h of habits()">
            <div class="card-top">
              <div class="card-name">{{ h.name }}</div>
              <div class="card-streak">
                <ion-icon name="flame-outline" [style.color]="h.streak > 0 ? '#E0732B' : 'var(--rm-text-muted)'"></ion-icon>
                <span [style.color]="h.streak > 0 ? '#E0732B' : 'var(--rm-text-muted)'">
                  {{ h.streak > 0 ? h.streak + ' day streak' : 'Start today' }}
                </span>
              </div>
              <button
                class="check"
                [style.background]="h.week[6] ? h.color : 'transparent'"
                [style.borderColor]="h.week[6] ? h.color : 'var(--rm-border)'"
                (click)="toggleToday(h)"
              >
                <ion-icon *ngIf="h.week[6]" name="checkmark-outline" style="color:#fff"></ion-icon>
              </button>
            </div>
            <div class="goal">{{ h.goal }}</div>
            <div class="week">
              <div class="day" *ngFor="let d of h.week; let i = index">
                <div
                  class="dot"
                  [style.background]="d ? h.color : 'var(--rm-surface)'"
                  [style.borderColor]="i === 6 && !d ? h.color : 'transparent'"
                >
                  <ion-icon *ngIf="d" name="checkmark-outline" style="color:#fff;font-size:12px"></ion-icon>
                </div>
                <span class="day-l">{{ DOW[i] }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty" *ngIf="habits().length === 0">No habits yet. Tap + to start a streak.</div>
        </ng-container>
      </div>
    </ion-content>

    <!-- Add Habit sheet -->
    <ion-modal
      [isOpen]="adding()"
      (didDismiss)="adding.set(false)"
      [initialBreakpoint]="1"
      [breakpoints]="[0, 1]"
    >
      <ng-template>
        <div class="sheet">
          <div class="sheet-hdr">
            <div>
              <div class="sheet-title">New Habit</div>
              <div class="sheet-sub">Start a fresh streak</div>
            </div>
            <button class="circle-btn dark" (click)="adding.set(false)">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="sheet-body">
            <ion-input
              class="field"
              [class.invalid]="!draftName()"
              placeholder="Habit name *"
              [value]="draftName()"
              (ionInput)="draftName.set($any($event.target).value)"
            ></ion-input>
            <ion-input
              class="field"
              placeholder="Goal — e.g. 8 glasses a day"
              [value]="draftGoal()"
              (ionInput)="draftGoal.set($any($event.target).value)"
            ></ion-input>

            <div class="field-label">Color</div>
            <div class="swatches">
              <div
                *ngFor="let c of PALETTE"
                class="swatch"
                [style.background]="c"
                [style.borderColor]="draftColor() === c ? c : 'transparent'"
                (click)="draftColor.set(c)"
              >
                <ion-icon *ngIf="draftColor() === c" name="checkmark-outline" style="color:#fff"></ion-icon>
              </div>
            </div>

            <button class="save-btn" (click)="save()">
              <ion-icon name="checkmark-outline"></ion-icon> Create Habit
            </button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    @keyframes rmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes rmPop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
    .page { --background: var(--rm-bg); }
    .hdr { background: linear-gradient(160deg, #E0732B, #c45f1d); padding: calc(env(safe-area-inset-top) + 14px) 20px 18px; animation: rmFadeUp .35s ease both; }
    .summary { animation: rmFadeUp .4s ease .05s both; }
    .card { animation: rmFadeUp .4s ease both; }
    .card:nth-child(2) { animation-delay: .06s; }
    .card:nth-child(3) { animation-delay: .12s; }
    .card:nth-child(4) { animation-delay: .18s; }
    .card:nth-child(5) { animation-delay: .24s; }
    .check:active { transform: scale(.88); }
    .swatch:active, .circle-btn:active { transform: scale(.9); }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
    .hdr2 { background: linear-gradient(160deg, #E0732B, #c45f1d); padding: calc(env(safe-area-inset-top) + 14px) 20px 18px; }
    .hdr-row { display: flex; align-items: center; gap: 12px; }
    .circle-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; flex: none; }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .hdr-titles { flex: 1; }
    .hdr-title { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.3px; }
    .hdr-sub { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.78); margin-top: 2px; }

    .body { padding: 18px 20px calc(env(safe-area-inset-bottom) + 28px); }

    .summary { display: flex; gap: 14px; align-items: center; background: var(--rm-card); border: 1px solid var(--rm-border); border-radius: 22px; padding: 18px; box-shadow: var(--rm-shadow-sm); }
    .ring { width: 78px; height: 78px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; }
    .ring-inner { width: 60px; height: 60px; border-radius: 50%; background: var(--rm-card); display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .ring-n { font-size: 18px; font-weight: 800; color: var(--rm-text-primary); line-height: 1; }
    .ring-l { font-size: 9px; font-weight: 800; color: var(--rm-text-muted); text-transform: uppercase; letter-spacing: .4px; margin-top: 2px; }
    .summary-stats { flex: 1; display: flex; gap: 12px; }
    .ss { flex: 1; }
    .ss-n { font-size: 25px; font-weight: 800; color: var(--rm-text-primary); line-height: 1; }
    .ss-l { font-size: 12px; font-weight: 600; color: var(--rm-text-secondary); margin-top: 3px; }
    .ss-div { width: 1px; background: var(--rm-border); }

    .cards { display: flex; flex-direction: column; gap: 13px; margin-top: 16px; }
    .card { background: var(--rm-card); border: 1px solid var(--rm-border); border-radius: 20px; padding: 15px 16px; box-shadow: var(--rm-shadow-sm); }
    .card-top { display: flex; align-items: center; gap: 13px; }
    .card-name { flex: 1; font-size: 15.5px; font-weight: 800; color: var(--rm-text-primary); }
    .card-streak { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; }
    .check { width: 42px; height: 42px; border-radius: 50%; border: 2px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; background: transparent; font-size: 20px; transition: all .2s; }
    .goal { font-size: 12.5px; color: var(--rm-text-secondary); margin-top: 6px; }
    .week { display: flex; justify-content: space-between; gap: 6px; margin-top: 14px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
    .dot { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid; display: flex; align-items: center; justify-content: center; }
    .day-l { font-size: 10px; font-weight: 700; color: var(--rm-text-muted); }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty { text-align: center; padding: 50px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { background: linear-gradient(160deg, #E0732B, #c45f1d); padding: 22px; display: flex; align-items: flex-start; justify-content: space-between; }
    .sheet-title { font-size: 22px; font-weight: 800; color: #fff; }
    .sheet-sub { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.78); margin-top: 2px; }
    .sheet-body { padding: 20px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 18px; }
    .field { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .field.invalid { border-color: #E0732B; }
    .field-label { font-size: 13px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: -6px; }
    .swatches { display: flex; gap: 11px; flex-wrap: wrap; }
    .swatch { width: 38px; height: 38px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
    .save-btn { width: 100%; height: 56px; border-radius: 16px; border: none; background: #E0732B; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  `],
})
export class HabitsComponent implements OnInit {
  private location = inject(Location);
  private habitService = inject(HabitService);

  readonly DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly PALETTE = PALETTE;

  readonly habits = signal<Habit[]>([]);
  readonly loading = signal(true);

  readonly adding = signal(false);
  readonly draftName = signal('');
  readonly draftGoal = signal('');
  readonly draftColor = signal('#E0732B');

  readonly doneToday = computed(() => this.habits().filter((h) => h.week[6]).length);
  readonly bestStreak = computed(() => this.habits().reduce((m, h) => Math.max(m, h.best), 0));
  readonly ringBg = computed(() => {
    const total = this.habits().length;
    const pct = total ? Math.round((this.doneToday() / total) * 100) : 0;
    return `conic-gradient(#E0732B ${pct}%, var(--rm-surface) 0)`;
  });

  constructor() {
    addIcons({ chevronBackOutline, addOutline, checkmarkOutline, flameOutline, closeOutline });
  }

  ngOnInit(): void {
    this.habitService.getAll().subscribe({
      next: (data) => { this.habits.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  back(): void {
    this.location.back();
  }

  openAdd(): void {
    this.draftName.set('');
    this.draftGoal.set('');
    this.draftColor.set('#E0732B');
    this.adding.set(true);
  }

  toggleToday(h: Habit): void {
    this.habitService.toggleToday(h._id).subscribe((updated) =>
      this.habits.update((list) => list.map((x) => (x._id === updated._id ? updated : x)))
    );
  }

  save(): void {
    const name = this.draftName().trim();
    if (!name) return;
    this.habitService
      .create({ name, goal: this.draftGoal().trim() || 'Every day', color: this.draftColor() })
      .subscribe((created) => {
        this.habits.update((list) => [...list, created]);
        this.adding.set(false);
      });
  }
}
