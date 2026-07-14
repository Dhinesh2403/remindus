// src/app/reminders/list/reminder-list.component.ts
import { Component, inject, OnInit, signal, computed, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonIcon,
  IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem,
  IonSkeletonText,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, checkmarkCircleOutline, timeOutline,
  trashOutline, personOutline, arrowDownOutline,
  playSkipForwardOutline, syncOutline, eyeOutline,
  paperPlaneOutline, downloadOutline,
} from 'ionicons/icons';
import {
  ReminderService, Reminder, ReceivedReminder,
  ReminderType, AssignedUser,
} from '../../core/services/reminder.service';
import { TimeAmPmPipe } from '../../core/pipes/time-ampm.pipe';
import { CountUpDirective } from '../../core/directives/count-up.directive';

const CATEGORY_META: Record<ReminderType, { emoji: string; color: string; label: string }> = {
  birthday: { emoji: '🎂', color: '#EC4899', label: 'Birthday' },
  wedding:  { emoji: '💍', color: '#8B5CF6', label: 'Wedding' },
  medicine: { emoji: '💊', color: '#EF4444', label: 'Medicine' },
  bill:     { emoji: '💰', color: '#3B82F6', label: 'Bill' },
  study:    { emoji: '📚', color: '#10B981', label: 'Study' },
  work:     { emoji: '💼', color: '#F59E0B', label: 'Work' },
  general:  { emoji: '📌', color: '#6B7280', label: 'General' },
  custom:   { emoji: '✨', color: '#3D5AF1', label: 'Custom' },
  personal: { emoji: '👤', color: '#3D5AF1', label: 'Personal' },
  health:   { emoji: '❤️', color: '#10B981', label: 'Health' },
  finance:  { emoji: '💵', color: '#F97316', label: 'Finance' },
  family:   { emoji: '👨‍👩‍👧', color: '#EF4444', label: 'Family' },
  travel:   { emoji: '✈️', color: '#8B5CF6', label: 'Travel' },
  shopping: { emoji: '🛒', color: '#14B8A6', label: 'Shopping' },
};

const REMINDER_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: '#F59E0B' },
  done:     { label: 'Done',     color: '#10B981' },
  snoozed:  { label: 'Snoozed',  color: '#3B82F6' },
  missed:   { label: 'Missed',   color: '#EF4444' },
};

