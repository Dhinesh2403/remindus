// src/app/reminders/create/reminder-create.component.ts
// "New Reminder" — matches docs/screens/remindus (17)+(18).png.
// Pick (date) opens the Date/Duration sheet (19)+(21); Pick (time) opens the
// clock dial (20).
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, ToastController, AlertController, ActionSheetController,
} from '@ionic/angular/standalone';
import {
  ReminderService, CreateReminderDto, ReminderType, RepeatType,
} from '../../core/services/reminder.service';
import { FriendService, Friend } from '../../core/services/friend.service';
import { AlarmService } from '../../core/services/alarm.service';
import { TimeService } from '../../core/services/time.service';

type NotifType = 'push' | 'alarm';
interface CatChip { key: string; type: ReminderType; label: string; color: string }
interface QuickChip { label: string; minutes?: number; absTime?: string }

const OFFSET_OPTIONS = [
  { label: 'On time',        value: 0  },
  { label: '5 min before',   value: 5  },
  { label: '10 min before',  value: 10 },
  { label: '30 min before',  value: 30 },
  { label: '1 hour before',  value: 60 },
];

const REPEAT_OPTIONS: { label: string; value: RepeatType }[] = [
  { label: 'None',     value: 'none'     },
  { label: 'Daily',    value: 'daily'    },
  { label: 'Weekly',   value: 'weekly'   },
  { label: 'Weekdays', value: 'weekdays' },
  { label: 'Monthly',  value: 'monthly'  },
  { label: 'Yearly',   value: 'yearly'   },
];

const DURATION_OPTIONS = [
  { label: '15 min',  value: 15   },
  { label: '30 min',  value: 30   },
  { label: '45 min',  value: 45   },
  { label: '1 hour',  value: 60   },
  { label: '2 hours', value: 120  },
  { label: 'All day', value: 1440 },
];

const CUSTOM_CAT_COLORS = ['#06B6D4', '#F43F5E', '#84CC16', '#A855F7', '#0EA5E9', '#D946EF'];
const CUSTOM_CATS_KEY = 'rm_custom_categories';

