// src/app/core/components/rm-datetime.component.ts
// Shared date + time picker — the "DATE & TIME" module from the New Reminder
// screen, extracted so every create screen gets the same premium cards, the
// calendar bottom-sheet and the clock-dial dialog. Fix it here, it changes
// everywhere.
//
//   <rm-datetime mode="datetime" heading="DATE & TIME"
//                [(date)]="dateVal" [(time)]="timeVal"></rm-datetime>
//
// Values: date = "YYYY-MM-DD", time = "HH:mm" (24-hour). `mode` picks which
// cards show: 'date' | 'time' | 'datetime'.
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeService } from '../services/time.service';

export type RmDateTimeMode = 'date' | 'time' | 'datetime';
interface QuickChip { label: string; minutes?: number; absTime?: string }

@Component({
  selector: 'rm-datetime',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (heading) { <div class="dt-heading">{{ heading }}</div> }

    <!-- ── Date card ─────────────────────────────────────────────── -->
    @if (showDate()) {
      <div class="dt-card">
        <div class="dt-ico dt-ico-date">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </div>
        <div class="dt-segs">
          <span class="dt-seg">{{ dd() }}</span><span class="dt-sep">/</span>
          <span class="dt-seg">{{ mm() }}</span><span class="dt-sep">/</span>
          <span class="dt-seg">{{ yyyy() }}</span>
        </div>
        <button type="button" class="dt-pick rm-press" (click)="openSheet()">Pick</button>
      </div>
    }

    <!-- ── Time card ─────────────────────────────────────────────── -->
    @if (showTime()) {
      <div class="dt-card">
        <div class="dt-ico dt-ico-time">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </div>
        <div class="dt-segs">
          <span class="dt-seg">{{ hour12() }}</span><span class="dt-sep">:</span>
          <span class="dt-seg">{{ minutePad() }}</span>
          <button type="button" class="dt-ampm rm-press" (click)="toggleAmPm()">{{ ampm() }}</button>
        </div>
        <button type="button" class="dt-pick rm-press" (click)="openClock('main')">Pick</button>
      </div>
    }

    <!-- ── Quick chips ───────────────────────────────────────────── -->
    @if (chipsVisible()) {
      <div class="dt-chips">
        @for (q of quickChips; track q.label) {
          <button type="button" class="dt-chip" [class.active]="quickSel() === q.label" (click)="applyQuick(q)">{{ q.label }}</button>
        }
      </div>
    }

    <!-- ══ Date picker sheet ══ -->
    @if (sheetOpen()) {
      <div class="ds-backdrop" (click)="sheetOpen.set(false)"></div>
      <div class="ds-sheet">
        <div class="ds-head">
          <button type="button" class="ds-x rm-press" (click)="sheetOpen.set(false)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          </button>
          <div class="ds-title">Select date</div>
          <button type="button" class="ds-ok rm-press" (click)="applySheet()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <!-- quick date cards -->
        <div class="ds-quick">
          <button type="button" class="ds-q rm-press" [class.active]="isDraftDate(todayStr)" (click)="setDraftQuick('today')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span>Today</span>
          </button>
          <button type="button" class="ds-q rm-press" [class.active]="isDraftDate(tomorrowStr)" (click)="setDraftQuick('tomorrow')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span>Tomorrow</span>
          </button>
          <button type="button" class="ds-q rm-press" [class.active]="isDraftDate(nextMondayStr)" (click)="setDraftQuick('monday')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/><text x="12" y="18" text-anchor="middle" font-size="7" font-weight="800" fill="currentColor" stroke="none">MO</text></svg>
            <span>Next Monday</span>
          </button>
          <button type="button" class="ds-q rm-press" [class.active]="isDraftDate(nextWeekStr)" (click)="setDraftQuick('week')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 2v4M16 2v4M3 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/></svg>
            <span>Next Week</span>
          </button>
        </div>

        <!-- month calendar -->
        <div class="ds-cal-head">
          <span class="ds-month">{{ monthLabel() }}</span>
          <div class="ds-nav">
            <button type="button" class="ds-nav-btn rm-press" (click)="navMonth(-1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="ds-nav-btn rm-press" (click)="navMonth(1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div class="ds-dow">
          @for (d of dow; track d) { <span>{{ d }}</span> }
        </div>
        <div class="ds-grid">
          @for (cell of calCells(); track $index) {
            @if (cell === 0) {
              <span class="ds-cell blank"></span>
            } @else {
              <button type="button" class="ds-cell rm-press" [class.sel]="isDraftDay(cell)" (click)="pickDraftDay(cell)">{{ cell }}</button>
            }
          }
        </div>

        <!-- inline time row (datetime mode only) -->
        @if (mode === 'datetime') {
          <div class="ds-rows">
            <div class="ds-row" (click)="openClock('sheet')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              <span class="ds-row-label">Time</span>
              <span class="ds-row-val">{{ draftTimeLabel() }}</span>
              <svg class="ds-chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </div>
          </div>
        }
      </div>
    }

    <!-- ══ Clock time picker ══ -->
    @if (clockOpen()) {
      <div class="tp-backdrop" (click)="clockOpen.set(false)"></div>
      <div class="tp-dialog">
        <div class="tp-title">Time</div>

        <div class="tp-display">
          <button type="button" class="tp-big" [class.on]="clockMode() === 'hour'" (click)="clockMode.set('hour')">{{ clockH12() }}</button>
          <span class="tp-colon">:</span>
          <button type="button" class="tp-big" [class.on]="clockMode() === 'minute'" (click)="clockMode.set('minute')">{{ pad(clockMin()) }}</button>
          <div class="tp-ampm">
            <button type="button" [class.on]="clockAmpm() === 'AM'" (click)="clockAmpm.set('AM')">AM</button>
            <button type="button" [class.on]="clockAmpm() === 'PM'" (click)="clockAmpm.set('PM')">PM</button>
          </div>
        </div>

        @if (!nativeTime()) {
          <div class="tp-dial">
            <div class="tp-hand" [style.transform]="'rotate(' + handAngle() + 'deg)'"></div>
            <div class="tp-center"></div>
            @for (n of dialNumbers(); track n.value) {
              <button type="button" class="tp-n" [class.sel]="dialSelected(n.value)"
                      [style.left.%]="n.x" [style.top.%]="n.y" (click)="pickDial(n.value)">
                {{ clockMode() === 'minute' ? pad(n.value) : n.value }}
              </button>
            }
          </div>
        } @else {
          <input class="tp-native" type="time" [ngModel]="nativeTimeVal()" (ngModelChange)="setFromNative($event)" />
        }

        <div class="tp-actions">
          <button type="button" class="tp-kbd rm-press" (click)="nativeTime.set(!nativeTime())">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M6 13h1M10 13h1M14 13h1M18 13h0M7 16h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </button>
          <span class="tp-spacer"></span>
          <button type="button" class="tp-act" (click)="clockOpen.set(false)">Cancel</button>
          <button type="button" class="tp-act tp-ok" (click)="confirmClock()">OK</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .dt-heading { font-size: 10.5px; font-weight: 800; letter-spacing: .8px; color: var(--rm-text-muted); padding: 2px 2px 8px; }

    .dt-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--rm-surface); border-radius: 14px;
      padding: 10px 12px; margin-bottom: 10px;
    }
    .dt-ico {
      width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .dt-ico-date { background: var(--rm-purple-light); color: var(--rm-purple); }
    .dt-ico-time { background: rgba(245,158,11,.14); color: #F59E0B; }
    .dt-segs { flex: 1; display: flex; align-items: center; gap: 8px; }
    .dt-seg { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .dt-sep { font-size: 15px; font-weight: 600; color: var(--rm-text-muted); }
    .dt-ampm {
      margin-left: 4px; padding: 4px 10px; border: none; border-radius: 8px;
      background: var(--rm-purple-light); color: var(--rm-purple);
      font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit;
    }
    .dt-pick {
      padding: 8px 16px; border: 1px solid var(--rm-border); border-radius: 10px;
      background: var(--rm-card); color: var(--rm-text-secondary);
      font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      box-shadow: var(--rm-shadow-sm);
    }

    .dt-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
    .dt-chips::-webkit-scrollbar { display: none; }
    .dt-chip {
      height: 34px; padding: 0 14px; border-radius: 17px; flex-shrink: 0;
      border: 1.5px solid transparent; background: var(--rm-surface);
      font-size: 12.5px; font-weight: 700; color: var(--rm-text-secondary);
      cursor: pointer; font-family: inherit; white-space: nowrap;
      transition: border-color .2s, color .2s, background .2s;
    }
    .dt-chip.active { border-color: var(--rm-purple); color: var(--rm-purple); background: var(--rm-card); }

    /* ══ Date sheet ══ */
    .ds-backdrop { position: fixed; inset: 0; background: rgba(15, 20, 40, 0.45); z-index: 1000; animation: dsFade .2s ease-out; }
    @keyframes dsFade { from { opacity: 0; } }
    .ds-sheet {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 1001;
      background: var(--rm-card); border-radius: 24px 24px 0 0;
      padding: 14px 16px calc(20px + env(safe-area-inset-bottom));
      max-height: 88vh; overflow-y: auto;
      animation: dsUp .28s var(--rm-ease-out, ease-out);
    }
    @keyframes dsUp { from { transform: translateY(40px); opacity: 0; } }
    .ds-head { display: flex; align-items: center; margin-bottom: 14px; }
    .ds-x, .ds-ok { width: 34px; height: 34px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
    .ds-x  { color: var(--rm-text-primary); }
    .ds-ok { color: var(--rm-purple); }
    .ds-title { flex: 1; text-align: center; font-size: 14.5px; font-weight: 800; color: var(--rm-text-primary); }

    .ds-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
    .ds-q {
      border: 1.5px solid transparent; border-radius: 13px; background: var(--rm-surface);
      padding: 12px 4px 10px; cursor: pointer; font-family: inherit;
      display: flex; flex-direction: column; align-items: center; gap: 7px;
      color: var(--rm-text-secondary);
    }
    .ds-q span { font-size: 10.5px; font-weight: 700; color: var(--rm-text-secondary); text-align: center; line-height: 1.25; }
    .ds-q.active { background: var(--rm-purple-light); border-color: rgba(61,90,241,.35); color: var(--rm-purple); }
    .ds-q.active span { color: var(--rm-purple); }

    .ds-cal-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 10px; }
    .ds-month { font-size: 16.5px; font-weight: 800; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .ds-nav { display: flex; gap: 8px; }
    .ds-nav-btn {
      width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
      background: var(--rm-surface); color: var(--rm-text-primary);
      display: flex; align-items: center; justify-content: center;
    }
    .ds-dow { display: grid; grid-template-columns: repeat(7, 1fr); padding-bottom: 4px; }
    .ds-dow span { text-align: center; font-size: 10.5px; font-weight: 700; color: var(--rm-text-muted); }
    .ds-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; margin-bottom: 14px; }
    .ds-cell {
      height: 38px; border: none; background: none; cursor: pointer; font-family: inherit;
      font-size: 13.5px; font-weight: 700; color: var(--rm-text-primary);
      border-radius: 50%; width: 38px; justify-self: center;
      display: flex; align-items: center; justify-content: center;
    }
    .ds-cell.blank { cursor: default; }
    .ds-cell.sel { background: var(--rm-purple); color: #fff; box-shadow: 0 4px 12px rgba(61,90,241,.4); }

    .ds-rows { background: var(--rm-surface); border-radius: 16px; overflow: hidden; }
    .ds-row { display: flex; align-items: center; gap: 10px; padding: 14px; cursor: pointer; color: var(--rm-purple); }
    .ds-row-label { flex: 1; font-size: 13.5px; font-weight: 700; color: var(--rm-purple); }
    .ds-row-val { font-size: 13px; font-weight: 800; color: var(--rm-purple); }
    .ds-chev { color: var(--rm-text-muted); }

    /* ══ Clock time picker ══ */
    .tp-backdrop { position: fixed; inset: 0; background: rgba(15, 20, 40, 0.5); z-index: 1100; animation: dsFade .2s ease-out; }
    .tp-dialog {
      position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1101;
      width: min(320px, calc(100vw - 40px));
      background: var(--rm-card); border-radius: 22px; padding: 18px 18px 10px;
      animation: tpPop .25s var(--rm-ease-spring, ease-out);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
    }
    @keyframes tpPop { from { transform: translate(-50%, -46%) scale(.95); opacity: 0; } }
    .tp-title { font-size: 12px; font-weight: 700; color: var(--rm-text-secondary); margin-bottom: 10px; }
    .tp-display { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 16px; }
    .tp-big {
      border: none; background: none; cursor: pointer; font-family: 'Nunito', sans-serif; padding: 0 2px;
      font-size: 52px; font-weight: 800; color: var(--rm-text-muted); line-height: 1;
    }
    .tp-big.on { color: var(--rm-purple); }
    .tp-colon { font-size: 44px; font-weight: 800; color: var(--rm-text-muted); line-height: 1; margin-top: -6px; }
    .tp-ampm { display: flex; flex-direction: column; gap: 2px; margin-left: 10px; }
    .tp-ampm button {
      border: none; background: none; cursor: pointer; font-family: inherit; padding: 3px 6px;
      font-size: 13px; font-weight: 800; color: var(--rm-text-muted); border-radius: 7px;
    }
    .tp-ampm button.on { color: var(--rm-purple); background: var(--rm-purple-light); }

    .tp-dial { position: relative; width: 232px; height: 232px; margin: 0 auto 8px; border-radius: 50%; background: var(--rm-surface); }
    .tp-n {
      position: absolute; width: 34px; height: 34px; border-radius: 50%;
      border: none; cursor: pointer; font-family: inherit; padding: 0;
      background: transparent; color: var(--rm-text-primary);
      font-size: 13px; font-weight: 700;
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center; z-index: 2;
    }
    .tp-n.sel { background: var(--rm-purple); color: #fff; }
    .tp-center { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; border-radius: 50%; background: var(--rm-purple); transform: translate(-50%, -50%); z-index: 1; }
    .tp-hand {
      position: absolute; left: calc(50% - 1.25px); bottom: 50%; width: 2.5px; height: 80px;
      background: var(--rm-purple); transform-origin: bottom center; border-radius: 2px; z-index: 1;
      transition: transform .18s ease-out;
    }
    .tp-native {
      display: block; width: 100%; margin: 4px 0 12px; padding: 12px;
      border: 1.5px solid var(--rm-border); border-radius: 12px; background: var(--rm-surface);
      font-size: 16px; font-weight: 700; color: var(--rm-text-primary); font-family: inherit; outline: none;
    }
    .tp-actions { display: flex; align-items: center; padding: 2px 0 6px; }
    .tp-kbd { border: none; background: none; cursor: pointer; color: var(--rm-text-secondary); padding: 6px; display: flex; }
    .tp-spacer { flex: 1; }
    .tp-act { border: none; background: none; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 800; color: var(--rm-text-secondary); padding: 8px 10px; }
    .tp-act.tp-ok { color: var(--rm-purple); }
  `],
})
export class RmDateTimeComponent {
  private timeSvc = inject(TimeService);

  // ── Inputs / outputs ──────────────────────────────────────────────────
  @Input() mode: RmDateTimeMode = 'datetime';
  /** Optional uppercase section label rendered above the cards. */
  @Input() heading = '';
  /** Force quick-chips on/off. Defaults on unless mode is date-only. */
  @Input() chips: boolean | null = null;

  private readonly _date = signal('');
  private readonly _time = signal('09:00');

  @Input() set date(v: string) { this._date.set(v || ''); }
  get date(): string { return this._date(); }
  @Output() dateChange = new EventEmitter<string>();

  @Input() set time(v: string) { if (v) this._time.set(v); }
  get time(): string { return this._time(); }
  @Output() timeChange = new EventEmitter<string>();

  readonly quickSel = signal<string | null>(null);
  readonly quickChips: QuickChip[] = [
    { label: 'In 30 min',  minutes: 30  },
    { label: 'In 1 hour',  minutes: 60  },
    { label: 'In 2 hours', minutes: 120 },
    { label: 'Today 6 PM', absTime: '18:00' },
  ];

  showDate = () => this.mode !== 'time';
  showTime = () => this.mode !== 'date';
  chipsVisible = () => this.chips ?? this.mode !== 'date';

  // ── Card display ──────────────────────────────────────────────────────
  readonly dd   = computed(() => this._date().slice(8, 10) || '--');
  readonly mm   = computed(() => this._date().slice(5, 7) || '--');
  readonly yyyy = computed(() => this._date().slice(0, 4) || '----');
  readonly hour12 = computed(() => {
    const h = Number(this._time().slice(0, 2)) % 12;
    return String(h === 0 ? 12 : h).padStart(2, '0');
  });
  readonly minutePad = computed(() => this._time().slice(3, 5));
  readonly ampm = computed(() => Number(this._time().slice(0, 2)) >= 12 ? 'PM' : 'AM');

  // ── Quick chips / AM-PM ───────────────────────────────────────────────
  applyQuick(q: QuickChip): void {
    const now = this.timeSvc.now();
    if (q.absTime) {
      this.setDate(this.localDateStr(now));
      this.setTime(q.absTime);
    } else {
      now.setMinutes(now.getMinutes() + (q.minutes ?? 0));
      this.setDate(this.localDateStr(now));
      this.setTime(`${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`);
    }
    this.quickSel.set(q.label);
  }

  toggleAmPm(): void {
    const [h, m] = this._time().split(':').map(Number);
    this.setTime(`${this.pad((h + 12) % 24)}:${this.pad(m)}`);
    this.quickSel.set(null);
  }

  // ── Date sheet ────────────────────────────────────────────────────────
  readonly sheetOpen = signal(false);
  readonly draftDate = signal('');
  readonly draftTime = signal('09:00');
  readonly viewYear  = signal(this.timeSvc.now().getFullYear());
  readonly viewMonth = signal(this.timeSvc.now().getMonth());

  readonly dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly todayStr = this.localDateStr(this.timeSvc.now());
  readonly tomorrowStr = this.localDateStr(this.addDays(this.timeSvc.now(), 1));
  readonly nextMondayStr = this.computeNextMonday();
  readonly nextWeekStr = this.localDateStr(this.addDays(this.timeSvc.now(), 7));

  readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  readonly calCells = computed<number[]>(() => {
    const first = new Date(this.viewYear(), this.viewMonth(), 1);
    const days  = new Date(this.viewYear(), this.viewMonth() + 1, 0).getDate();
    const lead  = (first.getDay() + 6) % 7;                // Monday-first offset
    return [...Array(lead).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  });
  readonly draftTimeLabel = computed(() => this.timeLabel(this.draftTime()));

  openSheet(): void {
    this.draftDate.set(this._date() || this.todayStr);
    this.draftTime.set(this._time());
    const d = new Date(this.draftDate() + 'T00:00:00');
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
    this.sheetOpen.set(true);
  }

  applySheet(): void {
    this.setDate(this.draftDate());
    if (this.mode === 'datetime') this.setTime(this.draftTime());
    this.quickSel.set(null);
    this.sheetOpen.set(false);
  }

  navMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }

  isDraftDate(dateStr: string): boolean { return this.draftDate() === dateStr; }
  isDraftDay(day: number): boolean { return this.draftDate() === this.ymd(this.viewYear(), this.viewMonth(), day); }
  pickDraftDay(day: number): void { this.draftDate.set(this.ymd(this.viewYear(), this.viewMonth(), day)); }

  setDraftQuick(kind: 'today' | 'tomorrow' | 'monday' | 'week'): void {
    switch (kind) {
      case 'today':    this.draftDate.set(this.todayStr); break;
      case 'tomorrow': this.draftDate.set(this.tomorrowStr); break;
      case 'monday':   this.draftDate.set(this.nextMondayStr); break;
      case 'week':     this.draftDate.set(this.nextWeekStr); break;
    }
    const d = new Date(this.draftDate() + 'T00:00:00');
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }

  // ── Clock picker ──────────────────────────────────────────────────────
  readonly clockOpen  = signal(false);
  readonly clockMode  = signal<'hour' | 'minute'>('hour');
  readonly clockH12   = signal(9);
  readonly clockMin   = signal(0);
  readonly clockAmpm  = signal<'AM' | 'PM'>('AM');
  readonly nativeTime = signal(false);
  private clockTarget: 'main' | 'sheet' = 'main';

  readonly dialNumbers = computed(() => {
    const minute = this.clockMode() === 'minute';
    const values = minute
      ? Array.from({ length: 12 }, (_, i) => i * 5)
      : Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
    return values.map((value, i) => {
      const angle = (i * 30 - 90) * Math.PI / 180;
      return { value, x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
    });
  });
  readonly handAngle = computed(() =>
    this.clockMode() === 'minute' ? this.clockMin() * 6 : (this.clockH12() % 12) * 30
  );
  readonly nativeTimeVal = computed(() => {
    let h = this.clockH12() % 12;
    if (this.clockAmpm() === 'PM') h += 12;
    return `${this.pad(h)}:${this.pad(this.clockMin())}`;
  });

  openClock(target: 'main' | 'sheet'): void {
    this.clockTarget = target;
    const t = target === 'sheet' ? this.draftTime() : this._time();
    const [h, m] = t.split(':').map(Number);
    this.clockH12.set(h % 12 === 0 ? 12 : h % 12);
    this.clockMin.set(m);
    this.clockAmpm.set(h >= 12 ? 'PM' : 'AM');
    this.clockMode.set('hour');
    this.nativeTime.set(false);
    this.clockOpen.set(true);
  }

  pickDial(value: number): void {
    if (this.clockMode() === 'hour') {
      this.clockH12.set(value);
      this.clockMode.set('minute');
    } else {
      this.clockMin.set(value);
    }
  }

  dialSelected(value: number): boolean {
    return this.clockMode() === 'minute' ? this.clockMin() === value : this.clockH12() === value;
  }

  setFromNative(v: string): void {
    if (!/^\d{2}:\d{2}$/.test(v || '')) return;
    const [h, m] = v.split(':').map(Number);
    this.clockH12.set(h % 12 === 0 ? 12 : h % 12);
    this.clockMin.set(m);
    this.clockAmpm.set(h >= 12 ? 'PM' : 'AM');
  }

  confirmClock(): void {
    let h = this.clockH12() % 12;
    if (this.clockAmpm() === 'PM') h += 12;
    const t = `${this.pad(h)}:${this.pad(this.clockMin())}`;
    if (this.clockTarget === 'sheet') {
      this.draftTime.set(t);
    } else {
      this.setTime(t);
      this.quickSel.set(null);
    }
    this.clockOpen.set(false);
  }

  // ── Emit helpers ──────────────────────────────────────────────────────
  private setDate(v: string): void { this._date.set(v); this.dateChange.emit(v); }
  private setTime(v: string): void { this._time.set(v); this.timeChange.emit(v); }

  // ── Pure helpers ──────────────────────────────────────────────────────
  pad(n: number): string { return String(n).padStart(2, '0'); }

  private timeLabel(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${this.pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  private computeNextMonday(): string {
    const d = this.timeSvc.now();
    const delta = ((8 - d.getDay()) % 7) || 7;
    return this.localDateStr(this.addDays(d, delta));
  }

  private addDays(d: Date, n: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  private ymd(y: number, m: number, day: number): string {
    return `${y}-${this.pad(m + 1)}-${this.pad(day)}`;
  }

  private localDateStr(d: Date): string {
    return this.ymd(d.getFullYear(), d.getMonth(), d.getDate());
  }
}
