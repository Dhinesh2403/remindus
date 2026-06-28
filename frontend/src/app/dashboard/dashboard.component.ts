// src/app/dashboard/dashboard.component.ts
import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  timeOutline,
  notificationsOutline,
  alertCircleOutline,
  trendingUpOutline,
  calendarOutline,
  peopleOutline,
  addOutline,
  person,
  flameOutline,
  flagOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { ReminderService } from '../core/services/reminder.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    IonSkeletonText,
  ],
  template: `
    <ion-content class="dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="doRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Header -->
      <div class="home-header">
        <!-- Brand logo strip -->
        <div class="header-brand">
          <img src="assets/icon.svg" alt="RemindUs" class="header-brand-icon" />
          <span class="header-brand-name">RemindUs</span>
        </div>
        <div class="header-row">
          <div>
            <h1 class="greeting">{{ greeting }}, {{ firstName() }} 👋</h1>
            <p class="greeting-sub">
              You have {{ todayCount() }} reminder{{ todayCount() !== 1 ? 's' : '' }} for today
            </p>
          </div>
          <div class="avatar-btn" (click)="nav.navigate(['/app/settings'])">
            <ion-icon name="person" style="font-size:20px;color:white"></ion-icon>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card" (click)="goToReminders('today')">
          <div class="stat-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6">
            <ion-icon name="time-outline"></ion-icon>
          </div>
          <div class="stat-num" style="color:#3B82F6">{{ todayCount() }}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-card" (click)="goToReminders('upcoming')">
          <div class="stat-icon" style="background:rgba(124,58,237,0.12);color:#7C3AED">
            <ion-icon name="notifications-outline"></ion-icon>
          </div>
          <div class="stat-num" style="color:#7C3AED">{{ upcomingCount() }}</div>
          <div class="stat-label">Upcoming</div>
        </div>
        <div class="stat-card" (click)="goToReminders('missed')">
          <div class="stat-icon" style="background:rgba(239,68,68,0.12);color:#EF4444">
            <ion-icon name="alert-circle-outline"></ion-icon>
          </div>
          <div class="stat-num" style="color:#EF4444">{{ missedCount() }}</div>
          <div class="stat-label">Missed</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:#10B981">
            <ion-icon name="trending-up-outline"></ion-icon>
          </div>
          <div class="stat-num" style="color:#10B981">{{ completionRate() }}%</div>
          <div class="stat-label">Complete</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <div class="action-card cal-card" (click)="nav.navigate(['/app/calendar'])">
          <ion-icon name="calendar-outline" class="action-icon"></ion-icon>
          <div class="action-title">View Calendar</div>
          <div class="action-sub">See all your upcoming events</div>
        </div>
        <div class="action-card friends-card" (click)="nav.navigate(['/app/friends'])">
          <ion-icon name="people-outline" class="action-icon"></ion-icon>
          <div class="action-title">Friends</div>
          <div class="action-sub">Manage accountability buddies</div>
        </div>
      </div>

      <!-- Productivity modules -->
      <div class="modules-title">Get started</div>
      <div class="modules-grid">
        <div class="module-card" style="background:rgba(124,58,237,0.10)" (click)="nav.navigate(['/app/daily-plan'])">
          <div class="module-icon" style="background:#7C3AED">
            <ion-icon name="time-outline"></ion-icon>
          </div>
          <div class="module-title">Daily Plan</div>
          <div class="module-sub">Time-block your day</div>
        </div>
        <div class="module-card" style="background:rgba(224,115,43,0.10)" (click)="nav.navigate(['/app/habits'])">
          <div class="module-icon" style="background:#E0732B">
            <ion-icon name="flame-outline"></ion-icon>
          </div>
          <div class="module-title">Habits</div>
          <div class="module-sub">Build streaks</div>
        </div>
        <div class="module-card" style="background:rgba(123,97,216,0.10)" (click)="nav.navigate(['/app/goals'])">
          <div class="module-icon" style="background:#7B61D8">
            <ion-icon name="flag-outline"></ion-icon>
          </div>
          <div class="module-title">Goals</div>
          <div class="module-sub">Plan the big picture</div>
        </div>
        <div class="module-card" style="background:rgba(201,154,30,0.10)" (click)="nav.navigate(['/app/notes'])">
          <div class="module-icon" style="background:#C99A1E">
            <ion-icon name="document-text-outline"></ion-icon>
          </div>
          <div class="module-title">Sticky Notes</div>
          <div class="module-sub">Jot it down</div>
        </div>
      </div>

      <!-- FAB -->
      <div class="fab" (click)="nav.navigate(['/app/reminders/create'])">
        <ion-icon name="add-outline" style="font-size:26px;color:white"></ion-icon>
      </div>

    </ion-content>
  `,
  styles: [`
    .dashboard-content { --background: var(--rm-bg); }
    .home-header { padding: calc(env(safe-area-inset-top) + 12px) 16px 16px; background: var(--rm-card); border-radius: 0 0 24px 24px; margin-bottom: 16px; box-shadow: var(--rm-shadow-md); }
    .header-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .header-brand-icon { width: 30px; height: 30px; border-radius: 8px; }
    .header-brand-name { font-size: 15px; font-weight: 800; color: var(--rm-purple); letter-spacing: -0.3px; font-family: 'Nunito', sans-serif; }
    .header-row { display: flex; align-items: center; justify-content: space-between; }
    .greeting { font-size: 20px; font-weight: 800; color: var(--rm-text-primary); margin: 0; }
    .greeting-sub { font-size: 13px; color: var(--rm-text-secondary); margin: 4px 0 0; }
    .avatar-btn { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--rm-purple), #9333EA); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; margin-bottom: 16px; }
    .stat-card { background: var(--rm-card); border-radius: 18px; padding: 16px; box-shadow: var(--rm-shadow-sm); cursor: pointer; transition: transform 0.15s; }
    .stat-card:active { transform: scale(0.97); }
    .stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 10px; }
    .stat-num { font-size: 28px; font-weight: 900; line-height: 1; }
    .stat-label { font-size: 12px; color: var(--rm-text-muted); margin-top: 2px; }
    .quick-actions { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    .action-card { border-radius: 20px; padding: 20px; cursor: pointer; transition: transform 0.15s; }
    .action-card:active { transform: scale(0.98); }
    .cal-card { background: linear-gradient(135deg, #7C3AED, #9333EA); }
    .friends-card { background: linear-gradient(135deg, #06B6D4, #3B82F6); }
    .action-icon { font-size: 26px; color: white; }
    .action-title { font-size: 17px; font-weight: 800; color: white; margin-top: 8px; }
    .action-sub { font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 2px; }
    .fab { position: fixed; bottom: 88px; right: 20px; width: 54px; height: 54px; border-radius: 50%; background: var(--rm-purple); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 20px rgba(124,58,237,0.4); z-index: 100; }
    .modules-title { font-size: 16px; font-weight: 800; color: var(--rm-text-primary); padding: 24px 16px 0; }
    .modules-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px 16px 24px; }
    .module-card { border-radius: 20px; padding: 16px; cursor: pointer; min-height: 124px; display: flex; flex-direction: column; transition: transform 0.15s; }
    .module-card:active { transform: scale(0.97); }
    .module-icon { width: 44px; height: 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; }
    .module-title { font-size: 15.5px; font-weight: 800; color: var(--rm-text-primary); margin-top: 14px; }
    .module-sub { font-size: 12px; color: var(--rm-text-secondary); margin-top: 3px; }
  `],
})
export class DashboardComponent implements OnInit {
  protected nav = inject(Router);
  private authService = inject(AuthService);
  private reminderService = inject(ReminderService);

  readonly currentUser = this.authService.currentUser;
  readonly todayCount = this.reminderService.todayCount;
  readonly upcomingCount = this.reminderService.upcomingCount;
  readonly missedCount = this.reminderService.missedCount;
  readonly completionRate = this.reminderService.completionRate;

  readonly firstName = computed(() => {
    const name = this.currentUser()?.name ?? '';
    return name.split(' ')[0];
  });

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  constructor() {
    addIcons({
      timeOutline, notificationsOutline, alertCircleOutline,
      trendingUpOutline, calendarOutline, peopleOutline,
      addOutline, person, flameOutline, flagOutline, documentTextOutline,
    });
  }

  ngOnInit(): void {
    this.reminderService.loadStats().subscribe();
  }

  doRefresh(event: CustomEvent): void {
    this.reminderService.loadStats().subscribe({
      complete: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  goToReminders(filter: string): void {
    this.nav.navigate(['/app/reminders'], { queryParams: { filter } });
  }
}
