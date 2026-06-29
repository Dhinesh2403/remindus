// src/app/daily-plan/daily-plan.component.ts
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
  chevronForwardOutline,
  addOutline,
  checkmarkOutline,
  closeOutline,
  warningOutline,
} from 'ionicons/icons';
import { ActivityService, Activity } from '../core/services/activity.service';

const COLORS = ['#3257EE', '#F05542', '#1AA06D', '#E08A2B', '#7B61D8', '#E0699B', '#159C92', '#C99A1E'];

@Component({
  selector: 'app-daily-plan',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonInput, IonTextarea, IonSpinner],
  template: `
    <ion-content [scrollY]="true" class="page">
      <!-- Header -->
      <div class="hdr">
        <div class="hdr-row">
          <button class="circle-btn" (click)="back()"><ion-icon name="chevron-back-outline"></ion-icon></button>
          <div class="hdr-title">Daily Planner</div>
        </div>
        <div class="date-nav">
          <button class="circle-btn" (click)="shiftDay(-1)"><ion-icon name="chevron-back-outline"></ion-icon></button>
          <div class="date-label">{{ dateLabel() }}</div>
          <button class="circle-btn" (click)="shiftDay(1)"><ion-icon name="chevron-forward-outline"></ion-icon></button>
        </div>
        <div class="stats">
          <span [style.color]="doneCount() > 0 ? '#3ED28A' : 'rgba(255,255,255,.6)'">{{ doneCount() }}/{{ acts().length }} done</span>
          <span class="dot"></span>
          <span style="color:rgba(255,255,255,.9)">{{ plannedLabel() }} planned</span>
          <span class="dot"></span>
          <span style="color:rgba(255,255,255,.7)">{{ freeLabel() }} free</span>
        </div>
      </div>

      <!-- View tabs -->
      <div class="tabs">
        <div class="tab" *ngFor="let t of ['plan','summary','timeline']"
          [class.active]="view() === t" (click)="view.set(t)">{{ t | titlecase }}</div>
      </div>

      <div class="body">
        <div class="loading" *ngIf="loading()"><ion-spinner name="crescent"></ion-spinner></div>

        <div class="empty" *ngIf="!loading() && acts().length === 0 && view() !== 'timeline'">
          No activities for this day. Tap + to plan one.
        </div>

        <!-- Summary ring -->
        <div class="ring-card" *ngIf="!loading() && view() === 'summary' && acts().length">
          <div class="ring" [style.background]="ringBg()">
            <div class="ring-inner">{{ pct() }}%</div>
          </div>
          <div>
            <div class="ring-line">{{ summaryLine() }}</div>
            <div class="ring-sub">{{ plannedLabel() }} planned · {{ freeLabel() }} free</div>
          </div>
        </div>

        <!-- Plan / Summary lists -->
        <div class="cards" *ngIf="!loading() && view() !== 'timeline'">
          <div class="act" *ngFor="let a of acts()" [style.borderLeftColor]="a.color">
            <div class="act-icon" [style.background]="soft(a.color)" [style.color]="a.color">{{ a.type[0] }}</div>
            <div class="act-meta">
              <div class="act-title" [class.done]="a.done">{{ a.title }}</div>
              <div class="act-time">{{ range(a) }}</div>
              <div class="overdue" *ngIf="!a.done && isOverdue(a)">
                <ion-icon name="warning-outline"></ion-icon> Overdue
              </div>
              <div class="act-cat" *ngIf="a.cat && a.cat !== 'None'">{{ a.cat }}</div>
            </div>
            <button class="check" [style.background]="a.done ? a.color : 'transparent'"
              [style.borderColor]="a.done ? a.color : 'var(--rm-border)'" (click)="toggle(a)">
              <ion-icon *ngIf="a.done" name="checkmark-outline" style="color:#fff"></ion-icon>
            </button>
          </div>
        </div>

        <!-- Timeline -->
        <div class="timeline" *ngIf="view() === 'timeline'">
          <div class="slots">
            <div class="slot" *ngFor="let s of slots()">
              <div class="slot-label">{{ s }}</div>
              <div class="slot-line"></div>
            </div>
            <div class="now" [style.top]="nowTop()">
              <div class="now-dot"></div><div class="now-line"></div><span class="now-tag">NOW</span>
            </div>
            <div class="block" *ngFor="let b of blocks()"
              [style.top]="b.top" [style.height]="b.height"
              [style.background]="soft(b.color)" [style.borderColor]="b.color">
              <div class="block-title" [style.color]="b.color">{{ b.title }}</div>
              <div class="block-time">{{ b.range }}</div>
            </div>
          </div>
        </div>
      </div>

      <button class="fab" (click)="openAdd()"><ion-icon name="add-outline"></ion-icon></button>
    </ion-content>

    <!-- New Activity sheet -->
    <ion-modal [isOpen]="adding()" (didDismiss)="adding.set(false)" [initialBreakpoint]="1" [breakpoints]="[0, 1]">
      <ng-template>
        <div class="sheet">
          <div class="sheet-hdr">
            <div>
              <div class="sheet-title">New Activity</div>
              <div class="sheet-sub">Daily plan activity</div>
            </div>
            <button class="circle-btn dark" (click)="adding.set(false)"><ion-icon name="close-outline"></ion-icon></button>
          </div>
          <ion-content class="sheet-scroll">
            <div class="sheet-body">
              <ion-input class="field" [class.invalid]="!dTitle()" placeholder="Activity Title *"
                [value]="dTitle()" (ionInput)="dTitle.set($any($event.target).value)"></ion-input>

              <div>
                <div class="field-label">Tile Color</div>
                <div class="swatches">
                  <div *ngFor="let c of COLORS" class="swatch" [style.background]="c"
                    [style.borderColor]="dColor() === c ? c : 'transparent'" (click)="dColor.set(c)">
                    <ion-icon *ngIf="dColor() === c" name="checkmark-outline" style="color:#fff"></ion-icon>
                  </div>
                </div>
              </div>

              <div>
                <div class="field-label">Duration</div>
                <div class="chips">
                  <button *ngFor="let d of DUR" class="chip" [class.on]="dDur() === d.m" (click)="dDur.set(d.m)">{{ d.l }}</button>
                </div>
              </div>

              <ion-textarea class="ta" placeholder="Notes (optional)" [rows]="3"
                [value]="dNote()" (ionInput)="dNote.set($any($event.target).value)"></ion-textarea>

              <button class="save-btn" (click)="save()">
                <ion-icon name="checkmark-outline"></ion-icon> Save Activity
              </button>
            </div>
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    @keyframes rmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes rmFade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

    .page { --background: var(--rm-bg); }
    .hdr { background: linear-gradient(160deg, #3D5AF1, #2A3FCC); padding: calc(env(safe-area-inset-top) + 12px) 18px 0; animation: rmFadeUp .35s ease both; }
    .hdr-row { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; }
    .hdr-title { font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -.3px; }
    .circle-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; flex: none; }
    .circle-btn:active { transform: scale(.9); }
    .circle-btn.dark { background: var(--rm-surface); color: var(--rm-text-secondary); }
    .date-nav { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; }
    .date-label { font-size: 17px; font-weight: 800; color: #fff; }
    .stats { display: flex; align-items: center; gap: 14px; padding: 12px 0 16px; border-top: 1px solid rgba(255,255,255,.18); font-size: 13px; font-weight: 700; }
    .stats .dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.4); }

    .tabs { display: flex; align-items: center; gap: 8px; padding: 12px 18px; background: var(--rm-card); border-bottom: 1px solid var(--rm-border); }
    .tab { flex: 1; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 13.5px; font-weight: 700; cursor: pointer; background: var(--rm-surface); color: var(--rm-text-secondary); transition: all .2s; }
    .tab.active { background: var(--rm-purple); color: #fff; }

    .body { padding: 16px 18px calc(env(safe-area-inset-bottom) + 90px); animation: rmFade .25s ease both; }
    .ring-card { background: var(--rm-card); border: 1px solid var(--rm-border); border-radius: 20px; padding: 18px 20px; display: flex; align-items: center; gap: 18px; box-shadow: var(--rm-shadow-sm); margin-bottom: 12px; }
    .ring { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; }
    .ring-inner { width: 46px; height: 46px; border-radius: 50%; background: var(--rm-card); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: var(--rm-text-primary); }
    .ring-line { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); }
    .ring-sub { font-size: 12.5px; color: var(--rm-text-secondary); font-weight: 600; margin-top: 3px; }
    .loading { display: flex; justify-content: center; padding: 50px 0; }
    .empty { text-align: center; padding: 50px 24px; color: var(--rm-text-secondary); font-size: 14.5px; font-weight: 600; }

    .cards { display: flex; flex-direction: column; gap: 12px; }
    .act { display: flex; gap: 13px; align-items: flex-start; background: var(--rm-card); border: 1px solid var(--rm-border); border-radius: 18px; padding: 14px 15px; border-left: 4px solid; box-shadow: var(--rm-shadow-sm); animation: rmFadeUp .35s ease both; }
    .act-icon { width: 42px; height: 42px; border-radius: 13px; flex: none; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; text-transform: uppercase; }
    .act-meta { flex: 1; min-width: 0; }
    .act-title { font-size: 15.5px; font-weight: 700; color: var(--rm-text-primary); }
    .act-title.done { color: var(--rm-text-muted); text-decoration: line-through; }
    .act-time { font-size: 12.5px; font-weight: 600; color: var(--rm-text-secondary); margin-top: 3px; }
    .overdue { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; background: rgba(239,68,68,.12); border-radius: 8px; padding: 3px 9px; font-size: 11.5px; font-weight: 800; color: var(--rm-danger); }
    .act-cat { font-size: 11.5px; font-weight: 700; color: var(--rm-text-muted); margin-top: 5px; }
    .check { width: 28px; height: 28px; border-radius: 50%; border: 2px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; background: transparent; font-size: 16px; }
    .check:active { transform: scale(.88); }

    .timeline { position: relative; padding-left: 58px; }
    .slots { position: relative; }
    .slot { height: 50px; position: relative; }
    .slot-label { position: absolute; left: -58px; top: -7px; width: 50px; text-align: right; font-size: 11.5px; font-weight: 700; color: var(--rm-text-muted); }
    .slot-line { position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--rm-border); }
    .now { position: absolute; left: 0; right: 0; display: flex; align-items: center; z-index: 2; }
    .now-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--rm-success); flex: none; }
    .now-line { flex: 1; height: 2px; background: var(--rm-success); }
    .now-tag { font-size: 11px; font-weight: 800; background: var(--rm-success); color: #fff; padding: 2px 7px; border-radius: 8px; flex: none; }
    .block { position: absolute; left: 0; right: 0; border: 1.5px solid; border-radius: 12px; padding: 6px 10px; overflow: hidden; z-index: 1; }
    .block-title { font-size: 13px; font-weight: 800; }
    .block-time { font-size: 11px; font-weight: 600; color: var(--rm-text-secondary); }

    .fab { position: fixed; right: 20px; bottom: calc(env(safe-area-inset-bottom) + 24px); width: 58px; height: 58px; border-radius: 19px; border: none; background: var(--rm-purple); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; cursor: pointer; box-shadow: 0 14px 30px rgba(61,90,241,.45); z-index: 10; }
    .fab:active { transform: scale(.92); }

    .sheet { background: var(--rm-card); height: 100%; display: flex; flex-direction: column; }
    .sheet-hdr { background: linear-gradient(160deg, #3D5AF1, #2A3FCC); padding: 22px; display: flex; align-items: flex-start; justify-content: space-between; flex: none; }
    .sheet-title { font-size: 22px; font-weight: 800; color: #fff; }
    .sheet-sub { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.78); margin-top: 2px; }
    .sheet-scroll { --background: var(--rm-card); flex: 1; }
    .sheet-body { padding: 20px 22px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 18px; }
    .field { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 600; }
    .field.invalid { border-color: var(--rm-purple); }
    .field-label { font-size: 13px; font-weight: 800; color: var(--rm-text-muted); letter-spacing: .5px; text-transform: uppercase; margin-bottom: 10px; }
    .swatches { display: flex; gap: 11px; flex-wrap: wrap; }
    .swatch { width: 38px; height: 38px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
    .chips { display: flex; gap: 8px; overflow-x: auto; }
    .chip { flex: none; height: 38px; padding: 0 16px; border-radius: 12px; border: 1.5px solid var(--rm-border); background: var(--rm-surface); color: var(--rm-text-secondary); font-size: 13px; font-weight: 700; cursor: pointer; }
    .chip.on { border-color: var(--rm-purple); background: var(--rm-purple-light); color: var(--rm-purple); }
    .ta { --background: var(--rm-surface); --color: var(--rm-text-primary); --padding-start: 16px; --padding-end: 16px; --padding-top: 14px; border: 1.5px solid var(--rm-border); border-radius: 14px; font-weight: 500; }
    .save-btn { width: 100%; height: 56px; border-radius: 16px; border: none; background: var(--rm-purple); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  `],
})
export class DailyPlanComponent implements OnInit {
  private location = inject(Location);
  private activityService = inject(ActivityService);
  readonly COLORS = COLORS;
  readonly DUR = [
    { l: '5 min', m: 5 }, { l: '10 min', m: 10 }, { l: '15 min', m: 15 },
    { l: '30 min', m: 30 }, { l: '1h', m: 60 }, { l: '2h', m: 120 },
  ];

