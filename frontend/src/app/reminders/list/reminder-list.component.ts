// src/app/reminders/list/reminder-list.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonIcon,
  IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem,
  IonSkeletonText,
  AlertController, ToastController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, checkmarkCircleOutline, timeOutline,
  trashOutline, personOutline, arrowDownOutline,
  playSkipForwardOutline,
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

      <!-- Status filter chips -->
      <div class="filter-row a-fu" [style.--i]="3">
        <button class="filter-chip" [class.active]="statusFilter() === 'all'"    (click)="setFilter('all')">All ({{ totalCount() }})</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'active'" (click)="setFilter('active')">Active ({{ activeCount() }})</button>
        <button class="filter-chip" [class.active]="statusFilter() === 'done'"   (click)="setFilter('done')">Done ({{ doneCount() }})</button>
      </div>

      <!-- Calendar date strip -->
      <div class="cal-strip a-fu" [style.--i]="4">
        @for (day of calendarDays(); track day.dateStr) {
          <div
            class="cal-day rm-press"
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

          <!-- ── Mine section ── -->
          @if (mine().length > 0) {
            <div class="section-label a-fu" [style.--i]="5">Mine</div>
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

          <!-- ── Sent to Friends section ── -->
          @if (sentToFriends().length > 0) {
            <div class="section-label a-fu" [style.--i]="5" [style.margin-top]="mine().length > 0 ? '20px' : '0'">
              Sent to Friends
            </div>
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

          <!-- ── From Friends section ── -->
          @if (fromFriends().length > 0) {
            <div class="section-label from-label a-fu" [style.--i]="5"
              [style.margin-top]="(mine().length > 0 || sentToFriends().length > 0) ? '20px' : '0'">
              <ion-icon name="arrow-down-outline" style="font-size:11px;margin-right:4px;vertical-align:middle"></ion-icon>
              From Friends
            </div>
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
                        <button class="fas-btn fas-done rm-press"   (click)="completeReceived(r)">✅ Done</button>
                        <button class="fas-btn fas-update rm-press" (click)="changeReceivedStatus(r)">🔄 Status</button>
                        <button class="fas-btn fas-skip rm-press"   (click)="skipReceived(r)">⏭️ Skip</button>
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

          <!-- Empty state -->
          @if (mine().length === 0 && sentToFriends().length === 0 && fromFriends().length === 0) {
            <div class="empty-state a-fu" [style.--i]="5">
              <div class="empty-emoji">🔔</div>
              <h3>{{ selectedDate() ? 'No reminders on this day' : 'No reminders yet' }}</h3>
              <p>{{ selectedDate() ? 'Try another date or tap +' : 'Tap + to create your first reminder' }}</p>
            </div>
          }

        </div>
      }

      <button class="rem-fab a-pop rm-press-deep" [style.--i]="8" (click)="router.navigate(['/app/reminders/create'])">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
        New Reminder
      </button>

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
      display: flex; align-items: center; gap: 4px;
      padding: 9px 16px; background: var(--rm-purple); color: #fff;
      border: none; border-radius: 12px; font-size: 14px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      box-shadow: 0 4px 12px rgba(61,90,241,0.3);
    }
    .btn-new ion-icon { font-size: 17px; }
    .rem-progress { height: 5px; background: var(--rm-surface); border-radius: 3px; margin-top: 12px; overflow: hidden; }
    .rem-progress-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #3D5AF1, #5B7CFF);
      transition: width .6s var(--rm-ease-out);
      animation: barGrow .9s var(--rm-ease-out) .2s backwards;
    }
    @keyframes barGrow { from { width: 0; } }

    /* ── Stat cards ── */
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px 16px 0; }
    .stat-card {
      background: var(--rm-card); border-radius: 16px; padding: 12px 14px;
      box-shadow: var(--rm-shadow-sm); cursor: pointer;
      border: 1px solid var(--rm-border);
    }
    .stat-card.stat-alert { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); }
    .stat-num { font-size: 22px; font-weight: 900; color: var(--rm-text-primary); font-family: 'Nunito', sans-serif; }
    .stat-green { color: #10B981; }
    .stat-red { color: #EF4444; }
    .stat-label { font-size: 11.5px; font-weight: 600; color: var(--rm-text-muted); margin-top: 1px; }

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
    .cal-strip {
      display: flex;
      gap: 6px;
      padding: 12px 16px 4px;
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

    /* ── List body ── */
    .list-body { padding: 12px 16px 130px; display: flex; flex-direction: column; gap: 8px; }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--rm-text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 2px 6px;
      display: flex;
      align-items: center;
    }
    .from-label { color: #10B981; }

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
    .friend-card { border-left-style: dashed; }
    .from-card   { border-left-style: dotted; border-left-width: 4px; }

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

    .from-action-strip { display:flex; gap:6px; margin-top:10px; border-top:1px solid var(--rm-border); padding-top:8px; }
    .fas-btn { flex:1; padding:8px 4px; border:none; border-radius:10px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; }
    .fas-done   { background:rgba(16,185,129,0.12); color:#10B981; }
    .fas-update { background:rgba(139,92,246,0.12); color:#8B5CF6; }
    .fas-skip   { background:rgba(156,163,175,0.12); color:#6B7280; }

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
  private actionSheetCtrl     = inject(ActionSheetController);

  isLoading = signal(true);
  selectedDate = signal<string>('');
  statusFilter = signal<'all' | 'active' | 'done'>('all');

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

  readonly calendarDays = computed(() => {
    const own      = this.reminders();
    const received = this.receivedReminders();
    const today    = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 3 + i);
      const dateStr = this.localDateStr(d);
      const dayOwn      = own.filter(r => this.localDateStr(new Date(r.date)) === dateStr);
      const dayReceived = received.filter(r => this.localDateStr(new Date(r.date)) === dateStr);
      const all         = [...dayOwn, ...dayReceived];
      return {
        dateStr,
        num:        d.getDate(),
        weekday:    d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        isToday:    i === 3,
        hasMissed:  all.some(r => r.status === 'missed'),
        hasPending: all.some(r => r.status === 'pending' || r.status === 'snoozed'),
        hasDone:    all.some(r => r.status === 'done'),
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

  private readonly todayDateStr = this.localDateStr(new Date());

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
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
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

  constructor() {
    addIcons({ addOutline, checkmarkCircleOutline, timeOutline, trashOutline, personOutline, arrowDownOutline, playSkipForwardOutline });
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

  async changeReceivedStatus(r: ReceivedReminder): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: r.title,
      subHeader: 'Update your status on this reminder',
      buttons: [
        { text: '👀 Acknowledged',  data: 'acknowledged' },
        { text: '🔄 In Progress',   data: 'processing'   },
        { text: '✅ Completed',     data: 'completed'    },
        { text: '⏭️ Skip',         data: 'skipped'      },
        { text: 'Cancel',           role: 'cancel'       },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss();
    if (!data) return;
    this.reminderService.updateSharedStatus(r._id, data).subscribe();
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
