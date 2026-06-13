// src/app/reminders/list/reminder-list.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonFab, IonFabButton, IonIcon,
  IonRefresher, IonRefresherContent,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem,
  IonChip, IonLabel, IonSkeletonText,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  addOutline, checkmarkCircleOutline, timeOutline,
  trashOutline, createOutline, filterOutline,
  notificationsOffOutline, shareOutline,
} from 'ionicons/icons';
import { ReminderService, Reminder, ReminderStatus, ReminderType } from '../../core/services/reminder.service';

const CATEGORY_META: Record<ReminderType, { emoji: string; color: string; bg: string; label: string }> = {
  birthday: { emoji: '🎂', color: '#EC4899', bg: '#FDF2F8', label: 'Birthday' },
  wedding:  { emoji: '💍', color: '#8B5CF6', bg: '#F5F3FF', label: 'Wedding' },
  medicine: { emoji: '💊', color: '#EF4444', bg: '#FEF2F2', label: 'Medicine' },
  bill:     { emoji: '💰', color: '#3B82F6', bg: '#EFF6FF', label: 'Bill' },
  study:    { emoji: '📚', color: '#10B981', bg: '#ECFDF5', label: 'Study' },
  work:     { emoji: '💼', color: '#F59E0B', bg: '#FFFBEB', label: 'Work' },
  general:  { emoji: '📌', color: '#6B7280', bg: '#F3F4F6', label: 'General' },
  custom:   { emoji: '✨', color: '#7C3AED', bg: '#EDE9FE', label: 'Custom' },
};

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonFab, IonFabButton, IonIcon,
    IonRefresher, IonRefresherContent,
    IonItemSliding, IonItemOptions, IonItemOption, IonItem,
    IonChip, IonLabel, IonSkeletonText,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>All Reminders</ion-title>
        <ion-icon
          slot="end"
          name="filter-outline"
          style="font-size:22px;margin-right:16px;cursor:pointer;color:var(--rm-purple)"
          (click)="toggleFilters()"
        ></ion-icon>
      </ion-toolbar>
    </ion-header>

    <ion-content class="reminder-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Filter chips -->
      @if (showFilters()) {
        <div class="filter-row">
          <ion-chip
            [color]="activeFilter() === 'all' ? 'primary' : 'medium'"
            (click)="setFilter('all')"
          >All</ion-chip>
          <ion-chip
            [color]="activeFilter() === 'pending' ? 'primary' : 'medium'"
            (click)="setFilter('pending')"
          >Pending</ion-chip>
          <ion-chip
            [color]="activeFilter() === 'done' ? 'primary' : 'medium'"
            (click)="setFilter('done')"
          >Done</ion-chip>
          <ion-chip
            [color]="activeFilter() === 'missed' ? 'primary' : 'medium'"
            (click)="setFilter('missed')"
          >Missed</ion-chip>
        </div>
      }

      <!-- Skeleton loading -->
      @if (isLoading()) {
        @for (i of [1,2,3,4]; track i) {
          <div class="reminder-card-skeleton">
            <ion-skeleton-text animated style="width:40px;height:40px;border-radius:50%"></ion-skeleton-text>
            <div style="flex:1;padding-left:12px">
              <ion-skeleton-text animated style="width:70%;height:16px;margin-bottom:8px;border-radius:4px"></ion-skeleton-text>
              <ion-skeleton-text animated style="width:50%;height:12px;border-radius:4px"></ion-skeleton-text>
            </div>
          </div>
        }
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-emoji">🔔</div>
          <h3>No reminders yet</h3>
          <p>Tap + to create your first reminder</p>
        </div>
      } @else {
        <div class="reminder-list">
          @for (reminder of filtered(); track reminder._id) {
            <ion-item-sliding>

              <!-- Left swipe → Done -->
              <ion-item-options side="start">
                <ion-item-option color="success" (click)="markDone(reminder)">
                  <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                </ion-item-option>
              </ion-item-options>

              <!-- Reminder card -->
              <ion-item lines="none" class="reminder-item">
                <div
                  class="reminder-card"
                  [style.border-left-color]="meta(reminder.type).color"
                  (click)="openDetail(reminder._id)"
                >
                  <div class="reminder-top">
                    <span class="reminder-emoji">{{ meta(reminder.type).emoji }}</span>
                    <div class="reminder-info">
                      <div class="reminder-title"
                        [class.done-text]="reminder.status === 'done'"
                      >{{ reminder.title }}</div>
                      @if (reminder.description) {
                        <div class="reminder-desc">{{ reminder.description }}</div>
                      }
                    </div>
                    <div class="priority-dot" [style.background]="priorityColor(reminder.priority)"></div>
                  </div>

                  <div class="reminder-meta">
                    <span class="meta-time">
                      <ion-icon name="time-outline"></ion-icon>
                      {{ formatDateTime(reminder.date, reminder.time) }}
                    </span>
                    <span
                      class="tag"
                      [style.background]="meta(reminder.type).color + '20'"
                      [style.color]="meta(reminder.type).color"
                    >{{ meta(reminder.type).label }}</span>
                  </div>

                  @if (reminder.status === 'pending' || reminder.status === 'snoozed') {
                    <div class="reminder-actions">
                      <button class="btn-done" (click)="markDone(reminder); $event.stopPropagation()">
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        Done
                      </button>
                      <button class="btn-snooze" (click)="snooze(reminder); $event.stopPropagation()">
                        <ion-icon name="time-outline"></ion-icon>
                        Snooze
                      </button>
                    </div>
                  }
                </div>
              </ion-item>

              <!-- Right swipe → Delete -->
              <ion-item-options side="end">
                <ion-item-option color="danger" (click)="confirmDelete(reminder)">
                  <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                </ion-item-option>
              </ion-item-options>

            </ion-item-sliding>
          }
        </div>
      }

      <!-- FAB -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button color="primary" (click)="router.navigate(['/app/reminders/create'])">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

    </ion-content>
  `,
  styles: [`
    .reminder-content { --background: var(--rm-bg); }
    ion-toolbar { --background: var(--rm-card); --color: var(--rm-text-primary); font-weight: 800; }
    .filter-row { display: flex; gap: 8px; padding: 8px 16px; overflow-x: auto; scrollbar-width: none; }
    .filter-row::-webkit-scrollbar { display: none; }
    .reminder-item { --padding-start: 0; --inner-padding-end: 0; --background: transparent; }
    .reminder-list { padding: 8px 16px; display: flex; flex-direction: column; gap: 10px; padding-bottom: 100px; }
    .reminder-card { background: var(--rm-card); border-radius: 18px; padding: 16px; box-shadow: var(--rm-shadow-sm); border-left: 4px solid var(--rm-border); width: 100%; cursor: pointer; }
    .reminder-card:active { opacity: 0.9; }
    .reminder-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .reminder-emoji { font-size: 24px; flex-shrink: 0; }
    .reminder-info { flex: 1; }
    .reminder-title { font-size: 15px; font-weight: 700; color: var(--rm-text-primary); }
    .done-text { text-decoration: line-through; color: var(--rm-text-muted); }
    .reminder-desc { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .reminder-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .meta-time { font-size: 12px; color: var(--rm-text-muted); display: flex; align-items: center; gap: 4px; }
    .meta-time ion-icon { font-size: 13px; }
    .tag { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .reminder-actions { display: flex; gap: 8px; }
    .btn-done { padding: 8px 16px; background: rgba(16,185,129,0.12); color: #10B981; border: 1.5px solid rgba(16,185,129,0.25); border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; font-family: inherit; }
    .btn-snooze { padding: 8px 16px; background: rgba(59,130,246,0.12); color: #3B82F6; border: 1.5px solid rgba(59,130,246,0.25); border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; font-family: inherit; }
    .btn-done ion-icon, .btn-snooze ion-icon { font-size: 13px; }
    .reminder-card-skeleton { display: flex; align-items: center; padding: 16px; background: var(--rm-card); border-radius: 18px; margin: 8px 16px; }
    .empty-state { text-align: center; padding: 80px 32px; }
    .empty-emoji { font-size: 64px; margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 700; color: var(--rm-text-primary); margin-bottom: 8px; }
    .empty-state p { font-size: 14px; color: var(--rm-text-muted); }
    ion-fab-button { --background: var(--rm-purple); --box-shadow: 0 6px 20px rgba(124,58,237,0.4); }
  `],
})
export class ReminderListComponent implements OnInit {
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private reminderService = inject(ReminderService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  isLoading = signal(true);
  showFilters = signal(false);
  activeFilter = signal<string>('all');

  readonly reminders = this.reminderService.reminders;

  readonly filtered = computed(() => {
    const f = this.activeFilter();
    const all = this.reminders();
    if (f === 'all') return all;
    return all.filter((r) => r.status === f);
  });

  constructor() {
    addIcons({
      addOutline, checkmarkCircleOutline, timeOutline,
      trashOutline, createOutline, filterOutline,
      notificationsOffOutline, shareOutline,
    });
  }

  ngOnInit(): void {
    const filter = this.route.snapshot.queryParamMap.get('filter');
    if (filter) this.activeFilter.set(filter);
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.reminderService.getAll().subscribe({
      complete: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false),
    });
  }

  doRefresh(event: CustomEvent): void {
    this.reminderService.getAll().subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  toggleFilters(): void { this.showFilters.update(v => !v); }
  setFilter(f: string): void { this.activeFilter.set(f); }

  openDetail(id: string): void {
    this.router.navigate(['/app/reminders', id]);
  }

  markDone(reminder: Reminder): void {
    this.reminderService.markDone(reminder._id).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `✅ "${reminder.title}" marked as done!`,
          duration: 2000,
          color: 'success',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  snooze(reminder: Reminder): void {
    this.reminderService.snooze(reminder._id, 30).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: `⏰ Snoozed for 30 minutes`,
          duration: 2000,
          color: 'warning',
          position: 'top',
        });
        toast.present();
      },
    });
  }

  async confirmDelete(reminder: Reminder): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Reminder',
      message: `Delete "${reminder.title}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.reminderService.delete(reminder._id).subscribe();
          },
        },
      ],
    });
    await alert.present();
  }

  meta(type: ReminderType) { return CATEGORY_META[type] ?? CATEGORY_META.general; }

  priorityColor(p: string): string {
    return { low: '#10B981', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' }[p] ?? '#9CA3AF';
  }

  formatDateTime(date: string, time: string): string {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let label = '';
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === tomorrow.toDateString()) label = 'Tomorrow';
    else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${label}, ${time}`;
  }
}