const SHARED_STATUS_META: Record<string, { label: string; color: string }> = {
  sent:         { label: 'Sent',         color: '#3B82F6' },
  received:     { label: 'Received',     color: '#F59E0B' },
  acknowledged: { label: 'Acknowledged', color: '#06B6D4' },
  processing:   { label: 'Processing',   color: '#8B5CF6' },
  skipped:      { label: 'Skipped',      color: '#9CA3AF' },
  completed:    { label: 'Completed',    color: '#10B981' },
};

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonIcon,
    IonRefresher, IonRefresherContent,
    IonItemSliding, IonItemOptions, IonItemOption, IonItem,
    IonSkeletonText,
    TimeAmPmPipe, CountUpDirective,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="rem-header" [class.pg-in]="pageIn()">
          <div class="rem-header-top a-fd">
            <div class="rem-header-meta">
              <div class="rem-title">Reminders</div>
              <div class="rem-sub">{{ totalCount() }} reminders · {{ donePct() }}% done</div>
            </div>
            <button class="btn-new rm-press" (click)="router.navigate(['/app/reminders/create'])">
              <ion-icon name="add-outline"></ion-icon>
              New
            </button>
          </div>
          <div class="rem-progress">
            <div class="rem-progress-fill" [style.width.%]="donePct()"></div>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="reminder-content" [class.pg-in]="pageIn()">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Stat cards -->
      <div class="stats-row">
        <div class="stat-card a-pop" [style.--i]="1" (click)="setFilter('active')">
          <div class="stat-num" [rmCountUp]="activeCount()"></div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card a-pop" [style.--i]="2" (click)="setFilter('done')">
          <div class="stat-num stat-green" [rmCountUp]="doneCount()"></div>
          <div class="stat-label">Done</div>
        </div>
        <div class="stat-card stat-alert a-pop" [style.--i]="3" (click)="setFilter('all')">
          <div class="stat-num stat-red" [rmCountUp]="missedCount()"></div>
          <div class="stat-label">Missed</div>
        </div>
      </div>

      <!-- Mine / Shared tabs -->
      <div class="rem-tabs a-fu" [style.--i]="3">
        <button class="rtab" [class.active]="activeTab() === 'mine'" (click)="activeTab.set('mine')">
          Mine
          @if (mineActiveTotal() > 0) { <span class="rtab-badge">{{ mineActiveTotal() }}</span> }
        </button>
        <button class="rtab" [class.active]="activeTab() === 'shared'" (click)="activeTab.set('shared')">
          Shared
          @if (sharedActiveTotal() > 0) { <span class="rtab-badge">{{ sharedActiveTotal() }}</span> }
        </button>
      </div>

      <!-- Status filter chips -->
      <div class="filter-row a-fu" [style.--i]="4">
        <button class="filter-chip" [class.active]="statusFilter() === 'all'"    (click)="setFilter('all')">All ({{ totalCount() }})</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'active'" (click)="setFilter('active')">Active ({{ activeCount() }})</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'done'"   (click)="setFilter('done')">Done ({{ doneCount() }})</button>
      </div>

      <!-- Calendar date strip -->
      <div class="cal-row a-fu" [style.--i]="4">
        <button class="cal-pick rm-press" [class.active]="!!selectedDate()" (click)="openCalSheet()" aria-label="Pick a date">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="cal-strip" #calStrip>
          @for (day of calendarDays(); track day.dateStr) {
            <div
              class="cal-day rm-press"
              [attr.data-date]="day.dateStr"
              [class.cal-today]="day.isToday"
              [class.cal-selected]="day.dateStr === selectedDate()"
              (click)="toggleDay(day.dateStr)"
            >
              <span class="cal-weekday">{{ day.weekday }}</span>
              <span class="cal-num">{{ day.num }}</span>
              @if (day.hasMissed) {
                <span class="cal-dot dot-missed"></span>
              } @else if (day.hasPending) {
                <span class="cal-dot dot-pending"></span>
              } @else if (day.hasDone) {
                <span class="cal-dot dot-done"></span>
              }
            </div>
          }
        </div>
      </div>

      <!-- Skeleton — only on very first load -->
      @if (isLoading()) {
        <div class="list-body">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-card">
              <ion-skeleton-text animated style="width:44px;height:44px;border-radius:14px;flex-shrink:0"></ion-skeleton-text>
              <div style="flex:1;padding-left:12px">
                <ion-skeleton-text animated style="width:70%;height:16px;margin-bottom:8px;border-radius:4px"></ion-skeleton-text>
                <ion-skeleton-text animated style="width:45%;height:12px;border-radius:4px"></ion-skeleton-text>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="list-body">

          <!-- ── Mine tab: own reminders ── -->
          @if (activeTab() === 'mine' && mine().length > 0) {
            @for (r of mine(); track r._id) {
              <ion-item-sliding class="a-fu" [style.--i]="$index + 6">

                <ion-item-options side="start">
                  <ion-item-option color="success" expandable (click)="markDone(r)">
                    <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card"
                    [class.done-card]="r.status === 'done'"
                    [class.missed-card]="r.status === 'missed'"
                    [style.border-left-color]="meta(r.type).color"
                    (click)="openDetail(r._id)"
                  >
                    <div class="card-row">
                      <button class="card-check" [class.checked]="r.status === 'done'"
                        [style.border-color]="r.status === 'done' ? meta(r.type).color : ''"
                        [style.background]="r.status === 'done' ? meta(r.type).color : ''"
                        (click)="r.status !== 'done' && markDone(r); $event.stopPropagation()">
                        @if (r.status === 'done') {
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        }
                      </button>
                      <div class="card-mid">
                        <div class="card-title" [class.done-text]="r.status === 'done'">{{ r.title }}</div>
                        <div class="card-cat" [style.color]="meta(r.type).color">{{ meta(r.type).emoji }} {{ meta(r.type).label }}</div>
                        @if (r.description) {
                          <div class="card-desc">{{ r.description }}</div>
                        }
                        <div class="chip-row">
                          <span class="meta-chip" [class.chip-today]="isToday(r.date) && r.status !== 'done'">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            {{ isToday(r.date) ? 'Today' : dateNum(r.date) + ' ' + dateMon(r.date) }}
                          </span>
                          <span class="meta-chip">
                            <ion-icon name="time-outline"></ion-icon>
                            {{ r.time | timeAmPm }}
                          </span>
                          <span
                            class="status-badge"
                            [style.background]="reminderStatusMeta(r.status).color + '22'"
                            [style.color]="reminderStatusMeta(r.status).color"
                          >{{ reminderStatusMeta(r.status).label }}</span>
                        </div>
                      </div>
                      <div class="card-chevron">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                      </div>
                    </div>
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="danger" expandable (click)="confirmDelete(r)">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- ── Shared tab: Sent / From sub-toggle ── -->
          @if (activeTab() === 'shared') {
            <div class="shared-seg a-fu" [style.--i]="5">
              <button type="button" class="sseg-btn sent" [class.active]="sharedSub() === 'sent'" (click)="sharedSub.set('sent')">
                <ion-icon name="paper-plane-outline"></ion-icon>
                <span class="sseg-label">Sent</span>
                @if (sentToFriends().length > 0) { <span class="sseg-badge">{{ sentToFriends().length }}</span> }
              </button>
              <button type="button" class="sseg-btn from" [class.active]="sharedSub() === 'from'" (click)="sharedSub.set('from')">
                <ion-icon name="download-outline"></ion-icon>
                <span class="sseg-label">From</span>
                @if (fromFriends().length > 0) { <span class="sseg-badge">{{ fromFriends().length }}</span> }
              </button>
            </div>
          }

          <!-- ── Shared tab: sent to friends ── -->
          @if (activeTab() === 'shared' && sharedSub() === 'sent' && sentToFriends().length > 0) {
            @for (r of sentToFriends(); track r._id) {
              <ion-item-sliding class="a-fu" [style.--i]="$index + 6">

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card friend-card"
                    [style.border-left-color]="meta(r.type).color"
                    (click)="openDetail(r._id)"
                  >
                    <div class="card-row">
                      <div class="card-avatar" [style.background]="meta(r.type).color + '22'">
                        <span>{{ meta(r.type).emoji }}</span>
                      </div>
                      <div class="card-mid">
                        <div class="card-title">{{ r.title }}</div>
                        <div class="friend-row">
                          <ion-icon name="person-outline"></ion-icon>
                          <span class="friend-name">{{ assignedName(r) }}</span>
                        </div>
                        <div class="chip-row">
                          <span class="meta-chip" [class.chip-today]="isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped'">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            {{ isToday(r.date) ? 'Today' : dateNum(r.date) + ' ' + dateMon(r.date) }}
                          </span>
                          <span class="meta-chip">
                            <ion-icon name="time-outline"></ion-icon>
                            {{ r.time | timeAmPm }}
                          </span>
                          <span
                            class="status-badge"
                            [style.background]="sharedStatusMeta(r.sharedStatus).color + '22'"
                            [style.color]="sharedStatusMeta(r.sharedStatus).color"
                          >{{ sharedStatusMeta(r.sharedStatus).label }}</span>
                        </div>
                      </div>
                      <div class="card-chevron">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                      </div>
                    </div>
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="danger" expandable (click)="confirmDelete(r)">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- ── Shared tab: from friends ── -->
          @if (activeTab() === 'shared' && sharedSub() === 'from' && fromFriends().length > 0) {
            @for (r of fromFriends(); track r._id) {
              <ion-item-sliding class="a-fu" [style.--i]="$index + 6">

                <ion-item-options side="start">
                  <ion-item-option color="success" expandable (click)="completeReceived(r)">
                    <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

                <ion-item lines="none" class="slide-item">
                  <div
                    class="rem-card from-card"
                    [class.done-card]="r.sharedStatus === 'completed'"
                    [style.border-left-color]="meta(r.type).color"
                    (click)="openDetail(r._id)"
                  >
                    <div class="card-row">
                      <button class="card-check" [class.checked]="r.sharedStatus === 'completed'"
                        [style.border-color]="r.sharedStatus === 'completed' ? meta(r.type).color : ''"
                        [style.background]="r.sharedStatus === 'completed' ? meta(r.type).color : ''"
                        (click)="r.sharedStatus !== 'completed' && completeReceived(r); $event.stopPropagation()">
                        @if (r.sharedStatus === 'completed') {
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        }
                      </button>
                      <div class="card-mid">
                        <div class="card-title" [class.done-text]="r.sharedStatus === 'completed'">{{ r.title }}</div>
                        <div class="friend-row from-friend-row">
                          <ion-icon name="person-outline"></ion-icon>
                          <span class="friend-name">{{ r.userId.name }}</span>
                        </div>
                        @if (r.description) {
                          <div class="card-desc">{{ r.description }}</div>
                        }
                        <div class="chip-row">
                          <span class="meta-chip" [class.chip-today]="isToday(r.date) && r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped'">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            {{ isToday(r.date) ? 'Today' : dateNum(r.date) + ' ' + dateMon(r.date) }}
                          </span>
                          <span class="meta-chip">
                            <ion-icon name="time-outline"></ion-icon>
                            {{ r.time | timeAmPm }}
                          </span>
                          <span
                            class="status-badge"
                            [style.background]="sharedStatusMeta(r.sharedStatus).color + '22'"
                            [style.color]="sharedStatusMeta(r.sharedStatus).color"
                          >{{ sharedStatusMeta(r.sharedStatus).label }}</span>
                        </div>
                      </div>
                    </div>
                    @if (r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped') {
                      <div class="from-action-strip" (click)="$event.stopPropagation()">
                        <button class="fas-btn fas-update rm-press" (click)="changeReceivedStatus(r)">
                          <ion-icon name="sync-outline"></ion-icon>
                          Update status
                        </button>
                      </div>
                    }
                  </div>
                </ion-item>

                <ion-item-options side="end">
                  <ion-item-option color="warning" expandable (click)="skipReceived(r)">
                    <ion-icon slot="icon-only" name="play-skip-forward-outline"></ion-icon>
                  </ion-item-option>
                </ion-item-options>

              </ion-item-sliding>
            }
          }

          <!-- Empty states (per tab) -->
          @if (activeTab() === 'mine' && mine().length === 0) {
            <div class="empty-state a-fu" [style.--i]="5">
              <div class="empty-emoji">🔔</div>
              <h3>{{ selectedDate() ? 'No reminders on this day' : 'No reminders yet' }}</h3>
              <p>{{ selectedDate() ? 'Try another date or tap +' : 'Tap + to create your first reminder' }}</p>
            </div>
          }
          @if (activeTab() === 'shared' && sharedSub() === 'sent' && sentToFriends().length === 0) {
            <div class="empty-state a-fu" [style.--i]="6">
              <div class="empty-emoji">📤</div>
              <h3>Nothing sent yet</h3>
              <p>{{ selectedDate() ? 'Nothing sent on this day' : 'Reminders you assign to friends show up here' }}</p>
            </div>
          }
          @if (activeTab() === 'shared' && sharedSub() === 'from' && fromFriends().length === 0) {
            <div class="empty-state a-fu" [style.--i]="6">
              <div class="empty-emoji">📥</div>
              <h3>Nothing from friends</h3>
              <p>{{ selectedDate() ? 'Nothing received on this day' : 'Reminders friends assign to you show up here' }}</p>
            </div>
          }

        </div>
      }

      <!-- ══ Jump-to-date sheet (month grid, same pattern as create) ══ -->
      @if (calSheetOpen()) {
        <div class="ds-backdrop" (click)="calSheetOpen.set(false)"></div>
        <div class="ds-sheet">
          <div class="ds-head">
            <button class="ds-x rm-press" (click)="calSheetOpen.set(false)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            </button>
            <span class="ds-title">Jump to date</span>
            @if (selectedDate()) {
              <button class="ds-clear rm-press" (click)="clearDateFilter()">Clear</button>
            } @else {
              <span class="ds-clear-ph"></span>
            }
          </div>
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
            @for (cell of monthCells(); track $index) {
              @if (!cell) {
                <span class="ds-cell blank"></span>
              } @else {
                <button class="ds-cell rm-press"
                  [class.sel]="cell.dateStr === selectedDate()"
                  [class.today]="cell.dateStr === todayDateStr"
                  (click)="pickDate(cell.dateStr)">
                  {{ cell.num }}
                  @if (cell.dot) { <span class="ds-cell-dot" [style.background]="cell.dot"></span> }
                </button>
              }
            }
          </div>
        </div>
      }

      <!-- ══ Received-status sheet (notes-page style bottom sheet) ══ -->
      @if (statusSheetFor(); as r) {
        <div class="opts-scrim" (click)="statusSheetFor.set(null)">
          <div class="opts-sheet" (click)="$event.stopPropagation()">
            <div class="opts-grip"></div>
            <div class="opts-head">
              <div class="opts-title">{{ r.title }}</div>
              <div class="opts-sub">Update your status on this reminder</div>
            </div>
            @for (opt of statusOptions; track opt.value) {
              <button class="opt-row rm-press" (click)="pickReceivedStatus(r, opt.value)">
                <ion-icon [name]="opt.icon"></ion-icon>
                <span class="opt-label">{{ opt.label }}</span>
              </button>
            }
          </div>
        </div>
      }

    </ion-content>
  `,
  styles: [`
    .reminder-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); --color: var(--rm-text-primary); }

    /* ── Header ── */
    .rem-header { padding: 18px 16px 14px; }
    .rem-header-top { display: flex; align-items: flex-start; justify-content: space-between; }
    .rem-title { font-size: 28px; font-weight: 900; color: var(--rm-text-primary); letter-spacing: -0.4px; }
    .rem-sub { font-size: 12.5px; font-weight: 600; color: var(--rm-text-muted); margin-top: 3px; }
    .btn-new {
      display: flex; align-items: center; gap: 6px;
      padding: 12px 22px; background: var(--rm-purple); color: #fff;
      border: none; border-radius: 14px; font-size: 15.5px; font-weight: 800;
      cursor: pointer; font-family: inherit;
      box-shadow: 0 6px 16px rgba(61,90,241,0.35);
    }
    .btn-new ion-icon { font-size: 20px; }
    .rem-progress { height: 5px; background: var(--rm-surface); border-radius: 3px; margin-top: 12px; overflow: hidden; }
    .rem-progress-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #3D5AF1, #5B7CFF);
      transition: width .6s var(--rm-ease-out);
      animation: barGrow .9s var(--rm-ease-out) .2s backwards;
    }
    @keyframes barGrow { from { width: 0; } }

    /* ── Stat cards ── */
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; padding: 12px 16px 0; }
    .stat-card {
      background: var(--rm-card); border-radius: 14px; padding: 9px 12px;
      box-shadow: var(--rm-shadow-sm); cursor: pointer;
      border: 1px solid var(--rm-border);
    }
    .stat-card.stat-alert { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); }
    .stat-num { font-size: 19px; font-weight: 900; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .stat-green { color: #10B981; }
    .stat-red { color: #EF4444; }
    .stat-label { font-size: 10.5px; font-weight: 600; color: var(--rm-text-muted); margin-top: 1px; }

    /* ── Mine / Shared tabs ── */
    .rem-tabs { display: flex; gap: 6px; margin: 12px 16px 0; background: var(--rm-surface); border-radius: 14px; padding: 4px; }
    .rtab {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: none; background: none; color: var(--rm-text-secondary);
      font-size: 13px; font-weight: 700; padding: 9px 0; border-radius: 10px;
      cursor: pointer; font-family: inherit;
      transition: background .22s, color .22s, box-shadow .22s;
    }
    .rtab.active { background: var(--rm-card); color: var(--rm-purple); box-shadow: var(--rm-shadow-sm); }
    .rtab-badge {
      min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
      background: var(--rm-purple); color: #fff; font-size: 10px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center;
    }

    /* ── Filter chips ── */
    .filter-row { display: flex; gap: 8px; padding: 12px 16px 0; }
    .filter-chip {
      padding: 8px 15px; border: none; border-radius: 20px;
      background: var(--rm-surface); color: var(--rm-text-secondary);
      font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background .25s, color .25s, box-shadow .25s, transform .2s var(--rm-ease-spring);
    }
    .filter-chip:active { transform: scale(0.94); }
    .filter-chip.active { background: var(--rm-purple); color: #fff; box-shadow: 0 4px 12px rgba(61,90,241,0.3); }

    /* ── Calendar strip ── */
    .cal-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 0 4px 16px;
    }
    .cal-pick {
      flex-shrink: 0;
      width: 42px; height: 54px;
      border: none; border-radius: 14px;
      background: var(--rm-surface); color: var(--rm-text-secondary);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background .2s, color .2s, box-shadow .2s;
    }
    .cal-pick.active { background: var(--rm-purple); color: #fff; box-shadow: 0 4px 14px rgba(61,90,241,0.35); }
    .cal-strip {
      flex: 1;
      position: relative;
      display: flex;
      gap: 6px;
      padding: 0 16px 0 4px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .cal-strip::-webkit-scrollbar { display: none; }
    .cal-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 46px;
      padding: 8px 6px 6px;
      border-radius: 14px;
      cursor: pointer;
      gap: 3px;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .cal-weekday { font-size: 10px; font-weight: 600; color: var(--rm-text-muted); text-transform: uppercase; }
    .cal-num { font-size: 18px; font-weight: 800; color: var(--rm-text-primary); line-height: 1.1; }
    .cal-today .cal-num { color: var(--rm-purple); }
    .cal-today .cal-weekday { color: var(--rm-purple); }
    .cal-selected { background: var(--rm-purple); box-shadow: 0 4px 14px rgba(61,90,241,0.35); }
    .cal-selected .cal-weekday, .cal-selected .cal-num { color: #fff !important; }
    .cal-dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot-missed  { background: #EF4444; }
    .dot-pending { background: #F97316; }
    .dot-done    { background: #10B981; }
    .cal-selected .cal-dot { opacity: 0.85; }

    /* ══ Jump-to-date sheet ══ */
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
    .ds-head { display: flex; align-items: center; margin-bottom: 10px; }
    .ds-x {
      width: 34px; height: 34px; border: none; background: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; padding: 0;
      color: var(--rm-text-primary);
    }
    .ds-title { flex: 1; text-align: center; font-size: 14.5px; font-weight: 800; color: var(--rm-text-primary); }
    .ds-clear {
      border: none; background: none; cursor: pointer; font-family: inherit;
      font-size: 12.5px; font-weight: 800; color: var(--rm-purple); padding: 6px 2px;
      min-width: 40px; text-align: right;
    }
    .ds-clear-ph { min-width: 40px; }
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
    .ds-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; }
    .ds-cell {
      position: relative;
      height: 38px; border: none; background: none; cursor: pointer; font-family: inherit;
      font-size: 13.5px; font-weight: 700; color: var(--rm-text-primary);
      border-radius: 50%; width: 38px; justify-self: center;
      display: flex; align-items: center; justify-content: center;
    }
    .ds-cell.blank { cursor: default; }
    .ds-cell.today { box-shadow: inset 0 0 0 1.5px var(--rm-purple); color: var(--rm-purple); }
    .ds-cell.sel { background: var(--rm-purple); color: #fff; box-shadow: 0 4px 12px rgba(61,90,241,.4); }
    .ds-cell-dot { position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 50%; }
    .ds-cell.sel .ds-cell-dot { background: #fff !important; opacity: .85; }

    /* ── List body ── */
    .list-body { padding: 12px 16px 130px; display: flex; flex-direction: column; gap: 8px; }
    /* ── Shared sub-toggle: Sent / From segmented control ── */
    .shared-seg {
      display: flex;
      gap: 6px;
      padding: 5px;
      border-radius: 15px;
      background: var(--rm-surface);
      border: 1px solid var(--rm-border);
      margin-bottom: 4px;
    }
    .sseg-btn {
      flex: 1;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px 6px;
      border: none; border-radius: 11px;
      background: transparent;
      font-family: inherit; font-size: 13px; font-weight: 700;
      color: var(--rm-text-muted); cursor: pointer;
      transition: background .2s, color .2s, box-shadow .2s;
    }
    .sseg-btn ion-icon { font-size: 16px; }
    .sseg-btn:active { transform: scale(0.97); }
    .sseg-badge {
      min-width: 18px; height: 18px; padding: 0 5px;
      border-radius: 9px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800;
      background: var(--rm-border); color: var(--rm-text-secondary);
    }
    /* Sent → outgoing, brand blue */
    .sseg-btn.sent.active {
      background: var(--rm-purple); color: #fff;
      box-shadow: 0 4px 12px rgba(61,90,241,.35);
    }
    .sseg-btn.sent.active .sseg-badge { background: rgba(255,255,255,.28); color: #fff; }
    /* From → incoming, green */
    .sseg-btn.from.active {
      background: #10B981; color: #fff;
      box-shadow: 0 4px 12px rgba(16,185,129,.35);
    }
    .sseg-btn.from.active .sseg-badge { background: rgba(255,255,255,.28); color: #fff; }

    /* ── Cards ── */
    .slide-item { --padding-start: 0; --inner-padding-end: 0; --background: transparent; }
    .rem-card {
      background: var(--rm-card);
      border-radius: 18px;
      padding: 14px;
      box-shadow: var(--rm-shadow-sm);
      border-left: 4px solid var(--rm-border);
      width: 100%;
      cursor: pointer;
      transition: transform .2s var(--rm-ease-spring), box-shadow .2s;
    }
    .rem-card:active { transform: scale(0.98); }
    .done-card   { opacity: 0.55; }
    .missed-card { opacity: 0.7; }
    .friend-card {
      border-left-style: dashed;
      background: linear-gradient(90deg, rgba(61,90,241,0.06), var(--rm-card) 60%);
    }
    .from-card {
      border-left-style: solid;
      background: linear-gradient(90deg, rgba(16,185,129,0.06), var(--rm-card) 60%);
    }

    .card-row { display: flex; align-items: flex-start; gap: 12px; }
    .card-mid { flex: 1; min-width: 0; }
    .card-title { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .done-text { text-decoration: line-through; color: var(--rm-text-muted); }
    .card-cat { font-size: 12px; font-weight: 600; margin-top: 2px; }
    .card-desc { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .friend-row { display: flex; align-items: center; gap: 3px; margin-top: 3px; color: var(--rm-purple); }
    .from-friend-row { color: #10B981; }
    .friend-name { font-size: 12px; font-weight: 600; }
    .friend-row ion-icon { font-size: 12px; }

    /* ── Checkbox circle ── */
    .card-check {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid var(--rm-border); background: transparent;
      flex-shrink: 0; margin-top: 2px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; padding: 0;
      transition: background .2s, border-color .2s, transform .25s var(--rm-ease-spring);
    }
    .card-check:active { transform: scale(0.85); }
    .card-check.checked { animation: checkPop .35s var(--rm-ease-spring); }
    @keyframes checkPop { 0% { transform: scale(.6); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }

    /* ── Emoji avatar (sent-to-friends) ── */
    .card-avatar {
      width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }

    /* ── Meta chips ── */
    .chip-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border-radius: 9px;
      background: var(--rm-surface); border: 1px solid var(--rm-border);
      font-size: 11px; font-weight: 600; color: var(--rm-text-secondary);
      white-space: nowrap;
    }
    .meta-chip ion-icon { font-size: 12px; }
    .meta-chip.chip-today { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); color: #EF4444; }
    .status-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 9px;
      white-space: nowrap;
      text-align: center;
    }
    .card-chevron { flex-shrink: 0; color: var(--rm-text-muted); align-self: center; }

    .from-action-strip { margin-top:10px; border-top:1px solid var(--rm-border); padding-top:10px; }
    .fas-btn {
      display:inline-flex; align-items:center; justify-content:center; gap:6px;
      width:100%; padding:9px 4px; border:none; border-radius:10px;
      font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit;
    }
    .fas-btn ion-icon { font-size:15px; }
    .fas-update { background:rgba(61,90,241,0.12); color:var(--rm-purple); }

    /* ══ Received-status bottom sheet (matches notes-page opts-sheet) ══ */
    @keyframes optsFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes optsUp   { from { transform: translateY(100%); } to { transform: none; } }
    .opts-scrim {
      position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45);
      display: flex; align-items: flex-end; animation: optsFade .2s ease both;
    }
    .opts-sheet {
      width: 100%; background: var(--rm-card); border-radius: 22px 22px 0 0;
      padding: 6px 8px calc(env(safe-area-inset-bottom) + 14px);
      animation: optsUp .28s cubic-bezier(.32,.72,0,1) both;
    }
    .opts-grip { width: 40px; height: 4px; border-radius: 2px; background: var(--rm-border); margin: 8px auto 6px; }
    .opts-head { padding: 4px 18px 10px; text-align: center; }
    .opts-title { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); }
    .opts-sub { font-size: 12.5px; font-weight: 600; color: var(--rm-text-muted); margin-top: 2px; }
    .opt-row {
      display: flex; align-items: center; gap: 16px; width: 100%;
      border: none; background: none; padding: 15px 18px; border-radius: 14px;
      cursor: pointer; text-align: left; color: var(--rm-text-primary); font-family: inherit;
    }
    .opt-row:active { background: var(--rm-surface); }
    .opt-row ion-icon { font-size: 22px; color: var(--rm-text-secondary); flex: none; }
    .opt-label { font-size: 16px; font-weight: 600; }
    @media (prefers-reduced-motion: reduce) { .opts-scrim, .opts-sheet { animation: none; } }

    /* ── Skeleton ── */
    .skeleton-card { display: flex; align-items: center; padding: 14px; background: var(--rm-card); border-radius: 18px; }

    /* ── Empty ── */
    .empty-state { text-align: center; padding: 70px 32px; }
    .empty-emoji { font-size: 56px; margin-bottom: 12px; }
    .empty-state h3 { font-size: 17px; font-weight: 700; color: var(--rm-text-primary); margin-bottom: 6px; }
    .empty-state p { font-size: 13px; color: var(--rm-text-muted); }

    /* ── Extended FAB ── */
    .rem-fab {
      position: fixed;
      bottom: calc(76px + env(safe-area-inset-bottom));
      right: 18px;
      height: 52px;
      display: flex; align-items: center; gap: 8px;
      padding: 0 20px;
      border: none; border-radius: 26px;
      background: linear-gradient(145deg, #5B7CFF, #3D5AF1 55%, #2A3FCC);
      color: #fff; font-size: 14px; font-weight: 700; font-family: inherit;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(61,90,241,0.45), 0 2px 6px rgba(61,90,241,0.3);
      z-index: 100;
    }
  `],
})
export class ReminderListComponent implements OnInit {
  protected router = inject(Router);
  private reminderService     = inject(ReminderService);
  private alertCtrl           = inject(AlertController);
  private toastCtrl           = inject(ToastController);

  isLoading = signal(true);
  selectedDate = signal<string>('');
  statusFilter = signal<'all' | 'active' | 'done'>('all');
  activeTab = signal<'mine' | 'shared'>('mine');
  /** Within the Shared tab: whether to show reminders sent-to or received-from friends. */
  sharedSub = signal<'sent' | 'from'>('sent');

  // Received reminder whose status sheet is currently open (null = closed)
  readonly statusSheetFor = signal<ReceivedReminder | null>(null);
  readonly statusOptions = [
    { label: 'Acknowledged', icon: 'eye-outline',              value: 'acknowledged' },
    { label: 'In Progress',  icon: 'sync-outline',             value: 'processing'   },
    { label: 'Completed',    icon: 'checkmark-circle-outline', value: 'completed'    },
    { label: 'Skip',         icon: 'play-skip-forward-outline', value: 'skipped'     },
  ];

  // Replays entrance animations on every tab visit (see .pg-in in global.scss)
  readonly pageIn = signal(true);

  readonly reminders         = this.reminderService.reminders;
  readonly receivedReminders = this.reminderService.receivedReminders;

  setFilter(f: 'all' | 'active' | 'done'): void { this.statusFilter.set(f); }

  private ownMatchesFilter(r: Reminder): boolean {
    switch (this.statusFilter()) {
      case 'active': return r.status === 'pending' || r.status === 'snoozed';
      case 'done':   return r.status === 'done';
      default:       return true;
    }
  }

  private receivedMatchesFilter(r: ReceivedReminder): boolean {
    const done = r.sharedStatus === 'completed';
    switch (this.statusFilter()) {
      case 'active': return !done && r.sharedStatus !== 'skipped';
      case 'done':   return done;
      default:       return true;
    }
  }

  // ── Header / stat counts (date-filtered, so they follow the strip) ──
  readonly totalCount = computed(() =>
    this.filteredOwn().length + this.filteredReceived().length
  );
  readonly activeCount = computed(() =>
    this.filteredOwn().filter(r => r.status === 'pending' || r.status === 'snoozed').length +
    this.filteredReceived().filter(r => r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped').length
  );
  readonly doneCount = computed(() =>
    this.filteredOwn().filter(r => r.status === 'done').length +
    this.filteredReceived().filter(r => r.sharedStatus === 'completed').length
  );
  readonly missedCount = computed(() =>
    this.filteredOwn().filter(r => r.status === 'missed').length
  );
  readonly donePct = computed(() => {
    const total = this.totalCount();
    return total ? Math.round((this.doneCount() / total) * 100) : 0;
  });

  // Per-day rollup of reminder statuses — shared by the strip and the month sheet
  private readonly dayStatusMap = computed(() => {
    const map = new Map<string, { missed: boolean; pending: boolean; done: boolean }>();
    for (const r of [...this.reminders(), ...this.receivedReminders()]) {
      const key = this.localDateStr(new Date(r.date));
      const day = map.get(key) ?? { missed: false, pending: false, done: false };
      if (r.status === 'missed') day.missed = true;
      else if (r.status === 'pending' || r.status === 'snoozed') day.pending = true;
      else if (r.status === 'done') day.done = true;
      map.set(key, day);
    }
    return map;
  });

  readonly calendarDays = computed(() => {
    const byDay = this.dayStatusMap();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3 days back → 30 ahead, stretched to keep the selected date reachable
    let start = -3, end = 30;
    const sel = this.selectedDate();
    if (sel) {
      const diff = Math.round((new Date(sel + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
      if (diff < start) start = diff;
      if (diff > end)   end   = diff;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + start + i);
      const dateStr = this.localDateStr(d);
      const day     = byDay.get(dateStr);
      return {
        dateStr,
        num:        d.getDate(),
        weekday:    d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        isToday:    dateStr === this.todayDateStr,
        hasMissed:  !!day?.missed,
        hasPending: !!day?.pending,
        hasDone:    !!day?.done,
      };
    });
  });

  private readonly filteredOwn = computed(() => {
    const sel = this.selectedDate();
    const all = this.reminders();
    if (!sel) return all;
    return all.filter(r => this.localDateStr(new Date(r.date)) === sel);
  });

  private readonly filteredReceived = computed(() => {
    const sel = this.selectedDate();
    const all = this.receivedReminders();
    if (!sel) return all;
    return all.filter(r => this.localDateStr(new Date(r.date)) === sel);
  });

  readonly todayDateStr = this.localDateStr(new Date());

  isToday(dateStr: string): boolean {
    return this.localDateStr(new Date(dateStr)) === this.todayDateStr;
  }

  // pending-today → pending-future → missed → done  (within each group: newest createdAt first)
  private sortOwn(items: Reminder[]): Reminder[] {
    return [...items].sort((a, b) => {
      const rank = (r: Reminder) => {
        const active = r.status === 'pending' || r.status === 'snoozed';
        if (active && this.isToday(r.date)) return 0;
        if (active)                           return 1;
        if (r.status === 'missed')            return 2;
        return 3;
      };
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      // Most recently created shows first within each group
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // active (not completed/skipped) → completed/skipped  (within each group: today first, then earliest)
  private sortReceived(items: ReceivedReminder[]): ReceivedReminder[] {
    const DONE = new Set(['completed', 'skipped']);
    return [...items].sort((a, b) => {
      const aDone = DONE.has(a.sharedStatus ?? '');
      const bDone = DONE.has(b.sharedStatus ?? '');
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!aDone) {
        const aToday = this.isToday(a.date), bToday = this.isToday(b.date);
        if (aToday !== bToday) return aToday ? -1 : 1;
      }
      // r.date is a full ISO string (…T00:00:00.000Z); take just the day part
      // so the combined "dayThh:mm" stays a valid parseable local datetime.
      const at = new Date(`${String(a.date).slice(0, 10)}T${a.time}`).getTime();
      const bt = new Date(`${String(b.date).slice(0, 10)}T${b.time}`).getTime();
      return at - bt;
    });
  }

  readonly mine = computed(() =>
    this.sortOwn(this.filteredOwn().filter(r =>
      (!r.assignedTo || typeof r.assignedTo !== 'object') && this.ownMatchesFilter(r)))
  );

  readonly sentToFriends = computed(() =>
    this.sortOwn(this.filteredOwn().filter(r =>
      r.assignedTo && typeof r.assignedTo === 'object' && this.ownMatchesFilter(r)))
  );

  readonly fromFriends = computed(() =>
    this.sortReceived(this.filteredReceived().filter(r => this.receivedMatchesFilter(r)))
  );

  // Active (not-completed) counts — unfiltered by date — drive the tab badges.
  // "Mine" = own reminders not assigned to a friend, still pending/snoozed.
  readonly mineActiveTotal = computed(() =>
    this.reminders().filter(r =>
      (!r.assignedTo || typeof r.assignedTo !== 'object') &&
      (r.status === 'pending' || r.status === 'snoozed')
    ).length
  );

  // "Shared" = reminders sent to friends + received from friends, still active
  // (not completed / skipped).
  readonly sharedActiveTotal = computed(() =>
    this.reminders().filter(r =>
      r.assignedTo && typeof r.assignedTo === 'object' &&
      (r.status === 'pending' || r.status === 'snoozed')
    ).length +
    this.receivedReminders().filter(r =>
      r.sharedStatus !== 'completed' && r.sharedStatus !== 'skipped'
    ).length
  );

  constructor() {
    addIcons({ addOutline, checkmarkCircleOutline, timeOutline, trashOutline, personOutline, arrowDownOutline, playSkipForwardOutline, syncOutline, eyeOutline, paperPlaneOutline, downloadOutline });
  }

  ngOnInit(): void {
    // Skip skeleton when data was already pre-loaded by the main layout
    const hasData = this.reminders().length > 0 || this.receivedReminders().length > 0;
    if (!hasData) this.isLoading.set(true);
    Promise.all([
      this.reminderService.getAll({ limit: 100 }).toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => this.isLoading.set(false));
  }

  // Fires every time this tab is entered — always do a silent background refresh
  ionViewWillEnter(): void {
    this.pageIn.set(true);
    // A reminder was just created — focus its day + tab so it's visible even if
    // a stale calendar-day filter or status filter (this page is kept alive by
    // ion-tabs) would otherwise hide it.
    const reveal = this.reminderService.consumePendingReveal();
    if (reveal !== null) {
      this.selectedDate.set(reveal.date);
      this.statusFilter.set('all');
      this.activeTab.set(reveal.tab);
      // A just-created shared reminder is always one you assigned → the Sent view.
      if (reveal.tab === 'shared') this.sharedSub.set('sent');
      this.scrollStripTo(reveal.date);
    }
    // Arriving from a deep-link (e.g. Home "From Friends" card): open the asked
    // tab and drop any stale date/status filter so all its items are visible.
    const wantTab = this.reminderService.consumePendingTab();
    if (wantTab !== null) {
      this.activeTab.set(wantTab.tab);
      if (wantTab.sub) this.sharedSub.set(wantTab.sub);
      this.statusFilter.set('all');
      this.selectedDate.set('');
    }
    this.reminderService.getAll({ limit: 100 }).subscribe();
    this.reminderService.getReceived().subscribe();
  }

  ionViewDidLeave(): void {
    this.pageIn.set(false);
  }

  doRefresh(event: CustomEvent): void {
    Promise.all([
      this.reminderService.getAll({ limit: 100 }).toPromise(),
      this.reminderService.getReceived().toPromise(),
    ]).finally(() => (event.target as HTMLIonRefresherElement).complete());
  }

  toggleDay(dateStr: string): void {
    this.selectedDate.update(cur => cur === dateStr ? '' : dateStr);
  }

  // ── Jump-to-date sheet ────────────────────────────────────────────────
  private readonly calStripRef = viewChild<ElementRef<HTMLDivElement>>('calStrip');

  readonly calSheetOpen = signal(false);
  readonly viewYear  = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  readonly monthCells = computed<({ num: number; dateStr: string; dot: string | null } | null)[]>(() => {
    const y = this.viewYear(), m = this.viewMonth();
    const byDay = this.dayStatusMap();
    const first = new Date(y, m, 1);
    const days  = new Date(y, m + 1, 0).getDate();
    const lead  = (first.getDay() + 6) % 7;               // Monday-first offset
    return [
      ...Array<null>(lead).fill(null),
      ...Array.from({ length: days }, (_, i) => {
        const dateStr = this.localDateStr(new Date(y, m, i + 1));
        const day = byDay.get(dateStr);
        const dot = day?.missed ? '#EF4444' : day?.pending ? '#F97316' : day?.done ? '#10B981' : null;
        return { num: i + 1, dateStr, dot };
      }),
    ];
  });

  openCalSheet(): void {
    const base = this.selectedDate()
      ? new Date(this.selectedDate() + 'T00:00:00')
      : new Date();
    this.viewYear.set(base.getFullYear());
    this.viewMonth.set(base.getMonth());
    this.calSheetOpen.set(true);
  }

  navMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
  }

  pickDate(dateStr: string): void {
    this.toggleDay(dateStr);
    this.calSheetOpen.set(false);
    if (this.selectedDate()) this.scrollStripTo(dateStr);
  }

  // "Clear" resets the picker to today: select it and bring the strip back home
  clearDateFilter(): void {
    this.selectedDate.set(this.todayDateStr);
    this.calSheetOpen.set(false);
    this.scrollStripTo(this.todayDateStr);
  }

  // Center the given day chip in the strip (waits a tick so stretched days render first)
  private scrollStripTo(dateStr: string): void {
    setTimeout(() => {
      const strip = this.calStripRef()?.nativeElement;
      const chip  = strip?.querySelector<HTMLElement>(`[data-date="${dateStr}"]`);
      if (!strip || !chip) return;
      strip.scrollTo({
        left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2,
        behavior: 'smooth',
      });
    }, 80);
  }

  openDetail(id: string): void {
    this.router.navigate(['/app/reminders', id]);
  }

  markDone(r: Reminder): void {
    this.reminderService.markDone(r._id).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `✅ "${r.title}" marked as done!`,
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  completeReceived(r: ReceivedReminder): void {
    this.reminderService.updateSharedStatus(r._id, 'completed').subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `✅ "${r.title}" marked as completed!`,
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  skipReceived(r: ReceivedReminder): void {
    this.reminderService.updateSharedStatus(r._id, 'skipped').subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `⏭️ "${r.title}" skipped.`,
          duration: 2000,
          color: 'warning',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  changeReceivedStatus(r: ReceivedReminder): void {
    this.statusSheetFor.set(r);
  }

  pickReceivedStatus(r: ReceivedReminder, status: string): void {
    this.statusSheetFor.set(null);
    this.reminderService.updateSharedStatus(r._id, status).subscribe();
  }

  async confirmDelete(r: Reminder): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Reminder',
      message: `Delete "${r.title}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.reminderService.delete(r._id).subscribe(),
        },
      ],
    });
    await alert.present();
  }

  meta(type: ReminderType) { return CATEGORY_META[type] ?? CATEGORY_META.general; }

  reminderStatusMeta(status: string) {
    return REMINDER_STATUS_META[status] ?? { label: status, color: '#9CA3AF' };
  }

  sharedStatusMeta(status?: string | null) {
    if (!status) return SHARED_STATUS_META['sent'];
    return SHARED_STATUS_META[status] ?? { label: status, color: '#9CA3AF' };
  }

  assignedName(r: Reminder): string {
    if (r.assignedTo && typeof r.assignedTo === 'object') {
      return (r.assignedTo as AssignedUser).name;
    }
    return 'Friend';
  }

  dateNum(isoDate: string): number {
    return new Date(isoDate).getDate();
  }

  dateMon(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short' });
  }

  private localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