  readonly acts = signal<Activity[]>([]);
  readonly loading = signal(true);

  readonly view = signal<string>('summary');
  readonly dayOff = signal(0);

  readonly adding = signal(false);
  readonly dTitle = signal('');
  readonly dColor = signal('#3257EE');
  readonly dDur = signal(30);
  readonly dNote = signal('');

  readonly doneCount = computed(() => this.acts().filter((a) => a.done).length);
  readonly plannedMins = computed(() => this.acts().reduce((s, a) => s + (a.endH * 60 + a.endM - a.startH * 60 - a.startM), 0));
  readonly freeMins = computed(() => Math.max(0, 24 * 60 - this.plannedMins()));
  readonly pct = computed(() => (this.acts().length ? Math.round((this.doneCount() / this.acts().length) * 100) : 0));

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, addOutline, checkmarkOutline, closeOutline, warningOutline });
  }

  ngOnInit(): void { this.load(); }

  private selectedDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + this.dayOff());
    return d;
  }
  private dayKey(): string {
    const d = this.selectedDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private load(): void {
    this.loading.set(true);
    this.activityService.getByDate(this.dayKey()).subscribe({
      next: (data) => { this.acts.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  back(): void { this.location.back(); }
  shiftDay(d: number): void { this.dayOff.update((v) => v + d); this.load(); }

  dateLabel(): string {
    return this.selectedDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  fmtDur(m: number): string { return m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm'; }
  plannedLabel(): string { return this.fmtDur(this.plannedMins()); }
  freeLabel(): string { return this.fmtDur(this.freeMins()); }
  fmt12(h: number, m: number): string {
    const ap = h < 12 ? 'AM' : 'PM';
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  range(a: Activity): string {
    const dur = a.endH * 60 + a.endM - a.startH * 60 - a.startM;
    return this.fmt12(a.startH, a.startM) + ' – ' + this.fmt12(a.endH, a.endM) + ' · ' + this.fmtDur(dur);
  }
  // Only the current day can have overdue items; past days are history, future days aren't due yet.
  private isToday(): boolean { return this.dayOff() === 0; }
  private nowMins(): number { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  isOverdue(a: Activity): boolean { return this.isToday() && a.endH * 60 + a.endM < this.nowMins(); }
  soft(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.14)`;
  }
  ringBg(): string { return `conic-gradient(var(--rm-purple) ${this.pct()}%, var(--rm-surface) 0)`; }
  summaryLine(): string {
    const d = this.doneCount();
    if (d === 0) return 'No activities done yet';
    return d === this.acts().length ? 'All done! Great job' : "Keep going, you're making progress!";
  }

  // Timeline geometry
  private tStart = 6;
  private tEnd = 22;
  private pxPerMin = 2.5;
  slots(): string[] {
    const out: string[] = [];
    for (let h = this.tStart; h <= this.tEnd; h++) out.push(this.fmt12(h, 0));
    return out;
  }
  nowTop(): string { return Math.max(0, (this.nowMins() - this.tStart * 60) * this.pxPerMin) + 'px'; }
  blocks() {
    return this.acts().map((a) => {
      const startOff = (a.startH - this.tStart) * 60 + a.startM;
      const dur = a.endH * 60 + a.endM - a.startH * 60 - a.startM;
      return {
        title: a.title,
        range: this.fmt12(a.startH, a.startM) + ' – ' + this.fmt12(a.endH, a.endM),
        color: a.color,
        top: startOff * this.pxPerMin + 'px',
        height: Math.max(32, dur * this.pxPerMin) + 'px',
      };
    });
  }

  toggle(a: Activity): void {
    this.activityService.toggleDone(a._id).subscribe((updated) =>
      this.acts.update((list) => list.map((x) => (x._id === updated._id ? updated : x)))
    );
  }

  openAdd(): void {
    this.dTitle.set('');
    this.dColor.set('#3257EE');
    this.dDur.set(30);
    this.dNote.set('');
    this.adding.set(true);
  }
  save(): void {
    const title = this.dTitle().trim();
    if (!title) return;
    const startTotal = 10 * 60;
    const endTotal = startTotal + this.dDur();
    this.activityService
      .create({
        title,
        dayKey: this.dayKey(),
        startH: Math.floor(startTotal / 60),
        startM: startTotal % 60,
        endH: Math.floor(endTotal / 60),
        endM: endTotal % 60,
        color: this.dColor(),
        type: 'General',
        note: this.dNote(),
        cat: 'None',
      })
      .subscribe((created) => {
        this.acts.update((list) => [...list, created].sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM)));
        this.adding.set(false);
      });
  }
}