@Component({
  selector: 'app-reminder-create',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
  template: `
    <ion-content class="nr-content">
      <div class="nr-sheet">

        <!-- ── Header ─────────────────────────────────────────────── -->
        <div class="nr-header a-fu" [style.--i]="1">
          <div class="nr-bell">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="nr-head-txt">
            <h2>New Reminder</h2>
            <p>Time, repeat &amp; type — all in one place</p>
          </div>
          <button class="nr-close rm-press" (click)="close()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <!-- ── Title input ────────────────────────────────────────── -->
        <input class="nr-title a-fu" [style.--i]="2" [ngModel]="titleVal()"
               (ngModelChange)="titleVal.set($event)"
               placeholder="What do you want to be reminded of?" maxlength="100" />

        <!-- ── Date & time ────────────────────────────────────────── -->
        <div class="nr-label a-fu" [style.--i]="3">DATE &amp; TIME</div>

        <div class="nr-row-card a-fu" [style.--i]="3">
          <div class="nr-ico">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div class="nr-segs">
            <input class="nr-seg nr-seg-in" inputmode="numeric" maxlength="2" [value]="dd()"
                   (focus)="selectAll($event)" (change)="setDatePart('d', $event)" aria-label="Day" /><span class="nr-sep">/</span>
            <input class="nr-seg nr-seg-in" inputmode="numeric" maxlength="2" [value]="mm()"
                   (focus)="selectAll($event)" (change)="setDatePart('m', $event)" aria-label="Month" /><span class="nr-sep">/</span>
            <input class="nr-seg nr-seg-in nr-seg-yr" inputmode="numeric" maxlength="4" [value]="yyyy()"
                   (focus)="selectAll($event)" (change)="setDatePart('y', $event)" aria-label="Year" />
          </div>
          <button class="nr-pick rm-press" (click)="openSheet('date')">Pick</button>
        </div>

        <div class="nr-row-card a-fu" [style.--i]="4">
          <div class="nr-ico">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </div>
          <div class="nr-segs">
            <input class="nr-seg nr-seg-in" inputmode="numeric" maxlength="2" [value]="hour12()"
                   (focus)="selectAll($event)" (change)="setHourInput($event)" aria-label="Hour" /><span class="nr-sep">:</span>
            <input class="nr-seg nr-seg-in" inputmode="numeric" maxlength="2" [value]="minutePad()"
                   (focus)="selectAll($event)" (change)="setMinuteInput($event)" aria-label="Minute" />
            <button class="nr-ampm rm-press" (click)="toggleAmPm()">{{ ampm() }}</button>
          </div>
          <button class="nr-pick rm-press" (click)="openClock('main')">Pick</button>
        </div>

        <div class="nr-chips a-fu" [style.--i]="5">
          @for (q of quickChips; track q.label) {
            <button class="nr-chip" [class.active]="quickSel() === q.label" (click)="applyQuick(q)">{{ q.label }}</button>
          }
        </div>

        <!-- ── Repeat ─────────────────────────────────────────────── -->
        <div class="nr-label a-fu" [style.--i]="6">REPEAT</div>
        <div class="nr-chips wrap a-fu" [style.--i]="6">
          @for (r of repeatOptions; track r.value) {
            <button class="nr-chip" [class.active]="repeatVal() === r.value" (click)="repeatVal.set(r.value)">{{ r.label }}</button>
          }
        </div>

        <!-- ── Reminder type ──────────────────────────────────────── -->
        <div class="nr-label a-fu" [style.--i]="7">REMINDER TYPE</div>
        <div class="nr-type-row a-fu" [style.--i]="7">
          <button class="nr-type rm-press" [class.active]="notifType() === 'push'" (click)="notifType.set('push')">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Push Notification</span>
          </button>
          <button class="nr-type rm-press" [class.active]="notifType() === 'alarm'" (click)="notifType.set('alarm')">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M5 3L2 6M19 3l3 3M12 10v3l2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span>Alarm</span>
          </button>
        </div>

        <!-- ── Category ───────────────────────────────────────────── -->
        <div class="nr-label a-fu" [style.--i]="8">CATEGORY</div>
        <div class="nr-chips wrap a-fu" [style.--i]="8">
          @for (c of allCategories(); track c.key) {
            <button class="nr-chip nr-cat" [class.active]="selectedCat() === c.key" (click)="selectedCat.set(c.key)">
              <span class="nr-dot" [style.background]="c.color"></span>{{ c.label }}
            </button>
          }
          <button class="nr-chip nr-new" (click)="addCategory()">+ New</button>
        </div>

        <!-- ── Set reminder for ───────────────────────────────────── -->
        <div class="nr-label a-fu" [style.--i]="9">SET REMINDER FOR</div>
        <div class="nr-for a-fu" [style.--i]="9">
          <button class="nr-for-btn" [class.active]="forSelf()" (click)="forSelf.set(true)">Me</button>
          <button class="nr-for-btn" [class.active]="!forSelf()" (click)="selectFriendMode()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            A Friend
          </button>
        </div>

        @if (!forSelf()) {
          <div class="nr-friends a-fu">
            @if (friends().length === 0) {
              <div class="nr-no-friends">No friends yet — add one from the Friends tab.</div>
            } @else {
              <button class="nr-friend-sel rm-press" (click)="openFriendPicker()">
                @if (selectedFriendObj(); as f) {
                  @if (f.avatar) {
                    <img class="nr-fs-ava" [src]="f.avatar" alt="" />
                  } @else {
                    <span class="nr-fs-ava nr-fs-initial">{{ f.name.charAt(0) | uppercase }}</span>
                  }
                  <span class="nr-fs-txt">
                    <span class="nr-fs-name">{{ f.name }}</span>
                    <span class="nr-fs-sub">{{ '@' + f.username }}</span>
                  </span>
                  <span class="nr-fs-change">Change</span>
                } @else {
                  <span class="nr-fs-ava nr-fs-ph">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/></svg>
                  </span>
                  <span class="nr-fs-txt">
                    <span class="nr-fs-name muted">Choose a friend…</span>
                    <span class="nr-fs-sub">{{ friends().length }} friends</span>
                  </span>
                  <svg class="nr-fs-chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
              </button>
            }
          </div>
        }

        <!-- ── CTA ────────────────────────────────────────────────── -->
        <button class="nr-cta rm-press-deep a-fu" [style.--i]="10" [disabled]="!canSave()" (click)="save()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ saving() ? 'Saving…' : forSelf() ? 'Set Reminder' : 'Assign Reminder' }}
        </button>
      </div>

      <!-- ══ Date / Duration picker sheet — remindus (19)+(21) ══ -->
      @if (sheetOpen()) {
        <div class="ds-backdrop" (click)="sheetOpen.set(false)"></div>
        <div class="ds-sheet">
          <div class="ds-head">
            <button class="ds-x rm-press" (click)="sheetOpen.set(false)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            </button>
            <div class="ds-tabs">
              <button class="ds-tab" [class.active]="sheetTab() === 'date'" (click)="sheetTab.set('date')">Date</button>
              <button class="ds-tab" [class.active]="sheetTab() === 'duration'" (click)="sheetTab.set('duration')">Duration</button>
            </div>
            <button class="ds-ok rm-press" (click)="applySheet()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>

          @if (sheetTab() === 'date') {
            <!-- quick date cards -->
            <div class="ds-quick">
              <button class="ds-q rm-press" [class.active]="isDraftDate(todayStr)" (click)="setDraftQuick('today')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                <span>Today</span>
              </button>
              <button class="ds-q rm-press" [class.active]="isDraftDate(tomorrowStr)" (click)="setDraftQuick('tomorrow')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                <span>Tomorrow</span>
              </button>
              <button class="ds-q rm-press" [class.active]="isDraftDate(nextMondayStr)" (click)="setDraftQuick('monday')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/><text x="12" y="18" text-anchor="middle" font-size="7" font-weight="800" fill="currentColor" stroke="none">MO</text></svg>
                <span>Next Monday</span>
              </button>
              <button class="ds-q rm-press" [class.active]="isDraftDate(todayStr) && draftTime() === '18:00'" (click)="setDraftQuick('evening')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                <span>Today Evening</span>
              </button>
            </div>

            <!-- month calendar -->
            <div class="ds-cal-head">
              <span class="ds-month">{{ monthLabel() }}</span>
              <div class="ds-nav">
                <button class="ds-nav-btn rm-press" (click)="navMonth(-1)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="ds-nav-btn rm-press" (click)="navMonth(1)">
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
                  <button class="ds-cell rm-press" [class.sel]="isDraftDay(cell)" (click)="pickDraftDay(cell)">{{ cell }}</button>
                }
              }
            </div>

            <!-- time / reminder / repeat rows -->
            <div class="ds-rows">
              <div class="ds-row" (click)="openClock('sheet')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                <span class="ds-row-label">Time</span>
                <span class="ds-row-val">{{ draftTimeLabel() }}</span>
                <button class="ds-row-x rm-press" (click)="resetDraftTime(); $event.stopPropagation()">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div class="ds-row" (click)="chooseOffset()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="ds-row-label">Reminder</span>
                <span class="ds-row-val">{{ offsetLabel(draftOffset()) }}</span>
                <svg class="ds-chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              </div>
              <div class="ds-row" (click)="chooseRepeat()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="ds-row-label dark">Repeat</span>
                <span class="ds-row-val muted">{{ repeatLabel(draftRepeat()) }}</span>
                <svg class="ds-chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              </div>
            </div>
          } @else {
            <!-- duration tab — remindus (21) -->
            <div class="ds-label">HOW LONG?</div>
            <div class="ds-dur-grid">
              @for (d of durationOptions; track d.value) {
                <button class="ds-dur rm-press" [class.active]="draftDuration() === d.value" (click)="draftDuration.set(d.value)">{{ d.label }}</button>
              }
            </div>
            <div class="ds-dur-sel">
              <div class="ds-dur-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </div>
              <div>
                <div class="ds-dur-sel-label">Selected duration</div>
                <div class="ds-dur-sel-val">{{ durationLabel(draftDuration()) }}</div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ══ Clock time picker — remindus (20) ══ -->
      @if (clockOpen()) {
        <div class="tp-backdrop" (click)="clockOpen.set(false)"></div>
        <div class="tp-dialog">
          <div class="tp-title">Time</div>

          <div class="tp-display">
            <input class="tp-big" [class.on]="clockMode() === 'hour'" inputmode="numeric" maxlength="2"
                   [value]="clockH12()" (focus)="clockMode.set('hour'); selectAll($event)"
                   (change)="setClockHour($event)" aria-label="Hour" />
            <span class="tp-colon">:</span>
            <input class="tp-big" [class.on]="clockMode() === 'minute'" inputmode="numeric" maxlength="2"
                   [value]="pad(clockMin())" (focus)="clockMode.set('minute'); selectAll($event)"
                   (change)="setClockMinute($event)" aria-label="Minute" />
            <div class="tp-ampm">
              <button [class.on]="clockAmpm() === 'AM'" (click)="clockAmpm.set('AM')">AM</button>
              <button [class.on]="clockAmpm() === 'PM'" (click)="clockAmpm.set('PM')">PM</button>
            </div>
          </div>

          @if (!nativeTime()) {
            <div class="tp-dial">
              <div class="tp-hand" [style.transform]="'rotate(' + handAngle() + 'deg)'"></div>
              <div class="tp-center"></div>
              @for (n of dialNumbers(); track n.value) {
                <button class="tp-n" [class.sel]="dialSelected(n.value)"
                        [style.left.%]="n.x" [style.top.%]="n.y" (click)="pickDial(n.value)">
                  {{ clockMode() === 'minute' ? pad(n.value) : n.value }}
                </button>
              }
            </div>
          } @else {
            <input class="tp-native" type="time" [ngModel]="nativeTimeVal()" (ngModelChange)="setFromNative($event)" />
          }

          <div class="tp-actions">
            <button class="tp-kbd rm-press" (click)="nativeTime.set(!nativeTime())">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M6 13h1M10 13h1M14 13h1M18 13h0M7 16h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </button>
            <span class="tp-spacer"></span>
            <button class="tp-act" (click)="clockOpen.set(false)">Cancel</button>
            <button class="tp-act tp-ok" (click)="confirmClock()">OK</button>
          </div>
        </div>
      }

      <!-- ══ Friend picker sheet ══ -->
      @if (friendPickerOpen()) {
        <div class="ds-backdrop" (click)="friendPickerOpen.set(false)"></div>
        <div class="fp-sheet">
          <div class="fp-head">
            <div class="fp-head-txt">
              <h3>Choose a friend</h3>
              <p>{{ friends().length }} friends</p>
            </div>
            <button class="nr-close rm-press" (click)="friendPickerOpen.set(false)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div class="fp-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <input type="text" placeholder="Search by name or username…"
                   [ngModel]="friendQuery()" (ngModelChange)="friendQuery.set($event)" />
            @if (friendQuery()) {
              <button class="fp-clear rm-press" (click)="friendQuery.set('')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
              </button>
            }
          </div>

          <div class="fp-list">
            @for (f of filteredFriends(); track f._id) {
              <button class="fp-row rm-press" [class.active]="selectedFriend() === f._id" (click)="pickFriend(f)">
                @if (f.avatar) {
                  <img class="fp-ava" [src]="f.avatar" alt="" />
                } @else {
                  <span class="fp-ava fp-initial">{{ f.name.charAt(0) | uppercase }}</span>
                }
                <span class="fp-txt">
                  <span class="fp-name">{{ f.name }}</span>
                  <span class="fp-sub">{{ '@' + f.username }}</span>
                </span>
                @if (selectedFriend() === f._id) {
                  <svg class="fp-check" width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
              </button>
            } @empty {
              <div class="fp-empty">No friends match “{{ friendQuery() }}”</div>
            }
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    :host { display: block; }
    .nr-content { --background: var(--rm-bg); }
    .nr-sheet {
      background: var(--rm-card);
      border-radius: 24px 24px 0 0;
      min-height: 100%;
      padding: 20px 16px calc(28px + env(safe-area-inset-bottom));
      margin-top: 8px;
    }

    /* ── Header ── */
    .nr-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nr-bell {
      width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0;
      background: var(--rm-purple-light); color: var(--rm-purple);
      display: flex; align-items: center; justify-content: center;
    }
    .nr-head-txt { flex: 1; min-width: 0; }
    .nr-head-txt h2 { margin: 0; font-size: 17px; font-weight: 800; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .nr-head-txt p  { margin: 2px 0 0; font-size: 12px; font-weight: 600; color: var(--rm-text-muted); }
    .nr-close {
      width: 32px; height: 32px; border-radius: 50%; border: none; flex-shrink: 0;
      background: var(--rm-surface); color: var(--rm-text-secondary);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }

    /* ── Title ── */
    .nr-title {
      width: 100%; padding: 15px 16px; border: none; outline: none; border-radius: 14px;
      background: var(--rm-surface); font-size: 14.5px; font-weight: 600;
      color: var(--rm-text-primary); font-family: inherit; margin-bottom: 6px;
    }
    .nr-title::placeholder { color: var(--rm-text-muted); font-weight: 500; }

    /* ── Section labels ── */
    .nr-label { font-size: 10.5px; font-weight: 800; letter-spacing: .8px; color: var(--rm-text-muted); padding: 14px 2px 8px; }

    /* ── Date / time cards ── */
    .nr-row-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--rm-surface); border-radius: 14px;
      padding: 10px 12px; margin-bottom: 10px;
    }
    .nr-ico {
      width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
      background: var(--rm-purple-light); color: var(--rm-purple);
      display: flex; align-items: center; justify-content: center;
    }
    .nr-segs { flex: 1; display: flex; align-items: center; gap: 8px; }
    .nr-seg { font-size: 17px; font-weight: 800; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .nr-seg-in {
      width: 2.4ch; padding: 3px 0; border: none; outline: none; background: transparent;
      text-align: center; border-bottom: 1.5px solid transparent; -moz-appearance: textfield;
    }
    .nr-seg-in.nr-seg-yr { width: 4.4ch; }
    .nr-seg-in:focus { border-bottom-color: var(--rm-purple); }
    .nr-seg-in::-webkit-inner-spin-button, .nr-seg-in::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .nr-sep { font-size: 15px; font-weight: 600; color: var(--rm-text-muted); }
    .nr-ampm {
      margin-left: 4px; padding: 4px 10px; border: none; border-radius: 8px;
      background: var(--rm-purple-light); color: var(--rm-purple);
      font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit;
    }
    .nr-pick {
      padding: 8px 16px; border: 1px solid var(--rm-border); border-radius: 10px;
      background: var(--rm-card); color: var(--rm-text-secondary);
      font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      box-shadow: var(--rm-shadow-sm);
    }

    /* ── Chips ── */
    .nr-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
    .nr-chips::-webkit-scrollbar { display: none; }
    .nr-chips.wrap { flex-wrap: wrap; overflow: visible; }
    .nr-chip {
      height: 34px; padding: 0 14px; border-radius: 17px; flex-shrink: 0;
      border: 1.5px solid transparent; background: var(--rm-surface);
      font-size: 12.5px; font-weight: 700; color: var(--rm-text-secondary);
      cursor: pointer; font-family: inherit; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 6px;
      transition: border-color .2s, color .2s, background .2s;
    }
    .nr-chip.active { border-color: var(--rm-purple); color: var(--rm-purple); background: var(--rm-card); }
    .nr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .nr-new { border: 1.5px dashed var(--rm-border); background: var(--rm-card); color: var(--rm-text-muted); }

    /* ── Reminder type cards ── */
    .nr-type-row { display: flex; gap: 10px; }
    .nr-type {
      flex: 1; min-height: 62px; border-radius: 14px; cursor: pointer; font-family: inherit;
      border: 1.5px solid transparent; background: var(--rm-surface);
      color: var(--rm-text-primary); font-size: 13px; font-weight: 800;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      transition: border-color .2s, color .2s, background .2s;
    }
    .nr-type.active { border-color: var(--rm-purple); background: var(--rm-purple-light); color: var(--rm-purple); }

    /* ── Set reminder for ── */
    .nr-for { display: flex; background: var(--rm-surface); border-radius: 13px; padding: 4px; }
    .nr-for-btn {
      flex: 1; height: 40px; border: none; border-radius: 10px; background: transparent;
      font-size: 13.5px; font-weight: 800; color: var(--rm-text-secondary);
      cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: background .2s, color .2s, box-shadow .2s;
    }
    .nr-for-btn.active { background: var(--rm-card); color: var(--rm-text-primary); box-shadow: var(--rm-shadow-sm); }

    .nr-friends { padding: 12px 2px 2px; }
    .nr-no-friends { font-size: 12.5px; color: var(--rm-text-muted); font-weight: 600; padding: 4px 2px; }
    .nr-friend-sel {
      width: 100%; display: flex; align-items: center; gap: 11px; text-align: left;
      padding: 9px 12px; border-radius: 14px; cursor: pointer; font-family: inherit;
      border: 1.5px solid transparent; background: var(--rm-surface);
    }
    .nr-fs-ava {
      width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      background: var(--rm-purple); color: #fff; font-size: 14px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .nr-fs-ph { background: var(--rm-purple-light); color: var(--rm-purple); }
    .nr-fs-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .nr-fs-name { font-size: 13.5px; font-weight: 800; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nr-fs-name.muted { color: var(--rm-text-muted); font-weight: 700; }
    .nr-fs-sub { font-size: 11px; font-weight: 600; color: var(--rm-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nr-fs-change {
      flex-shrink: 0; padding: 6px 12px; border-radius: 9px;
      background: var(--rm-purple-light); color: var(--rm-purple);
      font-size: 11.5px; font-weight: 800;
    }
    .nr-fs-chev { flex-shrink: 0; color: var(--rm-text-muted); }

    /* ── CTA ── */
    .nr-cta {
      width: 100%; height: 54px; margin-top: 22px;
      border: none; border-radius: 15px; cursor: pointer; font-family: 'Nunito', sans-serif;
      background: var(--rm-purple); color: #fff; font-size: 15.5px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; gap: 9px;
      box-shadow: 0 8px 20px rgba(61, 90, 241, 0.35);
    }
    .nr-cta:disabled { opacity: .5; box-shadow: none; }

    /* ══ Date/Duration sheet ══ */
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
    .ds-tabs { flex: 1; display: flex; justify-content: center; gap: 26px; }
    .ds-tab {
      border: none; background: none; cursor: pointer; font-family: inherit;
      font-size: 14.5px; font-weight: 800; color: var(--rm-text-muted);
      padding: 4px 2px 7px; border-bottom: 2.5px solid transparent;
    }
    .ds-tab.active { color: var(--rm-purple); border-bottom-color: var(--rm-purple); }

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
    .ds-row {
      display: flex; align-items: center; gap: 10px; padding: 14px;
      cursor: pointer; color: var(--rm-purple);
      border-bottom: 1px solid var(--rm-border);
    }
    .ds-row:last-child { border-bottom: none; }
    .ds-row-label { flex: 1; font-size: 13.5px; font-weight: 700; color: var(--rm-purple); }
    .ds-row-label.dark { color: var(--rm-text-primary); }
    .ds-row-val { font-size: 13px; font-weight: 800; color: var(--rm-purple); }
    .ds-row-val.muted { color: var(--rm-text-muted); }
    .ds-row-x {
      width: 24px; height: 24px; border: none; border-radius: 50%; cursor: pointer;
      background: transparent; color: var(--rm-text-muted);
      display: flex; align-items: center; justify-content: center;
    }
    .ds-chev { color: var(--rm-text-muted); }

    .ds-label { font-size: 10.5px; font-weight: 800; letter-spacing: .8px; color: var(--rm-text-muted); padding: 6px 2px 10px; }
    .ds-dur-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .ds-dur {
      height: 44px; border-radius: 12px; border: 1.5px solid transparent;
      background: var(--rm-surface); cursor: pointer; font-family: inherit;
      font-size: 13px; font-weight: 700; color: var(--rm-text-primary);
    }
    .ds-dur.active { border-color: var(--rm-purple); background: var(--rm-purple-light); color: var(--rm-purple); }
    .ds-dur-sel { display: flex; align-items: center; gap: 12px; background: var(--rm-surface); border-radius: 14px; padding: 13px 14px; }
    .ds-dur-ico {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: var(--rm-card); color: var(--rm-purple);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--rm-shadow-sm);
    }
    .ds-dur-sel-label { font-size: 11px; font-weight: 600; color: var(--rm-text-muted); }
    .ds-dur-sel-val { font-size: 14.5px; font-weight: 800; color: var(--rm-text-primary); }

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
    input.tp-big { width: 74px; text-align: center; outline: none; border-bottom: 2px solid transparent; -moz-appearance: textfield; }
    input.tp-big.on { border-bottom-color: var(--rm-purple); }
    input.tp-big::-webkit-inner-spin-button, input.tp-big::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .tp-colon { font-size: 44px; font-weight: 800; color: var(--rm-text-muted); line-height: 1; margin-top: -6px; }
    .tp-ampm { display: flex; flex-direction: column; gap: 2px; margin-left: 10px; }
    .tp-ampm button {
      border: none; background: none; cursor: pointer; font-family: inherit; padding: 3px 6px;
      font-size: 13px; font-weight: 800; color: var(--rm-text-muted); border-radius: 7px;
    }
    .tp-ampm button.on { color: var(--rm-purple); background: var(--rm-purple-light); }

    .tp-dial {
      position: relative; width: 232px; height: 232px; margin: 0 auto 8px;
      border-radius: 50%; background: var(--rm-surface);
    }
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
    .tp-act {
      border: none; background: none; cursor: pointer; font-family: inherit;
      font-size: 13.5px; font-weight: 800; color: var(--rm-text-secondary); padding: 8px 10px;
    }
    .tp-act.tp-ok { color: var(--rm-purple); }

    /* ══ Friend picker sheet ══ */
    .fp-sheet {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 1001;
      background: var(--rm-card); border-radius: 24px 24px 0 0;
      padding: 16px 16px calc(12px + env(safe-area-inset-bottom));
      height: min(72vh, 560px);
      display: flex; flex-direction: column;
      animation: dsUp .28s var(--rm-ease-out, ease-out);
    }
    .fp-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .fp-head-txt { flex: 1; min-width: 0; }
    .fp-head-txt h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .fp-head-txt p  { margin: 2px 0 0; font-size: 11.5px; font-weight: 600; color: var(--rm-text-muted); }
    .fp-search {
      display: flex; align-items: center; gap: 9px; flex-shrink: 0;
      background: var(--rm-surface); border-radius: 12px; padding: 0 12px;
      color: var(--rm-text-muted); margin-bottom: 10px;
    }
    .fp-search input {
      flex: 1; min-width: 0; height: 42px; border: none; outline: none; background: none;
      font-size: 13.5px; font-weight: 600; color: var(--rm-text-primary); font-family: inherit;
    }
    .fp-search input::placeholder { color: var(--rm-text-muted); font-weight: 500; }
    .fp-clear {
      width: 22px; height: 22px; border: none; border-radius: 50%; cursor: pointer; flex-shrink: 0;
      background: var(--rm-border); color: var(--rm-text-secondary);
      display: flex; align-items: center; justify-content: center;
    }
    .fp-list { flex: 1; overflow-y: auto; min-height: 0; padding-bottom: 8px; }
    .fp-row {
      width: 100%; display: flex; align-items: center; gap: 11px; text-align: left;
      padding: 9px 10px; border-radius: 13px; cursor: pointer; font-family: inherit;
      border: 1.5px solid transparent; background: none; margin-bottom: 2px;
    }
    .fp-row.active { border-color: var(--rm-purple); background: var(--rm-purple-light); }
    .fp-ava {
      width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      background: var(--rm-purple); color: #fff; font-size: 15px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .fp-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .fp-name { font-size: 14px; font-weight: 800; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-sub  { font-size: 11.5px; font-weight: 600; color: var(--rm-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-check { flex-shrink: 0; color: var(--rm-purple); }
    .fp-empty { text-align: center; padding: 32px 12px; font-size: 13px; font-weight: 600; color: var(--rm-text-muted); }
  `],
})
export class ReminderCreateComponent implements OnInit {
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private svc     = inject(ReminderService);
  private friendSvc = inject(FriendService);
  private alarmSvc  = inject(AlarmService);
  private toast   = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private sheetCtrl = inject(ActionSheetController);
  private time    = inject(TimeService);

  // ── Form state ────────────────────────────────────────────────────────
  titleVal = signal('');
  // Preload with trusted now + 5 min (server-synced, not the raw device clock).
  private readonly initAt = this.time.plusMinutes(5);
  readonly dateVal   = signal(this.initAt.date);
  readonly timeVal   = signal(this.initAt.time);
  readonly quickSel  = signal<string | null>(null);
  readonly repeatVal = signal<RepeatType>('none');
  readonly notifType = signal<NotifType>('push');
  readonly selectedCat = signal('personal');
  readonly forSelf   = signal(true);
  readonly friends   = signal<Friend[]>([]);
  readonly selectedFriend = signal<string | null>(null);
  readonly friendPickerOpen = signal(false);
  readonly friendQuery = signal('');
  readonly selectedFriendObj = computed(() =>
    this.friends().find(f => f._id === this.selectedFriend()) ?? null
  );
  readonly filteredFriends = computed(() => {
    const q = this.friendQuery().trim().toLowerCase();
    if (!q) return this.friends();
    return this.friends().filter(f =>
      f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  });
  readonly offsetMin = signal(0);
  readonly duration  = signal<number | null>(null);
  readonly saving    = signal(false);
  // Set when we arrive from the friend activity page (?assignTo=): return there after save.
  private returnToFriendId: string | null = null;

  readonly quickChips: QuickChip[] = [
    { label: 'In 30 min',  minutes: 30  },
    { label: 'In 1 hour',  minutes: 60  },
    { label: 'In 2 hours', minutes: 120 },
    { label: 'Today 6 PM', absTime: '18:00' },
  ];
  readonly repeatOptions   = REPEAT_OPTIONS;
  readonly durationOptions = DURATION_OPTIONS;

  private readonly baseCategories: CatChip[] = [
    { key: 'personal', type: 'personal', label: 'Personal', color: '#3D5AF1' },
    { key: 'work',     type: 'work',     label: 'Work',     color: '#F59E0B' },
    { key: 'health',   type: 'health',   label: 'Health',   color: '#10B981' },
    { key: 'finance',  type: 'finance',  label: 'Finance',  color: '#F97316' },
    { key: 'family',   type: 'family',   label: 'Family',   color: '#EF4444' },
    { key: 'travel',   type: 'travel',   label: 'Travel',   color: '#8B5CF6' },
    { key: 'shopping', type: 'shopping', label: 'Shopping', color: '#14B8A6' },
  ];
  private readonly customCats = signal<CatChip[]>(this.loadCustomCats());
  readonly allCategories = computed(() => [...this.baseCategories, ...this.customCats()]);

  // ── Date/time display ─────────────────────────────────────────────────
  readonly dd   = computed(() => this.dateVal().slice(8, 10));
  readonly mm   = computed(() => this.dateVal().slice(5, 7));
  readonly yyyy = computed(() => this.dateVal().slice(0, 4));
  readonly hour12 = computed(() => {
    const h = Number(this.timeVal().slice(0, 2)) % 12;
    return String(h === 0 ? 12 : h).padStart(2, '0');
  });
  readonly minutePad = computed(() => this.timeVal().slice(3, 5));
  readonly ampm = computed(() => Number(this.timeVal().slice(0, 2)) >= 12 ? 'PM' : 'AM');

  readonly canSave = computed(() =>
    !this.saving() && this.titleVal().trim().length > 0 && (this.forSelf() || this.selectedFriend())
  );

  // ── Picker sheet state (remindus 19/21) ───────────────────────────────
  readonly sheetOpen = signal(false);
  readonly sheetTab  = signal<'date' | 'duration'>('date');
  readonly draftDate    = signal('');
  readonly draftTime    = signal('09:00');
  readonly draftOffset  = signal(0);
  readonly draftRepeat  = signal<RepeatType>('none');
  readonly draftDuration = signal<number | null>(null);
  readonly viewYear  = signal(this.time.now().getFullYear());
  readonly viewMonth = signal(this.time.now().getMonth());

  readonly dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly todayStr = this.localDateStr(this.time.now());
  readonly tomorrowStr = this.localDateStr(this.addDays(this.time.now(), 1));
  readonly nextMondayStr = this.computeNextMonday();

  readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  readonly calCells = computed<number[]>(() => {
    const first = new Date(this.viewYear(), this.viewMonth(), 1);
    const days  = new Date(this.viewYear(), this.viewMonth() + 1, 0).getDate();
    const lead  = (first.getDay() + 6) % 7;               // Monday-first offset
    return [...Array(lead).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  });
  readonly draftTimeLabel = computed(() => this.timeLabel(this.draftTime()));

  // ── Clock picker state (remindus 20) ──────────────────────────────────
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
    this.clockMode() === 'minute'
      ? this.clockMin() * 6
      : (this.clockH12() % 12) * 30
  );
  readonly nativeTimeVal = computed(() => {
    let h = this.clockH12() % 12;
    if (this.clockAmpm() === 'PM') h += 12;
    return `${this.pad(h)}:${this.pad(this.clockMin())}`;
  });

  ngOnInit(): void {
    // ?assignTo=<friendId> (from the friend activity page) → pre-select that friend.
    const assignTo = this.route.snapshot.queryParamMap.get('assignTo');
    this.friendSvc.getFriends().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends);
        if (assignTo && friends.some(f => f._id === assignTo)) {
          this.forSelf.set(false);
          this.selectedFriend.set(assignTo);
          this.returnToFriendId = assignTo;
        }
      },
      error: () => {},
    });
  }

  // ── Header / quick chips ──────────────────────────────────────────────
  close(): void { this.router.navigate(['/app/reminders']); }

  applyQuick(q: QuickChip): void {
    const now = this.time.now();
    if (q.absTime) {
      this.dateVal.set(this.localDateStr(now));
      this.timeVal.set(q.absTime);
    } else {
      now.setMinutes(now.getMinutes() + (q.minutes ?? 0));
      this.dateVal.set(this.localDateStr(now));
      this.timeVal.set(`${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`);
    }
    this.quickSel.set(q.label);
  }

  toggleAmPm(): void {
    const [h, m] = this.timeVal().split(':').map(Number);
    this.timeVal.set(`${this.pad((h + 12) % 24)}:${this.pad(m)}`);
    this.quickSel.set(null);
  }

  // ── Typed date/time entry (main add page) ─────────────────────────────
  selectAll(e: Event): void { (e.target as HTMLInputElement).select(); }

  setHourInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    let h = parseInt(el.value, 10);
    if (isNaN(h)) h = Number(this.hour12());
    h = Math.min(12, Math.max(1, h));
    const h24 = (h % 12) + (this.ampm() === 'PM' ? 12 : 0);
    this.timeVal.set(`${this.pad(h24)}:${this.timeVal().slice(3, 5)}`);
    this.quickSel.set(null);
    el.value = this.pad(h);
  }

  setMinuteInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    let m = parseInt(el.value, 10);
    if (isNaN(m)) m = Number(this.minutePad());
    m = Math.min(59, Math.max(0, m));
    this.timeVal.set(`${this.timeVal().slice(0, 2)}:${this.pad(m)}`);
    this.quickSel.set(null);
    el.value = this.pad(m);
  }

  setDatePart(part: 'd' | 'm' | 'y', e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = parseInt(el.value, 10);
    let [y, m, d] = this.dateVal().split('-').map(Number);
    if (!isNaN(n)) {
      if (part === 'd') d = n;
      else if (part === 'm') m = n;
      else y = n;
    }
    m = Math.min(12, Math.max(1, m));
    y = Math.min(2100, Math.max(2000, y));
    d = Math.min(new Date(y, m, 0).getDate(), Math.max(1, d));   // clamp to month length
    this.dateVal.set(`${y}-${this.pad(m)}-${this.pad(d)}`);
    this.quickSel.set(null);
    el.value = part === 'y' ? String(y) : this.pad(part === 'd' ? d : m);
  }

  // ── Categories ────────────────────────────────────────────────────────
  async addCategory(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'New Category',
      inputs: [{ name: 'label', type: 'text', placeholder: 'Category name', attributes: { maxlength: 20 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data: { label: string }) => {
            const label = (data.label || '').trim();
            if (!label) return false;
            const key = 'custom:' + label.toLowerCase();
            if (!this.allCategories().some(c => c.key === key)) {
              const color = CUSTOM_CAT_COLORS[this.customCats().length % CUSTOM_CAT_COLORS.length];
              const next = [...this.customCats(), { key, type: 'custom' as ReminderType, label, color }];
              this.customCats.set(next);
              localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next));
            }
            this.selectedCat.set(key);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private loadCustomCats(): CatChip[] {
    try { return JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY) || '[]'); }
    catch { return []; }
  }

  // ── Set-reminder-for ──────────────────────────────────────────────────
  selectFriendMode(): void {
    this.forSelf.set(false);
    if (!this.selectedFriend()) {
      if (this.friends().length === 1) {
        this.selectedFriend.set(this.friends()[0]._id);
      } else if (this.friends().length > 1) {
        this.openFriendPicker();
      }
    }
  }

  openFriendPicker(): void {
    this.friendQuery.set('');
    this.friendPickerOpen.set(true);
  }

  pickFriend(f: Friend): void {
    this.selectedFriend.set(f._id);
    this.friendPickerOpen.set(false);
  }

  // ── Date/Duration sheet ───────────────────────────────────────────────
  openSheet(tab: 'date' | 'duration'): void {
    this.sheetTab.set(tab);
    this.draftDate.set(this.dateVal());
    this.draftTime.set(this.timeVal());
    this.draftOffset.set(this.offsetMin());
    this.draftRepeat.set(this.repeatVal());
    this.draftDuration.set(this.duration());
    const d = new Date(this.dateVal() + 'T00:00:00');
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
    this.sheetOpen.set(true);
  }

  applySheet(): void {
    this.dateVal.set(this.draftDate());
    this.timeVal.set(this.draftTime());
    this.offsetMin.set(this.draftOffset());
    this.repeatVal.set(this.draftRepeat());
    this.duration.set(this.draftDuration());
    this.quickSel.set(null);
    this.sheetOpen.set(false);
  }

  navMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }

  isDraftDate(dateStr: string): boolean { return this.draftDate() === dateStr; }

  isDraftDay(day: number): boolean {
    return this.draftDate() === this.ymd(this.viewYear(), this.viewMonth(), day);
  }

  pickDraftDay(day: number): void {
    this.draftDate.set(this.ymd(this.viewYear(), this.viewMonth(), day));
  }

  setDraftQuick(kind: 'today' | 'tomorrow' | 'monday' | 'evening'): void {
    switch (kind) {
      case 'today':    this.draftDate.set(this.todayStr); break;
      case 'tomorrow': this.draftDate.set(this.tomorrowStr); break;
      case 'monday':   this.draftDate.set(this.nextMondayStr); break;
      case 'evening':  this.draftDate.set(this.todayStr); this.draftTime.set('18:00'); break;
    }
    const d = new Date(this.draftDate() + 'T00:00:00');
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }

  resetDraftTime(): void { this.draftTime.set(this.time.plusMinutes(5).time); }

  async chooseOffset(): Promise<void> {
    const sheet = await this.sheetCtrl.create({
      header: 'Remind me',
      buttons: [
        ...OFFSET_OPTIONS.map(o => ({ text: o.label, data: o.value })),
        { text: 'Cancel', role: 'cancel' as const },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss();
    if (data !== undefined && data !== null) this.draftOffset.set(data);
  }

  async chooseRepeat(): Promise<void> {
    const sheet = await this.sheetCtrl.create({
      header: 'Repeat',
      buttons: [
        ...REPEAT_OPTIONS.map(o => ({ text: o.label, data: o.value })),
        { text: 'Cancel', role: 'cancel' as const },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss();
    if (data) this.draftRepeat.set(data);
  }

  offsetLabel(v: number): string {
    return OFFSET_OPTIONS.find(o => o.value === v)?.label ?? `${v} min before`;
  }
  repeatLabel(v: RepeatType): string {
    return REPEAT_OPTIONS.find(o => o.value === v)?.label ?? 'None';
  }
  durationLabel(v: number | null): string {
    if (v === null) return 'Not set';
    return DURATION_OPTIONS.find(o => o.value === v)?.label ?? `${v} min`;
  }

  // ── Clock picker ──────────────────────────────────────────────────────
  openClock(target: 'main' | 'sheet'): void {
    this.clockTarget = target;
    const t = target === 'sheet' ? this.draftTime() : this.timeVal();
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

  // Type any hour/minute directly in the big display — lets you pick minutes
  // the 5-step dial skips (e.g. :07).
  setClockHour(e: Event): void {
    const el = e.target as HTMLInputElement;
    let h = parseInt(el.value, 10);
    if (isNaN(h)) h = this.clockH12();
    h = Math.min(12, Math.max(1, h));
    this.clockH12.set(h);
    el.value = String(h);
  }

  setClockMinute(e: Event): void {
    const el = e.target as HTMLInputElement;
    let m = parseInt(el.value, 10);
    if (isNaN(m)) m = this.clockMin();
    m = Math.min(59, Math.max(0, m));
    this.clockMin.set(m);
    el.value = this.pad(m);
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
      this.timeVal.set(t);
      this.quickSel.set(null);
    }
    this.clockOpen.set(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);

    const cat = this.allCategories().find(c => c.key === this.selectedCat());
    const fireAt = new Date(`${this.dateVal()}T${this.timeVal()}:00`);
    const notifyAt = new Date(fireAt.getTime() - this.offsetMin() * 60_000);

    const dto: CreateReminderDto = {
      title:                 this.titleVal().trim(),
      type:                  cat?.type ?? 'personal',
      date:                  this.dateVal(),
      time:                  this.timeVal(),
      repeatType:            this.repeatVal(),
      priority:              'medium',
      reminderWindowMinutes: this.offsetMin(),
      durationMinutes:       this.duration() ?? undefined,
      notificationTypes:     [this.notifType() === 'alarm' ? 'alarm' : 'push'],
      assignedTo:            this.forSelf() ? undefined : this.selectedFriend() ?? undefined,
      nextFireAt:            notifyAt.toISOString(),
    };

    this.svc.create(dto).subscribe({
      next: async () => {
        // The list page is kept alive by ion-tabs, so a calendar-day the user
        // tapped earlier would still be selected and hide this new reminder.
        // Hand off its day + tab so the list focuses it and it's visible.
        this.svc.setPendingRevealDate(this.dateVal(), this.forSelf() ? 'mine' : 'shared');
        if (this.notifType() === 'alarm') {
          try {
            await this.alarmSvc.scheduleAt(
              Math.floor(Date.now() / 1000) % 2_000_000_000,
              dto.title,
              notifyAt,
            );
          } catch { /* permission denied — server record still exists */ }
        }
        this.saving.set(false);
        const friendName = this.friends().find(f => f._id === this.selectedFriend())?.name;
        const t = await this.toast.create({
          message: this.forSelf() ? 'Reminder set!' : `Assigned to ${friendName ?? 'friend'}!`,
          duration: 1800, color: 'success', position: 'top',
        });
        await t.present();
        if (this.returnToFriendId && dto.assignedTo === this.returnToFriendId) {
          // The activity page is kept alive; tell it to refresh + reveal the
          // Reminders tab so the just-assigned reminder is visible on return.
          this.friendSvc.setPendingActivityReveal(this.returnToFriendId, 'reminder');
          this.router.navigate(['/app/friends', this.returnToFriendId, 'activity']);
        } else {
          this.router.navigate(['/app/reminders']);
        }
      },
      error: async () => {
        this.saving.set(false);
        const t = await this.toast.create({ message: 'Failed to save', duration: 2000, color: 'danger', position: 'top' });
        await t.present();
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  pad(n: number): string { return String(n).padStart(2, '0'); }

  private timeLabel(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${this.pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  private computeNextMonday(): string {
    const d = this.time.now();
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
